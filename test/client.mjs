import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

let plugin;
const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
vm.runInNewContext(source, {
  window: { __ModuleLoader__: { load: (entry) => { plugin = entry; } } },
  navigator: { language: "zh-CN" },
  document: {
    getElementById: () => null,
    createElement: () => ({ remove() {} }),
    head: { append() {} }
  },
  console
});

assert.equal(plugin.id, "dsh-custom-provider");
const client = plugin.factory((name) => {
  assert.equal(name, "react");
  return { createElement: () => ({}) };
});
assert.deepEqual(Array.from(client.inject), ["slots", "remote", "remote.settings", "remote.credentials", "remote.llm", "settingsSchema"]);

let registration;
const services = {
  remote: { $on: () => () => {} },
  "remote.settings": {},
  "remote.credentials": {},
  "remote.llm": {}
};
client.apply({
  slots: {
    inject: (name, callback) => { assert.equal(name, "settings.section"); callback(); },
    register: (options, component) => { registration = { options, component }; }
  },
  effect: (callback) => callback(),
  settingsSchema: {},
  get: (name) => services[name]
});

assert.equal(registration.options.name, "settings.section");
assert.equal(registration.options.id, "model-configuration");
assert.equal(registration.options.order, 11);
assert.equal(registration.options.label(), "模型配置");
assert.equal(typeof registration.options.inject, "function");
assert.equal(typeof registration.component, "function");
const injected = registration.options.inject();
assert.equal(injected.api.settings, services["remote.settings"]);
assert.equal(injected.api.credentials, services["remote.credentials"]);
assert.equal(injected.api.llm, services["remote.llm"]);

console.log("client: independent Model configuration section registration passed");
