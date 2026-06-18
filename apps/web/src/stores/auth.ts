import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, type AdminSummary } from '../api/auth.js';
import { ApiClientError } from '../api/client.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AdminSummary | null>(null);
  const ready = ref(false);
  const isAuthenticated = computed(() => user.value !== null);

  async function fetchMe(): Promise<void> {
    try {
      const res = await authApi.me();
      user.value = res.admin;
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        user.value = null;
        return;
      }
      throw err;
    } finally {
      ready.value = true;
    }
  }

  async function login(username: string, password: string): Promise<void> {
    const res = await authApi.login(username, password);
    user.value = res.admin;
    ready.value = true;
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } finally {
      user.value = null;
    }
  }

  return { user, ready, isAuthenticated, fetchMe, login, logout };
});
