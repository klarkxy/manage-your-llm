# Coze — How to configure an upstream key

Use this guide to configure a Coze upstream key in ModelHarbor. Coze uses an **OAuth JWT** flow: ModelHarbor signs a JWT with your private key and exchanges it for a short-lived access token on every request. A **Workspace ID** is also required to scope the request.

> Preset id: `coze` · Auth: `coze_oauth_jwt` · Endpoints:
> - China: `https://api.coze.cn` (path: `/v3/chat`)
> - International: `https://api.coze.com` (path: `/v3/chat`)

## 1. Get your Workspace ID

ModelHarbor sends `workspace_id` as a request parameter to Coze, so you need this ID first.

1. Sign in to [Coze China](https://www.coze.cn) or [Coze International](https://www.coze.com).
2. Open the target workspace.
3. Look at the browser address bar. The URL usually looks like one of these:
   - `https://www.coze.cn/space/{workspaceId}/...`
   - `https://www.coze.com/space/{workspaceId}/...`
   - `https://code.coze.cn/w/{workspaceId}/...`
4. Copy the numeric `{workspaceId}` into ModelHarbor's **Workspace ID** field.

> Example: if the URL is `https://www.coze.cn/space/7435xxxxxx/develop`, the Workspace ID is `7435xxxxxx`.

## 2. Create an OAuth JWT app

The `coze_oauth_jwt` auth type signs a JWT with an RSA private key and exchanges it for a short-lived access token.

1. In the target workspace, open **Developer** → **OAuth Apps**.
2. Click **Create app** and choose the **Server / JWT** type.
3. Enter the app name and select at least these permissions:
   - Call Bot / agent conversation
   - List workspace models (used by Fetch models)
4. After saving, open the app details and copy:
   - **App ID** (sometimes called **Client ID**): maps to ModelHarbor's **App ID**.
   - **Public key fingerprint (KID)**: maps to ModelHarbor's **KID**.
   - **Private key**: generate or download the PEM private key and paste it into ModelHarbor's **Private key** field.

> If Coze only lets you generate a key pair once, save the private key immediately. You usually cannot view the full private key again after leaving the page.

## 3. Fill in ModelHarbor

When creating a Coze upstream key:

1. **Provider preset**: `Coze`.
2. **Authentication**: `OAuth JWT` (default).
3. Fill in:
   - **Workspace ID**: the numeric ID from step 1.
   - **App ID**: the OAuth app's App ID.
   - **KID**: the public key fingerprint.
   - **Private key**: the full PEM private key, including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`.
   - **Token duration (seconds)**: defaults to `900`; maximum is `86399` (Coze's longest allowed lifetime).
4. Click **Fetch models**, then **Create**.

## 4. Troubleshooting

- **Unauthorized / 401**
  - Check that the Workspace ID is correct.
  - Make sure App ID, KID, and Private key all belong to the same OAuth app.
  - Confirm the OAuth app has been authorized for the workspace (some setups require sharing the authorization link with the workspace owner).
- **Private key format**
  - The key must contain real line breaks. If you paste a single-line string with `\n`, ensure the actual newline characters are present.
- **Base URL**
  - China: `https://api.coze.cn`
  - International: `https://api.coze.com`
  - Change it manually if you need a custom endpoint.

## References

- Coze China docs: Get access token via JWT (Node.js) — <https://www.coze.cn/open/docs/developer_guides/nodejs_access_token>
- Coze International docs: Generate access tokens using JWT — <https://www.coze.com/open/docs/developer_guides/oauth_jwt_collaborate>