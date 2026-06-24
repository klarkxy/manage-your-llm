<script setup lang="ts">
import { NCard, NText } from 'naive-ui';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <NCard :title="t('usage.title')">
    <NText>Phase 0 用量占位页。</NText>
  </NCard>
</template>
