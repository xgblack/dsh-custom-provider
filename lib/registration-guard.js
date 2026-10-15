import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { composeEntries, loadProfileDirectory, readProfilePatches, reconcileProfilePatches } from "@deepseek-ai/dsh-app-boot";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { ADAPTER_ID, ADAPTER_NAME, flattenEntries, parseProfilePatches, rewriteAdapterRegistration, touchesAdapter, verifyAdapterRepair } from "./profile-registration.js";

/** Use the same reload queue and file lock as ConfigEditor; never write home patches or CLI overlays. */
export async function prepareRegistration(ctx) {
  const run = () => withFileLock(join(ctx.profileContext.dir, "package.json"), async () => {
    const profile = ctx.profileContext;
    const loaded = loadProfileDirectory("dsh", profile.dir, profile.installAnchor);
    const patches = readProfilePatches("dsh", profile, loaded);
    const bundles = loaded.layers.flatMap((layer) => layer.patches);
    const higher = patches.slice(bundles.length + loaded.patches.length);
    if (higher.some(touchesAdapter)) return {
      repaired: false,
      blocked: "A home patch or command-line overlay controls llm-pi-ai. Move that adapter configuration into the active profile patch before editing."
    };
    const entries = flattenEntries(composeEntries([patches]));
    const adapters = entries.filter((row) => row.id === ADAPTER_ID);
    if (adapters.length === 1) return { repaired: false };
    const inherited = flattenEntries(composeEntries([bundles])).filter((row) => row.id === ADAPTER_ID);
    if (adapters.length < 2 || inherited.length !== 1 || adapters.some((row) => row.name !== ADAPTER_NAME)) return {
      repaired: false,
      blocked: "llm-pi-ai must have exactly one adapter registration. The conflict is outside a safe profile insertion; review the profile and bundle registrations."
    };
    const before = await readFile(profile.patchPath, "utf8");
    if (!isDeepStrictEqual(parseProfilePatches(before), loaded.patches)) throw new Error("Profile patch changed during registration repair; reload and retry");
    let after;
    let nextPatches;
    try {
      after = rewriteAdapterRegistration(before, adapters.at(-1));
      nextPatches = readProfilePatches("dsh", profile, { ...loaded, patches: parseProfilePatches(after) });
      verifyAdapterRepair(entries, flattenEntries(composeEntries([nextPatches])));
    } catch (error) {
      return { repaired: false, blocked: error.message };
    }
    if (await readFile(profile.patchPath, "utf8") !== before) throw new Error("Profile patch changed during registration repair; reload and retry");
    const backup = profile.patchPath + ".before-provider-registration-" + new Date().toISOString().replace(/[-:.]/g, "") + ".bak";
    await writeFile(backup, before, { flag: "wx", mode: 0o600 });
    await writeFileAtomic(profile.patchPath, after, { mode: 0o600 });
    try {
      await reconcileProfilePatches(ctx.root, nextPatches, "dsh");
    } catch (error) {
      try {
        await writeFileAtomic(profile.patchPath, before, { mode: 0o600 });
        await reconcileProfilePatches(ctx.root, patches, "dsh");
      } catch (rollback) {
        throw new AggregateError([error, rollback], "Registration repair and rollback both failed; restore the profile patch from its before-provider-registration backup");
      }
      throw error;
    }
    ctx.logger.info("Repaired duplicate llm-pi-ai registration; original profile patch backed up at %s", backup);
    return { repaired: true };
  });
  const hmr = ctx.get("hmr");
  try {
    return await (hmr === undefined ? run() : hmr.runExclusive(run));
  } catch (error) {
    // YAMLException messages contain source excerpts, which may include request headers or secrets.
    if (error.name === "YAMLException" || /^dsh: failed to parse overlay\b/.test(error.message)) throw new Error("A configuration patch contains invalid YAML; correct it before editing model settings");
    throw error;
  }
}
