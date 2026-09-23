const h = React.createElement;
const NS = NAMESPACE;
const loadModelsDev = createModelsDevLoader();
const piAiCatalogs = new Map();
async function loadPiAiCatalog(api, provider) {
  if (!piAiCatalogs.has(provider)) {
    const pending = api.llm.discoverModels(NS, { provider }).then((response) => {
      if (!response.ok) throw new Error(response.error.message);
      return Array.isArray(response.value) ? response.value : [];
    }).catch((error) => { piAiCatalogs.delete(provider); throw error; });
    piAiCatalogs.set(provider, pending);
  }
  return piAiCatalogs.get(provider);
}
const inject = ["slots", "remote", "remote.settings", "remote.credentials", "remote.llm", "settingsSchema"];
const zh = typeof navigator !== "undefined" && navigator.language?.startsWith("zh");
const tr = (cn, en) => zh ? cn : en;
const DEFAULT_REASONING_LEVELS = {
  off: null,
  low: "low",
  high: "high",
  max: "max"
};

// Sizes and hierarchy follow the built-in Models page; colors come from the host theme.
const css = `
.dcp-page { --dcp-fg: var(--dsw-alias-label-primary, #24272b); --dcp-muted: var(--dsw-alias-label-tertiary, #747980); --dcp-border: var(--dsw-alias-border-l4, #dfe1e5); --dcp-line: var(--dsw-alias-border-l2, #e7e9ec); --dcp-surface: var(--dsw-alias-bg-module-platform, #f6f7f8); --dcp-input-bg: var(--dsw-alias-bg-layer-1, #fff); --dcp-hover: var(--dsw-alias-interactive-bg-hover, #00000008); --dcp-danger: var(--dsw-alias-state-error-primary, #b42332); --dcp-radius: 8px; --dcp-gap: 14px; width: 100%; max-width: 720px; min-width: 0; color: var(--dcp-fg); display: flex; flex-direction: column; gap: 12px; }
.dcp-page *, .dcp-page *::before, .dcp-page *::after { box-sizing: border-box; }
.dcp-page [hidden] { display: none !important; }
.dcp-page h2 { margin: 0; font-size: 16px; font-weight: 500; line-height: 24px; }
.dcp-intro { color: var(--dcp-muted); margin: 0; font-size: 14px; line-height: 22px; }
.dcp-notice { color: var(--dsw-alias-state-warn-label, #946200); margin: 0; font-size: 12px; line-height: 18px; }
.dcp-provider-list { list-style: none; display: flex; flex-direction: column; gap: 8px; margin: 8px 0 0; padding: 0; }
.dcp-provider-card { min-width: 0; border: .5px solid var(--dcp-border); border-radius: 16px; display: flex; flex-direction: column; gap: 12px; padding: 12px 14px; }
.dcp-provider-head { display: flex; align-items: center; gap: 12px; min-width: 0; }
.dcp-provider-identity { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.dcp-provider-name { font-size: 14px; font-weight: 500; line-height: 22px; overflow-wrap: anywhere; }
.dcp-provider-route { color: var(--dcp-muted); font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.dcp-provider-tag { border: .5px solid var(--dsw-alias-border-l3, #d4d7db); color: var(--dsw-alias-label-secondary, #555b64); border-radius: 4px; flex: none; padding: 1px 6px; font-size: 11px; line-height: 16px; }
.dcp-credential-dot { border-radius: 50%; flex: none; width: 8px; height: 8px; }
.dcp-credential-dot-configured { background: var(--dsw-alias-state-success-primary, #21835a); }
.dcp-credential-dot-missing { background: var(--dcp-danger); }
.dcp-provider-actions { display: flex; flex: none; align-items: center; gap: 4px; margin-left: auto; }
.dcp-provider-editor, .dcp-add-card { min-width: 0; background: var(--dcp-surface); border-radius: 12px; display: flex; flex-direction: column; gap: 16px; padding: 16px; }
.dcp-form, .dcp-customized-body { min-width: 0; display: flex; flex-direction: column; gap: var(--dcp-gap); }
.dcp-form-grid { min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--dcp-gap); align-items: start; }
.dcp-span-all { grid-column: 1 / -1; }
.dcp-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; margin: 0; }
.dcp-field label, .dcp-field-label { color: var(--dsw-alias-label-secondary, #555b64); font-size: 12px; font-weight: 500; line-height: 18px; }
.dcp-help { color: var(--dcp-muted); margin: 0; font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.dcp-choice-group { min-width: 0; border: 0; margin: 0; padding: 0; }
.dcp-choice-group legend { color: var(--dsw-alias-label-secondary, #555b64); font-size: 12px; font-weight: 500; line-height: 18px; margin-bottom: 6px; padding: 0; }
.dcp-choice-options { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.dcp-choice-option { display: inline-flex; align-items: center; gap: 6px; color: var(--dcp-fg); font-size: 13px; line-height: 22px; }
.dcp-choice-option input { accent-color: var(--dsw-alias-brand-primary, #2b8063); margin: 0; }
.dcp-toggle { position: relative; display: inline-flex; align-items: center; gap: 8px; color: var(--dcp-fg); font-size: 13px; line-height: 22px; cursor: pointer; }
.dcp-toggle input { position: absolute; width: 32px; height: 18px; margin: 0; opacity: 0; cursor: pointer; }
.dcp-switch-track { width: 32px; height: 18px; flex: none; border-radius: 9px; background: var(--dsw-alias-border-l3, #d4d7db); padding: 2px; transition: background .12s; }
.dcp-switch-thumb { display: block; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px #0002; transition: transform .12s; }
.dcp-toggle input:checked + .dcp-switch-track { background: var(--dsw-alias-brand-primary, #2b8063); }
.dcp-toggle input:checked + .dcp-switch-track .dcp-switch-thumb { transform: translateX(14px); }
.dcp-toggle input:focus-visible + .dcp-switch-track { outline: 2px solid var(--dsw-alias-brand-primary, #2b8063); outline-offset: 2px; }
.dcp-reasoning-levels { display: flex; flex-direction: column; gap: 8px; border-left: 2px solid var(--dcp-line); padding-left: 12px; }
.dcp-level-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.dcp-level-actions { display: flex; justify-content: flex-start; gap: 8px; }
.dcp-input, .dcp-select, .dcp-search, .dcp-json { width: 100%; min-width: 0; color: var(--dcp-fg); background: var(--dcp-input-bg); border: .5px solid var(--dcp-border); border-radius: var(--dcp-radius); font: inherit; }
.dcp-input, .dcp-select, .dcp-search { height: 34px; padding: 0 10px; font-size: 13px; line-height: 22px; }
.dcp-select { cursor: pointer; }
.dcp-input:focus, .dcp-select:focus, .dcp-search:focus, .dcp-json:focus { border-color: var(--dsw-alias-brand-primary, #2b8063); outline: none; }
.dcp-input::placeholder, .dcp-search::placeholder { color: var(--dsw-alias-label-dimmed, #8a8e95); }
.dcp-input:read-only { color: var(--dcp-muted); background: transparent; }
.dcp-input:disabled, .dcp-select:disabled, .dcp-json:disabled { opacity: .6; cursor: default; }
.dcp-button { flex: none; height: 36px; border: .5px solid var(--dsw-alias-border-l3, #d4d7db); border-radius: 18px; color: var(--dcp-fg); background: transparent; padding: 0 14px; cursor: pointer; font: inherit; font-size: 14px; line-height: 22px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; }
.dcp-button:hover:not(:disabled) { background: var(--dcp-hover); }
.dcp-button-primary { border-color: transparent; background: var(--dsw-alias-button-primary-fill, #2b8063); color: var(--dsw-alias-label-primary-foreground, #fff); }
.dcp-button-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, #236b54); }
.dcp-button-danger { color: var(--dcp-danger); border-color: transparent; }
.dcp-button-danger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger, #b4233210); }
.dcp-button-small { height: 28px; border-radius: 14px; padding: 0 10px; font-size: 12px; line-height: 18px; }
.dcp-button:disabled { opacity: .4; cursor: default; }
.dcp-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; align-items: center; gap: 8px; }
.dcp-actions-start { justify-content: flex-start; }
.dcp-key-row { display: flex; align-items: center; gap: 8px; }
.dcp-customized { min-width: 0; border-top: .5px solid var(--dcp-line); padding-top: 12px; }
.dcp-customized-summary { cursor: pointer; width: fit-content; color: var(--dsw-alias-label-secondary, #555b64); border-radius: 6px; display: flex; align-items: center; gap: 8px; padding: 2px 0; font-size: 12px; font-weight: 500; line-height: 18px; list-style: none; }
.dcp-customized-summary::-webkit-details-marker { display: none; }
.dcp-customized-summary::before { content: ""; border-bottom: 1.5px solid; border-right: 1.5px solid; width: 5px; height: 5px; transform: rotate(-45deg); transition: transform .12s; }
.dcp-customized[open] > .dcp-customized-summary::before { transform: rotate(45deg); }
.dcp-customized-summary:hover { color: var(--dcp-fg); }
.dcp-customized-body { padding-top: 14px; }
.dcp-model-catalog { min-width: 0; border-top: .5px solid var(--dcp-line); display: flex; flex-direction: column; gap: 12px; padding-top: 14px; }
.dcp-model-catalog-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.dcp-model-catalog-heading { display: flex; align-items: baseline; gap: 8px; }
.dcp-model-catalog-title { margin: 0; color: var(--dsw-alias-label-secondary, #555b64); font-size: 13px; font-weight: 500; line-height: 20px; }
.dcp-model-catalog-meta { color: var(--dcp-muted); font-size: 12px; line-height: 18px; }
.dcp-model-list { display: flex; flex-direction: column; gap: 8px; }
.dcp-model-entry { min-width: 0; border: .5px solid var(--dcp-border); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 10px; }
.dcp-model-row { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto; align-items: end; gap: 8px; }
.dcp-model-tools { display: flex; align-items: center; gap: 2px; height: 34px; }
.dcp-fetched-model-head { justify-content: flex-start; }
.dcp-fetched-model-head > .dcp-button { margin-left: auto; }
.dcp-model-advanced { display: flex; flex-direction: column; gap: 14px; padding-top: 4px; }
.dcp-icon-button { width: 28px; height: 28px; border: 0; color: var(--dcp-muted); padding: 0; border-radius: 6px; }
.dcp-icon-button:hover:not(:disabled) { color: var(--dcp-fg); }
.dcp-icon-button-danger:hover:not(:disabled) { color: var(--dcp-danger); background: var(--dsw-alias-interactive-bg-hover-danger, #b4233210); }
.dcp-model-empty { border: 1px dashed var(--dcp-border); color: var(--dcp-muted); border-radius: var(--dcp-radius); text-align: center; padding: 16px; margin: 0; font-size: 12px; line-height: 20px; }
.dcp-new-model { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; }
.dcp-add-model { align-self: flex-start; height: 28px; padding: 0 10px; font-size: 12px; }
.dcp-add-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.dcp-add-option { border-style: dashed; border-radius: 16px; flex: 1 1 180px; height: 44px; }
.dcp-editor-title { margin: 0; font-size: 14px; font-weight: 500; line-height: 22px; }
.dcp-json { min-height: 240px; resize: vertical; padding: 12px; font-family: var(--ds-font-family-code, ui-monospace, monospace); font-size: 12px; line-height: 19px; tab-size: 2; }
.dcp-error, .dcp-status, .dcp-empty { margin: 0; font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.dcp-error { color: var(--dcp-danger); white-space: pre-wrap; }
.dcp-status { color: var(--dsw-alias-state-success-primary, #21835a); }
.dcp-empty { color: var(--dcp-muted); }
.dcp-skeleton { height: 32px; border-radius: var(--dcp-radius); background: var(--dcp-hover); animation: dcp-pulse 1.2s ease-in-out infinite alternate; }
.dcp-button:focus-visible, .dcp-customized-summary:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #2b8063); outline-offset: 2px; }
@keyframes dcp-pulse { to { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .dcp-skeleton { animation: none; } .dcp-customized-summary::before { transition: none; } }
@media (max-width: 560px) {
  .dcp-provider-card { padding: 12px; }
  .dcp-provider-editor, .dcp-add-card { padding: 12px; }
  .dcp-provider-head { flex-wrap: wrap; }
  .dcp-provider-actions { margin-left: auto; }
  .dcp-form-grid { grid-template-columns: minmax(0, 1fr); }
  .dcp-model-row { grid-template-columns: minmax(0, 1fr) auto; }
  .dcp-model-id-field { grid-column: 1; }
  .dcp-model-name-field { grid-row: 2; grid-column: 1 / -1; }
  .dcp-model-tools { grid-row: 1; grid-column: 2; }
  .dcp-new-model { grid-template-columns: auto auto; justify-content: end; }
  .dcp-new-model .dcp-input { grid-column: 1 / -1; }
  .dcp-level-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .dcp-level-row .dcp-icon-button { grid-column: 1 / -1; justify-self: end; }
}
`;

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inputTypes(value, fallback = ["text"]) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  return ["text", "image"].filter((type) => source.includes(type));
}

