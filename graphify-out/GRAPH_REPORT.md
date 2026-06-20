# Graph Report - .  (2026-06-20)

## Corpus Check
- 212 files · ~128,861 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1315 nodes · 2778 edges · 93 communities (79 shown, 14 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 76 edges (avg confidence: 0.84)
- Token cost: 226,360 input · 11,000 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Provider Guides & Descriptors|Provider Guides & Descriptors]]
- [[_COMMUNITY_Gateway Sender & Response Handling|Gateway Sender & Response Handling]]
- [[_COMMUNITY_Admin API Layer|Admin API Layer]]
- [[_COMMUNITY_Admin Route Registration|Admin Route Registration]]
- [[_COMMUNITY_Admin Settings & DB Tables|Admin Settings & DB Tables]]
- [[_COMMUNITY_Provider Guide Documents|Provider Guide Documents]]
- [[_COMMUNITY_Observability & Monitoring|Observability & Monitoring]]
- [[_COMMUNITY_Package Configurations|Package Configurations]]
- [[_COMMUNITY_Upstream Key Helpers|Upstream Key Helpers]]
- [[_COMMUNITY_Database Schema Definitions|Database Schema Definitions]]
- [[_COMMUNITY_API Package Dependencies|API Package Dependencies]]
- [[_COMMUNITY_Web Package Dependencies|Web Package Dependencies]]
- [[_COMMUNITY_Router Candidates & Models|Router Candidates & Models]]
- [[_COMMUNITY_Gateway Stream Handler|Gateway Stream Handler]]
- [[_COMMUNITY_i18n Locale Files|i18n Locale Files]]
- [[_COMMUNITY_Shared Error Taxonomy|Shared Error Taxonomy]]
- [[_COMMUNITY_Auth Module & Admin Auth|Auth Module & Admin Auth]]
- [[_COMMUNITY_Gateway Handler & Failover|Gateway Handler & Failover]]
- [[_COMMUNITY_IR Type Definitions (Anthropic)|IR Type Definitions (Anthropic)]]
- [[_COMMUNITY_TypeScript Configurations|TypeScript Configurations]]
- [[_COMMUNITY_API Auth Endpoints|API Auth Endpoints]]
- [[_COMMUNITY_Gateway Error Normalization|Gateway Error Normalization]]
- [[_COMMUNITY_Consumer Key Management|Consumer Key Management]]
- [[_COMMUNITY_Predev Port Utility Scripts|Predev Port Utility Scripts]]
- [[_COMMUNITY_Upstream OAuth Configuration|Upstream OAuth Configuration]]
- [[_COMMUNITY_Quota & Cooldown DB Tables|Quota & Cooldown DB Tables]]
- [[_COMMUNITY_Documentation - Routing & Models|Documentation - Routing & Models]]
- [[_COMMUNITY_Apps & Audit Admin Routes|Apps & Audit Admin Routes]]
- [[_COMMUNITY_Shared Package Config|Shared Package Config]]
- [[_COMMUNITY_Auth Config Extraction|Auth Config Extraction]]
- [[_COMMUNITY_Codex OAuth Strategy|Codex OAuth Strategy]]
- [[_COMMUNITY_CodexCoze JWT Auth|Codex/Coze JWT Auth]]
- [[_COMMUNITY_Coze OAuth PKCE|Coze OAuth PKCE]]
- [[_COMMUNITY_Documentation - Provider Presets|Documentation - Provider Presets]]
- [[_COMMUNITY_Public Models & Protocol Helpers|Public Models & Protocol Helpers]]
- [[_COMMUNITY_Audit Event Logging|Audit Event Logging]]
- [[_COMMUNITY_Web Frontend Pages (Overview)|Web Frontend Pages (Overview)]]
- [[_COMMUNITY_Router Group Balancing|Router Group Balancing]]
- [[_COMMUNITY_Cooldown & Ping Logic|Cooldown & Ping Logic]]
- [[_COMMUNITY_Auth Strategy Resolution|Auth Strategy Resolution]]
- [[_COMMUNITY_Router Index & Usage Records|Router Index & Usage Records]]
- [[_COMMUNITY_Protocol Request Handlers|Protocol Request Handlers]]
- [[_COMMUNITY_Sticky Session Bindings|Sticky Session Bindings]]
- [[_COMMUNITY_Documentation - Apps & Keys|Documentation - Apps & Keys]]
- [[_COMMUNITY_Gateway Stream Sender|Gateway Stream Sender]]
- [[_COMMUNITY_Web TypeScript Config|Web TypeScript Config]]
- [[_COMMUNITY_Upstream Onboarding|Upstream Onboarding]]
- [[_COMMUNITY_i18n Initialization|i18n Initialization]]
- [[_COMMUNITY_Provider Registry Descriptors|Provider Registry Descriptors]]
- [[_COMMUNITY_ID Generation & Prefixes|ID Generation & Prefixes]]
- [[_COMMUNITY_Model Group Management|Model Group Management]]
- [[_COMMUNITY_Documentation - Getting Started|Documentation - Getting Started]]
- [[_COMMUNITY_API TypeScript Config|API TypeScript Config]]
- [[_COMMUNITY_Login Rate Limiting|Login Rate Limiting]]
- [[_COMMUNITY_Documentation - Model Concepts|Documentation - Model Concepts]]
- [[_COMMUNITY_Implementation Plan & Content Logging|Implementation Plan & Content Logging]]
- [[_COMMUNITY_Provider Registry Presets|Provider Registry Presets]]
- [[_COMMUNITY_Capabilities Routing|Capabilities Routing]]
- [[_COMMUNITY_Consumer Key Auth Middleware|Consumer Key Auth Middleware]]
- [[_COMMUNITY_Documentation - Usage & Security|Documentation - Usage & Security]]
- [[_COMMUNITY_Shared TypeScript Config|Shared TypeScript Config]]
- [[_COMMUNITY_Provider Model Matching|Provider Model Matching]]
- [[_COMMUNITY_Admin Miscellaneous|Admin Miscellaneous]]
- [[_COMMUNITY_API-Web Shared Types|API-Web Shared Types]]
- [[_COMMUNITY_TSConfig Node|TSConfig Node]]
- [[_COMMUNITY_Web-API Integration|Web-API Integration]]
- [[_COMMUNITY_Admin API Helpers|Admin API Helpers]]
- [[_COMMUNITY_Documentation - Key Security|Documentation - Key Security]]
- [[_COMMUNITY_Documentation Index|Documentation Index]]
- [[_COMMUNITY_API Usage Docs|API Usage Docs]]
- [[_COMMUNITY_Deployment Docs|Deployment Docs]]
- [[_COMMUNITY_Security Docs|Security Docs]]
- [[_COMMUNITY_Provider Agnes AI|Provider: Agnes AI]]
- [[_COMMUNITY_Provider Anthropic|Provider: Anthropic]]
- [[_COMMUNITY_Provider Baichuan|Provider: Baichuan]]
- [[_COMMUNITY_Provider ByteDance|Provider: ByteDance]]
- [[_COMMUNITY_Provider Cerebras|Provider: Cerebras]]

