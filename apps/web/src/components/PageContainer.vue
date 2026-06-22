<script setup lang="ts">
import { computed } from 'vue';
import { NText } from 'naive-ui';

const props = withDefaults(
  defineProps<{
    /** Content max-width in px. Defaults to 1200; wide pages (Usage/ModelReference) pass 1400. */
    maxWidth?: number;
    /** Optional header title shown above the content. */
    title?: string;
  }>(),
  { maxWidth: 1200 },
);

const style = computed(() => ({ '--page-max': `${props.maxWidth}px` }));
</script>

<template>
  <div class="page-container" :style="style">
    <header
      v-if="title || $slots.header || $slots.actions"
      class="page-container__head"
    >
      <div class="page-container__title-wrap">
        <slot name="header">
          <NText strong class="page-container__title">{{ title }}</NText>
        </slot>
      </div>
      <div v-if="$slots.actions" class="page-container__actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </div>
</template>

<style scoped>
.page-container {
  max-width: var(--page-max);
  margin: 0 auto;
}
.page-container__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.page-container__title {
  font-size: 18px;
}
.page-container__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
@media (max-width: 640px) {
  .page-container__head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
