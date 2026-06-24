import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface AdminSummary {
  id: string;
  username: string;
  displayName: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AdminSummary | null>(null);
  const ready = ref(false);
  const isAuthenticated = computed(() => user.value !== null);

  async function login(_username: string, _password: string): Promise<void> {
    // Phase 0 占位实现，后续阶段接入 contracts 与 API client。
    user.value = { id: 'adm_placeholder', username: 'admin', displayName: 'Admin' };
    ready.value = true;
  }

  async function logout(): Promise<void> {
    user.value = null;
  }

  async function fetchMe(): Promise<void> {
    // Phase 0 占位实现。
    ready.value = true;
  }

  return { user, ready, isAuthenticated, login, logout, fetchMe };
});
