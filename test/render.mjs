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

const HOST_REASONING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

function host() {
  let view = { ns: "llm-pi-ai", schema: {}, revision: 1, base: {}, user: { providers: {} }, value: { providers: {} } };
  const mutations = [];
  const storedKeys = new Set();
  const levels = [...HOST_REASONING_LEVELS];
  let refusal;
  const fakeModelsDev = async () => ({ ok: true, json: async () => ({}) });
  let activeLocale = "zh";
  const dictionaries = {
    zh: { nav: "模型配置" },
    en: { nav: "Model configuration" }
  };
  return {
    mutations,
    levels,
    locale: {
      bind: (namespace) => {
        assert.equal(namespace, "settings.customProvider");
        return (key) => dictionaries[activeLocale][key] ?? key;
      },
      register: (_ns, values) => { dictionaries.zh = values.zh; dictionaries.en = values.en; },
      setLocale: (locale) => { activeLocale = locale; }
    },
    get view() { return view; },
    reject(message) { refusal = message; },
    fetchModelsDev: fakeModelsDev,
    schema: {
      rehydrate: (value) => value,
      // Stands in for the host schema: the reasoningEfforts key vocabulary is the level list,
      // so a draft carrying any other key is rejected exactly as the real schema rejects it.
      validate: (_root, draft) => {
        for (const [route, profile] of Object.entries(draft?.providers ?? {})) {
          const entries = [...(profile?.models ?? []), ...Object.values(profile?.modelOverrides ?? {})];
          for (const [index, entry] of entries.entries()) {
            const efforts = entry?.reasoningEfforts;
            if (efforts === undefined || efforts === false) continue;
            const path = `$.providers.${route}.models[${index}].reasoningEfforts`;
            if (typeof efforts !== "object" || efforts === null || Array.isArray(efforts)) {
              return `${path} expected false | dict but got ${JSON.stringify(efforts)}`;
            }
            for (const [level, wire] of Object.entries(efforts)) {
              if (!levels.includes(level)) return `${path} unexpected key ${JSON.stringify(level)}`;
              if (wire !== null && typeof wire !== "string") return `${path}.${level} expected string | null`;
            }
          }
        }
        return undefined;
      },
      nodeAtPath: (_root, path) => path.at(-1) === "reasoningEfforts"
        ? { type: "union", list: [
          { type: "const", value: false },
          { type: "dict", inner: { type: "union", list: [{ type: "string" }, { type: "const", value: null }] },
            sKey: { type: "union", list: levels.map((value) => ({ type: "const", value })) } }
        ] }
        : { type: "union", list: [{ value: "openai-completions" }, { value: "openai-responses" }] }
    },
    services: {
      remote: { $on: () => () => {} },
      "remote.credentials": {
        describe: async (refs) => ({ ok: true, value: Object.fromEntries(refs.map((ref) =>
          [ref, { configured: storedKeys.has(ref), writable: true }])) }),
        set: async (ref) => { storedKeys.add(ref); return { ok: true }; }
      },
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

async function mount(t, configure = () => {}) {
  const fake = host();
  configure(fake);
  let plugin;
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load: (entry) => { plugin = entry; } }, confirm: () => true },
    document, navigator: { language: "zh-CN" }, console, URL, AbortController, setTimeout, clearTimeout,
    fetch: (...args) => fake.fetchModelsDev(...args)
  });
  const client = plugin.factory(() => React);
  let entry;
  const effects = [];
  client.apply({
    slots: { inject: (_name, callback) => callback(), register: (options, component) => { entry = { options, component }; } },
    effect: (callback) => effects.push(callback()), settingsSchema: fake.schema, locale: fake.locale, get: (name) => fake.services[name]
  });
  const container = document.createElement("main");
  document.body.append(container);
  const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); effects.forEach((dispose) => dispose?.()); container.remove(); });
  await act(async () => root.render(React.createElement(entry.component, entry.options.inject())));
  return { container, fake, entry, root };
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
function modelEntry(container, modelId) {
  const row = [...container.querySelectorAll(".dcp-model-entry")]
    .find((entry) => entry.querySelector(`[aria-label="模型 ID ${modelId}"]`));
  assert.ok(row, `model row not found: ${modelId}`);
  return row;
}
async function openReasoning(container, modelId) {
  await click(button(container, `展开模型 ${modelId}`));
  const row = modelEntry(container, modelId);
  const advanced = row.querySelector(".dcp-model-advanced");
  const reasoningSwitch = advanced.querySelectorAll('input[role="switch"]')[1];
  assert.ok(reasoningSwitch, "the reasoning switch must exist");
  if (!reasoningSwitch.checked) await click(reasoningSwitch);
  return row;
}
function levelRow(row, name) {
  const found = [...row.querySelectorAll(".dcp-level-row")]
    .find((entry) => entry.querySelector(".dcp-level-name span").textContent === name);
  assert.ok(found, `reasoning level row not found: ${name}`);
  return found;
}
function reasoningFailure(row) {
  return row.querySelector(".dcp-reasoning-levels .dcp-error")?.textContent ?? "";
}
async function createProvider(container, key = "", expectFailure = false) {
  await click(button(container, "添加模型供应商"));
  await click(button(container, "自定义模型 API"));
  await input(container.querySelector("#dcp-create-route"), "team-gateway");
  await input(container.querySelector("#dcp-create-name"), "团队网关");
  await input(container.querySelector("#dcp-create-url"), "https://example.invalid/v1");
  assert.equal(container.querySelector("#dcp-create-model"), null, "a provider starts without a model id");
  if (key) await input(container.querySelector("#dcp-create-key"), key);
  await click(button(container, "获取可用模型"));
  await settle();
  await click(button(container, "添加"));
  await settle();
  if (!expectFailure) assert.equal(container.querySelector('[role="alert"]')?.textContent, undefined);
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
  assert.ok(fetchButton.parentElement.classList.contains("dcp-actions"), "model discovery uses the shared actions layout");
  assert.equal(fetchButton.parentElement.classList.contains("dcp-actions-start"), false, "model discovery is right aligned");
  await click(fetchButton);
  await settle();
  assert.match(container.textContent, /DeepSeek Chat/);
  const remove = [...container.querySelectorAll("button")].find((el) => el.textContent.trim() === "移除");
  assert.ok(remove);
  await click(remove);
  assert.match(container.textContent, /尚未获取模型/);
  assert.equal(fake.view.user.providers["draft-gateway"], undefined);
});

