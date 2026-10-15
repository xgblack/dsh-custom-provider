import { isDeepStrictEqual } from "node:util";
import { Document, Scalar, isMap, isSeq, parseDocument, visit } from "yaml";

export const ADAPTER_ID = "llm-pi-ai";
export const ADAPTER_NAME = "@deepseek-ai/dsh-llm-pi-ai";
const jsTag = (resolve) => [{ tag: "tag:yaml.org,2002:js", resolve }];

function documentOf(source, resolve = (value) => value) {
  const document = parseDocument(source, { customTags: jsTag(resolve) });
  const problem = document.errors[0] ?? document.warnings[0];
  if (problem) throw new Error(`Profile patch YAML cannot be parsed (${problem.code}); correct the configuration before editing models`);
  if (!isSeq(document.contents)) throw new Error("Profile patch must be a YAML sequence");
  return document;
}

export function parseProfilePatches(source) {
  return documentOf(source, (value) => ({ __jsExpr: value })).toJS();
}

export function flattenEntries(rows) {
  return rows.flatMap((row) => [row, ...(row.group && Array.isArray(row.config) ? flattenEntries(row.config) : [])]);
}

export function touchesAdapter(patch) {
  return patch.id === ADAPTER_ID || (Array.isArray(patch.insert) && flattenEntries(patch.insert).some((row) => row.id === ADAPTER_ID));
}

/** Remove only redundant profile insertions, then keep their effective config as an id override. */
export function rewriteAdapterRegistration(source, effective) {
  const document = documentOf(source);
  let removed = 0;
  for (let index = document.contents.items.length - 1; index >= 0; index--) {
    const patch = document.contents.items[index];
    if (!isMap(patch) || !isSeq(patch.get("insert", true))) continue;
    const insert = patch.get("insert", true);
    for (let at = insert.items.length - 1; at >= 0; at--) {
      const row = insert.items[at];
      if (!isMap(row) || row.get("id") !== ADAPTER_ID) continue;
      if (patch.items.length !== 1 || row.get("name") !== ADAPTER_NAME ||
          row.items.some((pair) => !["id", "name", "config"].includes(String(pair.key.value)))) {
        throw new Error("The duplicate adapter has a custom activation or group target; repair its registration manually");
      }
      insert.items.splice(at, 1);
      removed++;
    }
    if (!insert.items.length) document.contents.items.splice(index, 1);
  }
  if (!removed) throw new Error("Duplicate adapter registration is outside the profile insert list");
  const override = new Document([{ id: ADAPTER_ID, name: ADAPTER_NAME, config: effective.config ?? {} }]);
  visit(override, { Map(_key, node) {
    if (node.items.length !== 1 || typeof node.get("__jsExpr") !== "string") return;
    const expression = new Scalar(node.get("__jsExpr"));
    expression.tag = "tag:yaml.org,2002:js";
    return expression;
  } });
  // Append after the existing text so an MCP/plugin managed-block end marker stays before this override.
  const remaining = document.contents.items.length ? String(document) : String(document).replace(/^\[\]\n?$/m, "");
  return remaining.trimEnd() + "\n" + String(override);
}

export function verifyAdapterRepair(before, after) {
  const previous = before.filter((row) => row.id === ADAPTER_ID);
  const next = after.filter((row) => row.id === ADAPTER_ID);
  if (next.length !== 1 || !isDeepStrictEqual(next[0].config ?? {}, previous.at(-1)?.config ?? {})) {
    throw new Error("Repair would change the effective model configuration");
  }
  const metadata = (entry) => Object.fromEntries(Object.entries(entry).filter(([key]) => key !== "config"));
  if (!isDeepStrictEqual(metadata(next[0]), metadata(previous.at(-1)))) {
    throw new Error("Repair would change adapter activation options");
  }
  if (!isDeepStrictEqual(before.filter((row) => row.id !== ADAPTER_ID), after.filter((row) => row.id !== ADAPTER_ID))) {
    throw new Error("Repair would change unrelated plugin entries");
  }
}
