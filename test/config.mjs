import assert from "node:assert/strict";
import { test } from "node:test";
import {
  candidate, commitOperation, editableModel, exportProviderBundle, modelEntries, modelMode,
  parseModelJson, mergeModelJson, parseProviderBundle, providerImportOperations, providerTransferDiff,
  providerTransferState, replaceModelOperation
} from "../lib/config.js";

const profile = (extra = {}) => ({ providers: { gateway: extra } });
const listed = {
  value: profile({ models: [
    { id: "a", name: "A", reasoningEfforts: { high: "high" }, compat: { thinkingFormat: "openai" } },
    { id: "b", name: "B", maxTokens: 2048 }
  ] }),
  user: profile({ models: [
    { id: "a", name: "A", reasoningEfforts: { high: "high" }, compat: { thinkingFormat: "openai" } },
    { id: "b", name: "B", maxTokens: 2048 }
  ] }),
  base: {}, revision: 7, schema: {}
};
const schema = { rehydrate: (value) => value, validate: () => undefined };

test("editing one listed model preserves its sibling and leaves adapter fields untouched", () => {
  assert.equal(modelMode(listed, "gateway"), "listed");
  const source = editableModel(listed, "gateway", "a");
  const op = replaceModelOperation(listed, "gateway", "a", { ...source, name: "Changed" });
  assert.deepEqual(op.path, ["providers", "gateway", "models"]);
  assert.deepEqual(op.value[1], listed.user.providers.gateway.models[1]);
  assert.deepEqual(op.value[0].reasoningEfforts, { high: "high" });
  assert.deepEqual(op.value[0].compat, { thinkingFormat: "openai" });
  assert.equal(candidate(listed, op).providers.gateway.models[0].name, "Changed");
});

test("JSON validates its object and ID, with an optional identity lock for direct writes", () => {
  assert.deepEqual(parseModelJson('{"id":"a","maxTokens":8192}', "a"), { id: "a", maxTokens: 8192 });
  assert.throws(() => parseModelJson("{", "a"), /Invalid JSON/);
  assert.throws(() => parseModelJson("[]", "a"), /must be an object/);
  assert.throws(() => parseModelJson('{"name":"No ID"}'), /id must be a non-empty string/);
  assert.deepEqual(parseModelJson('{"id":"renamed"}'), { id: "renamed" });
  assert.throws(() => parseModelJson('{"id":"b"}', "a"), /must remain a/);
  assert.throws(() => replaceModelOperation(listed, "gateway", "missing", { id: "missing" }), /not in the configured list/);
});

test("catalog JSON writes one modelOverrides entry and can restore the catalog default", () => {
  const view = { value: profile({ modelOverrides: { a: { maxTokens: 4096 }, b: { name: "B" } } }),
    user: profile({ modelOverrides: { a: { maxTokens: 4096 }, b: { name: "B" } } }), base: {} };
  assert.deepEqual(modelEntries(view, "gateway").map((model) => model.id), ["a", "b"]);
  const op = replaceModelOperation(view, "gateway", "a", { id: "a", maxTokens: 8192 });
  assert.deepEqual(op, { op: "set", path: ["providers", "gateway", "modelOverrides", "a"], value: { maxTokens: 8192 } });
  assert.deepEqual(candidate(view, op).providers.gateway.modelOverrides.b, { name: "B" });
  assert.equal(replaceModelOperation(view, "gateway", "a", { id: "a" }).op, "unset");
});

test("an inherited catalog model list stays read-only", () => {
  const view = { value: profile({ models: [{ id: "base", name: "Base" }] }),
    base: profile({ models: [{ id: "base", name: "Base" }] }), user: {} };
  assert.equal(modelMode(view, "gateway"), "inherited");
  assert.deepEqual(editableModel(view, "gateway", "base"), { id: "base", name: "Base" });
  assert.throws(() => replaceModelOperation(view, "gateway", "base", { id: "base", name: "Changed" }), /inherited model list/);
});

test("declared providers materialize existing model overrides while preserving other entries", () => {
  const directory = [{ provider: "gateway", declared: true }];
  const view = { value: profile({ models: [{ id: "a", name: "A" }, { id: "b" }],
    modelOverrides: { a: { maxTokens: 2048 }, b: { contextWindow: 64000 } } }),
    user: profile({ modelOverrides: { a: { maxTokens: 2048 }, b: { contextWindow: 64000 } } }), base: {} };
  const op = replaceModelOperation(view, "gateway", "a", { id: "a", name: "A", maxTokens: 8192 }, directory);
  assert.deepEqual(op, [
    { op: "set", path: ["providers", "gateway", "models"], value: [
      { id: "a", name: "A", maxTokens: 8192 }, { id: "b", contextWindow: 64000 }
    ] },
    { op: "unset", path: ["providers", "gateway", "modelOverrides"] }
  ]);
});

test("writes validate first, forward the exact revision and require no host registration endpoint", async () => {
  let mutation;
  const api = { settings: { mutate: async (...args) => { mutation = args; return { ok: true, value: { ...listed, revision: 8 } }; } } };
  const op = replaceModelOperation(listed, "gateway", "a", { id: "a", maxTokens: 8192 });
  assert.equal((await commitOperation(api, schema, listed, op)).kind, "written");
  assert.deepEqual(mutation, ["llm-pi-ai", [op], 7]);
  mutation = undefined;
  assert.equal((await commitOperation(api, schema, listed, op, 6)).kind, "conflict");
  assert.equal(mutation, undefined);
  assert.deepEqual(await commitOperation(api, { rehydrate: () => ({}), validate: () => "schema rejected" }, listed, op),
    { kind: "invalid", message: "schema rejected" });
  assert.equal(mutation, undefined);
  for (const [code, kind] of [["settings/conflict", "conflict"], ["settings/invalid", "rejected"]]) {
    assert.deepEqual(await commitOperation({ settings: { mutate: async () => ({ ok: false, error: { code, message: "refused" } }) } }, schema, listed, op), { kind, message: "refused" });
  }
});

