const h = React.createElement;
const NS = NAMESPACE;
const LOCALE_NS = "settings.customProvider";
const loadModelsDev = createModelsDevLoader();
const inject = ["slots", "locale", "remote.settings", "remote.llm", "settingsSchema"];
const ModelDraftContext = React.createContext(undefined);

const LOCALE_EN = {
  pendingJson: "Correct or reset invalid model JSON before saving. Wait for any metadata fetch to finish.",
  editJson: "Edit JSON",
  resetJson: "Reset JSON",
  jsonNote: "Valid JSON updates the form automatically. Advanced fields are retained; save the provider to persist all changes.",
  draftConflict: "This field changed in both JSON and the form. Keep the form value in JSON, or reset JSON",
  fetchChanged: "The model changed while fetching; retry",
  modelId: "Model ID",
  fetch: "Fetch from models.dev",
  fetching: "Fetching",
  fetchFilled: "models.dev data filled into the form; save the provider to persist",
  saving: "Saving",
  format: "Format",
  reload: "Reload",
  loading: "Loading model settings",
  transferNote: "API keys and headers are excluded. Existing credential references may be reused after import.",
  conflict: "Settings changed elsewhere; reload and retry",
  transfer: "Configuration transfer",
  import: "Import configuration",
  export: "Export configuration",
  download: "Download JSON",
  chooseFile: "Choose JSON file",
  importSelected: "Import selected",
  imported: "Configuration imported",
  noSelection: "Select at least one provider",
  noFile: "Choose a provider JSON file first",
  noFields: "models.dev has no supported fields to import",
  notFound: "Model not found on models.dev",
  fetchFailed: "models.dev fetch failed",
  stale: "The refresh failed; stale cached data was not imported",
  stateNew: "new",
  stateUser: "user",
  stateInherited: "inherited",
  stateLayered: "layered",
  add: "Import",
  replace: "Replace",
  skip: "Skip",
  sourceModels: "Source models",
  targetModels: "Target models",
};
const LOCALE_ZH = {
  pendingJson: "请先修正或重置模型详情中的 JSON，并等待拉取完成后再保存。",
  editJson: "编辑 JSON",
  resetJson: "重置 JSON",
  jsonNote: "有效 JSON 自动同步到表单，高级字段保留；点击提供方的「保存」统一写入。",
  draftConflict: "此字段同时在 JSON 和表单中修改，请在 JSON 中保留表单值，或重置 JSON",
  fetchChanged: "拉取期间模型已修改，请重新拉取",
  modelId: "模型 ID",
  fetch: "从 models.dev 拉取",
  fetching: "拉取中",
  fetchFilled: "已填入官方表单，请检查后保存提供方",
  saving: "保存中",
  format: "格式化",
  reload: "重新加载",
  loading: "正在加载模型配置",
  transferNote: "不传输 API Key 和请求头。导入后可能沿用目标端已有的凭据引用。",
  conflict: "配置已被其他编辑更新，请重新加载后重试",
  transfer: "配置传输",
  import: "导入配置",
  export: "导出配置",
  download: "下载 JSON",
  chooseFile: "选择 JSON 文件",
  importSelected: "导入所选配置",
  imported: "配置已导入",
  noSelection: "至少选择一个提供方",
  noFile: "请先选择提供方 JSON 文件",
  noFields: "models.dev 没有可导入的字段",
  notFound: "models.dev 中未找到该模型",
  fetchFailed: "models.dev 拉取失败",
  stale: "更新失败，未导入过期缓存",
  stateNew: "新增",
  stateUser: "用户配置",
  stateInherited: "继承",
  stateLayered: "分层配置",
  add: "导入",
  replace: "替换",
  skip: "跳过",
  sourceModels: "源模型数",
  targetModels: "目标模型数",
};

