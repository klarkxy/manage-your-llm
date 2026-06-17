# ModelHarbor

ModelHarbor, also called "模型港", is a lightweight dashboard-first LLM API router for managing upstream API keys, model exposure, groups, quotas, and application-level usage statistics.

It is not an API resale platform. It intentionally avoids pricing, billing, payment, recharge, affiliate, and other commercial distribution features. The core goal is to help an administrator manage multiple token plans and provider keys through a clear visual dashboard.

## Core Ideas

- Treat each upstream API key as an actual routable provider instance.
- Expose clean public model names and administrator-defined model groups.
- Keep client calls compatible with Anthropic Messages and OpenAI Chat Completions.
- Use sticky routing to improve provider-side cache hit rates, while allowing automatic rebinding when a key or model is unavailable.
- Track quotas and usage by upstream key, and aggregate usage by application.
- Provide an admin dashboard instead of YAML-first configuration.

## Planned Stack

- Backend: Node.js, Fastify, TypeScript
- Frontend: Vue 3, Vite, TypeScript, Naive UI
- State: SQLite (libsql driver) first, Postgres later
- ORM: Drizzle
- Deployment: single Docker image serving both gateway APIs and admin UI
- License: AGPL-3.0-or-later

## Monorepo Layout

```text
apps/
  api/    Fastify 5 + libsql + Drizzle, gateway and admin API
  web/    Vue 3 + Vite + Naive UI + Pinia dashboard
packages/
  shared/  protocol-neutral types, error classes, id generators, IR
```

## Milestone Status

| Milestone | Title                          | Status   |
| --------- | ------------------------------ | -------- |
| M0        | Repository foundation          | done     |
| M1        | Database and local admin       | done     |
| M2        | Control plane objects          | done     |
| M3        | Provider adapter foundation    | done     |
| M4        | Gateway routing                | done     |
| M5        | Streaming                      | done     |
| M6        | Quotas and sticky routing      | done     |
| M7        | Usage and observability        | pending  |

## M3 highlights

- `ChatRequestIR` and `NormalizedChatResponse` as protocol-neutral internal shapes; the router core never sees wire-format request / response payloads.
- `anthropic-compatible` adapter: buildRequest → `POST /v1/messages` with `x-api-key` and `anthropic-version: 2023-06-01`; normalizeResponse concatenates text blocks and reads `usage.input_tokens` / `output_tokens`.
- `openai-compatible` adapter: buildRequest → `POST /v1/chat/completions` with `Authorization: Bearer`; system messages fold into `messages[0]`; normalizeResponse reads `choices[0].message.content` and `usage.prompt_tokens` / `completion_tokens` / `total_tokens`.
- `errors.ts` classifier: maps status codes (401/403/404/408/429/504/…) plus provider error code substrings (`rate_limit`, `quota`, `insufficient_credit`, `model_not_found`, `auth`, …) into one of nine `NormalizedProviderError` categories; transport errors (no response) become `provider_timeout` with `upstreamStatus: 0`.
- `ir-converters.ts`: `anthropicRequestToIR` and `openaiRequestToIR` turn the wire-format client request into a `ChatRequestIR` (the gateway will call these in M4).
- `fake-upstream.ts`: Fastify-backed fake that records incoming requests and serves a configurable response; used to verify adapters end-to-end without a real provider.
- Registry: `getAdapter("anthropic_compatible" | "openai_compatible")` returns the right factory; `listProviderTypes()` for routing decisions.


## M4 highlights