test("settings section follows the host locale dictionary", async (t) => {
  const { container, fake, entry, root } = await mount(t);
  assert.equal(entry.options.label(), "模型配置");
  assert.match(container.textContent, /模型配置/);
  fake.locale.setLocale("en");
  await act(async () => root.render(React.createElement(entry.component, entry.options.inject())));
  assert.equal(entry.options.label(), "Model configuration");
});

test("models.dev fills the model draft; Save model is the only commit action", async (t) => {
  let fetchCount = 0;
  const { container, fake } = await mount(t, (host) => {
    host.services["remote.llm"].discoverModels = async () => ({ ok: true, value: [
      { id: "deepseek-v4.1-flash" }, { id: "gpt-6-sol", contextWindow: 900000 }
    ] });
    host.fetchModelsDev = async () => { fetchCount++; return { ok: true, json: async () => ({
      "other/deepseek-v4.1-flash": { limit: { context: 42 } },
      "deepseek/deepseek-v4.1-flash": { name: "DeepSeek V4.1 Flash", limit: { context: 1000000, output: 384000 }, modalities: { input: ["text", "image"] }, reasoning: true },
      "other/gpt-6-sol": { limit: { context: 42 } },
      "openai/gpt-6-sol": { name: "GPT-6 Sol", limit: { context: 1050000, output: 128000 }, modalities: { input: ["text", "image", "pdf"] }, reasoning: true }
    }) }; };
  });
  await createProvider(container);
  assert.equal(fetchCount, 0, "provider discovery must not fetch models.dev");
  assert.deepEqual(fake.view.user.providers["team-gateway"].models, [
    { id: "deepseek-v4.1-flash" }, { id: "gpt-6-sol", contextWindow: 900000 }
  ]);
  await click(button(container, "展开模型 deepseek-v4.1-flash"));
  const actions = container.querySelector(".dcp-model-entry .dcp-actions");
  assert.deepEqual([...actions.querySelectorAll("button")].map((el) => el.textContent.trim()),
    ["恢复继承", "从 models.dev 拉取", "保存模型"]);
  const writesBeforeImport = fake.mutations.length;
  await click(button(actions, "从 models.dev 拉取"));
  await settle();
  assert.equal(fetchCount, 1);
  assert.equal(fake.mutations.length, writesBeforeImport, "fetching must not write settings");
  assert.deepEqual(fake.view.user.providers["team-gateway"].models, [
    { id: "deepseek-v4.1-flash" }, { id: "gpt-6-sol", contextWindow: 900000 }
  ]);
  assert.doesNotMatch(container.textContent, /已从 models.dev 保存/);
  assert.match(container.textContent, /已填入 models.dev 数据，点击「保存模型」提交/);
  const deepseekRow = [...container.querySelectorAll(".dcp-model-entry")].find((entry) => entry.querySelector('[aria-label="模型 ID deepseek-v4.1-flash"]'));
  assert.equal(deepseekRow.querySelector('[aria-label="模型名称 deepseek-v4.1-flash"]').value, "DeepSeek V4.1 Flash");
  const contextLabel = [...deepseekRow.querySelectorAll(".dcp-model-advanced label")].find((label) => label.textContent === "上下文窗口");
  assert.equal(document.getElementById(contextLabel.htmlFor).value, "1M", "fetching fills the editable field");
  assert.equal([...deepseekRow.querySelectorAll('.dcp-choice-group input[type="checkbox"]')].find((input) => input.value === "image").checked, true);
  assert.equal(button(deepseekRow, "保存模型").disabled, false);
  await input(deepseekRow.querySelector('[aria-label="模型名称 deepseek-v4.1-flash"]'), "My DeepSeek");
  await click(button(deepseekRow, "保存模型"));
  await settle();
  assert.equal(fake.mutations.length, writesBeforeImport + 1);
  assert.equal(fake.view.user.providers["team-gateway"].models[0].name, "My DeepSeek", "user edits after fetch are saved");
  await click(button(container, "展开模型 gpt-6-sol"));
  const gptRow = [...container.querySelectorAll(".dcp-model-entry")].find((entry) => entry.querySelector('[aria-label="模型 ID gpt-6-sol"]'));
  const writesBeforeSecondImport = fake.mutations.length;
  await click(button(gptRow, "从 models.dev 拉取"));
  await settle();
  assert.equal(fetchCount, 1, "a second manual import within six hours reuses the cache");
  assert.equal(fake.mutations.length, writesBeforeSecondImport);
  assert.equal(fake.view.user.providers["team-gateway"].models[1].contextWindow, 900000);
  await click(button(gptRow, "保存模型"));
  await settle();
  assert.deepEqual(fake.view.user.providers["team-gateway"].models, [
    { id: "deepseek-v4.1-flash", name: "My DeepSeek", contextWindow: 1000000, maxTokens: 384000, input: ["text", "image"] },
    { id: "gpt-6-sol", name: "GPT-6 Sol", contextWindow: 1050000, maxTokens: 128000, input: ["text", "image"] }
  ]);
  await click(button(container.querySelector(".dcp-model-catalog"), "获取可用模型"));
  await settle();
  assert.equal(fetchCount, 1);
  assert.equal(fake.view.user.providers["team-gateway"].models[1].contextWindow, 1050000, "subsequent provider discovery keeps the saved user value");
});

