import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import React from "react";
import { SlotCore } from "@deepseek-ai/dsh-client-ui-slots";

function setup() {
  let plugin;
  vm.runInNewContext(readFileSync(new URL("../lib/client.js", import.meta.url), "utf8"), {
    window: { __ModuleLoader__: { load: (entry) => { plugin = entry; } } },
    document: { getElementById: () => null, createElement: () => ({ remove() {} }), head: { append() {} } }, console
  });
  const core = new SlotCore();
  core.register({ name: "root", children: { "settings.section": { kind: "list", scope: "root" } } }, () => null);
  function ModelsSection() { return null; }
  core.register({ name: "settings.section", id: "models", inject: () => ({ native: true }), children: {
    "settings.models.provider-card": { kind: "keyed", scope: "root" }, "settings.models.footer": { kind: "list", scope: "root" }
  } }, ModelsSection);
  const entry = core.entries("settings.section")[0];
  const children = entry.children;
  const injection = entry.inject;
  const effects = [];
  const services = { remote: { $on: () => () => {} }, "remote.settings": {}, "remote.llm": {} };
  const client = plugin.factory((name) => { assert.equal(name, "react"); return React; });
  const ctx = {
    slots: { entries: (key) => core.entries(key), subscribe: (key, fn) => core.subscribe(key, fn), inject: (_name, callback) => callback() },
    effect: (callback) => effects.push(callback()), settingsSchema: {}, get: (name) => services[name],
    locale: { bind: (namespace) => { assert.equal(namespace, "settings.customProvider"); return (key) => key; }, register: () => () => {} }
  };
  return { client, ctx, entry, children, injection, effects, ModelsSection, core };
}

test("integration decorates the original Models entry, retaining native injection and child slots", () => {
  const { client, ctx, entry, children, injection, effects, ModelsSection, core } = setup();
  client.apply(ctx);
  assert.deepEqual(Array.from(client.inject), ["slots", "locale", "remote.settings", "remote.llm", "settingsSchema"]);
  assert.notEqual(entry.component, ModelsSection);
  assert.equal(entry.inject, injection);
  assert.equal(entry.children, children);
  assert.equal(core.entries("settings.section").length, 1);
  assert.equal(core.entries("settings.models.provider-card").length, 0, "no separate model-tools entry");
  assert.equal(core.entries("settings.models.footer").length, 0, "no footer toolbar");
  for (const dispose of effects.reverse()) dispose?.();
  assert.equal(entry.component, ModelsSection, "unloading restores the official registration");
});

test("an incompatible official section is rejected explicitly", () => {
  const { client, ctx, entry } = setup();
  entry.component = function ChangedModelsPage() { return null; };
  assert.throws(() => client.apply(ctx), /incompatible.*0.2.1-rc.2/);
});
