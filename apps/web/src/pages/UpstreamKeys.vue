<script setup lang="ts">
import { ref, onMounted, h, computed } from 'vue';
import { useMessage } from 'naive-ui';
import {
  NCard,
  NSpace,
  NButton,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSwitch,
  NTag,
  NPopconfirm,
  NSpin,
  NEmpty,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import {
  listUpstreamKeys,
  createUpstreamKey,
  updateUpstreamKey,
  deleteUpstreamKey,
  rotateUpstreamKey,
  freezeUpstreamKey,
  unfreezeUpstreamKey,
  discoverUpstreamModels,
  pingUpstreamKey,
} from '../api/admin/upstream-keys.js';
import { listProviderPresets } from '../api/admin/provider-presets.js';
import { listBreakers, resetBreaker } from '../api/admin/resilience.js';
import type { CircuitBreakerContract } from '@manageyourllm/contracts';
import type { UpstreamKeyWithQuota } from '../api/admin/upstream-keys.js';
import type { ProviderPresetContract, DiscoveredModel } from '@manageyourllm/contracts';
import type { DataTableColumns } from 'naive-ui';

const { t } = useI18n();
const message = useMessage();

const keys = ref<UpstreamKeyWithQuota[]>([]);
const presets = ref<ProviderPresetContract[]>([]);
const loading = ref(false);
const showModal = ref(false);
const editingKey = ref<UpstreamKeyWithQuota | null>(null);
const form = ref({
  name: '',
  providerPresetId: null as string | null,
  providerType: 'openai_compatible',
  baseUrl: '',
  apiKey: '',
  enabled: true,
});

const rotateModal = ref<{ show: boolean; id: string; apiKey: string }>({
  show: false,
  id: '',
  apiKey: '',
});

const discoverModal = ref<{ show: boolean; models: DiscoveredModel[] }>({
  show: false,
  models: [],
});

const pingModal = ref<{ show: boolean; id: string; model: string; result: string }>({
  show: false,
  id: '',
  model: '',
  result: '',
});

const breakerModal = ref<{
  show: boolean;
  upstreamKeyId: string;
  breakers: CircuitBreakerContract[];
  loading: boolean;
}>({
  show: false,
  upstreamKeyId: '',
  breakers: [],
  loading: false,
});

async function load() {
  loading.value = true;
  try {
    [keys.value, presets.value] = await Promise.all([listUpstreamKeys(), listProviderPresets()]);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingKey.value = null;
  form.value = {
    name: '',
    providerPresetId: null,
    providerType: 'openai_compatible',
    baseUrl: '',
    apiKey: '',
    enabled: true,
  };
  showModal.value = true;
}

function openEdit(row: UpstreamKeyWithQuota) {
  editingKey.value = row;
  form.value = {
    name: row.name,
    providerPresetId: row.providerPresetId,
    providerType: row.providerType,
    baseUrl: row.baseUrl,
    apiKey: '',
    enabled: row.enabled,
  };
  showModal.value = true;
}

function onPresetChange(presetId: string | null) {
  const preset = presets.value.find((p) => p.id === presetId);
  if (preset) {
    form.value.providerType = preset.providerType;
  }
}

async function onSave() {
  try {
    const payload = {
      name: form.value.name,
      providerPresetId: form.value.providerPresetId ?? undefined,
      providerType: form.value.providerType,
      baseUrl: form.value.baseUrl,
      apiKey: form.value.apiKey,
      enabled: form.value.enabled,
    };
    if (editingKey.value) {
      await updateUpstreamKey(editingKey.value.id, payload);
    } else {
      await createUpstreamKey(payload);
    }
    showModal.value = false;
    await load();
    message.success(t('common.saved'));
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.saveFailed'));
  }
}

async function onDelete(row: UpstreamKeyWithQuota) {
  try {
    await deleteUpstreamKey(row.id);
    await load();
    message.success(t('common.deleted'));
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.deleteFailed'));
  }
}

async function onFreeze(row: UpstreamKeyWithQuota) {
  try {
    await freezeUpstreamKey(row.id, t('upstreamKeys.manualFreeze'));
    await load();
    message.success(t('common.saved'));
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.saveFailed'));
  }
}

async function onUnfreeze(row: UpstreamKeyWithQuota) {
  try {
    await unfreezeUpstreamKey(row.id);
    await load();
    message.success(t('common.saved'));
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.saveFailed'));
  }
}

async function onRotateSubmit() {
  try {
    await rotateUpstreamKey(rotateModal.value.id, rotateModal.value.apiKey);
    rotateModal.value.show = false;
    await load();
    message.success(t('common.saved'));
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.saveFailed'));
  }
}

async function onDiscover(row: UpstreamKeyWithQuota) {
  try {
    const models = await discoverUpstreamModels(row.id);
    discoverModal.value = { show: true, models };
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('upstreamKeys.discoverFailed'));
  }
}

async function onPing(row: UpstreamKeyWithQuota) {
  pingModal.value = {
    show: true,
    id: row.id,
    model: row.supportedModelsJson?.[0] ?? '',
    result: '',
  };
}

async function onPingSubmit() {
  try {
    const result = await pingUpstreamKey(pingModal.value.id, pingModal.value.model || undefined);
    pingModal.value.result = result.ok
      ? t('upstreamKeys.pingOk', { latency: result.latencyMs })
      : t('upstreamKeys.pingFailed', { error: result.error ?? '' });
  } catch (err) {
    pingModal.value.result = t('upstreamKeys.pingFailed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function openBreakers(row: UpstreamKeyWithQuota) {
  breakerModal.value = { show: true, upstreamKeyId: row.id, breakers: [], loading: true };
  try {
    const all = await listBreakers();
    breakerModal.value.breakers = all.filter((b) => b.upstreamKeyId === row.id);
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.loadFailed'));
  } finally {
    breakerModal.value.loading = false;
  }
}

async function onResetBreaker(breaker: CircuitBreakerContract) {
  try {
    await resetBreaker(breaker.upstreamKeyId, breaker.realModelName);
    message.success(t('common.saved'));
    await openBreakers({ id: breakerModal.value.upstreamKeyId } as UpstreamKeyWithQuota);
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.saveFailed'));
  }
}

function breakerStateType(state: string) {
  switch (state) {
    case 'open':
      return 'error';
    case 'half_open':
      return 'warning';
    default:
      return 'success';
  }
}

const columns: DataTableColumns<UpstreamKeyWithQuota> = [
  { title: t('upstreamKeys.name'), key: 'name' },
  { title: t('upstreamKeys.providerType'), key: 'providerType' },
  { title: t('upstreamKeys.baseUrl'), key: 'baseUrl' },
  { title: t('upstreamKeys.apiKeyPrefix'), key: 'apiKeyPrefix' },
  {
    title: t('upstreamKeys.status'),
    key: 'status',
    render(row) {
      const tags: ReturnType<typeof h>[] = [];
      if (row.frozen)
        tags.push(h(NTag, { type: 'warning' }, { default: () => t('upstreamKeys.frozen') }));
      if (!row.enabled)
        tags.push(h(NTag, { type: 'default' }, { default: () => t('upstreamKeys.disabled') }));
      if (tags.length === 0)
        tags.push(h(NTag, { type: 'success' }, { default: () => t('upstreamKeys.active') }));
      return h(NSpace, { size: 4 }, { default: () => tags });
    },
  },
  {
    title: t('common.actions'),
    key: 'actions',
    render(row) {
      return h(
        NSpace,
        { size: 'small' },
        {
          default: () => [
            h(
              NButton,
              { size: 'small', onClick: () => openEdit(row) },
              { default: () => t('common.edit') },
            ),
            h(
              NButton,
              { size: 'small', onClick: () => onDiscover(row) },
              { default: () => t('upstreamKeys.discover') },
            ),
            h(
              NButton,
              { size: 'small', onClick: () => onPing(row) },
              { default: () => t('upstreamKeys.ping') },
            ),
            h(
              NButton,
              {
                size: 'small',
                onClick: () => {
                  rotateModal.value = { show: true, id: row.id, apiKey: '' };
                },
              },
              { default: () => t('upstreamKeys.rotate') },
            ),
            row.frozen
              ? h(
                  NButton,
                  { size: 'small', onClick: () => onUnfreeze(row) },
                  { default: () => t('upstreamKeys.unfreeze') },
                )
              : h(
                  NButton,
                  { size: 'small', onClick: () => onFreeze(row) },
                  { default: () => t('upstreamKeys.freeze') },
                ),
            h(
              NButton,
              { size: 'small', onClick: () => openBreakers(row) },
              { default: () => t('upstreamKeys.breakers') },
            ),
            h(
              NPopconfirm,
              { onPositiveClick: () => onDelete(row) },
              {
                trigger: () =>
                  h(
                    NButton,
                    { size: 'small', type: 'error' },
                    { default: () => t('common.delete') },
                  ),
                default: () => t('upstreamKeys.confirmDelete'),
              },
            ),
          ],
        },
      );
    },
  },
];

const presetOptions = computed(() =>
  presets.value.map((p) => ({ label: `${p.name} (${p.source})`, value: p.id })),
);

onMounted(load);
</script>

<template>
  <NCard :title="t('upstreamKeys.title')">
    <NSpace vertical :size="16">
      <NSpace justify="end">
        <NButton type="primary" @click="openCreate">{{ t('upstreamKeys.create') }}</NButton>
      </NSpace>
      <NDataTable :columns="columns" :data="keys" :loading="loading" :row-key="(row) => row.id" />
    </NSpace>

    <NModal
      v-model:show="showModal"
      :title="editingKey ? t('upstreamKeys.edit') : t('upstreamKeys.create')"
      preset="card"
      style="width: 560px"
    >
      <NForm label-placement="left" label-width="100px">
        <NFormItem :label="t('upstreamKeys.name')">
          <NInput v-model:value="form.name" />
        </NFormItem>
        <NFormItem :label="t('upstreamKeys.providerPreset')">
          <NSelect
            v-model:value="form.providerPresetId"
            :options="presetOptions"
            clearable
            @update:value="onPresetChange"
          />
        </NFormItem>
        <NFormItem :label="t('upstreamKeys.providerType')">
          <NInput v-model:value="form.providerType" />
        </NFormItem>
        <NFormItem :label="t('upstreamKeys.baseUrl')">
          <NInput v-model:value="form.baseUrl" />
        </NFormItem>
        <NFormItem :label="editingKey ? t('upstreamKeys.newApiKey') : t('upstreamKeys.apiKey')">
          <NInput v-model:value="form.apiKey" type="password" />
        </NFormItem>
        <NFormItem :label="t('upstreamKeys.enabled')">
          <NSwitch v-model:value="form.enabled" />
        </NFormItem>
      </NForm>
      <NSpace justify="end">
        <NButton @click="showModal = false">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" @click="onSave">{{ t('common.save') }}</NButton>
      </NSpace>
    </NModal>

    <NModal
      v-model:show="rotateModal.show"
      :title="t('upstreamKeys.rotate')"
      preset="card"
      style="width: 480px"
    >
      <NFormItem :label="t('upstreamKeys.newApiKey')">
        <NInput v-model:value="rotateModal.apiKey" type="password" />
      </NFormItem>
      <NSpace justify="end">
        <NButton @click="rotateModal.show = false">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" @click="onRotateSubmit">{{ t('common.save') }}</NButton>
      </NSpace>
    </NModal>

    <NModal
      v-model:show="discoverModal.show"
      :title="t('upstreamKeys.discover')"
      preset="card"
      style="width: 480px"
    >
      <NDataTable
        :columns="[
          { title: 'ID', key: 'id' },
          { title: 'Object', key: 'object' },
          { title: 'Owned By', key: 'ownedBy' },
        ]"
        :data="discoverModal.models"
        :row-key="(row) => row.id"
      />
      <NSpace justify="end">
        <NButton @click="discoverModal.show = false">{{ t('common.close') }}</NButton>
      </NSpace>
    </NModal>

    <NModal
      v-model:show="breakerModal.show"
      :title="t('breaker.title')"
      preset="card"
      style="width: 720px; max-width: 90vw"
    >
      <NSpin v-if="breakerModal.loading" />
      <NDataTable
        v-else
        :columns="[
          { title: t('breaker.realModelName'), key: 'realModelName' },
          {
            title: t('breaker.state'),
            key: 'state',
            render: (row) => h(NTag, { type: breakerStateType(row.state), size: 'small' }, { default: () => t(`breaker.state.${row.state}`) }),
          },
          { title: t('breaker.failureCount'), key: 'failureCount' },
          { title: t('breaker.successCount'), key: 'successCount' },
          {
            title: t('common.actions'),
            key: 'actions',
            render: (row) =>
              h(
                NButton,
                { size: 'small', onClick: () => onResetBreaker(row) },
                { default: () => t('upstreamKeys.resetBreaker') },
              ),
          },
        ]"
        :data="breakerModal.breakers"
        :bordered="false"
        size="small"
        :row-key="(row) => `${row.upstreamKeyId}:${row.realModelName}`"
      />
      <NEmpty v-if="!breakerModal.loading && breakerModal.breakers.length === 0" :description="t('breaker.noBreakers')" />
      <NSpace justify="end" style="margin-top: 12px">
        <NButton @click="breakerModal.show = false">{{ t('common.close') }}</NButton>
      </NSpace>
    </NModal>

    <NModal
      v-model:show="pingModal.show"
      :title="t('upstreamKeys.ping')"
      preset="card"
      style="width: 480px"
    >
      <NForm label-placement="left" label-width="80px">
        <NFormItem :label="t('upstreamKeys.realModelName')">
          <NInput v-model:value="pingModal.model" />
        </NFormItem>
      </NForm>
      <NInput
        v-if="pingModal.result"
        :value="pingModal.result"
        type="textarea"
        readonly
        :autosize="{ minRows: 2, maxRows: 4 }"
      />
      <NSpace justify="end">
        <NButton @click="pingModal.show = false">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" @click="onPingSubmit">{{ t('upstreamKeys.ping') }}</NButton>
      </NSpace>
    </NModal>
  </NCard>
</template>