const css = `
.dcp-tools-row, .dcp-transfer-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.dcp-tools-note, .dcp-tools-status, .dcp-tools-error { margin:0; font-size:12px; line-height:18px; overflow-wrap:anywhere; }
.dcp-tools-note { color:var(--dsw-alias-label-tertiary,#747980); }
.dcp-tools-status { color:var(--dsw-alias-state-success-primary,#21835a); }
.dcp-tools-error { color:var(--dsw-alias-state-error-primary,#b42332); white-space:pre-wrap; }
.dcp-tools-button { height:30px; border:.5px solid var(--dsw-alias-border-l3,#d4d7db); border-radius:15px; background:transparent; color:var(--dsw-alias-label-primary,#24272b); padding:0 11px; cursor:pointer; font:inherit; font-size:12px; }
.dcp-tools-button:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover,#00000008); }
.dcp-tools-button-primary { border-color:transparent; color:#fff; background:var(--dsw-alias-button-primary-fill,#2b8063); }
.dcp-tools-button:focus-visible, .dcp-json-details > summary:focus-visible { outline:2px solid var(--dsw-alias-brand-primary,#2b8063); outline-offset:2px; }
.dcp-tools-button:disabled { opacity:.45; cursor:default; }
.dcp-page-head { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; }
.dcp-page-head > h2 { margin:0; }
.dcp-inline-tools { grid-column:1/-1; display:flex; flex-direction:column; gap:10px; min-width:0; }
.dcp-json-details > summary { cursor:pointer; font-size:12px; color:var(--dsw-alias-label-secondary,#555b64); }
.dcp-json-details[open] > summary { margin-bottom:10px; }
.dcp-tools-field { display:flex; flex-direction:column; gap:5px; min-width:0; }
.dcp-tools-field label { color:var(--dsw-alias-label-secondary,#555b64); font-size:12px; font-weight:500; }
.dcp-tools-select, .dcp-tools-json { box-sizing:border-box; width:100%; min-width:0; color:var(--dsw-alias-label-primary,#24272b); background:var(--dsw-alias-bg-layer-1,#fff); border:.5px solid var(--dsw-alias-border-l3,#d4d7db); border-radius:8px; font:inherit; }
.dcp-tools-select { height:34px; padding:0 9px; font-size:13px; }
.dcp-tools-json { min-height:310px; resize:vertical; padding:11px; font-family:var(--ds-font-family-code,ui-monospace,monospace); font-size:12px; line-height:19px; tab-size:2; }
.dcp-tools-select:focus, .dcp-tools-json:focus { border-color:var(--dsw-alias-brand-primary,#2b8063); outline:none; }
.dcp-transfer { display:flex; flex-direction:column; gap:12px; padding:14px 0; border-bottom:.5px solid var(--dsw-alias-border-l2,#e7e9ec); }
.dcp-transfer-list { display:flex; flex-direction:column; gap:4px; max-height:260px; overflow:auto; }
.dcp-transfer-row { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:9px; padding:6px 0; font-size:13px; }
.dcp-transfer-name { min-width:0; overflow-wrap:anywhere; }
.dcp-transfer-meta { display:block; color:var(--dsw-alias-label-tertiary,#747980); font-size:11px; line-height:16px; }
.dcp-transfer-file { font-size:12px; }
.dcp-transfer-select { width:100px; }
`;

function translateFactory(t) {
  return (key, fallback = key) => {
    const value = t?.(key);
    return value && value !== key ? value : fallback;
  };
}

async function describeNamespace(api) {
  const response = await api.settings.describe();
  if (!response.ok) throw new Error(response.error.message);
  const namespace = response.value.namespaces?.find((item) => item.ns === NS);
  if (!namespace) throw new Error("llm-pi-ai is not registered");
  return { ...namespace, writable: response.value.writable === true };
}

async function listDirectory(api) {
  const response = await api.llm.listConfigurableProviders();
  if (!response.ok) throw new Error(response.error.message);
  if (!Array.isArray(response.value)) throw new Error("Invalid provider directory");
  return response.value.filter((entry) => entry.settingsNs === NS);
}

function resultMessage(outcome, t) {
  if (!outcome) return undefined;
  if (outcome.kind === "conflict") return t("conflict", "Settings changed elsewhere; reload and retry");
  return outcome.message;
}

function ModelDraftBoundary({ children }) {
  const [pending, setPending] = React.useState(new Set());
  const report = React.useCallback((token, blocked) => setPending((current) => {
    if (current.has(token) === blocked) return current;
    const next = new Set(current); if (blocked) next.add(token); else next.delete(token); return next;
  }), []);
  const value = React.useMemo(() => ({ blocked: pending.size > 0, report }), [pending, report]);
  return h(ModelDraftContext.Provider, { value }, children);
}

