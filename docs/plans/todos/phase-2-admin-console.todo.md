# Phase 2 TODO: Admin Console

目标：通过管理 API 和 UI 完成首个 provider、模型、Consumer Key、备份恢复配置路径。

## Admin Auth

- [x] P2-001 Implement admin bootstrap
  - Depends on: P1-050
  - Deliverables: bootstrap first admin from env or setup flow
  - Acceptance: production rejects default password.

- [x] P2-002 Implement auth routes
  - Depends on: P2-001, P0-022
  - Deliverables: login/logout/me/change-password/profile
  - Acceptance: Fastify inject tests cover success, invalid password, session expiry.

- [x] P2-003 Add admin route guard
  - Depends on: P2-002
  - Deliverables: guard for `/api/admin/*` except auth/setup allowance
  - Acceptance: unauthenticated admin API returns 401.

## Setup Wizard API

- [x] P2-010 Implement setup status endpoint
  - Depends on: P2-001
  - Deliverables: `/api/admin/setup/status`
  - Acceptance: returns whether admin, secret, DB, first provider, first key are ready.

- [x] P2-011 Implement setup security step
  - Depends on: P2-010
  - Deliverables: endpoint/service to confirm admin password and secret readiness
  - Acceptance: setup cannot proceed in production with unsafe defaults.

- [x] P2-012 Implement setup upstream step
  - Depends on: P2-020, P2-030
  - Deliverables: create upstream from preset/manual input
  - Acceptance: returns created upstream without raw secret.

- [x] P2-013 Implement setup model mapping step
  - Depends on: P2-040
  - Deliverables: create public models/candidates from selected discovered/manual models
  - Acceptance: transactional create works and duplicate names are reported.

- [x] P2-014 Implement setup consumer key step
  - Depends on: P2-060
  - Deliverables: create app and default all-access Consumer Key
  - Acceptance: raw key shown once in response.

- [x] P2-015 Implement setup test request helper
  - Depends on: P2-014
  - Deliverables: generated curl/config snippets without performing real gateway call
  - Acceptance: snippets include base URL, key placeholder/value control, model.

## Provider Presets and Upstreams

- [x] P2-020 Implement provider preset routes
  - Depends on: P1-032
  - Deliverables: list built-ins, CRUD local custom presets
  - Acceptance: local preset can be created and listed.

- [ ] P2-021 Implement save upstream as preset
  - Depends on: P2-020, P1-033
  - Deliverables: service/action to create local preset from upstream without secret
  - Acceptance: exported preset excludes ciphertext and raw key.

- [x] P2-030 Implement upstream CRUD routes
  - Depends on: P1-033, P1-051
  - Deliverables: list/get/create/update/delete
  - Acceptance: create encrypts key and response hides raw secret.

- [ ] P2-031 Implement upstream order route
  - Depends on: P2-030
  - Deliverables: reorder upstreams
  - Acceptance: order persists and list returns sorted rows.

- [x] P2-032 Implement upstream freeze/unfreeze/rotate
  - Depends on: P2-030
  - Deliverables: action routes
  - Acceptance: rotate returns new prefix and never old raw key.

- [x] P2-033 Implement model discovery service
  - Depends on: P2-030
  - Deliverables: OpenAI-compatible `/models` discovery and manual fallback
  - Acceptance: fake upstream discovery test passes.

- [x] P2-034 Implement manual model ping endpoint
  - Depends on: P2-030
  - Deliverables: ping route using selected provider endpoint/model
  - Acceptance: fake upstream records ok/error/latency.

## Model Exposure API

- [x] P2-040 Implement public model routes
  - Depends on: P1-054
  - Deliverables: list/get/create/update/delete/candidates
  - Acceptance: candidate updates are transactional.

- [ ] P2-041 Implement public model candidate reorder
  - Depends on: P2-040
  - Deliverables: reorder endpoint
  - Acceptance: priority values are normalized after reorder.

- [x] P2-050 Implement model group routes
  - Depends on: P1-055
  - Deliverables: list/get/create/update/delete/members
  - Acceptance: group cannot reference missing public model.

## Apps and Consumer Keys

- [x] P2-060 Implement app routes
  - Depends on: P1-031
  - Deliverables: list/get/create/update
  - Acceptance: disabled app prevents its keys from authenticating in service tests.

- [x] P2-061 Implement consumer key routes
  - Depends on: P1-052, P1-053
  - Deliverables: list/create/rotate/revoke/access mode/access targets
  - Acceptance: create defaults to `accessMode = all`.

## Backup and Settings API

- [x] P2-070 Implement backup routes
  - Depends on: P1-056
  - Deliverables: create/list/restore/delete/export non-sensitive config
  - Acceptance: restore requires explicit confirmation payload.

- [x] P2-071 Implement settings routes
  - Depends on: P1-019
  - Deliverables: public base URL, gateway base path, resilience defaults, security checks
  - Acceptance: invalid base path rejected.

## Web UI

- [x] P2-100 Implement login page
  - Depends on: P2-002, P0-041
  - Deliverables: login form, session bootstrap
  - Acceptance: user can log in against API in integration test.

- [x] P2-101 Implement authenticated layout
  - Depends on: P2-003, P2-100
  - Deliverables: sidebar/nav, route guard, user menu
  - Acceptance: unauthenticated navigation redirects to login.

- [x] P2-102 Implement Setup Wizard UI
  - Depends on: P2-010 through P2-015
  - Deliverables: multi-step wizard
  - Acceptance: mocked API test completes wizard flow.

- [x] P2-103 Implement Upstream Keys page
  - Depends on: P2-020 through P2-034
  - Deliverables: table, drawer form, discovery, ping, preset selector
  - Acceptance: component tests cover create/edit/discover paths.

- [x] P2-104 Implement Public Models page
  - Depends on: P2-040, P2-041
  - Deliverables: table, candidate editor, reorder UI
  - Acceptance: candidate editor saves normalized payload.

- [x] P2-105 Implement Model Groups page
  - Depends on: P2-050
  - Deliverables: table, member editor
  - Acceptance: group members can be added/removed.

- [x] P2-106 Implement Apps and Consumer Keys page
  - Depends on: P2-060, P2-061
  - Deliverables: app table, key drawer, access mode toggle
  - Acceptance: all/restricted mode UI behavior tested.

- [x] P2-107 Implement Backups page
  - Depends on: P2-070
  - Deliverables: backup list, create, restore confirmation, export
  - Acceptance: restore flow requires confirmation.

- [x] P2-108 Implement Settings page
  - Depends on: P2-071
  - Deliverables: public URL, base path, security status, account settings
  - Acceptance: invalid setting errors display clearly.

## Phase 2 Closure

- [ ] P2-190 Add admin e2e happy path
  - Depends on: P2-100 through P2-108
  - Deliverables: Playwright test for login -> setup -> backup
  - Acceptance: e2e passes locally.

- [ ] P2-191 Run full verification
  - Depends on: P2-190
  - Deliverables: typecheck/test/lint/e2e results
  - Acceptance: all checks pass.

