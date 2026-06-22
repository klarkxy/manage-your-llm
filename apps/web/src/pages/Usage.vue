<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NButton,
  NCard,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NGi,
  NGrid,
  NSpace,
  NTag,
  NText,
  type DataTableColumns,
} from 'naive-ui';
import { PulseOutline, CheckmarkDone, SwapHorizontal, BarChartOutline } from '@vicons/ionicons5';
import type { EChartsOption } from 'echarts';
import {
  usageApi,
  traceApi,
  consumptionApi,
  type UsageBreakdownEntry,
  type UsageRecentRow,
  type UsageTargetBreakdownEntry,
  type UsageTotals,
  type UsageWindow,
  type TraceSummary,
  type TraceTimeline,
  type DailyConsumptionSummary,
} from '../api/admin.js';
import StatCard from '../components/StatCard.vue';
import EChart from '../components/EChart.vue';

const { t } = useI18n();

const windowKind = ref<UsageWindow>('today');
const windowOptions = computed<Array<{ label: string; value: UsageWindow }>>(() => [
  { label: t('usage.windows.today'), value: 'today' },
  { label: t('usage.windows.24h'), value: '24h' },
  { label: t('usage.windows.7d'), value: '7d' },
]);

const totals = ref<UsageTotals | null>(null);
const apps = ref<UsageBreakdownEntry[]>([]);
const consumerKeys = ref<UsageBreakdownEntry[]>([]);
const upstreamKeys = ref<UsageBreakdownEntry[]>([]);
const targets = ref<UsageTargetBreakdownEntry[]>([]);
const recent = ref<UsageRecentRow[]>([]);
const traces = ref<TraceSummary[]>([]);
const consumption = ref<DailyConsumptionSummary[]>([]);
const loading = ref(false);
const lastError = ref<string | null>(null);
const traceDrawerOpen = ref(false);
const selectedTrace = ref<TraceTimeline | null>(null);
const traceDetailLoading = ref(false);
const traceDetailError = ref<string | null>(null);