function reasoningMode(value) {
  return value === false ? "disabled" : "custom";
}

function reasoningLevels(value) {
  if (value === false || value === undefined || !value || typeof value !== "object" || Array.isArray(value)) {
    return Object.entries(DEFAULT_REASONING_LEVELS).map(([id, effort]) => ({ id, effort: effort ?? "" }));
  }
  const entries = Object.entries(value);
  return entries.length ? entries.map(([id, effort]) => ({ id, effort: effort == null ? "" : String(effort) })) :
    Object.entries(DEFAULT_REASONING_LEVELS).map(([id, effort]) => ({ id, effort: effort ?? "" }));
}

function commonDraft(source, effective = source) {
  return {
    name: typeof source.name === "string" ? source.name : "",
    contextWindow: source.contextWindow === undefined ? "" : formatCapacity(source.contextWindow),
    maxTokens: source.maxTokens === undefined ? "" : formatCapacity(source.maxTokens),
    inputConfigured: Array.isArray(source.input) && source.input.length > 0,
    inputTypes: inputTypes(source.input, effective.input),
    reasoningConfigured: source.reasoningEfforts !== undefined,
    reasoning: reasoningMode(source.reasoningEfforts),
    reasoningLevels: reasoningLevels(source.reasoningEfforts)
  };
}

const CAPACITY_PATTERN = /^(\d+(?:\.\d+)?)([km])?$/i;
const CAPACITY_SCALE = { k: 1e3, m: 1e6 };

function parseCapacity(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return undefined;
  const match = CAPACITY_PATTERN.exec(trimmed);
  if (!match) return NaN;
  const scale = match[2] ? CAPACITY_SCALE[match[2].toLowerCase()] : 1;
  const value = Number(match[1]) * scale;
  return Number.isSafeInteger(value) ? value : NaN;
}

