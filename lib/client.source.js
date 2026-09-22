const h = React.createElement;
const NS = NAMESPACE;
const inject = ["slots", "remote", "remote.settings", "remote.credentials", "remote.llm", "settingsSchema"];
const zh = typeof navigator !== "undefined" && navigator.language?.startsWith("zh");
const tr = (cn, en) => zh ? cn : en;
const STANDARD_REASONING = {
  off: null,
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: "max"
};

const css = `
.dcp-page { max-width: 760px; color: var(--dsw-alias-label-primary, inherit); display: flex; flex-direction: column; gap: 18px; }
.dcp-page h2 { margin: 0; font-size: 16px; font-weight: 500; line-height: 24px; }
.dcp-section { min-width: 0; }
.dcp-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.dcp-section-head h3 { margin: 0; font-size: 14px; font-weight: 500; }
.dcp-list { list-style: none; padding: 0; margin: 0; border-top: .5px solid var(--dsw-alias-border-l4, #8886); }
.dcp-list li { border-bottom: .5px solid var(--dsw-alias-border-l4, #8886); }
.dcp-row { display: flex; align-items: center; justify-content: space-between; min-width: 0; gap: 10px; padding: 4px 0; }
.dcp-row-main { flex: 1; min-width: 0; }
.dcp-row-meta { color: var(--dsw-alias-label-tertiary, #777); font-size: 12px; overflow-wrap: anywhere; }
.dcp-row-actions { display: flex; align-items: center; gap: 4px; flex: none; }
.dcp-selected { color: var(--dsw-alias-brand-primary, #23745a); font-weight: 600; }
.dcp-panel { background: var(--dsw-alias-bg-module-platform, transparent); padding: 14px 16px; border-radius: 6px; margin-top: 12px; }
.dcp-search, .dcp-input, .dcp-select, .dcp-json { box-sizing: border-box; width: 100%; color: inherit; background: var(--dsw-alias-bg-layer-1, transparent); border: .5px solid var(--dsw-alias-border-l4, #8887); border-radius: 6px; font: inherit; }
.dcp-search, .dcp-input, .dcp-select { height: 34px; padding: 0 10px; font-size: 13px; }
.dcp-search:focus, .dcp-input:focus, .dcp-select:focus, .dcp-json:focus { border-color: var(--dsw-alias-brand-primary, #2b8063); outline: none; }
.dcp-search::placeholder, .dcp-input::placeholder { color: var(--dsw-alias-label-dimmed, #777); }
.dcp-provider-button, .dcp-model-button { min-width: 0; border: 0; color: inherit; background: transparent; text-align: left; cursor: pointer; border-radius: 4px; font: inherit; padding: 7px 6px; overflow-wrap: anywhere; }
.dcp-provider-button:hover, .dcp-model-button:hover { background: var(--dsw-alias-interactive-bg-hover, #8882); }
.dcp-provider-button { width: 100%; font-size: 13px; }
.dcp-model-button { width: 100%; font-size: 12px; }
.dcp-content { min-width: 0; }
.dcp-model-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.dcp-model-title { min-width: 0; }
.dcp-model-title h3 { margin: 0; font-size: 15px; font-weight: 500; line-height: 22px; overflow-wrap: anywhere; }
.dcp-model-id { margin-top: 2px; color: var(--dsw-alias-label-tertiary, #777); font-family: var(--ds-font-family-code, ui-monospace, monospace); font-size: 12px; overflow-wrap: anywhere; }
.dcp-badge { flex: none; border: .5px solid var(--dsw-alias-border-l3, #8886); border-radius: 4px; padding: 2px 6px; color: var(--dsw-alias-label-secondary, inherit); font-size: 11px; line-height: 16px; }
.dcp-tabs { display: flex; gap: 2px; border-bottom: .5px solid var(--dsw-alias-border-l3, #8885); margin-bottom: 18px; }
.dcp-tab { height: 34px; border: 0; border-bottom: 2px solid transparent; color: var(--dsw-alias-label-secondary, inherit); background: transparent; padding: 0 12px; cursor: pointer; font: inherit; font-size: 13px; }
.dcp-tab[aria-selected=true] { border-bottom-color: var(--dsw-alias-brand-primary, #2b8063); color: var(--dsw-alias-label-primary, inherit); font-weight: 500; }
.dcp-form { display: flex; flex-direction: column; gap: 14px; }
.dcp-field { display: grid; grid-template-columns: minmax(120px, 160px) minmax(0, 1fr); align-items: center; gap: 8px 14px; }
.dcp-field label { color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; font-weight: 500; }
.dcp-help { grid-column: 2; margin: -3px 0 0; color: var(--dsw-alias-label-tertiary, #777); font-size: 11px; line-height: 17px; }
.dcp-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }
.dcp-actions-start { justify-content: flex-start; }
.dcp-button { box-sizing: border-box; height: 34px; border: .5px solid var(--dsw-alias-border-l3, #8887); border-radius: 6px; color: inherit; background: transparent; padding: 0 12px; cursor: pointer; font: inherit; font-size: 13px; }
.dcp-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, #8882); }
.dcp-button-primary { border-color: transparent; background: var(--dsw-alias-button-primary-fill, #2b8063); color: var(--dsw-alias-label-primary-foreground, white); }
.dcp-button-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, #236b54); }
.dcp-button-danger { color: var(--dsw-alias-state-error-primary, #b42332); border-color: transparent; }
.dcp-button-danger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger, #b4233218); }
.dcp-button-small { height: 28px; padding: 0 8px; font-size: 12px; }
.dcp-button:disabled, .dcp-input:disabled, .dcp-select:disabled, .dcp-json:disabled { opacity: .48; cursor: default; }
.dcp-json { min-height: 360px; resize: vertical; padding: 12px; font-family: var(--ds-font-family-code, ui-monospace, monospace); font-size: 12px; line-height: 19px; tab-size: 2; }
.dcp-error, .dcp-status, .dcp-empty { margin: 8px 0; font-size: 12px; line-height: 18px; }
.dcp-error { color: var(--dsw-alias-state-error-primary, #b42332); white-space: pre-wrap; }
.dcp-status { color: var(--dsw-alias-state-success-primary, #21835a); }
.dcp-empty { color: var(--dsw-alias-label-tertiary, #777); }
.dcp-skeleton { height: 28px; margin: 5px 6px; border-radius: 5px; background: var(--dsw-alias-interactive-bg-hover, #8882); animation: dcp-pulse 1.2s ease-in-out infinite alternate; }
@keyframes dcp-pulse { to { opacity: .45; } }
.dcp-button:focus-visible, .dcp-provider-button:focus-visible, .dcp-model-button:focus-visible, .dcp-tab:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #2b8063); outline-offset: 1px; }
@media (prefers-reduced-motion: reduce) { .dcp-skeleton { animation: none; } }
@media (max-width: 760px) {
  .dcp-section-head, .dcp-row { flex-wrap: wrap; }
  .dcp-panel { padding: 12px; }
  .dcp-field { grid-template-columns: minmax(0, 1fr); gap: 5px; }
  .dcp-help { grid-column: 1; }
}
`;

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inputMode(value) {
  if (!Array.isArray(value) || value.length === 0) return "inherit";
  if (value.length === 1 && value[0] === "text") return "text";
  if (value.includes("text") && value.includes("image")) return "image";
  return "custom";
}

