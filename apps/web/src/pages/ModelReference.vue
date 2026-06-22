<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NSelect,
  NSpace,
  NTag,
  NText,
  useMessage,
  type DataTableColumns,
} from 'naive-ui';
import {
  modelReferenceApi,
  type ModelReferenceEntry,
  type ModelReferenceSyncStatus,
} from '../api/admin.js';

type ReferenceRegion = 'international' | 'domestic';

const { t } = useI18n();
const message = useMessage();
const region = ref<ReferenceRegion>('international');
const loading = ref(false);
const refreshing = ref(false);
const items = ref<ModelReferenceEntry[]>([]);
const sync = ref<ModelReferenceSyncStatus[]>([]);

const regionOptions = computed(() => [
  { label: t('modelGroups.drawer.regions.international'), value: 'international' },
  { label: t('modelGroups.drawer.regions.domestic'), value: 'domestic' },
]);

function fmtDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

function score(entry: ModelReferenceEntry, key: string): string {
  const value = entry.scores[key];
  return typeof value === 'number' ? value.toFixed(1) : '-';
}

function fmtPrice(entry: ModelReferenceEntry): string {
  const price = entry.price;
  const blended =
    typeof price.blendedUsdPerMTok === 'number'
      ? `$${price.blendedUsdPerMTok.toFixed(2)}`
      : typeof price.blendedCnyPerMTok === 'number'
        ? `¥${price.blendedCnyPerMTok.toFixed(2)}`
        : null;
  if (blended) return `${blended}/M`;
  const input =
    typeof price.inputUsdPerMTok === 'number'
      ? `$${price.inputUsdPerMTok.toFixed(2)}`
      : typeof price.inputCnyPerMTok === 'number'
        ? `¥${price.inputCnyPerMTok.toFixed(2)}`
        : null;
  const output =
    typeof price.outputUsdPerMTok === 'number'
      ? `$${price.outputUsdPerMTok.toFixed(2)}`
      : typeof price.outputCnyPerMTok === 'number'
        ? `¥${price.outputCnyPerMTok.toFixed(2)}`
        : null;
  return input || output ? `${input ?? '-'}/${output ?? '-'}` : '-';
}

async function refreshList(): Promise<void> {
  loading.value = true;
  try {
    const res = await modelReferenceApi.list(region.value);
    items.value = res.items;
    sync.value = res.sync;
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}

async function refreshRemote(): Promise<void> {
  refreshing.value = true;
  try {
    const res = await modelReferenceApi.refresh(region.value, true);
    items.value = res.items.items;
    sync.value = res.items.sync;
    message.success(t('modelReference.refreshed'));
  } catch (err) {
    message.error((err as Error).message);
    await refreshList();
  } finally {
    refreshing.value = false;
  }
}

onMounted(refreshList);

const columns = computed<DataTableColumns<ModelReferenceEntry>>(() => [
  {
    title: t('modelReference.columns.model'),
    key: 'displayName',
    width: 260,
    fixed: 'left',
    ellipsis: { tooltip: true },
  },
  { title: t('modelReference.columns.provider'), key: 'provider', width: 140 },
  { title: t('modelReference.columns.intelligence'), key: 'intelligence', width: 100, render: (row) => score(row, 'intelligence') },
  { title: t('modelReference.columns.reasoning'), key: 'reasoning', width: 100, render: (row) => score(row, 'reasoning') },
  { title: t('modelReference.columns.coding'), key: 'coding', width: 90, render: (row) => score(row, 'coding') },
  { title: t('modelReference.columns.agentic'), key: 'agentic', width: 90, render: (row) => score(row, 'agentic') },
  { title: t('modelReference.columns.math'), key: 'math', width: 90, render: (row) => score(row, 'math') },
  { title: t('modelReference.columns.creative'), key: 'creative', width: 90, render: (row) => score(row, 'creative') },
  { title: t('modelReference.columns.instruction'), key: 'instruction', width: 110, render: (row) => score(row, 'instruction') },
  { title: t('modelReference.columns.price'), key: 'price', width: 130, render: fmtPrice },
  {
    title: t('modelReference.columns.context'),
    key: 'contextWindow',
    width: 110,
    render: (row) => (row.contextWindow ? row.contextWindow.toLocaleString() : '-'),
  },
]);
</script>

<template>
  <div class="page">
    <NCard>
      <NSpace align="center" justify="space-between" style="margin-bottom: 16px">
        <NSpace align="center">
          <NText strong>{{ t('modelReference.title') }}</NText>
          <NSelect
            v-model:value="region"
            :options="regionOptions"
            style="width: 150px"
            @update:value="refreshList"
          />
        </NSpace>
        <NButton type="primary" :loading="refreshing" @click="refreshRemote">
          {{ t('modelReference.refresh') }}
        </NButton>
      </NSpace>

      <NSpace v-if="sync.length > 0" style="margin-bottom: 12px">
        <NTag v-for="row in sync" :key="`${row.region}:${row.source}`" size="small">
          {{ row.source }} · {{ row.status }} · {{ fmtDate(row.lastRefreshAt) }}
        </NTag>
      </NSpace>

      <NDataTable
        :columns="columns"
        :data="items"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        :row-key="(row) => row.id"
        :scroll-x="1280"
        :empty="h(NEmpty, { description: t('modelReference.empty') })"
      />
    </NCard>
  </div>
</template>

<style scoped>
.page {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
