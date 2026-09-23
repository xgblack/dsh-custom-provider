import assert from "node:assert/strict";
import { test } from "node:test";
import { createModelsDevLoader, enrichDiscoveredModels, findModelsDevMatch, matchModelsDev, modelsDevFields } from "../lib/modelsdev.js";

const catalog = {
  "other/deepseek-v4.1-flash": { name: "Unrelated copy", limit: { context: 42 } },
  "deepseek/deepseek-v4.1-flash": {
    name: "DeepSeek V4.1 Flash", limit: { context: 1000000, output: 384000 },
    modalities: { input: ["text", "image"] }, reasoning: true
  },
  "other/gpt-6-sol": { name: "Unrelated GPT", limit: { context: 42 } },
  "openai/gpt-6-sol": {
    name: "GPT-6 Sol", limit: { context: 1050000, output: 128000 },
    modalities: { input: ["text", "image", "pdf"] }, reasoning: true
  },
  "other/unknown-model": { name: "First" },
  "another/unknown-model": { name: "Second" }
};

test("the original ID wins, then the official provider, then the first ambiguous match", () => {
  assert.equal(matchModelsDev({ ...catalog, "gpt-6-sol": { name: "Exact" } }, "gpt-6-sol").name, "Exact");
  assert.equal(matchModelsDev(catalog, "other/gpt-6-sol").name, "Unrelated GPT");
  assert.equal(matchModelsDev({ "other/gpt-6-sol": { name: "Other" }, "openai/gpt-6-sol": { name: "Official" } }, "missing/gpt-6-sol").name, "Official");
  assert.equal(findModelsDevMatch(catalog, "deepseek-v4.1-flash").key, "deepseek/deepseek-v4.1-flash");
  assert.equal(findModelsDevMatch(catalog, "gpt-6-sol").key, "openai/gpt-6-sol");
  assert.equal(matchModelsDev(catalog, "GPT-6-SOL").name, "GPT-6 Sol");
  assert.equal(matchModelsDev(catalog, "unknown-model").name, "First");
  assert.equal(matchModelsDev(catalog, "absent"), undefined);
});

test("explicit import maps supported fields, omitting reasoning and unsupported inputs", () => {
  assert.deepEqual(modelsDevFields(matchModelsDev(catalog, "gpt-6-sol")), {
    name: "GPT-6 Sol", contextWindow: 1050000, maxTokens: 128000, input: ["text", "image"]
  });
  assert.deepEqual(modelsDevFields({ name: " ", limit: { context: -2, output: 0 }, modalities: { input: ["pdf"] }, reasoning: true }), {});
  assert.deepEqual(modelsDevFields(null), {});
});

test("pi-ai discovery takes precedence over upstream; missing fields retain upstream values without models.dev", async () => {
  const queried = [];
  const result = await enrichDiscoveredModels([
    { id: "deepseek-v4-flash", name: "Gateway", contextWindow: 500000, maxTokens: 10000 },
    { id: "gpt-6-sol", name: "Gateway GPT", contextWindow: 900000 },
    { id: "unknown", name: "Custom" }
  ], async (provider) => {
    queried.push(provider);
    return provider === "deepseek" ? [{
      id: "deepseek-v4-flash", name: "Installed", contextWindow: 1000000, inputModalities: ["text"]
    }] : [];
  });
  assert.deepEqual(queried, ["deepseek", "openai"]);
  assert.deepEqual(result.models, [
    { id: "deepseek-v4-flash", name: "Installed", contextWindow: 1000000, maxTokens: 10000, input: ["text"] },
    { id: "gpt-6-sol", name: "Gateway GPT", contextWindow: 900000 },
    { id: "unknown", name: "Custom" }
  ]);
  assert.equal(result.piAiError, "");
});

test("a pi-ai lookup error retains the provider discovery result and is reported", async () => {
  const result = await enrichDiscoveredModels([{ id: "gpt-6-sol", maxTokens: 9000 }], async () => { throw new Error("unavailable"); });
  assert.deepEqual(result.models, [{ id: "gpt-6-sol", maxTokens: 9000 }]);
  assert.equal(result.piAiError, "openai: unavailable");
});

test("six-hour cache is shared across calls and preserves a stale snapshot on failure", async () => {
  let now = 1000;
  let calls = 0;
  let fail = false;
  const load = createModelsDevLoader(async (url, { signal }) => {
    assert.equal(url, "https://models.dev/models.json");
    assert.equal(signal.aborted, false);
    calls++;
    if (fail) throw new Error("offline");
    return { ok: true, json: async () => catalog };
  }, () => now);
  const [first, concurrent] = await Promise.all([load(), load()]);
  assert.equal(calls, 1);
  assert.equal(first.data, concurrent.data);
  now += 6 * 60 * 60 * 1000 - 1;
  assert.equal((await load()).data, catalog);
  assert.equal(calls, 1);
  now++;
  fail = true;
  assert.deepEqual(await load(), { data: catalog, error: "offline", stale: true });
  assert.equal(calls, 2);
});

test("unavailable or invalid catalogs never return an importable fresh snapshot", async () => {
  const unavailable = createModelsDevLoader(async () => ({ ok: false, status: 503 }));
  assert.deepEqual(await unavailable(), { data: undefined, error: "HTTP 503", stale: false });
  const invalid = createModelsDevLoader(async () => ({ ok: true, json: async () => [] }));
  assert.match((await invalid()).error, /Invalid models.dev catalog/);
});
