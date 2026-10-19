/**
 * DSH 0.2.1-rc.2 exposes provider/footer slots, but no model-detail slot.
 * Decorate its registered section in place so the renderer retains the native
 * injection, child-slot authorization, controller and provider draft ownership.
 * This adapter is intentionally limited to the named native editor components;
 * it neither copies the page nor reads React fibers or private hook state.
 */
export function decorateModelsSection(NativeSection, tools, active) {
  const wrappers = new WeakMap();
  const editorNames = new Set(["Loaded", "ProviderEditor", "CustomProviderCard", "ModelListEditor", "ModelRow", "EditorFooter"]);

  function walk(node, rowKeys) {
    if (Array.isArray(node)) return React.Children.toArray(node).map((child) => walk(child, rowKeys));
    if (!React.isValidElement(node)) return node;
    if (typeof node.type === "function" && editorNames.has(node.type.name)) {
      let Wrapped = wrappers.get(node.type);
      if (!Wrapped) {
        const Native = node.type;
        Wrapped = Native.name === "ModelRow" ? function InlineModelRow(props) {
          const [capacities, setCapacities] = React.useState({});
          const forwarded = { ...props };
          for (const field of ["contextWindow", "maxTokens"]) {
            const override = capacities[field];
            if (override && Object.is(override.count, props.model[field])) forwarded[field] = {
              ...props[field], value: override.text,
              onChange(value) {
                setCapacities((current) => ({ ...current, [field]: undefined }));
                props[field].onChange(value);
              }
            };
          }
          const onChange = (next) => {
            // Native capacity inputs keep their own text buffers. Override their
            // spelling after a whole-row edit until the user types in them again.
            setCapacities(Object.fromEntries(["contextWindow", "maxTokens"].map((field) =>
              [field, { count: next[field], text: next[field] === undefined ? "" : String(next[field]) }])));
            props.onChange(next);
          };
          const editor = useInlineModelTools({ model: props.model, disabled: props.disabled, onChange, t: tools.t });
          const output = Native(forwarded);
          // The DeepSeek adapter has its own schema; these tools target pi-ai.
          if (!props.expanded || props.inputField !== "input") return output;
          if (typeof props.onChange !== "function" || !props.contextWindow || !props.maxTokens) {
            throw new Error("Unsupported DSH ModelRow contract");
          }
          const children = React.Children.toArray(output.props.children);
          const advanced = children[1];
          if (!React.isValidElement(advanced) || advanced.type !== "div") throw new Error("Unsupported DSH model details layout");
          children[1] = React.cloneElement(advanced, {}, advanced.props.children,
            React.createElement(InlineModelTools, { key: "dcp-inline-tools", ...editor }));
          return React.cloneElement(output, {}, ...children);
        } : Native.name === "ModelListEditor" ? function NativeModelList(props) {
          // Native row keys are indices. Give only our row wrappers stable keys
          // so deleting a preceding row cannot discard another model's JSON.
          const previous = React.useRef([]);
          const sequence = React.useRef(0);
          const available = new Set(previous.current);
          const identities = props.models.map((model, index) => {
            const existing = [...available].find((item) => item.model === model) ??
              [...available].find((item) => item.model.id === model.id) ??
              (previous.current.length === props.models.length && available.has(previous.current[index]) ? previous.current[index] : undefined);
            if (existing) available.delete(existing);
            return { model, key: existing?.key ?? `dcp-model-${++sequence.current}` };
          });
          previous.current = identities;
          return walk(Native(props), identities.map((item) => item.key));
        } : Native.name === "EditorFooter" ? function NativeFooter(props) {
          const pending = React.useContext(ModelDraftContext);
          return React.createElement(React.Fragment, null,
            pending?.blocked ? React.createElement("p", { className: "dcp-tools-note", role: "status" }, tools.t("pendingJson")) : null,
            Native({ ...props, submitDisabled: props.submitDisabled || pending?.blocked }));
        } : function NativeEditor(props) {
          const output = walk(Native(props));
          if (Native.name === "ProviderEditor" || Native.name === "CustomProviderCard") return React.createElement(ModelDraftBoundary, null, output);
          if (Native.name !== "Loaded" || !React.isValidElement(output) || output.type !== "div") return output;
          const children = React.Children.toArray(output.props.children);
          if (children[0]?.type !== "h2") return output;
          children[0] = React.createElement(TransferToolbar, { key: "dcp-page-toolbar", ...tools, title: children[0] });
          return React.cloneElement(output, {}, ...children);
        };
        Wrapped.displayName = `DshModelTools(${Native.name})`;
        wrappers.set(Native, Wrapped);
      }
      return React.createElement(Wrapped, { ...node.props, key: node.type.name === "ModelRow" ? rowKeys?.[node.props.position - 1] ?? node.key : node.key });
    }
    if (node.props.children === undefined) return node;
    return React.cloneElement(node, {}, walk(node.props.children, rowKeys));
  }

  function IntegratedModelsSection(props) {
    const enabled = React.useSyncExternalStore(active.subscribe, active.getSnapshot, active.getSnapshot);
    const output = NativeSection(props);
    return enabled ? walk(output) : output;
  }
  return IntegratedModelsSection;
}

export function installModelsIntegration(slots, tools) {
  let enabled = true;
  const listeners = new Set();
  const active = { subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => enabled };
  const decorated = new Map();
  const reconcile = () => {
    for (const entry of slots.entries("settings.section")) {
      if (entry.options.id !== "models" || decorated.has(entry)) continue;
      if (entry.component?.name !== "ModelsSection") continue;
      const original = entry.component;
      const component = decorateModelsSection(original, tools, active);
      decorated.set(entry, { original, component });
      entry.component = component;
    }
  };
  reconcile();
  if (!decorated.size) throw new Error("This DSH Models page is incompatible with dsh-custom-provider (tested with 0.2.1-rc.2)");
  const unsubscribe = slots.subscribe("settings.section", reconcile);
  return () => {
    enabled = false;
    unsubscribe();
    for (const [entry, { original, component }] of decorated) if (entry.component === component) entry.component = original;
    for (const notify of listeners) notify();
    decorated.clear();
  };
}
