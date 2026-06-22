# Changelog

All notable changes to ModelHarbor are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/) and the project
adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-06-22

The first public release of ModelHarbor (模型港) — a lightweight,
dashboard-first LLM API router.

### Highlights

- **Multi-protocol gateway.** Anthropic Messages, OpenAI Chat Completions
  and OpenAI Responses, all routed through a unified candidate-selection
  core with per-protocol adapter bridges.
- **Model groups with multiple routing strategies.** Single public models
  use linear priority failover; model groups support `failover`,
  `priority`, `round_robin`, `random` and `weighted_round_robin`.
- **Sticky-session affinity.** Conversation fingerprint (system prompt +
  first messages + optional `user_id`) binds to a specific
  `(upstream, realModel)` pair, including a short-window session cache
  that expires when the bound candidate becomes unavailable.
- **Resilience.** Stream first-token timeout with candidate switching,
  short-lived cooldowns after rate-limit / timeout / 5xx, candidate
  endpoint overrides for multi-protocol upstreams (OpenCode Go etc.),
  and a configurable circuit breaker with admin reset.
- **Provider descriptor preset library.** 29 vendor presets with
  capability metadata, default model hints, and built-in guide URLs.
- **Model reference & search.** Cross-vendor model comparison page with
  search, provider filter, and metric columns.
- **Quota tracking.** Per-key hourly / daily / weekly / monthly /
  total counters with automatic freeze and per-window reset.
- **Admin dashboard.** Upstream keys, public models, model groups,
  apps, consumer keys, usage, audit log, settings, sticky bindings,
  circuit-breaker status, OAuth callback handling, and a clean
  dark/light themed UI.
- **Security defaults.** AES-GCM encryption for stored upstream keys,
  HttpOnly signed session cookies, per-(username, IP) login rate
  limiting, structured log redaction, and explicit production-mode
  rejection of default secrets.

### Added

- 🪟 feat(upstream): support copying an upstream key and choosing the
  routing mode.
- 🧭 feat(router): candidate endpoint override + OpenCode Go multi-
  protocol routing.
- 🔁 feat(providers): shared provider descriptor preset library.
- 🔁 feat(router): model-group multi-strategy load balancing.
- 🍪 feat(router): short-window session-level sticky session routing.
- ⏱️ feat(gateway): stream first-token timeout with candidate switching.
- 💓 feat(upstream): endpoint health probe config + orphan cleanup.
- 🧩 feat(groups): unique routing policies per model group, drag-to-
  reorder members.
- 🌐 feat(reference): extended reference data sources with multi-source
  aggregation.
- 🔢 feat(model-reference): vendor suffix parsing, vendor filter and
  metric comparison.
- 🧮 feat(model-reference): search and metric filter on the reference
  page.
- 🪢 feat(router): upstream key and public-model candidate drag-to-
  orchestrate.
- 🪞 feat(ui): integrate ECharts and assemble theme + shared components.
- 🪪 feat(upstream): key prefix display + enable/freeze UX polish.
- 🧭 feat(ui,router): icon-button action column; model name
  case-insensitive matching.
- 🖋️ style(web): action column converted to icon buttons; drag styles
  moved into component scope.
- ✅ test(router): capabilities routing-filter unit tests.

### Changed

- ♻️ refactor(model-reference): unified the data source to a single
  `DataLearner` global.
- 📝 docs: restructured the administrator manual and trimmed runtime
  output.

### Security

- Sticky binding writes use a non-atomic read-then-update pattern in
  the hot path; a high-concurrency burst can lose hit-count increments.
  Atomic `UPDATE ... SET hitCount = hitCount + 1` is on the 0.1.x
  roadmap.
- Session cookie is `SameSite=Lax`; CSRF defence relies on the same-
  site attribute. An explicit `Origin` check on `/api/admin/*`
  mutations is on the 0.1.x roadmap.
- `Fastify({})` is built without `trustProxy`. When deploying behind a
  reverse proxy, set the trust-proxy option explicitly so per-IP login
  rate limits and audit log IPs reflect the real client.

### Fixed (since the first public tag)

- Drag-to-reorder in `useDraggableList` was a no-op: the consumer-facing
  `draggingIndex` property received a snapshot of the internal reactive
  state, so setting it from a drag handle's `onDragstart` never reached
  the `onDrop` path. Added a `startDrag(idx)` method on the composable
  return and updated PublicModels / UpstreamKeys / ModelGroups to use
  it. Drag-to-reorder now commits as expected.

### Compatibility

- Node.js: **>= 22.10.0** (Node 20 reached EOL on 2026-04-30).
- pnpm: >= 9.
- Databases: SQLite (libSQL) on the bundled filesystem driver.
- Frontend: modern evergreen browsers; tested on Edge / Chromium.

### Known limitations

- E2E coverage is currently a single login smoke spec. End-to-end
  tests for the gateway / upstream / public-model flow are on the
  0.1.x roadmap.
- The Vitest coverage gate is not yet enabled; once stabilised it
  will run in CI with a `~70%` line floor on `apps/api`.
- The Codex OAuth refresh-token persistence path logs and continues on
  failure; in rare persistence failures, the in-memory token and the
  DB-stored refresh token can drift until the next restart.
- Drag-to-reorder has no remote-undo / no conflict-resolution across
  two admins editing the same model simultaneously.
