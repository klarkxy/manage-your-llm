<script setup lang="ts">
import { ref } from 'vue';
import { NForm, NFormItem, NInput, NButton, NSpace, NCard } from 'naive-ui';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const username = ref('');
const password = ref('');
const loading = ref(false);

async function onSubmit(): Promise<void> {
  loading.value = true;
  // Phase 0：仅占位，后续阶段接入 auth store 与 API。
  await new Promise((resolve) => setTimeout(resolve, 300));
  loading.value = false;
}
</script>

<template>
  <div class="login-page">
    <NCard :title="t('login.title')" style="width: 360px">
      <NForm @submit.prevent="onSubmit">
        <NFormItem :label="t('login.username')">
          <NInput v-model:value="username" />
        </NFormItem>
        <NFormItem :label="t('login.password')">
          <NInput v-model:value="password" type="password" />
        </NFormItem>
        <NSpace justify="end">
          <NButton type="primary" attr-type="submit" :loading="loading">
            {{ t('login.submit') }}
          </NButton>
        </NSpace>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--n-color-hover);
}
</style>