test("models.dev failure only affects manual import, leaving provider values untouched", async (t) => {
  let fetchCount = 0;
  const { container, fake } = await mount(t, (host) => {
    host.fetchModelsDev = async () => { fetchCount++; throw new Error("offline"); };
  });
  await createProvider(container);
  assert.equal(fetchCount, 0);
  await click(button(container, "展开模型 deepseek-chat"));
  await click(button(container, "从 models.dev 拉取"));
  await settle();
  assert.match(container.querySelector('.dcp-model-entry [role="alert"]')?.textContent ?? "", /models.dev 拉取失败: .*offline/);
  assert.deepEqual(fake.view.user.providers["team-gateway"].models, [{ id: "deepseek-chat", name: "DeepSeek Chat" }]);
});

test("catalog model import fills the draft, then Save model writes only its override", async (t) => {
  let fetchCount = 0;
  const { container, fake } = await mount(t, (host) => {
    host.view.user.providers.deepseek = {};
    host.view.value.providers.deepseek = {};
    host.services["remote.llm"].discoverModels = async () => ({ ok: true, value: [
      { id: "deepseek-v4.1-flash", name: "Installed", contextWindow: 128000, maxTokens: 8192 }
    ] });
    host.fetchModelsDev = async () => { fetchCount++; return { ok: true, json: async () => ({
      "deepseek/deepseek-v4.1-flash": {
        name: "DeepSeek V4.1 Flash", limit: { context: 1000000, output: 384000 },
        modalities: { input: ["text", "image"] }, reasoning: true
      }
    }) }; };
  });
  await click(button(container, "编辑"));
  await settle();
  assert.equal(fetchCount, 0, "automatic catalog discovery cannot fetch models.dev");
  await click(button(container, "展开模型 deepseek-v4.1-flash"));
  const writesBeforeImport = fake.mutations.length;
  await click(button(container, "从 models.dev 拉取"));
  await settle();
  assert.equal(fetchCount, 1);
  assert.equal(fake.mutations.length, writesBeforeImport);
  assert.equal(fake.view.user.providers.deepseek.modelOverrides, undefined);
  await click(button(container, "保存模型"));
  await settle();
  assert.deepEqual(fake.mutations.at(-1), [{
    op: "set", path: ["providers", "deepseek", "modelOverrides", "deepseek-v4.1-flash"],
    value: { name: "DeepSeek V4.1 Flash", contextWindow: 1000000, maxTokens: 384000, input: ["text", "image"] }
  }]);
  assert.equal(fake.view.user.providers.deepseek.models, undefined);
  await click(button(container, "恢复继承"));
  await settle();
  assert.equal(fake.view.user.providers.deepseek.modelOverrides?.["deepseek-v4.1-flash"], undefined);
});

