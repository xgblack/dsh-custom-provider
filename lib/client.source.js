const h = React.createElement;
const NS = NAMESPACE;
const inject = ["slots", "remote", "remote.settings", "settingsSchema"];
const zh = typeof navigator !== "undefined" && navigator.language?.startsWith("zh");
const tr = (cn, en) => zh ? cn : en;
const labels = {
  reasoningEfforts: tr("推理档位", "Reasoning efforts"),
  compat: tr("协议兼容", "Protocol compatibility"),
  thinkingBudgets: tr("推理预算", "Thinking budgets"),
  retryPolicy: tr("重试策略", "Retry policy"),
  headers: tr("请求头", "Request headers")
};
const title = (key) => labels[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2");
const css = `
.dcp { border-top: 1px solid #9995; margin-top: 12px; padding-top: 10px; color: inherit; font-size: 13px; }
.dcp summary { cursor: pointer; font-weight: 600; }
.dcp-body { padding: 12px 0 2px; }
.dcp-tabs { display: flex; gap: 4px; border-bottom: 1px solid #9995; margin-bottom: 12px; }
.dcp-tabs button { border: 0; border-bottom: 2px solid transparent; background: transparent; color: inherit; padding: 7px 12px; cursor: pointer; }
.dcp-tabs button[aria-selected=true] { border-bottom-color: #2b8063; font-weight: 600; }
.dcp-section { margin: 0 0 12px; }
.dcp-section > summary { padding: 7px 0; }
.dcp-field { display: grid; grid-template-columns: minmax(145px, 1fr) minmax(175px, 2fr) auto; align-items: start; gap: 7px 12px; padding: 8px 0; border-top: 1px solid #9993; }
.dcp-field label { padding-top: 6px; overflow-wrap: anywhere; }
.dcp-field input, .dcp-field select, .dcp-field textarea { box-sizing: border-box; width: 100%; min-width: 0; padding: 6px 8px; font: inherit; color: inherit; background: transparent; border: 1px solid #8888; border-radius: 4px; }
.dcp-field textarea { min-height: 76px; resize: vertical; font-family: ui-monospace, monospace; }
.dcp-field input[type=checkbox] { width: auto; margin: 8px 0; }
.dcp-actions { display: flex; gap: 5px; align-items: center; }
.dcp button { font: inherit; cursor: pointer; }
.dcp-actions button, .dcp-id button { padding: 6px 9px; border: 1px solid #8888; border-radius: 4px; background: transparent; color: inherit; white-space: nowrap; }
.dcp button:disabled { opacity: .48; cursor: not-allowed; }
.dcp button:focus-visible, .dcp input:focus-visible, .dcp select:focus-visible, .dcp textarea:focus-visible, .dcp summary:focus-visible { outline: 2px solid #2b8063; outline-offset: 2px; }
.dcp-meta { grid-column: 2 / -1; color: #698077; font-size: 12px; }
.dcp-error { color: #a12c36; margin: 8px 0; white-space: pre-wrap; }
.dcp-note { color: #698077; margin: 8px 0; line-height: 1.5; }
.dcp-model { border-top: 1px solid #9995; padding: 8px 0; }
.dcp-model summary { font-weight: 500; }
.dcp-id { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
.dcp-id input { min-width: 160px; max-width: 300px; padding: 6px 8px; font: inherit; }
.dcp-compare { font-size: 12px; color: #52645e; margin: 8px 0 12px; overflow-wrap: anywhere; }
@media(max-width: 700px) { .dcp-field { grid-template-columns: minmax(0, 1fr); } .dcp-meta { grid-column: 1; } .dcp-actions { justify-content: flex-start; } }
`;
let catalogCache;

function enumValues(node) {
  return node?.type === "union" && node.list?.every((part) => part.type === "const")
    ? node.list.map((part) => part.value) : undefined;
}

function encode(value, node) {
  if (value === undefined) return "";
  return node.type === "string" ? String(value) : JSON.stringify(value, null, 2);
}

function decode(text, node) {
  if (node.type === "string") return text;
  if (node.type === "number" || node.type === "natural") {
    if (text.trim() === "") throw new Error(tr("请输入数字", "Enter a number"));
    const value = Number(text);
    if (!Number.isFinite(value)) throw new Error(tr("数字无效", "Invalid number"));
    return value;
  }
  return JSON.parse(text);
}

function Control({ node, value, onChange, disabled, id }) {
  const enums = enumValues(node);
  if (node.type === "boolean") return h("input", {
    id, type: "checkbox", checked: value === true, disabled,
    onChange: (event) => onChange(event.target.checked)
  });
  if (enums) return h("select", {
    id, value: value === undefined ? "" : String(value), disabled,
    onChange: (event) => onChange(event.target.value)
  }, [h("option", { key: "", value: "", disabled: true }, tr("选择值", "Select a value")),
    ...enums.map((entry) => h("option", { key: String(entry), value: String(entry) }, String(entry)))]);
  if (node.type === "dict" || node.type === "array" || node.type === "object" || node.type === "union") {
    return h("textarea", { id, value, disabled, spellCheck: false, onChange: (event) => onChange(event.target.value) });
  }
  return h("input", { id, value, disabled, type: node.type === "number" || node.type === "natural" ? "number" : "text",
    step: node.type === "number" || node.type === "natural" ? "any" : undefined,
    onChange: (event) => onChange(event.target.value) });
}

function Field({ node, fieldPath, modelId, view, route, save, busy, readOnly }) {
  const state = fieldState(view, route, modelId, fieldPath);
  const id = `dcp-${route}-${modelId ?? "route"}-${fieldPath.join("-")}`;
  const [draft, setDraft] = React.useState(() => encode(state.value, node));
  const [error, setError] = React.useState("");
  const encoded = encode(state.value, node);
  React.useEffect(() => { setDraft(encoded); setError(""); }, [encoded, view.revision]);
  const options = enumValues(node);
  const immediate = node.type === "boolean" || Boolean(options);
  const submit = async (next) => {
    try {
      const parsed = immediate ? next : decode(next, node);
      const failure = await save(modelId, fieldPath, parsed, false);
      setError(failure ?? "");
    } catch (cause) { setError(cause.message); }
  };
  const restore = async () => setError(await save(modelId, fieldPath, undefined, true) ?? "");
  const disabled = busy || readOnly || state.readOnly;
  return h("div", { className: "dcp-field" },
    h("label", { htmlFor: id }, title(fieldPath.at(-1))),
    h(Control, { node, id, value: immediate ? state.value : draft,
      onChange: immediate ? submit : setDraft, disabled }),
    h("div", { className: "dcp-actions" },
      immediate ? null : h("button", { type: "button", disabled: disabled || draft === encoded,
        onClick: () => submit(draft) }, tr("保存", "Save")),
      h("button", { type: "button", disabled: disabled || !state.overridden, onClick: restore,
        title: tr("删除用户覆盖，回到继承值", "Remove the user override") }, tr("恢复", "Restore"))),
    state.overridden ? h("small", { className: "dcp-meta" }, tr("用户覆盖", "User override")) : null,
    error ? h("div", { className: "dcp-error", role: "alert", style: { gridColumn: "2 / -1" } }, error) : null);
}

function Fields({ node, modelId, view, route, save, busy, readOnly, excluded, prefix = [] }) {
  if (!node?.dict) return null;
  return Object.entries(node.dict).filter(([key]) => !excluded?.has(key)).map(([key, child]) => {
    const path = [...prefix, key];
    if (child.type === "object" && child.dict) {
      return h("details", { className: "dcp-section", key: path.join(".") },
        h("summary", null, title(key)),
        h(Fields, { node: child, modelId, view, route, save, busy, readOnly, prefix: path }));
    }
    return h(Field, { key: path.join("."), node: child, fieldPath: path, modelId, view, route, save, busy, readOnly });
  });
}

function Comparison({ catalog, route, modelId }) {
  if (!catalog) return null;
  const match = matchModelsDev(catalog, route, modelId);
  if (!match) return h("p", { className: "dcp-note" }, tr("models.dev 无唯一匹配", "No unambiguous models.dev match"));
  const entry = match.value;
  const pairs = [
    ["name", entry.name], ["contextWindow", entry.limit?.context],
    ["maxTokens", entry.limit?.output], ["input", entry.modalities?.input]
  ].filter(([, value]) => value !== undefined);
  return h("p", { className: "dcp-compare" }, `models.dev · ${match.key}: `,
    pairs.map(([key, value], index) => `${index ? " · " : ""}${key} ${Array.isArray(value) ? value.join(", ") : value}`));
}

async function loadCatalog(signal) {
  if (catalogCache && Date.now() - catalogCache.at < 6 * 60 * 60 * 1000) return catalogCache.data;
  const response = await fetch("https://models.dev/models.json", { signal });
  if (!response.ok) throw new Error(`models.dev HTTP ${response.status}`);
  const data = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid models.dev catalog");
  catalogCache = { at: Date.now(), data };
  return data;
}

function EnhancedCard({ provider, api, schema }) {
  const route = provider.provider;
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("route");
  const [view, setView] = React.useState();
  const [writable, setWritable] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState("");
  const [catalog, setCatalog] = React.useState();
  const [catalogError, setCatalogError] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const refresh = React.useCallback(async () => {
    const response = await api.settings.describe();
    if (!response.ok) throw new Error(response.error.message);
    const namespace = response.value.namespaces.find((item) => item.ns === NS);
    if (!namespace) throw new Error(tr("llm-pi-ai 未注册，检查其配置和插件状态", "llm-pi-ai is not registered"));
    setView(namespace);
    setWritable(response.value.writable);
    setFailure("");
  }, [api]);
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    refresh().catch((error) => { if (active) setFailure(error.message); });
    const dispose = api.subscribe(() => refresh().catch((error) => { if (active) setFailure(error.message); }));
    return () => { active = false; dispose(); };
  }, [open, refresh, api]);
  React.useEffect(() => {
    if (!open || tab !== "models") return;
    const controller = new AbortController();
    loadCatalog(controller.signal).then(setCatalog).catch((error) => {
      if (error.name !== "AbortError") setCatalogError(error.message);
    });
    return () => controller.abort();
  }, [open, tab]);
  const save = async (id, path, value, restore) => {
    if (!view || busy) return tr("配置尚未就绪", "Settings are not ready");
    let op;
    try { op = editOperation(view, route, id, path, value, restore); }
    catch (error) { return error.message; }
    if (!op) return undefined;
    const root = schema.rehydrate(view.schema);
    const invalid = schema.validate(root, candidate(view, op));
    if (invalid) return invalid;
    setBusy(true);
    try {
      const response = await api.settings.mutate(NS, [op], view.revision);
      if (!response.ok) {
        if (response.error.code === "settings/conflict") {
          await refresh();
          return tr("配置已被其他编辑更新，请核对当前值后重试", "Settings changed elsewhere; review the new value and retry");
        }
        return response.error.message;
      }
      setView(response.value);
      return undefined;
    } catch (error) { return error.message; }
    finally { setBusy(false); }
  };
  let root;
  let routeNode;
  let modelNode;
  let schemaFailure;
  if (view) {
    try {
      root = schema.rehydrate(view.schema);
      routeNode = schema.nodeAtPath(root, ["providers", route]);
      modelNode = schema.nodeAtPath(root, ["providers", route, "models", "0"]);
    } catch (error) { schemaFailure = error.message; }
  }
  const mode = view ? modelMode(view, route) : "catalog";
  const profile = getAt(view?.value, ["providers", route]);
  const listed = Array.isArray(profile?.models) ? profile.models.map((item) => item.id) : [];
  const overrides = Object.keys(profile?.modelOverrides ?? {});
  const ids = mode === "catalog" ? [...new Set([...overrides, ...(modelId.trim() ? [modelId.trim()] : [])])] : listed;
  const readOnly = !writable || Boolean(provider.error) || !profile;
  return h("div", { className: "dcp" },
    h("details", { open, onToggle: (event) => setOpen(event.currentTarget.open) },
      h("summary", null, tr("增强配置", "Advanced settings")),
      open ? h("div", { className: "dcp-body" },
        failure || schemaFailure ? h("p", { className: "dcp-error", role: "alert" }, failure || schemaFailure) : null,
        provider.error ? h("p", { className: "dcp-error", role: "alert" }, provider.error) : null,
        !view ? failure ? h("button", { type: "button", onClick: () => refresh().catch((error) => setFailure(error.message)) },
          tr("重试", "Retry")) : h("p", { className: "dcp-note" }, tr("加载配置中…", "Loading settings…")) :
        !profile ? h("p", { className: "dcp-note" }, tr("先在官方界面配置此提供方", "Configure this provider in the built-in editor first")) :
        h(React.Fragment, null,
          h("div", { className: "dcp-tabs", role: "tablist" },
            [["route", tr("提供方", "Provider")], ["models", tr("模型", "Models")]].map(([key, label]) =>
              h("button", { key, type: "button", role: "tab", "aria-selected": tab === key,
                onClick: () => setTab(key) }, label))),
          tab === "route" ? h(Fields, { node: routeNode, view, route, save, busy, readOnly, excluded: ROUTE_EXCLUDED }) :
          h(React.Fragment, null,
            mode === "inherited" ? h("p", { className: "dcp-note" }, tr("模型列表来自组合配置。此处保持只读，避免为一个字段接管整份列表。", "This model list is inherited and read-only here to avoid replacing the entire list.")) : null,
            mode === "catalog" ? h("div", { className: "dcp-id" },
              h("label", { htmlFor: `dcp-model-id-${route}` }, tr("内置模型 ID", "Built-in model ID")),
              h("input", { id: `dcp-model-id-${route}`, value: modelId, onChange: (event) => setModelId(event.target.value),
                placeholder: tr("精确输入模型 ID", "Exact model ID") })) : null,
            ids.length ? ids.map((id) => h("details", { className: "dcp-model", key: id },
              h("summary", null, id),
              h(Comparison, { catalog, route, modelId: id }),
              h(Fields, { node: modelNode, modelId: id, view, route, save, busy,
                readOnly: readOnly || mode === "inherited", excluded: MODEL_EXCLUDED }))) :
              h("p", { className: "dcp-note" }, tr("输入内置模型 ID 以编辑覆盖", "Enter a built-in model ID to edit its overrides")),
            catalogError ? h("p", { className: "dcp-note" }, `models.dev: ${catalogError}`) : null))) : null));
}

function apply(ctx) {
  const api = {
    settings: ctx.get("remote.settings"),
    subscribe: (callback) => ctx.get("remote").$on("settings/document-updated", (ns) => {
      if (ns === NS) callback();
    })
  };
  ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({
    name: "settings.models.provider-card", key: NS,
    inject: () => ({ api, schema: ctx.settingsSchema })
  }, EnhancedCard));
  ctx.effect(() => {
    if (document.getElementById("dsh-custom-provider-styles")) return;
    const style = document.createElement("style");
    style.id = "dsh-custom-provider-styles";
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  });
}
