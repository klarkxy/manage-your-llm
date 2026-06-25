import { UpstreamAuthResolver } from '../gateway/upstream-auth-resolver.js';
import { UpstreamSender } from '../gateway/upstream-sender.js';
import type { Db } from '../infrastructure/db/client.js';
import { RoutingStateRepository } from '../infrastructure/db/repositories/routing-state.repository.js';
import { UpstreamKeyRepository } from '../infrastructure/db/repositories/upstream-key.repository.js';
import { SettingsService } from '../domain/settings/settings.service.js';
import type { UpstreamKeyRow, AdminSettingsRow } from '../infrastructure/db/schema.js';
import type { PingResult } from './upstream-probe.service.js';

export interface EndpointHealthWorkerDeps {
  db: Db;
  secretKey: string;
  sender?: UpstreamSender;
}

export type EndpointHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export class EndpointHealthWorker {
  private readonly routingStateRepo: RoutingStateRepository;
  private readonly upstreamKeyRepo: UpstreamKeyRepository;
  private readonly authResolver: UpstreamAuthResolver;
  private readonly sender: UpstreamSender;
  private readonly settingsService: SettingsService;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly deps: EndpointHealthWorkerDeps) {
    this.routingStateRepo = new RoutingStateRepository(deps.db);
    this.upstreamKeyRepo = new UpstreamKeyRepository(deps.db);
    this.authResolver = new UpstreamAuthResolver({ secretKey: deps.secretKey });
    this.sender = deps.sender ?? new UpstreamSender();
    this.settingsService = new SettingsService(deps.db);
  }

  start(intervalMs: number): void {
    this.stop();
    this.timer = setInterval(() => {
      this.probeAll().catch(() => {});
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async probeAll(): Promise<void> {
    const settings = await this.settingsService.getSettings();
    if (!settings.endpointHealthProbeEnabled) return;

    const keys = await this.upstreamKeyRepo.listUpstreamKeys();
    const activeKeys = keys.filter((k) => k.enabled && !k.frozen);

    await Promise.all(
      activeKeys.map((upstream) => this.probeOne(upstream, settings).catch(() => {})),
    );
  }

  async probeOne(
    upstream: UpstreamKeyRow,
    settings?: AdminSettingsRow,
    now = new Date(),
  ): Promise<PingResult> {
    const resolvedSettings = settings ?? (await this.settingsService.getSettings());
    const timeoutMs = resolvedSettings.endpointHealthProbeTimeoutMs;
    const degradedLatencyMs = resolvedSettings.endpointHealthProbeDegradedLatencyMs;

    const url = `${upstream.baseUrl.replace(/\/$/, '')}/v1/models`;
    const startedAt = performance.now();

    try {
      const authHeaders = await this.authResolver.resolveAuthHeaders(upstream);
      const res = await this.sender.send({
        url,
        method: 'GET',
        headers: { ...authHeaders, ...(upstream.defaultHeadersJson ?? {}) },
        body: null,
        timeoutMs,
      });
      const latencyMs = Math.round(performance.now() - startedAt);

      const ok = res.status >= 200 && res.status < 300;
      const degraded = !ok || latencyMs > degradedLatencyMs;
      const status: EndpointHealthStatus = ok ? (degraded ? 'degraded' : 'healthy') : 'unhealthy';

      await this.upsertResult(
        upstream,
        {
          ok,
          latencyMs,
          error: ok ? null : `上游返回 ${res.status}`,
        },
        status,
        now,
      );

      return { ok, latencyMs, error: ok ? null : `上游返回 ${res.status}` };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startedAt);
      const message = err instanceof Error ? err.message : String(err);
      await this.upsertResult(upstream, { ok: false, latencyMs, error: message }, 'unhealthy', now);
      return { ok: false, latencyMs, error: message };
    }
  }

  async recordPingResult(
    upstream: UpstreamKeyRow,
    result: PingResult,
    now = new Date(),
  ): Promise<void> {
    const settings = await this.settingsService.getSettings();
    const status: EndpointHealthStatus = result.ok
      ? result.latencyMs > settings.endpointHealthProbeDegradedLatencyMs
        ? 'degraded'
        : 'healthy'
      : 'unhealthy';
    await this.upsertResult(upstream, result, status, now);
  }

  private async upsertResult(
    upstream: UpstreamKeyRow,
    result: PingResult,
    status: EndpointHealthStatus,
    now: Date,
  ): Promise<void> {
    await this.routingStateRepo.upsertEndpointHealth({
      upstreamKeyId: upstream.id,
      endpointBaseUrl: upstream.baseUrl,
      delayMs: result.latencyMs,
      lastCheckedAt: now,
      degraded: status !== 'healthy',
      errorCode: result.ok ? null : 'probe_failed',
      errorMessage: result.error,
    });

    await this.upstreamKeyRepo.updateUpstreamKey(upstream.id, {
      lastHealthStatus: status,
      lastErrorCode: result.ok ? null : 'probe_failed',
      lastErrorMessage: result.error,
    });
  }
}
