<script setup lang="ts">
import { NCard, NSpace, NText } from 'naive-ui';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :title="t('overview.title')">
      <NText>Phase 0 概览占位页。</NText>
    </NCard>
  </NSpace>
</template>
