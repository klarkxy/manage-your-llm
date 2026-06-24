# Phase 0 TODO: Foundation

目标：从空分支建立可安装、可测试、可启动的 monorepo 地基。

## Workspace

- [ ] P0-001 Create root workspace files
  - Depends on: none
  - Deliverables: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.editorconfig`, `.prettierrc`, `tsconfig.base.json`
  - Acceptance: `pnpm install` can detect workspace packages after packages are added.

- [ ] P0-002 Define root scripts
  - Depends on: P0-001
  - Deliverables: root scripts for `dev`, `build`, `typecheck`, `test`, `lint`, `format`, `format:check`
  - Acceptance: running each script either succeeds or delegates to existing workspace packages without missing-script errors.

- [ ] P0-003 Add shared TypeScript config
  - Depends on: P0-001
  - Deliverables: strict TS base config with Node 22 target and ESM settings
  - Acceptance: package tsconfigs can extend the base config.

## Shared Package

- [ ] P0-010 Create `packages/shared`
  - Depends on: P0-001
  - Deliverables: package manifest, tsconfig, src entrypoint, build/test scripts
  - Acceptance: `pnpm --filter @manageyourllm/shared build` succeeds.

- [ ] P0-011 Add normalized error classes
  - Depends on: P0-010
  - Deliverables: `src/errors.ts`, exports from `src/index.ts`
  - Acceptance: unit tests cover client-safe shape and error codes.

- [ ] P0-012 Add ID generation helpers
  - Depends on: P0-010
  - Deliverables: `src/ids.ts`
  - Acceptance: generated IDs include stable prefixes and tests cover all first-pass entity types.

- [ ] P0-013 Add protocol and IR types
  - Depends on: P0-010
  - Deliverables: `src/protocols.ts`, `src/ir.ts`
  - Acceptance: types cover Anthropic Messages, OpenAI Chat Completions, OpenAI Responses, normalized request/response usage.

- [ ] P0-014 Add provider capability helpers
  - Depends on: P0-013
  - Deliverables: `src/capabilities.ts`
  - Acceptance: tests cover tools, tool choice, vision, JSON mode, thinking, streaming.

## Contracts Package

- [ ] P0-020 Create `packages/contracts`
  - Depends on: P0-001
  - Deliverables: package manifest, tsconfig, src entrypoint, Zod dependency
  - Acceptance: `pnpm --filter @manageyourllm/contracts build` succeeds.

- [ ] P0-021 Define common API envelopes
  - Depends on: P0-020
  - Deliverables: success/error/list envelope schemas
  - Acceptance: inferred TypeScript types export correctly.

- [ ] P0-022 Define admin auth contract skeleton
  - Depends on: P0-021
  - Deliverables: login/me/logout schemas
  - Acceptance: schema parse tests cover valid and invalid payloads.

- [ ] P0-023 Define gateway protocol contract skeleton
  - Depends on: P0-020, P0-013
  - Deliverables: exported schemas/placeholders for `/v1/models`, messages, chat completions, responses
  - Acceptance: no circular dependency between shared and contracts.

## API App

- [ ] P0-030 Create `apps/api`
  - Depends on: P0-001
  - Deliverables: package manifest, tsconfig, `src/main.ts`, `src/server/build-server.ts`
  - Acceptance: API package builds.

- [ ] P0-031 Add env parser
  - Depends on: P0-030, P0-020
  - Deliverables: `src/config/env.ts`
  - Acceptance: tests cover defaults, production rejection placeholders, invalid port.

- [ ] P0-032 Add Fastify server shell
  - Depends on: P0-030, P0-031
  - Deliverables: server builder, logger placeholder, route registration hook
  - Acceptance: inject test can build app and close it.

- [ ] P0-033 Add health and readiness routes
  - Depends on: P0-032
  - Deliverables: `/healthz`, `/readyz`
  - Acceptance: inject tests return expected status and shape.

- [ ] P0-034 Add global error handler
  - Depends on: P0-011, P0-032
  - Deliverables: normalized error -> JSON response mapping
  - Acceptance: tests cover validation, auth, unknown errors.

## Web App

- [ ] P0-040 Create `apps/web`
  - Depends on: P0-001
  - Deliverables: Vue 3 + Vite + Naive UI package
  - Acceptance: web package builds.

- [ ] P0-041 Add base layout shell
  - Depends on: P0-040
  - Deliverables: app root, router, layout, placeholder pages
  - Acceptance: unit smoke test mounts app shell.

- [ ] P0-042 Add API client skeleton
  - Depends on: P0-020, P0-040
  - Deliverables: `src/api/client.ts`, typed error handling
  - Acceptance: tests cover success/error response handling.

- [ ] P0-043 Add i18n skeleton
  - Depends on: P0-040
  - Deliverables: Chinese locale and key structure
  - Acceptance: app renders Chinese text from locale key.

## Tooling and Deployment

- [ ] P0-050 Add lint and format tooling
  - Depends on: P0-001
  - Deliverables: ESLint config, Prettier config
  - Acceptance: `pnpm lint` and `pnpm format:check` run.

- [ ] P0-051 Add Vitest configuration
  - Depends on: P0-010, P0-020, P0-030, P0-040
  - Deliverables: package-level Vitest configs
  - Acceptance: `pnpm test` runs all initial tests.

- [ ] P0-052 Add Playwright skeleton
  - Depends on: P0-040
  - Deliverables: Playwright config and one placeholder smoke test
  - Acceptance: e2e command can start or target dev server once implemented.

- [ ] P0-053 Add Docker skeleton
  - Depends on: P0-030, P0-040
  - Deliverables: `Dockerfile`, `.dockerignore`, `.env.example`
  - Acceptance: Docker build reaches package install/build stage.

- [ ] P0-054 Document local dev commands
  - Depends on: P0-001 through P0-053
  - Deliverables: root `README.md`
  - Acceptance: README has install, dev, build, test, Docker notes.