test("unsaved model or JSON drafts block an immediate models.dev import", async (t) => {
  let fetchCount = 0;
  const { container } = await mount(t, (host) => {
    host.fetchModelsDev = async () => { fetchCount++; return { ok: true, json: async () => ({}) }; };
  });
  await createProvider(container);
  await click(button(container, "展开模型 deepseek-chat"));
  await input(container.querySelector('[aria-label="模型名称 deepseek-chat"]'), "My Model");
  assert.equal(button(container, "从 models.dev 拉取").disabled, true);
  await click(button(container, "保存模型"));
  await settle();
  assert.equal(button(container, "从 models.dev 拉取").disabled, false);
  await input(container.querySelector('[aria-label="当前模型 JSON"]'), '{"id":"deepseek-chat","name":"Pending"}');
  assert.equal(button(container, "从 models.dev 拉取").disabled, true);
  await click(button(container, "重新加载"));
  assert.equal(button(container, "从 models.dev 拉取").disabled, false);
  assert.equal(fetchCount, 0);
});

test("a newly saved provider turns green after its credential is stored without a model edit", async (t) => {
  let releaseSave;
  const { container } = await mount(t, (fake) => {
    const credentials = fake.services["remote.credentials"];
    const store = credentials.set;
    credentials.set = (ref, key) => new Promise((resolve) => {
      releaseSave = () => store(ref, key).then(resolve);
    });
  });
  await createProvider(container, "test-key");
  assert.ok(releaseSave, "settings were written before the credential was stored");
  assert.ok(container.querySelector('[aria-label="缺少 API Key"]'), "an early credential read shows the missing state");
  await act(async () => releaseSave());
  await settle();
  assert.ok(container.querySelector('[aria-label="已配置 API Key"]'), "the dot updates without saving a model or revisiting the page");
  assert.equal(container.querySelector('[aria-label="缺少 API Key"]'), null);
});

test("a stale credential read cannot turn a newly saved provider red again", async (t) => {
  let releaseSave;
  let releaseStaleRead;
  const { container } = await mount(t, (fake) => {
    const credentials = fake.services["remote.credentials"];
    const describe = credentials.describe;
    const store = credentials.set;
    credentials.describe = (refs) => {
      const snapshot = describe(refs);
      if (refs.includes("TEAM_GATEWAY_API_KEY") && !releaseStaleRead) {
        return new Promise((resolve) => { releaseStaleRead = () => snapshot.then(resolve); });
      }
      return snapshot;
    };
    credentials.set = (ref, key) => new Promise((resolve) => {
      releaseSave = () => store(ref, key).then(resolve);
    });
  });
  await createProvider(container, "test-key");
  assert.ok(releaseStaleRead, "a read was started before the key was stored");
  await act(async () => releaseSave());
  await settle();
  assert.ok(container.querySelector('[aria-label="已配置 API Key"]'));
  await act(async () => releaseStaleRead());
  await settle();
  assert.ok(container.querySelector('[aria-label="已配置 API Key"]'), "the old missing response must be ignored");
  assert.equal(container.querySelector('[aria-label="缺少 API Key"]'), null);
});

