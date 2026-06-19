# OpenAI Codex — How to authorize ModelHarbor

Use this guide to authorize ModelHarbor against the OpenAI **Codex** endpoint. Two authentication modes are supported.

> Preset id: `codex` · Auth: `codex_oauth` (default) or `pat` · Endpoint: `https://api.openai.com`

## Option A — Browser OAuth (recommended)

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `OpenAI Codex`.
3. **Authentication**: leave the default `Codex OAuth (browser or refresh token)`.
4. **Redirect URI**: keep the default `http://localhost:1455/auth/callback`. OpenAI's public Codex OAuth app is registered to this fixed URI, so it cannot be changed when using the default client ID.
5. Make sure ModelHarbor is being served at `http://localhost:1455` while you complete the OAuth flow. In development you can do this with `MODELHARBOR_WEB_PORT=1455 pnpm dev`.
6. Click **Authorize with browser**. A new tab opens on OpenAI.
7. Sign in and approve the requested scopes (`openid`, `profile`, `email`, `offline_access`). OpenAI redirects back to ModelHarbor, and the callback page automatically exchanges the code and creates the upstream key.

The refresh token is stored encrypted in the upstream key's `authConfig`. ModelHarbor refreshes access tokens automatically on every request.

## Option B — Manual refresh token

If you cannot complete the browser flow (e.g. headless environment):

1. Sign in to OpenAI and open <https://platform.openai.com/settings/organization/api-keys>.
2. Issue a refresh token through the OpenAI CLI (`openai auth login --device`) and copy the value.
3. In the drawer, paste it into **Refresh token**.
4. (Optional) set **Client ID** (default `app_EMoamEEZ73f0CkXaXp7hrann`) and **Token URL** (default `https://auth.openai.com/oauth/token`).

## Option C — PAT (legacy)

The Codex preset also accepts a static API key (`sk-...`). This skips OAuth entirely but does not unlock Codex-specific features like prompt-cache sharing.

1. Create a key at <https://platform.openai.com/api-keys>.
2. Paste it into **API key**.
3. Click **Create**.

## Troubleshooting

- **`authorize_hydra_invalid_request`**: the `redirect_uri` sent to OpenAI does not match the URI registered for the public Codex OAuth app. Make sure the drawer shows `http://localhost:1455/auth/callback` and that ModelHarbor is served on port `1455` during authorization.
- **`refresh_token_reused`**: OpenAI single-use refresh tokens. Run the OAuth flow again to obtain a fresh one.
- **`invalid_client`**: the Client ID does not match the upstream app; reset it.
- **`insufficient_scope`**: re-run OAuth and grant the missing scopes.
- **No models after Fetch models**: confirm the account has access to Codex models on the active plan.

## References

- Codex overview: <https://platform.openai.com/docs/codex>
- OAuth scopes: <https://platform.openai.com/docs/guides/authentication>
