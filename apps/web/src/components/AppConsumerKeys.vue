<script setup lang="ts">
import { computed, h, onMounted, ref } from "vue";
import {
  NAlert,
  NButton,
  NCode,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTag,
  NText,
  useMessage,
  type DataTableColumns,
} from "naive-ui";
import {
  consumerKeysApi,
  type AppSummary,
  type ConsumerKey,
  type ConsumerKeyAccessItem,
  type ModelGroup,
  type PublicModel,
} from "../api/admin.js";

const props = defineProps<{
  app: AppSummary;
  publicModels: PublicModel[];
  modelGroups: ModelGroup[];
}>();

const message = useMessage();

const items = ref<ConsumerKey[]>([]);
const loading = ref(false);
const createOpen = ref(false);
const submitting = ref(false);
const form = ref<{ name: string; access: string[] }>({ name: "", access: [] });
const justCreated = ref<ConsumerKey | null>(null);

async function refresh() {
  loading.value = true;
  try {
    const res = await consumerKeysApi.list(props.app.id);
    items.value = res.items;
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);

function openCreate() {
  form.value = { name: "", access: [] };
  createOpen.value = true;
}

async function onCreate() {
  if (!form.value.name.trim()) {
    message.error("Name is required");
    return;
  }
  submitting.value = true;
  try {
    const parsed: ConsumerKeyAccessItem[] = form.value.access
      .map((token) => {
        const idx = token.indexOf(":");
        if (idx <= 0) return null;
        const type = token.slice(0, idx);
        const id = token.slice(idx + 1);
        if (type === "group") return { targetType: "model_group" as const, targetId: id };
        if (type === "model") return { targetType: "public_model" as const, targetId: id };
        return null;
      })
      .filter((x): x is ConsumerKeyAccessItem => x !== null);
    const created = await consumerKeysApi.create(props.app.id, {
      name: form.value.name.trim(),
      access: parsed.length > 0 ? parsed : undefined,
    });
    items.value = [created, ...items.value];
    createOpen.value = false;
    justCreated.value = created;
    message.success("Consumer key created");
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    submitting.value = false;
  }
}

async function revoke(row: ConsumerKey) {
  try {
    const updated = await consumerKeysApi.revoke(row.id);
    items.value = items.value.map((i) => (i.id === row.id ? updated : i));
    message.success("Revoked");
  } catch (err) {
    message.error((err as Error).message);
  }
}

async function rotate(row: ConsumerKey) {
  try {
    const updated = await consumerKeysApi.rotate(row.id);
    items.value = items.value.map((i) => (i.id === row.id ? updated : i));
    justCreated.value = updated;
    message.success("Rotated");
  } catch (err) {
    message.error((err as Error).message);
  }
}

const accessOptions = computed(() => [
  ...props.modelGroups.map((g) => ({ label: `Group: ${g.name}`, value: `group:${g.id}` })),
  ...props.publicModels.map((m) => ({ label: `Model: ${m.name}`, value: `model:${m.id}` })),
]);

const columns = computed<DataTableColumns<ConsumerKey>>(() => [
  { title: "Name", key: "name", width: 160 },
  { title: "Prefix", key: "keyPrefix", width: 160 },
  {
    title: "Status",
    key: "enabled",
    width: 110,
    render: (row) =>
      !row.enabled
        ? h(NTag, { type: "error", size: "small" }, () => "Revoked")
        : h(NTag, { type: "success", size: "small" }, () => "Active"),
  },
  {
    title: "Actions",
    key: "actions",
    width: 200,
    render: (row) =>
      h(NSpace, { size: "small" }, () => [
        h(
          NPopconfirm,
          { onPositiveClick: () => rotate(row) },
          {
            trigger: () => h(NButton, { size: "small" }, () => "Rotate"),
            default: () => "Rotate? The current key will stop working immediately.",
          },
        ),
        h(
          NPopconfirm,
          { disabled: !row.enabled, onPositiveClick: () => revoke(row) },
          {
            trigger: () =>
              h(
                NButton,
                { size: "small", type: "warning", disabled: !row.enabled },
                () => "Revoke",
              ),
            default: () => "Revoke this key?",
          },
        ),
      ]),
  },
]);

function dismissJustCreated() {
  justCreated.value = null;
}
</script>

<template>
  <div>
    <NSpace align="center" justify="space-between" style="margin-bottom: 12px">
      <NText depth="3">{{ items.length }} key(s)</NText>
      <NButton type="primary" size="small" @click="openCreate">New consumer key</NButton>
    </NSpace>

    <NDataTable
      :columns="columns"
      :data="items"
      :loading="loading"
      :bordered="false"
      :single-line="false"
      :row-key="(row) => row.id"
      :empty="h(NEmpty, { description: 'No consumer keys for this app' })"
    />

    <NModal
      :show="createOpen"
      preset="card"
      style="max-width: 560px"
      title="New consumer key"
      @update:show="(v) => (createOpen = v)"
    >
      <NForm label-placement="top">
        <NFormItem label="Name" required>
          <NInput v-model:value="form.name" placeholder="Cline key" />
        </NFormItem>
        <NFormItem label="Access">
          <NSelect
            v-model:value="form.access"
            :options="accessOptions"
            multiple
            placeholder="grant access to public models or model groups"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="createOpen = false">Cancel</NButton>
          <NButton type="primary" :loading="submitting" @click="onCreate">Create</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      :show="justCreated !== null"
      preset="card"
      style="max-width: 640px"
      title="Consumer key created"
      @update:show="(v) => v || dismissJustCreated()"
    >
      <NAlert type="warning" :show-icon="false" style="margin-bottom: 12px">
        Copy the raw key now. It will not be shown again.
      </NAlert>
      <NCode v-if="justCreated" :code="justCreated.key ?? ''" language="text" />
      <NSpace justify="end" style="margin-top: 12px">
        <NButton type="primary" @click="dismissJustCreated">I have saved it</NButton>
      </NSpace>
    </NModal>
  </div>
</template>