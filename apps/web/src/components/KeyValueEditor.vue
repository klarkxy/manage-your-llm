<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { NButton, NInput, NSpace, NSwitch } from 'naive-ui';

export interface KeyValueItem {
  key: string;
  value: string;
  enabled: boolean;
}

const props = defineProps<{
  modelValue: KeyValueItem[];
  disabled?: boolean;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: KeyValueItem[]): void;
}>();

const { t } = useI18n();

const items = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

function addItem() {
  items.value = [...items.value, { key: '', value: '', enabled: true }];
}

function removeItem(index: number) {
  const next = [...items.value];
  next.splice(index, 1);
  items.value = next;
}

function updateItem(index: number, patch: Partial<KeyValueItem>) {
  const next = [...items.value];
  next[index] = { ...next[index]!, ...patch };
  items.value = next;
}
</script>

<template>
  <div class="key-value-editor">
    <div
      v-for="(item, index) in items"
      :key="index"
      class="key-value-row"
      :class="{ disabled: !item.enabled }"
    >
      <NInput
        :value="item.key"
        :placeholder="keyPlaceholder ?? t('keyValueEditor.key')"
        :disabled="disabled"
        @update:value="(v) => updateItem(index, { key: v })"
      />
      <NInput
        :value="item.value"
        :placeholder="valuePlaceholder ?? t('keyValueEditor.value')"
        :disabled="disabled"
        @update:value="(v) => updateItem(index, { value: v })"
      />
      <NSwitch
        :value="item.enabled"
        :disabled="disabled"
        @update:value="(v) => updateItem(index, { enabled: v })"
      />
      <NButton v-if="!disabled" quaternary circle size="small" @click="removeItem(index)">
        ✕
      </NButton>
    </div>
    <NButton v-if="!disabled" dashed block @click="addItem">
      {{ t('keyValueEditor.add') }}
    </NButton>
  </div>
</template>

<style scoped>
.key-value-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.key-value-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto;
  align-items: center;
  gap: 8px;
}

.key-value-row.disabled {
  opacity: 0.6;
}
</style>
