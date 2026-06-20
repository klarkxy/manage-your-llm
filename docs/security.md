# Security Model

## Goals

ModelHarbor manages sensitive upstream API keys and client consumer keys. Security defaults should be conservative without making self-hosting painful.

Primary goals:

- Protect upstream API keys.
- Protect consumer keys.
- Keep dashboard access private.
- Avoid leaking prompt, completion, or provider error data by default.
- Keep admin actions auditable.

## Admin Authentication

MVP uses local administrator username and password.

Requirements:

- Hash passwords with a modern password hash.
- Store admin sessions as hashes.
- Prefer HTTP-only, secure cookies for browser sessions.
- Expire sessions.
- Reject disabled admin users.
- Rate-limit login attempts if practical in MVP.

OIDC is out of scope for MVP.

## Consumer Key Security

Consumer keys authenticate gateway requests.

Requirements:

- Generate high-entropy keys.
- Store only `keyHash` and `keyPrefix`.
- Return raw key only once on creation or rotation.
- Allow revocation.
- Allow rotation.
- Never log raw keys.

Supported client auth:

- `Authorization: Bearer mh_...`
- `x-api-key: mh_...`

If both are present, `Authorization` wins.

## Upstream Key Security

Upstream API keys are the most sensitive stored secret.

Requirements:

- Never return raw upstream keys after creation.
- Never log raw upstream keys.
- Store only a display prefix for UI identification.
- Encrypt upstream keys at rest when an encryption secret is configured.

Recommended environment variable:

```text
MODELHARBOR_SECRET_KEY
```

If encryption is not configured in early development, the UI and logs must still never expose raw values after creation.

## Authorization Model

MVP has one admin role.

Gateway authorization:

- Consumer key resolves to an app.
- Consumer key grants define accessible public models and model groups.
- Apps do not grant access implicitly unless the implementation explicitly chooses an app-wide default later.

Admin authorization:

- Logged-in admin can manage all resources.
- Audit events should record sensitive operations.

## Logging And Privacy

Default behavior:

- Store metadata and usage statistics only.
- Do not store full prompt.
- Do not store full completion.
- Do not store raw upstream error bodies if they may contain sensitive request details.

Optional behavior (admin-controlled, off by default):

- Global content logging in `admin_settings` (`contentLogEnabled`, `contentLogRetentionDays`, `contentLogMaxPayloadBytes`).
- Redaction rules applied before persistence (`mh_`, `sk-`, `Bearer` tokens are redacted).
- Retention policy enforced by the maintenance pass.

Future behavior:

- Per-app content logging override.
- More granular redaction rules.

## Error Safety

External errors must not expose:

- Upstream API keys.
- Consumer keys.
- Admin session tokens.
- Internal stack traces.
- Full request bodies.
- Raw provider headers.

Provider errors should be normalized before returning to clients.

## Audit Events

Audit events should record admin-side changes.

Recommended audited actions:

- Admin login success and failure.
- Create, update, freeze, unfreeze, rotate, and disable upstream key.
- Create, update, and disable public model.
- Create, update, and disable model group.
- Create, revoke, and rotate consumer key.
- Update consumer key access grants.

Audit summaries must not include raw secrets.

## Deployment Secrets

Recommended secrets:

- `MODELHARBOR_SECRET_KEY` for encryption and signing.
- Initial admin password or setup token.

Secrets should be read from environment variables or mounted files, not committed to the repository.

## Dependency Hygiene

Before adding major dependencies, check:

- License compatibility with AGPL-3.0-or-later.
- Maintenance status.
- Transitive native binary risk.
- Whether the dependency handles secrets or network requests.

Avoid pulling in large provider SDKs when a small HTTP adapter is enough.