test("a failed key save stays missing until the retry succeeds", async (t) => {
  let rejectOnce = true;
  const { container } = await mount(t, (fake) => {
    const credentials = fake.services["remote.credentials"];
    const store = credentials.set;
    credentials.set = (ref, key) => {
      if (rejectOnce) { rejectOnce = false; return { ok: false, error: { message: "credential store unavailable" } }; }
      return store(ref, key);
    };
  });
  await createProvider(container, "test-key", true);
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /credential store unavailable/);
  assert.ok(container.querySelector('[aria-label="缺少 API Key"]'));
  await click(button(container, "重试保存密钥"));
  await settle();
  assert.ok(container.querySelector('[aria-label="已配置 API Key"]'));
  assert.equal(container.querySelector('[aria-label="缺少 API Key"]'), null);
});

test("refresh keeps explicit user model fields above new provider and models.dev values", async (t) => {
  let returnedContext = 128000;
  const { container, fake } = await mount(t, (host) => {
    host.services["remote.llm"].discoverModels = async (_ns, request) => ({ ok: true, value: request.provider === "deepseek"
      ? [] : [{ id: "deepseek-chat", name: "Provider", contextWindow: returnedContext, maxTokens: 8192 }] });
    host.fetchModelsDev = async () => ({ ok: true, json: async () => ({
      "deepseek/deepseek-chat": { name: "Web", limit: { context: 2000000, output: 16000 }, modalities: { input: ["text"] } }
    }) });
  });
  await createProvider(container);
  await click(button(container, "展开模型 deepseek-chat"));
  const field = [...container.querySelectorAll(".dcp-model-advanced label")].find((label) => label.textContent === "上下文窗口");
  await input(document.getElementById(field.htmlFor), "1M");
  await click(button(container, "保存模型"));
  await settle();
  returnedContext = 256000;
  await click(button(container.querySelector(".dcp-model-catalog"), "获取可用模型"));
  await settle();
  assert.equal(fake.view.user.providers["team-gateway"].models[0].contextWindow, 1000000);
  assert.equal(fake.view.user.providers["team-gateway"].models[0].maxTokens, 8192);
});

