import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { test } from "node:test";
import { stringify } from "yaml";
import { boot, composeEntries, loadProfileDirectory, readProfilePatches } from "@deepseek-ai/dsh-app-boot";
import ConfigEditor from "@deepseek-ai/dsh-config-editor";
import SettingsForms from "@deepseek-ai/dsh-settings";
import TypertRegistry from "@deepseek-ai/dsh-typert-registry";
import * as providerPlugin from "../index.js";
import { prepareRegistration } from "../lib/registration-guard.js";
import { providerImportOperations, patchModelOperation } from "../lib/config.js";
import { ADAPTER_ID, ADAPTER_NAME, flattenEntries } from "../lib/profile-registration.js";

const require = createRequire(import.meta.url);
const settingsRequire = createRequire(require.resolve("@deepseek-ai/dsh-settings/package.json"));
const schemaURL = pathToFileURL(settingsRequire.resolve("@deepseek-ai/schemastery")).href;
const installAnchor = require.resolve("@deepseek-ai/dsh-config-editor/package.json");
const original = { providers: { gateway: {
  apiKeyEnv: "FIXTURE_API_KEY", headers: { "X-Fixture": "preserved" },
  models: [{ id: "imported-a", name: "Imported", maxTokens: 2048, compat: { thinkingFormat: "openai" } }, { id: "sibling-b" }]
} } };

