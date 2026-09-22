# dsh-custom-provider

A focused model configuration page for the built-in DeepSeek Harness `llm-pi-ai` adapter. It adds **Model configuration** immediately below **Models** in Settings. The official Models page remains untouched and continues to own providers, credentials, endpoints, protocols, and model-list management.

## Install

The `llm-pi-ai` plugin and the Web Settings surface must be enabled in the same dsh profile. From this checkout, run a non-installing local preview:

```sh
dsh --profile web --patch test/local.patch.yml --no-open --port 0
```

The output prints a local URL with an access token. To install persistently, use `dsh plugin --profile web add "$PWD"` from this repository; `dsh-custom-provider` becomes an npm install target only after publication. The bundle patch already inserts the `dsh-custom-provider` row, so do not add a second row with the same id.

## Model configuration

The page follows the provider-to-model navigation used by [pi-web](https://github.com/agegr/pi-web), while preserving dsh's own `llm-pi-ai` schema and storage rules.

- **Common** exposes model name, reasoning capability, input types, context window, and output limit. Empty values inherit from the provider or installed catalog. Standard reasoning writes an explicit dsh effort map; protocol-specific maps stay available in Advanced JSON.
- **Advanced JSON** contains only the selected model object. It never replaces its provider or sibling models. The model id is fixed so an edit cannot move data to another model.
- An explicit user `models` list is committed as one array after replacing only the selected entry. Other entries and hidden fields are preserved.
- A built-in catalog model writes only `modelOverrides.<model-id>`. Saving `{ "id": "..." }` removes that model's user override. A model list inherited from the profile composition remains read-only because editing one row would otherwise replace the whole inherited list.

Every write targets the real `llm-pi-ai` namespace and includes the current settings revision. Client schema validation runs before mutation; host rejection is shown without clearing the draft. A revision conflict refreshes the underlying values while preserving the unsaved editor draft for review.

## Development

```sh
npm run build   # generate lib/client.js from lib/client.source.js + lib/config.js
npm test        # model-scope operations, failure paths, and section registration
npm pack --dry-run
```

`lib/client.js` is generated and committed because dsh loads `exports["./client"]` directly. This plugin has no runtime npm dependencies. Real-host acceptance should confirm the Settings navigation order, catalog discovery, one common-field save, one Advanced JSON save, conflict behavior, restore behavior, and persistence after restart.

## Attribution

Forked from [Luck9Star/dsh-gateway-provider](https://github.com/Luck9Star/dsh-gateway-provider). The original gateway implementation has been removed; its MIT license and copyright attribution are retained in [LICENSE](LICENSE).
