import { TargetRepository } from '../../infrastructure/db/repositories/target.repository.js';
import { PublicModelRepository } from '../../infrastructure/db/repositories/public-model.repository.js';
import { ModelGroupRepository } from '../../infrastructure/db/repositories/model-group.repository.js';
import { TargetNotFoundError } from '@manageyourllm/shared';
import type { Db } from '../../infrastructure/db/client.js';
import type { TargetType } from '../../infrastructure/db/schema.js';

export interface ResolvedPublicModel {
  type: 'public_model';
  id: string;
  name: string;
  entity: Awaited<ReturnType<PublicModelRepository['findById']>>;
}

export interface ResolvedModelGroup {
  type: 'model_group';
  id: string;
  name: string;
  entity: Awaited<ReturnType<ModelGroupRepository['findById']>>;
}

export type ResolvedTarget = ResolvedPublicModel | ResolvedModelGroup;

export class TargetResolutionService {
  constructor(private readonly db: Db) {}

  private targetRepo(): TargetRepository {
    return new TargetRepository(this.db);
  }

  private publicModelRepo(): PublicModelRepository {
    return new PublicModelRepository(this.db);
  }

  private modelGroupRepo(): ModelGroupRepository {
    return new ModelGroupRepository(this.db);
  }

  async resolve(requestedModel: string): Promise<ResolvedTarget> {
    const target = await this.targetRepo().findByName(requestedModel);
    if (!target) {
      throw new TargetNotFoundError(`目标模型 "${requestedModel}" 不存在`);
    }

    if (target.targetType === 'public_model') {
      const entity = await this.publicModelRepo().findById(target.targetId);
      if (!entity) {
        throw new TargetNotFoundError(`目标模型 "${requestedModel}" 已失效`);
      }
      return {
        type: 'public_model',
        id: entity.id,
        name: entity.name,
        entity,
      };
    }

    const entity = await this.modelGroupRepo().findById(target.targetId);
    if (!entity) {
      throw new TargetNotFoundError(`目标模型组 "${requestedModel}" 已失效`);
    }
    return {
      type: 'model_group',
      id: entity.id,
      name: entity.name,
      entity,
    };
  }

  async resolveByType(targetType: TargetType, targetId: string): Promise<ResolvedTarget> {
    if (targetType === 'public_model') {
      const entity = await this.publicModelRepo().findById(targetId);
      if (!entity) {
        throw new TargetNotFoundError('目标公共模型不存在');
      }
      return { type: 'public_model', id: entity.id, name: entity.name, entity };
    }

    const entity = await this.modelGroupRepo().findById(targetId);
    if (!entity) {
      throw new TargetNotFoundError('目标模型组不存在');
    }
    return { type: 'model_group', id: entity.id, name: entity.name, entity };
  }
}
