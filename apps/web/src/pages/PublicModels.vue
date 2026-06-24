<script setup lang="ts">
import { NCard, NText } from 'naive-ui';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <NCard :title="t('publicModels.title')">
    <NText>Phase 0 公共模型占位页。</NText>
  </NCard>
</template>