function reasoningMode(value) {
  if (value === undefined) return "inherit";
  if (value === false) return "disabled";
  if (sameJson(value, STANDARD_REASONING)) return "standard";
  return "custom";
}

function commonDraft(source) {
  return {
    name: typeof source.name === "string" ? source.name : "",
    contextWindow: source.contextWindow === undefined ? "" : String(source.contextWindow),
    maxTokens: source.maxTokens === undefined ? "" : String(source.maxTokens),
    input: inputMode(source.input),
    reasoning: reasoningMode(source.reasoningEfforts)
  };
}

function positiveInteger(text, label) {
  if (text.trim() === "") return undefined;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(tr(`${label}必须是正整数`, `${label} must be a positive integer`));
  return value;
}

function CommonEditor({ source, effective, readOnly, busy, save }) {
  const sourceKey = JSON.stringify(source);
  const initial = () => commonDraft(source);
  const [draft, setDraft] = React.useState(initial);
  const [dirty, setDirty] = React.useState(false);
  const [failure, setFailure] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => {
    if (!dirty) setDraft(initial());
  }, [sourceKey]);
  const change = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setFailure("");
    setSaved(false);
  };
  const submit = async (restore = false) => {
    try {
      const changes = restore ? Object.fromEntries(COMMON_MODEL_FIELDS.map((key) => [key, undefined])) : {
        name: draft.name.trim() || undefined,
        contextWindow: positiveInteger(draft.contextWindow, tr("上下文窗口", "Context window")),
        maxTokens: positiveInteger(draft.maxTokens, tr("输出上限", "Output limit")),
        input: draft.input === "inherit" ? undefined : draft.input === "text" ? ["text"] :
          draft.input === "image" ? ["text", "image"] : source.input,
        reasoningEfforts: draft.reasoning === "inherit" ? undefined : draft.reasoning === "disabled" ? false :
          draft.reasoning === "standard" ? STANDARD_REASONING : source.reasoningEfforts
      };
      const error = await save(changes);
      setFailure(error ?? "");
      setSaved(!error);
      if (!error) setDirty(false);
    } catch (error) {
      setFailure(error.message);
      setSaved(false);
    }
  };
  const disabled = readOnly || busy;
  return h("div", { className: "dcp-form" },
    h("div", { className: "dcp-field" },
      h("label", { htmlFor: "dcp-name" }, tr("模型名称", "Model name")),
      h("input", { id: "dcp-name", className: "dcp-input", value: draft.name, disabled,
        placeholder: effective?.name ?? source.id, onChange: (event) => change("name", event.target.value) })),
    h("div", { className: "dcp-field" },
      h("label", { htmlFor: "dcp-reasoning" }, tr("推理能力", "Reasoning")),
      h("select", { id: "dcp-reasoning", className: "dcp-select", value: draft.reasoning, disabled,
        onChange: (event) => change("reasoning", event.target.value) },
        h("option", { value: "inherit" }, tr("继承提供方或目录", "Inherit provider or catalog")),
        h("option", { value: "disabled" }, tr("不支持推理", "Reasoning disabled")),
        h("option", { value: "standard" }, tr("标准推理档位", "Standard reasoning levels")),
        draft.reasoning === "custom" ? h("option", { value: "custom" }, tr("自定义档位（高级 JSON）", "Custom levels (Advanced JSON)")) : null)),
    h("div", { className: "dcp-field" },
      h("label", { htmlFor: "dcp-input" }, tr("输入类型", "Input types")),
      h("select", { id: "dcp-input", className: "dcp-select", value: draft.input, disabled,
        onChange: (event) => change("input", event.target.value) },
        h("option", { value: "inherit" }, tr("继承提供方或目录", "Inherit provider or catalog")),
        h("option", { value: "text" }, tr("文本", "Text")),
        h("option", { value: "image" }, tr("文本和图片", "Text and image")),
        draft.input === "custom" ? h("option", { value: "custom" }, tr("自定义（高级 JSON）", "Custom (Advanced JSON)")) : null)),
    h("div", { className: "dcp-field" },
      h("label", { htmlFor: "dcp-context" }, tr("上下文窗口", "Context window")),
      h("input", { id: "dcp-context", className: "dcp-input", type: "number", min: "1", step: "1",
        value: draft.contextWindow, disabled, placeholder: effective?.contextWindow === undefined ? "" : String(effective.contextWindow),
        onChange: (event) => change("contextWindow", event.target.value) })),
    h("div", { className: "dcp-field" },
      h("label", { htmlFor: "dcp-output" }, tr("输出上限", "Output limit")),
      h("input", { id: "dcp-output", className: "dcp-input", type: "number", min: "1", step: "1",
        value: draft.maxTokens, disabled, placeholder: effective?.maxTokens === undefined ? "" : String(effective.maxTokens),
        onChange: (event) => change("maxTokens", event.target.value) })),
    failure ? h("p", { className: "dcp-error", role: "alert" }, failure) : null,
    saved ? h("p", { className: "dcp-status", role: "status" }, tr("已保存", "Saved")) : null,
    readOnly ? h("p", { className: "dcp-empty" }, tr("此模型来自组合配置，当前只读", "This model is inherited from the composition and is read-only")) :
      h("div", { className: "dcp-actions" },
        h("button", { type: "button", className: "dcp-button", disabled: busy,
          onClick: () => submit(true) }, tr("恢复继承", "Restore inherited")),
        h("button", { type: "button", className: "dcp-button dcp-button-primary", disabled: busy || !dirty,
          onClick: () => submit(false) }, busy ? tr("保存中", "Saving") : tr("保存", "Save"))));
}

