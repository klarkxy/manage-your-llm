<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { NAlert, NButton, NCard, NSpace, NSpin, NText } from 'naive-ui';
import { upstreamKeysApi } from '../api/admin.js';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const status = ref<'loading' | 'success' | 'error'>('loading');
const errorMessage = ref('');
const upstreamKeyId = ref<string | null>(null);

onMounted(async () => {
  const query = route.query;
  const code = typeof query.code === 'string' ? query.code : '';
  const state = typeof query.state === 'string' ? query.state : '';
  const error = typeof query.error === 'string' ? query.error : '';

  if (error) {
    status.value = 'error';
    errorMessage.value = t('oauthCallback.errorProvider', { error });
    return;
  }

  if (!code || !state) {
    status.value = 'error';
    errorMessage.value = t('oauthCallback.errorMissingParams');
    return;
  }

  try {
    const key = await upstreamKeysApi.oauthExchange({ state, code });
    upstreamKeyId.value = key.id;
    status.value = 'success';
    setTimeout(() => {
      void router.push({ name: 'upstream-keys' });
    }, 2000);
  } catch (err) {
    status.value = 'error';
    errorMessage.value = err instanceof Error ? err.message : t('oauthCallback.errorGeneric');
  }
});

function goToKeys() {
  void router.push({ name: 'upstream-keys' });
}
</script>

<template>
  <div class="page">
    <NCard style="max-width: 560px; margin: 64px auto">
      <NSpace vertical align="center">
        <template v-if="status === 'loading'">
          <NSpin size="large" />
          <NText>{{ t('oauthCallback.loading') }}</NText>
        </template>

        <template v-else-if="status === 'success'">
          <NAlert type="success" style="width: 100%">
            {{ t('oauthCallback.success') }}
          </NAlert>
          <NText depth="3">{{ t('oauthCallback.redirectHint') }}</NText>
          <NButton type="primary" @click="goToKeys">{{ t('oauthCallback.goToKeys') }}</NButton>
        </template>

        <template v-else>
          <NAlert type="error" style="width: 100%">
            {{ t('oauthCallback.errorTitle') }}
          </NAlert>
          <NText>{{ errorMessage }}</NText>
          <NButton @click="goToKeys">{{ t('oauthCallback.goToKeys') }}</NButton>
        </template>
      </NSpace>
    </NCard>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24px;
}
</style>
