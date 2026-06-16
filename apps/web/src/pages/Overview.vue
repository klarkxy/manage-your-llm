<script setup lang="ts">
import { NSpace, NCard, NStatistic, NButton, NTag, NGrid, NGi } from "naive-ui";
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<template>
  <div class="overview">
    <NSpace vertical size="large">
      <NCard title="ModelHarbor" hoverable>
        <NSpace align="center" :size="12">
          <NTag type="success" round>v0.1.0</NTag>
          <span>Lightweight dashboard-first LLM API router.</span>
        </NSpace>
      </NCard>

      <NGrid :cols="3" :x-gap="16" :y-gap="16" responsive="screen">
        <NGi :span="1">
          <NCard>
            <NStatistic label="Total requests today" :value="0" />
          </NCard>
        </NGi>
        <NGi :span="1">
          <NCard>
            <NStatistic label="Active upstream keys" :value="0" />
          </NCard>
        </NGi>
        <NGi :span="1">
          <NCard>
            <NStatistic label="Sticky hit rate" value="–" />
          </NCard>
        </NGi>
      </NGrid>

      <NCard title="Next steps">
        <p>Milestone 0 only ships the monorepo skeleton. Configure upstream keys, public models, and groups from the navigation.</p>
        <NButton type="primary" @click="router.push('/upstream-keys')">Manage upstream keys</NButton>
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped>
.overview {
  max-width: 1100px;
  margin: 0 auto;
}
</style>