function formatCapacity(value) {
  if (!Number.isInteger(value) || value <= 0) return String(value ?? "");
  if (value % CAPACITY_SCALE.m === 0) return `${value / CAPACITY_SCALE.m}M`;
  if (value % CAPACITY_SCALE.k === 0) return `${value / CAPACITY_SCALE.k}K`;
  return String(value);
}

function positiveCapacity(text, label) {
  const value = parseCapacity(text);
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(tr(`${label}必须是正整数，可使用 K 或 M 单位`, `${label} must be a positive integer; K and M suffixes are supported`));
  return value;
}

function modelInputValue(configured, types) {
  return configured ? inputTypes(types) : undefined;
}

function reasoningValue(configured, mode, levels) {
  if (!configured) return undefined;
  if (mode === "disabled") return false;
  const next = {};
  for (const entry of levels ?? []) {
    const id = String(entry.id ?? "").trim();
    if (!id) continue;
    next[id] = String(entry.effort ?? "").trim() || null;
  }
  return next;
}

function Icon({ kind }) {
  const paths = { chevron: "m6 9 6 6 6-6", trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7", plus: "M12 5v14M5 12h14" };
  return h("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6,
    strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: paths[kind] }));
}

function InputTypeControl({ draft, uid, disabled, onChange }) {
  const toggle = (value) => {
    const current = draft.inputTypes.includes(value);
    const next = current ? draft.inputTypes.filter((type) => type !== value) : [...draft.inputTypes, value];
    if (!next.length) return;
    onChange({ inputTypes: next });
  };
  return h("div", { className: "dcp-field dcp-span-all" },
    h("label", { className: "dcp-toggle" },
      h("input", { type: "checkbox", role: "switch", checked: draft.inputConfigured, disabled,
        onChange: (event) => onChange({ inputConfigured: event.target.checked }) }),
      h("span", { className: "dcp-switch-track", "aria-hidden": true }, h("span", { className: "dcp-switch-thumb" })),
      tr("配置输入类型", "Configure input types")),
    draft.inputConfigured ? h("fieldset", { className: "dcp-choice-group" },
      h("legend", null, tr("输入类型", "Input types")),
      h("div", { className: "dcp-choice-options" }, [
        ["text", tr("文本", "Text")], ["image", tr("图片", "Image")]
      ].map(([value, label]) => h("label", { className: "dcp-choice-option", key: value },
        h("input", { type: "checkbox", value, checked: draft.inputTypes.includes(value), disabled: disabled || (draft.inputTypes.length === 1 && draft.inputTypes.includes(value)),
          onChange: () => toggle(value) }), label)))) : null);
}

function ReasoningControl({ draft, uid, disabled, onChange }) {
  const updateLevel = (index, key, value) => onChange({
    reasoningLevels: draft.reasoningLevels.map((entry, at) => at === index ? { ...entry, [key]: value } : entry)
  });
  const removeLevel = (index) => onChange({ reasoningLevels: draft.reasoningLevels.filter((_entry, at) => at !== index) });
  const addLevel = () => onChange({ reasoningLevels: [...draft.reasoningLevels, { id: "", effort: "" }] });
  return h("div", { className: "dcp-field dcp-span-all" },
    h("label", { className: "dcp-toggle" },
      h("input", { type: "checkbox", role: "switch", checked: draft.reasoningConfigured, disabled,
        onChange: (event) => onChange({ reasoningConfigured: event.target.checked }) }),
      h("span", { className: "dcp-switch-track", "aria-hidden": true }, h("span", { className: "dcp-switch-thumb" })),
      tr("配置推理能力", "Configure reasoning")),
    draft.reasoningConfigured ? h("fieldset", { className: "dcp-choice-group" },
      h("legend", null, tr("推理能力", "Reasoning")),
      h("div", { className: "dcp-choice-options" }, [
        ["disabled", tr("不支持推理", "Reasoning unsupported")],
        ["custom", tr("自定义", "Custom")]
      ].map(([value, label]) => h("label", { className: "dcp-choice-option", key: value },
        h("input", { type: "radio", name: `${uid}-reasoning`, value, checked: draft.reasoning === value, disabled,
          onChange: () => onChange({ reasoning: value, reasoningLevels: value === "custom" && !draft.reasoningLevels.length
            ? reasoningLevels(undefined) : draft.reasoningLevels }) }), label)))) : null,
    draft.reasoningConfigured && draft.reasoning === "custom" ? h("div", { className: "dcp-reasoning-levels" },
      draft.reasoningLevels.map((entry, index) => h("div", { className: "dcp-level-row", key: `${uid}-level-${index}` },
        h("input", { className: "dcp-input", value: entry.id, disabled,
          placeholder: tr("等级名称", "Level name"), "aria-label": tr(`推理等级名称 ${index + 1}`, `Reasoning level name ${index + 1}`),
          onChange: (event) => updateLevel(index, "id", event.target.value) }),
        h("input", { className: "dcp-input", value: entry.effort, disabled,
          placeholder: tr("请求值（off 可留空）", "Request value (blank for off)"), "aria-label": tr(`推理等级值 ${index + 1}`, `Reasoning level value ${index + 1}`),
          onChange: (event) => updateLevel(index, "effort", event.target.value) }),
        h("button", { type: "button", className: "dcp-button dcp-icon-button dcp-icon-button-danger", disabled: disabled || draft.reasoningLevels.length <= 1,
          title: tr("删除推理等级", "Remove reasoning level"), "aria-label": tr(`删除推理等级 ${index + 1}`, `Remove reasoning level ${index + 1}`),
          onClick: () => removeLevel(index) }, h(Icon, { kind: "trash" })))),
      h("div", { className: "dcp-level-actions" }, h("button", { type: "button", className: "dcp-button dcp-button-small", disabled,
        onClick: addLevel }, h(Icon, { kind: "plus" }), tr("添加推理等级", "Add reasoning level")))) : null);
}

function previewModel(source, draft) {
  const next = { ...source };
  const name = draft.name.trim();
  if (name) next.name = name;
  else delete next.name;
  for (const field of ["contextWindow", "maxTokens"]) {
    const value = parseCapacity(draft[field]);
    if (value === undefined) delete next[field];
    else if (Number.isSafeInteger(value) && value > 0) next[field] = value;
    else if (source[field] === undefined) delete next[field];
  }
  const input = modelInputValue(draft.inputConfigured, draft.inputTypes);
  if (input === undefined) delete next.input;
  else next.input = input;
  const reasoning = reasoningValue(draft.reasoningConfigured, draft.reasoning, draft.reasoningLevels);
  if (reasoning === undefined) delete next.reasoningEfforts;
  else next.reasoningEfforts = reasoning;
  return next;
}

