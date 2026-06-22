<script setup lang="ts">
import { computed, onMounted, ref, h } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  NSpace,
  NCard,
  NStatistic,
  NButton,
  NTag,
  NGrid,
  NGi,
  NDataTable,
  NEmpty,
  type DataTableColumns,
} from 'naive-ui';
import {
  appsApi,
  consumptionApi,
  modelGroupsApi,
  publicModelsApi,
  upstreamKeysApi,
  type AppSummary,
  type DailyConsumptionSummary,
  type ModelGroup,
  type PublicModel,
  type UpstreamKey,
} from '../api/admin.js';
import StatCard from '../components/StatCard.vue';
import {
  GitNetworkOutline,
  CubeOutline,
  LayersOutline,
  KeyOutline,
} from '@vicons/ionicons5';
import type { EChartsOption } from 'echarts';
import EChart from '../components/EChart.vue';

const router = useRouter();
const { t } = useI18n();

const apps = ref<AppSummary[]>([]);
const groups = ref<ModelGroup[]>([]);
const models = ref<PublicModel[]>([]);
const keys = ref<UpstreamKey[]>([]);
const consumption = ref<DailyConsumptionSummary[]>([]);

async function refresh() {
  try {
    const [a, g, m, k, co] = await Promise.all([
      appsApi.list(),
      modelGroupsApi.list(),
      publicModelsApi.list(),
      upstreamKeysApi.list(),
      consumptionApi.daily({ limit: 30 }).catch(() => ({ items: [] })),
    ]);
    apps.value = a.items;
    groups.value = g.items;
    models.value = m.items;
    keys.value = k.items;
    consumption.value = co.items;
  } catch {
    // Overview should never block login; show zeros on error.
  }
}

onMounted(refresh);

const frozenKeys = computed(() => keys.value.filter((k) => k.frozen).length);
const activeKeys = computed(() => keys.value.filter((k) => k.enabled && !k.frozen).length);
const hasConsumption = computed(() => (consumption.value?.length ?? 0) > 0);

/** Mini sparkline fed to the upstream-keys StatCard. */
const sparkOption = computed<EChartsOption>(() => ({
  grid: { left: 0, right: 0, top: 2, bottom: 0 },
  xAxis: { type: 'category', show: false, data: consumption.value.map((_, i) => i) },
  yAxis: { type: 'value', show: false },
  tooltip: { show: false },
  series: [
    {
      type: 'line',
      data: consumption.value.map((c) => c.totalRequests),
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: 'var(--n-primary-color)' },
      areaStyle: { opacity: 0.18 },
    },
  ],
}));

const modelColumns = computed<DataTableColumns<PublicModel>>(() => [
  { title: t('overview.modelsCard'), key: 'name' },
  { title: t('common.displayName'), key: 'displayName' },
  { title: t('common.candidates'), key: 'candidateCount', width: 110 },
]);

const groupColumns = computed<DataTableColumns<ModelGroup>>(() => [
  { title: t('overview.groupsCard'), key: 'name' },
  { title: t('common.displayName'), key: 'displayName' },
  { title: t('common.members'), key: 'memberCount', width: 110 },
]);
</script>

<template>
  <div class="overview">
    <NSpace vertical size="large">
      <NCard>
        <NSpace align="center" :size="12">
          <NTag type="success" round>{{ t('overview.banner.tag') }}</NTag>
          <span>{{ t('overview.banner.text') }}</span>
        </NSpace>
      </NCard>

      <NGrid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
        <NGi :span="1">
          <StatCard
            :label="t('overview.stats.apps')"
            :value="apps.length"
            :icon="GitNetworkOutline"
            icon-color="var(--n-info-color)"
          />
        </NGi>
        <NGi :span="1">
          <StatCard
            :label="t('overview.stats.publicModels')"
            :value="models.length"
            :icon="CubeOutline"
            icon-color="var(--n-success-color)"
          />
        </NGi>
        <NGi :span="1">
          <StatCard
            :label="t('overview.stats.modelGroups')"
            :value="groups.length"
            :icon="LayersOutline"
            icon-color="var(--n-warning-color)"
          />
        </NGi>
        <NGi :span="1">
          <StatCard
            :label="t('overview.stats.upstreamKeys')"
            :value="keys.length"
            :icon="KeyOutline"
            icon-color="var(--n-primary-color)"
            :sparkline="hasConsumption"
          >
            <template #sparkline>
              <EChart :option="sparkOption" :height="40" />
            </template>
            <template #default>
              <span style="font-size: 11px; color: var(--n-text-color-3)">
                {{ t('overview.stats.active', { count: activeKeys }) }} ·
                {{ t('overview.stats.frozen', { count: frozenKeys }) }}
              </span>
            </template>
          </StatCard>
        </NGi>
      </NGrid>

      <NCard :title="t('overview.modelsCard')">
        <NDataTable
          :columns="modelColumns"
          :data="models"
          :bordered="false"
          :row-key="(r) => r.id"
          :empty="h(NEmpty, { description: t('overview.modelsEmpty') })"
        />
      </NCard>

      <NCard :title="t('overview.groupsCard')">
        <NDataTable
          :columns="groupColumns"
          :data="groups"
          :bordered="false"
          :row-key="(r) => r.id"
          :empty="h(NEmpty, { description: t('overview.groupsEmpty') })"
        />
      </NCard>

      <NCard :title="t('overview.nextSteps.title')">
        <p>{{ t('overview.nextSteps.description') }}</p>
        <NSpace>
          <NButton type="primary" @click="router.push('/upstream-keys')">{{
            t('overview.nextSteps.manageUpstreamKeys')
          }}</NButton>
          <NButton @click="router.push('/public-models')">{{
            t('overview.nextSteps.publicModels')
          }}</NButton>
          <NButton @click="router.push('/apps')">{{ t('overview.nextSteps.apps') }}</NButton>
        </NSpace>
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped>
.overview {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
