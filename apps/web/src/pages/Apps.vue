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
  NSpace,
  NTag,
  NText,
  useMessage,
  type DataTableColumns,
} from "naive-ui";
import {
  appsApi,
  modelGroupsApi,
  publicModelsApi,
  type AppSummary,
  type ModelGroup,
  type PublicModel,
} from "../api/admin.js";
import AppConsumerKeys from "../components/AppConsumerKeys.vue";

const message = useMessage();

const items = ref<AppSummary[]>([]);
const publicModels = ref<PublicModel[]>([]);
const modelGroups = ref<ModelGroup[]>([]);
const loading = ref(false);
const drawerOpen = ref(false);
const submitting = ref(false);
const form = ref<{ name: string; description: string }>({ name: "", description: "" });

async function refresh() {
  loading.value = true;
  try {
    const [appsRes, pmRes, mgRes] = await Promise.all([
      appsApi.list(),
      publicModelsApi.list(),
      modelGroupsApi.list(),
    ]);
    items.value = appsRes.items;
    publicModels.value = pmRes.items;
    modelGroups.value = mgRes.items;
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);

function openCreate() {
  form.value = { name: "", description: "" };
  drawerOpen.value = true;
}

async function onSubmit() {
  if (!form.value.name.trim()) {
    message.error("Name is required");
    return;
  }
  submitting.value = true;
  try {
    const created = await appsApi.create({
      name: form.value.name.trim(),
      description: form.value.description.trim() || undefined,
    });
    items.value = [created, ...items.value];
    drawerOpen.value = false;
    message.success("App created");
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    submitting.value = false;
  }
}

const columns = computed<DataTableColumns<AppSummary>>(() => [
  { title: "Name", key: "name", width: 220 },
  { title: "Description", key: "description", ellipsis: { tooltip: true } },
  {
    title: "Status",
    key: "enabled",
    width: 100,
    render: (row) =>
      row.enabled
        ? h(NTag, { type: "success", size: "small" }, () => "Enabled")
        : h(NTag, { type: "default", size: "small" }, () => "Disabled"),
  },
  { title: "Created", key: "createdAt", width: 200 },
]);
</script>

<template>
  <div class="page">
    <NCard>
      <NSpace align="center" justify="space-between" style="margin-bottom: 16px">
        <NText strong>Apps</NText>
        <NButton type="primary" @click="openCreate">New app</NButton>
      </NSpace>
      <NDataTable
        :columns="columns"
        :data="items"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        :row-key="(row) => row.id"
        :empty="h(NEmpty, { description: 'No apps yet' })"
      />
    </NCard>

    <NCard v-for="app in items" :key="app.id" :title="`Consumer keys · ${app.name}`" style="margin-top: 16px">
      <AppConsumerKeys
        :app="app"
        :public-models="publicModels"
        :model-groups="modelGroups"
      />
    </NCard>

    <NDrawer v-model:show="drawerOpen" :width="420">
      <NDrawerContent title="New app" closable>
        <NForm label-placement="top">
          <NFormItem label="Name" required>
            <NInput v-model:value="form.name" placeholder="Local IDE" />
          </NFormItem>
          <NFormItem label="Description">
            <NInput v-model:value="form.description" type="textarea" :rows="2" />
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