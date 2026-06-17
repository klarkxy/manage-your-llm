<script setup lang="ts">
import { computed, h, onMounted, ref } from "vue";
import {
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NGi,
  NGrid,
  NSpace,
  NStatistic,
  NTag,
  NText,
  type DataTableColumns,
} from "naive-ui";
import {
  usageApi,
  type UsageBreakdownEntry,
  type UsageRecentRow,
  type UsageTargetBreakdownEntry,
  type UsageTotals,
  type UsageWindow,
} from "../api/admin.js";

const windowKind = ref<UsageWindow>("today");
const windowOptions: Array<{ label: string; value: UsageWindow }> = [
  { label: "Today", value: "today" },
  { label: "24 hours", value: "24h" },
  { label: "7 days", value: "7d" },
];

const totals = ref<UsageTotals | null>(null);
const apps = ref<UsageBreakdownEntry[]>([]);
const consumerKeys = ref<UsageBreakdownEntry[]>([]);
const upstreamKeys = ref<UsageBreakdownEntry[]>([]);
const targets = ref<UsageTargetBreakdownEntry[]>([]);
const recent = ref<UsageRecentRow[]>([]);
const loading = ref(false);
const lastError = ref<string | null>(null);

async function refresh(): Promise<void> {
  loading.value = true;
  lastError.value = null;
  try {
    const w = windowKind.value;
    const [t, a, c, u, tg, r] = await Promise.all([
      usageApi.totals(w),
      usageApi.byApp(w),
      usageApi.byConsumerKey(w),
      usageApi.byUpstreamKey(w),
      usageApi.byTarget(w),
      usageApi.recent(100),
    ]);
    totals.value = t;
    apps.value = a.items;
    consumerKeys.value = c.items;
    upstreamKeys.value = u.items;
    targets.value = tg.items;
    recent.value = r.items;
  } catch (err) {
    lastError.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);

const successRatePct = computed(() =>
  totals.value ? `${(totals.value.successRate * 100).toFixed(1)}%` : "—",
);
const stickyHitRatePct = computed(() =>
  totals.value ? `${(totals.value.stickyHitRate * 100).toFixed(1)}%` : "—",
);

const breakdownColumns: DataTableColumns<UsageBreakdownEntry> = [
  { title: "Name", key: "name", ellipsis: { tooltip: true } },
  {
    title: "Requests",
    key: "totalRequests",
    sorter: (a, b) => a.totalRequests - b.totalRequests,
    defaultSortOrder: "descend",
    render: (row) => row.totalRequests.toLocaleString(),
  },
  {
    title: "Success",
    key: "successfulRequests",
    render: (row) => row.successfulRequests.toLocaleString(),
  },
  {
    title: "Errors",
    key: "failedRequests",
    render: (row) =>
      h(
        NTag,
        { size: "small", type: row.failedRequests > 0 ? "error" : "default" },
        () => row.failedRequests.toLocaleString(),
      ),
  },
  {
    title: "Tokens (in/out)",
    key: "tokens",
    render: (row) => `${row.inputTokens.toLocaleString()} / ${row.outputTokens.toLocaleString()}`,
  },
];

const targetColumns: DataTableColumns<UsageTargetBreakdownEntry> = [
  { title: "Name", key: "name", ellipsis: { tooltip: true } },
  {
    title: "Type",
    key: "targetType",
    width: 120,
    render: (row) =>
      h(
        NTag,
        { size: "small", type: row.targetType === "public_model" ? "info" : "success" },
        () => (row.targetType === "public_model" ? "public model" : "model group"),
      ),
  },
  {
    title: "Requests",
    key: "totalRequests",
    sorter: (a, b) => a.totalRequests - b.totalRequests,
    defaultSortOrder: "descend",
    render: (row) => row.totalRequests.toLocaleString(),
  },
  {
    title: "Errors",
    key: "failedRequests",
    render: (row) => row.failedRequests.toLocaleString(),
  },
  {
    title: "Tokens (in/out)",
    key: "tokens",
    render: (row) => `${row.inputTokens.toLocaleString()} / ${row.outputTokens.toLocaleString()}`,
  },
];

const recentColumns: DataTableColumns<UsageRecentRow> = [
  {
    title: "Time",
    key: "createdAt",
    width: 200,
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
  { title: "App", key: "appId", width: 140, ellipsis: { tooltip: true } },
  {
    title: "Target",
    key: "requestedTargetName",
    width: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: "Upstream",
    key: "realModelName",
    width: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: "Status",
    key: "status",
    width: 110,
    render: (row) =>
      h(
        NTag,
        { size: "small", type: row.status === "success" ? "success" : "error" },
        () => row.status,
      ),
  },
  {
    title: "Latency",
    key: "latencyMs",
    width: 110,
    render: (row) => `${row.latencyMs} ms`,
  },
  {
    title: "Tokens (in/out/total)",
    key: "tokens",
    width: 180,
    render: (row) =>
      row.totalTokens === null
        ? "—"
        : `${row.inputTokens ?? 0} / ${row.outputTokens ?? 0} / ${row.totalTokens}`,
  },
  {
    title: "Error",
    key: "errorCode",
    width: 160,
    render: (row) => (row.errorCode ? row.errorCode : "—"),
  },
];
</script>

<template>
  <div class="usage-page">
    <NSpace vertical size="large">
      <NCard>
        <NSpace align="center" justify="space-between" style="margin-bottom: 12px">
          <NText strong>Usage overview</NText>
          <NSpace>
            <NButton
              v-for="opt in windowOptions"
              :key="opt.value"
              :type="windowKind === opt.value ? 'primary' : 'default'"
              size="small"
              @click="(windowKind = opt.value), refresh()"
            >
              {{ opt.label }}
            </NButton>
            <NButton size="small" :loading="loading" @click="refresh">Refresh</NButton>
          </NSpace>
        </NSpace>
        <NGrid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
          <NGi :span="1">
            <NCard>
              <NStatistic label="Requests" :value="totals?.totalRequests ?? 0" />
            </NCard>
          </NGi>
          <NGi :span="1">
            <NCard>
              <NStatistic label="Success rate" :value="successRatePct" />
            </NCard>
          </NGi>
          <NGi :span="1">
            <NCard>
              <NStatistic label="Sticky hit rate" :value="stickyHitRatePct" />
            </NCard>
          </NGi>
          <NGi :span="1">
            <NCard>
              <NStatistic
                label="Tokens (in / out)"
                :value="`${(totals?.inputTokens ?? 0).toLocaleString()} / ${(totals?.outputTokens ?? 0).toLocaleString()}`"
              />
            </NCard>
          </NGi>
        </NGrid>
      </NCard>

      <NCard title="By app">
        <NDataTable
          :columns="breakdownColumns"
          :data="apps"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => r.id"
          :empty="h(NEmpty, { description: 'No app traffic in this window' })"
        />
      </NCard>

      <NCard title="By consumer key">
        <NDataTable
          :columns="breakdownColumns"
          :data="consumerKeys"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => r.id"
          :empty="h(NEmpty, { description: 'No consumer key traffic in this window' })"
        />
      </NCard>

      <NCard title="By upstream key">
        <NDataTable
          :columns="breakdownColumns"
          :data="upstreamKeys"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => r.id"
          :empty="h(NEmpty, { description: 'No upstream traffic in this window' })"
        />
      </NCard>

      <NCard title="By target">
        <NDataTable
          :columns="targetColumns"
          :data="targets"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => `${r.targetType}:${r.id}`"
          :empty="h(NEmpty, { description: 'No target traffic in this window' })"
        />
      </NCard>

      <NCard title="Recent requests">
        <NDataTable
          :columns="recentColumns"
          :data="recent"
          :bordered="false"
          :single-line="false"
          :row-key="(r) => r.id"
          :max-height="480"
          :empty="h(NEmpty, { description: 'No gateway traffic yet' })"
        />
      </NCard>

      <NText v-if="lastError" type="error">Failed to load: {{ lastError }}</NText>
    </NSpace>
  </div>
</template>

<style scoped>
.usage-page {
  max-width: 1280px;
  margin: 0 auto;
}
</style>
