import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { test } from "node:test";
import { boot, composeEntries, loadProfileDirectory, readProfilePatches } from "@deepseek-ai/dsh-app-boot";
import ConfigEditor from "@deepseek-ai/dsh-config-editor";
import SettingsForms from "@deepseek-ai/dsh-settings";
import * as plugin from "../index.js";
import { providerImportOperations, replaceModelOperation } from "../lib/config.js";

const require = createRequire(import.meta.url);
const settingsRequire = createRequire(require.resolve("@deepseek-ai/dsh-settings/package.json"));
const schemaURL = pathToFileURL(settingsRequire.resolve("@deepseek-ai/schemastery")).href;
const installAnchor = require.resolve("@deepseek-ai/dsh-config-editor/package.json");
const original = { providers: { gateway: {
  api: "openai-completions", apiKeyEnv: "FIXTURE_API_KEY", headers: { "X-Fixture": "preserved" },
  models: [{ id: "a", name: "A", maxTokens: 2048, reasoningEfforts: { high: "high" } }, { id: "b", name: "B" }]
} } };

function flatten(rows) { return rows.flatMap((row) => row.group ? flatten(row.group) : [row]); }
async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), "dsh-model-tools-host-"));
  const dir = join(home, "profiles", "fixture");
  const base = join(dir, "node_modules", "fixture-base");
  const adapter = join(dir, "node_modules", "fixture-adapter");
  await mkdir(base, { recursive: true });
  await mkdir(adapter, { recursive: true });
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: "fixture-profile", private: true, dsh: { profile: { bundles: ["fixture-base"] } } }));
  await writeFile(join(base, "package.json"), JSON.stringify({ name: "fixture-base", version: "1.0.0", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
  await writeFile(join(base, "cordis.patch.yml"), JSON.stringify([{ insert: [{ id: "llm-pi-ai", name: "fixture-adapter" }] }]));
  await writeFile(join(adapter, "package.json"), JSON.stringify({ name: "fixture-adapter", version: "1.0.0", type: "module", main: "index.js" }));
  await writeFile(join(adapter, "index.js"), `import z from ${JSON.stringify(schemaURL)};\nexport const Config = z.object({ providers: z.dict(z.any()).default({}).volatile() });\nexport function apply() {}\n`);
  await writeFile(join(dir, "cordis.yml"), "[]\n");
  const patchPath = join(dir, "cordis.patch.yml");
  await writeFile(patchPath, JSON.stringify([{ id: "llm-pi-ai", config: original }]));
  const profileContext = { home, dir, patchPath, installAnchor, overlays: [] };
  const loaded = loadProfileDirectory("test", dir, installAnchor);
  const ctx = await boot("test", join(dir, "cordis.yml"), readProfilePatches("test", profileContext, loaded), async (ctx) => {
    ctx.provide("profileContext", profileContext);
    await ctx.plugin(plugin);
    await ctx.plugin(ConfigEditor);
    await ctx.plugin(SettingsForms);
  });
  t.after(async () => { await ctx.fiber.dispose(); });
  const entries = () => flatten(composeEntries([readProfilePatches("test", profileContext, loadProfileDirectory("test", dir, installAnchor))]));
  const view = () => ctx.settings.describe({ redactSecrets: true }).find((item) => item.ns === "llm-pi-ai");
  return { ctx, patchPath, view, entries };
}

test("real DSH settings persist a single-model edit without another adapter registration", async (t) => {
  const { ctx, view, entries } = await fixture(t);
  const current = view();
  const op = replaceModelOperation(current, "gateway", "a", { ...current.value.providers.gateway.models[0], maxTokens: 8192 });
  await ctx.settings.mutate("llm-pi-ai", [op], current.revision);
  assert.equal(view().value.providers.gateway.models[0].maxTokens, 8192);
  assert.deepEqual(view().value.providers.gateway.models[1], original.providers.gateway.models[1]);
  assert.deepEqual(view().value.providers.gateway.headers, original.providers.gateway.headers);
  assert.deepEqual(view().value.providers.gateway.models[0].reasoningEfforts, { high: "high" });
  assert.equal(entries().filter((row) => row.id === "llm-pi-ai").length, 1);
  assert.equal(ctx.customProviderRegistration, undefined);
});

test("real DSH import preserves request headers and rejects an obsolete revision", async (t) => {
  const { ctx, view, patchPath } = await fixture(t);
  const current = view();
  const bundle = { providers: { gateway: { api: "openai-responses", apiKeyEnv: "FIXTURE_API_KEY", models: [{ id: "imported", maxTokens: 4096 }] } } };
  const operations = providerImportOperations(current, bundle, { gateway: "replace" });
  await ctx.settings.mutate("llm-pi-ai", operations, current.revision);
  assert.deepEqual(view().value.providers.gateway.headers, original.providers.gateway.headers);
  assert.deepEqual(view().value.providers.gateway.models, [{ id: "imported", maxTokens: 4096 }]);
  const after = await readFile(patchPath, "utf8");
  await assert.rejects(ctx.settings.mutate("llm-pi-ai", operations, current.revision), /changed|revision|conflict/i);
  assert.equal(await readFile(patchPath, "utf8"), after);
});
