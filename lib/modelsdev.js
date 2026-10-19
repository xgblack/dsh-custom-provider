// Optional model metadata imported only by an explicit user action.
const MODELS_DEV_URL = "https://models.dev/models.json";
const MODELS_DEV_TTL_MS = 6 * 60 * 60 * 1000;
const MODELS_DEV_TIMEOUT_MS = 10 * 1000;

function isModelsDevRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizedId(id) {
  return id.trim().toLowerCase().replace(/\s+/g, "");
}

export function officialProviderOf(id) {
  const bare = id.split("/").at(-1).toLowerCase();
  if (bare.startsWith("deepseek-")) return "deepseek";
  if (/^(?:gpt-|o[1-9](?:-|$))/.test(bare)) return "openai";
  if (bare.startsWith("claude-")) return "anthropic";
  if (bare.startsWith("gemini-")) return "google";
  if (bare.startsWith("grok-")) return "xai";
  return undefined;
}

export function findModelsDevMatch(catalog, id) {
  if (!isModelsDevRecord(catalog) || typeof id !== "string" || !id.trim()) return undefined;
  // Keep the original identity ahead of any namespace or variant inference.
  if (Object.hasOwn(catalog, id) && isModelsDevRecord(catalog[id])) return { key: id, entry: catalog[id] };
  const bare = id.split("/").at(-1);
  const official = officialProviderOf(id);
  if (official) {
    const officialKey = normalizedId(`${official}/${bare}`);
    for (const [key, entry] of Object.entries(catalog)) {
      if (normalizedId(key) === officialKey && isModelsDevRecord(entry)) return { key, entry };
    }
  }
  const normalized = normalizedId(id);
  const normalizedBare = normalizedId(bare);
  // If multiple non-official providers advertise the same bare id, use the first entry.
  for (const [key, entry] of Object.entries(catalog)) {
    if (!isModelsDevRecord(entry)) continue;
    const keyId = normalizedId(key);
    if (keyId === normalized || keyId.split("/").at(-1) === normalizedBare) return { key, entry };
  }
  return undefined;
}

export function matchModelsDev(catalog, id) {
  return findModelsDevMatch(catalog, id)?.entry;
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export function modelsDevFields(metadata) {
  if (!isModelsDevRecord(metadata)) return {};
  const fields = {};
  if (typeof metadata.name === "string" && metadata.name.trim()) fields.name = metadata.name.trim();
  if (positiveInteger(metadata.limit?.context)) fields.contextWindow = metadata.limit.context;
  if (positiveInteger(metadata.limit?.output)) fields.maxTokens = metadata.limit.output;
  if (Array.isArray(metadata.modalities?.input)) {
    const input = ["text", "image"].filter((type) => metadata.modalities.input.includes(type));
    if (input.length) fields.input = input;
  }
  // A reasoning boolean does not specify the request-wire values of reasoningEfforts.
  return fields;
}

export function createModelsDevLoader(fetcher = (...args) => fetch(...args), clock = () => Date.now(), ttlMs = MODELS_DEV_TTL_MS) {
  let snapshot;
  let pending;
  return async () => {
    if (snapshot && clock() - snapshot.at < ttlMs) return { data: snapshot.data };
    if (pending) return pending;
    pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), MODELS_DEV_TIMEOUT_MS);
      try {
        const response = await fetcher(MODELS_DEV_URL, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!isModelsDevRecord(data)) throw new Error("Invalid models.dev catalog");
        snapshot = { at: clock(), data };
        return { data };
      } catch (error) {
        return { data: snapshot?.data, error: error instanceof Error ? error.message : String(error), stale: Boolean(snapshot) };
      } finally {
        clearTimeout(timeout);
      }
    })().finally(() => { pending = undefined; });
    return pending;
  };
}