function ModelRow({ view, route, model, mode, readOnly, busy, expanded, onToggle, onWrite, onDelete }) {
  const source = editableModel(view, route, model.id);
  const effective = model;
  readOnly = readOnly || mode === "inherited";
  const uid = React.useId();
  const sourceKey = JSON.stringify(source);
  const initial = () => commonDraft(source, effective);
  const [draft, setDraft] = React.useState(initial);
  const [dirty, setDirty] = React.useState(false);
  const [failure, setFailure] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importStatus, setImportStatus] = React.useState("");
  const [jsonDirty, setJsonDirty] = React.useState(false);
  React.useEffect(() => {
    if (!dirty) setDraft(initial());
  }, [sourceKey, dirty]);
  const change = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setFailure("");
    setSaved(false);
    setImportStatus("");
  };
  const importModelsDev = async () => {
    setImporting(true); setFailure(""); setSaved(false); setImportStatus("");
    try {
      const result = await loadModelsDev();
      // A failed refresh must not turn an expired snapshot into a new user override.
      if (result.error) throw new Error(result.stale
        ? tr("models.dev 更新失败，未导入过期缓存", "models.dev refresh failed; stale cache was not imported") + `: ${result.error}`
        : tr("models.dev 拉取失败", "models.dev fetch failed") + `: ${result.error}`);
      const match = findModelsDevMatch(result.data, model.id);
      if (!match) throw new Error(tr("models.dev 中未找到该模型", "Model not found on models.dev"));
      const fields = modelsDevFields(match.entry);
      if (!Object.keys(fields).length) throw new Error(tr("models.dev 未提供可导入的模型字段", "models.dev has no supported fields to import"));
      const error = await onWrite(patchModelOperation(view, route, model.id, fields));
      if (error) throw new Error(error);
      setImportStatus(tr("已从 models.dev 保存", "Saved from models.dev") + `: ${match.key}`);
    } catch (error) { setFailure(error instanceof Error ? error.message : String(error)); }
    finally { setImporting(false); }
  };
  const submit = async (restore = false) => {
    setImportStatus("");
    try {
      const changes = restore ? Object.fromEntries(COMMON_MODEL_FIELDS.map((key) => [key, undefined])) : {
        name: draft.name.trim() || undefined,
        contextWindow: positiveCapacity(draft.contextWindow, tr("上下文窗口", "Context window")),
        maxTokens: positiveCapacity(draft.maxTokens, tr("输出上限", "Output limit")),
        input: modelInputValue(draft.inputConfigured, draft.inputTypes),
        reasoningEfforts: reasoningValue(draft.reasoningConfigured, draft.reasoning, draft.reasoningLevels)
      };
      const error = await onWrite(patchModelOperation(view, route, model.id, changes));
      setFailure(error ?? "");
      setSaved(!error);
      if (!error) setDirty(false);
    } catch (error) {
      setFailure(error.message);
      setSaved(false);
    }
  };
  const disabled = readOnly || busy || importing;
  const preview = previewModel(source, draft);
  const field = (key, label, control) => h("div", { className: "dcp-field", key },
    h("label", { htmlFor: `${uid}-${key}` }, label), control);
  return h("div", { className: "dcp-model-entry" },
    h("div", { className: "dcp-model-row" },
      h("div", { className: "dcp-field dcp-model-id-field" },
        h("label", { htmlFor: `${uid}-id` }, tr("模型 ID", "Model ID")),
        h("input", { id: `${uid}-id`, className: "dcp-input", value: model.id, readOnly: true,
          "aria-label": tr(`模型 ID ${model.id}`, `Model ID ${model.id}`) })),
      h("div", { className: "dcp-field dcp-model-name-field" },
        h("label", { htmlFor: `${uid}-name` }, tr("模型名称", "Model name")),
        h("input", { id: `${uid}-name`, className: "dcp-input", value: draft.name, disabled,
          placeholder: effective.name ?? model.id, "aria-label": tr(`模型名称 ${model.id}`, `Model name ${model.id}`),
          onChange: (event) => change("name", event.target.value) })),
      h("div", { className: "dcp-model-tools" },
        h("button", { type: "button", className: "dcp-button dcp-icon-button", "aria-expanded": expanded,
          "aria-controls": `${uid}-advanced`, "aria-label": expanded ? tr(`收起模型 ${model.id}`, `Collapse model ${model.id}`) : tr(`展开模型 ${model.id}`, `Expand model ${model.id}`),
          title: tr("模型配置", "Model settings"), onClick: onToggle, style: { transform: expanded ? undefined : "rotate(-90deg)" } }, h(Icon, { kind: "chevron" })),
        mode === "listed" ? h("button", { type: "button", className: "dcp-button dcp-icon-button dcp-icon-button-danger", disabled,
          title: tr("删除模型", "Remove model"),
          "aria-label": tr(`删除模型 ${model.id}`, `Remove model ${model.id}`), onClick: onDelete }, h(Icon, { kind: "trash" })) : null)),
    h("div", { className: "dcp-model-advanced", id: `${uid}-advanced`, hidden: !expanded },
      h("div", { className: "dcp-form-grid" },
        field("context", tr("上下文窗口", "Context window"),
          h("input", { id: `${uid}-context`, className: "dcp-input", type: "text", value: draft.contextWindow, disabled,
            placeholder: effective.contextWindow === undefined ? tr("256K", "256K") : formatCapacity(effective.contextWindow),
            onChange: (event) => change("contextWindow", event.target.value) })),
        field("output", tr("输出上限", "Output limit"),
          h("input", { id: `${uid}-output`, className: "dcp-input", type: "text", value: draft.maxTokens, disabled,
            placeholder: effective.maxTokens === undefined ? tr("32K", "32K") : formatCapacity(effective.maxTokens),
            onChange: (event) => change("maxTokens", event.target.value) })),
        h(InputTypeControl, { draft, uid, disabled, onChange: (changes) => {
          setDraft((current) => ({ ...current, ...changes })); setDirty(true); setFailure(""); setSaved(false);
        } }),
        h(ReasoningControl, { draft, uid, disabled, onChange: (changes) => {
          setDraft((current) => ({ ...current, ...changes })); setDirty(true); setFailure(""); setSaved(false);
        } }))),
    failure ? h("p", { className: "dcp-error", role: "alert" }, failure) : null,
    saved ? h("p", { className: "dcp-status", role: "status" }, tr("已保存", "Saved")) : null,
    importStatus ? h("p", { className: "dcp-status", role: "status" }, importStatus) : null,
    readOnly && expanded ? h("p", { className: "dcp-empty" }, mode === "inherited" ? tr("此模型来自组合配置，当前只读", "This model is inherited and read-only") : tr("当前设置为只读", "Settings are read-only")) : null,
    !readOnly && (expanded || dirty) ? h("div", { className: "dcp-actions" },
      expanded ? h("button", { type: "button", className: "dcp-button dcp-button-small", disabled, onClick: () => submit(true) }, tr("恢复继承", "Restore inherited")) : null,
      expanded ? h("button", { type: "button", className: "dcp-button dcp-button-small", disabled: disabled || dirty || jsonDirty,
        title: dirty || jsonDirty ? tr("请先保存或放弃未保存的修改", "Save or discard unsaved changes first") : undefined,
        onClick: importModelsDev }, importing ? tr("拉取中", "Fetching") : tr("从 models.dev 拉取", "Fetch from models.dev")) : null,
      h("button", { type: "button", className: "dcp-button dcp-button-primary dcp-button-small", disabled: disabled || !dirty,
        onClick: () => submit(false) }, busy ? tr("保存中", "Saving") : tr("保存模型", "Save model"))) : null,
    h("details", { className: "dcp-customized", hidden: !expanded },
      h("summary", { className: "dcp-customized-summary" }, tr("编辑 JSON", "Edit JSON")),
      h("div", { className: "dcp-customized-body" },
        h(AdvancedEditor, {
          source: preview,
          revision: view.revision,
          readOnly,
          busy: busy || dirty || importing,
          onDirtyChange: setJsonDirty,
          save: (next, revision) => {
            try { return onWrite(replaceModelOperation(view, route, model.id, next), revision); }
            catch (error) { return Promise.resolve(error.message); }
          }
        })
      )
    )
  );
}