## God Nodes (most connected - your core abstractions)
1. `Db` - 66 edges
2. `runGateway()` - 31 edges
3. `handleStreamRequest()` - 30 edges
4. `generateId()` - 28 edges
5. `upstreamKeys` - 27 edges
6. `buildServer()` - 26 edges
7. `makeAdminRig()` - 20 edges
8. `encryptUpstreamApiKey()` - 19 edges
9. `compilerOptions` - 18 edges
10. `makeGatewayRig()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `ModelHarbor 模型港 — Chinese translation of README` --semantically_similar_to--> `ModelHarbor — Lightweight dashboard-first LLM API router`  [INFERRED] [semantically similar]
  README.zh-CN.md → README.md
- `ModelHarbor Brand Logo (blue MH icon)` --conceptually_related_to--> `ModelHarbor LLM Gateway`  [INFERRED]
  apps/web/public/favicon.svg → docs/README.md
- `Key Shown Only Once — Universal security pattern: provider API keys are displayed only at creation time` --semantically_similar_to--> `Security Defaults — Hashed keys, no prompt storage, HTTP-only signed cookies, login rate-limiting`  [INFERRED] [semantically similar]
  apps/web/public/docs/provider-guides/anthropic.md → README.md
- `Personal Access Token (PAT) Auth — Standard sk-... key-based authentication used by most providers` --semantically_similar_to--> `Consumer Key Authentication — Bearer token (preferred) or x-api-key header`  [INFERRED] [semantically similar]
  apps/web/public/docs/provider-guides/openai.md → README.md
- `Phase 2: Provider Capabilities Routing Filter` --conceptually_related_to--> `Request Processing Pipeline (12 steps)`  [INFERRED]
  plan.md → docs/routing-and-resilience.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **All provider guides follow the identical three-step setup template: 1) Create account and set up billing, 2) Create API key on provider platform, 3) Fill in ModelHarbor upstream key drawer with preset, key, and fetch models** — provider_guides_agnes_ai_guide, provider_guides_anthropic_guide, provider_guides_baichuan_guide, provider_guides_bytedance_guide, provider_guides_cerebras_guide, provider_guides_codex_guide, provider_guides_coze_guide, provider_guides_deepseek_guide, provider_guides_fireworks_guide, provider_guides_groq_guide, provider_guides_hunyuan_guide, provider_guides_kimi_code_guide, provider_guides_minimax_intl_guide, provider_guides_minimax_guide, provider_guides_moonshot_cn_guide, provider_guides_moonshot_guide, provider_guides_openai_guide, provider_guides_opencode_go_guide, provider_guides_opencode_zen_guide, provider_guides_openrouter_guide, provider_guides_qianfan_guide [INFERRED 0.95]
- **Providers exposing both Anthropic-compatible and OpenAI-compatible endpoints for dual-protocol routing** — provider_guides_deepseek_guide, provider_guides_minimax_guide, provider_guides_minimax_intl_guide, provider_guides_moonshot_cn_guide, provider_guides_moonshot_guide [INFERRED 0.95]
- **Providers using OAuth-based authentication (browser flow or JWT signing) instead of static PAT keys** — provider_guides_codex_guide, provider_guides_coze_guide [INFERRED 0.95]
- **Provider guides in chunk 2 (8 presets with PAT auth and ModelHarbor Upstream Key flow)** — provider_guides_qwen_intl_preset, provider_guides_qwen_preset, provider_guides_siliconflow_preset, provider_guides_stepfun_preset, provider_guides_together_preset, provider_guides_xai_preset, provider_guides_zhipu_coding_preset, provider_guides_zhipu_preset [INFERRED 0.95]
- **Routing and resilience subsystem (circuit breaker + health probe + sticky + first token timeout + failure categories)** — docs_routing_circuit_breaker, docs_routing_endpoint_health_probe, docs_routing_sticky_sessions, docs_routing_first_token_timeout, docs_routing_failure_categories [EXTRACTED 1.00]
- **Five core concepts of ModelHarbor administration (Upstream Key, Public Model, Model Group, App, Consumer Key)** — docs_readme_upstream_key, docs_readme_public_model, docs_readme_model_group, docs_readme_app, docs_readme_consumer_key [EXTRACTED 1.00]

## Communities (93 total, 14 thin omitted)

### Community 0 - "Provider Guides & Descriptors"
Cohesion: 0.05
Nodes (67): buildPingRequest(), SendOptions, SendOutcome, tryParseJson(), NormalizedErrorLite, buildAnthropicCompatibleRequest(), createAnthropicCompatibleAdapter(), buildCodexRequest() (+59 more)

### Community 1 - "Gateway Sender & Response Handling"
Cohesion: 0.06
Nodes (57): encryptUpstreamApiKey(), generateConsumerKeyRaw(), apps, consumerKeyAccess, consumerKeys, modelGroupMembers, modelGroups, publicModelCandidates (+49 more)

### Community 2 - "Admin API Layer"
Cohesion: 0.04
Nodes (55): accountApi, AdminSummary, AppCreatePayload, appsApi, AppSummary, auditApi, AuditEvent, circuitBreakerApi (+47 more)

### Community 3 - "Admin Route Registration"
Cohesion: 0.09
Nodes (34): registerAppRoutes(), registerAuditRoutes(), registerConsumerKeyRoutes(), registerModelGroupRoutes(), registerObservabilityRoutes(), registerPublicModelRoutes(), registerSettingsRoutes(), registerUpstreamKeyRoutes() (+26 more)

### Community 4 - "Admin Settings & DB Tables"
Cohesion: 0.07
Nodes (41): SettingsRouteDeps, adminSettings, circuitBreakers, contentLogs, upstreamEndpointHealth, UpstreamEndpointHealthRow, JobResult, runMaintenancePass() (+33 more)

### Community 5 - "Provider Guide Documents"
Cohesion: 0.06
Nodes (39): Anthropic Provider Guide — PAT (x-api-key header), endpoint https://api.anthropic.com, preset anthropic, ByteDance Volcano Ark Provider Guide — PAT auth, endpoint IDs instead of model names, preset bytedance, OpenAI Codex Provider Guide — codex_oauth (browser OAuth or refresh token) or PAT, preset codex, Coze Provider Guide — OAuth JWT flow with RSA private key signing, China + International endpoints, preset coze, DeepSeek Provider Guide — PAT auth, dual Anthropic+OpenAI compatible endpoints, preset deepseek, Dual Protocol Endpoint Pattern — Providers exposing both Anthropic-compatible and OpenAI-compatible endpoints, Fetch Models — Auto-discovery of available models from provider API for upstream key configuration, Tencent Hunyuan Provider Guide — TC3-HMAC-SHA256 signing (SecretId+SecretKey), preset hunyuan (+31 more)

### Community 6 - "Observability & Monitoring"
Cohesion: 0.08
Nodes (34): ObservabilityRouteDeps, resolveWindow(), TimeWindowQuery, ModelConsumptionStatInsert, modelConsumptionStats, RequestTraceLogInsert, RequestTraceLogRow, UsageRecordRow (+26 more)

### Community 7 - "Package Configurations"
Cohesion: 0.05
Nodes (37): description, devDependencies, eslint, @eslint/js, globals, @playwright/test, prettier, @types/node (+29 more)

### Community 8 - "Upstream Key Helpers"
Cohesion: 0.10
Nodes (22): decryptUpstreamApiKey(), parseJsonArray(), parseJsonObject(), AuditMeta, buildCozeBotsUrl(), buildModelsUrl(), CozeBotItem, CreateUpstreamKeyBody (+14 more)

### Community 9 - "Database Schema Definitions"
Cohesion: 0.07
Nodes (28): AdminSettingsInsert, AdminSettingsRow, AppInsert, AuditEventRow, CircuitBreakerInsert, CircuitBreakerRow, ConsumerKeyAccessInsert, ConsumerKeyInsert (+20 more)

### Community 10 - "API Package Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, drizzle-orm, fastify, @fastify/cookie, @fastify/sensible, @fastify/static, @libsql/client, @modelharbor/shared (+19 more)

### Community 11 - "Web Package Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, @modelharbor/shared, naive-ui, pinia, vfonts, vue, vue-i18n, vue-router (+19 more)

### Community 12 - "Router Candidates & Models"
Cohesion: 0.12
Nodes (23): ModelGroupMemberRow, PublicModelCandidateRow, PublicModelRow, UpstreamKeyRow, CandidateRow, checkCapabilityMismatch(), expandCandidates(), expandEndpoints() (+15 more)

### Community 13 - "Gateway Stream Handler"
Cohesion: 0.15
Nodes (26): buildProviderRequest(), CLIENT_DISCONNECTED, driveStream(), FAILOVER_CATEGORIES, FirstTokenWaitResult, handleStreamRequest(), prependFirstEvent(), providerCtxOf() (+18 more)

### Community 14 - "i18n Locale Files"
Cohesion: 0.18
Nodes (13): messages, messages, messages, messages, supportedLocales, messages, messages, messages (+5 more)

### Community 15 - "Shared Error Taxonomy"
Cohesion: 0.12
Nodes (11): AuthenticationError, NormalizedError, NoRouteAvailableError, PermissionError, ProviderError, ProviderQuotaError, ProviderRateLimitError, ProviderStreamError (+3 more)

### Community 16 - "Auth Module & Admin Auth"
Cohesion: 0.14
Nodes (19): AdminAuthDeps, AdminBootstrapOptions, AuthenticatedRequest, createSession(), CreateSessionInput, deleteSession(), findSessionById(), touchSession() (+11 more)

### Community 17 - "Gateway Handler & Failover"
Cohesion: 0.17
Nodes (19): StickySessionRow, ClassifiedOutcome, classifyOutcome(), FAILOVER_CATEGORIES, GatewayOutcome, requestToContext(), runGateway(), generateTraceId() (+11 more)

### Community 18 - "IR Type Definitions (Anthropic)"
Cohesion: 0.10
Nodes (20): AnthropicContentBlock, AnthropicErrorBody, AnthropicMessage, AnthropicMessagesRequest, AnthropicMessagesResponse, ChatMessageIR, ChatRole, ChatUsageIR (+12 more)

### Community 19 - "TypeScript Configurations"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib (+11 more)

### Community 20 - "API Auth Endpoints"
Cohesion: 0.16
Nodes (12): AdminSummary, authApi, LoginResponse, MeResponse, api, ApiClientError, ApiError, isApiErrorShape() (+4 more)

### Community 21 - "Gateway Error Normalization"
Cohesion: 0.18
Nodes (15): requireConsumerKey(), anthropicErrorBody(), mapCategoryToAnthropicType(), providerErrorToNormalized(), touchUpstreamLastUsed(), irToAnthropicResponse(), irToCodexResponse(), irToOpenAIResponse() (+7 more)

### Community 22 - "Consumer Key Management"
Cohesion: 0.15
Nodes (13): AccessInput, ConsumerKeyRouteDeps, assertModelGroupExists(), assertPositiveInt(), assertPublicModelExists(), assertQuotaPeriod(), DbTx, findModelGroupById() (+5 more)

### Community 23 - "Predev Port Utility Scripts"
Cohesion: 0.22
Nodes (16): collectAncestors(), execOrNull(), getCommandLineUnix(), getCommandLineWindows(), getParentPidUnix(), getParentPidWindows(), isProjectProcessUnix(), isProjectProcessWindows() (+8 more)

### Community 24 - "Upstream OAuth Configuration"
Cohesion: 0.13
Nodes (11): DiscoverModelsBody, assertAuthTypeForProvider(), assertProvider(), normalizeInitBody(), OAuthExchangeBody, OAuthInitBody, OAuthProvider, UpstreamOAuthRouteDeps (+3 more)

### Community 25 - "Quota & Cooldown DB Tables"
Cohesion: 0.21
Nodes (15): QuotaPeriod, UpstreamKeyCounterRow, upstreamKeyCounters, UpstreamKeyQuotaRow, upstreamKeyQuotas, freezeKeyForQuota(), getCountersForKey(), getCurrentCounter() (+7 more)

### Community 26 - "Documentation - Routing & Models"
Cohesion: 0.15
Nodes (17): Client Error Codes (401/403/404/429/502/503), Cross-Protocol Streaming Limitation, Health Check Endpoints (/healthz, /readyz), Routing Strategies (failover, round_robin, random, weighted), Availability Priority over Sticky Binding Design Principle, Circuit Breaker System, Endpoint Health Probe System, Upstream Failure Categories (10 types) (+9 more)

### Community 27 - "Apps & Audit Admin Routes"
Cohesion: 0.14
Nodes (13): AppRouteDeps, AuditRouteDeps, auditMetaFromRequest(), DiscoverContext, UpstreamKeyRouteDeps, Db, auditEvents, GatewayRequestContext (+5 more)

### Community 28 - "Shared Package Config"
Cohesion: 0.13
Nodes (15): devDependencies, typescript, vitest, exports, import, main, name, private (+7 more)

### Community 29 - "Auth Config Extraction"
Cohesion: 0.21
Nodes (12): parseJsonRecord(), extractAuthConfig(), decryptAuthConfig(), persistRotatedRefreshToken(), decryptAuthConfig(), persistRotatedRefreshToken(), decryptSecret(), deriveKey() (+4 more)

### Community 30 - "Codex OAuth Strategy"
Cohesion: 0.16
Nodes (11): assertString(), CodexOauthConfig, exchangeCodexCode(), normalizeConfig(), parseTokenResponse(), refreshPromises, tokenCache, TokenCacheEntry (+3 more)

### Community 31 - "Codex/Coze JWT Auth"
Cohesion: 0.15
Nodes (10): codexOauthStrategy, _resetCodexOauthCache(), base64UrlEncode(), CozeOauthJwtConfig, cozeOauthJwtStrategy, signJwt(), TOKEN_CACHE, cozeOauthPkceStrategy (+2 more)

### Community 32 - "Coze OAuth PKCE"
Cohesion: 0.19
Nodes (13): assertString(), authorizeBaseForCoze(), buildCozeAuthorizeUrl(), CozeOauthPkceConfig, exchangeCozeCode(), normalizeConfig(), OAuthTokenResponse, parseTokenResponse() (+5 more)

### Community 33 - "Documentation - Provider Presets"
Cohesion: 0.25
Nodes (15): Auto-Discover Models (Fetch models), Provider Guides Index (28+ providers), Authentication Strategies (PAT, Coze OAuth JWT, Coze OAuth PKCE), Provider Preset System, Upstream Key Entity, Phase 8: Provider Descriptor and Preset Library Refactor, ProviderDescriptor Type Definition, Alibaba Qwen DashScope International Provider Preset (+7 more)

### Community 34 - "Public Models & Protocol Helpers"
Cohesion: 0.20
Nodes (11): assertProviderType(), assertSourceProtocol(), deleteTargetRow(), CandidateInput, normalizeCandidateEndpointFields(), PresentCandidate, PublicModelRouteDeps, normalizeEndpoints() (+3 more)

### Community 35 - "Audit Event Logging"
Cohesion: 0.21
Nodes (11): audit(), AuditEventInsert, AuditAction, AuditEventInput, recordAuditEvent(), HEADER_KEYS, PREFIX_PATTERNS, redactArg() (+3 more)

### Community 36 - "Web Frontend Pages (Overview)"
Cohesion: 0.14
Nodes (3): i18n, router, app

### Community 37 - "Router Group Balancing"
Cohesion: 0.23
Nodes (13): GatewayError, GatewaySuccess, ResolvedCandidate, balanceGroupCandidates(), BalanceGroupInput, GROUP_BALANCE_MODES, GroupBalanceMode, GroupBalanceResult (+5 more)

### Community 38 - "Cooldown & Ping Logic"
Cohesion: 0.22
Nodes (11): pingUpstreamModel(), resolveAuthorizationHeader(), applyCooldown(), computeCooldownUpdate(), COOLDOWN_MS, CooldownUpdate, shouldCooldown(), buildHttpRequest() (+3 more)

### Community 39 - "Auth Strategy Resolution"
Cohesion: 0.22
Nodes (10): AuthHeaderResult, normalizeAuthType(), PlainAuthCredentials, resolveAuthorizationHeaderFromCredentials(), STRATEGIES, UpstreamAuthContext, UpstreamAuthKey, UpstreamAuthStrategy (+2 more)

### Community 40 - "Router Index & Usage Records"
Cohesion: 0.19
Nodes (9): TargetType, UsageRecordInsert, usageRecords, ListModelsEntry, assertConsumerKeyAccess(), GroupBalanceTarget, ResolvedTarget, resolveTargetByName() (+1 more)

### Community 41 - "Protocol Request Handlers"
Cohesion: 0.24
Nodes (12): handleAnthropicRequest(), handleCodexRequest(), handleOpenAIRequest(), buildStreamRequest(), anthropicRequestToIR(), codexRequestToIR(), extractAnthropicSystem(), extractAnthropicText() (+4 more)

### Community 42 - "Sticky Session Bindings"
Cohesion: 0.20
Nodes (11): StickyBindingRow, stickyBindings, conversationFingerprint(), getHitCount(), isStickyBindingValid(), listStickyBindingsForConsumer(), lookupStickyBinding(), StickyLookupInput (+3 more)

### Community 43 - "Documentation - Apps & Keys"
Cohesion: 0.20
Nodes (12): Anthropic Messages Protocol Endpoint, OpenAI Chat Completions Protocol Endpoint, App Entity (Tenant Boundary), Consumer Key Entity (mh_ prefix), Key Rotate and Revoke Operations, App Concept (Tenant Boundary), Consumer Key Concept, Model Group Concept (+4 more)

### Community 44 - "Gateway Stream Sender"
Cohesion: 0.18
Nodes (10): DriveStreamArgs, RawStreamEvent, startUpstreamStream(), StreamSendOptions, StreamStart, StreamStartErrorBody, StreamStartOk, StreamStartTransport (+2 more)

### Community 45 - "Web TypeScript Config"
Cohesion: 0.17
Nodes (11): compilerOptions, jsx, lib, noEmit, outDir, paths, types, exclude (+3 more)

### Community 46 - "Upstream Onboarding"
Cohesion: 0.22
Nodes (8): getUpstreamKeyCandidates(), OnboardingMapping, OnboardingResult, onboardUpstreamKey(), onboardUpstreamKeyWithMappings(), syncUpstreamKeyMappings(), UpstreamKeyCandidate, UpstreamKeyCandidateMapping

### Community 47 - "i18n Initialization"
Cohesion: 0.40
Nodes (8): detectBrowserLocale(), getInitialLocale(), isSupportedLocale(), LocaleOption, localeOptions, saveLocale(), messages, SupportedLocale

### Community 48 - "Provider Registry Descriptors"
Cohesion: 0.24
Nodes (9): descriptorDefaultEndpoint(), descriptorDiscoveryEndpoint(), ProviderBranding, ProviderDescriptor, ProviderDescriptorAuthStrategies, ProviderDescriptorCapabilities, ProviderDescriptorEndpoint, ProviderMetadata (+1 more)

### Community 49 - "ID Generation & Prefixes"
Cohesion: 0.22
Nodes (5): IdKind, PREFIXES, ALL_PROVIDER_TYPES, ALL_SOURCE_PROTOCOLS, PROTOCOL_BY_PROVIDER

### Community 50 - "Model Group Management"
Cohesion: 0.22
Nodes (6): assertTargetName(), MemberInput, ModelGroupRouteDeps, PresentMember, ModelGroupRow, isGroupBalanceMode()

### Community 51 - "Documentation - Getting Started"
Cohesion: 0.28
Nodes (9): ModelHarbor Environment Variables, Single-Service Deployment Model, Getting Started Quickstart Flow, Admin Dashboard (port 5421), Recommended Reading Paths (deploy, configure, maintain), Admin Authentication (scrypt + signed cookie), MODELHARBOR_SECRET_KEY Encryption, Upstream API Key Encryption-at-Rest (+1 more)

### Community 52 - "API TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, types, exclude, extends, include

### Community 53 - "Login Rate Limiting"
Cohesion: 0.25
Nodes (7): loginAttempts, DEFAULT_LOGIN_RATE_LIMIT, inspectLoginRateLimit(), RateLimitDecision, RateLimitOptions, recordLoginAttempt(), resetLoginFailures()

### Community 54 - "Documentation - Model Concepts"
Cohesion: 0.29
Nodes (8): Candidate Mapping (upstream key + real model), Shared Global Namespace for Public Models and Model Groups, Model Group Management, Public Model Management, Public Model Concept, Real vs Public Model Name Decoupling Design, Phase 1: Fix Model Group Auto-Creation, upstream-onboarding.ts Auto Group Removal

### Community 55 - "Implementation Plan & Content Logging"
Cohesion: 0.25
Nodes (8): Content Logging with Sensitive Data Redaction, content_logs Database Table, ModelHarbor Implementation Plan (8 phases), model_consumption_stats Database Table, Phase 2: Provider Capabilities Routing Filter, Phase 4: Daily Consumption Statistics, Phase 5: Cache Token Fields in Usage Records, Phase 6: Optional Content Logging Switch

### Community 56 - "Provider Registry Presets"
Cohesion: 0.39
Nodes (6): capabilities(), getProviderDescriptor(), listProviderDescriptors(), preset(), PRESETS_BY_ID, PROVIDER_PRESETS

### Community 57 - "Capabilities Routing"
Cohesion: 0.29
Nodes (6): ProviderCapabilities, requiredCapabilities, RequiredCapability, UsageAvailability, ChatRequestIR, SourceProtocol

### Community 58 - "Consumer Key Auth Middleware"
Cohesion: 0.38
Nodes (5): AuthenticatedConsumerRequest, listConsumerKeyAccess(), AppRow, ConsumerKeyAccessRow, ConsumerKeyRow

### Community 59 - "Documentation - Usage & Security"
Cohesion: 0.33
Nodes (7): X-Request-Trace-Id Response Header, Audit Event Logging, Admin Overview Dashboard, Request Trace (traceId-based link timeline), Usage Statistics Page, Phase 3: Request Trace Logging System, request_trace_logs Database Table

### Community 60 - "Shared TypeScript Config"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, exclude, extends, include

### Community 61 - "Provider Model Matching"
Cohesion: 0.40
Nodes (5): resolveModelEndpoint(), normalizeOpenCodeGoModelName(), OPENCODE_GO_ANTHROPIC_MODELS, OPENCODE_GO_OPENAI_MODELS, opencodeGoEndpointProtocolForModel()

### Community 62 - "Admin Miscellaneous"
Cohesion: 0.33
Nodes (4): currentLanguage, languageOptions, userLabel, userOptions

## Knowledge Gaps
- **435 isolated node(s):** `name`, `version`, `private`, `type`, `main` (+430 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Db` connect `Apps & Audit Admin Routes` to `Gateway Sender & Response Handling`, `Admin Route Registration`, `Admin Settings & DB Tables`, `Observability & Monitoring`, `Upstream Key Helpers`, `Router Candidates & Models`, `Gateway Stream Handler`, `Auth Module & Admin Auth`, `Gateway Handler & Failover`, `Gateway Error Normalization`, `Consumer Key Management`, `Upstream OAuth Configuration`, `Quota & Cooldown DB Tables`, `Public Models & Protocol Helpers`, `Audit Event Logging`, `Router Group Balancing`, `Cooldown & Ping Logic`, `Auth Strategy Resolution`, `Router Index & Usage Records`, `Sticky Session Bindings`, `Upstream Onboarding`, `Model Group Management`, `Login Rate Limiting`, `Consumer Key Auth Middleware`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `generateId()` connect `Gateway Sender & Response Handling` to `Audit Event Logging`, `Admin Route Registration`, `Admin Settings & DB Tables`, `Gateway Stream Handler`, `Auth Module & Admin Auth`, `Gateway Handler & Failover`, `ID Generation & Prefixes`, `Login Rate Limiting`, `Quota & Cooldown DB Tables`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `upstreamKeys` connect `Gateway Sender & Response Handling` to `Coze OAuth PKCE`, `Public Models & Protocol Helpers`, `Admin Settings & DB Tables`, `Cooldown & Ping Logic`, `Observability & Monitoring`, `Upstream Key Helpers`, `Database Schema Definitions`, `Router Candidates & Models`, `Gateway Handler & Failover`, `Quota & Cooldown DB Tables`, `Codex OAuth Strategy`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 26 inferred relationships involving `generateId()` (e.g. with `bootstrapAdmin()` and `createSession()`) actually correct?**
  _`generateId()` has 26 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _442 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Provider Guides & Descriptors` be split into smaller, more focused modules?**
  _Cohesion score 0.05054945054945055 - nodes in this community are weakly interconnected._
- **Should `Gateway Sender & Response Handling` be split into smaller, more focused modules?**
  _Cohesion score 0.06416978776529339 - nodes in this community are weakly interconnected._