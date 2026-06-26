<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMessage } from 'naive-ui';
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
  NSpace,
  NButton,
  NSpin,
  NCollapse,
  NCollapseItem,
  NDivider,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { getSettings, updateSettings } from '../api/admin/settings.js';
import type { SettingsContract, UpdateSettingsRequest } from '@manageyourllm/contracts';

const { t } = useI18n();
const message = useMessage();

const loading = ref(false);
const saving = ref(false);
const settings = ref<SettingsContract | null>(null);
const form = ref({
  publicBaseUrl: '',
  gatewayBasePath: '',
  defaultRequestTimeoutMs: 30_000,
  defaultRetries: 0,
  enableStickySession: true,
  enableCircuitBreaker: true,
  firstTokenTimeoutMs: 30_000,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerBaseCooldownMs: 30_000,
  circuitBreakerMaxCooldownMs: 300_000,
  circuitBreakerHalfOpenSuccessCount: 3,
  endpointHealthProbeEnabled: false,
  endpointHealthProbeIntervalMs: 30_000,
  endpointHealthProbeTimeoutMs: 10_000,
  endpointHealthProbeDegradedLatencyMs: 2000,
  upstreamCooldownBaseMs: 30_000,
  upstreamCooldownMaxMs: 300_000,
});

async function load() {
  loading.value = true;
  try {
    settings.value = await getSettings();
    const s = settings.value;
    form.value = {
      publicBaseUrl: s.publicBaseUrl ?? '',
      gatewayBasePath: s.gatewayBasePath ?? '',
      defaultRequestTimeoutMs: s.defaultRequestTimeoutMs ?? 30_000,
      defaultRetries: s.defaultRetries ?? 0,
      enableStickySession: !!s.enableStickySession,
      enableCircuitBreaker: !!s.enableCircuitBreaker,
      firstTokenTimeoutMs: s.firstTokenTimeoutMs ?? 30_000,
      circuitBreakerFailureThreshold: s.circuitBreakerFailureThreshold ?? 5,
      circuitBreakerBaseCooldownMs: s.circuitBreakerBaseCooldownMs ?? 30_000,
      circuitBreakerMaxCooldownMs: s.circuitBreakerMaxCooldownMs ?? 300_000,
      circuitBreakerHalfOpenSuccessCount: s.circuitBreakerHalfOpenSuccessCount ?? 3,
      endpointHealthProbeEnabled: !!s.endpointHealthProbeEnabled,
      endpointHealthProbeIntervalMs: s.endpointHealthProbeIntervalMs ?? 30_000,
      endpointHealthProbeTimeoutMs: s.endpointHealthProbeTimeoutMs ?? 10_000,
      endpointHealthProbeDegradedLatencyMs: s.endpointHealthProbeDegradedLatencyMs ?? 2000,
      upstreamCooldownBaseMs: s.upstreamCooldownBaseMs ?? 30_000,
      upstreamCooldownMaxMs: s.upstreamCooldownMaxMs ?? 300_000,
    };
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  try {
    const payload: UpdateSettingsRequest = {
      publicBaseUrl: form.value.publicBaseUrl || null,
      gatewayBasePath: form.value.gatewayBasePath || null,
      defaultRequestTimeoutMs: form.value.defaultRequestTimeoutMs,
      defaultRetries: form.value.defaultRetries,
      enableStickySession: form.value.enableStickySession,
      enableCircuitBreaker: form.value.enableCircuitBreaker,
      firstTokenTimeoutMs: form.value.firstTokenTimeoutMs,
      circuitBreakerFailureThreshold: form.value.circuitBreakerFailureThreshold,
      circuitBreakerBaseCooldownMs: form.value.circuitBreakerBaseCooldownMs,
      circuitBreakerMaxCooldownMs: form.value.circuitBreakerMaxCooldownMs,
      circuitBreakerHalfOpenSuccessCount: form.value.circuitBreakerHalfOpenSuccessCount,
      endpointHealthProbeEnabled: form.value.endpointHealthProbeEnabled,
      endpointHealthProbeIntervalMs: form.value.endpointHealthProbeIntervalMs,
      endpointHealthProbeTimeoutMs: form.value.endpointHealthProbeTimeoutMs,
      endpointHealthProbeDegradedLatencyMs: form.value.endpointHealthProbeDegradedLatencyMs,
      upstreamCooldownBaseMs: form.value.upstreamCooldownBaseMs,
      upstreamCooldownMaxMs: form.value.upstreamCooldownMaxMs,
    };
    settings.value = await updateSettings(payload);
    message.success(t('common.saved'));
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.saveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <NCard :title="t('settings.title')">
    <NSpin :show="loading">
      <NForm label-placement="left" label-width="240px">
        <NFormItem :label="t('settings.publicBaseUrl')">
          <NInput v-model:value="form.publicBaseUrl" />
        </NFormItem>
        <NFormItem :label="t('settings.gatewayBasePath')">
          <NInput v-model:value="form.gatewayBasePath" />
        </NFormItem>
        <NFormItem :label="t('settings.defaultRequestTimeoutMs')">
          <NInputNumber v-model:value="form.defaultRequestTimeoutMs" :min="1000" />
        </NFormItem>
        <NFormItem :label="t('settings.defaultRetries')">
          <NInputNumber v-model:value="form.defaultRetries" :min="0" :max="5" />
        </NFormItem>
        <NFormItem :label="t('settings.enableStickySession')">
          <NSwitch v-model:value="form.enableStickySession" />
        </NFormItem>
        <NFormItem :label="t('settings.enableCircuitBreaker')">
          <NSwitch v-model:value="form.enableCircuitBreaker" />
        </NFormItem>

        <NDivider />

        <NCollapse default-expanded-names="resilience">
          <NCollapseItem :title="t('settings.resilienceTitle')" name="resilience">
            <NFormItem :label="t('settings.firstTokenTimeoutMs')">
              <NInputNumber v-model:value="form.firstTokenTimeoutMs" :min="1000" />
            </NFormItem>

            <NDivider title-placement="left">{{ t('settings.circuitBreaker') }}</NDivider>
            <NFormItem :label="t('settings.circuitBreakerFailureThreshold')">
              <NInputNumber v-model:value="form.circuitBreakerFailureThreshold" :min="1" />
            </NFormItem>
            <NFormItem :label="t('settings.circuitBreakerBaseCooldownMs')">
              <NInputNumber v-model:value="form.circuitBreakerBaseCooldownMs" :min="1000" />
            </NFormItem>
            <NFormItem :label="t('settings.circuitBreakerMaxCooldownMs')">
              <NInputNumber v-model:value="form.circuitBreakerMaxCooldownMs" :min="1000" />
            </NFormItem>
            <NFormItem :label="t('settings.circuitBreakerHalfOpenSuccessCount')">
              <NInputNumber v-model:value="form.circuitBreakerHalfOpenSuccessCount" :min="1" />
            </NFormItem>

            <NDivider title-placement="left">{{ t('settings.endpointHealthProbe') }}</NDivider>
            <NFormItem :label="t('settings.endpointHealthProbeEnabled')">
              <NSwitch v-model:value="form.endpointHealthProbeEnabled" />
            </NFormItem>
            <NFormItem :label="t('settings.endpointHealthProbeIntervalMs')">
              <NInputNumber v-model:value="form.endpointHealthProbeIntervalMs" :min="1000" />
            </NFormItem>
            <NFormItem :label="t('settings.endpointHealthProbeTimeoutMs')">
              <NInputNumber v-model:value="form.endpointHealthProbeTimeoutMs" :min="1000" />
            </NFormItem>
            <NFormItem :label="t('settings.endpointHealthProbeDegradedLatencyMs')">
              <NInputNumber v-model:value="form.endpointHealthProbeDegradedLatencyMs" :min="1" />
            </NFormItem>

            <NDivider title-placement="left">{{ t('settings.upstreamCooldown') }}</NDivider>
            <NFormItem :label="t('settings.upstreamCooldownBaseMs')">
              <NInputNumber v-model:value="form.upstreamCooldownBaseMs" :min="1000" />
            </NFormItem>
            <NFormItem :label="t('settings.upstreamCooldownMaxMs')">
              <NInputNumber v-model:value="form.upstreamCooldownMaxMs" :min="1000" />
            </NFormItem>
          </NCollapseItem>
        </NCollapse>

        <NSpace justify="end" style="margin-top: 16px">
          <NButton type="primary" :loading="saving" @click="onSave">
            {{ t('common.save') }}
          </NButton>
        </NSpace>
      </NForm>
    </NSpin>
  </NCard>
</template>
