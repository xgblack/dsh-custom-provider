# dsh-custom-provider

A provider and model configuration page for the built-in DeepSeek Harness `llm-pi-ai` adapter. It adds **Model configuration** immediately below **Models** in Settings. The official Models page remains untouched; this page can add, edit, and remove provider profiles, store API keys, and configure their models without opening the official page.

## Install

The `llm-pi-ai` plugin and the Web Settings surface must be enabled in the same dsh profile. From this checkout, run an isolated, non-installing local preview:

```sh
npm run build
preview_home="$(mktemp -d "${TMPDIR:-/tmp}/dsh-custom-provider.XXXXXX")"
DSH_HOME="$preview_home" dsh --profile web --patch "$PWD/test/local.patch.yml" --no-open --port 0
```

The output prints a local URL with an access token. The temporary home does not include your existing providers or credentials; configure test entries there. Using `--patch` without the isolated `DSH_HOME` does not install the plugin, but saves from the page would change your normal dsh settings. To install persistently, use `dsh plugin --profile web add "$PWD"` from this repository; `dsh-custom-provider` becomes an npm install target only after publication. The bundle patch already inserts the `dsh-custom-provider` row, so do not add a second row with the same id.

## Model configuration

The page follows the built-in Models page: providers are rendered as a vertical card list, and each card contains its API key, connection settings, model list, and advanced JSON sections. Models stay inside their provider card instead of being split into a separate navigation pane. It preserves dsh's own `llm-pi-ai` schema and storage rules.

- **Providers** can be activated from the installed catalog or declared with a route ID, endpoint, protocol, and first model. Common fields are display name, endpoint, and protocol; provider Advanced JSON edits only that route's user override. A provider defined in the composition cannot be removed here.
- **API keys** are never read back into a form or written to settings JSON. The page derives or uses the configured `apiKeyEnv` reference and stores a new key through `remote.credentials`.
- **Models** in an explicit user list can be added or removed. Installed catalog entries remain in the catalog and are customized through per-model overrides; an inherited composition list remains read-only.

- **Common** exposes model name, reasoning capability, input types, context window, and output limit. Empty values inherit from the provider or installed catalog. Standard reasoning writes an explicit dsh effort map; protocol-specific maps stay available in Advanced JSON.
- **Advanced JSON** contains only the selected model object. It never replaces its provider or sibling models. The model id is fixed so an edit cannot move data to another model.
- An explicit user `models` list is committed as one array after replacing only the selected entry. Other entries and hidden fields are preserved.
- A built-in catalog model writes only `modelOverrides.<model-id>`. Saving `{ "id": "..." }` removes that model's user override. A model list inherited from the profile composition remains read-only because editing one row would otherwise replace the whole inherited list.

Every settings write targets the real `llm-pi-ai` namespace and includes the current revision. Client schema validation runs before mutation; host rejection is shown without clearing the draft. A revision conflict refreshes underlying values while preserving the unsaved editor draft for review. A new key is stored after its provider settings write succeeds; if credential storage fails, retrying the key does not create another provider.

## Development

```sh
npm run build   # generate lib/client.js from lib/client.source.js + lib/config.js
npm test        # model-scope operations, failure paths, and section registration
npm pack --dry-run
```

`lib/client.js` is generated and committed because dsh loads `exports["./client"]` directly. This plugin has no runtime npm dependencies. Real-host acceptance should confirm catalog activation and custom provider creation, endpoint/protocol and key changes, model editing, conflict behavior, and persistence after restart. Only the `llm-pi-ai` adapter is managed here; other dsh adapters retain their own settings pages.

## Attribution

Forked from [Luck9Star/dsh-gateway-provider](https://github.com/Luck9Star/dsh-gateway-provider). The original gateway implementation has been removed; its MIT license and copyright attribution are retained in [LICENSE](LICENSE).