- Consumer-key authentication on `/v1/*`: `Authorization: Bearer mh_...` (preferred) or `x-api-key: mh_...`. Keys are stored as SHA-256 hashes; revoked or disabled keys, and disabled owning apps, are rejected before target resolution.
- Target resolution: the requested `model` name is looked up in the unified `target_names` table so a single name space covers both public models and model groups. Unknown names return a protocol-shaped 404.
- Access checks: `consumer_key_access` is the source of truth. Public model and model group grants are checked the same way.
- Candidate expansion + filtering: public models expand to their `public_model_candidates` rows; model groups expand through their `model_group_members` to the underlying candidates. Every candidate carries upstream state (`enabled`, `frozen`, `cooldownUntil`, provider `protocols`) so the filter can drop disabled / frozen / cooled-down / wrong-protocol rows with a clear reason and not pick them.
- Routing policy: `priority` only, ascending, with `upstreamKeyId` / `realModelName` tiebreak for determinism. `weight` is reserved on the schema for M6.
- Failover with cooldown: rate-limit / quota / overload / timeout errors trigger a brief upstream cooldown (60s / 5min / 30s / 15s) and the router tries the next candidate. Other categories (auth, permission, bad_request, model_not_found) stop immediately.
- `GET /v1/models` returns the public models and groups the consumer key can access, in OpenAI list-model shape, with `metadata.target_type` distinguishing the two.
- Streaming is explicitly rejected with 400 in M4; the streaming path lands in M5.

## M5 highlights

- Provider adapters now implement `normalizeStreamEvent` for both protocols. Anthropic classifies `message_start` (emits initial input tokens) / `content_block_delta` (text) / `message_delta` (final output tokens) / `message_stop`; OpenAI classifies `data: {...}` deltas, the `finish_reason` chunk, and the terminal `data: [DONE]`. The gateway forwards each upstream frame to the client byte-for-byte; the classification is for capturing usage and knowing when to end.
- `gateway/stream-sender.ts` opens the upstream request with `fetch` + `AbortController` and parses the SSE body into an async iterable of `RawStreamEvent`. A 2xx response returns the iterable; a non-2xx response reads the body in full (so the gateway can classify the error and decide whether to failover); a transport error returns the error. The reader is cancelled when the controller is aborted.
- `gateway/stream-handler.ts` is the streaming counterpart of `handler.ts`. It resolves target + access + candidates, then walks the candidate list with the same priority + failover semantics. After the first byte is written to the client, failover is disabled: the gateway commits to the current upstream. SSE headers are set on the first write (`text/event-stream`, `cache-control: no-cache`, `x-accel-buffering: no`). A `close` listener on `reply.raw` aborts the upstream when the client disconnects mid-stream.
- Usage accounting starts in M5. The `usage_records` table is added to the schema and `modules/usage/index.ts` exposes `writeUsageRecord`. The non-stream path (M4) writes one row per gateway call; the streaming path writes one row when the stream ends, success or failure. Stream completion carries the final `input_tokens` / `output_tokens` (merged across `message_start` and `message_delta` for Anthropic); mid-stream upstream close is recorded as `status: "error"`.
- Streaming error bodies are protocol-shaped. Errors thrown before the first frame in `buildStreamRequest` / `handleStreamRequest` (unknown model, denied access, validation) are mapped to the same Anthropic / OpenAI error shape as the non-stream path; the route wraps both streaming branches in `try/catch` and calls `sendNormalizedError` on `NormalizedError`. The non-stream body shape is unchanged.
- Client disconnect is wired end-to-end. `handleStreamRequest` creates a per-attempt `AbortController`, passes its `signal` to `startUpstreamStream`, and the single `close` listener on `reply.raw` calls `abortController.abort()` so the upstream `fetch` is cancelled promptly. The usage row written after a client disconnect is tagged `errorCode: "client_disconnected"`, `status: "error"`, `category: "provider_stream_error"`.
- Usage attribution follows the resolved target, not the served candidate. A request against a `model_group` writes `resolvedTargetType: "model_group"`, `resolvedTargetId: <groupId>`, `requestedTargetName: <groupName>`; a request against a `public_model` writes `resolvedTargetType: "public_model"`, `resolvedTargetId: <publicModelId>`. Both the non-stream path (`gateway/handler.ts`) and the streaming path (`gateway/stream-handler.ts`) read these from the `ResolvedTarget` returned by the router.
- A real TCP listener is used in the streaming tests (`app.inject` does not honor streaming responses reliably — it returns before the async handler finishes writing, so the post-stream usage record would not be visible to the test yet). The fake upstream now supports an SSE stream mode: `setAnthropicStream` / `setOpenAIStream` accept a list of frames plus an optional `closeAfter` to simulate a mid-flight disconnect via socket-level close.