function useInlineModelTools({ model, disabled, onChange, t }) {
  const text = translateFactory(t);
  const uid = React.useId();
  const boundary = React.useContext(ModelDraftContext);
  const report = boundary?.report;
  const serialized = JSON.stringify(model);
  const [json, setJson] = React.useState(() => ({ value: JSON.stringify(model, null, 2), base: model, pending: false }));
  const jsonRef = React.useRef(json);
  jsonRef.current = json;
  const reflected = React.useRef(serialized);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState("");
  const [status, setStatus] = React.useState("");
  const current = React.useRef();
  current.current = { model, disabled, onChange };
  const updateJson = (next) => { jsonRef.current = next; setJson(next); };
  React.useEffect(() => {
    // An echo of our own edit must not reformat the text or move the caret.
    if (reflected.current === serialized) return;
    reflected.current = serialized;
    if (!jsonRef.current.pending) updateJson({ value: JSON.stringify(model, null, 2), base: model, pending: false });
  }, [serialized]);
  React.useEffect(() => () => { current.current = undefined; }, []);
  React.useEffect(() => { report?.(uid, json.pending || busy); return () => report?.(uid, false); }, [report, uid, json.pending, busy]);
  const reset = () => {
    reflected.current = serialized;
    updateJson({ value: JSON.stringify(model, null, 2), base: model, pending: false });
    setFailure(""); setStatus("");
  };
  const readDraft = (value) => {
    const next = parseModelJson(value);
    if (next.name !== undefined && (typeof next.name !== "string" || !next.name.length)) throw new Error("name must be a non-empty string");
    for (const field of ["contextWindow", "maxTokens"]) {
      if (next[field] !== undefined && (!Number.isSafeInteger(next[field]) || next[field] <= 0)) throw new Error(`${field} must be a positive integer`);
    }
    if (next.input !== undefined && (!Array.isArray(next.input) || !next.input.length || next.input.some((value) => value !== "text" && value !== "image"))) {
      throw new Error("input must be a non-empty array of text/image values");
    }
    if (next.reasoningEfforts !== undefined && next.reasoningEfforts !== false) {
      const efforts = next.reasoningEfforts;
      if (!isRecord(efforts) || !Object.keys(efforts).some((level) => level !== "off") ||
          Object.entries(efforts).some(([level, value]) => !(typeof value === "string" && value.length > 0 || level === "off" && value === null))) {
        throw new Error("reasoningEfforts must be false or a level map with non-empty wire values (off may be null)");
      }
    }
    return next;
  };
  const edit = (value) => {
    setStatus("");
    try {
      const parsed = readDraft(value);
      const next = mergeModelJson(jsonRef.current.base, model, parsed);
      const nextSerialized = JSON.stringify(next);
      reflected.current = nextSerialized;
      // Native edits made during incomplete JSON are merged once it becomes valid.
      updateJson({ value: nextSerialized === JSON.stringify(parsed) ? value : JSON.stringify(next, null, 2), base: next, pending: false });
      setFailure("");
      if (nextSerialized !== serialized) onChange(next);
    } catch (error) {
      updateJson({ ...jsonRef.current, value, pending: true });
      setFailure(error?.code === "MODEL_JSON_CONFLICT" ? `${text("draftConflict")}: ${error.field}` : error instanceof Error ? error.message : String(error));
    }
  };
  const fetchMetadata = async () => {
    setBusy(true); setFailure(""); setStatus("");
    const started = serialized;
    try {
      const result = await loadModelsDev();
      if (result.error) throw new Error(result.stale ? `${text("stale")}: ${result.error}` : `${text("fetchFailed")}: ${result.error}`);
      const latest = current.current;
      if (!latest) return;
      if (latest.disabled || JSON.stringify(latest.model) !== started) throw new Error(text("fetchChanged", "The model changed while fetching; retry"));
      const match = findModelsDevMatch(result.data, latest.model.id);
      if (!match) throw new Error(text("notFound"));
      const fields = modelsDevFields(match.entry);
      if (!Object.keys(fields).length) throw new Error(text("noFields"));
      latest.onChange({ ...latest.model, ...fields });
      setStatus(`${text("fetchFilled")}: ${match.key}`);
    } catch (error) { if (current.current) setFailure(error instanceof Error ? error.message : String(error)); }
    finally { if (current.current) setBusy(false); }
  };
  const format = () => {
    try { edit(JSON.stringify(readDraft(jsonRef.current.value), null, 2)); }
    catch (error) { setFailure(error instanceof Error ? error.message : String(error)); }
  };
  return { model, text, uid, draft: json.value, pending: json.pending, busy, disabled, failure, status, edit, reset, format, fetchMetadata };
}