async function refresh(): Promise<void> {
  loading.value = true;
  lastError.value = null;
  try {
    const w = windowKind.value;
    const [t2, a, c, u, tg, r, tr, co] = await Promise.all([
      usageApi.totals(w),
      usageApi.byApp(w),
      usageApi.byConsumerKey(w),
      usageApi.byUpstreamKey(w),
      usageApi.byTarget(w),
      usageApi.recent(100),
      traceApi.list(50),
      consumptionApi.daily({ limit: 30 }),
    ]);
    totals.value = t2;
    apps.value = a.items;
    consumerKeys.value = c.items;
    upstreamKeys.value = u.items;
    targets.value = tg.items;
    recent.value = r.items;
    traces.value = tr.items;
    consumption.value = co.items;
  } catch (err) {
    lastError.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);

const successRatePct = computed(() =>
  totals.value ? `${(totals.value.successRate * 100).toFixed(1)}%` : '—',
);
const stickyHitRatePct = computed(() =>
  totals.value ? `${(totals.value.stickyHitRate * 100).toFixed(1)}%` : '—',
);

const breakdownColumns = computed<DataTableColumns<UsageBreakdownEntry>>(() => [
  { title: t('usage.columns.name'), key: 'name', ellipsis: { tooltip: true }, sorter: true },
  {
    title: t('usage.columns.requests'),
    key: 'totalRequests',
    sorter: (a, b) => a.totalRequests - b.totalRequests,
    defaultSortOrder: 'descend',
    render: (row) => row.totalRequests.toLocaleString(),
  },
  {
    title: t('usage.columns.success'),
    key: 'successfulRequests',
    sorter: (a, b) => a.successfulRequests - b.successfulRequests,
    render: (row) => row.successfulRequests.toLocaleString(),
  },
  {
    title: t('usage.columns.errors'),
    key: 'failedRequests',
    sorter: (a, b) => a.failedRequests - b.failedRequests,
    render: (row) =>
      h(NTag, { size: 'small', type: row.failedRequests > 0 ? 'error' : 'default' }, () =>
        row.failedRequests.toLocaleString(),
      ),
  },
  {
    title: t('usage.columns.tokensInOut'),
    key: 'tokens',
    render: (row) => `${row.inputTokens.toLocaleString()} / ${row.outputTokens.toLocaleString()}`,
  },
]);

const targetColumns = computed<DataTableColumns<UsageTargetBreakdownEntry>>(() => [
  { title: t('usage.columns.name'), key: 'name', ellipsis: { tooltip: true }, sorter: true },
  {
    title: t('usage.columns.type'),
    key: 'targetType',
    width: 120,
    sorter: true,
    render: (row) =>
      h(
        NTag,
        { size: 'small', type: row.targetType === 'public_model' ? 'info' : 'success' },
        () =>
          row.targetType === 'public_model'
            ? t('common.targetType.publicModel')
            : t('common.targetType.modelGroup'),
      ),
  },
  {
    title: t('usage.columns.requests'),
    key: 'totalRequests',
    sorter: (a, b) => a.totalRequests - b.totalRequests,
    defaultSortOrder: 'descend',
    render: (row) => row.totalRequests.toLocaleString(),
  },
  {
    title: t('usage.columns.errors'),
    key: 'failedRequests',
    sorter: (a, b) => a.failedRequests - b.failedRequests,
    render: (row) => row.failedRequests.toLocaleString(),
  },
  {
    title: t('usage.columns.tokensInOut'),
    key: 'tokens',
    render: (row) => `${row.inputTokens.toLocaleString()} / ${row.outputTokens.toLocaleString()}`,
  },
]);

const recentColumns = computed<DataTableColumns<UsageRecentRow>>(() => [
  {
    title: t('usage.columns.time'),
    key: 'createdAt',
    width: 200,
    sorter: true,
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
  { title: t('usage.columns.app'), key: 'appId', width: 140, ellipsis: { tooltip: true }, sorter: true },
  {
    title: t('usage.columns.target'),
    key: 'requestedTargetName',
    width: 200,
    ellipsis: { tooltip: true },
    sorter: true,
  },
  {
    title: t('usage.columns.upstream'),
    key: 'realModelName',
    width: 200,
    ellipsis: { tooltip: true },
    sorter: true,
  },
  {
    title: t('usage.columns.status'),
    key: 'status',
    width: 110,
    sorter: true,
    render: (row) =>
      h(
        NTag,
        { size: 'small', type: row.status === 'success' ? 'success' : 'error' },
        () => row.status,
      ),
  },
  {
    title: t('usage.columns.latency'),
    key: 'latencyMs',
    width: 110,
    sorter: (a, b) => a.latencyMs - b.latencyMs,
    render: (row) => `${row.latencyMs} ms`,
  },
  {
    title: t('usage.columns.tokensInOutTotal'),
    key: 'tokens',
    width: 180,
    render: (row) =>
      row.totalTokens === null
        ? '—'
        : `${row.inputTokens ?? 0} / ${row.outputTokens ?? 0} / ${row.totalTokens}`,
  },
  {
    title: t('usage.columns.cacheTokens'),
    key: 'cacheTokens',
    width: 160,
    render: (row) =>
      row.cacheReadTokens === null && row.cacheWriteTokens === null
        ? '—'
        : `${row.cacheReadTokens ?? 0} / ${row.cacheWriteTokens ?? 0}`,
  },
  {
    title: t('usage.columns.error'),
    key: 'errorCode',
    width: 160,
    sorter: true,
    render: (row) => (row.errorCode ? row.errorCode : '—'),
  },
]);

function openTraceDetail(traceId: string) {
  traceDrawerOpen.value = true;
  traceDetailLoading.value = true;
  traceDetailError.value = null;
  selectedTrace.value = null;
  traceApi
    .get(traceId)
    .then((timeline) => {
      selectedTrace.value = timeline;
    })
    .catch((err) => {
      traceDetailError.value = (err as Error).message;
    })
    .finally(() => {
      traceDetailLoading.value = false;
    });
}

const traceColumns = computed<DataTableColumns<TraceSummary>>(() => [
  {
    title: t('usage.columns.traceId'),
    key: 'requestTraceId',
    width: 240,
    ellipsis: { tooltip: true },
    sorter: true,
  },
  {
    title: t('usage.columns.target'),
    key: 'requestedTargetName',
    width: 180,
    ellipsis: { tooltip: true },
    sorter: true,
  },
  {
    title: t('usage.columns.sourceProtocol'),
    key: 'sourceProtocol',
    width: 120,
    sorter: true,
  },
  {
    title: t('usage.columns.outcome'),
    key: 'finalOutcome',
    width: 110,
    sorter: true,
    render: (row) =>
      h(
        NTag,
        { size: 'small', type: row.finalOutcome === 'success' ? 'success' : 'default' },
        () => row.finalOutcome ?? '—',
      ),
  },
  {
    title: t('usage.columns.time'),
    key: 'createdAt',
    width: 200,
    sorter: true,
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
]);

const traceStepColumns = computed<DataTableColumns<TraceTimeline['steps'][number]>>(() => [
  {
    title: t('usage.columns.stepIndex'),
    key: 'stepIndex',
    width: 60,
    sorter: true,
  },
  {
    title: t('usage.columns.step'),
    key: 'step',
    width: 160,
    sorter: true,
  },
  {
    title: t('usage.columns.target'),
    key: 'requestedTargetName',
    width: 160,
    ellipsis: { tooltip: true },
    sorter: true,
    render: (row) => row.requestedTargetName ?? '—',
  },
  {
    title: t('usage.columns.upstream'),
    key: 'upstreamKeyName',
    width: 160,
    ellipsis: { tooltip: true },
    sorter: true,
    render: (row) => row.upstreamKeyName ?? '—',
  },
  {
    title: t('usage.columns.model'),
    key: 'realModelName',
    width: 160,
    ellipsis: { tooltip: true },
    sorter: true,
    render: (row) => row.realModelName ?? '—',
  },
  {
    title: t('usage.columns.latency'),
    key: 'latencyMs',
    width: 110,
    sorter: (a, b) => (a.latencyMs ?? 0) - (b.latencyMs ?? 0),
    render: (row) => (row.latencyMs === null ? '—' : `${row.latencyMs} ms`),
  },
  {
    title: t('usage.columns.error'),
    key: 'errorMessage',
    width: 200,
    ellipsis: { tooltip: true },
    sorter: true,
    render: (row) =>
      row.errorMessage
        ? h(NText, { type: 'error' }, () => row.errorMessage)
        : row.errorCode
          ? h(NText, { type: 'error' }, () => row.errorCode)
          : '—',
  },
]);

const consumptionColumns = computed<DataTableColumns<DailyConsumptionSummary>>(() => [
  {
    title: t('usage.columns.dayDate'),
    key: 'dayDate',
    width: 140,
    sorter: true,
  },
  {
    title: t('usage.columns.requests'),
    key: 'totalRequests',
    sorter: (a, b) => a.totalRequests - b.totalRequests,
    render: (row) => row.totalRequests.toLocaleString(),
  },
  {
    title: t('usage.columns.tokensInOut'),
    key: 'tokens',
    render: (row) =>
      `${row.totalInputTokens.toLocaleString()} / ${row.totalOutputTokens.toLocaleString()}`,
  },
  {
    title: t('usage.columns.cacheTokens'),
    key: 'cacheTokens',
    render: (row) =>
      `${row.totalCacheReadTokens.toLocaleString()} / ${row.totalCacheWriteTokens.toLocaleString()}`,
  },
]);

// ---------- Chart options ----------

/** 30-day daily consumption: requests (area) + tokens (secondary axis). */
const consumptionOption = computed<EChartsOption>(() => {
  const days = consumption.value.map((d) => d.dayDate);
  const requests = consumption.value.map((d) => d.totalRequests);
  const tokens = consumption.value.map((d) => d.totalInputTokens + d.totalOutputTokens);
  const hasData = requests.some((v) => v > 0);
  if (!hasData) {
    return {
      title: {
        text: t('usage.empty.consumption'),
        left: 'center',
        top: 'middle',
        textStyle: { fontSize: 13, fontWeight: 'normal' },
      },
      xAxis: { type: 'category', data: days, show: false },
      yAxis: { type: 'value', show: false },
    };
  }
  return {
    legend: { data: [t('usage.charts.requests'), t('usage.charts.tokens')], top: 0 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: days, boundaryGap: false },
    yAxis: [
      { type: 'value', name: t('usage.charts.requests') },
      { type: 'value', name: t('usage.charts.tokens') },
    ],
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 4 }],
    series: [
      {
        name: t('usage.charts.requests'),
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.18 },
        data: requests,
      },
      {
        name: t('usage.charts.tokens'),
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        lineStyle: { opacity: 0.7 },
        data: tokens,
      },
    ],
  };
});