test("refresh keeps customized models missing from the latest provider listing", async (t) => {
  const { container, fake } = await mount(t);
  await createProvider(container);
  await click(button(container, "展开模型 deepseek-chat"));
  const field = [...container.querySelectorAll(".dcp-model-advanced label")].find((label) => label.textContent === "上下文窗口");
  await input(document.getElementById(field.htmlFor), "1M");
  await click(button(container, "保存模型"));
  await settle();
  fake.services["remote.llm"].discoverModels = async () => ({ ok: true, value: [
    { id: "new-model", name: "New Model", contextWindow: 128000 }
  ] });
  await click(button(container.querySelector(".dcp-model-catalog"), "获取可用模型"));
  await settle();
  assert.deepEqual(fake.view.user.providers["team-gateway"].models, [
    { id: "deepseek-chat", name: "DeepSeek Chat", contextWindow: 1000000 },
    { id: "new-model", name: "New Model", contextWindow: 128000 }
  ]);
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
  const levelRows = [...modelAdvanced.querySelectorAll(".dcp-level-row")];
  assert.deepEqual(levelRows.map((row) => row.querySelector(".dcp-level-name span").textContent),
    HOST_REASONING_LEVELS, "every host reasoning level gets one row, in the host's order");
  assert.deepEqual(levelRows.filter((row) => row.querySelector("input.dcp-level-check").checked)
    .map((row) => row.querySelector(".dcp-level-name span").textContent),
    ["off", "low", "high", "max"], "custom reasoning starts with off/low/high/max");
  assert.equal(levelRows.some((row) => row.querySelector("button")), false, "levels are fixed rows, not add/remove ones");
  assert.equal(levelRows.find((row) => row.querySelector(".dcp-level-name span").textContent === "medium")
    .querySelector(".dcp-input").disabled, true, "an unchecked level takes no request value");
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

test("the reasoning level list comes from the host schema", async (t) => {
  const { container } = await mount(t, (host) => { host.levels.splice(0, host.levels.length, "off", "turbo"); });
  await createProvider(container);
  const row = await openReasoning(container, "deepseek-chat");
  assert.deepEqual([...row.querySelectorAll(".dcp-level-name span")].map((el) => el.textContent), ["off", "turbo"],
    "the form renders the host's level vocabulary, not a built-in copy");
});

test("a reasoning level without a wire value blocks the save", async (t) => {
  const { container, fake } = await mount(t);
  await createProvider(container);
  const row = await openReasoning(container, "deepseek-chat");
  await click(levelRow(row, "medium").querySelector("input.dcp-level-check"));
  assert.match(reasoningFailure(row), /medium/);
  assert.equal(button(row, "保存模型").disabled, true, "a draft the adapter cannot serve is not written");
  assert.equal(fake.view.user.providers["team-gateway"].models[0].reasoningEfforts, undefined, "nothing was written");
  await input(levelRow(row, "medium").querySelector(".dcp-input"), "medium");
  assert.equal(reasoningFailure(row), "", "filling the request value clears the failure");
  assert.equal(button(row, "保存模型").disabled, false);
  await click(button(row, "保存模型"));
  await settle();
  assert.deepEqual(fake.view.user.providers["team-gateway"].models[0].reasoningEfforts,
    { off: null, low: "low", medium: "medium", high: "high", max: "max" });
});

test("declaring only off blocks the save", async (t) => {
  const { container, fake } = await mount(t);
  await createProvider(container);
  const row = await openReasoning(container, "deepseek-chat");
  for (const name of ["low", "high", "max"]) await click(levelRow(row, name).querySelector("input.dcp-level-check"));
  assert.match(reasoningFailure(row), /只声明 off/);
  assert.equal(button(row, "保存模型").disabled, true);
  const unsupported = [...row.querySelectorAll('input[type="radio"]')].find((el) => el.value === "disabled");
  await click(unsupported);
  assert.equal(reasoningFailure(row), "");
  assert.equal(button(row, "保存模型").disabled, false);
  await click(button(row, "保存模型"));
  await settle();
  assert.equal(fake.view.user.providers["team-gateway"].models[0].reasoningEfforts, false);
});

test("levels the host does not know are reported and dropped by the next save", async (t) => {
  const profile = {
    api: "openai-completions", baseURL: "https://example.invalid/v1",
    models: [{ id: "gpt-5.6-sol", reasoningEfforts: { off: null, low: "low", ultra: "ultra" } }]
  };
  const { container, fake } = await mount(t, (host) => {
    host.view.user.providers["team-gateway"] = structuredClone(profile);
    host.view.value.providers["team-gateway"] = structuredClone(profile);
  });
  await click(button(container, "编辑"));
  await settle();
  await click(button(container, "展开模型 gpt-5.6-sol"));
  const row = modelEntry(container, "gpt-5.6-sol");
  assert.match(row.querySelector(".dcp-notice").textContent, /ultra/, "an unknown level is surfaced, not silently rendered as a row");
  assert.equal([...row.querySelectorAll(".dcp-level-name span")].some((el) => el.textContent === "ultra"), false);
  await input(row.querySelector('[aria-label="模型名称 gpt-5.6-sol"]'), "Sol");
  await click(button(row, "保存模型"));
  await settle();
  assert.equal(row.querySelector('[role="alert"]'), null, `unexpected write failure: ${row.querySelector('[role="alert"]')?.textContent}`);
  assert.deepEqual(fake.view.user.providers["team-gateway"].models[0].reasoningEfforts, { off: null, low: "low" });
});

test("the JSON editor still defers to the host schema for unknown levels", async (t) => {
  const { container, fake } = await mount(t);
  await createProvider(container);
  await click(button(container, "展开模型 deepseek-chat"));
  const row = modelEntry(container, "deepseek-chat");
  await click(row.querySelector("summary"));
  const textarea = row.querySelector("textarea");
  const draft = JSON.parse(textarea.value);
  draft.reasoningEfforts = { off: null, ultra: "ultra" };
  await input(textarea, JSON.stringify(draft, null, 2));
  const writes = fake.mutations.length;
  await click(button(row, "保存 JSON"));
  await settle();
  assert.equal(fake.mutations.length, writes, "an unknown level never reaches the settings store");
  assert.match(row.querySelector('[role="alert"]').textContent, /unexpected key "ultra"/, "the host schema, not the form, is what refuses this");
});
