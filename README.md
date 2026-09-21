# dsh-custom-provider

An additional settings editor for the built-in DeepSeek Harness `llm-pi-ai` adapter. It adds **Advanced settings** inside each `llm-pi-ai` provider card in **Settings → Models**. It does not create provider routes, discover gateway models, handle credentials, or dispatch requests.

## Install

The `llm-pi-ai` plugin and the web Models settings page must be enabled in the same dsh profile. From this checkout, run a non-installing local preview:

```sh
dsh --profile web --patch test/local.patch.yml --no-open --port 0
```

The output prints a local URL with an access token. To install persistently, use `dsh plugin --profile web add "$PWD"` from this repository; `dsh-custom-provider` becomes an npm install target only after publication. The bundle patch inserts the `dsh-custom-provider` row; do not add a second row with the same id. The built-in Models page remains the place to add providers, set credentials, and edit model name/capacity/input and connection basics.

## Editing

- Provider fields include `compat`, `reasoning`, `thinkingBudgets`, request timeouts, transport, headers, retry policy, defaults, and image budgets. Model fields include `reasoningEfforts` and `compat`. The controls follow the installed `llm-pi-ai` settings schema.
- **Save** writes a single user override to the real `llm-pi-ai` section of `~/.dsh/settings.yaml`. **Restore** removes that override and follows the built-in configuration inheritance again. Nested maps and arrays use JSON input; invalid values are rejected without clearing the draft.
- An explicit user `models` list is updated as one array, preserving other entries. A list inherited from the profile composition is read-only here, because changing one entry would replace the whole inherited list. A route using the built-in model catalog instead writes `modelOverrides.<model-id>`; enter an exact built-in model id to add an override. The host rejects ids not in the installed catalog.
- models.dev data is a read-only comparison for name, context window, output limit and input modalities. It is not part of the adapter's inheritance chain and never writes configuration. A suffix match is shown only when unique.

The displayed values are the **resolved settings**, not necessarily the final model capabilities after the adapter combines them with its installed catalog. The host performs the final compatibility and serviceability validation. A stale settings revision is rejected and the card reloads before another edit.

## Development

```sh
npm run build   # generate lib/client.js from lib/client.source.js + lib/config.js
npm test        # configuration paths and client slot registration
npm pack --dry-run
```

The client bundle is generated and committed because dsh loads `exports["./client"]` directly. This plugin has no runtime npm dependencies. A real-host acceptance check should edit an advanced field in Settings → Models, inspect the corresponding `llm-pi-ai` key in `settings.yaml`, restore it, restart dsh, and confirm the namespace and route remain available. Schema-only checks cannot prove the adapter's wire behavior.

## Attribution

Forked from [Luck9Star/dsh-gateway-provider](https://github.com/Luck9Star/dsh-gateway-provider). The original gateway implementation has been removed; its MIT license and copyright attribution are retained in [LICENSE](LICENSE).