function AdvancedEditor({ source, revision, readOnly, busy, save, onDirtyChange }) {
  const sourceKey = JSON.stringify(source);
  const formatted = () => JSON.stringify(source, null, 2);
  const [draft, setDraft] = React.useState(formatted);
  const [dirty, setDirty] = React.useState(false);
  const [draftRevision, setDraftRevision] = React.useState(revision);
  const [failure, setFailure] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => {
    if (!dirty) { setDraft(formatted()); setDraftRevision(revision); }
  }, [sourceKey, revision, dirty]);
  React.useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
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
      const error = await save(value, draftRevision);
      setFailure(error ?? "");
      setSaved(!error);
      if (!error) setDirty(false);
    } catch (error) {
      setFailure(error.message);
      setSaved(false);
    }
  };
  return h("div", { className: "dcp-form" },
    h("textarea", { className: "dcp-json", value: draft, disabled: readOnly || busy, spellCheck: false,
      "aria-label": tr("当前模型 JSON", "Current model JSON"), onChange: (event) => {
        if (!dirty) setDraftRevision(revision);
        setDraft(event.target.value); setDirty(true); setFailure(""); setSaved(false);
      } }),
    failure ? h("p", { className: "dcp-error", role: "alert" }, failure) : null,
    saved ? h("p", { className: "dcp-status", role: "status" }, tr("已保存", "Saved")) : null,
    readOnly ? h("p", { className: "dcp-empty" }, tr("当前模型只读", "This model is read-only")) :
      h("div", { className: "dcp-actions" },
        h("button", { type: "button", className: "dcp-button dcp-button-small", disabled: busy || !dirty,
          onClick: () => { setDirty(false); setDraft(formatted()); setDraftRevision(revision); setFailure(""); setSaved(false); } }, tr("重新加载", "Reload")),
        h("button", { type: "button", className: "dcp-button dcp-button-small", disabled: busy, onClick: format }, tr("格式化", "Format")),
        h("button", { type: "button", className: "dcp-button dcp-button-primary dcp-button-small", disabled: busy || !dirty,
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

function CreateProvider({ view, schema, available, busy, api, onWrite, onClose, onCredentialSaved, initialKind }) {
  const [kind, setKind] = React.useState(initialKind ?? (available.length ? "catalog" : "custom"));
  const [chosen, setChosen] = React.useState(available[0]?.provider ?? "");
  const [route, setRoute] = React.useState("");
  const [name, setName] = React.useState("");
  const [baseURL, setBaseURL] = React.useState("");
  const protocols = React.useMemo(() => protocolChoices(view, schema), [view?.schema, schema]);
  const [protocol, setProtocol] = React.useState("");
  const [models, setModels] = React.useState([]);
  const [discovering, setDiscovering] = React.useState(false);
  const [key, setKey] = React.useState("");
  const [committed, setCommitted] = React.useState("");
  const [failure, setFailure] = React.useState("");
  const [discoveryWarning, setDiscoveryWarning] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const fetchModels = async () => {
    setDiscoveryWarning("");
    setFailure(""); setDiscovering(true);
    try {
      if (!validUrl(baseURL.trim()) || !protocols.includes(protocol || protocols[0])) {
        throw new Error(tr("请先填写有效的地址和协议", "Enter a valid endpoint and protocol first"));
      }
      const response = await api.llm.discoverModels(NS, {
        provider: route.trim() || undefined,
        baseURL: baseURL.trim(),
        api: protocol || protocols[0],
        apiKey: key || undefined
      });
      if (!response.ok) throw new Error(response.error.message);
      const enriched = await enrichDiscoveredModels(response.value, (provider) => loadPiAiCatalog(api, provider));
      if (!enriched.models.length) throw new Error(tr("提供方没有返回可用模型", "The provider returned no usable models"));
      setModels(enriched.models);
      setDiscoveryWarning(piAiWarning(enriched));
    } catch (error) { setFailure(error.message); }
    finally { setDiscovering(false); }
  };
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
          api: protocol || protocols[0], baseURL: baseURL.trim(), models
        };
        if (kind === "custom" && (!validUrl(baseURL.trim()) || !protocols.includes(profile.api) || !models.length)) {
          throw new Error(tr("请填写有效的地址、协议并获取至少一个模型", "Enter a valid endpoint, protocol, and fetch at least one model"));
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
        onCredentialSaved(ref);
      }
      onClose(id);
    } catch (error) { setFailure(error.message); }
    finally { setSubmitting(false); }
  };
  const disabled = busy || submitting || discovering || !!committed;
  const fetchedModelList = models.length ? h("div", { className: "dcp-model-list" }, models.map((model) => {
    const remove = () => setModels((current) => current.filter((entry) => entry.id !== model.id));
    return h("div", { className: "dcp-model-entry", key: model.id },
      h("div", { className: "dcp-provider-head dcp-fetched-model-head" },
        h("span", { className: "dcp-provider-name" }, model.name ?? model.id),
        h("span", { className: "dcp-provider-route" }, model.id),
        h("button", { type: "button", className: "dcp-button dcp-button-danger dcp-button-small", disabled, onClick: remove }, tr("移除", "Remove"))));
  })) : h("p", { className: "dcp-model-empty" }, tr("尚未获取模型", "No models fetched yet"));
  return h("div", { className: "dcp-form" },
    h("h3", { className: "dcp-editor-title" }, tr("添加模型供应商", "Add model provider")),
    available.length && protocols.length ? h("div", { className: "dcp-choice-options", role: "group", "aria-label": tr("供应商类型", "Provider type") },
      h("button", { type: "button", className: `dcp-button dcp-button-small${kind === "catalog" ? " dcp-button-primary" : ""}`, disabled, onClick: () => setKind("catalog") }, tr("第三方模型供应商", "Third-party provider")),
      h("button", { type: "button", className: `dcp-button dcp-button-small${kind === "custom" ? " dcp-button-primary" : ""}`, disabled, onClick: () => setKind("custom") }, tr("自定义模型 API", "Custom model API"))) : null,
    h("div", { className: "dcp-form-grid" },
      kind === "catalog" ? h("div", { className: "dcp-field dcp-span-all" }, h("label", { htmlFor: "dcp-create-catalog" }, tr("提供方", "Provider")),
        h("select", { id: "dcp-create-catalog", className: "dcp-select", value: chosen, disabled, onChange: (event) => setChosen(event.target.value) },
          available.map((item) => h("option", { value: item.provider, key: item.provider }, item.displayName ?? item.provider)))) :
        h(React.Fragment, null,
          h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-create-route" }, tr("提供方 ID", "Provider ID")),
            h("input", { id: "dcp-create-route", className: "dcp-input", value: route, disabled, placeholder: "acme-gateway", onChange: (event) => setRoute(event.target.value) })),
          h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-create-name" }, tr("显示名称", "Display name")),
            h("input", { id: "dcp-create-name", className: "dcp-input", value: name, disabled, placeholder: tr("可选", "Optional"), onChange: (event) => setName(event.target.value) })),
          h("div", { className: "dcp-field dcp-span-all" }, h("label", { htmlFor: "dcp-create-url" }, tr("接口地址", "Endpoint")),
            h("input", { id: "dcp-create-url", className: "dcp-input", type: "url", value: baseURL, disabled, placeholder: "https://api.example.com/v1", onChange: (event) => setBaseURL(event.target.value) })),
          h("div", { className: "dcp-field" }, h("label", { htmlFor: "dcp-create-api" }, tr("协议", "Protocol")),
            h("select", { id: "dcp-create-api", className: "dcp-select", value: protocol || protocols[0] || "", disabled, onChange: (event) => setProtocol(event.target.value) },
              protocols.map((item) => h("option", { value: item, key: item }, item))))),
          h("div", { className: "dcp-field dcp-span-all" },
            h("label", { htmlFor: "dcp-create-key" }, "API Key"),
            h("input", { id: "dcp-create-key", className: "dcp-input", type: "password", autoComplete: "off", value: key,
              placeholder: tr("可留空，使用提供方原生认证", "Optional for provider-native authentication"),
              disabled: busy || submitting, onChange: (event) => setKey(event.target.value) })),
          kind === "custom" ? h("div", { className: "dcp-field dcp-span-all" },
            h("div", { className: "dcp-actions" },
              h("button", { type: "button", className: "dcp-button dcp-button-small", disabled: disabled || !baseURL.trim(), onClick: fetchModels },
                discovering ? tr("获取中", "Fetching") : tr("获取可用模型", "Fetch available models"))),
            fetchedModelList) : null,
      ),
    failure ? h("p", { className: "dcp-error", role: "alert" }, failure) : null,
    discoveryWarning ? h("p", { className: "dcp-notice", role: "status" }, discoveryWarning) : null,
    h("div", { className: "dcp-actions" },
      h("button", { type: "button", className: "dcp-button", disabled: submitting, onClick: () => onClose(committed) }, tr("取消", "Cancel")),
      h("button", { type: "button", className: "dcp-button dcp-button-primary", disabled: busy || submitting || discovering || (!committed && kind === "catalog" && !chosen) || (!committed && kind === "custom" && !models.length), onClick: submit },
        submitting ? tr("保存中", "Saving") : committed ? tr("重试保存密钥", "Retry key") : tr("添加", "Add"))));
}