/** Top 8 apps by request count, horizontal bar. */
const byAppOption = computed<EChartsOption>(() => {
  const top = apps.value.slice().sort((a, b) => b.totalRequests - a.totalRequests).slice(0, 8);
  const names = top.map((a) => a.name);
  const reqs = top.map((a) => a.totalRequests);
  const errs = top.map((a) => a.failedRequests);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 16, top: 8, bottom: 24, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: names.reverse() },
    series: [
      { name: t('usage.charts.requests'), type: 'bar', data: reqs.reverse(), stack: 'total' },
      { name: t('usage.charts.errors'), type: 'bar', data: errs.reverse() },
    ],
  };
});

/** Latency distribution: bucket recent rows into ranges. */
const latencyBuckets = computed(() => {
  const buckets = [
    { label: '<200ms', min: 0, max: 200, count: 0 },
    { label: '200-500ms', min: 200, max: 500, count: 0 },
    { label: '500-1s', min: 500, max: 1000, count: 0 },
    { label: '1-3s', min: 1000, max: 3000, count: 0 },
    { label: '>3s', min: 3000, max: Number.POSITIVE_INFINITY, count: 0 },
  ];
  for (const row of recent.value) {
    const b = buckets.find((x) => row.latencyMs >= x.min && row.latencyMs < x.max);
    if (b) b.count++;
  }
  return buckets;
});

const latencyOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 60, right: 16, top: 8, bottom: 24 },
  xAxis: { type: 'category', data: latencyBuckets.value.map((b) => b.label) },
  yAxis: { type: 'value' },
  series: [
    {
      type: 'bar',
      data: latencyBuckets.value.map((b) => b.count),
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    },
  ],
}));
</script>

<template>
  <div class="usage-page">
    <NSpace vertical size="large">
      <NCard>
        <NSpace align="center" justify="space-between" style="margin-bottom: 12px">
          <NText strong>{{ t('usage.title') }}</NText>
          <NSpace>
            <NButton
              v-for="opt in windowOptions"
              :key="opt.value"
              :type="windowKind === opt.value ? 'primary' : 'default'"
              size="small"
              @click="((windowKind = opt.value), refresh())"
            >
              {{ opt.label }}
            </NButton>
            <NButton size="small" :loading="loading" @click="refresh">{{
              t('usage.refresh')
            }}</NButton>
          </NSpace>
        </NSpace>
        <NGrid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
          <NGi :span="1">
            <StatCard
              :label="t('usage.stats.requests')"
              :value="(totals?.totalRequests ?? 0).toLocaleString()"
              :icon="PulseOutline"
              icon-color="var(--n-primary-color)"
            />
          </NGi>
          <NGi :span="1">
            <StatCard
              :label="t('usage.stats.successRate')"
              :value="successRatePct"
              :icon="CheckmarkDone"
              icon-color="var(--n-success-color)"
            />
          </NGi>
          <NGi :span="1">
            <StatCard
              :label="t('usage.stats.stickyHitRate')"
              :value="stickyHitRatePct"
              :icon="SwapHorizontal"
              icon-color="var(--n-info-color)"
            />
          </NGi>
          <NGi :span="1">
            <StatCard
              :label="t('usage.stats.tokens')"
              :value="`${(totals?.inputTokens ?? 0).toLocaleString()} / ${(totals?.outputTokens ?? 0).toLocaleString()}`"
              :icon="BarChartOutline"
              icon-color="var(--n-warning-color)"
            />
          </NGi>
        </NGrid>
      </NCard>

      <NGrid :cols="2" :x-gap="16" :y-gap="16" responsive="screen">
        <NGi :span="2">
          <NCard :title="t('usage.charts.consumption')">
            <EChart :option="consumptionOption" :height="240" />
          </NCard>
        </NGi>
        <NGi :span="1">
          <NCard :title="t('usage.charts.byApp')">
            <EChart :option="byAppOption" :height="240" />
          </NCard>
        </NGi>
        <NGi :span="1">
          <NCard :title="t('usage.charts.latencyDist')">
            <EChart :option="latencyOption" :height="240" />
          </NCard>
        </NGi>
      </NGrid>

      <NCard :title="t('usage.byApp')">
        <NDataTable
          :columns="breakdownColumns"
          :data="apps"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => r.id"
          :empty="h(NEmpty, { description: t('usage.empty.app') })"
        />
      </NCard>

      <NCard :title="t('usage.byConsumerKey')">
        <NDataTable
          :columns="breakdownColumns"
          :data="consumerKeys"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => r.id"
          :empty="h(NEmpty, { description: t('usage.empty.consumerKey') })"
        />
      </NCard>

      <NCard :title="t('usage.byUpstreamKey')">
        <NDataTable
          :columns="breakdownColumns"
          :data="upstreamKeys"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => r.id"
          :empty="h(NEmpty, { description: t('usage.empty.upstreamKey') })"
        />
      </NCard>

      <NCard :title="t('usage.byTarget')">
        <NDataTable
          :columns="targetColumns"
          :data="targets"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => `${r.targetType}:${r.id}`"
          :empty="h(NEmpty, { description: t('usage.empty.target') })"
        />
      </NCard>

      <NCard :title="t('usage.recentRequests')">
        <NDataTable
          :columns="recentColumns"
          :data="recent"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => r.id"
          :max-height="480"
          :empty="h(NEmpty, { description: t('usage.empty.recent') })"
        />
      </NCard>

      <NCard :title="t('usage.traces')">
        <NDataTable
          :columns="traceColumns"
          :data="traces"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => r.requestTraceId"
          :max-height="360"
          :row-props="(row) => ({ style: { cursor: 'pointer' }, onClick: () => openTraceDetail(row.requestTraceId) })"
          :empty="h(NEmpty, { description: t('usage.empty.traces') })"
        />
      </NCard>

      <NDrawer v-model:show="traceDrawerOpen" :width="720">
        <NDrawerContent
          :title="
            selectedTrace
              ? `${t('usage.traceDetail')} — ${selectedTrace.requestTraceId}`
              : t('usage.traceDetail')
          "
          closable
        >
          <NSpace vertical size="large">
            <NText v-if="traceDetailLoading" type="info">{{ t('common.loading') }}</NText>
            <NText v-else-if="traceDetailError" type="error">{{
              t('usage.traceSteps.loadError', { message: traceDetailError })
            }}</NText>
            <template v-else-if="selectedTrace">
              <NText strong>{{ t('usage.traceSteps.title') }}</NText>
              <NDataTable
                :columns="traceStepColumns"
                :data="selectedTrace.steps"
                :bordered="false"
                :single-line="false"
                :row-key="(r) => r.id"
                :max-height="520"
                size="small"
                :empty="h(NEmpty, { description: t('usage.empty.traces') })"
              />
            </template>
          </NSpace>
        </NDrawerContent>
      </NDrawer>

      <NCard :title="t('usage.consumption')">
        <NDataTable
          :columns="consumptionColumns"
          :data="consumption"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => r.dayDate"
          :max-height="360"
          :empty="h(NEmpty, { description: t('usage.empty.consumption') })"
        />
      </NCard>

      <NText v-if="lastError" type="error">{{
        t('usage.loadError', { message: lastError })
      }}</NText>
    </NSpace>
  </div>
</template>

<style scoped>
.usage-page {
  max-width: 1280px;
  margin: 0 auto;
}
</style>
