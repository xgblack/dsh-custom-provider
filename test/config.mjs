import assert from "node:assert/strict";
import {
  addModelOperation,
  availableCatalogProviders,
  candidate,
  commitOperation,
  createProviderOperation,
  derivedKeyRef,
  editableModel,
  effectiveModel,
  modelEntries,
  modelMode,
  parseModelJson,
  patchModelOperation,
  patchProviderOperation,
  providerKind,
  providerRemovable,
  removeModelOperation,
  removeProviderOperation,
  replaceProviderOperation,
  replaceModelOperation
} from "../lib/config.js";

const route = "deepseek";
const profile = (extra = {}) => ({ providers: { [route]: extra } });
const listed = {
  value: profile({ models: [
    { id: "a", name: "A", reasoningEfforts: { high: "high" }, compat: { thinkingFormat: "deepseek" } },
    { id: "b", name: "B" }
  ] }),
  user: profile({ models: [
    { id: "a", name: "A", reasoningEfforts: { high: "high" }, compat: { thinkingFormat: "deepseek" } },
    { id: "b", name: "B" }
  ] }),
  base: profile({}),
  revision: 7,
  schema: {}
};

assert.equal(modelMode(listed, route), "listed");
assert.deepEqual(editableModel(listed, route, "a"), listed.user.providers.deepseek.models[0]);
const common = patchModelOperation(listed, route, "a", {
  name: "A2",
  contextWindow: 128000,
  maxTokens: 8192,
  input: ["text", "image"]
});
assert.deepEqual(common.path, ["providers", route, "models"]);
assert.deepEqual(common.value[1], { id: "b", name: "B" }, "a sibling model is preserved");
assert.equal(common.value[0].name, "A2");
assert.deepEqual(common.value[0].compat, { thinkingFormat: "deepseek" }, "advanced fields are preserved");
assert.deepEqual(candidate(listed, common).providers.deepseek.models, common.value);

const parsed = parseModelJson('{"id":"a","compat":{"supportsStore":false}}', "a");
const advanced = replaceModelOperation(listed, route, "a", parsed);
assert.deepEqual(advanced.value[0], parsed);
assert.deepEqual(advanced.value[1], { id: "b", name: "B" });
assert.throws(() => parseModelJson("{", "a"), /Invalid JSON/);
assert.throws(() => parseModelJson("[]", "a"), /must be an object/);
assert.throws(() => parseModelJson('{"id":"b"}', "a"), /must remain a/);

const inherited = {
  value: profile({ models: [{ id: "base", name: "Base" }] }),
  base: profile({ models: [{ id: "base", name: "Base" }] }),
  user: profile({})
};
assert.equal(modelMode(inherited, route), "inherited");
assert.deepEqual(editableModel(inherited, route, "base"), { id: "base", name: "Base" });
assert.throws(() => patchModelOperation(inherited, route, "base", { name: "Changed" }), /inherited model list/);

const catalog = {
  value: profile({
    defaultContextWindow: 32000,
    defaultMaxTokens: 4000,
    defaultInput: ["text"],
    modelOverrides: { builtin: { maxTokens: 8000, compat: { thinkingFormat: "openai" } } }
  }),
  base: profile({ modelOverrides: { builtin: { compat: { thinkingFormat: "openai" } } } }),
  user: profile({ modelOverrides: { builtin: { maxTokens: 8000 } } }),
  revision: 9,
  schema: {}
};
assert.equal(modelMode(catalog, route), "catalog");
assert.deepEqual(editableModel(catalog, route, "builtin"), { id: "builtin", maxTokens: 8000 },
  "advanced JSON is limited to the current model user scope");
assert.deepEqual(effectiveModel(catalog, route, "builtin", {
  id: "builtin", name: "Built In", contextWindow: 128000, maxTokens: 16000, inputModalities: ["text", "image"]
}), {
  id: "builtin",
  name: "Built In",
  contextWindow: 128000,
  maxTokens: 8000,
  input: ["text", "image"],
  compat: { thinkingFormat: "openai" }
});
const catalogCommon = patchModelOperation(catalog, route, "builtin", { name: "Local", input: ["text"] });
assert.deepEqual(catalogCommon.path, ["providers", route, "modelOverrides", "builtin"]);
assert.deepEqual(catalogCommon.value, { maxTokens: 8000, name: "Local", input: ["text"] });
assert.equal(Object.hasOwn(catalogCommon.value, "id"), false);
assert.equal(replaceModelOperation(catalog, route, "builtin", { id: "builtin" }).op, "unset");

const entries = modelEntries(catalog, route, [
  { id: "builtin", name: "Built In", contextWindow: 128000 },
  { id: "second", name: "Second" }
]);
assert.deepEqual(entries.map((model) => model.id), ["builtin", "second"]);
assert.equal(entries[0].maxTokens, 8000);