function ModelCatalog({ view, route, mode, models, catalog, writable, busy, onWrite, onDiscover }) {
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState(() => new Set());
  const [adding, setAdding] = React.useState(false);
  const [newModelId, setNewModelId] = React.useState("");
  const [failure, setFailure] = React.useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const validModels = models.filter((model) => typeof model?.id === "string" && model.id.trim());
  const shownModels = normalizedQuery ? validModels.filter((model) => model.id.toLowerCase().includes(normalizedQuery) ||
    String(model.name ?? "").toLowerCase().includes(normalizedQuery)) : validModels;
  const addModel = async () => {
    const id = newModelId.trim();
    if (!id) return;
    try {
      const error = await onWrite(addModelOperation(view, route, { id }));
      if (error) throw new Error(error);
      setNewModelId(""); setAdding(false); setFailure(""); setExpanded((current) => new Set(current).add(id));
    } catch (error) { setFailure(error.message); }
  };
  return h("section", { className: "dcp-model-catalog", "aria-label": tr("模型", "Models") },
    h("div", { className: "dcp-model-catalog-head" },
      h("div", { className: "dcp-model-catalog-heading" },
        h("h3", { className: "dcp-model-catalog-title" }, tr("模型", "Models")),
        h("span", { className: "dcp-model-catalog-meta" }, mode === "listed" ? tr("用户配置", "Customized") :
          mode === "inherited" ? tr("组合继承 · 只读", "Inherited · read-only") : tr("内置目录", "Built-in catalog"))),
      mode !== "inherited" ? h("button", { type: "button", className: "dcp-button dcp-button-small", disabled: busy || catalog?.status === "loading", onClick: onDiscover },
        catalog?.status === "loading" ? tr("获取中", "Fetching") : tr("获取可用模型", "Fetch available models")) : null),
    h("input", { className: "dcp-search", type: "search", value: query, disabled: busy,
      placeholder: tr("搜索模型", "Search models"), "aria-label": tr("搜索模型", "Search models"), onChange: (event) => setQuery(event.target.value) }),
    catalog?.status === "error" ? h("p", { className: "dcp-error", role: "alert" }, catalog.error) : null,
    catalog?.warning ? h("p", { className: "dcp-notice", role: "status" }, catalog.warning) : null,
    failure ? h("p", { className: "dcp-error", role: "alert" }, failure) : null,
    catalog?.status === "loading" && !models.length ? h("div", { className: "dcp-skeleton" }) : null,
    shownModels.length ? h("div", { className: "dcp-model-list" }, shownModels.map((model) => h(ModelRow, { key: model.id, view, route, model, mode,
      readOnly: !writable, busy, expanded: expanded.has(model.id), onToggle: () => setExpanded((current) => {
        const next = new Set(current); if (!next.delete(model.id)) next.add(model.id); return next;
      }), onWrite, onDelete: async () => {
        if (!window.confirm(tr(`删除模型 ${model.id}？`, `Delete model ${model.id}?`))) return;
        try {
          const error = await onWrite(removeModelOperation(view, route, model.id));
          if (error) throw new Error(error);
          setFailure("");
        } catch (error) { setFailure(error.message); }
      } }))) :
      catalog?.status !== "loading" ? h("p", { className: "dcp-model-empty" }, query.trim() ? tr("没有匹配的模型，请调整搜索条件", "No matching models. Try another search.") : tr("暂无模型，可重新获取或配置模型列表", "No models yet. Fetch models or configure the model list.")) : null,
    mode === "listed" ? h("div", { className: adding ? "dcp-new-model" : "dcp-actions dcp-actions-start" }, adding ? h(React.Fragment, null,
      h("input", { className: "dcp-input", value: newModelId, disabled: busy, autoFocus: true,
        placeholder: tr("模型 ID", "Model ID"), "aria-label": tr("新模型 ID", "New model ID"), onChange: (event) => setNewModelId(event.target.value),
        onKeyDown: (event) => { if (event.key === "Enter") addModel(); } }),
      h("button", { type: "button", className: "dcp-button dcp-button-primary dcp-button-small", disabled: busy || !newModelId.trim(), onClick: addModel }, tr("添加", "Add")),
      h("button", { type: "button", className: "dcp-button dcp-button-small", disabled: busy, onClick: () => { setAdding(false); setNewModelId(""); } }, tr("取消", "Cancel"))) :
      h("button", { type: "button", className: "dcp-button dcp-add-model", disabled: !writable || busy, onClick: () => setAdding(true) }, h(Icon, { kind: "plus" }), tr("添加模型", "Add model"))) : null);
}

