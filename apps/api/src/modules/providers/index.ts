export * from './types.js';
export * from './errors.js';
export * from './anthropic-compatible.js';
export * from './openai-compatible.js';
export * from './coze.js';
export * from './codex-adapter.js';
export * from './registry.js';
export * from './ir-converters.js';

import type { ProviderDescriptor } from '@modelharbor/shared';
import {
  getProviderDescriptor,
  listProviderDescriptors,
} from '@modelharbor/shared';
import type {
  ProviderAdapter,
  ProviderHttpRequest,
  ProviderModule,
  ProviderPreset,
  ProviderRequestContext,
  ModelMapping,
} from './types.js';
import { getAdapter } from './registry.js';

function toProviderPreset(descriptor: ProviderDescriptor): ProviderPreset {
  return {
    ...descriptor,
    name: descriptor.metadata.displayName,
    icon: descriptor.branding?.icon,
  };
}

function createModule(descriptor: ProviderDescriptor): ProviderModule {
  return {
    id: descriptor.id,
    preset: toProviderPreset(descriptor),
  };
}

const MODULES: readonly ProviderModule[] = listProviderDescriptors().map(createModule);

const MODULES_BY_ID: Readonly<Record<string, ProviderModule>> = Object.fromEntries(
  MODULES.map((m) => [m.id, m]),
);

export function getProviderModule(id: string): ProviderModule | undefined {
  return MODULES_BY_ID[id];
}

export function listProviderModules(): readonly ProviderModule[] {
  return MODULES;
}

export function getProviderPreset(id: string): ProviderPreset | undefined {
  return getProviderModule(id)?.preset;
}

export function listProviderPresets(): readonly ProviderPreset[] {
  return MODULES.map((m) => m.preset);
}

export function getModelMappings(_preset: ProviderPreset): ModelMapping[] {
  return [];
}

function wrapAdapter(module: ProviderModule, base: ProviderAdapter): ProviderAdapter {
  const transform = module.transformRequest;
  if (!transform) return base;
  return {
    get type() {
      return base.type;
    },
    get capabilities() {
      return base.capabilities;
    },
    buildRequest(context: ProviderRequestContext): ProviderHttpRequest {
      const req = base.buildRequest(context);
      return transform(context, req);
    },
    normalizeResponse(context) {
      return base.normalizeResponse(context);
    },
    normalizeStreamEvent(context) {
      return base.normalizeStreamEvent(context);
    },
    normalizeError(context) {
      return base.normalizeError(context);
    },
    extractUsage(context) {
      return base.extractUsage(context);
    },
  };
}

export function getProviderAdapter(candidate: {
  providerType: import('@modelharbor/shared').ProviderType;
  providerPresetId: string | null;
}): ProviderAdapter {
  const module = candidate.providerPresetId
    ? getProviderModule(candidate.providerPresetId)
    : undefined;
  const base = module?.createAdapter ? module.createAdapter() : getAdapter(candidate.providerType);
  return module ? wrapAdapter(module, base) : base;
}