## M6 highlights

- Quota engine: per-(upstream key, period) counter rows in `upstream_key_counters` and per-key policy rows in `upstream_key_quotas`. Each gateway request on success bumps the configured period for the chosen candidate (`hour` / `day` / `week` / `month` / `total`, one row per key) plus the running `total` counter for the dashboard, and freezes the key with reason `quota_exceeded:<dimension>` as soon as the next call would cross a limit. The pre-routing `wouldExceedQuota` filter uses the same counter rows, so the freeze takes effect on the next request without a window of stale traffic.
- Sticky routing: the conversation fingerprint (system + first four messages + optional `user_id` metadata) is the key for an `(app, consumer key, requested_target_name, fingerprint)` tuple. A fresh binding moves the bound candidate to the front of the priority list; if the bound candidate becomes invalid (disabled / frozen / cooled down / over quota / protocol mismatch), the binding is ignored and a new candidate is chosen and rebound. TTL is 1h sliding and the hit counter is bumped on every honored hit. The `usage_records.stickyHit` column records whether the routing decision was served from a sticky binding, both for non-stream and stream paths.
- Admin endpoints: `GET /api/admin/sticky-bindings?appId=...&consumerKeyId=...` lists the bindings for a consumer key (with an optional `requestedTargetName` filter). `POST /api/admin/maintenance/run` is a maintenance pass that resets expired counter windows and prunes expired sticky bindings. The counter windows snap to the wall clock (`hour` → top of the hour, `day` → UTC midnight, `week` / `month` → 30-day month), and stale rows are dropped by the runner.
- Quota model periods are aligned with what the pre-routing filter actually checks. `recordQuotaUsage` bumps the configured `QuotaPeriod` row for the candidate plus the running `total` counter, so the row used by `wouldExceedQuota` on the next request is the same row that triggered the freeze on the previous one. `periodBounds` returns UTC-anchored windows so two requests inside the same hour share the same counter row, which keeps the dashboard math and the freeze math on the same page.
- Tests cover the period math, the single-period freeze path, the increment path (configured period plus `total`), the freeze on a non-total period crossing its limit, sticky prune (one expired + one live binding), and upsert behavior (same `(app, key, target, fingerprint)` tuple updates in place, never duplicates).

## Local Development

```bash
pnpm install
pnpm dev          # runs API and web in parallel (web on :5173, API on :3000)
pnpm typecheck
pnpm test
pnpm build
```

Open the dashboard at `http://localhost:5173`. The Vite dev server proxies `/v1` and `/api` to the Fastify backend on port 3000. The first admin is bootstrapped on first run from `MODELHARBOR_ADMIN_USERNAME` and `MODELHARBOR_ADMIN_PASSWORD` (defaults to `admin` / `change-me-on-first-run`).

## Phase 1 Decisions (locked)

- No cross-protocol routing. A consumer key calling `/v1/messages` can only reach `anthropic_compatible` upstream keys, and `/v1/chat/completions` can only reach `openai_compatible` upstream keys.
- Routing policy: `priority` only. The `weight` column is reserved in the schema for later and is ignored in MVP.
- No rate limit on ModelHarbor side. When an upstream returns 429 or a credit/balance error, the key enters cooldown and traffic is rerouted to other candidates in the same group.
- Sticky routing is the default. It wins over priority when the bound upstream is still a valid candidate, with a sliding 1 hour TTL.
- Quota counters only count requests, input tokens, output tokens, and total tokens for the configured period.

## Documentation

- [Product plan](docs/plan.md)
- [Architecture](docs/architecture.md)
- [Testing plan](docs/testing.md)
- [MVP scope](docs/mvp.md)
- [Data model](docs/data-model.md)
- [API contract](docs/api-contract.md)
- [Provider adapter guide](docs/provider-adapters.md)
- [Security model](docs/security.md)
- [Operations and deployment](docs/operations.md)
- [Admin UI](docs/ui.md)
- [Roadmap](docs/roadmap.md)
- [Recorded decisions](docs/decisions.md)

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).
