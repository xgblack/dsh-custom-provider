export const NAMESPACE = "llm-pi-ai";
export const COMMON_MODEL_FIELDS = ["name", "contextWindow", "maxTokens", "input", "reasoningEfforts"];
export const COMMON_PROVIDER_FIELDS = ["displayName", "baseURL", "api"];
export const PROVIDER_ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

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
  return providerRemovable(view, route) ? "custom" : "inherited";
}

export function availableCatalogProviders(directory, configured) {
  const present = new Set(configured);
  return directory.filter((entry) => entry.declared !== true && !present.has(entry.provider));
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

export function replaceProviderOperation(view, route, profile) {
  if (!hasAt(view.value, ["providers", route])) throw new Error(`Provider ${route} does not exist`);
  if (!isRecord(profile)) throw new Error("Provider JSON must be an object");
  const previous = providerProfile(view, route);
  const keys = new Set([...Object.keys(previous), ...Object.keys(profile)]);
  return [...keys].filter((key) => key !== "apiKeyEnv" || profile.apiKeyEnv !== undefined || previous.apiKeyEnv !== undefined)
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
  if (models.length === 1) throw new Error("The last model cannot be removed; edit the provider model list explicitly instead");
  return { op: "set", path, value: models.filter((entry) => entry.id !== modelId) };
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

export function modelMode(view, route) {
  const path = ["providers", route, "models"];
  const userModels = getAt(view.user, path);
  if (Array.isArray(userModels)) return userModels.length ? "listed" : "catalog";
  if (Array.isArray(getAt(view.base, path)) && getAt(view.base, path).length) return "inherited";
  return "catalog";
}

function findModel(models, modelId) {
  return Array.isArray(models) ? models.find((model) => model?.id === modelId) : undefined;
}

export function editableModel(view, route, modelId) {
  const prefix = ["providers", route];
  const mode = modelMode(view, route);
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
  const override = getAt(view.user, [...prefix, "modelOverrides", modelId]);
  return { id: modelId, ...(isRecord(override) ? override : {}) };
}

export function effectiveModel(view, route, modelId, catalogModel) {
  const prefix = ["providers", route];
  const mode = modelMode(view, route);
  if (mode === "listed" || mode === "inherited") {
    return findModel(getAt(view.value, [...prefix, "models"]), modelId);
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

export function modelEntries(view, route, discovered = []) {
  const prefix = ["providers", route];
  const mode = modelMode(view, route);
  const profile = getAt(view.value, prefix);
  if (mode === "listed" || mode === "inherited") {
    return (Array.isArray(profile?.models) ? profile.models : []).map((model) => ({ ...model }));
  }
  const ids = [];
  for (const model of discovered) if (model?.id && !ids.includes(model.id)) ids.push(model.id);
  for (const id of Object.keys(profile?.modelOverrides ?? {})) if (!ids.includes(id)) ids.push(id);
  return ids.map((id) => effectiveModel(view, route, id, discovered.find((model) => model.id === id)));
}

export function replaceModelOperation(view, route, modelId, nextModel) {
  if (!isRecord(nextModel)) throw new Error("Model JSON must be an object");
  if (nextModel.id !== modelId) throw new Error(`Model id must remain ${modelId}`);
  const prefix = ["providers", route];
  const mode = modelMode(view, route);
  if (mode === "inherited") throw new Error("The inherited model list cannot be edited without replacing the whole list");
  if (mode === "listed") {
    const path = [...prefix, "models"];
    const models = getAt(view.user, path);
    const index = models.findIndex((model) => model.id === modelId);
    if (index < 0) throw new Error(`Model ${modelId} is not in the configured list`);
    return { op: "set", path, value: models.map((model, at) => at === index ? { ...nextModel } : model) };
  }
  const path = [...prefix, "modelOverrides", modelId];
  const override = Object.fromEntries(Object.entries(nextModel).filter(([key]) => key !== "id"));
  if (Object.keys(override).length === 0) {
    return hasAt(view.user, path) ? { op: "unset", path } : undefined;
  }
  return { op: "set", path, value: override };
}

export function patchModelOperation(view, route, modelId, changes) {
  const next = editableModel(view, route, modelId);
  for (const [key, value] of Object.entries(changes)) {
    if (!COMMON_MODEL_FIELDS.includes(key)) throw new Error(`Unsupported common model field: ${key}`);
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return replaceModelOperation(view, route, modelId, next);
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
