# Phase 3 TODO: Gateway Routing

目标：实现非流式网关、路由决策、provider adapter、激进 failover 和基础可观测写入。

## Gateway Route Foundation

- [x] P3-001 Add gateway route registration
  - Depends on: P2-071
  - Deliverables: route module for public base path
  - Acceptance: `/v1/models`, `/v1/messages`, `/v1/chat/completions`, `/v1/responses` are registered in inject tests.

- [x] P3-002 Implement Consumer Key gateway guard
  - Depends on: P1-052, P1-053
  - Deliverables: auth guard reading `Authorization: Bearer` and `x-api-key`
  - Acceptance: tests cover valid, revoked, disabled app, missing key, both headers with Authorization precedence.

- [ ] P3-003 Implement gateway request context
  - Depends on: P3-002
  - Deliverables: typed context with app, consumer key, trace id, source protocol, request start time
  - Acceptance: handlers receive context without re-querying auth state.

## Request Parsing and IR

- [x] P3-010 Implement Anthropic Messages parser
  - Depends on: P0-013
  - Deliverables: wire -> `ChatRequestIR`
  - Acceptance: tests cover system, messages, max tokens, stream false, metadata user id.

- [x] P3-011 Implement OpenAI Chat Completions parser
  - Depends on: P0-013
  - Deliverables: wire -> `ChatRequestIR`
  - Acceptance: tests cover system messages, user field, tools presence, stream false.

- [x] P3-012 Implement OpenAI Responses parser
  - Depends on: P0-013
  - Deliverables: wire -> `ChatRequestIR`
  - Acceptance: tests cover string input, input array, instructions, metadata, reasoning.

- [x] P3-013 Implement parser validation errors
  - Depends on: P3-010, P3-011, P3-012
  - Deliverables: normalized validation errors
  - Acceptance: bad request payloads return protocol-appropriate 400 shapes.

## Target Resolution and Access

- [x] P3-020 Implement target resolution service
  - Depends on: P1-034
  - Deliverables: case-insensitive lookup from requested model to target
  - Acceptance: tests cover public model, model group, missing target.

- [x] P3-021 Wire AccessPolicyService into gateway
  - Depends on: P1-053, P3-020
  - Deliverables: access check for all/restricted Consumer Keys
  - Acceptance: restricted key denies unlisted model with 403.

- [x] P3-022 Implement `/v1/models`
  - Depends on: P3-002, P3-021
  - Deliverables: model list route using access mode
  - Acceptance: all mode lists all enabled targets; restricted mode lists granted targets.

## Candidate Expansion and Filtering

- [x] P3-030 Implement public model candidate expansion
  - Depends on: P1-034, P3-020
  - Deliverables: public model -> concrete candidates
  - Acceptance: candidates include upstream state, endpoint, provider type, priority, weight.

- [x] P3-031 Implement model group candidate expansion
  - Depends on: P3-030
  - Deliverables: model group -> member public model -> candidates
  - Acceptance: disabled group member is excluded; group itself is business semantic layer.

- [x] P3-032 Implement quota pre-check
  - Depends on: P1-033
  - Deliverables: check if request would exceed configured quotas
  - Acceptance: exhausted upstream is filtered before attempt.

- [x] P3-033 Implement capability matching
  - Depends on: P0-014, P3-010, P3-011, P3-012
  - Deliverables: required capabilities from raw request
  - Acceptance: tools/vision/json/thinking requests drop incompatible candidates.

- [x] P3-034 Implement candidate filter pipeline
  - Depends on: P3-030 through P3-033
  - Deliverables: accepted/dropped/fallback result with reasons
  - Acceptance: tests cover each filter reason.

- [x] P3-035 Implement endpoint health sort hook
  - Depends on: P1-035, P3-034
  - Deliverables: degraded/high-latency candidates sorted later
  - Acceptance: health sort does not drop candidates.

## Sticky in Decision Path

- [x] P3-040 Implement conversation fingerprint
  - Depends on: P0-013
  - Deliverables: deterministic fingerprint helper
  - Acceptance: tests cover same prefix same hash, different user/system different hash.

- [x] P3-041 Implement sticky lookup and reorder
  - Depends on: P1-035, P3-040
  - Deliverables: valid sticky candidate moved to front
  - Acceptance: invalid/stale/unavailable sticky ignored.

- [x] P3-042 Implement session sticky lookup and reorder
  - Depends on: P1-035, P3-041
  - Deliverables: fallback short-window sticky when conversation sticky misses
  - Acceptance: session sticky does not override conversation sticky.

