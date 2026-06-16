<script setup lang="ts">
import { NEmpty } from "naive-ui";

defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="empty-state">
    <NEmpty :description="description ?? 'M0 scaffold · content lands in later milestones'">
      <template #extra>
        <p>{{ title }}</p>
      </template>
    </NEmpty>
  </div>
</template>

<style scoped>
.empty-state {
  max-width: 960px;
  margin: 24px auto;
  padding: 0 16px;
}
</style>