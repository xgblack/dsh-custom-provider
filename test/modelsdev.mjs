import assert from "node:assert/strict";
import { test } from "node:test";
import { createModelsDevLoader, enrichDiscoveredModels, matchModelsDev } from "../lib/modelsdev.js";

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
  assert.equal(matchModelsDev(catalog, "other/gpt-6-sol").name, "Unrelated GPT", "a supplied full ID wins over the official provider");
  assert.equal(matchModelsDev({ "other/gpt-6-sol": { name: "Other" }, "openai/gpt-6-sol": { name: "Official" } }, "missing/gpt-6-sol").name, "Official", "an absent full ID can fall back to the confirmed official provider");
  assert.equal(matchModelsDev(catalog, "deepseek-v4.1-flash").name, "DeepSeek V4.1 Flash");
  assert.equal(matchModelsDev(catalog, "gpt-6-sol").name, "GPT-6 Sol");
  assert.equal(matchModelsDev(catalog, "GPT-6-SOL").name, "GPT-6 Sol", "official matching is case-insensitive after the exact check");
  assert.equal(matchModelsDev({ "other/claude-sonnet-4-6": { name: "Other" }, "anthropic/claude-sonnet-4-6": { name: "Official" } }, "claude-sonnet-4-6").name, "Official");
  assert.equal(matchModelsDev(catalog, "unknown-model").name, "First");
  assert.equal(matchModelsDev(catalog, "absent"), undefined);
});

test("only absent adapter fields are filled; unsupported metadata is not written", async () => {
  const { models } = await enrichDiscoveredModels([
    { id: "deepseek-v4.1-flash", name: "Upstream name", maxTokens: 16000 },
    { id: "gpt-6-sol" }
  ], async () => ({ data: catalog }));
  assert.deepEqual(models[0], {
    id: "deepseek-v4.1-flash", name: "Upstream name", maxTokens: 16000,
    contextWindow: 1000000, input: ["text", "image"]
  });
  assert.deepEqual(models[1], {
    id: "gpt-6-sol", name: "GPT-6 Sol", contextWindow: 1050000,
    maxTokens: 128000, input: ["text", "image"]
  });
  let called = false;
  const complete = [{ id: "known", name: "Built-in", contextWindow: 128000, maxTokens: 8192, inputModalities: ["text"] }];
  assert.deepEqual((await enrichDiscoveredModels(complete, () => { called = true; })).models,
    [{ id: "known", name: "Built-in", contextWindow: 128000, maxTokens: 8192, input: ["text"] }]);
  assert.equal(called, false, "complete pi-ai/provider data must not trigger an external lookup");
});

test("exact pi-ai metadata wins over provider fields and models.dev, while misses fall through", async () => {
  const queried = [];
  const result = await enrichDiscoveredModels([
    { id: "deepseek-v4-flash", name: "Gateway", contextWindow: 500000, maxTokens: 10000 },
    { id: "gpt-6-sol", name: "Gateway GPT", contextWindow: 900000 }
  ], async () => ({ data: { ...catalog, "deepseek/deepseek-v4-flash": {
    name: "Web catalog", limit: { context: 2000000, output: 200000 }, modalities: { input: ["text", "image"] }
  } } }), async (provider) => {
    queried.push(provider);
    return provider === "deepseek" ? [{
      id: "deepseek-v4-flash", name: "Installed", contextWindow: 1000000,
      maxTokens: 384000, inputModalities: ["text"]
    }] : [];
  });
  assert.deepEqual(queried, ["deepseek", "openai"]);
  assert.deepEqual(result.models[0], {
    id: "deepseek-v4-flash", name: "Installed", contextWindow: 1000000,
    maxTokens: 384000, input: ["text"]
  });
  assert.deepEqual(result.models[1], {
    id: "gpt-6-sol", name: "Gateway GPT", contextWindow: 900000,
    maxTokens: 128000, input: ["text", "image"]
  });
});

test("missing pi-ai fields are inherited from provider discovery before models.dev", async () => {
  const result = await enrichDiscoveredModels([
    { id: "gpt-6-sol", name: "Gateway", maxTokens: 9000 }
  ], async () => ({ data: catalog }), async () => [
    { id: "gpt-6-sol", name: "Installed", contextWindow: 500000 }
  ]);
  assert.deepEqual(result.models, [{
    id: "gpt-6-sol", name: "Installed", contextWindow: 500000,
    maxTokens: 9000, input: ["text", "image"]
  }]);
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
  assert.equal(calls, 1, "simultaneous discoveries should share the download");
  assert.equal(first.data, concurrent.data);
  now += 6 * 60 * 60 * 1000 - 1;
  assert.equal((await load()).data, catalog);
  assert.equal(calls, 1);
  now++;
  fail = true;
  assert.deepEqual(await load(), { data: catalog, error: "offline", stale: true });
  assert.equal(calls, 2);
});

test("an unavailable or invalid catalog never fabricates model capabilities", async () => {
  const unavailable = createModelsDevLoader(async () => ({ ok: false, status: 503 }));
  assert.deepEqual(await unavailable(), { data: undefined, error: "HTTP 503", stale: false });
  const invalid = createModelsDevLoader(async () => ({ ok: true, json: async () => [] }));
  assert.match((await invalid()).error, /Invalid models.dev catalog/);
  const result = await enrichDiscoveredModels([{ id: "new-model" }], unavailable);
  assert.deepEqual(result.models, [{ id: "new-model" }]);
  assert.equal(result.error, "HTTP 503");
});
