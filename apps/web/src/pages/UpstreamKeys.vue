<script setup lang="ts">
import { computed, h, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  NButton,
  NCard,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NTag,
  NText,
  NPopconfirm,
  useMessage,
  type DataTableColumns,
} from "naive-ui";
import {
  upstreamKeysApi,
  type UpstreamKey,
  type UpstreamKeyCreatePayload,
} from "../api/admin.js";

const router = useRouter();
const message = useMessage();

const items = ref<UpstreamKey[]>([]);
const loading = ref(false);
const drawerOpen = ref(false);
const submitting = ref(false);

const form = ref<UpstreamKeyCreatePayload>({
  name: "",
  providerType: "anthropic_compatible",
  baseUrl: "",
  apiKey: "",
  supportedModels: [],
  quota: { period: "month" },
});
const supportedModelsText = ref("");

function resetForm() {
  form.value = {
    name: "",
    providerType: "anthropic_compatible",
    baseUrl: "",
    apiKey: "",
    supportedModels: [],
    quota: { period: "month" },
  };
  supportedModelsText.value = "";
}

async function refresh() {
  loading.value = true;
  try {
    const res = await upstreamKeysApi.list();
    items.value = res.items;
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);

function openCreate() {
  resetForm();
  drawerOpen.value = true;
}

async function onSubmit() {
  if (!form.value.name || !form.value.baseUrl || !form.value.apiKey) {
    message.error("Name, base URL, and API key are required");
    return;
  }
  submitting.value = true;
  try {
    const supportedModels = supportedModelsText.value
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const payload: UpstreamKeyCreatePayload = {
      ...form.value,
      supportedModels,
    };
    const quota = payload.quota;
    const hasAnyQuotaLimit = Boolean(
      quota?.requestLimit || quota?.inputTokenLimit || quota?.outputTokenLimit || quota?.totalTokenLimit,
    );
    if (!hasAnyQuotaLimit) {
      payload.quota = undefined;
    }
    const created = await upstreamKeysApi.create(payload);
    items.value = [created, ...items.value];
    drawerOpen.value = false;
    message.success("Upstream key created");
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    submitting.value = false;
  }
}

async function toggleFreeze(row: UpstreamKey) {
  try {
    if (row.frozen) {
      const res = await upstreamKeysApi.unfreeze(row.id);
      message.success(res.frozen ? "Frozen" : "Unfrozen");
    } else {
      await upstreamKeysApi.freeze(row.id, "manual freeze");
      message.success("Frozen");
    }
    await refresh();
  } catch (err) {
    message.error((err as Error).message);
  }
}

const columns = computed<DataTableColumns<UpstreamKey>>(() => [
  { title: "Name", key: "name", fixed: "left", width: 200 },
  {
    title: "Provider",
    key: "providerType",
    width: 180,
    render: (row) => h(NTag, { type: "info", size: "small" }, () => row.providerType),
  },
  { title: "Base URL", key: "baseUrl", ellipsis: { tooltip: true } },
  { title: "Models", key: "supportedModels", width: 80, render: (row) => String(row.supportedModels.length) },
  {
    title: "Status",
    key: "status",
    width: 110,
    render: (row) =>
      row.frozen
        ? h(NTag, { type: "warning", size: "small" }, () => "Frozen")
        : row.enabled
          ? h(NTag, { type: "success", size: "small" }, () => "Active")
          : h(NTag, { type: "default", size: "small" }, () => "Disabled"),
  },
  {
    title: "Actions",
    key: "actions",
    width: 180,
    render: (row) =>
      h(NSpace, { size: "small" }, () => [
        h(
          NPopconfirm,
          { onPositiveClick: () => toggleFreeze(row) },
          {
            trigger: () =>
              h(
                NButton,
                { size: "small", type: row.frozen ? "primary" : "warning" },
                () => (row.frozen ? "Unfreeze" : "Freeze"),
              ),
            default: () => (row.frozen ? "Unfreeze this key?" : "Freeze this key?"),
          },
        ),
      ]),
  },
]);
</script>

<template>
  <div class="page">
    <NCard>
      <NSpace align="center" justify="space-between" style="margin-bottom: 16px">
        <NText strong>Upstream Keys</NText>
        <NButton type="primary" @click="openCreate">New upstream key</NButton>
      </NSpace>

      <NDataTable
        :columns="columns"
        :data="items"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        :row-key="(row) => row.id"
        :empty="h(NEmpty, { description: 'No upstream keys yet' })"
      />
    </NCard>

    <NDrawer v-model:show="drawerOpen" :width="480">
      <NDrawerContent title="New upstream key" closable>
        <NForm label-placement="top">
          <NFormItem label="Name" required>
            <NInput v-model:value="form.name" placeholder="DeepSeek key 1" />
          </NFormItem>
          <NFormItem label="Provider" required>
            <NSelect
              v-model:value="form.providerType"
              :options="[
                { label: 'Anthropic compatible', value: 'anthropic_compatible' },
                { label: 'OpenAI compatible', value: 'openai_compatible' },
              ]"
            />
          </NFormItem>
          <NFormItem label="Base URL" required>
            <NInput v-model:value="form.baseUrl" placeholder="https://api.example.com" />
          </NFormItem>
          <NFormItem label="API key" required>
            <NInput
              v-model:value="form.apiKey"
              type="password"
              show-password-on="click"
              placeholder="sk-..."
            />
          </NFormItem>
          <NFormItem label="Supported models (comma or newline separated)">
            <NInput
              v-model:value="supportedModelsText"
              type="textarea"
              :rows="3"
              placeholder="ds-v4-flash, ds-v4-pro"
            />
          </NFormItem>
          <NFormItem label="Quota period">
            <NSelect
              v-model:value="form.quota!.period"
              :options="[
                { label: 'Hour', value: 'hour' },
                { label: 'Day', value: 'day' },
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
                { label: 'Total', value: 'total' },
              ]"
            />
          </NFormItem>
          <NFormItem label="Request limit">
            <NInputNumber v-model:value="form.quota!.requestLimit" :min="0" placeholder="optional" />
          </NFormItem>
          <NFormItem label="Input token limit">
            <NInputNumber v-model:value="form.quota!.inputTokenLimit" :min="0" placeholder="optional" />
          </NFormItem>
          <NFormItem label="Output token limit">
            <NInputNumber v-model:value="form.quota!.outputTokenLimit" :min="0" placeholder="optional" />
          </NFormItem>
          <NFormItem label="Total token limit">
            <NInputNumber v-model:value="form.quota!.totalTokenLimit" :min="0" placeholder="optional" />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="drawerOpen = false">Cancel</NButton>
            <NButton type="primary" :loading="submitting" @click="onSubmit">Create</NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