const providerView = {
  value: { providers: { deepseek: { api: "openai-completions", baseURL: "https://old.example/v1", models: [{ id: "a" }] },
    sibling: { apiKeyEnv: "SIBLING_API_KEY" } } },
  user: { providers: { deepseek: { baseURL: "https://old.example/v1", models: [{ id: "a" }] },
    sibling: { apiKeyEnv: "SIBLING_API_KEY" } } },
  base: { providers: { deepseek: { api: "openai-completions" } } },
  revision: 12, schema: {}
};
assert.equal(derivedKeyRef("my-gateway"), "MY_GATEWAY_API_KEY");
assert.equal(providerRemovable(providerView, "deepseek"), false);
assert.equal(providerRemovable(providerView, "sibling"), true);
assert.equal(providerKind(providerView, "deepseek", [{ provider: "deepseek", declared: false }]), "catalog");
assert.equal(providerKind(providerView, "sibling", [{ provider: "sibling", declared: true }]), "custom");
assert.equal(providerKind(providerView, "deepseek", []), "inherited");
assert.deepEqual(availableCatalogProviders([
  { provider: "deepseek", declared: false }, { provider: "sibling", declared: true },
  { provider: "free", declared: false }
], ["deepseek"]).map((entry) => entry.provider), ["free"]);
assert.throws(() => removeProviderOperation(providerView, "deepseek"), /Inherited providers/);
assert.deepEqual(removeProviderOperation(providerView, "sibling"), { op: "unset", path: ["providers", "sibling"] });
const patchProvider = patchProviderOperation(providerView, "deepseek", { displayName: "Local", baseURL: undefined });
assert.deepEqual(patchProvider, [
  { op: "set", path: ["providers", "deepseek", "displayName"], value: "Local" },
  { op: "unset", path: ["providers", "deepseek", "baseURL"] }
]);
const providerCandidate = candidate(providerView, patchProvider);
assert.equal(providerCandidate.providers.deepseek.api, "openai-completions");
assert.deepEqual(providerCandidate.providers.sibling, { apiKeyEnv: "SIBLING_API_KEY" });
assert.deepEqual(replaceProviderOperation(providerView, "deepseek", { displayName: "New" }).map(({ op, path }) => ({ op, path })), [
  { op: "unset", path: ["providers", "deepseek", "baseURL"] },
  { op: "unset", path: ["providers", "deepseek", "models"] },
  { op: "set", path: ["providers", "deepseek", "displayName"] }
]);
assert.throws(() => createProviderOperation(providerView, "deepseek", {}), /already exists/);
assert.throws(() => createProviderOperation(providerView, "Acme", {}), /Provider ID/);
assert.throws(() => createProviderOperation(providerView, "built-in", {}, ["built-in"]), /already exists/);
const createProvider = createProviderOperation(providerView, "acme-gateway", { api: "openai-responses", models: [{ id: "new" }] });
assert.deepEqual(createProvider.path, ["providers", "acme-gateway"]);
assert.deepEqual(candidate(providerView, createProvider).providers.sibling, providerView.value.providers.sibling);
const added = addModelOperation(providerView, "deepseek", { id: "b" });
assert.deepEqual(added.value, [{ id: "a" }, { id: "b" }]);
assert.throws(() => removeModelOperation(providerView, "deepseek", "a"), /last model/);
assert.deepEqual(removeModelOperation(listed, route, "a").value, [{ id: "b", name: "B" }]);
assert.throws(() => addModelOperation(catalog, route, { id: "new" }), /explicit user model list/);
assert.throws(() => addModelOperation(providerView, "deepseek", { id: "a" }), /already exists/);

const schema = { rehydrate: () => ({}), validate: () => undefined };
let mutation;
const successApi = { settings: { mutate: async (...args) => {
  mutation = args;
  return { ok: true, value: { ...listed, revision: 8 } };
} } };
const written = await commitOperation(successApi, schema, listed, common);
assert.equal(written.kind, "written");
assert.equal(mutation[0], "llm-pi-ai");
assert.equal(mutation[2], 7, "the expected revision is forwarded");
assert.deepEqual(mutation[1], [common]);
const writtenProvider = await commitOperation(successApi, schema, providerView, patchProvider);
assert.equal(writtenProvider.kind, "written");
assert.deepEqual(mutation[1], patchProvider, "provider field operations are committed together");
assert.equal(mutation[2], 12);
let staleMutated = false;
const staleDraft = await commitOperation({ settings: { mutate: async () => { staleMutated = true; } } },
  schema, providerView, patchProvider, 11);
assert.equal(staleDraft.kind, "conflict");
assert.equal(staleMutated, false, "an old JSON draft never writes with a new revision");

let invalidMutated = false;
const invalid = await commitOperation({ settings: { mutate: async () => { invalidMutated = true; } } },
  { rehydrate: () => ({}), validate: () => "schema rejected model" }, listed, common);
assert.deepEqual(invalid, { kind: "invalid", message: "schema rejected model" });
assert.equal(invalidMutated, false, "schema failures do not reach the server");

const refused = await commitOperation({ settings: { mutate: async () => ({
  ok: false, error: { code: "settings/invalid", message: "adapter rejected model" }
}) } }, schema, listed, common);
assert.deepEqual(refused, { kind: "rejected", message: "adapter rejected model" });

const conflict = await commitOperation({ settings: { mutate: async () => ({
  ok: false, error: { code: "settings/conflict", message: "stale revision" }
}) } }, schema, listed, common);
assert.deepEqual(conflict, { kind: "conflict", message: "stale revision" });

console.log("config: provider/model scope, sibling preservation, validation, rejection and conflict checks passed");
