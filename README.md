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
- State: SQLite first, Postgres later
- ORM: Drizzle
- Deployment: single Docker image serving both gateway APIs and admin UI
- License: AGPL-3.0-or-later

## Monorepo Layout

```text
apps/
  api/    Fastify 5 + TypeScript, gateway and admin API
  web/    Vue 3 + Vite + Naive UI dashboard
packages/
  shared/  protocol-neutral types, error classes, id generators
```

## Milestone Status

| Milestone | Title                          | Status   |
| --------- | ------------------------------ | -------- |
| M0        | Repository foundation          | done     |
| M1        | Database and local admin       | next     |
| M2        | Control plane objects          | pending  |
| M3        | Provider adapter foundation    | pending  |
| M4        | Gateway routing                | pending  |
| M5        | Streaming                      | pending  |
| M6        | Quotas and sticky routing      | pending  |
| M7        | Usage and observability        | pending  |

M0 ships a working monorepo: workspace pnpm setup, shared package, Fastify server with `/healthz` and `/readyz`, Vue 3 dashboard shell with Naive UI, lint, typecheck, test, and build scripts.

## Local Development

```bash
pnpm install
pnpm dev          # runs API and web in parallel (web on :5173, API on :3000)
pnpm typecheck
pnpm test
pnpm build
```

Open the dashboard at `http://localhost:5173`. The Vite dev server proxies `/v1` and `/api` to the Fastify backend on port 3000.

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