async function fixture(t, { overlay = [], homePatches = [], activation = {} } = {}) {
  const home = await mkdtemp(join(tmpdir(), "provider-registration-test-"));
  const dir = join(home, "profiles", "fixture");
  const base = join(dir, "node_modules", "fixture-base");
  const adapter = join(dir, "node_modules", "@deepseek-ai", "dsh-llm-pi-ai");
  await mkdir(base, { recursive: true });
  await mkdir(adapter, { recursive: true });
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: "fixture-profile", private: true, dsh: { profile: { bundles: ["fixture-base"] } } }));
  await writeFile(join(base, "package.json"), JSON.stringify({ name: "fixture-base", version: "1.0.0", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
  await writeFile(join(base, "cordis.patch.yml"), stringify([{ insert: [{ id: ADAPTER_ID, name: ADAPTER_NAME }] }]));
  await writeFile(join(adapter, "package.json"), JSON.stringify({ name: ADAPTER_NAME, version: "0.2.1-alpha.3", type: "module", main: "index.js" }));
  await writeFile(join(adapter, "index.js"), `import z from ${JSON.stringify(schemaURL)};\nexport const Config = z.object({providers: z.dict(z.any()).default({}).volatile()});\nexport function apply() {}\n`);
  await writeFile(join(dir, "cordis.yml"), "[]\n");
  const patchPath = join(dir, "cordis.patch.yml");
  await writeFile(patchPath, stringify([{ insert: [{ id: ADAPTER_ID, name: ADAPTER_NAME, config: original, ...activation }] }]));
  if (homePatches.length) await writeFile(join(home, "cordis.patch.yml"), stringify(homePatches));
  const profileContext = { home, dir, patchPath, installAnchor, overlays: overlay };
  const loaded = loadProfileDirectory("test", dir, installAnchor);
  const patches = readProfilePatches("test", profileContext, loaded);
  const ctx = await boot("test", join(dir, "cordis.yml"), patches, async (ctx) => {
    ctx.provide("profileContext", profileContext);
    await ctx.plugin(TypertRegistry);
    await ctx.plugin(providerPlugin);
    await ctx.plugin(ConfigEditor);
    await ctx.plugin(SettingsForms);
  });
  t.after(async () => { await ctx.fiber.dispose(); });
  const entries = () => {
    const loaded = loadProfileDirectory("test", dir, installAnchor);
    return flattenEntries(composeEntries([readProfilePatches("test", profileContext, loaded)]));
  };
  return { home, dir, patchPath, ctx, entries };
}

function currentView(ctx) {
  return ctx.settings.describe({ redactSecrets: true }).find((view) => view.ns === ADAPTER_ID);
}

const modelEdit = (maxTokens) => [{ op: "set", path: ["providers", "gateway", "models"], value: [
  { ...original.providers.gateway.models[0], maxTokens }, original.providers.gateway.models[1]
] }];

test("real ConfigEditor reproduces the save failure, then repair preserves data and repeated edits keep one registration", async (t) => {
  const { dir, patchPath, ctx, entries } = await fixture(t);
  assert.equal(entries().filter((row) => row.id === ADAPTER_ID).length, 2);
  const before = await readFile(patchPath, "utf8");
  await assert.rejects(ctx.settings.mutate(ADAPTER_ID, modelEdit(4096), currentView(ctx).revision), /overridden by a home patch or command-line overlay/);
  assert.equal(await readFile(patchPath, "utf8"), before, "the rejected edit did not create another registration");
  const reflection = ctx.typert.getPackage("dsh-custom-provider");
  assert.ok(reflection, "host remote descriptor is registered with the real Typert registry");
  assert.deepEqual(await ctx.customProviderRegistration.prepare(), { repaired: true });
  assert.deepEqual(currentView(ctx).value, original);
  assert.equal(entries().filter((row) => row.id === ADAPTER_ID).length, 1);
  const backups = (await readdir(dir)).filter((name) => name.includes("before-provider-registration"));
  assert.equal(backups.length, 1);
  assert.equal(await readFile(join(dir, backups[0]), "utf8"), before);
  assert.deepEqual(await prepareRegistration(ctx), { repaired: false });
  assert.equal((await readdir(dir)).filter((name) => name.includes("before-provider-registration")).length, 1, "a clean profile is not backed up or rewritten again");
  await ctx.settings.mutate(ADAPTER_ID, modelEdit(4096), currentView(ctx).revision);
  await ctx.settings.mutate(ADAPTER_ID, modelEdit(8192), currentView(ctx).revision);
  assert.equal(entries().filter((row) => row.id === ADAPTER_ID).length, 1);
  assert.equal(currentView(ctx).value.providers.gateway.models.length, 2);
  assert.equal(currentView(ctx).value.providers.gateway.models[0].maxTokens, 8192);
  assert.deepEqual(currentView(ctx).value.providers.gateway.headers, original.providers.gateway.headers);
  assert.deepEqual(currentView(ctx).value.providers.gateway.models[1], original.providers.gateway.models[1]);
});

for (const kind of ["home", "command line"]) test(`${kind} registration overlays are blocked without modifying any profile data`, async (t) => {
  const patch = { id: ADAPTER_ID, config: original };
  const { patchPath, ctx } = await fixture(t, kind === "home" ? { homePatches: [patch] } : { overlay: [patch] });
  const before = await readFile(patchPath, "utf8");
  const status = await prepareRegistration(ctx);
  assert.equal(status.repaired, false);
  assert.match(status.blocked, /home patch or command-line overlay/);
  assert.equal(await readFile(patchPath, "utf8"), before);
});

test("repair rolls back the exact original patch when Loader reconciliation fails", async (t) => {
  const { patchPath, ctx } = await fixture(t);
  const before = await readFile(patchPath, "utf8");
  const include = [...ctx.loader.entries()].find((entry) => entry.options.id === "include");
  assert.ok(include);
  const update = include.update.bind(include);
  let rejected = false;
  include.update = async (...args) => {
    if (!rejected) { rejected = true; throw new Error("fixture reconciliation failed"); }
    return update(...args);
  };
  await assert.rejects(prepareRegistration(ctx), /fixture reconciliation failed/);
  assert.equal(await readFile(patchPath, "utf8"), before);
  assert.deepEqual(currentView(ctx).value, original);
});

test("importing a provider and editing its model through real settings never adds another adapter or model", async (t) => {
  const { ctx, entries } = await fixture(t);
  await prepareRegistration(ctx);
  const imported = { providers: { gateway: { apiKeyEnv: "FIXTURE_API_KEY", models: [{ id: "new-import", name: "Imported model", maxTokens: 2048 }] } } };
  let view = currentView(ctx);
  await ctx.settings.mutate(ADAPTER_ID, providerImportOperations(view, imported, { gateway: "replace" }), view.revision);
  view = currentView(ctx);
  const op = patchModelOperation(view, "gateway", "new-import", { maxTokens: 4096 });
  await ctx.settings.mutate(ADAPTER_ID, Array.isArray(op) ? op : [op], view.revision);
  assert.equal(entries().filter((row) => row.id === ADAPTER_ID).length, 1);
  assert.deepEqual(currentView(ctx).value.providers.gateway.models, [{ id: "new-import", name: "Imported model", maxTokens: 4096 }]);
  assert.deepEqual(currentView(ctx).value.providers.gateway.headers, original.providers.gateway.headers);
});

test("simultaneous registration checks repair once and create one backup", async (t) => {
  const { ctx, dir, entries } = await fixture(t);
  const results = await Promise.all(Array.from({ length: 4 }, () => prepareRegistration(ctx)));
  assert.equal(results.filter((result) => result.repaired).length, 1);
  assert.equal(entries().filter((row) => row.id === ADAPTER_ID).length, 1);
  assert.equal((await readdir(dir)).filter((name) => name.includes("before-provider-registration")).length, 1);
  assert.deepEqual(currentView(ctx).value, original);
});

test("invalid patch YAML is refused without exposing configuration source excerpts", async (t) => {
  const { ctx, patchPath } = await fixture(t);
  const malformed = "- id: llm-pi-ai\n  config: [fixture-secret\n";
  await writeFile(patchPath, malformed);
  await assert.rejects(prepareRegistration(ctx), (error) => {
    assert.match(error.message, /invalid YAML/);
    assert.doesNotMatch(error.message, /fixture-secret/);
    return true;
  });
  assert.equal(await readFile(patchPath, "utf8"), malformed);
});
