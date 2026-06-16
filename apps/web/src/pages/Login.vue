<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { NCard, NForm, NFormItem, NInput, NButton, NAlert, NSpace, NText } from "naive-ui";
import { useAuthStore } from "../stores/auth.js";
import { ApiClientError } from "../api/client.js";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const error = ref<string | null>(null);
const submitting = ref(false);

const redirectTo = computed<string>(() => {
  const r = route.query["redirect"];
  return typeof r === "string" && r.startsWith("/") ? r : "/";
});

async function onSubmit(): Promise<void> {
  if (submitting.value) return;
  error.value = null;
  submitting.value = true;
  try {
    await auth.login(username.value.trim(), password.value);
    await router.push(redirectTo.value);
  } catch (err) {
    if (err instanceof ApiClientError) {
      error.value =
        err.status === 401
          ? "Invalid username or password"
          : err.message || "Sign-in failed";
    } else {
      error.value = "Sign-in failed";
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <NCard title="ModelHarbor · Sign in" class="login-card">
      <NForm @submit.prevent="onSubmit">
        <NFormItem label="Username">
          <NInput v-model:value="username" placeholder="admin" autocomplete="username" :disabled="submitting" />
        </NFormItem>
        <NFormItem label="Password">
          <NInput
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="••••••••"
            autocomplete="current-password"
            :disabled="submitting"
            @keyup.enter="onSubmit"
          />
        </NFormItem>
        <NAlert v-if="error" type="error" :show-icon="false" style="margin-bottom: 12px">
          {{ error }}
        </NAlert>
        <NSpace vertical size="medium">
          <NButton type="primary" block :loading="submitting" attr-type="submit" @click="onSubmit">
            Sign in
          </NButton>
          <NText depth="3" style="text-align: center; font-size: 12px">
            First run? The bootstrap admin is created from the server env on startup.
          </NText>
        </NSpace>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--n-color-modal, #f5f7fa);
  padding: 24px;
}
.login-card {
  width: 100%;
  max-width: 380px;
}
</style>