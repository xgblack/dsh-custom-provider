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
async function settle() {
  for (let at = 0; at < 10; at += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
async function createProvider(container) {
  await click(button(container, "添加模型供应商"));
  await click(button(container, "自定义模型 API"));
  await input(container.querySelector("#dcp-create-route"), "team-gateway");
  await input(container.querySelector("#dcp-create-name"), "团队网关");
  await input(container.querySelector("#dcp-create-url"), "https://example.invalid/v1");
  assert.equal(container.querySelector("#dcp-create-model"), null, "a provider starts without a model id");
  await click(button(container, "获取可用模型"));
  await settle();
  await click(button(container, "添加"));
  await settle();
  assert.equal(container.querySelector('[role="alert"]')?.textContent, undefined);
}

test("custom provider discovery can be edited before creation", async (t) => {
  const { container, fake } = await mount(t);
  await click(button(container, "添加模型供应商"));
  await click(button(container, "自定义模型 API"));
  await input(container.querySelector("#dcp-create-route"), "draft-gateway");
  await input(container.querySelector("#dcp-create-url"), "https://example.invalid/v1");
  const keyField = container.querySelector("#dcp-create-key");
  const fetchButton = button(container, "获取可用模型");
  assert.equal(keyField.compareDocumentPosition(fetchButton) & 4, 4, "API Key is above model discovery");
  await click(fetchButton);
  await settle();
  assert.match(container.textContent, /DeepSeek Chat/);
  const remove = [...container.querySelectorAll("button")].find((el) => el.textContent.trim() === "移除");
  assert.ok(remove);
  await click(remove);
  assert.match(container.textContent, /尚未获取模型/);
  assert.equal(fake.view.user.providers["draft-gateway"], undefined);
});

test("creating a provider renders its card and working model search", async (t) => {
  const { container, fake } = await mount(t);
  await createProvider(container);
  assert.deepEqual(fake.view.user.providers["team-gateway"].models, [{ id: "deepseek-chat", name: "DeepSeek Chat" }]);
  assert.match(container.textContent, /团队网关/);
  const customProtocol = container.querySelector("#dcp-provider-api-team-gateway");
  assert.ok(customProtocol);
  assert.equal([...customProtocol.options].some((option) => option.value === ""), false,
    "custom providers cannot inherit a catalog protocol");
  assert.ok(container.querySelector('[aria-label="模型 ID deepseek-chat"]'));
  const search = container.querySelector('[aria-label="搜索模型"]');
  await input(search, "nothing-matches");
  assert.equal(container.querySelector('[aria-label="模型 ID deepseek-chat"]'), null);
  await input(search, "deepseek");
  assert.ok(container.querySelector('[aria-label="模型 ID deepseek-chat"]'));
  await click(button(container, "展开模型 deepseek-chat"));
  const modelAdvanced = container.querySelector(".dcp-model-advanced");
  assert.ok(modelAdvanced);
  assert.match(container.textContent, /编辑 JSON/);
  assert.doesNotMatch(container.textContent, /提供方高级 JSON/);
  assert.equal(modelAdvanced.querySelectorAll('input[role="switch"]').length, 2, "input and reasoning have independent configuration switches");
  await click(modelAdvanced.querySelectorAll('input[role="switch"]')[0]);
  assert.equal(modelAdvanced.querySelectorAll('.dcp-choice-group input[type="checkbox"]').length, 2, "input types use official checkboxes");
  await click([...modelAdvanced.querySelectorAll('.dcp-choice-group input[type="checkbox"]')].find((input) => input.value === "image"));
  const reasoningSwitch = modelAdvanced.querySelectorAll('input[role="switch"]')[1];
  await click(reasoningSwitch);
  const reasoningCustom = [...modelAdvanced.querySelectorAll('input[type="radio"]')].find((input) => input.name.endsWith("-reasoning") && input.value === "custom");
  await click(reasoningCustom);
  assert.equal(modelAdvanced.querySelectorAll(".dcp-level-row").length, 4, "custom reasoning starts with off/low/high/max");
  await click(modelAdvanced.parentElement.querySelector("summary"));
  const contextLabel = [...modelAdvanced.querySelectorAll("label")].find((label) => label.textContent === "上下文窗口");
  await input(document.getElementById(contextLabel.htmlFor), "1M");
  assert.match(modelAdvanced.parentElement.querySelector("textarea").value, /"contextWindow": 1000000/);
  await click(button(container, "保存模型"));
  await settle();
  assert.equal(fake.view.user.providers["team-gateway"].models[0].contextWindow, 1000000);
  assert.deepEqual(fake.view.user.providers["team-gateway"].models[0].input, ["text", "image"]);
  assert.deepEqual(fake.view.user.providers["team-gateway"].models[0].reasoningEfforts, { off: null, low: "low", high: "high", max: "max" });
  await input(search, "");
  const removeModel = button(container, "删除模型 deepseek-chat");
  assert.equal(removeModel.disabled, false);
  await click(removeModel);
  await settle();
  assert.deepEqual(fake.mutations.at(-1), [{ op: "set", path: ["providers", "team-gateway", "models"], value: [] }]);
  assert.deepEqual(fake.view.user.providers["team-gateway"].models, [], "the last model can be removed");
  assert.match(container.textContent, /暂无模型/);
  await click(button(container, "收起"));
  await click(button(container, "编辑"));
  assert.match(container.textContent, /暂无模型/);
});
