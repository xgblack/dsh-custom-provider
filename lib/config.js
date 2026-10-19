export const NAMESPACE = "llm-pi-ai";
export const PROVIDER_TRANSFER_FORMAT = "dsh-custom-provider/providers";
export const PROVIDER_TRANSFER_VERSION = 1;
const EXCLUDED_TRANSFER_PROVIDERS = new Set(["deepseek-account", "deepseek-official"]);
const TRANSFER_SECRET_FIELDS = new Set(["apiKey"]);

function validTransferRoute(route) {
  return typeof route === "string" && route.length > 0 && route.length <= 256 && route.trim() === route &&
    !/[\x00-\x1f\x7f]/.test(route) && route !== "__proto__";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function getAt(value, path) {
  return path.reduce((current, key) => current == null ? undefined : current[key], value);
}

export function hasAt(value, path) {
  if (!path.length) return value !== undefined;
  const parent = getAt(value, path.slice(0, -1));
  return parent != null && Object.hasOwn(parent, path.at(-1));
}

export function exportableProviderEntries(view) {
  const profiles = getAt(view?.value, ["providers"]);
  return isRecord(profiles) ? Object.entries(profiles).filter(([route, profile]) =>
    validTransferRoute(route) && !EXCLUDED_TRANSFER_PROVIDERS.has(route) && isRecord(profile)) : [];
}

export function exportProviderBundle(view, routes) {
  const profiles = getAt(view?.value, ["providers"]) ?? {};
  if (!Array.isArray(routes) || !routes.length) throw new Error("Select at least one configured provider");
  const providers = {};
  const omittedHeaders = [];
  for (const route of routes) {
    if (!validTransferRoute(route) || EXCLUDED_TRANSFER_PROVIDERS.has(route)) {
      throw new Error(`Provider ${route} is not exportable`);
    }
    if (!isRecord(profiles) || !Object.hasOwn(profiles, route) || !isRecord(profiles[route])) {
      throw new Error(`Provider ${route} has no exportable configuration`);
    }
    if (Object.hasOwn(providers, route)) throw new Error(`Provider ${route} was selected more than once`);
    const source = profiles[route];
    const profile = Object.fromEntries(Object.entries(source)
      .filter(([key]) => key !== "headers" && !TRANSFER_SECRET_FIELDS.has(key)));
    if (source.headers !== undefined) omittedHeaders.push(route);
    providers[route] = profile;
  }
  return { format: PROVIDER_TRANSFER_FORMAT, version: PROVIDER_TRANSFER_VERSION, providers, omittedHeaders };
}

export function parseProviderBundle(text) {
  let bundle;
  try { bundle = JSON.parse(text); }
  catch (error) { throw new Error(`Invalid JSON: ${error.message}`); }
  if (!isRecord(bundle) || bundle.format !== PROVIDER_TRANSFER_FORMAT || bundle.version !== PROVIDER_TRANSFER_VERSION ||
    !isRecord(bundle.providers) || !Object.keys(bundle.providers).length || !Array.isArray(bundle.omittedHeaders)) {
    throw new Error("Unsupported provider export format or version");
  }
  for (const [route, profile] of Object.entries(bundle.providers)) {
    if (!validTransferRoute(route) || EXCLUDED_TRANSFER_PROVIDERS.has(route) || !isRecord(profile) ||
      Object.hasOwn(profile, "headers") || [...TRANSFER_SECRET_FIELDS].some((key) => Object.hasOwn(profile, key))) {
      throw new Error(`Provider ${route} has an invalid ID, profile, or embedded headers`);
    }
  }
  if (bundle.omittedHeaders.some((route) => typeof route !== "string" || !Object.hasOwn(bundle.providers, route)) ||
    new Set(bundle.omittedHeaders).size !== bundle.omittedHeaders.length) {
    throw new Error("Invalid omittedHeaders list");
  }
  return bundle;
}

function declaredProviderProfile(view, route, profile) {
  if (!isRecord(profile)) return profile;
  const overrides = isRecord(profile.modelOverrides) ? profile.modelOverrides : {};
  if (!Object.keys(overrides).length) return profile;
  const existing = getAt(view.value, ["providers", route, "models"]);
  const models = Array.isArray(profile.models) ? profile.models.map((model) => ({ ...model })) :
    Array.isArray(existing) ? existing.map((model) => ({ ...model })) : [];
  for (const [id, override] of Object.entries(overrides)) {
    const index = models.findIndex((model) => model?.id === id);
    const next = { id, ...(isRecord(override) ? override : {}) };
    if (index < 0) models.push(next);
    else models[index] = { ...models[index], ...next };
  }
  const { modelOverrides, ...rest } = profile;
  return { ...rest, models };
}

export function providerTransferProfile(view, route, profile, directory = []) {
  const entry = directory.find((item) => item.provider === route);
  return entry?.declared === true ? declaredProviderProfile(view, route, profile) : profile;
}

export function providerTransferState(view, route) {
  const user = hasAt(view?.user, ["providers", route]);
  const base = hasAt(view?.base, ["providers", route]);
  if (!hasAt(view?.value, ["providers", route])) return "new";
  if (user && base) return "user-and-inherited";
  if (user) return "user";
  if (base) return "inherited";
  return "effective";
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function transferModelEntries(profile) {
  const entries = new Map(Array.isArray(profile?.models)
    ? profile.models.filter((model) => typeof model?.id === "string").map((model) => [model.id, model])
    : []);
  if (isRecord(profile?.modelOverrides)) {
    for (const [id, override] of Object.entries(profile.modelOverrides)) {
      entries.set(id, { id, ...(entries.get(id) ?? {}), ...(isRecord(override) ? override : {}) });
    }
  }
  return [...entries.values()];
}

export function providerTransferDiff(view, route, profile, directory = []) {
  const imported = providerTransferProfile(view, route, profile, directory);
  const target = getAt(view?.value, ["providers", route]) ?? {};
  const keys = new Set([...Object.keys(target), ...Object.keys(imported)]);
  const changedFields = [...keys].filter((key) => key !== "headers" && !sameValue(target[key], imported[key]));
  const sourceModels = transferModelEntries(imported);
  const targetModels = transferModelEntries(target);
  const sourceById = new Map(sourceModels.map((model) => [model.id, model]));
  const targetById = new Map(targetModels.map((model) => [model.id, model]));
  return {
    state: providerTransferState(view, route),
    changedFields,
    sourceModelCount: sourceModels.length,
    targetModelCount: targetModels.length,
    addedModels: [...sourceById.keys()].filter((id) => !targetById.has(id)),
    removedModels: [...targetById.keys()].filter((id) => !sourceById.has(id)),
    changedModels: [...sourceById.keys()].filter((id) => targetById.has(id) && !sameValue(sourceById.get(id), targetById.get(id))),
    targetHasHeaders: hasAt(view?.value, ["providers", route, "headers"]),
    targetHasCredentialReference: typeof target.apiKeyEnv === "string" && target.apiKeyEnv.length > 0,
    credentialReferenceChanged: !sameValue(target.apiKeyEnv, imported.apiKeyEnv)
  };
}

function replaceProviderOperation(view, route, profile, preservedKeys = ["headers"]) {
  if (!hasAt(view.value, ["providers", route])) throw new Error(`Provider ${route} does not exist`);
  if (!isRecord(profile)) throw new Error("Provider JSON must be an object");
  const previous = getAt(view.value, ["providers", route]) ?? {};
  const keys = new Set([...Object.keys(previous), ...Object.keys(profile)]);
  return [...keys].filter((key) => !preservedKeys.includes(key))
    .filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(profile[key]))
    .map((key) => profile[key] === undefined
      ? { op: "unset", path: ["providers", route, key] }
      : { op: "set", path: ["providers", route, key], value: profile[key] });
}

export function providerImportOperations(view, bundle, decisions, directory = []) {
  const operations = [];
  for (const [route, profile] of Object.entries(bundle.providers)) {
    if (EXCLUDED_TRANSFER_PROVIDERS.has(route) || !isRecord(profile) || Object.hasOwn(profile, "headers") ||
      [...TRANSFER_SECRET_FIELDS].some((key) => Object.hasOwn(profile, key))) {
      throw new Error(`Provider ${route} is not importable`);
    }
    const decision = Object.hasOwn(decisions, route) ? decisions[route] : "skip";
    if (decision === "skip") continue;
    const exists = hasAt(view.value, ["providers", route]);
    if (decision !== (exists ? "replace" : "add")) throw new Error(`Provider ${route} changed since preview`);
    const imported = providerTransferProfile(view, route, profile, directory);
    if (decision === "add") operations.push({ op: "set", path: ["providers", route], value: imported });
    else operations.push(...replaceProviderOperation(view, route, imported, ["headers"]));
  }
  return operations;
}

export function modelMode(view, route, directory = []) {
  const path = ["providers", route, "models"];
  if (Array.isArray(getAt(view.user, path))) return "listed";
  const entry = directory.find((item) => item.provider === route);
  if (entry?.declared === true) return "declared";
  if (Array.isArray(getAt(view.base, path)) && getAt(view.base, path).length) return "inherited";
  return "catalog";
}

function findModel(models, modelId) {
  return Array.isArray(models) ? models.find((model) => model?.id === modelId) : undefined;
}

export function editableModel(view, route, modelId, directory = []) {
  const prefix = ["providers", route];
  const mode = modelMode(view, route, directory);
  if (mode === "listed") {
    const model = findModel(getAt(view.user, [...prefix, "models"]), modelId);
    if (!model) throw new Error(`Model ${modelId} is not in the configured list`);
    return { ...model };
  }
  if (mode === "inherited") {
    const model = findModel(getAt(view.value, [...prefix, "models"]), modelId);
    if (!model) throw new Error(`Model ${modelId} is not in the inherited list`);
    return { ...model };
  }
  if (mode === "declared") {
    const model = findModel(getAt(view.value, [...prefix, "models"]), modelId) ?? { id: modelId };
    const override = getAt(view.value, [...prefix, "modelOverrides", modelId]);
    return { ...model, ...(isRecord(override) ? override : {}) };
  }
  const override = getAt(view.user, [...prefix, "modelOverrides", modelId]);
  return { id: modelId, ...(isRecord(override) ? override : {}) };
}

export function modelEntries(view, route, directory = []) {
  const prefix = ["providers", route];
  const profile = getAt(view.value, prefix) ?? {};
  const mode = modelMode(view, route, directory);
  if (mode === "listed" || mode === "inherited" || mode === "declared") {
    const ids = [];
    for (const model of Array.isArray(profile.models) ? profile.models : []) {
      if (typeof model?.id === "string" && !ids.includes(model.id)) ids.push(model.id);
    }
    for (const id of Object.keys(profile.modelOverrides ?? {})) if (!ids.includes(id)) ids.push(id);
    return ids.map((id) => editableModel(view, route, id, directory));
  }
  return Object.keys(profile.modelOverrides ?? {}).map((id) => editableModel(view, route, id, directory));
}

export function replaceModelOperation(view, route, modelId, nextModel, directory = []) {
  if (!isRecord(nextModel)) throw new Error("Model JSON must be an object");
  if (nextModel.id !== modelId) throw new Error(`Model id must remain ${modelId}`);
  const prefix = ["providers", route];
  const mode = modelMode(view, route, directory);
  if (mode === "inherited") throw new Error("The inherited model list cannot be edited without replacing the whole list");
  if (mode === "listed") {
    const path = [...prefix, "models"];
    const models = getAt(view.user, path);
    const index = models.findIndex((model) => model.id === modelId);
    if (index < 0) throw new Error(`Model ${modelId} is not in the configured list`);
    return { op: "set", path, value: models.map((model, at) => at === index ? { ...nextModel } : model) };
  }
  if (mode === "declared") {
    const profile = getAt(view.value, prefix) ?? {};
    const models = Array.isArray(profile.models) ? profile.models.map((model) => ({ ...model,
      ...(isRecord(profile.modelOverrides?.[model.id]) ? profile.modelOverrides[model.id] : {})
    })) : [];
    for (const [id, override] of Object.entries(profile.modelOverrides ?? {})) {
      if (!models.some((model) => model.id === id)) models.push({ id, ...(isRecord(override) ? override : {}) });
    }
    const index = models.findIndex((model) => model.id === modelId);
    if (index < 0) models.push({ ...nextModel });
    else models[index] = { ...nextModel };
    const operations = [{ op: "set", path: [...prefix, "models"], value: models }];
    if (hasAt(view.user, [...prefix, "modelOverrides"])) operations.push({ op: "unset", path: [...prefix, "modelOverrides"] });
    return operations;
  }
  const path = [...prefix, "modelOverrides", modelId];
  const override = Object.fromEntries(Object.entries(nextModel).filter(([key]) => key !== "id"));
  if (Object.keys(override).length === 0) return hasAt(view.user, path) ? { op: "unset", path } : undefined;
  return { op: "set", path, value: override };
}

export function parseModelJson(text, modelId) {
  let value;
  try { value = JSON.parse(text); }
  catch (error) { throw new Error(`Invalid JSON: ${error.message}`); }
  if (!isRecord(value)) throw new Error("Model JSON must be an object");
  if (typeof value.id !== "string" || !value.id.trim()) throw new Error("Model id must be a non-empty string");
  if (modelId !== undefined && value.id !== modelId) throw new Error(`Model id must remain ${modelId}`);
  return value;
}

/** Merge a resumed JSON edit with native edits made while its text was incomplete. */
export function mergeModelJson(base, current, edited) {
  const merge = (before, form, json, path) => {
    if (sameValue(json, before)) return form;
    if (sameValue(form, before) || sameValue(form, json)) return json;
    if (isRecord(before) && isRecord(form) && isRecord(json)) {
      const keys = new Set([...Object.keys(form), ...Object.keys(json), ...Object.keys(before)]);
      return Object.fromEntries([...keys].flatMap((key) => {
        const own = (object) => Object.hasOwn(object, key) ? object[key] : undefined;
        const value = merge(own(before), own(form), own(json), [...path, key]);
        return value === undefined ? [] : [[key, value]];
      }));
    }
    const error = new Error(`Conflicting model field: ${path.join(".")}`);
    error.code = "MODEL_JSON_CONFLICT";
    error.field = path.join(".");
    throw error;
  };
  return merge(base, current, edited, []);
}

function editObject(value, path, next, restore) {
  const [head, ...tail] = path;
  const result = { ...(isRecord(value) ? value : {}) };
  if (!tail.length) {
    if (restore) delete result[head];
    else result[head] = next;
  } else {
    result[head] = editObject(result[head], tail, next, restore);
    if (restore && isRecord(result[head]) && Object.keys(result[head]).length === 0) delete result[head];
  }
  return result;
}

export function candidate(view, operation) {
  const operations = Array.isArray(operation) ? operation : operation ? [operation] : [];
  let value = view.value ?? {};
  for (const op of operations) {
    const inherited = op.op === "unset" ? getAt(view.base, op.path) : undefined;
    value = editObject(value, op.path, inherited === undefined ? op.value : inherited, op.op === "unset" && inherited === undefined);
  }
  return value;
}

export async function commitOperation(api, schema, view, operation, expectedRevision = view.revision) {
  if (!operation) return { kind: "unchanged", view };
  const operations = Array.isArray(operation) ? operation : [operation];
  if (!operations.length) return { kind: "unchanged", view };
  if (expectedRevision !== view.revision) return { kind: "conflict", message: "Settings changed since editing began" };
  try {
    const root = schema.rehydrate(view.schema);
    const invalid = schema.validate(root, candidate(view, operation));
    if (invalid) return { kind: "invalid", message: typeof invalid === "string" ? invalid : JSON.stringify(invalid) };
  } catch (error) {
    return { kind: "invalid", message: error.message };
  }
  try {
    const response = await api.settings.mutate(NAMESPACE, operations, expectedRevision);
    if (response.ok) return { kind: "written", view: response.value };
    return response.error.code === "settings/conflict"
      ? { kind: "conflict", message: response.error.message }
      : { kind: "rejected", message: response.error.message };
  } catch (error) {
    return { kind: "rejected", message: error.message };
  }
}
