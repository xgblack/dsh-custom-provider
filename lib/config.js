export const NAMESPACE = "llm-pi-ai";
export const COMMON_MODEL_FIELDS = ["name", "contextWindow", "maxTokens", "input", "reasoningEfforts"];
export const COMMON_PROVIDER_FIELDS = ["displayName", "baseURL", "api"];
export const PROVIDER_ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const PROVIDER_TRANSFER_FORMAT = "dsh-custom-provider/providers";
export const PROVIDER_TRANSFER_VERSION = 1;
const EXCLUDED_TRANSFER_PROVIDERS = new Set(["deepseek-account", "deepseek-official"]);
const TRANSFER_SECRET_FIELDS = new Set(["apiKey"]);

function validTransferRoute(route) {
  return typeof route === "string" && route.length > 0 && route.length <= 256 && route.trim() === route &&
    !/[\x00-\x1f\x7f]/.test(route) && route !== "__proto__";
}

export function getAt(value, path) {
  return path.reduce((current, key) => current == null ? undefined : current[key], value);
}

export function hasAt(value, path) {
  if (!path.length) return value !== undefined;
  const parent = getAt(value, path.slice(0, -1));
  return parent != null && Object.hasOwn(parent, path.at(-1));
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function derivedKeyRef(route) {
  return `${route.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
}

export function providerProfile(view, route) {
  return getAt(view.user, ["providers", route]) ?? {};
}

export function providerRemovable(view, route) {
  const path = ["providers", route];
  return hasAt(view.user, path) && !hasAt(view.base, path);
}

export function providerKind(view, route, directory) {
  const entry = directory.find((item) => item.provider === route);
  if (entry && entry.declared !== true) return "catalog";
  return hasAt(view.user, ["providers", route]) ? "custom" : "inherited";
}

export function availableCatalogProviders(directory, configured) {
  const present = new Set(configured);
  return directory.filter((entry) => entry.declared !== true && !present.has(entry.provider));
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
    const headers = source.headers;
    if (headers !== undefined) omittedHeaders.push(route);
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
  const sourceById = new Map(sourceModels.filter((model) => typeof model?.id === "string").map((model) => [model.id, model]));
  const targetById = new Map(targetModels.filter((model) => typeof model?.id === "string").map((model) => [model.id, model]));
  const addedModels = [...sourceById.keys()].filter((id) => !targetById.has(id));
  const removedModels = [...targetById.keys()].filter((id) => !sourceById.has(id));
  const changedModels = [...sourceById.keys()].filter((id) => targetById.has(id) && !sameValue(sourceById.get(id), targetById.get(id)));
  return {
    state: providerTransferState(view, route),
    changedFields,
    sourceModelCount: sourceModels.length,
    targetModelCount: targetModels.length,
    addedModels,
    removedModels,
    changedModels,
    targetHasHeaders: hasAt(view?.value, ["providers", route, "headers"]),
    targetHasCredentialReference: typeof target.apiKeyEnv === "string" && target.apiKeyEnv.length > 0,
    credentialReferenceChanged: !sameValue(target.apiKeyEnv, imported.apiKeyEnv)
  };
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

export function validateProviderRoute(route, view, reserved = []) {
  if (!PROVIDER_ROUTE_PATTERN.test(route)) throw new Error("Provider ID must start with a lowercase letter and contain only lowercase letters, digits and hyphens");
  if (reserved.includes(route) || hasAt(view.value, ["providers", route])) throw new Error(`Provider ${route} already exists`);
}

export function createProviderOperation(view, route, profile, reserved = []) {
  validateProviderRoute(route, view, reserved);
  if (!isRecord(profile)) throw new Error("Provider JSON must be an object");
  return { op: "set", path: ["providers", route], value: { ...profile } };
}

export function replaceProviderOperation(view, route, profile, preservedKeys = ["headers"]) {
  if (!hasAt(view.value, ["providers", route])) throw new Error(`Provider ${route} does not exist`);
  if (!isRecord(profile)) throw new Error("Provider JSON must be an object");
  const previous = providerProfile(view, route);
  const keys = new Set([...Object.keys(previous), ...Object.keys(profile)]);
  return [...keys].filter((key) => !preservedKeys.includes(key))
    .filter((key) => key !== "apiKeyEnv" || profile.apiKeyEnv !== undefined || previous.apiKeyEnv !== undefined)
    .filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(profile[key]))
    .map((key) => profile[key] === undefined
      ? { op: "unset", path: ["providers", route, key] }
      : { op: "set", path: ["providers", route, key], value: profile[key] });
}

export function patchProviderOperation(view, route, changes) {
  if (!hasAt(view.value, ["providers", route])) throw new Error(`Provider ${route} does not exist`);
  return Object.entries(changes).map(([key, value]) => {
    if (!COMMON_PROVIDER_FIELDS.includes(key)) throw new Error(`Unsupported common provider field: ${key}`);
    return value === undefined
      ? { op: "unset", path: ["providers", route, key] }
      : { op: "set", path: ["providers", route, key], value };
  }).filter((op) => JSON.stringify(getAt(view.user, op.path)) !== JSON.stringify(op.value));
}

export function removeProviderOperation(view, route) {
  if (!providerRemovable(view, route)) throw new Error("Inherited providers cannot be removed");
  return { op: "unset", path: ["providers", route] };
}

export function addModelOperation(view, route, model) {
  if (!isRecord(model) || typeof model.id !== "string" || !model.id.trim()) throw new Error("Model ID is required");
  if (modelMode(view, route) !== "listed") throw new Error("Only an explicit user model list can be extended");
  const path = ["providers", route, "models"];
  const models = getAt(view.user, path);
  if (models.some((entry) => entry.id === model.id)) throw new Error(`Model ${model.id} already exists`);
  return { op: "set", path, value: [...models, { ...model }] };
}

export function removeModelOperation(view, route, modelId) {
  if (modelMode(view, route) !== "listed") throw new Error("Only an explicit user model list can be edited");
  const path = ["providers", route, "models"];
  const models = getAt(view.user, path);
  if (!models.some((entry) => entry.id === modelId)) throw new Error(`Model ${modelId} does not exist`);
  const remaining = models.filter((entry) => entry.id !== modelId);
  if (!remaining.length) throw new Error("At least one model must remain configured");
  return { op: "set", path, value: remaining };
}

function editObject(value, path, next, restore) {
  const [head, ...tail] = path;
  const result = { ...(isRecord(value) ? value : {}) };
  if (!tail.length) {
    if (restore) delete result[head];
    else result[head] = next;
  } else {
    result[head] = editObject(result[head], tail, next, restore);
    if (restore && Object.keys(result[head]).length === 0) delete result[head];
  }
  return result;
}

export function modelMode(view, route, directory = []) {
  const path = ["providers", route, "models"];
  const userModels = getAt(view.user, path);
  if (Array.isArray(userModels)) return "listed";
  const userOverrides = getAt(view.user, ["providers", route, "modelOverrides"]);
  const entry = directory.find((item) => item.provider === route);
  if (entry?.declared === true && isRecord(userOverrides)) return "declared";
  if (Array.isArray(getAt(view.base, path)) && getAt(view.base, path).length) return "inherited";
  if (entry?.declared === true) return "declared";
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
    const model = findModel(getAt(view.value, [...prefix, "models"]), modelId) ??
      { id: modelId, ...(getAt(view.value, [...prefix, "modelOverrides", modelId]) ?? {}) };
    const override = getAt(view.value, [...prefix, "modelOverrides", modelId]);
    return { ...model, ...(isRecord(override) ? override : {}) };
  }
  const override = getAt(view.user, [...prefix, "modelOverrides", modelId]);
  return { id: modelId, ...(isRecord(override) ? override : {}) };
}

export function effectiveModel(view, route, modelId, catalogModel, directory = []) {
  const prefix = ["providers", route];
  const mode = modelMode(view, route, directory);
  if (mode === "listed" || mode === "inherited") {
    return findModel(getAt(view.value, [...prefix, "models"]), modelId);
  }
  if (mode === "declared") {
    const model = findModel(getAt(view.value, [...prefix, "models"]), modelId);
    const override = getAt(view.value, [...prefix, "modelOverrides", modelId]);
    return { id: modelId, ...(model ?? {}), ...(isRecord(override) ? override : {}) };
  }
  const profile = getAt(view.value, prefix);
  const override = getAt(profile, ["modelOverrides", modelId]);
  const catalog = catalogModel ? {
    id: catalogModel.id,
    ...(catalogModel.name === undefined ? {} : { name: catalogModel.name }),
    ...(catalogModel.contextWindow === undefined ? {} : { contextWindow: catalogModel.contextWindow }),
    ...(catalogModel.maxTokens === undefined ? {} : { maxTokens: catalogModel.maxTokens }),
    ...(catalogModel.inputModalities === undefined ? {} : { input: [...catalogModel.inputModalities] })
  } : { id: modelId };
  const input = catalog.input ?? profile?.defaultInput;
  return {
    ...(profile?.defaultContextWindow === undefined ? {} : { contextWindow: profile.defaultContextWindow }),
    ...(profile?.defaultMaxTokens === undefined ? {} : { maxTokens: profile.defaultMaxTokens }),
    ...(input === undefined ? {} : { input }),
    ...catalog,
    ...(isRecord(override) ? override : {}),
    id: modelId
  };
}

export function modelEntries(view, route, discovered = [], directory = []) {
  const prefix = ["providers", route];
  const mode = modelMode(view, route, directory);
  const profile = getAt(view.value, prefix);
  if (mode === "listed" || mode === "inherited") {
    return (Array.isArray(profile?.models) ? profile.models : []).map((model) => ({ ...model }));
  }
  if (mode === "declared") {
    const ids = [];
    for (const model of Array.isArray(profile?.models) ? profile.models : []) {
      if (model?.id && !ids.includes(model.id)) ids.push(model.id);
    }
    for (const id of Object.keys(profile?.modelOverrides ?? {})) if (!ids.includes(id)) ids.push(id);
    for (const model of discovered) if (model?.id && !ids.includes(model.id)) ids.push(model.id);
    return ids.map((id) => effectiveModel(view, route, id, discovered.find((model) => model.id === id), directory));
  }
  const ids = [];
  for (const model of discovered) if (model?.id && !ids.includes(model.id)) ids.push(model.id);
  for (const id of Object.keys(profile?.modelOverrides ?? {})) if (!ids.includes(id)) ids.push(id);
  return ids.map((id) => effectiveModel(view, route, id, discovered.find((model) => model.id === id), directory));
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
  if (Object.keys(override).length === 0) {
    return hasAt(view.user, path) ? { op: "unset", path } : undefined;
  }
  return { op: "set", path, value: override };
}

export function patchModelOperation(view, route, modelId, changes, directory = []) {
  const next = editableModel(view, route, modelId, directory);
  for (const [key, value] of Object.entries(changes)) {
    if (!COMMON_MODEL_FIELDS.includes(key)) throw new Error(`Unsupported common model field: ${key}`);
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return replaceModelOperation(view, route, modelId, next, directory);
}

export function parseModelJson(text, modelId) {
  let value;
  try { value = JSON.parse(text); }
  catch (error) { throw new Error(`Invalid JSON: ${error.message}`); }
  if (!isRecord(value)) throw new Error("Model JSON must be an object");
  if (value.id !== modelId) throw new Error(`Model id must remain ${modelId}`);
  return value;
}

export function mergeLayers(base, user) {
  if (user === undefined) return base;
  if (!isRecord(base) || !isRecord(user)) return user;
  const merged = { ...base };
  for (const [key, value] of Object.entries(user)) merged[key] = mergeLayers(base[key], value);
  return merged;
}

export function candidate(view, operation) {
  const operations = Array.isArray(operation) ? operation : operation ? [operation] : [];
  let user = view.user ?? {};
  for (const op of operations) user = editObject(user, op.path, op.value, op.op === "unset");
  return mergeLayers(view.base ?? {}, user);
}

export async function commitOperation(api, schema, view, operation, expectedRevision = view.revision) {
  if (!operation) return { kind: "unchanged", view };
  const operations = Array.isArray(operation) ? operation : [operation];
  if (!operations.length) return { kind: "unchanged", view };
  if (expectedRevision !== view.revision) return { kind: "conflict", message: "Settings changed since editing began" };
  let invalid;
  try {
    const root = schema.rehydrate(view.schema);
    invalid = schema.validate(root, candidate(view, operation));
  } catch (error) {
    return { kind: "invalid", message: error.message };
  }
  if (invalid) return { kind: "invalid", message: typeof invalid === "string" ? invalid : JSON.stringify(invalid) };
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
