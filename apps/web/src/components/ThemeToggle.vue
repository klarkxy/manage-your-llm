<script setup lang="ts">
import { NButton, NIcon, NTooltip } from 'naive-ui';
import { SunnyOutline, MoonOutline } from '@vicons/ionicons5';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '../theme/index.js';

const theme = useThemeStore();
const { t } = useI18n();
</script>

<template>
  <NTooltip>
    <template #trigger>
      <NButton
        circle
        size="small"
        quaternary
        :aria-label="t('layout.theme.toggle')"
        @click="theme.toggle()"
      >
        <template #icon>
          <NIcon>
            <SunnyOutline v-if="theme.isDark" />
            <MoonOutline v-else />
          </NIcon>
        </template>
      </NButton>
    </template>
    {{ theme.isDark ? t('layout.theme.toLight') : t('layout.theme.toDark') }}
  </NTooltip>
</template>
