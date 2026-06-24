import { PublicModelRepository } from '../infrastructure/db/repositories/public-model.repository.js';
import { ModelGroupRepository } from '../infrastructure/db/repositories/model-group.repository.js';
import { ConsumerKeyRepository } from '../infrastructure/db/repositories/consumer-key.repository.js';
import type { Db } from '../infrastructure/db/client.js';
import type { ConsumerKeyRow, AppRow } from '../infrastructure/db/schema.js';

export interface GatewayExecutionContext {
  db: Db;
  consumerKey: ConsumerKeyRow;
  app: AppRow;
  requestTraceId: string;
}

export interface ModelListItem {
  id: string;
  object: 'model';
  created?: number;
  owned_by?: string;
}

export class GatewayExecutionService {
  async listModels(ctx: GatewayExecutionContext): Promise<{ object: 'list'; data: ModelListItem[] }> {
    const publicModelRepo = new PublicModelRepository(ctx.db);
    const modelGroupRepo = new ModelGroupRepository(ctx.db);

    const [publicModels, modelGroups] = await Promise.all([
      publicModelRepo.listPublicModels(),
      modelGroupRepo.listModelGroups(),
    ]);

    const enabledModels = publicModels.filter((m) => m.enabled);
    const enabledGroups = modelGroups.filter((g) => g.enabled);

    let allowedModels = enabledModels;
    let allowedGroups = enabledGroups;

    if (ctx.consumerKey.accessMode === 'restricted') {
      const accessList = await new ConsumerKeyRepository(ctx.db).listAccessByKey(ctx.consumerKey.id);
      const allowedModelIds = new Set(
        accessList.filter((a) => a.targetType === 'public_model').map((a) => a.targetId),
      );
      const allowedGroupIds = new Set(
        accessList.filter((a) => a.targetType === 'model_group').map((a) => a.targetId),
      );
      allowedModels = enabledModels.filter((m) => allowedModelIds.has(m.id));
      allowedGroups = enabledGroups.filter((g) => allowedGroupIds.has(g.id));
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const data: ModelListItem[] = [
      ...allowedModels.map((m) => ({
        id: m.name,
        object: 'model' as const,
        created: nowSeconds,
        owned_by: 'manageyourllm',
      })),
      ...allowedGroups.map((g) => ({
        id: g.name,
        object: 'model' as const,
        created: nowSeconds,
        owned_by: 'manageyourllm',
      })),
    ];

    return { object: 'list', data };
  }
}