function AdvancedEditor({ source, readOnly, busy, save }) {
  const sourceKey = JSON.stringify(source);
  const formatted = () => JSON.stringify(source, null, 2);
  const [draft, setDraft] = React.useState(formatted);
  const [dirty, setDirty] = React.useState(false);
  const [failure, setFailure] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => {
    if (!dirty) setDraft(formatted());
  }, [sourceKey]);
  const format = () => {
    try {
      const value = parseModelJson(draft, source.id);
      setDraft(JSON.stringify(value, null, 2));
      setFailure("");
    } catch (error) { setFailure(error.message); }
  };
  const submit = async () => {
    try {
      const value = parseModelJson(draft, source.id);
      const error = await save(value);
      setFailure(error ?? "");
      setSaved(!error);
      if (!error) setDirty(false);
    } catch (error) {
      setFailure(error.message);
      setSaved(false);
    }
  };
  return h("div", null,
    h("textarea", { className: "dcp-json", value: draft, disabled: readOnly || busy, spellCheck: false,
      "aria-label": tr("当前模型 JSON", "Current model JSON"), onChange: (event) => {
        setDraft(event.target.value); setDirty(true); setFailure(""); setSaved(false);
      } }),
    failure ? h("p", { className: "dcp-error", role: "alert" }, failure) : null,
    saved ? h("p", { className: "dcp-status", role: "status" }, tr("已保存", "Saved")) : null,
    readOnly ? h("p", { className: "dcp-empty" }, tr("此模型来自组合配置，当前只读", "This model is inherited from the composition and is read-only")) :
      h("div", { className: "dcp-actions" },
        h("button", { type: "button", className: "dcp-button", disabled: busy, onClick: format }, tr("格式化", "Format")),
        h("button", { type: "button", className: "dcp-button dcp-button-primary", disabled: busy || !dirty,
          onClick: submit }, busy ? tr("保存中", "Saving") : tr("保存 JSON", "Save JSON"))));
}

function protocolChoices(view, schema) {
  if (!view) return [];
  const node = schema.nodeAtPath(schema.rehydrate(view.schema), ["providers", "\0probe", "api"]);
  return node?.type === "union" ? node.list.map((entry) => entry.value).filter((value) => typeof value === "string") : [];
}

function validUrl(value) {
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
}

function keyFailure(value) {
  if (!value.length) return "";
  if (value !== value.trim() || !/^[\x21-\x7e]+$/.test(value) || /^[A-Z][A-Z0-9_]*=[^=]/.test(value) ||
    (["'", '"', "`"].includes(value[0]) && value.endsWith(value[0]) && value.length > 1)) {
    return tr("API Key 格式无效，请仅输入密钥本身", "Invalid API key; enter the key value only");
  }
  return "";
}

