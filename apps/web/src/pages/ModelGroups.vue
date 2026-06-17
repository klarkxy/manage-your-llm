<script setup lang="ts">
import { computed, h, onMounted, ref } from "vue";
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
  modelGroupsApi,
  publicModelsApi,
  type ModelGroup,
  type ModelGroupCreatePayload,
  type PublicModel,
} from "../api/admin.js";

const message = useMessage();

const items = ref<ModelGroup[]>([]);
const publicModelOptions = ref<PublicModel[]>([]);
const loading = ref(false);
const drawerOpen = ref(false);
const submitting = ref(false);

const form = ref<ModelGroupCreatePayload>({ name: "", displayName: "", description: "" });
const memberRows = ref<Array<{ publicModelId: string; priority: number }>>([]);

function resetForm() {
  form.value = { name: "", displayName: "", description: "" };
  memberRows.value = [];
}

async function refresh() {
  loading.value = true;
  try {
    const [res, pmRes] = await Promise.all([modelGroupsApi.list(), publicModelsApi.list()]);
    items.value = res.items;
    publicModelOptions.value = pmRes.items;
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

function addMember() {
  if (publicModelOptions.value.length === 0) {
    message.warning("Create a public model first");
    return;
  }
  memberRows.value.push({
    publicModelId: publicModelOptions.value[0]!.id,
    priority: 100,
  });
}

function removeMember(idx: number) {
  memberRows.value.splice(idx, 1);
}

async function onSubmit() {
  if (!form.value.name) {
    message.error("Name is required");
    return;
  }
  submitting.value = true;
  try {
    const payload: ModelGroupCreatePayload = {
      name: form.value.name.trim(),
      displayName: form.value.displayName?.trim() || undefined,
      description: form.value.description?.trim() || undefined,
      members: memberRows.value.map((m) => ({ publicModelId: m.publicModelId, priority: m.priority })),
    };
    const created = await modelGroupsApi.create(payload);
    items.value = [created, ...items.value];
    drawerOpen.value = false;
    message.success("Model group created");
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    submitting.value = false;
  }
}

async function remove(row: ModelGroup) {
  try {
    await modelGroupsApi.remove(row.id);
    items.value = items.value.filter((i) => i.id !== row.id);
    message.success("Deleted");
  } catch (err) {
    message.error((err as Error).message);
  }
}

const columns = computed<DataTableColumns<ModelGroup>>(() => [
  { title: "Name", key: "name", width: 220 },
  { title: "Display name", key: "displayName", width: 200 },
  { title: "Policy", key: "routingPolicy", width: 100 },
  { title: "Members", key: "memberCount", width: 100 },
  {
    title: "Status",
    key: "enabled",
    width: 100,
    render: (row) =>
      row.enabled
        ? h(NTag, { type: "success", size: "small" }, () => "Enabled")
        : h(NTag, { type: "default", size: "small" }, () => "Disabled"),
  },
  {
    title: "Actions",
    key: "actions",
    width: 110,
    render: (row) =>
      h(
        NPopconfirm,
        { onPositiveClick: () => remove(row) },
        {
          trigger: () => h(NButton, { size: "small", type: "error" }, () => "Delete"),
          default: () => `Delete ${row.name}?`,
        },
      ),
  },
]);

const modelOptions = computed(() =>
  publicModelOptions.value.map((m) => ({ label: m.name, value: m.id })),
);
</script>

<template>
  <div class="page">
    <NCard>
      <NSpace align="center" justify="space-between" style="margin-bottom: 16px">
        <NText strong>Model Groups</NText>
        <NButton type="primary" @click="openCreate">New model group</NButton>
      </NSpace>

      <NDataTable
        :columns="columns"
        :data="items"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        :row-key="(row) => row.id"
        :empty="h(NEmpty, { description: 'No model groups yet' })"
      />
    </NCard>

    <NDrawer v-model:show="drawerOpen" :width="520">
      <NDrawerContent title="New model group" closable>
        <NForm label-placement="top">
          <NFormItem label="Name" required>
            <NInput v-model:value="form.name" placeholder="coding" />
          </NFormItem>
          <NFormItem label="Display name">
            <NInput v-model:value="form.displayName" placeholder="Coding" />
          </NFormItem>
          <NFormItem label="Description">
            <NInput v-model:value="form.description" type="textarea" :rows="2" />
          </NFormItem>
          <NFormItem label="Members">
            <NSpace vertical size="small" style="width: 100%">
              <div
                v-for="(m, idx) in memberRows"
                :key="idx"
                style="display: flex; gap: 8px; align-items: center"
              >
                <NSelect
                  v-model:value="m.publicModelId"
                  :options="modelOptions"
                  style="flex: 1"
                  placeholder="public model"
                />
                <NInputNumber v-model:value="m.priority" :min="0" style="width: 90px" />
                <NButton size="small" type="error" tertiary @click="removeMember(idx)">×</NButton>
              </div>
              <NButton size="small" @click="addMember">+ Add member</NButton>
            </NSpace>
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