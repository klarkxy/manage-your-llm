<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NSpace,
  NCard,
  NButton,
  NTag,
  NGrid,
  NGi,
  NText,
  NDivider,
} from 'naive-ui';
import {
  appsApi,
  consumptionApi,
  modelGroupsApi,
  publicModelsApi,
  upstreamKeysApi,
  settingsApi,
  type AppSummary,
  type DailyConsumptionSummary,
  type ModelGroup,
  type PublicModel,
  type PublicEndpointsSettings,
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

const { t } = useI18n();

const apps = ref<AppSummary[]>([]);
const groups = ref<ModelGroup[]>([]);
const models = ref<PublicModel[]>([]);
const keys = ref<UpstreamKey[]>([]);
const consumption = ref<DailyConsumptionSummary[]>([]);
const publicEndpoints = ref<PublicEndpointsSettings | null>(null);
const publicEndpointsCopied = ref<string | null>(null);
let publicEndpointsCopyTimer: ReturnType<typeof setTimeout> | null = null;

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
  // Public endpoints are non-critical; an auth/network failure here
  // should not blank out the rest of the page.
  settingsApi
    .get()
    .then((s) => {
      publicEndpoints.value = s.publicEndpoints;
    })
    .catch(() => {
      // ignore — section will not render.
    });
}

onMounted(refresh);

const frozenKeys = computed(() => keys.value.filter((k) => k.frozen).length);
const activeKeys = computed(() => keys.value.filter((k) => k.enabled && !k.frozen).length);
const hasConsumption = computed(() => (consumption.value?.length ?? 0) > 0);

// The "groups" stat card needs a count. We removed the dedicated
// model-groups API call from Overview; derive a placeholder count by
// collapsing the previous total into the public-models stat instead.
// Keep `modelGroupsCount` at 0 here so the layer's i18n string still
// resolves; the production card that uses it is removed.
const modelGroupsCount = computed(() => 0);

/**
 * Shorten a YYYY-MM-DD string to MM-DD for axis labels. ECharts'
 * default font is small on this page and full dates don't fit.
 */
function shortDate(dayDate: string): string {
  if (typeof dayDate !== 'string' || dayDate.length < 10) return dayDate;
  return dayDate.slice(5);
}

/** Recharts-style line chart for "requests per day, last 30". */
const requestsChartOption = computed<EChartsOption>(() => {
  const days = consumption.value;
  return {
    grid: { left: 50, right: 16, top: 24, bottom: 32 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: days.map((d) => shortDate(d.dayDate)),
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        name: t('overview.requestsChart.series'),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: days.map((d) => d.totalRequests),
        lineStyle: { width: 2, color: 'var(--n-primary-color)' },
        areaStyle: { opacity: 0.18, color: 'var(--n-primary-color)' },
      },
    ],
  };
});

/** Stacked bar chart for daily token consumption (input / output / cache). */
const tokenChartOption = computed<EChartsOption>(() => {
  const days = consumption.value;
  return {
    grid: { left: 60, right: 16, top: 32, bottom: 32 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      top: 0,
      data: [
        t('overview.tokenChart.input'),
        t('overview.tokenChart.output'),
        t('overview.tokenChart.cacheRead'),
        t('overview.tokenChart.cacheWrite'),
      ],
      textStyle: { fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: days.map((d) => shortDate(d.dayDate)),
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 11, formatter: (v: number) => abbreviateNumber(v) },
    },
    series: [
      {
        name: t('overview.tokenChart.input'),
        type: 'bar',
        stack: 'tokens',
        data: days.map((d) => d.totalInputTokens),
        itemStyle: { color: 'var(--n-primary-color)' },
      },
      {
        name: t('overview.tokenChart.output'),
        type: 'bar',
        stack: 'tokens',
        data: days.map((d) => d.totalOutputTokens),
        itemStyle: { color: 'var(--n-success-color)' },
      },
      {
        name: t('overview.tokenChart.cacheRead'),
        type: 'bar',
        stack: 'tokens',
        data: days.map((d) => d.totalCacheReadTokens),
        itemStyle: { color: 'var(--n-info-color)' },
      },
      {
        name: t('overview.tokenChart.cacheWrite'),
        type: 'bar',
        stack: 'tokens',
        data: days.map((d) => d.totalCacheWriteTokens),
        itemStyle: { color: 'var(--n-warning-color)' },
      },
    ],
  };
});

/** Compact "1.2k" / "3.4M" formatter for the Y axis. */
function abbreviateNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