function InlineModelTools({ model, text, uid, draft, pending, busy, disabled, failure, status, edit, reset, format, fetchMetadata }) {
  return h("div", { className: "dcp-inline-tools", "data-model-id": model.id },
    h("div", { className: "dcp-tools-row" },
      h("button", { type: "button", className: "dcp-tools-button", disabled: disabled || busy || pending || !model.id, onClick: fetchMetadata }, busy ? text("fetching") : text("fetch"))),
    h("details", { className: "dcp-json-details" },
      h("summary", null, text("editJson", "Edit JSON")),
      h("div", { className: "dcp-tools-field" },
        h("label", { htmlFor: uid }, `${text("modelId")} · ${model.id}`),
        h("textarea", { id: uid, className: "dcp-tools-json", value: draft, disabled: disabled || busy, spellCheck: false,
          "aria-label": `JSON ${model.id}`, "aria-invalid": pending, "aria-describedby": failure ? `${uid}-error` : undefined, onChange: (event) => edit(event.target.value) }),
        h("div", { className: "dcp-tools-row" },
          h("button", { type: "button", className: "dcp-tools-button", disabled: disabled || busy, onClick: format }, text("format")),
          h("button", { type: "button", className: "dcp-tools-button", disabled: busy, onClick: reset }, text("resetJson", "Reset JSON"))),
        h("p", { className: "dcp-tools-note" }, text("jsonNote")))),
    failure ? h("p", { id: `${uid}-error`, className: "dcp-tools-error", role: "alert" }, failure) : null,
    status ? h("p", { className: "dcp-tools-status", role: "status" }, status) : null);
}

