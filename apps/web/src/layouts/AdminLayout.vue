<script setup lang="ts">
import { computed, ref } from "vue";
import {
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NLayoutContent,
  NMenu,
  NText,
  NSpace,
  type MenuOption,
} from "naive-ui";
import { RouterView, useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const collapsed = ref(false);

const menuOptions = computed<MenuOption[]>(() => [
  { key: "overview", label: "Overview" },
  { key: "upstream-keys", label: "Upstream Keys" },
  { key: "public-models", label: "Public Models" },
  { key: "model-groups", label: "Model Groups" },
  { key: "apps", label: "Apps" },
  { key: "usage", label: "Usage" },
  { key: "settings", label: "Settings" },
]);

const activeKey = computed<string>(() => (typeof route.name === "string" ? route.name : "overview"));

function onMenuSelect(key: string): void {
  void router.push({ name: key });
}
</script>

<template>
  <NLayout has-sider style="height: 100vh">
    <NLayoutSider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      show-trigger
      :collapsed="collapsed"
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="logo">
        <NText strong>ModelHarbor</NText>
      </div>
      <NMenu
        :options="menuOptions"
        :value="activeKey"
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        @update:value="onMenuSelect"
      />
    </NLayoutSider>
    <NLayout>
      <NLayoutHeader bordered class="header">
        <NSpace align="center" justify="space-between" style="width: 100%">
          <NText depth="3">v0.1.0 · M0 scaffold</NText>
        </NSpace>
      </NLayoutHeader>
      <NLayoutContent content-style="padding: 24px;">
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>

<style scoped>
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--n-border-color);
}
.header {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
}
</style>