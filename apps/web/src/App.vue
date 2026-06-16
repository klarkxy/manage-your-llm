<script setup lang="ts">
import { computed } from "vue";
import { NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider, lightTheme } from "naive-ui";
import type { GlobalThemeOverrides } from "naive-ui";
import { useRoute } from "vue-router";
import AdminLayout from "./layouts/AdminLayout.vue";

const route = useRoute();

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#2563eb",
    primaryColorHover: "#3b82f6",
    primaryColorPressed: "#1d4ed8",
    primaryColorSuppl: "#3b82f6",
    borderRadius: "6px",
  },
};

const isStandalone = computed(() => route.meta["standalone"] === true);
</script>

<template>
  <NConfigProvider :theme="lightTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NDialogProvider>
        <NNotificationProvider>
          <RouterView v-if="isStandalone" />
          <AdminLayout v-else />
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>