function CreateProvider({ view, schema, available, busy, api, onWrite, onClose }) {
  const [kind, setKind] = React.useState(available.length ? "catalog" : "custom");
  const [chosen, setChosen] = React.useState(available[0]?.provider ?? "");
  const [route, setRoute] = React.useState("");
  const [name, setName] = React.useState("");
  const [baseURL, setBaseURL] = React.useState("");
  const protocols = React.useMemo(() => protocolChoices(view, schema), [view?.schema, schema]);
  const [protocol, setProtocol] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [key, setKey] = React.useState("");
  const [committed, setCommitted] = React.useState("");
  const [failure, setFailure] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const submit = async () => {
    setFailure(""); setSubmitting(true);
    try {
      const id = committed || (kind === "catalog" ? chosen : route.trim());
      const ref = derivedKeyRef(id);
      const invalidKey = keyFailure(key);
      if (invalidKey) throw new Error(invalidKey);
      if (!committed) {
        const profile = kind === "catalog" ? {} : {
          ...(name.trim() ? { displayName: name.trim() } : {}),
          api: protocol || protocols[0], baseURL: baseURL.trim(), models: [{ id: modelId.trim() }]
        };
        if (kind === "custom" && (!validUrl(baseURL.trim()) || !protocols.includes(profile.api) || !modelId.trim())) {
          throw new Error(tr("请填写有效的地址、协议和首个模型 ID", "Enter a valid endpoint, protocol, and first model ID"));
        }
        if (key) profile.apiKeyEnv = ref;
        const operation = createProviderOperation(view, id, profile,
          kind === "custom" ? available.map((entry) => entry.provider) : []);
        const error = await onWrite(operation);
        if (error) throw new Error(error);
        setCommitted(id);
      }
      if (key) {
        const result = await api.credentials.set(ref, key);
        if (!result.ok) throw new Error(result.error.message);
        setKey("");
      }
      onClose(id);
    } catch (error) { setFailure(error.message); }
    finally { setSubmitting(false); }
  };
  const disabled = busy || submitting || !!committed;
  return h("div", { className: "dcp-panel dcp-form" },
    h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-create-kind" }, tr("类型", "Type")),
      h("select", { id: "dcp-create-kind", className: "dcp-select", value: kind, disabled, onChange: (event) => setKind(event.target.value) },
        available.length ? h("option", { value: "catalog" }, tr("内置提供方", "Built-in provider")) : null,
        h("option", { value: "custom" }, tr("自定义提供方", "Custom provider")))),
    kind === "catalog" ? h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-create-catalog" }, tr("提供方", "Provider")),
      h("select", { id: "dcp-create-catalog", className: "dcp-select", value: chosen, disabled, onChange: (event) => setChosen(event.target.value) },
        available.map((item) => h("option", { value: item.provider, key: item.provider }, item.displayName ?? item.provider)))) :
      h(React.Fragment, null,
        h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-create-route" }, tr("提供方 ID", "Provider ID")),
          h("input", { id: "dcp-create-route", className: "dcp-input", value: route, disabled, placeholder: "acme-gateway", onChange: (event) => setRoute(event.target.value) })),
        h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-create-name" }, tr("显示名称", "Display name")),
          h("input", { id: "dcp-create-name", className: "dcp-input", value: name, disabled, onChange: (event) => setName(event.target.value) })),
        h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-create-url" }, tr("接口地址", "Endpoint")),
          h("input", { id: "dcp-create-url", className: "dcp-input", type: "url", value: baseURL, disabled, placeholder: "https://api.example.com/v1", onChange: (event) => setBaseURL(event.target.value) })),
        h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-create-api" }, tr("协议", "Protocol")),
          h("select", { id: "dcp-create-api", className: "dcp-select", value: protocol || protocols[0] || "", disabled, onChange: (event) => setProtocol(event.target.value) },
            protocols.map((item) => h("option", { value: item, key: item }, item)))),
        h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-create-model" }, tr("首个模型 ID", "First model ID")),
          h("input", { id: "dcp-create-model", className: "dcp-input", value: modelId, disabled, onChange: (event) => setModelId(event.target.value) }))),
    h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-create-key" }, "API Key"),
      h("input", { id: "dcp-create-key", className: "dcp-input", type: "password", autoComplete: "off", value: key,
        disabled: busy || submitting, onChange: (event) => setKey(event.target.value) }),
      h("p", { className: "dcp-help" }, tr("可留空；密钥单独存入 dsh 凭据库", "Optional; stored separately in dsh credentials"))),
    failure ? h("p", { className: "dcp-error", role: "alert" }, failure) : null,
    h("div", { className: "dcp-actions" },
      h("button", { type: "button", className: "dcp-button", disabled: submitting, onClick: () => onClose(committed) }, tr("关闭", "Close")),
      h("button", { type: "button", className: "dcp-button dcp-button-primary", disabled: busy || submitting || (!committed && kind === "catalog" && !chosen), onClick: submit },
        submitting ? tr("保存中", "Saving") : committed ? tr("重试保存密钥", "Retry key") : tr("添加", "Add"))));
}