test("exports omit credentials and request headers and exclude built-in account routes", () => {
  const view = { value: { providers: {
    gateway: { apiKey: "fixture-private-key", apiKeyEnv: "GATEWAY_API_KEY", headers: { Authorization: "fixture-private-header" }, models: [{ id: "a" }] },
    "deepseek-account": {}, "deepseek-official": {}
  } } };
  const bundle = exportProviderBundle(view, ["gateway"]);
  assert.deepEqual(bundle.providers.gateway, { apiKeyEnv: "GATEWAY_API_KEY", models: [{ id: "a" }] });
  assert.deepEqual(bundle.omittedHeaders, ["gateway"]);
  assert.doesNotMatch(JSON.stringify(bundle), /fixture-private/);
  assert.deepEqual(parseProviderBundle(JSON.stringify(bundle)), bundle);
  for (const route of ["deepseek-account", "deepseek-official"]) assert.throws(() => exportProviderBundle(view, [route]), /not exportable/);
});

test("imports reject embedded secrets and unsafe identities before producing writes", () => {
  const bundle = { format: "dsh-custom-provider/providers", version: 1, providers: { gateway: {} }, omittedHeaders: [] };
  for (const profile of [{ apiKey: "fixture" }, { headers: { Authorization: "fixture" } }]) {
    assert.throws(() => parseProviderBundle(JSON.stringify({ ...bundle, providers: { gateway: profile } })), /invalid ID/);
  }
  assert.throws(() => parseProviderBundle('{"format":"dsh-custom-provider/providers","version":1,"providers":{"__proto__":{}},"omittedHeaders":[]}'), /invalid ID/);
  assert.throws(() => parseProviderBundle(JSON.stringify({ ...bundle, version: 2 })), /Unsupported/);
  assert.throws(() => parseProviderBundle("{"), /Invalid JSON/);
});

test("replacement previews model changes and preserves destination headers and unselected providers", () => {
  const view = { value: { providers: { gateway: { api: "openai-completions", headers: { "X-Fixture": "keep" }, models: [{ id: "local" }] }, sibling: { models: [{ id: "other" }] } } },
    user: { providers: { gateway: { api: "openai-completions", headers: { "X-Fixture": "keep" }, models: [{ id: "local" }] }, sibling: { models: [{ id: "other" }] } } }, base: {} };
  const bundle = { format: "dsh-custom-provider/providers", version: 1, omittedHeaders: [], providers: {
    gateway: { api: "openai-responses", models: [{ id: "source" }] }, added: { api: "openai-completions", models: [{ id: "new" }] }
  } };
  const diff = providerTransferDiff(view, "gateway", bundle.providers.gateway);
  assert.deepEqual(diff.addedModels, ["source"]);
  assert.deepEqual(diff.removedModels, ["local"]);
  assert.equal(providerTransferState(view, "added"), "new");
  assert.deepEqual(providerImportOperations(view, bundle, { gateway: "skip", added: "skip" }), []);
  const ops = providerImportOperations(view, bundle, { gateway: "replace", added: "add" });
  const result = candidate(view, ops);
  assert.deepEqual(result.providers.gateway.headers, { "X-Fixture": "keep" });
  assert.deepEqual(result.providers.gateway.models, [{ id: "source" }]);
  assert.deepEqual(result.providers.sibling, view.value.providers.sibling);
  assert.deepEqual(result.providers.added.models, [{ id: "new" }]);
  assert.throws(() => providerImportOperations(view, bundle, { gateway: "add" }), /changed since preview/);
  assert.throws(() => providerImportOperations(view, bundle, { added: "replace" }), /changed since preview/);
});

test("resumed JSON edits merge independent nested fields, removals and identical changes", () => {
  const base = { id: "a", name: "A", maxTokens: 2048, compat: { supportsStore: false, supportsDeveloperRole: true } };
  const current = { ...base, name: "Native", compat: { ...base.compat, supportsStore: true } };
  const edited = { ...base, maxTokens: 4096, compat: { supportsStore: false } };
  assert.deepEqual(mergeModelJson(base, current, edited), { id: "a", name: "Native", maxTokens: 4096, compat: { supportsStore: true } });
  assert.deepEqual(mergeModelJson(base, { ...base, name: "Same" }, { ...base, name: "Same" }), { ...base, name: "Same" });
  assert.throws(() => mergeModelJson(base, { ...base, name: "Native" }, { ...base, name: "JSON" }),
    (error) => error.code === "MODEL_JSON_CONFLICT" && error.field === "name");
});

test("JSON merges preserve literal object keys without changing prototypes", () => {
  const base = JSON.parse('{"id":"a","name":"A","__proto__":{"value":"base"}}');
  const current = { ...base, name: "Native" };
  const edited = JSON.parse('{"id":"a","name":"A","__proto__":{"value":"edited"},"constructor":{"fixture":true}}');
  const merged = mergeModelJson(base, current, edited);
  assert.equal(Object.getPrototypeOf(merged), Object.prototype);
  assert.equal(Object.hasOwn(merged, "__proto__"), true);
  assert.deepEqual(merged.__proto__, { value: "edited" });
  assert.deepEqual(merged.constructor, { fixture: true });
  assert.equal(merged.name, "Native");
});