## Routing Decision Service

- [x] P3-050 Implement `RoutingDecisionService`
  - Depends on: P3-020 through P3-042
  - Deliverables: orchestrated decision output
  - Acceptance: unit tests cover public model, model group, no route, sticky, restricted key.

- [ ] P3-051 Add decision trace events
  - Depends on: P1-036, P3-050
  - Deliverables: trace entries for request_start, target_resolve, access_allowed, candidates_expand, candidates_filter, sticky_check
  - Acceptance: trace order is deterministic in tests.

## Provider Adapter and Sender

- [x] P3-060 Define provider adapter interface
  - Depends on: P0-013, P0-014
  - Deliverables: adapter types for request/response/error
  - Acceptance: OpenAI and Anthropic adapters compile against same interface.

- [x] P3-061 Implement OpenAI-compatible adapter
  - Depends on: P3-060
  - Deliverables: build request, normalize response, normalize error, extract usage
  - Acceptance: fixture tests cover success and common error body.

- [x] P3-062 Implement Anthropic-compatible adapter
  - Depends on: P3-060
  - Deliverables: build request, normalize response, normalize error, extract cache usage
  - Acceptance: fixture tests cover success and cache token fields.

- [x] P3-063 Implement Responses-compatible request/response handling
  - Depends on: P3-061
  - Deliverables: OpenAI Responses request build/response normalize path
  - Acceptance: fixture tests cover `output_text` extraction and usage.

- [x] P3-064 Implement provider adapter registry
  - Depends on: P3-061, P3-062, P3-063
  - Deliverables: registry by provider type / endpoint protocol
  - Acceptance: unknown provider type fails fast.

- [x] P3-065 Implement upstream auth resolver
  - Depends on: P1-051, P1-033
  - Deliverables: PAT auth header resolution
  - Acceptance: wrong secret produces provider auth resolution error before request.

- [x] P3-066 Implement upstream sender
  - Depends on: P3-060
  - Deliverables: fetch-based sender with timeout, status, headers, body, latency
  - Acceptance: fake upstream tests cover success, HTTP error, timeout, network error.

## Gateway Execution

- [x] P3-070 Implement `GatewayExecutionService`
  - Depends on: P3-050, P3-064, P3-065, P3-066
  - Deliverables: try candidates with max attempts
  - Acceptance: tries next candidate for all normalized provider error categories.

- [x] P3-071 Implement final error aggregation
  - Depends on: P3-070
  - Deliverables: no-route/all-candidates-failed error summary
  - Acceptance: client error hides secrets and trace contains detailed causes.

- [x] P3-072 Implement protocol response mappers
  - Depends on: P3-070
  - Deliverables: normalized response -> Anthropic/OpenAI Chat/OpenAI Responses shapes
  - Acceptance: fixture tests cover all three protocols.

## Side Effects

- [x] P3-080 Implement trace side effects
  - Depends on: P1-036, P3-070
  - Deliverables: candidate_attempt, candidate_fail, candidate_success, request_complete
  - Acceptance: every attempt writes attempt order and candidate id.

- [x] P3-081 Implement usage record write
  - Depends on: P1-036, P3-070
  - Deliverables: success/error usage writes
  - Acceptance: usage write includes app, consumer key, target, upstream, tokens, latency.

- [x] P3-082 Implement quota counter write
  - Depends on: P1-033, P3-070
  - Deliverables: successful request increments enabled quota periods
  - Acceptance: exhausted quota affects next request.

- [x] P3-083 Implement sticky upsert on success
  - Depends on: P1-035, P3-070
  - Deliverables: conversation and session sticky writes
  - Acceptance: second same request hits sticky in test.

- [x] P3-084 Implement cooldown and breaker result hooks
  - Depends on: P1-035, P3-070
  - Deliverables: update cooldown/breaker after attempts
  - Acceptance: failing candidate can be filtered on subsequent request.

## Route Integration

- [x] P3-090 Wire non-streaming gateway routes
  - Depends on: P3-001 through P3-084
  - Deliverables: handlers for three POST endpoints
  - Acceptance: fake upstream integration tests pass.

- [ ] P3-091 Add gateway e2e smoke
  - Depends on: P3-090
  - Deliverables: create config via test helper, call gateway route
  - Acceptance: response includes expected shape and `X-Request-Trace-Id`.

- [ ] P3-092 Run full verification
  - Depends on: P3-091
  - Deliverables: typecheck/test/lint/e2e results
  - Acceptance: all checks pass.