async function copyPublicEndpoint(key: string, value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      // best-effort
    }
    document.body.removeChild(ta);
  }
  publicEndpointsCopied.value = key;
  if (publicEndpointsCopyTimer) clearTimeout(publicEndpointsCopyTimer);
  publicEndpointsCopyTimer = setTimeout(() => {
    publicEndpointsCopied.value = null;
  }, 1500);
}
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
          >
            <template #default>
              <span style="font-size: 11px; color: var(--n-text-color-3)">
                {{ t('overview.stats.active', { count: activeKeys }) }} ·
                {{ t('overview.stats.frozen', { count: frozenKeys }) }}
              </span>
            </template>
          </StatCard>
        </NGi>
      </NGrid>

      <NCard
        v-if="publicEndpoints"
        :title="t('overview.publicEndpoints.title')"
      >
        <NText depth="3" style="display: block; margin-bottom: 12px; font-size: 13px">
          {{ t('overview.publicEndpoints.caption') }}
        </NText>
        <NText depth="3" style="display: block; margin-bottom: 12px; font-size: 12px">
          {{ t('overview.publicEndpoints.basePathLabel') }}:
          <NText code style="margin-left: 4px">{{ publicEndpoints.basePath }}</NText>
          ·
          {{ t('overview.publicEndpoints.baseUrlLabel') }}:
          <NText code style="margin-left: 4px">{{ publicEndpoints.baseUrl }}</NText>
        </NText>
        <NDivider style="margin-top: 0; margin-bottom: 12px" />
        <NSpace vertical size="small">
          <NSpace align="center" :wrap="false">
            <NText style="width: 200px">{{ t('overview.publicEndpoints.messages') }}</NText>
            <NText code style="flex: 1; min-width: 0; word-break: break-all">
              {{ publicEndpoints.endpoints.messages }}
            </NText>
            <NButton size="small" @click="copyPublicEndpoint('messages', publicEndpoints.endpoints.messages)">
              {{ publicEndpointsCopied === 'messages' ? t('overview.publicEndpoints.copied') : t('overview.publicEndpoints.copy') }}
            </NButton>
          </NSpace>
          <NSpace align="center" :wrap="false">
            <NText style="width: 200px">{{ t('overview.publicEndpoints.chatCompletions') }}</NText>
            <NText code style="flex: 1; min-width: 0; word-break: break-all">
              {{ publicEndpoints.endpoints.chatCompletions }}
            </NText>
            <NButton size="small" @click="copyPublicEndpoint('chatCompletions', publicEndpoints.endpoints.chatCompletions)">
              {{ publicEndpointsCopied === 'chatCompletions' ? t('overview.publicEndpoints.copied') : t('overview.publicEndpoints.copy') }}
            </NButton>
          </NSpace>
          <NSpace align="center" :wrap="false">
            <NText style="width: 200px">{{ t('overview.publicEndpoints.responses') }}</NText>
            <NText code style="flex: 1; min-width: 0; word-break: break-all">
              {{ publicEndpoints.endpoints.responses }}
            </NText>
            <NButton size="small" @click="copyPublicEndpoint('responses', publicEndpoints.endpoints.responses)">
              {{ publicEndpointsCopied === 'responses' ? t('overview.publicEndpoints.copied') : t('overview.publicEndpoints.copy') }}
            </NButton>
          </NSpace>
          <NSpace align="center" :wrap="false">
            <NText style="width: 200px">{{ t('overview.publicEndpoints.models') }}</NText>
            <NText code style="flex: 1; min-width: 0; word-break: break-all">
              {{ publicEndpoints.endpoints.models }}
            </NText>
            <NButton size="small" @click="copyPublicEndpoint('models', publicEndpoints.endpoints.models)">
              {{ publicEndpointsCopied === 'models' ? t('overview.publicEndpoints.copied') : t('overview.publicEndpoints.copy') }}
            </NButton>
          </NSpace>
        </NSpace>
      </NCard>

      <NCard :title="t('overview.requestsChart.title')">
        <EChart v-if="hasConsumption" :option="requestsChartOption" :height="220" />
        <NText v-else depth="3" style="font-size: 12px">
          {{ t('overview.chartsEmpty') }}
        </NText>
      </NCard>

      <NCard :title="t('overview.tokenChart.title')">
        <EChart v-if="hasConsumption" :option="tokenChartOption" :height="240" />
        <NText v-else depth="3" style="font-size: 12px">
          {{ t('overview.chartsEmpty') }}
        </NText>
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
