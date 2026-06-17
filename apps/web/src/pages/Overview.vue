<script setup lang="ts">
import { computed, onMounted, ref, h } from "vue";
import { useRouter } from "vue-router";
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
} from "naive-ui";
import {
  appsApi,
  modelGroupsApi,
  publicModelsApi,
  upstreamKeysApi,
  type AppSummary,
  type ModelGroup,
  type PublicModel,
  type UpstreamKey,
} from "../api/admin.js";

const router = useRouter();
const apps = ref<AppSummary[]>([]);
const groups = ref<ModelGroup[]>([]);
const models = ref<PublicModel[]>([]);
const keys = ref<UpstreamKey[]>([]);

async function refresh() {
  try {
    const [a, g, m, k] = await Promise.all([
      appsApi.list(),
      modelGroupsApi.list(),
      publicModelsApi.list(),
      upstreamKeysApi.list(),
    ]);
    apps.value = a.items;
    groups.value = g.items;
    models.value = m.items;
    keys.value = k.items;
  } catch {
    // Overview should never block login; show zeros on error.
  }
}

onMounted(refresh);

const frozenKeys = computed(() => keys.value.filter((k) => k.frozen).length);
const activeKeys = computed(() => keys.value.filter((k) => k.enabled && !k.frozen).length);

const modelColumns: DataTableColumns<PublicModel> = [
  { title: "Public model", key: "name" },
  { title: "Display", key: "displayName" },
  { title: "Candidates", key: "candidateCount", width: 110 },
];

const groupColumns: DataTableColumns<ModelGroup> = [
  { title: "Group", key: "name" },
  { title: "Display", key: "displayName" },
  { title: "Members", key: "memberCount", width: 110 },
];
</script>

<template>
  <div class="overview">
    <NSpace vertical size="large">
      <NCard>
        <NSpace align="center" :size="12">
          <NTag type="success" round>v0.1.0</NTag>
          <span>ModelHarbor · model routing is live, observation starts at M7.</span>
        </NSpace>
      </NCard>

      <NGrid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
        <NGi :span="1">
          <NCard>
            <NStatistic label="Apps" :value="apps.length" />
          </NCard>
        </NGi>
        <NGi :span="1">
          <NCard>
            <NStatistic label="Public models" :value="models.length" />
          </NCard>
        </NGi>
        <NGi :span="1">
          <NCard>
            <NStatistic label="Model groups" :value="groups.length" />
          </NCard>
        </NGi>
        <NGi :span="1">
          <NCard>
            <NStatistic label="Upstream keys" :value="keys.length" />
            <NSpace :size="6" style="margin-top: 4px">
              <NTag size="small" type="success">active {{ activeKeys }}</NTag>
              <NTag size="small" type="warning">frozen {{ frozenKeys }}</NTag>
            </NSpace>
          </NCard>
        </NGi>
      </NGrid>

      <NCard title="Public models">
        <NDataTable
          :columns="modelColumns"
          :data="models"
          :bordered="false"
          :row-key="(r) => r.id"
          :empty="h(NEmpty, { description: 'No public models' })"
        />
      </NCard>

      <NCard title="Model groups">
        <NDataTable
          :columns="groupColumns"
          :data="groups"
          :bordered="false"
          :row-key="(r) => r.id"
          :empty="h(NEmpty, { description: 'No model groups' })"
        />
      </NCard>

      <NCard title="Next steps">
        <p>Create upstream keys and public models from the navigation. M3-M7 will wire the gateway and sticky routing.</p>
        <NSpace>
          <NButton type="primary" @click="router.push('/upstream-keys')">Manage upstream keys</NButton>
          <NButton @click="router.push('/public-models')">Public models</NButton>
          <NButton @click="router.push('/apps')">Apps</NButton>
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