function TransferToolbar({ title, api, schema, t }) {
  const text = translateFactory(t);
  const [mode, setMode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [view, setView] = React.useState();
  const [directory, setDirectory] = React.useState([]);
  const [selected, setSelected] = React.useState(new Set());
  const [decisions, setDecisions] = React.useState({});
  const [bundle, setBundle] = React.useState();
  const [fileName, setFileName] = React.useState("");
  const [previewRevision, setPreviewRevision] = React.useState();
  const bundleRef = React.useRef();
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState("");
  const [status, setStatus] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true); setFailure(""); setStatus("");
    try {
      const [nextView, nextDirectory] = await Promise.all([describeNamespace(api), listDirectory(api)]);
      setView(nextView); setDirectory(nextDirectory);
      const routes = exportableProviderEntries(nextView).map(([route]) => route);
      setSelected(new Set(routes));
      if (bundleRef.current) {
        setPreviewRevision(nextView.revision);
        setDecisions(Object.fromEntries(Object.keys(bundleRef.current.providers).map((route) =>
          [route, hasAt(nextView.value, ["providers", route]) ? "skip" : "add"])));
      }
    } catch (error) { setFailure(error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  }, [api]);
  React.useEffect(() => { if (mode) load(); }, [mode, load]);

  const exportBundle = () => {
    try {
      const value = exportProviderBundle(view, [...selected]);
      const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "dsh-custom-provider.json"; anchor.click();
      URL.revokeObjectURL(url);
      setStatus(text("download", "Download JSON")); setFailure("");
    } catch (error) { setFailure(error instanceof Error ? error.message : String(error)); }
  };
  const readImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setFailure(""); setStatus("");
    try {
      const next = parseProviderBundle(await file.text());
      bundleRef.current = next; setBundle(next); setPreviewRevision(view?.revision);
      const nextDecisions = {};
      for (const route of Object.keys(next.providers)) nextDecisions[route] = hasAt(view?.value, ["providers", route]) ? "skip" : "add";
      setDecisions(nextDecisions);
    } catch (error) { bundleRef.current = undefined; setBundle(undefined); setFailure(error instanceof Error ? error.message : String(error)); }
  };
  const importSelected = async () => {
    if (!view || !bundle) { setFailure(text("noFile", "Choose a provider JSON file first")); return; }
    setBusy(true); setFailure(""); setStatus("");
    try {
      const operations = providerImportOperations(view, bundle, decisions, directory);
      if (!operations.length) { setStatus(text("noSelection", "Select at least one provider")); return; }
      const outcome = await commitOperation(api, schema, view, operations, previewRevision);
      const message = resultMessage(outcome, text);
      if (message) { setFailure(message); return; }
      if (outcome.kind === "written") {
        setView({ ...outcome.view, writable: view.writable }); setPreviewRevision(outcome.view.revision);
        setDecisions(Object.fromEntries(Object.keys(bundle.providers).map((route) => [route, "skip"])));
        setStatus(text("imported", "Configuration imported"));
      }
    } catch (error) { setFailure(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const routes = view ? exportableProviderEntries(view) : [];
  const importRoutes = bundle ? Object.entries(bundle.providers) : [];

  return h(React.Fragment, null,
    h("div", { className: "dcp-page-head" }, title,
      h("div", { className: "dcp-tools-row", "aria-label": text("transfer", "Configuration transfer") },
        h("button", { type: "button", className: "dcp-tools-button", disabled: busy, "aria-expanded": mode === "import", onClick: () => setMode((current) => current === "import" ? "" : "import") }, text("import", "Import configuration")),
        h("button", { type: "button", className: "dcp-tools-button", disabled: busy, "aria-expanded": mode === "export", onClick: () => setMode((current) => current === "export" ? "" : "export") }, text("export", "Export configuration")))),
    mode ? h("section", { className: "dcp-transfer", "aria-label": text("transfer", "Configuration transfer") },
    loading ? h("p", { className: "dcp-tools-note", role: "status" }, text("loading", "Loading model settings")) : null,
    mode ? h("p", { className: "dcp-tools-note" }, text("transferNote", "API keys and headers are excluded. Existing credential references may be reused after import.")) : null,
    mode === "export" ? h("div", { className: "dcp-transfer-list" }, routes.map(([route, profile]) => h("label", { className: "dcp-transfer-row", key: route },
      h("input", { type: "checkbox", checked: selected.has(route), onChange: (event) => setSelected((current) => {
        const next = new Set(current); if (event.target.checked) next.add(route); else next.delete(route); return next;
      }) }), h("span", { className: "dcp-transfer-name" }, route), h("span", { className: "dcp-transfer-meta" }, `${Array.isArray(profile.models) ? profile.models.length : Object.keys(profile.modelOverrides ?? {}).length} ${text("sourceModels", "Source models")}`)))) : null,
    mode === "import" ? h("div", { className: "dcp-transfer-list" },
      h("input", { className: "dcp-transfer-file", type: "file", accept: "application/json,.json", disabled: busy || loading || !view, onChange: readImport, "aria-label": text("chooseFile", "Choose JSON file") }),
      fileName ? h("p", { className: "dcp-tools-note" }, fileName) : null,
      importRoutes.map(([route, profile]) => {
        const diff = providerTransferDiff(view, route, profile, directory);
        const exists = diff.state !== "new";
        const stateKey = { new: "stateNew", user: "stateUser", inherited: "stateInherited", "user-and-inherited": "stateLayered", effective: "stateInherited" }[diff.state];
        return h("label", { className: "dcp-transfer-row", key: route },
          h("span", { className: "dcp-transfer-name" }, route,
            h("span", { className: "dcp-transfer-meta" }, `${text(stateKey, diff.state)} · ${text("sourceModels", "Source models")}: ${diff.sourceModelCount}`)),
          h("span", { className: "dcp-transfer-meta" }, `${text("targetModels", "Target models")}: ${diff.targetModelCount}`),
          h("select", { className: "dcp-tools-select dcp-transfer-select", value: decisions[route] ?? "skip", disabled: busy,
            "aria-label": `${text("import", "Import configuration")} ${route}`,
            onChange: (event) => setDecisions((current) => ({ ...current, [route]: event.target.value })) },
            h("option", { value: exists ? "replace" : "add" }, text(exists ? "replace" : "add", exists ? "Replace" : "Import")),
            h("option", { value: "skip" }, text("skip", "Skip"))));
      })) : null,
    failure ? h("p", { className: "dcp-tools-error", role: "alert" }, failure) : null,
    status ? h("p", { className: "dcp-tools-status", role: "status" }, status) : null,
    mode ? h("button", { type: "button", className: "dcp-tools-button", disabled: busy || loading, onClick: load }, text("reload", "Reload")) : null,
    mode === "export" ? h("div", { className: "dcp-transfer-actions" }, h("button", { type: "button", className: "dcp-tools-button dcp-tools-button-primary", disabled: busy || loading || !view || !selected.size, onClick: exportBundle }, text("download", "Download JSON"))) : null,
    mode === "import" ? h("div", { className: "dcp-transfer-actions" }, h("button", { type: "button", className: "dcp-tools-button dcp-tools-button-primary", disabled: busy || loading || !view?.writable || !bundle, onClick: importSelected }, busy ? text("saving", "Saving") : text("importSelected", "Import selected"))) : null) : null);
}

function apply(ctx) {
  const translate = ctx.locale.bind(LOCALE_NS);
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh: LOCALE_ZH, en: LOCALE_EN }), "dsh-custom-provider: dictionaries");
  const api = {
    settings: ctx.get("remote.settings"),
    llm: ctx.get("remote.llm")
  };
  ctx.slots.inject("settings.models.footer", () => {
    ctx.effect(() => installModelsIntegration(ctx.slots, { api, schema: ctx.settingsSchema, t: translate }), "dsh-custom-provider: official model details");
  });
  ctx.effect(() => {
    if (document.getElementById("dsh-custom-provider-styles")) return;
    const style = document.createElement("style");
    style.id = "dsh-custom-provider-styles";
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  }, "dsh-custom-provider: styles");
}
