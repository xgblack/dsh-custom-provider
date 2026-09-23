# dsh-custom-provider

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An independent provider and model configuration page for the built-in DeepSeek Harness `llm-pi-ai` adapter.

The plugin adds **Model configuration** below dsh's official **Models** section. It lets you manage provider profiles, API endpoints, credentials, model lists, and per-model overrides without modifying the official Models page or injecting content into its provider cards.

[简体中文](docs/README.zh.md)

## Why this plugin

dsh's built-in `llm-pi-ai` adapter owns the provider schema and runtime behavior. This plugin provides a focused settings surface for that existing namespace:

- Manage catalog providers and user-defined custom API routes in one page.
- Discover models through the adapter's model service before saving a custom provider.
- Edit common model capabilities or the selected model's JSON without replacing sibling models.
- Keep API keys in dsh's credential service instead of settings JSON.
- Preserve dsh's revision and schema validation behavior for concurrent or invalid writes.

## Screenshots

Set up provider routes, endpoints, and credentials in one page:

![Provider configuration with a custom API route](docs/images/screen01.webp)

Edit one model's capabilities and JSON without replacing its siblings:

![Model settings editor](docs/images/screen02.webp)

## Requirements

- A dsh installation with the **Web Settings** surface enabled.
- The built-in `llm-pi-ai` plugin enabled in the same dsh profile.

This package does not provide an LLM adapter, gateway route, or credential backend. It only manages the existing `llm-pi-ai` settings and remotes.

## Installation

Install the published plugin into the `web` profile:

```sh
dsh plugin --profile web add dsh-custom-provider
```

Restart dsh, then open Web Settings and select **Model configuration** below **Models**.

The bundled patch registers the plugin once. Do not add another `dsh-custom-provider` entry with the same id.

To install a local checkout instead, point the same command at the repository root:

```sh
dsh plugin --profile web add "$PWD"
```

## Quick start

1. Open dsh Web Settings and select **Model configuration** below **Models**.
2. Select **Add model provider**.
3. Choose a catalog provider, or choose **Custom model API** and enter a provider id, endpoint, and protocol.
4. Enter the API key when the provider requires one, then fetch the available models.
5. Save the provider and expand a model to edit its fields or JSON, or select **Fetch from models.dev** to import model metadata.

Custom providers must use an explicit protocol. **Inherit catalog** is available only for installed catalog providers.

## Capabilities

### Provider management

- Add installed catalog providers or define custom routes with an id, display name, endpoint, and protocol.
- Edit display name, endpoint, and protocol for writable provider fields.
- Remove user-created providers. Providers inherited from the profile composition cannot be removed from this page.
- Fetch and filter models using the adapter-owned `remote.llm` service. Recognizable official model IDs use installed pi-ai catalog metadata ahead of the provider response.
- Refresh model lists while retaining user-configured fields and models absent from the latest provider listing.

### Model management

- Add and remove models in an explicit user-owned `models` list.
- Use **Fetch from models.dev** to fill the editable name, context window, output limit, and supported text/image inputs. Review or adjust the fields, then click **Save model** to write them as user settings. Fetching alone does not save. Reasoning request values, `compat`, and other JSON fields are unaffected.
- Match the original full model ID first, then its recognizable official provider (such as `deepseek/…` or `openai/…`), then the first matching bare ID. A six-hour Web-memory cache serves repeated imports; a failed refresh leaves the model configuration unchanged.
- Customize installed catalog models through `modelOverrides.<model-id>` without copying the entire catalog.
- Edit model name, context window, output limit, input types, and reasoning capability.
- Use capacity values such as `256K` and `1M`.
- Open **Edit JSON** for the selected model only. The model id is fixed and sibling models remain untouched.
- Keep composition-inherited model lists read-only because editing one row would otherwise replace the complete inherited list.

## Data and write behavior

The page follows the host `llm-pi-ai` schema and storage boundaries:

- Settings writes target the real `llm-pi-ai` namespace through revisioned `remote.settings` operations.
- Client-side schema validation runs before a mutation is sent to dsh. Host rejection and revision conflicts keep the unsaved draft visible.
- Explicit user model lists are replaced as a preserved array so hidden fields and sibling entries survive a single-model edit.
- Catalog model edits write only the selected `modelOverrides.<model-id>` entry. Saving an object containing only its id restores the catalog default.
- API keys are stored through `remote.credentials`, are never read back into a form, and are not written to settings JSON. Settings contain only the configured credential reference.
- If credential storage fails after a provider settings write, the key can be retried without creating another provider.

## Development

Node.js and npm are required for local development.

```sh
npm install         # development dependencies
npm run build       # regenerate lib/client.js
npm test            # build + focused checks
npm pack --dry-run  # inspect the published file set
```

Preview against an isolated profile, so test edits stay out of your normal dsh configuration:

```sh
preview_home="$(mktemp -d "${TMPDIR:-/tmp}/dsh-custom-provider.XXXXXX")"
DSH_HOME="$preview_home" dsh --profile web --patch "$PWD/test/local.patch.yml" --no-open --port 0
```

`lib/client.js` is generated from `lib/client.source.js`, `lib/config.js`, and `lib/modelsdev.js`, then committed because dsh loads it directly.

## Scope and limitations

- Only the built-in `llm-pi-ai` adapter is managed here. Other dsh adapters keep their own settings pages.
- This page is separate from the official Models page and includes some overlapping provider controls.

## Attribution and license

This project is a fork of [Luck9Star/dsh-gateway-provider](https://github.com/Luck9Star/dsh-gateway-provider). The MIT license and copyright attribution are in [LICENSE](LICENSE).

The project is released under the [MIT License](LICENSE).
