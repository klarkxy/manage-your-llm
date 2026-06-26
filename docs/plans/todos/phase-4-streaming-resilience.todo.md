# Phase 4 TODO: Streaming & Resilience

目标：实现流式网关、首 token 前 failover、完整 sticky、熔断、健康探测和维护任务。

## Stream Contract

- [ ] P4-001 Define stream adapter contract
  - Depends on: P3-060
  - Deliverables: stream request/response interfaces
  - Acceptance: adapters can declare supported streaming conversions.

- [ ] P4-002 Define stream lifecycle events
  - Depends on: P1-036
  - Deliverables: trace step types for stream_start, first_token, stream_end, stream_error, first_token_timeout
  - Acceptance: trace schema supports stream fields.

## SSE Adapters

- [x] P4-010 Implement Anthropic SSE passthrough/normalizer
  - Depends on: P4-001, P3-062
  - Deliverables: upstream Anthropic stream -> client Anthropic stream
  - Acceptance: fixture stream test passes through valid events.

- [x] P4-011 Implement OpenAI Chat SSE passthrough/normalizer
  - Depends on: P4-001, P3-061
  - Deliverables: upstream OpenAI Chat stream -> client OpenAI stream
  - Acceptance: fixture stream test captures usage when present.

- [x] P4-012 Implement Responses SSE passthrough/normalizer
  - Depends on: P4-001, P3-063
  - Deliverables: upstream Responses stream -> client Responses stream
  - Acceptance: output text events and completed usage parse.

- [ ] P4-013 Implement supported cross-protocol stream guards
  - Depends on: P4-010, P4-011, P4-012
  - Deliverables: validation for unsupported stream conversions
  - Acceptance: unsupported cross-protocol stream returns clear validation error.

## Stream Orchestration

- [ ] P4-020 Implement `StreamOrchestrator`
  - Depends on: P3-050, P4-010 through P4-013
  - Deliverables: streaming equivalent of gateway orchestration
  - Acceptance: stream route can use same routing decision service.

- [x] P4-021 Implement first-token timeout
  - Depends on: P4-020
  - Deliverables: timeout before response commit, candidate retry
  - Acceptance: fake upstream delayed first token triggers next candidate.

- [x] P4-022 Implement committed-stream behavior
  - Depends on: P4-021
  - Deliverables: once first token is sent, no candidate switch
  - Acceptance: upstream later error ends stream and records error without retrying.

- [x] P4-023 Implement stream usage collection
  - Depends on: P4-010, P4-011, P4-012
  - Deliverables: best-effort usage parser and final usage write
  - Acceptance: stream usage writes tokens when events include usage.

- [ ] P4-024 Implement stream trace events
  - Depends on: P4-002, P4-020
  - Deliverables: stream lifecycle trace writes
  - Acceptance: trace shows first token latency and final stream status.

- [x] P4-025 Wire streaming gateway routes
  - Depends on: P4-020 through P4-024
  - Deliverables: stream dispatch for all three POST endpoints
  - Acceptance: stream true requests do not enter non-streaming path.

## Sticky Completion

- [ ] P4-030 Add sticky TTL settings
  - Depends on: P1-019, P3-083
  - Deliverables: settings/upstream-level TTL configuration
  - Acceptance: TTL affects new sticky rows.

- [x] P4-031 Add sticky cleanup
  - Depends on: P1-035
  - Deliverables: delete expired conversation/session sticky rows
  - Acceptance: maintenance test removes expired rows.

- [ ] P4-032 Add sticky admin visibility
  - Depends on: P3-083
  - Deliverables: admin API to inspect sticky rows for a consumer/target
  - Acceptance: route returns rows without exposing secrets.

## Circuit Breaker

- [ ] P4-040 Implement breaker state machine
  - Depends on: P1-035
  - Deliverables: closed/open/half_open transitions
  - Acceptance: tests cover threshold, cooldown, half-open success and failure.

- [x] P4-041 Integrate breaker allow check into filter
  - Depends on: P4-040, P3-034
  - Deliverables: breaker open filter reason
  - Acceptance: open breaker drops candidate before attempt.

- [x] P4-042 Integrate breaker result recording
  - Depends on: P4-040, P3-084, P4-025
  - Deliverables: non-stream and stream result updates
  - Acceptance: failed stream before first token counts as failure.

- [ ] P4-043 Add breaker admin reset
  - Depends on: P4-040
  - Deliverables: list/reset API and minimal UI hook
  - Acceptance: reset closes breaker.

## Cooldown and Health

- [ ] P4-050 Implement cooldown policy
  - Depends on: P3-084
  - Deliverables: category -> cooldown duration mapping
  - Acceptance: auth/bad_request do not accidentally get excessive cooldown unless configured.

- [x] P4-051 Implement endpoint health probe worker
  - Depends on: P1-035
  - Deliverables: lightweight HEAD/GET probe, latency, degraded state
  - Acceptance: fake endpoint health tests pass.

- [x] P4-052 Implement endpoint health sorting in live gateway
  - Depends on: P4-051, P3-035
  - Deliverables: gateway decision uses latest health rows
  - Acceptance: degraded endpoint sorts after healthy endpoint.

- [x] P4-053 Implement manual model ping updates
  - Depends on: P2-034
  - Deliverables: ping results update candidate/upstream health fields
  - Acceptance: ping failure visible in admin API.

## Maintenance Jobs

- [x] P4-060 Implement maintenance service
  - Depends on: P1-036, P4-031, P4-040, P4-050, P4-051
  - Deliverables: run-on-interval and manual run method
  - Acceptance: service can be disabled in tests.

- [x] P4-061 Add trace cleanup
  - Depends on: P4-060
  - Deliverables: remove trace rows older than 30 days
  - Acceptance: cleanup test removes only old rows.

- [ ] P4-062 Add temporary debug content cleanup
  - Depends on: P4-060
  - Deliverables: remove expired debug content rows and disable expired debug mode
  - Acceptance: cleanup test covers expiry.

- [x] P4-063 Add quota window maintenance
  - Depends on: P4-060, P3-082
  - Deliverables: reset/roll quota counters as needed
  - Acceptance: expired period starts new counter window.

- [x] P4-064 Add cooldown cleanup
  - Depends on: P4-060, P4-050
  - Deliverables: clear expired cooldown fields
  - Acceptance: expired cooldown no longer filters candidate.

## Route and UI Integration

- [ ] P4-080 Add streaming integration tests
  - Depends on: P4-025
  - Deliverables: fake upstream stream tests for all protocols
  - Acceptance: tests cover success, first-token timeout, post-commit error.

- [ ] P4-081 Add resilience settings UI/API
  - Depends on: P4-040, P4-050, P4-051
  - Deliverables: settings for first-token timeout and simple breaker/health status
  - Acceptance: settings update affects services.

- [ ] P4-082 Run full verification
  - Depends on: P4-080, P4-081
  - Deliverables: typecheck/test/lint/e2e results
  - Acceptance: all checks pass.

