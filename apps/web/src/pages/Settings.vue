<script setup lang="ts">
import { NCard, NText } from 'naive-ui';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <NCard :title="t('settings.title')">
    <NText>Phase 0 设置占位页。</NText>
  </NCard>
</template>
