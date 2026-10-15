import assert from "node:assert/strict";
import { test } from "node:test";
import { ADAPTER_ID, ADAPTER_NAME, parseProfilePatches, rewriteAdapterRegistration, touchesAdapter, verifyAdapterRepair } from "../lib/profile-registration.js";

const modelConfig = { providers: { gateway: {
  apiKeyEnv: "FIXTURE_API_KEY", headers: { Authorization: "fixture-only" },
  models: [{ id: "a", maxTokens: 2048, compat: { thinkingFormat: "openai" } }]
} } };
const effective = { id: ADAPTER_ID, name: ADAPTER_NAME, config: modelConfig };
const source = `# User settings
# >>> panel:begin
- insert:
    - id: llm-pi-ai
      name: "@deepseek-ai/dsh-llm-pi-ai"
      config:
        providers:
          gateway:
            models: [{id: a}]
    - id: sibling
      name: sibling-plugin
      config: {keep: true}
# <<< panel:end
- id: expressions
  config:
    value: !!js process.env.FIXTURE_ONLY
`;

test("normalization moves only the duplicate adapter outside the managed block and preserves the complete effective config", () => {
  const repaired = rewriteAdapterRegistration(source, effective);
  const patches = parseProfilePatches(repaired);
  assert.deepEqual(patches[0].insert.map((row) => row.id), ["sibling"]);
  assert.deepEqual(patches[0].insert[0].config, { keep: true });
  assert.deepEqual(patches.at(-1), effective);
  assert.ok(repaired.indexOf("# <<< panel:end") < repaired.lastIndexOf("- id: llm-pi-ai"));
  assert.deepEqual(patches[1].config.value, { __jsExpr: "process.env.FIXTURE_ONLY" });
});

test("an insert containing only the duplicate becomes a valid top-level override", () => {
  const repaired = rewriteAdapterRegistration('- insert:\n    - id: llm-pi-ai\n      name: "@deepseek-ai/dsh-llm-pi-ai"\n', effective);
  assert.deepEqual(parseProfilePatches(repaired), [effective]);
});

test("JavaScript expressions in the moved model config retain the host expression shape", () => {
  const configured = { ...effective, config: { providers: { gateway: { apiKeyEnv: { __jsExpr: "process.env.FIXTURE_ONLY" } } } } };
  const patches = parseProfilePatches(rewriteAdapterRegistration(source, configured));
  assert.deepEqual(patches.at(-1), configured);
});

test("group-targeted, custom activation, and differently named adapters are not automatically changed", () => {
  assert.throws(() => rewriteAdapterRegistration(source.replace("- insert:", "- id: custom-group\n  insert:"), effective), /custom activation or group target/);
  assert.throws(() => rewriteAdapterRegistration(source.replace('      config:', '      disabled: true\n      config:'), effective), /custom activation or group target/);
  assert.throws(() => rewriteAdapterRegistration(source.replace('"@deepseek-ai/dsh-llm-pi-ai"', 'other-adapter'), effective), /custom activation or group target/);
});

test("verification rejects lost provider fields, changed sibling plugins, and activation changes", () => {
  const before = [{ id: ADAPTER_ID, name: ADAPTER_NAME }, effective, { id: "sibling", name: "sibling" }];
  verifyAdapterRepair(before, [effective, before[2]]);
  assert.throws(() => verifyAdapterRepair(before, [{ ...effective, config: {} }, before[2]]), /model configuration/);
  assert.throws(() => verifyAdapterRepair(before, [effective, { ...before[2], disabled: true }]), /unrelated/);
  assert.throws(() => verifyAdapterRepair(before, [{ ...effective, disabled: true }, before[2]]), /activation/);
  assert.throws(() => verifyAdapterRepair(before, before), /model configuration/);
});

test("higher-priority direct overrides and nested registrations are both recognized", () => {
  assert.equal(touchesAdapter({ id: ADAPTER_ID, config: {} }), true);
  assert.equal(touchesAdapter({ insert: [{ id: "group", group: true, config: [effective] }] }), true);
  assert.equal(touchesAdapter({ insert: [{ id: "sibling" }] }), false);
});

test("malformed YAML and unknown tags cannot reach a repair write", () => {
  assert.throws(() => parseProfilePatches("- insert: ["));
  assert.throws(() => parseProfilePatches("- id: value\n  config: !unknown a"));
  assert.throws(() => parseProfilePatches("id: llm-pi-ai"), /YAML sequence/);
  try { parseProfilePatches("- config: !unknown fixture-secret"); assert.fail("invalid tag accepted"); }
  catch (error) { assert.doesNotMatch(error.message, /fixture-secret/); }
});
