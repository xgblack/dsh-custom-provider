# dsh-custom-provider

Model tools embedded in the official DeepSeek Harness **Models** settings page.

[简体中文](docs/README.zh.md)

The official page manages providers, credentials, model lists, and reasoning capabilities. This plugin adds only:

- **models.dev metadata**: fill a model's name, context window, output limit, and supported text/image inputs.
- **Single-model JSON editing**: edit one model while preserving sibling models and advanced fields.
- **Configuration import/export**: transfer selected `llm-pi-ai` provider profiles without credential values or request headers.

The plugin registers no separate settings page and stores no separate model configuration.

## Requirements and installation

Tested with DeepSeek Harness **0.2.1-rc.2**, with the Web Settings surface and the built-in `llm-pi-ai` adapter enabled. Older versions are not supported by this revision.

```sh
dsh plugin --profile web add dsh-custom-provider
```

For a local checkout, run from this repository:

```sh
dsh plugin --profile web add "$PWD"
```

Restart DSH and open **Settings → Models**. The existing official provider cards remain the primary configuration surface.

## Model tools

Open a provider’s official **Edit** form, then expand a model’s **Model options**. Each `llm-pi-ai` model has **Fetch from models.dev** and an inline **Edit JSON** disclosure in its own details. There is no separate model picker or model-tools dialog. New custom providers use the same inline controls.

Fetching updates that row’s official form fields and JSON together, without saving. It imports only `name`, `contextWindow`, `maxTokens`, and supported `input` values, leaving `reasoningEfforts`, `compat`, protocol settings, and credentials unchanged. Matching prefers the original full model ID, then its recognizable official provider, then the first matching bare ID. Requests share a six-hour in-memory cache; a failed refresh never imports an expired snapshot.

Edit the row’s JSON and select **Apply to form**, then use the official provider **Save** button. The ID stays fixed in JSON; rename it through the native ID field. Native form edits update clean JSON automatically. If you have edited JSON and then change native fields, **Reset JSON** before editing again so neither draft silently overwrites the other. Unapplied JSON survives collapsing the model, and prevents provider Save until applied or reset. Saving also waits for metadata requests to finish.

The official editor owns the provider draft, schema validation, inherited model behavior, persistence, and revision conflicts. Applying JSON or fetching metadata makes no separate settings write. Sibling model edits and unsaved provider fields stay in the same draft. Adapter refusals and revision conflicts are displayed by the official form without closing it.

This version uses a narrowly scoped adapter around the registered official Models components because DSH does not yet expose model-detail or page-header slots. It retains the original section, injection, child-slot ownership, controller, forms, and Save operations; it does not modify the installed application. Compatibility depends on the native component structure as well as slots. Recheck the real-page tests when upgrading DSH; do not assume a newer release is compatible solely from its version number.

## Configuration transfer

**Import configuration** and **Export configuration** appear beside the official Models page title, in the same order and toolbar position as the previous plugin. Their preview opens directly below the title.

Export selects configured provider profiles from the effective `llm-pi-ai.providers` settings, including profiles configured in the official page or inherited from a base layer. It omits API key values and custom request headers. `deepseek-account` and `deepseek-official` are excluded. Endpoint URLs may contain sensitive parameters, so inspect and protect the resulting file.

Import accepts the existing version-1 `dsh-custom-provider/providers` JSON format. The preview shows source and destination model counts and whether each provider is new, user-configured, inherited, or layered. Existing providers default to **Skip**; new providers default to **Import**. **Replace** updates the transferred provider fields and model list, preserving destination headers. Unselected providers and the credential store are untouched.

The file retains `apiKeyEnv` names. An imported profile may therefore use an existing credential reference on the destination. Configure missing credentials through the official page after importing. Inherited layers and the installed catalog still determine the final effective settings.

Model writes use the official form’s save path. Imports use the official settings service, its schema, and the exact revision on which the import preview was based. An incompatible file or obsolete revision is rejected without silently adapting it.

## Upgrading from the independent configuration page

Existing providers and models already live in the official `llm-pi-ai` namespace and require no migration. The old **Model configuration** navigation item is removed. The plugin no longer edits credentials or profile registrations, and no longer provides provider management, endpoint discovery, or its own reasoning form.

The package name stays `dsh-custom-provider`, so existing installations can upgrade in place. Keep one plugin registration; do not insert another `llm-pi-ai` adapter for this plugin.

## Development

```sh
pnpm install
npm run build
npm test
npm pack --dry-run --json
```

`lib/client.js` is generated from `lib/client.source.js`, `lib/config.js`, `lib/modelsdev.js`, and `lib/official-models.js` and committed because DSH loads it directly. Tests load the pinned official Models client and cover native draft synchronization and Save, inline JSON and conflict handling, import/export boundaries, adapter cleanup, and persistence through real DSH settings services.

Use an isolated home for browser checks:

```sh
preview_home="$(mktemp -d "${TMPDIR:-/tmp}/dsh-model-tools.XXXXXX")"
DSH_HOME="$preview_home" dsh --profile web --patch "$PWD/test/local.patch.yml" --no-open --port 0
```

## Attribution and license

This project is a fork of [Luck9Star/dsh-gateway-provider](https://github.com/Luck9Star/dsh-gateway-provider). The MIT license and copyright attribution are preserved in [LICENSE](LICENSE).
