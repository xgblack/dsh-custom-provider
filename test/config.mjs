import assert from "node:assert/strict";
import {
  candidate,
  commitOperation,
  editableModel,
  effectiveModel,
  modelEntries,
  modelMode,
  parseModelJson,
  patchModelOperation,
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

console.log("config: model scope, sibling preservation, validation, rejection and conflict checks passed");
