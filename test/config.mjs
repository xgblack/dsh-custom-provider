import assert from "node:assert/strict";
import {
  candidate, editOperation, fieldState, matchModelsDev, modelMode
} from "../lib/config.js";

const route = "deepseek";
const profile = (extra = {}) => ({ providers: { [route]: extra } });
const listed = {
  value: profile({ models: [{ id: "a", name: "A", reasoningEfforts: { high: "high" } }, { id: "b", name: "B" }] }),
  user: profile({ models: [{ id: "a", name: "A" }, { id: "b", name: "B" }] }),
  base: profile({})
};
assert.equal(modelMode(listed, route), "listed");
const update = editOperation(listed, route, "a", ["reasoningEfforts"], { high: "high" });
assert.deepEqual(update.path, ["providers", route, "models"]);
assert.deepEqual(update.value[1], { id: "b", name: "B" });
assert.deepEqual(update.value[0], { id: "a", name: "A", reasoningEfforts: { high: "high" } });
assert.deepEqual(candidate(listed, update).providers.deepseek.models, update.value);
assert.deepEqual(editOperation({ ...listed, user: profile({ models: update.value }) }, route,
  "a", ["reasoningEfforts"], undefined, true).value[0], { id: "a", name: "A" });

const inherited = { value: profile({ models: [{ id: "base" }] }), base: profile({ models: [{ id: "base" }] }), user: profile({}) };
assert.equal(modelMode(inherited, route), "inherited");
assert.equal(fieldState(inherited, route, "base", ["reasoningEfforts"]).readOnly, true);
assert.throws(() => editOperation(inherited, route, "base", ["reasoningEfforts"], false), /inherited model list/);
assert.equal(modelMode({ ...inherited, user: profile({ models: [] }) }, route), "catalog");

const catalog = { value: profile({ models: [], modelOverrides: {} }), base: profile({}), user: profile({}) };
assert.equal(modelMode(catalog, route), "catalog");
const override = editOperation(catalog, route, "builtin", ["compat", "thinkingFormat"], "deepseek");
assert.deepEqual(override.path, ["providers", route, "modelOverrides", "builtin", "compat", "thinkingFormat"]);
assert.deepEqual(candidate(catalog, override).providers.deepseek.modelOverrides.builtin.compat, { thinkingFormat: "deepseek" });
assert.equal(fieldState(catalog, route, "builtin", ["compat"]).overridden, false);
const withOverride = { ...catalog, user: profile({ modelOverrides: { builtin: { compat: { thinkingFormat: "deepseek" } } } }) };
assert.equal(fieldState(withOverride, route, "builtin", ["compat", "thinkingFormat"]).overridden, true);
assert.equal(editOperation(withOverride, route, "builtin", ["compat", "thinkingFormat"], undefined, true).op, "unset");
assert.equal(editOperation(catalog, route, "builtin", ["reasoningEfforts"], undefined, true), undefined);
assert.deepEqual(editOperation(catalog, route, undefined, ["timeoutMs"], 1000).path,
  ["providers", route, "timeoutMs"]);

const data = { "deepseek/a": { name: "A" }, "other/a": { name: "Other A" }, "unique/b": { name: "B" } };
assert.equal(matchModelsDev(data, "deepseek", "a").key, "deepseek/a");
assert.equal(matchModelsDev(data, "unknown", "a"), undefined);
assert.equal(matchModelsDev(data, "unknown", "b").key, "unique/b");
console.log("config: listed, inherited, catalog, restore, collision checks passed");