function ProviderEditor({ view, route, schema, api, writable, busy, onWrite, models, mode, catalog, providerKind: kind, onDiscover, onCredentialSaved }) {
  const profile = providerProfile(view, route);
  const effective = getAt(view.value, ["providers", route]) ?? {};
  const ref = effective.apiKeyEnv || derivedKeyRef(route);
  const inheritsProtocol = kind === "catalog";
  const [draft, setDraft] = React.useState(() => ({
    displayName: profile.displayName ?? "", baseURL: profile.baseURL ?? "",
    api: profile.api ?? (inheritsProtocol ? "" : effective.api ?? "")
  }));
  const [key, setKey] = React.useState("");
  const [credential, setCredential] = React.useState();
  const [failure, setFailure] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
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
    if (!dirty) setDraft({ displayName: profile.displayName ?? "", baseURL: profile.baseURL ?? "",
      api: profile.api ?? (inheritsProtocol ? "" : effective.api ?? "") });
  }, [JSON.stringify(profile), view.revision]);
  const change = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value })); setDirty(true); setFailure(""); setStatus("");
  };
  const save = async (operation, expectedRevision) => {
    setFailure(""); setStatus(""); setWorking(true);
    try {
      const error = await onWrite(operation, expectedRevision);
      if (error) throw new Error(error);
      setDirty(false); setStatus(tr("已保存", "Saved"));
    } catch (error) { setFailure(error.message); }
    finally { setWorking(false); }
  };
  const saveCommon = () => {
    try {
      const next = Object.fromEntries(COMMON_PROVIDER_FIELDS.map((field) => [field, String(draft[field] ?? "").trim() || undefined]));
      if (next.baseURL && !validUrl(next.baseURL)) throw new Error(tr("接口地址必须是 http 或 https URL", "Endpoint must be an http or https URL"));
      if (!inheritsProtocol && !next.api) throw new Error(tr("自定义提供方必须选择协议", "A custom provider must select a protocol"));
      if (next.api && !protocols.includes(next.api)) throw new Error(tr("不支持的协议", "Unsupported protocol"));
      save(patchProviderOperation(view, route, next));
    } catch (error) { setFailure(error.message); }
  };
  const saveKey = async () => {
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
      setKey(""); setCredential({ configured: true, writable: true }); onCredentialSaved(ref); setStatus(tr("密钥已保存", "Key saved"));
    } catch (error) { setFailure(error.message); }
    finally { setWorking(false); }
  };
  const disabled = !writable || busy || working;
  const connectionField = (name, label, control, wide = false) => h("div", { className: `dcp-field${wide ? " dcp-span-all" : ""}` },
    h("label", { htmlFor: `dcp-provider-${name}-${route}` }, label), control);
  return h("div", { className: "dcp-provider-editor" },
    h("div", { className: "dcp-field" },
      h("label", { htmlFor: `dcp-provider-key-${route}` }, "API Key"),
      h("div", { className: "dcp-key-row" },
        h("input", { id: `dcp-provider-key-${route}`, className: "dcp-input", type: "password", autoComplete: "off", value: key,
          disabled: disabled || credential?.writable === false, placeholder: credential?.configured ? tr("已配置 · 输入新密钥以替换", "Configured · enter a new key to replace") : tr("可留空，使用提供方原生认证", "Optional for provider-native authentication"),
          onChange: (event) => { setKey(event.target.value); setFailure(""); } }),
        h("button", { type: "button", className: "dcp-button dcp-button-small", disabled: disabled || !key || credential?.writable === false,
          onClick: saveKey }, tr("保存密钥", "Save key"))),
      h("p", { className: "dcp-help" }, tr("密钥单独存入 dsh 凭据库，不写入设置 JSON。", "Stored in the dsh credential store and never written to settings JSON.")),
      credential?.error ? h("p", { className: "dcp-error", role: "alert" }, credential.error) : null),
    h("details", { className: "dcp-customized" },
      h("summary", { className: "dcp-customized-summary" }, tr("自定义设置", "Customized settings")),
      h("div", { className: "dcp-customized-body" },
        h("div", { className: "dcp-form-grid" },
          connectionField("name", tr("显示名称", "Display name"),
            h("input", { id: `dcp-provider-name-${route}`, className: "dcp-input", value: draft.displayName, disabled,
              placeholder: effective.displayName || route, onChange: (event) => change("displayName", event.target.value) })),
          connectionField("api", tr("协议", "Protocol"),
            h("select", { id: `dcp-provider-api-${route}`, className: "dcp-select", value: draft.api, disabled,
              onChange: (event) => change("api", event.target.value) },
              inheritsProtocol ? h("option", { value: "" }, tr("继承目录", "Inherit catalog")) : null,
              protocols.map((item) => h("option", { value: item, key: item }, item)))),
          connectionField("url", tr("接口地址", "Endpoint"),
            h("input", { id: `dcp-provider-url-${route}`, className: "dcp-input", type: "url", value: draft.baseURL, disabled,
              placeholder: effective.baseURL || tr("使用目录默认地址", "Catalog endpoint"), onChange: (event) => change("baseURL", event.target.value) }), true)),
        h("div", { className: "dcp-actions" },
          h("button", { type: "button", className: "dcp-button dcp-button-primary dcp-button-small", disabled: disabled || !dirty, onClick: saveCommon }, tr("保存设置", "Save settings"))),
        h(ModelCatalog, { view, route, mode, models, catalog, writable, busy: disabled, onWrite,
          onDiscover: () => onDiscover({
            baseURL: draft.baseURL.trim() || undefined,
            api: draft.api || undefined,
            apiKey: key || undefined
          }) })),
    failure ? h("p", { className: "dcp-error", role: "alert" }, failure) : null,
    status ? h("p", { className: "dcp-status", role: "status" }, status) : null));
}

function piAiWarning(result) {
  return result.piAiError ? tr("pi-ai 目录查询失败", "pi-ai catalog lookup failed") + `: ${result.piAiError}` : "";
}

function mergeDiscoveredModels(existing, discovered) {
  // A discovery refresh adds models and fills gaps; it must not remove or replace user-owned entries.
  const next = [...existing];
  const indexById = new Map(existing.map((model, index) => [model?.id, index]));
  for (const model of discovered) {
    const entry = discoveredModelEntry(model);
    if (!entry) continue;
    const index = indexById.get(entry.id);
    if (index === undefined) {
      indexById.set(entry.id, next.length);
      next.push(entry);
    } else {
      next[index] = { ...entry, ...next[index] };
    }
  }
  return next;
}