function ProviderEditor({ view, route, schema, api, writable, busy, onWrite, onRemoved }) {
  const profile = providerProfile(view, route);
  const effective = getAt(view.value, ["providers", route]) ?? {};
  const ref = effective.apiKeyEnv || derivedKeyRef(route);
  const [draft, setDraft] = React.useState(() => ({
    displayName: profile.displayName ?? "", baseURL: profile.baseURL ?? "", api: profile.api ?? ""
  }));
  const [advanced, setAdvanced] = React.useState(false);
  const [json, setJson] = React.useState(() => JSON.stringify(profile, null, 2));
  const [key, setKey] = React.useState("");
  const [credential, setCredential] = React.useState();
  const [failure, setFailure] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [jsonDirty, setJsonDirty] = React.useState(false);
  const [jsonRevision, setJsonRevision] = React.useState(view.revision);
  const protocols = React.useMemo(() => protocolChoices(view, schema), [view?.schema, schema]);
  React.useEffect(() => {
    let active = true;
    setCredential(undefined);
    api.credentials.describe([ref]).then((result) => {
      if (active) setCredential(result.ok ? result.value[ref] ?? { configured: false, writable: true } : { error: result.error.message });
    }).catch((error) => { if (active) setCredential({ error: error.message }); });
    return () => { active = false; };
  }, [api, ref]);
  React.useEffect(() => {
    if (!dirty) setDraft({ displayName: profile.displayName ?? "", baseURL: profile.baseURL ?? "", api: profile.api ?? "" });
    if (!jsonDirty) { setJson(JSON.stringify(profile, null, 2)); setJsonRevision(view.revision); }
  }, [JSON.stringify(profile), view.revision]);
  const change = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value })); setDirty(true); setFailure(""); setStatus("");
  };
  const save = async (operation, expectedRevision) => {
    setFailure(""); setStatus(""); setWorking(true);
    try {
      const error = await onWrite(operation, expectedRevision);
      if (error) throw new Error(error);
      setDirty(false); setJsonDirty(false); setStatus(tr("已保存", "Saved"));
    } catch (error) { setFailure(error.message); }
    finally { setWorking(false); }
  };
  const saveCommon = () => {
    try {
      const next = Object.fromEntries(COMMON_PROVIDER_FIELDS.map((field) => [field, draft[field].trim() || undefined]));
      if (next.baseURL && !validUrl(next.baseURL)) throw new Error(tr("接口地址必须是 http 或 https URL", "Endpoint must be an http or https URL"));
      if (next.api && !protocols.includes(next.api)) throw new Error(tr("不支持的协议", "Unsupported protocol"));
      save(patchProviderOperation(view, route, next));
    } catch (error) { setFailure(error.message); }
  };
  const saveJson = () => {
    try {
      const next = JSON.parse(json);
      if (!next || Array.isArray(next) || typeof next !== "object") throw new Error(tr("提供方 JSON 必须是对象", "Provider JSON must be an object"));
      save(replaceProviderOperation(view, route, next), jsonRevision);
    } catch (error) { setFailure(error.message); }
  };
  const saveKey = async () => {
    if (jsonDirty) { setFailure(tr("请先保存或放弃高级 JSON 草稿", "Save or discard the Advanced JSON draft first")); return; }
    const invalid = keyFailure(key);
    if (invalid) { setFailure(invalid); return; }
    if (!key) return;
    setWorking(true); setFailure(""); setStatus("");
    try {
      if (!effective.apiKeyEnv) {
        const error = await onWrite({ op: "set", path: ["providers", route, "apiKeyEnv"], value: ref });
        if (error) throw new Error(error);
      }
      const result = await api.credentials.set(ref, key);
      if (!result.ok) throw new Error(result.error.message);
      setKey(""); setCredential({ configured: true, writable: true }); setStatus(tr("密钥已保存", "Key saved"));
    } catch (error) { setFailure(error.message); }
    finally { setWorking(false); }
  };
  const remove = async () => {
    if (!window.confirm(tr(`删除提供方 ${route}？其用户模型配置也将删除。`, `Delete provider ${route} and its user model settings?`))) return;
    setWorking(true); setFailure("");
    try {
      const error = await onWrite(removeProviderOperation(view, route));
      if (error) throw new Error(error);
      if (effective.apiKeyEnv === derivedKeyRef(route) && credential?.configured && credential.writable) {
        const result = await api.credentials.unset(ref);
        if (!result.ok) {
          onRemoved(tr("提供方已删除，但密钥清理失败：", "Provider deleted, but key cleanup failed: ") + result.error.message);
          return;
        }
      }
      onRemoved();
    } catch (error) { setFailure(error.message); }
    finally { setWorking(false); }
  };
  const disabled = !writable || busy || working;
  return h("div", { className: "dcp-panel dcp-form" },
    h("div", { className: "dcp-section-head" },
      h("h3", null, tr("提供方配置", "Provider settings")),
      h("button", { type: "button", className: "dcp-button dcp-button-small", onClick: () => { setAdvanced(!advanced); setFailure(""); } },
        advanced ? tr("常用配置", "Common") : tr("高级 JSON", "Advanced JSON"))),
    advanced ? h(React.Fragment, null,
      h("textarea", { className: "dcp-json", value: json, disabled, spellCheck: false, "aria-label": tr("当前提供方 JSON", "Current provider JSON"),
        onChange: (event) => { if (!jsonDirty) setJsonRevision(view.revision); setJson(event.target.value); setJsonDirty(true); setFailure(""); } }),
      h("div", { className: "dcp-actions" },
        h("button", { type: "button", className: "dcp-button", disabled: disabled || !jsonDirty,
          onClick: () => { setJson(JSON.stringify(profile, null, 2)); setJsonRevision(view.revision); setJsonDirty(false); setFailure(""); } }, tr("重新加载", "Reload")),
        h("button", { type: "button", className: "dcp-button dcp-button-primary", disabled: disabled || !jsonDirty, onClick: saveJson }, tr("保存 JSON", "Save JSON")))) :
      h(React.Fragment, null,
        h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-provider-name" }, tr("显示名称", "Display name")),
          h("input", { id: "dcp-provider-name", className: "dcp-input", value: draft.displayName, disabled, placeholder: effective.displayName || route,
            onChange: (event) => change("displayName", event.target.value) })),
        h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-provider-url" }, tr("接口地址", "Endpoint")),
          h("input", { id: "dcp-provider-url", className: "dcp-input", type: "url", value: draft.baseURL, disabled,
            placeholder: effective.baseURL || tr("使用目录默认地址", "Catalog endpoint"), onChange: (event) => change("baseURL", event.target.value) })),
        h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-provider-api" }, tr("协议", "Protocol")),
          h("select", { id: "dcp-provider-api", className: "dcp-select", value: draft.api, disabled, onChange: (event) => change("api", event.target.value) },
            h("option", { value: "" }, tr("继承目录", "Inherit catalog")),
            protocols.map((item) => h("option", { value: item, key: item }, item)))),
        h("div", { className: "dcp-actions" },
          h("button", { type: "button", className: "dcp-button dcp-button-primary", disabled: disabled || !dirty, onClick: saveCommon }, tr("保存提供方", "Save provider")))),
    h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-provider-key" }, "API Key"),
      h("input", { id: "dcp-provider-key", className: "dcp-input", type: "password", autoComplete: "off", value: key,
        disabled: disabled || credential?.writable === false, placeholder: credential?.configured ? tr("已配置 · 输入新密钥以替换", "Configured · enter a new key to replace") : tr("未配置", "Not configured"),
        onChange: (event) => { setKey(event.target.value); setFailure(""); } }),
      h("p", { className: "dcp-help" }, credential?.error || tr("密钥存入凭据库，不写入设置 JSON", "Stored in credentials, not settings JSON"))),
    h("div", { className: "dcp-actions" },
      providerRemovable(view, route) ? h("button", { type: "button", className: "dcp-button dcp-button-danger", disabled, onClick: remove }, tr("删除提供方", "Delete provider")) : null,
      h("button", { type: "button", className: "dcp-button", disabled: disabled || !key || jsonDirty || credential?.writable === false,
        title: jsonDirty ? tr("先处理高级 JSON 草稿", "Resolve Advanced JSON draft first") : undefined,
        onClick: saveKey }, tr("保存密钥", "Save key"))),
    failure ? h("p", { className: "dcp-error", role: "alert" }, failure) : null,
    status ? h("p", { className: "dcp-status", role: "status" }, status) : null);
}

