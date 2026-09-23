// Optional model metadata for fields omitted by the installed catalog and provider discovery.
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

export function matchModelsDev(catalog, id) {
  if (!isModelsDevRecord(catalog) || typeof id !== "string" || !id.trim()) return undefined;
  // Keep the original identity ahead of any namespace or variant inference.
  if (Object.hasOwn(catalog, id) && isModelsDevRecord(catalog[id])) return catalog[id];
  const bare = id.split("/").at(-1);
  const official = officialProviderOf(id);
  if (official) {
    const officialKey = normalizedId(`${official}/${bare}`);
    for (const [key, entry] of Object.entries(catalog)) {
      if (normalizedId(key) === officialKey && isModelsDevRecord(entry)) return entry;
    }
  }
  const normalized = normalizedId(id);
  const normalizedBare = normalizedId(bare);
  // If multiple non-official providers advertise the same bare id, use the first entry.
  for (const [key, entry] of Object.entries(catalog)) {
    if (!isModelsDevRecord(entry)) continue;
    const keyId = normalizedId(key);
    if (keyId === normalized || keyId.split("/").at(-1) === normalizedBare) return entry;
  }
  return undefined;
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export function discoveredModelEntry(model) {
  if (!model || typeof model.id !== "string" || !model.id.trim()) return undefined;
  const next = { id: model.id.trim() };
  if (typeof model.name === "string" && model.name.trim()) next.name = model.name;
  if (positiveInteger(model.contextWindow)) next.contextWindow = model.contextWindow;
  if (positiveInteger(model.maxTokens)) next.maxTokens = model.maxTokens;
  const input = Array.isArray(model.inputModalities) ? model.inputModalities : model.input;
  if (Array.isArray(input) && input.length) next.input = [...input];
  if (model.reasoningEfforts !== undefined) next.reasoningEfforts = model.reasoningEfforts;
  return next;
}

function missingDetails(model) {
  return !model.name || model.name === model.id || !model.contextWindow || !model.maxTokens || !model.input?.length;
}

function fillMissingDetails(model, metadata) {
  if (!isModelsDevRecord(metadata)) return model;
  const next = { ...model };
  if ((!next.name || next.name === next.id) && typeof metadata.name === "string" && metadata.name.trim()) next.name = metadata.name;
  if (!next.contextWindow && positiveInteger(metadata.limit?.context)) next.contextWindow = metadata.limit.context;
  if (!next.maxTokens && positiveInteger(metadata.limit?.output)) next.maxTokens = metadata.limit.output;
  if (!next.input?.length && Array.isArray(metadata.modalities?.input)) {
    const input = ["text", "image"].filter((type) => metadata.modalities.input.includes(type));
    if (input.length) next.input = input;
  }
  // A reasoning boolean does not specify the request-wire values of reasoningEfforts.
  return next;
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

export async function enrichDiscoveredModels(found, loadModelsDev, loadPiAi) {
  const discovered = found.map(discoveredModelEntry).filter(Boolean);
  const piAi = new Map();
  const piAiErrors = [];
  if (loadPiAi) {
    const providers = new Set(discovered.map((model) => officialProviderOf(model.id)).filter(Boolean));
    for (const provider of providers) {
      try {
        const entries = await loadPiAi(provider);
        piAi.set(provider, new Map(entries.map(discoveredModelEntry).filter(Boolean).map((model) => [model.id, model])));
      } catch (error) { piAiErrors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`); }
    }
  }
  const models = discovered.map((model) => {
    const provider = officialProviderOf(model.id);
    const installed = piAi.get(provider)?.get(model.id) ?? piAi.get(provider)?.get(model.id.split("/").at(-1));
    return installed ? { ...model, ...installed, id: model.id } : model;
  });
  if (!models.some(missingDetails)) return { models, piAiError: piAiErrors.join("; ") };
  const result = await loadModelsDev();
  return {
    models: models.map((model) => missingDetails(model) ? fillMissingDetails(model, matchModelsDev(result.data, model.id)) : model),
    error: result.error,
    stale: result.stale,
    piAiError: piAiErrors.join("; ")
  };
}
