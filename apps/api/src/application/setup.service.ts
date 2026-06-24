import { verifyPassword } from '../domain/auth/password.js';
import { AdminUserRepository } from '../infrastructure/db/repositories/admin-user.repository.js';
import { UpstreamKeyRepository } from '../infrastructure/db/repositories/upstream-key.repository.js';
import { PublicModelRepository } from '../infrastructure/db/repositories/public-model.repository.js';
import { ConsumerKeyRepository } from '../infrastructure/db/repositories/consumer-key.repository.js';
import { AppRepository } from '../infrastructure/db/repositories/app.repository.js';
import { ProviderPresetRepository } from '../infrastructure/db/repositories/provider-preset.repository.js';
import { UpstreamKeyService } from './upstream-key.service.js';
import { ConsumerKeyService } from '../domain/identity-access/consumer-key.service.js';
import { PublicModelService } from '../domain/model-catalog/public-model.service.js';
import type { Db } from '../infrastructure/db/client.js';
import type { UpstreamKeyInsert, PublicModelCandidateInsert } from '../infrastructure/db/schema.js';
import type { ProviderType } from '@manageyourllm/shared';

export interface SetupStatus {
  hasAdmin: boolean;
  hasSafeSecret: boolean;
  hasUpstream: boolean;
  hasPublicModel: boolean;
  hasConsumerKey: boolean;
  complete: boolean;
}

export interface SetupUpstreamInput {
  name: string;
  providerPresetId?: string | null;
  providerType: string;
  baseUrl: string;
  apiKey: string;
  supportedModels?: string[];
}

export interface SetupModelInput {
  name: string;
  displayName?: string;
  candidates: Array<
    Omit<PublicModelCandidateInsert, 'id' | 'publicModelId' | 'createdAt' | 'updatedAt'>
  >;
}

export interface SetupConsumerKeyResult {
  consumerKeyId: string;
  rawKey: string;
  appId: string;
}

export class SetupService {
  constructor(
    private readonly db: Db,
    private readonly secretKey: string,
  ) {}

  private adminRepo(): AdminUserRepository {
    return new AdminUserRepository(this.db);
  }

  private upstreamRepo(): UpstreamKeyRepository {
    return new UpstreamKeyRepository(this.db);
  }

  private publicModelRepo(): PublicModelRepository {
    return new PublicModelRepository(this.db);
  }

  private consumerKeyRepo(): ConsumerKeyRepository {
    return new ConsumerKeyRepository(this.db);
  }

  async getStatus(): Promise<SetupStatus> {
    const [hasAdmin, hasUpstream, hasPublicModel, hasConsumerKey] = await Promise.all([
      this.adminRepo().hasAdmins(),
      this.upstreamRepo().hasUpstreamKeys(),
      this.publicModelRepo().hasPublicModels(),
      this.consumerKeyRepo().hasConsumerKeys(),
    ]);
    const hasSafeSecret = this.secretKey !== 'dev-secret-change-me';
    const complete = hasAdmin && hasSafeSecret && hasUpstream && hasPublicModel && hasConsumerKey;
    return { hasAdmin, hasSafeSecret, hasUpstream, hasPublicModel, hasConsumerKey, complete };
  }

  async verifySecurity(username: string, password: string): Promise<boolean> {
    const admin = await this.adminRepo().findByUsername(username);
    if (!admin) return false;
    return verifyPassword(password, admin.passwordHash);
  }

  async createUpstream(input: SetupUpstreamInput): Promise<{ upstreamKeyId: string }> {
    const presetRepo = new ProviderPresetRepository(this.db);
    let providerType = input.providerType;
    let baseUrl = input.baseUrl;
    const supportedModels = input.supportedModels ?? [];

    if (input.providerPresetId) {
      const preset = presetRepo.listBuiltins().find((p) => p.id === input.providerPresetId);
      const local = await presetRepo.findLocalById(input.providerPresetId);
      const selected = preset ?? local;
      if (selected) {
        providerType = selected.providerType as ProviderType;
        baseUrl = selected.descriptorJson.endpoints[0]?.baseUrl ?? baseUrl;
      }
    }

    const upstreamService = new UpstreamKeyService(this.db, this.secretKey);
    const upstreamKey = await upstreamService.createUpstreamKey({
      name: input.name,
      providerType: providerType as UpstreamKeyInsert['providerType'],
      baseUrl,
      apiKey: input.apiKey,
      supportedModels,
    });
    return { upstreamKeyId: upstreamKey.id };
  }

  async createModels(inputs: SetupModelInput[]): Promise<{ publicModelIds: string[] }> {
    const service = new PublicModelService(this.db);
    const ids: string[] = [];
    for (const input of inputs) {
      const model = await service.createPublicModel({
        name: input.name,
        displayName: input.displayName,
        candidates: input.candidates,
      });
      ids.push(model.id);
    }
    return { publicModelIds: ids };
  }

  async createDefaultConsumerKey(): Promise<SetupConsumerKeyResult> {
    const appRepo = new AppRepository(this.db);
    const app = await appRepo.createApp({ name: 'Default App', enabled: true });
    const consumerKeyService = new ConsumerKeyService(this.db);
    const result = await consumerKeyService.createConsumerKey({
      appId: app.id,
      name: 'Default Key',
      accessMode: 'all',
    });
    return {
      consumerKeyId: result.consumerKey.id,
      rawKey: result.rawKey,
      appId: app.id,
    };
  }

  generateTestRequest(baseUrl: string, rawKey: string, modelName: string): string {
    const url = `${baseUrl}/v1/chat/completions`;
    return `curl -X POST ${url} \\\n  -H "Authorization: Bearer ${rawKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "${modelName}", "messages": [{"role": "user", "content": "Hello"}]}'`;
  }
}
