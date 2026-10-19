import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { createRequire } from "node:module";
import { SlotCore } from "@deepseek-ai/dsh-client-ui-slots";
import { candidate, getAt, hasAt } from "../lib/config.js";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const require = createRequire(import.meta.url);
const nativeSource = readFileSync(require.resolve("@deepseek-ai/dsh-client-ui-settings-models/client"), "utf8");
const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
function Modal({ open, title, onClose, children, footer }) {
  return open ? React.createElement("section", { role: "dialog", "aria-label": title },
    React.createElement("button", { type: "button", "aria-label": "关闭弹窗", onClick: onClose }), children, footer) : null;
}
function host() {
  let view = { ns: "llm-pi-ai", revision: 1, schema: {}, base: {}, user: { providers: {
    gateway: { api: "openai-completions", apiKeyEnv: "GATEWAY_API_KEY", headers: { "X-Fixture": "keep" }, models: [
      { id: "gpt-6-sol", name: "Gateway GPT", reasoningEfforts: { high: "wire-high" }, compat: { supportsStore: false } },
      { id: "sibling", name: "Sibling", maxTokens: 2048 }
    ] }
  } } };
  view.value = structuredClone(view.user);
  const listeners = new Map();
  let writable = true;
  let language = "zh";
  const dictionaries = new Map();
  let refusal;
  const mutations = [];
  const downloads = [];
  const discovery = [];
  const fake = {
    mutations, downloads, discovery,
    get view() { return view; },
    get writable() { return writable; },
    set writable(value) { writable = value; },
    get locale() { return language; },
    set locale(value) { language = value; },
    setView(next) { view = structuredClone(next); },
    refuse(message) { refusal = message; },
    emit(event, value) { for (const callback of listeners.get(event) ?? []) callback(value); },
    externalEdit() { view = { ...view, revision: view.revision + 1 }; },
    fetch: async () => ({ ok: true, json: async () => ({ "openai/gpt-6-sol": {
      name: "GPT-6 Sol", limit: { context: 1000000, output: 128000 }, modalities: { input: ["text", "image"] }, reasoning: false
    } }) }),
    schema: { rehydrate: (value) => value,
      getPath: getAt, hasPath: hasAt,
      setPath: (value, path, next) => candidate({ value }, { op: "set", path, value: next }),
      deletePath: (value, path) => candidate({ value }, { op: "unset", path }),
      nodeAtPath: (_root, path) => path.at(-1) === "api" ? { type: "union", list: [{ value: "openai-completions" }, { value: "openai-responses" }] } : path.at(-1) === "reasoningEfforts" ? { list: [{ type: "dict", sKey: { list: ["off", "low", "medium", "high"].map((value) => ({ value })) } }] } : {},
      validate: (_root, value) => {
      for (const profile of Object.values(value.providers ?? {})) for (const model of profile.models ?? []) {
        if (model.maxTokens !== undefined && model.maxTokens <= 0) return "maxTokens must be positive";
      }
    } },
    services: {
      remote: { $on(event, callback) { const callbacks = listeners.get(event) ?? new Set(); callbacks.add(callback); listeners.set(event, callbacks); return () => callbacks.delete(callback); } },
      "remote.settings": {
        describe: async () => ({ ok: true, value: { writable, namespaces: [structuredClone(view)] } }),
        mutate: async (ns, operations, revision) => {
          assert.equal(ns, "llm-pi-ai");
          if (revision !== view.revision) return { ok: false, error: { code: "settings/conflict", message: "stale revision" } };
          if (refusal) return { ok: false, error: { code: "settings/invalid", message: refusal } };
          mutations.push(structuredClone(operations));
          const value = candidate(view, operations);
          view = { ...view, revision: view.revision + 1, value: structuredClone(value), user: structuredClone(value) };
          return { ok: true, value: structuredClone(view) };
        }
      },
      "remote.llm": {
        listConfigurableProviders: async () => ({ ok: true, value: [{ provider: "gateway", settingsNs: "llm-pi-ai", declared: true }] }),
        discoverModels: async (_ns, request) => { discovery.push(request); return { ok: true, value: [{ id: "catalog-model", name: "Catalog" }] }; }
      }
    },
    localeService: {
      register: (ns, values) => { dictionaries.set(ns, values); },
      bind: (ns) => (key) => dictionaries.get(ns)?.[language]?.[key] ?? key
    }
  };
  return fake;
}
function createSnapshotStore(initial) {
  let snapshot = initial;
  const subscribers = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); },
    update(fn) { const next = structuredClone(snapshot); fn(next); snapshot = next; for (const notify of subscribers) notify(); }
  };
}
const primitives = new Proxy({
  Modal,
  Checkbox: ({ label, checked, disabled, onChange }) => React.createElement("label", null,
    React.createElement("input", { type: "checkbox", checked, disabled, onChange: (event) => onChange(event.target.checked) }), label),
  Tooltip: ({ children }) => children,
  SegmentedControl: ({ options, value, onChange }) => React.createElement("div", { role: "tablist" }, options.map((option) =>
    React.createElement("button", { type: "button", role: "tab", key: option.value, "aria-selected": value === option.value, disabled: option.disabled, onClick: () => onChange(option.value) }, option.label)))
}, { get: (object, key) => object[key] ?? (() => null) });
async function mount(t, configure = () => {}) {
  const fake = host(); configure(fake);
  let plugin, native;
  class FixtureURL extends URL {
    static createObjectURL(blob) { fake.downloads.push(blob); return "blob:fixture"; }
    static revokeObjectURL() {}
  }
  const sandbox = {
    window: { __ModuleLoader__: { load: (entry) => { plugin = entry; } } },
    document, console, structuredClone, URL: FixtureURL, Blob, AbortController, setTimeout, clearTimeout, fetch: (...args) => fake.fetch(...args),
    __DSH_MODELS_ONBOARDING__: { credentialOnboarding: false }, dshDesktop: {}
  };
  vm.runInNewContext(source, sandbox);
  sandbox.window.__ModuleLoader__.load = (entry) => { native = entry; };
  vm.runInNewContext(nativeSource, sandbox);
  const nativeClient = native.factory((name) => ({
    react: React, "react/jsx-runtime": jsxRuntime,
    "@deepseek-ai/dsh-client-ui-primitives": primitives,
    "@deepseek-ai/dsh-client-store": { createSnapshotStore }
  })[name]);
  const client = plugin.factory((name) => { assert.equal(name, "react"); return React; });
  const core = new SlotCore();
  core.register({ name: "root", children: {
    "settings.section": { kind: "list", scope: "root" }, "settings.onboarding": { kind: "list", scope: "root" }
  } }, () => null);
  const effects = [];
  const ctx = {
    slots: {
      inject: (_name, callback) => callback(), register: (options, component) => core.register(options, component),
      entries: (key) => core.entries(key), subscribe: (key, fn) => core.subscribe(key, fn)
    },
    locale: fake.localeService, settingsSchema: fake.schema, get: (name) => fake.services[name], effect: (callback) => effects.push(callback()),
    remote: { ...fake.services.remote, settings: fake.services["remote.settings"], llm: fake.services["remote.llm"], credentials: {} },
    on: () => () => {}, configForms: { describe: () => ({}), get: () => ({}) }
  };
  nativeClient.apply(ctx);
  const entry = core.entries("settings.section")[0];
  const injection = entry.inject();
  const refresh = async () => injection.controller.store.update((state) => {
    state.status = "ready"; state.writable = fake.writable; state.namespaces = new Map([["llm-pi-ai", fake.view]]);
    state.rows = [{ entry: { provider: "gateway", displayName: "Gateway", settingsNs: "llm-pi-ai", settingsPath: ["providers", "gateway"], declared: true, active: true }, configured: true, removable: true,
      apiKeyEnv: "GATEWAY_API_KEY", credential: { configured: true } }];
  });
  injection.controller.load = refresh;
  await refresh();
  client.apply(ctx);
  const container = document.createElement("main"); document.body.append(container);
  const root = createRoot(container);
  const useSnapshot = (selector) => selector(React.useSyncExternalStore(injection.hooks.snapshot.subscribe, injection.hooks.snapshot.getSnapshot));
  const renderSlot = (name, owner) => React.createElement(React.Fragment, null, core.entriesOfSlot(name).map((item, index) =>
    React.createElement(item.component, { key: index, ...item.inject?.(), ...owner })));
  const render = async () => act(async () => root.render(React.createElement(entry.component, { ...injection, useSnapshot, renderSlot })));
  await render();
  t.after(async () => { await act(async () => { root.unmount(); effects.reverse().forEach((dispose) => dispose?.()); }); container.remove(); });
  return { fake, container, render, refresh, core };
}
function button(container, name) {
  const result = [...container.querySelectorAll("button")].find((element) => element.textContent.trim() === name || element.getAttribute("aria-label") === name);
  assert.ok(result, `button not found: ${name}`); return result;
}
async function click(element) { await act(async () => element.click()); }
async function input(element, value) {
  assert.ok(element);
  await act(async () => {
    const prototype = element.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : element.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new window.Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function importFile(container, value) {
  const element = container.querySelector('input[type="file"]');
  Object.defineProperty(element, "files", { configurable: true, value: [{ name: "fixture.json", text: async () => JSON.stringify(value) }] });
  await act(async () => element.dispatchEvent(new window.Event("change", { bubbles: true })));
}
const bundle = (providers) => ({ format: "dsh-custom-provider/providers", version: 1, omittedHeaders: [], providers });

async function expand(container, position = 1) {
  if (!container.querySelector(`button[aria-label="模型选项 ${position}"]`)) await click(button(container, "编辑 Gateway (gateway)"));
  const advanced = container.querySelectorAll('button[aria-expanded]');
  const toggle = [...advanced].find((item) => item.getAttribute("aria-label")?.endsWith(` ${position}`));
  assert.ok(toggle, `model details toggle ${position}`);
  if (toggle.getAttribute("aria-expanded") === "false") await click(toggle);
  return container.querySelectorAll(".dcp-inline-tools")[position - 1];
}

test("the real official page gets a title toolbar and inline tools only in expanded model details", async (t) => {
  const { container, fake, render, core } = await mount(t);
  assert.equal(container.querySelector(".dcp-page-head h2").textContent, "模型");
  assert.ok(button(container.querySelector(".dcp-page-head"), "导入配置"));
  assert.equal(container.querySelectorAll(".dcp-inline-tools").length, 0);
  assert.equal(core.entries("settings.models.footer").length, 0);
  await expand(container);
  assert.equal(container.querySelectorAll(".dcp-inline-tools").length, 1);
  assert.equal(container.querySelectorAll('button[aria-expanded="true"]').length, 1);
  assert.ok(container.querySelector('.dcp-inline-tools').parentElement.className.endsWith("modelAdvanced"));
  assert.doesNotMatch(container.textContent, /模型增强|保存 JSON/);
  assert.equal(container.querySelector('[role="dialog"]'), null);
  fake.locale = "en"; await render();
  assert.ok(button(container, "Fetch from models.dev"));
  assert.ok(button(container, "Import configuration"));
});

test("metadata updates native fields and JSON together; only native Save persists the provider draft", async (t) => {
  const { container, fake } = await mount(t);
  await expand(container);
  assert.equal(fake.discovery.length, 0);
  const capacity = container.querySelector('input[aria-label="上下文窗口 1"]');
  await input(capacity, "64K");
  await click(button(container, "从 models.dev 拉取"));
  assert.equal(fake.mutations.length, 0);
  assert.equal(capacity.value, "1000000", "a prior native typing buffer does not hide fetched metadata");
  assert.equal(container.querySelector('input[aria-label="显示名称 1"]').value, "GPT-6 Sol");
  const draft = JSON.parse(container.querySelector("textarea").value);
  assert.equal(draft.contextWindow, 1000000); assert.equal(draft.maxTokens, 128000);
  assert.deepEqual(draft.reasoningEfforts, { high: "wire-high" });
  assert.deepEqual(draft.compat, { supportsStore: false });
  await input(capacity, "96K");
  assert.equal(JSON.parse(container.querySelector("textarea").value).contextWindow, 96000, "native changes synchronize into clean JSON");
  await click(button(container, "保存"));
  assert.equal(fake.mutations.length, 1);
  assert.equal(fake.view.value.providers.gateway.models[0].contextWindow, 96000);
  assert.deepEqual(fake.view.value.providers.gateway.models[1], { id: "sibling", name: "Sibling", maxTokens: 2048 });
  assert.deepEqual(fake.view.value.providers.gateway.headers, { "X-Fixture": "keep" });
});

test("inline JSON applies to the current row, preserving native unsaved fields and other models", async (t) => {
  const { container, fake } = await mount(t);
  const row = await expand(container);
  await input(container.querySelector('input[aria-label="显示名称 2"]'), "Unsaved sibling");
  await input(row.querySelector("textarea"), '{"id":"gpt-6-sol","name":"JSON model","contextWindow":32000,"maxTokens":8192,"compat":{"supportsStore":true}}');
  await click(button(row, "应用到表单"));
  assert.equal(fake.mutations.length, 0);
  assert.equal(container.querySelector('input[aria-label="显示名称 1"]').value, "JSON model");
  assert.equal(container.querySelector('input[aria-label="输出上限 1"]')?.value ?? container.querySelector('input[aria-label="最大输出 1"]')?.value ?? [...container.querySelectorAll('input[inputmode="numeric"]')][1].value, "8192");
  await click(button(container, "保存"));
  assert.equal(fake.view.value.providers.gateway.models[0].maxTokens, 8192);
  assert.equal(fake.view.value.providers.gateway.models[1].name, "Unsaved sibling");
});

test("invalid JSON and concurrent native edits retain the raw draft without overwriting the form", async (t) => {
  const { container, fake } = await mount(t);
  const row = await expand(container);
  const textarea = row.querySelector("textarea");
  await input(textarea, '{"id":"changed"}'); await click(button(row, "应用到表单"));
  assert.match(row.textContent, /must remain gpt-6-sol/);
  assert.equal(textarea.value, '{"id":"changed"}'); assert.equal(fake.mutations.length, 0);
  await input(textarea, '{"id":"gpt-6-sol","maxTokens":-1}'); await click(button(row, "应用到表单"));
  assert.match(row.textContent, /must be a positive integer/);
  await input(textarea, '{"id":"gpt-6-sol","maxTokens":8192}');
  await input(container.querySelector('input[aria-label="显示名称 1"]'), "Native change");
  await click(button(row, "应用到表单"));
  assert.match(row.textContent, /表单已有修改/);
  assert.equal(textarea.value, '{"id":"gpt-6-sol","maxTokens":8192}');
  await click(button(row, "重置 JSON"));
  assert.equal(JSON.parse(textarea.value).name, "Native change");
});

test("the native Save keeps its draft after a settings refusal or revision conflict", async (t) => {
  const { container, fake } = await mount(t);
  const row = await expand(container);
  await input(row.querySelector("textarea"), '{"id":"gpt-6-sol","maxTokens":8192}');
  await click(button(row, "应用到表单"));
  fake.refuse("adapter refused fixture");
  await click(button(container, "保存"));
  assert.match(container.textContent, /adapter refused fixture/);
  assert.equal(JSON.parse(row.querySelector("textarea").value).maxTokens, 8192);
  fake.refuse(undefined); fake.externalEdit();
  await click(button(container, "保存"));
  assert.match(container.textContent, /changed|修改|冲突/);
  assert.equal(JSON.parse(row.querySelector("textarea").value).maxTokens, 8192);
  assert.equal(fake.mutations.length, 0);
});

test("network failures leave the official draft untouched", async (t) => {
  const { container, fake } = await mount(t, (fake) => { fake.fetch = async () => { throw new Error("offline fixture"); }; });
  const row = await expand(container);
  const before = row.querySelector("textarea").value;
  await click(button(row, "从 models.dev 拉取"));
  assert.match(row.textContent, /offline fixture/);
  assert.equal(row.querySelector("textarea").value, before); assert.equal(fake.mutations.length, 0);
});

test("read-only official forms disable inline edits while the header export remains available", async (t) => {
  const { container, fake } = await mount(t, (fake) => { fake.writable = false; });
  const row = await expand(container);
  assert.equal(row.querySelector("textarea").disabled, true);
  assert.equal(button(row, "从 models.dev 拉取").disabled, true);
  assert.equal(button(row, "应用到表单").disabled, true);
  await click(button(container, "导出配置"));
  assert.equal(button(container, "下载 JSON").disabled, false);
  assert.equal(fake.mutations.length, 0);
});

test("import skips existing routes by default and adds only the selected new route", async (t) => {
  const { container, fake } = await mount(t);
  await click(button(container, "导入配置"));
  await importFile(container, bundle({ gateway: { models: [{ id: "replacement" }] }, added: { api: "openai-completions", models: [{ id: "new" }] } }));
  const actions = container.querySelectorAll("select");
  assert.equal(actions[0].value, "skip"); assert.equal(actions[1].value, "add");
  assert.match(container.textContent, /源模型数/); assert.match(container.textContent, /目标模型数/);
  await click(button(container, "导入所选配置"));
  assert.deepEqual(fake.mutations[0].map((operation) => operation.path), [["providers", "added"]]);
  assert.equal(fake.view.value.providers.gateway.models[0].id, "gpt-6-sol");
  assert.deepEqual(fake.view.value.providers.added.models, [{ id: "new" }]);
});

test("import replacement preserves headers and secret-containing files are refused", async (t) => {
  const { container, fake } = await mount(t);
  await click(button(container, "导入配置"));
  await importFile(container, bundle({ gateway: { api: "openai-responses", models: [{ id: "replacement" }] } }));
  await input(container.querySelector("select"), "replace");
  await click(button(container, "导入所选配置"));
  assert.deepEqual(fake.view.value.providers.gateway.headers, { "X-Fixture": "keep" });
  assert.deepEqual(fake.view.value.providers.gateway.models, [{ id: "replacement" }]);
  await importFile(container, bundle({ added: { apiKey: "fixture-key" } }));
  assert.match(container.textContent, /embedded headers/);
  assert.equal(fake.mutations.length, 1);
});

test("an import preview uses its original revision and retains choices after a conflict", async (t) => {
  const { container, fake } = await mount(t);
  await click(button(container, "导入配置"));
  await importFile(container, bundle({ added: { api: "openai-completions", models: [{ id: "new" }] } }));
  fake.externalEdit();
  await click(button(container, "导入所选配置"));
  assert.match(container.textContent, /配置已被其他编辑更新/);
  assert.equal(container.querySelector("select").value, "add"); assert.equal(fake.mutations.length, 0);
});

test("a transfer settings read failure can be retried from the page header", async (t) => {
  const { container, fake } = await mount(t, (fake) => {
    const describe = fake.services["remote.settings"].describe;
    let first = true;
    fake.services["remote.settings"].describe = async () => {
      if (first) { first = false; return { ok: false, error: { message: "describe fixture unavailable" } }; }
      return describe();
    };
  });
  await click(button(container, "导出配置"));
  assert.match(container.textContent, /describe fixture unavailable/);
  await click(button(container, "重新加载"));
  assert.equal(button(container, "下载 JSON").disabled, false);
});

test("the header export download contains provider settings but no headers or key values", async (t) => {
  const originalClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = () => {};
  t.after(() => { window.HTMLAnchorElement.prototype.click = originalClick; });
  const { container, fake } = await mount(t);
  await click(button(container, "导出配置"));
  await click(button(container, "下载 JSON"));
  assert.equal(fake.downloads.length, 1);
  const exported = JSON.parse(await fake.downloads[0].text());
  assert.equal(exported.providers.gateway.headers, undefined);
  assert.equal(exported.providers.gateway.apiKey, undefined);
  assert.equal(exported.providers.gateway.apiKeyEnv, "GATEWAY_API_KEY");
  assert.deepEqual(exported.providers.gateway.models, fake.view.value.providers.gateway.models);
});

test("unapplied JSON survives collapse and blocks native Save until it is applied or reset", async (t) => {
  const { container, fake } = await mount(t);
  let row = await expand(container);
  const raw = '{"id":"gpt-6-sol","maxTokens":8192}';
  await input(row.querySelector("textarea"), raw);
  assert.equal(button(container, "保存").disabled, true);
  await click(container.querySelector('button[aria-label="模型选项 1"]'));
  assert.equal(container.querySelector("textarea"), null);
  assert.equal(button(container, "保存").disabled, true);
  row = await expand(container);
  assert.equal(row.querySelector("textarea").value, raw);
  await click(button(row, "应用到表单"));
  assert.equal(button(container, "保存").disabled, false);
  await click(button(container, "保存"));
  assert.equal(fake.view.value.providers.gateway.models[0].maxTokens, 8192);
});

test("metadata arriving after native edits is refused instead of overwriting the newer draft", async (t) => {
  let resolveFetch;
  const { container, fake } = await mount(t, (fake) => { fake.fetch = () => new Promise((resolve) => { resolveFetch = resolve; }); });
  const row = await expand(container);
  await click(button(row, "从 models.dev 拉取"));
  assert.equal(button(container, "保存").disabled, true);
  await input(container.querySelector('input[aria-label="显示名称 1"]'), "Edited during fetch");
  await act(async () => { resolveFetch({ ok: true, json: async () => ({ "openai/gpt-6-sol": { name: "Stale fetch name", limit: { context: 1000000 } } }) }); });
  assert.match(row.textContent, /拉取期间模型已修改/);
  assert.equal(container.querySelector('input[aria-label="显示名称 1"]').value, "Edited during fetch");
  assert.equal(fake.mutations.length, 0);
  assert.equal(button(container, "保存").disabled, false);
});

test("deleting an earlier row preserves a sibling's pending JSON and applying edits the surviving model", async (t) => {
  const { container, fake } = await mount(t);
  await expand(container);
  const second = await expand(container, 2);
  const raw = '{"id":"sibling","name":"Edited sibling","maxTokens":4096}';
  await input(second.querySelector("textarea"), raw);
  await click(container.querySelector('button[aria-label="删除模型 1"]'));
  const survivor = container.querySelector(".dcp-inline-tools");
  assert.equal(survivor.querySelector("textarea").value, raw);
  await click(button(survivor, "应用到表单"));
  await click(button(container, "保存"));
  assert.deepEqual(fake.view.value.providers.gateway.models, [{ id: "sibling", name: "Edited sibling", maxTokens: 4096 }]);
});

test("new custom providers use inline model tools before the first official create", async (t) => {
  const { container, fake } = await mount(t);
  await click(button(container, "添加模型提供商"));
  await click(button(container, "自定义模型 API"));
  await input(container.querySelector('input[placeholder="acme-gateway"]'), "new-gateway");
  await input(container.querySelector('input[aria-label="API 地址"]'), "https://new.invalid/v1");
  await click(button(container, "添加模型"));
  await input(container.querySelector('input[aria-label="模型 ID 1"]'), "gpt-6-sol");
  await click(container.querySelector('button[aria-label="模型选项 1"]'));
  const row = container.querySelector(".dcp-inline-tools");
  await click(button(row, "从 models.dev 拉取"));
  assert.equal(fake.mutations.length, 0);
  assert.equal(JSON.parse(row.querySelector("textarea").value).contextWindow, 1000000);
  assert.equal(button(container, "创建提供商").disabled, false);
  await click(button(container, "创建提供商"));
  assert.equal(fake.mutations.length, 1);
  assert.equal(fake.view.value.providers["new-gateway"].models[0].name, "GPT-6 Sol");
  assert.equal(fake.view.value.providers.gateway.models[0].name, "Gateway GPT");
});
