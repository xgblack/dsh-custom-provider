import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

function host() {
  let view = { ns: "llm-pi-ai", schema: {}, revision: 1, base: {}, user: { providers: {} }, value: { providers: {} } };
  const mutations = [];
  let refusal;
  return {
    mutations,
    get view() { return view; },
    reject(message) { refusal = message; },
    schema: {
      rehydrate: (value) => value,
      validate: () => undefined,
      nodeAtPath: () => ({ type: "union", list: [{ value: "openai-completions" }, { value: "openai-responses" }] })
    },
    services: {
      remote: { $on: () => () => {} },
      "remote.credentials": { describe: async () => ({ ok: true, value: {} }) },
      "remote.llm": {
        listConfigurableProviders: async () => ({ ok: true, value: [{ provider: "deepseek", displayName: "DeepSeek", settingsNs: "llm-pi-ai" }] }),
        discoverModels: async () => ({ ok: true, value: [{ id: "deepseek-chat", name: "DeepSeek Chat" }] })
      },
      "remote.settings": {
        describe: async () => ({ ok: true, value: { writable: true, namespaces: [structuredClone(view)] } }),
        mutate: async (ns, ops, revision) => {
          assert.equal(ns, "llm-pi-ai");
          assert.equal(revision, view.revision);
          if (refusal) { const message = refusal; refusal = undefined; return { ok: false, error: { message } }; }
          mutations.push(structuredClone(ops));
          const user = structuredClone(view.user);
          for (const op of ops) {
            let target = user;
            for (const key of op.path.slice(0, -1)) target = target[key] ??= {};
            if (op.op === "unset") delete target[op.path.at(-1)];
            else target[op.path.at(-1)] = structuredClone(op.value);
          }
          view = { ...view, user, value: structuredClone(user), revision: view.revision + 1 };
          return { ok: true, value: structuredClone(view) };
        }
      }
    }
  };
}

async function mount(t) {
  const fake = host();
  let plugin;
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load: (entry) => { plugin = entry; } }, confirm: () => true },
    document, navigator: { language: "zh-CN" }, console, URL
  });
  const client = plugin.factory(() => React);
  let entry;
  const effects = [];
  client.apply({
    slots: { inject: (_name, callback) => callback(), register: (options, component) => { entry = { options, component }; } },
    effect: (callback) => effects.push(callback()), settingsSchema: fake.schema, get: (name) => fake.services[name]
  });
  const container = document.createElement("main");
  document.body.append(container);
  const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); effects.forEach((dispose) => dispose?.()); container.remove(); });
  await act(async () => root.render(React.createElement(entry.component, entry.options.inject())));
  return { container, fake };
}

function button(container, name) {
  const result = [...container.querySelectorAll("button")].find((el) => el.textContent.trim() === name || el.getAttribute("aria-label") === name);
  assert.ok(result, `button not found: ${name}`);
  return result;
}
async function click(el) { await act(async () => el.click()); }
async function input(el, value) {
  assert.ok(el, "input must exist");
  await act(async () => {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
async function createProvider(container) {
  await click(button(container, "添加自定义提供方"));
  await input(container.querySelector("#dcp-create-route"), "team-gateway");
  await input(container.querySelector("#dcp-create-name"), "团队网关");
  await input(container.querySelector("#dcp-create-url"), "https://example.invalid/v1");
  await input(container.querySelector("#dcp-create-model"), "team-chat");
  await click(button(container, "添加"));
  assert.equal(container.querySelector('[role="alert"]')?.textContent, undefined);
}

test("creating a provider renders its card and working model search", async (t) => {
  const { container, fake } = await mount(t);
  await createProvider(container);
  assert.equal(fake.view.user.providers["team-gateway"].models[0].id, "team-chat");
  assert.match(container.textContent, /团队网关/);
  assert.ok(container.querySelector('[aria-label="模型 ID team-chat"]'));
  const search = container.querySelector('[aria-label="搜索模型"]');
  await input(search, "nothing-matches");
  assert.equal(container.querySelector('[aria-label="模型 ID team-chat"]'), null);
  await input(search, "team");
  assert.ok(container.querySelector('[aria-label="模型 ID team-chat"]'));
  await click(button(container, "收起"));
  await click(button(container, "编辑"));
  assert.ok(container.querySelector('[aria-label="模型 ID team-chat"]'));
});