function ModelConfigSection({ api, schema }) {
  const [view, setView] = React.useState();
  const [writable, setWritable] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [failure, setFailure] = React.useState("");
  const [route, setRoute] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [directory, setDirectory] = React.useState([]);
  const [directoryError, setDirectoryError] = React.useState("");
  const [addingProvider, setAddingProvider] = React.useState(false);
  const [newModelId, setNewModelId] = React.useState("");
  const [addingModel, setAddingModel] = React.useState(false);
  const [catalogs, setCatalogs] = React.useState({});
  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState("common");
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const response = await api.settings.describe();
    if (!response.ok) throw new Error(response.error.message);
    const namespace = response.value.namespaces.find((item) => item.ns === NS);
    if (!namespace) throw new Error(tr("llm-pi-ai 未注册", "llm-pi-ai is not registered"));
    setView(namespace);
    setWritable(response.value.writable);
    setFailure("");
    setLoading(false);
  }, [api]);

  React.useEffect(() => {
    let active = true;
    refresh().catch((error) => { if (active) { setFailure(error.message); setLoading(false); } });
    const dispose = api.subscribe(() => refresh().catch((error) => { if (active) setFailure(error.message); }));
    return () => { active = false; dispose(); };
  }, [api, refresh]);

  const loadDirectory = React.useCallback(async (active = () => true) => {
    try {
      const result = await api.llm.listConfigurableProviders();
      if (!result.ok) throw new Error(result.error.message);
      if (!active()) return;
      setDirectory(result.value.filter((entry) => entry.settingsNs === NS));
      setDirectoryError("");
    } catch (error) { if (active()) setDirectoryError(error.message); }
  }, [api]);

  React.useEffect(() => {
    let active = true;
    loadDirectory(() => active);
    return () => { active = false; };
  }, [loadDirectory]);

  const profiles = getAt(view?.value, ["providers"]) ?? {};
  const providers = Object.entries(profiles).map(([id, profile]) => ({
    id,
    name: typeof profile?.displayName === "string" && profile.displayName ? profile.displayName :
      directory.find((entry) => entry.provider === id)?.displayName ?? id
  }));
  const providerIds = providers.map((provider) => provider.id).join("\0");

  React.useEffect(() => {
    if (!providers.some((provider) => provider.id === route)) {
      setRoute(providers[0]?.id ?? "");
      setModelId("");
    }
  }, [providerIds, route]);

  React.useEffect(() => {
    if (!view || !route) return;
    const mode = modelMode(view, route);
    if (mode !== "catalog") return;
    let active = true;
    setCatalogs((current) => ({ ...current, [route]: { status: "loading", models: current[route]?.models ?? [] } }));
    api.llm.discoverModels(NS, { provider: route }).then((response) => {
      if (!active) return;
      setCatalogs((current) => ({ ...current, [route]: response.ok
        ? { status: "ready", models: response.value }
        : { status: "error", models: current[route]?.models ?? [], error: response.error.message } }));
    }).catch((error) => {
      if (active) setCatalogs((current) => ({ ...current, [route]: { status: "error", models: [], error: error.message } }));
    });
    return () => { active = false; };
  }, [api, route, view?.revision]);

  const discovered = catalogs[route]?.models ?? [];
  const models = view && route ? modelEntries(view, route, discovered) : [];
  const modelIds = models.map((model) => model.id).join("\0");
  React.useEffect(() => {
    if (!models.some((model) => model.id === modelId)) setModelId(models[0]?.id ?? "");
  }, [modelIds, modelId]);

  const saveOperation = async (operation, expectedRevision) => {
    if (!view || busy) return tr("配置尚未就绪", "Settings are not ready");
    setBusy(true);
    try {
      const outcome = await commitOperation(api, schema, view, operation, expectedRevision ?? view.revision);
      if (outcome.kind === "conflict") {
        await refresh();
        return expectedRevision === undefined
          ? tr("配置已被其他编辑更新，请核对后重试", "Settings changed elsewhere; review and retry")
          : tr("配置已被其他编辑更新，请核对 JSON 草稿后重新加载", "Settings changed elsewhere; review and reload the JSON draft");
      }
      if (outcome.kind === "invalid" || outcome.kind === "rejected") return outcome.message;
      setView(outcome.view);
      return undefined;
    } catch (error) { return error.message; }
    finally { setBusy(false); }
  };

  const addModel = async () => {
    try {
      const id = newModelId.trim();
      const error = await saveOperation(addModelOperation(view, route, { id }));
      if (error) { setFailure(error); return; }
      setNewModelId(""); setAddingModel(false); setModelId(id); setFailure("");
    } catch (error) { setFailure(error.message); }
  };

  const deleteModel = async (id) => {
    if (!window.confirm(tr(`删除模型 ${id}？`, `Delete model ${id}?`))) return;
    try {
      const error = await saveOperation(removeModelOperation(view, route, id));
      if (error) setFailure(error);
      else { setModelId(""); setFailure(""); }
    } catch (error) { setFailure(error.message); }
  };

  const selected = models.find((model) => model.id === modelId);
  let source;
  let sourceFailure;
  if (view && route && modelId) {
    try { source = editableModel(view, route, modelId); }
    catch (error) { sourceFailure = error.message; }
  }
  const mode = view && route ? modelMode(view, route) : "catalog";
  const readOnly = !writable || mode === "inherited";
  const normalizedQuery = query.trim().toLowerCase();
  const shownModels = normalizedQuery ? models.filter((model) =>
    model.id.toLowerCase().includes(normalizedQuery) || String(model.name ?? "").toLowerCase().includes(normalizedQuery)) : models;
  const available = availableCatalogProviders(directory, providers.map((provider) => provider.id));

  if (loading) return h("div", { className: "dcp-page", "aria-busy": true },
    h("h2", null, tr("模型配置", "Model configuration")),
    h("div", { className: "dcp-skeleton" }), h("div", { className: "dcp-skeleton" }));

  if (failure && !view) return h("div", { className: "dcp-page" },
    h("h2", null, tr("模型配置", "Model configuration")),
    h("p", { className: "dcp-error", role: "alert" }, failure),
    h("button", { type: "button", className: "dcp-button", onClick: () => {
      setLoading(true); refresh().catch((error) => { setFailure(error.message); setLoading(false); });
    } }, tr("重试", "Retry")));

  return h("div", { className: "dcp-page" },
    h("h2", null, tr("模型配置", "Model configuration")),
    !writable ? h("p", { className: "dcp-error", role: "status" }, tr("当前设置为只读", "Settings are read-only")) : null,
    failure ? h("p", { className: "dcp-error", role: "alert" }, failure) : null,
    h("section", { className: "dcp-section", "aria-label": tr("提供方", "Providers") },
      h("div", { className: "dcp-section-head" }, h("h3", null, tr("提供方", "Providers")),
        h("button", { type: "button", className: "dcp-button dcp-button-small", disabled: !writable || busy,
          onClick: () => setAddingProvider(!addingProvider) }, addingProvider ? tr("取消", "Cancel") : tr("添加提供方", "Add provider"))),
      directoryError ? h("div", { className: "dcp-row" },
        h("p", { className: "dcp-error", role: "alert" }, directoryError),
        h("button", { type: "button", className: "dcp-button dcp-button-small", onClick: () => loadDirectory() }, tr("重试", "Retry"))) : null,
      providers.length ? h("ul", { className: "dcp-list" }, providers.map((provider) => h("li", { key: provider.id, className: "dcp-row" },
        h("button", { type: "button", className: `dcp-provider-button dcp-row-main ${route === provider.id ? "dcp-selected" : ""}`,
          "aria-current": route === provider.id, onClick: () => { setRoute(provider.id); setModelId(""); setTab("common"); setAddingProvider(false); setFailure(""); } },
          provider.name, h("span", { className: "dcp-row-meta" }, provider.name === provider.id ? "" : ` · ${provider.id}`)),
        h("span", { className: "dcp-badge" }, providerKind(view, provider.id, directory) === "catalog"
          ? tr("内置目录", "Catalog") : providerKind(view, provider.id, directory) === "custom"
            ? tr("自定义", "Custom") : tr("组合继承", "Inherited"))))) :
        h("p", { className: "dcp-empty" }, tr("尚无提供方", "No providers yet")),
      addingProvider ? h(CreateProvider, { view, schema, available, busy, api, onWrite: saveOperation,
        onClose: (id) => { setAddingProvider(false); if (id) setRoute(id); } }) : null,
      route && !addingProvider ? h(ProviderEditor, { key: route, view, route, schema, api, writable, busy, onWrite: saveOperation,
        onRemoved: (error) => { setRoute(""); setModelId(""); if (error) setFailure(error); } }) : null),
    route && !addingProvider ? h("section", { className: "dcp-section", "aria-label": tr("模型", "Models") },
      h("div", { className: "dcp-section-head" }, h("h3", null, tr("模型", "Models")),
        mode === "listed" ? h("button", { type: "button", className: "dcp-button dcp-button-small", disabled: !writable || busy,
          onClick: () => setAddingModel(!addingModel) }, addingModel ? tr("取消", "Cancel") : tr("添加模型", "Add model")) :
          h("span", { className: "dcp-row-meta" }, mode === "inherited" ? tr("组合继承 · 只读", "Inherited · read-only") : tr("内置目录", "Built-in catalog"))),
      addingModel && mode === "listed" ? h("div", { className: "dcp-row" },
        h("input", { className: "dcp-input dcp-row-main", value: newModelId, disabled: busy,
          "aria-label": tr("新模型 ID", "New model ID"), placeholder: tr("模型 ID", "Model ID"), onChange: (event) => setNewModelId(event.target.value),
          onKeyDown: (event) => { if (event.key === "Enter") addModel(); } }),
        h("button", { type: "button", className: "dcp-button dcp-button-primary", disabled: busy || !newModelId.trim(), onClick: addModel }, tr("添加", "Add"))) : null,
      h("input", { className: "dcp-search", type: "search", value: query, placeholder: tr("搜索模型", "Search models"),
        "aria-label": tr("搜索模型", "Search models"), onChange: (event) => setQuery(event.target.value) }),
      mode === "catalog" && catalogs[route]?.status === "loading" && !models.length ? h("div", { className: "dcp-skeleton" }) : null,
      catalogs[route]?.status === "error" ? h("p", { className: "dcp-error", role: "alert" }, catalogs[route].error) : null,
      shownModels.length ? h("ul", { className: "dcp-list" }, shownModels.map((model) => h("li", { className: "dcp-row", key: model.id },
        h("button", { type: "button", className: `dcp-model-button dcp-row-main ${modelId === model.id ? "dcp-selected" : ""}`,
          "aria-current": modelId === model.id, onClick: () => { setModelId(model.id); setTab("common"); } },
          model.name ?? model.id, model.name && model.name !== model.id ? h("span", { className: "dcp-row-meta" }, ` · ${model.id}`) : null),
        mode === "listed" ? h("button", { type: "button", className: "dcp-button dcp-button-danger dcp-button-small", disabled: !writable || busy || models.length === 1,
          title: models.length === 1 ? tr("至少保留一个模型", "Keep at least one model") : undefined,
          onClick: () => deleteModel(model.id), "aria-label": tr(`删除模型 ${model.id}`, `Delete model ${model.id}`) }, tr("删除", "Delete")) : null))) :
        catalogs[route]?.status !== "loading" ? h("p", { className: "dcp-empty" }, tr("没有可配置模型", "No configurable models")) : null,
      sourceFailure ? h("p", { className: "dcp-error", role: "alert" }, sourceFailure) :
        source && selected ? h("div", { className: "dcp-panel" },
          h("div", { className: "dcp-model-head" },
            h("div", { className: "dcp-model-title" }, h("h3", null, selected.name ?? selected.id),
              h("div", { className: "dcp-model-id" }, `${route} / ${selected.id}`))),
          h("div", { className: "dcp-tabs", role: "tablist" },
            h("button", { type: "button", className: "dcp-tab", role: "tab", "aria-selected": tab === "common",
              onClick: () => setTab("common") }, tr("常用配置", "Common")),
            h("button", { type: "button", className: "dcp-tab", role: "tab", "aria-selected": tab === "advanced",
              onClick: () => setTab("advanced") }, tr("高级 JSON", "Advanced JSON"))),
          tab === "common" ? h(CommonEditor, { key: `${route}:${modelId}:common`, source, effective: selected, readOnly, busy,
            save: (changes) => { try { return saveOperation(patchModelOperation(view, route, modelId, changes)); }
              catch (error) { return Promise.resolve(error.message); } } }) :
            h(AdvancedEditor, { key: `${route}:${modelId}:advanced`, source, readOnly, busy,
              save: (next) => { try { return saveOperation(replaceModelOperation(view, route, modelId, next)); }
                catch (error) { return Promise.resolve(error.message); } } })) : null) : null);
}

function apply(ctx) {
  const remote = ctx.get("remote");
  const api = {
    settings: ctx.get("remote.settings"),
    credentials: ctx.get("remote.credentials"),
    llm: ctx.get("remote.llm"),
    subscribe: (callback) => {
      const disposeSettings = remote.$on("settings/document-updated", (ns) => { if (ns === NS) callback(); });
      const disposeModels = remote.$on("llm/adapters-updated", callback);
      return () => { disposeSettings(); disposeModels(); };
    }
  };
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "model-configuration",
    order: 11,
    label: () => tr("模型配置", "Model configuration"),
    inject: () => ({ api, schema: ctx.settingsSchema })
  }, ModelConfigSection));
  ctx.effect(() => {
    if (document.getElementById("dsh-custom-provider-styles")) return;
    const style = document.createElement("style");
    style.id = "dsh-custom-provider-styles";
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  });
}
