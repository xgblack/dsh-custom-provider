import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

let plugin;
const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
vm.runInNewContext(source, {
  window: { __ModuleLoader__: { load: (entry) => { plugin = entry; } } },
  navigator: { language: "zh-CN" },
  document: { getElementById: () => null, createElement: () => ({ remove() {} }), head: { append() {} } },
  fetch: () => { throw new Error("load should not fetch until card opens"); },
  console
});
assert.equal(plugin.id, "dsh-custom-provider");
const client = plugin.factory((name) => {
  assert.equal(name, "react");
  return { createElement: () => ({}) };
});
assert.deepEqual(Array.from(client.inject), ["slots", "remote", "remote.settings", "settingsSchema"]);
let registration;
client.apply({
  slots: { inject: (name, fn) => { assert.equal(name, "settings.models.provider-card"); fn(); },
    register: (options, component) => { registration = { options, component }; } },
  effect: () => {},
  settingsSchema: {},
  get: () => ({})
});
assert.equal(registration.options.name, "settings.models.provider-card");
assert.equal(registration.options.key, "llm-pi-ai");
assert.equal(typeof registration.component, "function");
console.log("client: bundle and keyed slot registration passed");

const view = {
  ns: "llm-pi-ai", revision: 7, schema: {},
  value: { providers: { deepseek: { compat: { supportsFoo: false } } } },
  base: { providers: { deepseek: {} } }, user: { providers: { deepseek: {} } }
};
let mutation;
const remote = {
  settings: {
    describe: async () => ({ ok: true, value: { writable: true, namespaces: [view] } }),
    mutate: async (...args) => { mutation = args; return { ok: true, value: view }; }
  },
  subscribe: () => () => {}
};
let stateIndex = 0;
const initialStates = [true, "route", view, true, false, "", undefined, "", ""];
const React = {
  Fragment: "fragment",
  createElement: (type, props, ...children) => typeof type === "function"
    ? type({ ...props, children }) : { type, props: props ?? {}, children },
  useState: (initial) => [stateIndex < initialStates.length ? initialStates[stateIndex++]
    : typeof initial === "function" ? initial() : initial, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn
};
const rendered = plugin.factory(() => React);
let renderRegistration;
rendered.apply({
  slots: { inject: (_name, callback) => callback(), register: (_options, component) => { renderRegistration = component; } },
  effect: () => {}, get: () => ({ $on: () => () => {} }), settingsSchema: {}
});
const schema = {
  rehydrate: () => ({}),
  validate: () => undefined,
  nodeAtPath: (_root, path) => path.length === 2 ? { dict: {
    api: { type: "string" }, compat: { type: "object", dict: { supportsFoo: { type: "boolean" } } }
  } } : { dict: {} }
};
const tree = renderRegistration({ provider: { provider: "deepseek" }, api: remote, schema });
function walk(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    const found = Array.isArray(child) ? child.map((item) => walk(item, predicate)).find(Boolean) : walk(child, predicate);
    if (found) return found;
  }
  return undefined;
}
assert.equal(walk(tree, (node) => node.type === "label" && node.children.includes("api")), undefined);
const toggle = walk(tree, (node) => node.type === "input" && node.props.type === "checkbox");
assert.ok(toggle, "compat boolean control is rendered from schema");
await toggle.props.onChange({ target: { checked: true } });
assert.equal(mutation[0], "llm-pi-ai");
assert.equal(mutation[2], 7);
assert.deepEqual(Array.from(mutation[1][0].path), ["providers", "deepseek", "compat", "supportsFoo"]);
assert.equal(mutation[1][0].value, true);
console.log("client: schema field render and revisioned mutation passed");
