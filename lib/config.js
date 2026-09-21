export const NAMESPACE = "llm-pi-ai";
export const ROUTE_EXCLUDED = new Set(["api", "baseURL", "apiKeyEnv", "displayName", "models", "modelOverrides"]);
export const MODEL_EXCLUDED = new Set(["id", "name", "contextWindow", "maxTokens", "input"]);

export function getAt(value, path) {
  return path.reduce((current, key) => current == null ? undefined : current[key], value);
}

export function hasAt(value, path) {
  if (!path.length) return value !== undefined;
  const parent = getAt(value, path.slice(0, -1));
  return parent != null && Object.hasOwn(parent, path.at(-1));
}

function editObject(value, path, next, restore) {
  const [head, ...tail] = path;
  const result = { ...(value && typeof value === "object" && !Array.isArray(value) ? value : {}) };
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

export function editOperation(view, route, modelId, fieldPath, value, restore = false) {
  const prefix = ["providers", route];
  if (!fieldPath.length || fieldPath.some((part) => typeof part !== "string" || !part)) {
    throw new Error("A non-empty field path is required");
  }
  if (modelId === undefined) {
    const path = [...prefix, ...fieldPath];
    if (restore) return hasAt(view.user, path) ? { op: "unset", path } : undefined;
    return { op: "set", path, value };
  }
  const mode = modelMode(view, route);
  if (mode === "inherited") throw new Error("The inherited model list cannot be edited without replacing the whole list");
  if (mode === "listed") {
    const path = [...prefix, "models"];
    const models = getAt(view.user, path);
    const index = models.findIndex((model) => model.id === modelId);
    if (index < 0) throw new Error(`Model ${modelId} is not in the configured list`);
    if (restore && !hasAt(models[index], fieldPath)) return undefined;
    const updated = models.map((model, i) => i === index ? editObject(model, fieldPath, value, restore) : model);
    return { op: "set", path, value: updated };
  }
  const path = [...prefix, "modelOverrides", modelId, ...fieldPath];
  if (restore) return hasAt(view.user, path) ? { op: "unset", path } : undefined;
  return { op: "set", path, value };
}

export function fieldState(view, route, modelId, fieldPath) {
  const prefix = ["providers", route];
  if (modelId === undefined) {
    const path = [...prefix, ...fieldPath];
    return { value: getAt(view.value, path), overridden: hasAt(view.user, path) };
  }
  const mode = modelMode(view, route);
  if (mode === "listed" || mode === "inherited") {
    const models = getAt(view.value, [...prefix, "models"]) ?? [];
    const userModels = getAt(view.user, [...prefix, "models"]) ?? [];
    return {
      value: getAt(models.find((model) => model.id === modelId), fieldPath),
      overridden: hasAt(userModels.find((model) => model.id === modelId), fieldPath),
      readOnly: mode === "inherited"
    };
  }
  const path = [...prefix, "modelOverrides", modelId, ...fieldPath];
  return { value: getAt(view.value, path), overridden: hasAt(view.user, path) };
}

export function mergeLayers(base, user) {
  if (user === undefined) return base;
  if (base === null || user === null || typeof base !== "object" || typeof user !== "object" || Array.isArray(base) || Array.isArray(user)) return user;
  const merged = { ...base };
  for (const [key, value] of Object.entries(user)) merged[key] = mergeLayers(base[key], value);
  return merged;
}

export function candidate(view, op) {
  if (!op) return mergeLayers(view.base ?? {}, view.user ?? {});
  const path = op.path;
  const user = editObject(view.user ?? {}, path, op.value, op.op === "unset");
  return mergeLayers(view.base ?? {}, user);
}

export function matchModelsDev(data, route, modelId) {
  if (!data || typeof data !== "object" || !modelId) return undefined;
  const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, "");
  const id = normalize(modelId);
  const full = normalize(`${route}/${modelId}`);
  const entries = Object.entries(data);
  const exact = entries.find(([key]) => normalize(key) === full);
  if (exact) return { key: exact[0], value: exact[1] };
  const sameId = entries.filter(([key]) => normalize(key).split("/").at(-1) === id);
  return sameId.length === 1 ? { key: sameId[0][0], value: sameId[0][1] } : undefined;
}