function ModelConfigSection({ api, schema }) {
  const [view, setView] = React.useState();
  const [writable, setWritable] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [failure, setFailure] = React.useState("");
  const [route, setRoute] = React.useState("");
  const [directory, setDirectory] = React.useState([]);
  const [directoryError, setDirectoryError] = React.useState("");
  const [addingProvider, setAddingProvider] = React.useState(false);
  const [catalogs, setCatalogs] = React.useState({});
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
  const [credentialStates, setCredentialStates] = React.useState({});
  const credentialReadVersion = React.useRef(0);
  const onCredentialSaved = (ref) => {
    credentialReadVersion.current += 1;
    setCredentialStates((current) => ({ ...current, [ref]: { configured: true, writable: true } }));
  };

  React.useEffect(() => {
    let active = true;
    const readVersion = credentialReadVersion.current;
    const refs = providers.map((provider) => getAt(view?.value, ["providers", provider.id, "apiKeyEnv"]))
      .filter((ref) => typeof ref === "string" && ref.length > 0);
    if (!refs.length) { setCredentialStates({}); return () => { active = false; }; }
    api.credentials.describe(refs).then((result) => {
      if (!active || !result.ok || readVersion !== credentialReadVersion.current) return;
      setCredentialStates(result.value);
    }).catch((error) => { if (active && readVersion === credentialReadVersion.current) setFailure(error.message); });
    return () => { active = false; };
  }, [api, providerIds, view?.revision]);

  React.useEffect(() => {
    if (route && !providers.some((provider) => provider.id === route)) {
      setRoute(providers[0]?.id ?? "");
    }
  }, [providerIds, route]);

  const discovered = catalogs[route]?.models ?? [];
  const models = view && route ? modelEntries(view, route, discovered) : [];

  const saveOperation = React.useCallback(async (operation, expectedRevision) => {
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
  }, [api, busy, refresh, schema, view]);

  const mode = view && route ? modelMode(view, route) : "catalog";
  const available = availableCatalogProviders(directory, providers.map((provider) => provider.id));
  const discoveryRef = React.useRef(new Set());
  const autoDiscoveryRef = React.useRef(new Set());
  const discover = React.useCallback(async (overrides = {}) => {
    if (!view || !route || discoveryRef.current.has(route)) return;
    discoveryRef.current.add(route);
    const currentRoute = route;
    const currentView = view;
    const currentMode = modelMode(currentView, currentRoute);
    const profile = getAt(currentView.value, ["providers", currentRoute]) ?? {};
    const request = { provider: currentRoute };
    const baseURL = typeof overrides.baseURL === "string" ? overrides.baseURL.trim() :
      typeof profile.baseURL === "string" ? profile.baseURL.trim() : "";
    const protocol = typeof overrides.api === "string" ? overrides.api : profile.api;
    if (baseURL) request.baseURL = baseURL;
    if (protocol) request.api = protocol;
    if (typeof overrides.apiKey === "string" && overrides.apiKey) request.apiKey = overrides.apiKey;
    const previous = Array.isArray(profile.models) ? profile.models : [];
    setCatalogs((current) => ({ ...current, [currentRoute]: { status: "loading", models: current[currentRoute]?.models ?? [] } }));
    try {
      const response = await api.llm.discoverModels(NS, request);
      if (!response.ok) throw new Error(response.error.message);
      const found = Array.isArray(response.value) ? response.value : [];
      if (!found.length) throw new Error(tr("提供方没有返回可用模型", "The provider returned no usable models"));
      const enriched = await enrichDiscoveredModels(found,
        providerKind(currentView, currentRoute, directory) === "catalog" ? undefined : (provider) => loadPiAiCatalog(api, provider));
      setCatalogs((current) => ({ ...current, [currentRoute]: { status: "ready", models: enriched.models, warning: piAiWarning(enriched) } }));
      if (currentMode === "listed") {
        const next = mergeDiscoveredModels(previous, enriched.models);
        if (!sameJson(next, previous)) {
          const error = await saveOperation({ op: "set", path: ["providers", currentRoute, "models"], value: next });
          if (error) throw new Error(error);
        }
      }
    } catch (error) {
      setCatalogs((current) => ({ ...current, [currentRoute]: {
        status: "error", models: current[currentRoute]?.models ?? [], error: error.message
      } }));
    } finally {
      discoveryRef.current.delete(currentRoute);
    }
  }, [api, route, view, directory, saveOperation]);

  React.useEffect(() => {
    if (!view || !route) return;
    const currentMode = modelMode(view, route);
    const shouldDiscover = currentMode === "catalog";
    if (shouldDiscover && !autoDiscoveryRef.current.has(route)) {
      autoDiscoveryRef.current.add(route);
      discover();
    }
  }, [discover, route, view?.revision]);
  const removeProvider = async (id) => {
    if (!window.confirm(tr(`删除提供方 ${id}？其用户模型配置也将删除。`, `Remove provider ${id} and its model settings?`))) return;
    const profile = getAt(view.value, ["providers", id]) ?? {};
    const error = await saveOperation(removeProviderOperation(view, id));
    if (error) { setFailure(error); return; }
    if (profile.apiKeyEnv === derivedKeyRef(id)) {
      const result = await api.credentials.unset(profile.apiKeyEnv);
      if (!result.ok) setFailure(tr("提供方已删除，但密钥清理失败：", "Provider removed, but key cleanup failed: ") + result.error.message);
    }
    setRoute("");
  };

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
    h("p", { className: "dcp-intro" }, tr("配置提供方的连接、认证与模型参数。（此配置页面由插件提供，仅增强官方模型配置项）", "Configure provider connections, credentials, and model settings. (This page is provided by the plugin and only enhances the official model configuration options.)")),
    !writable ? h("p", { className: "dcp-notice", role: "status" }, tr("当前设置为只读", "Settings are read-only")) : null,
    failure ? h("p", { className: "dcp-error", role: "alert" }, failure) : null,
    directoryError ? h("div", { className: "dcp-actions dcp-actions-start" },
      h("p", { className: "dcp-error", role: "alert" }, directoryError),
      h("button", { type: "button", className: "dcp-button dcp-button-small", onClick: () => loadDirectory() }, tr("重试", "Retry"))) : null,
    providers.length ? h("ul", { className: "dcp-provider-list" }, providers.map((provider) => {
      const kind = providerKind(view, provider.id, directory);
      const open = route === provider.id && !addingProvider;
      const profile = getAt(view.value, ["providers", provider.id]) ?? {};
      const credential = typeof profile.apiKeyEnv === "string" ? credentialStates[profile.apiKeyEnv] : undefined;
      const keyConfigured = credential?.configured === true;
      const keyMissing = credential?.configured === false;
      return h("li", { key: provider.id, className: "dcp-provider-card" },
        h("div", { className: "dcp-provider-head" },
          h("span", { className: "dcp-provider-identity" },
            h("span", { className: "dcp-provider-name" }, provider.name),
            provider.name !== provider.id ? h("span", { className: "dcp-provider-route" }, provider.id) : null,
            kind === "custom" ? h("span", { className: "dcp-provider-tag" }, tr("自定义", "Custom")) : null,
            kind === "inherited" ? h("span", { className: "dcp-provider-tag" }, tr("组合继承", "Inherited")) : null,
            keyConfigured ? h("span", { className: "dcp-credential-dot dcp-credential-dot-configured", role: "img", title: tr("已配置 API Key", "API key configured"), "aria-label": tr("已配置 API Key", "API key configured") }) :
              keyMissing ? h("span", { className: "dcp-credential-dot dcp-credential-dot-missing", role: "img", title: tr("缺少 API Key", "API key missing"), "aria-label": tr("缺少 API Key", "API key missing") }) : null),
          h("span", { className: "dcp-provider-actions" },
            h("button", { type: "button", className: "dcp-button dcp-button-small", disabled: busy,
              onClick: () => { setAddingProvider(false); setRoute(open ? "" : provider.id); setFailure(""); } }, open ? tr("收起", "Close") : tr("编辑", "Edit")),
            kind === "custom" ? h("button", { type: "button", className: "dcp-button dcp-button-danger dcp-button-small", disabled: !writable || busy,
              onClick: () => removeProvider(provider.id) }, tr("移除", "Remove")) : null)),
        open ? h(ProviderEditor, { key: provider.id, view, route: provider.id, schema, api, writable, busy, onWrite: saveOperation,
          providerKind: kind,
          models, mode, catalog: catalogs[provider.id], onDiscover: discover,
          onCredentialSaved }) : null);
    })) : h("p", { className: "dcp-empty" }, tr("尚无提供方", "No providers yet")),
    addingProvider ? h("div", { className: "dcp-add-card" }, h(CreateProvider, { view, schema, available, busy, api, onWrite: saveOperation,
      onClose: (id) => { setAddingProvider(false); if (id) setRoute(id); }, onCredentialSaved })) :
      h("div", { className: "dcp-form" },
        h("div", { className: "dcp-add-actions" },
          h("button", { type: "button", className: "dcp-button dcp-add-option", disabled: !writable || busy || (available.length === 0 && !protocolChoices(view, schema).length),
            onClick: () => { setAddingProvider(true); setFailure(""); } }, h(Icon, { kind: "plus" }), tr("添加模型供应商", "Add model provider")))));
}

function apply(ctx) {
  const remote = ctx.get("remote");
  const api = {
    settings: ctx.get("remote.settings"),
    credentials: ctx.get("remote.credentials"),
    llm: ctx.get("remote.llm"),
    subscribe: (callback) => {
      const disposeSettings = remote.$on("settings/document-updated", (ns) => { if (ns === NS) callback(); });
      const disposeModels = remote.$on("llm/adapters-updated", () => { piAiCatalogs.clear(); callback(); });
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
