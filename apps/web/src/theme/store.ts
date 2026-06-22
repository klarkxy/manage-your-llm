import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { darkTheme, type GlobalTheme, type GlobalThemeOverrides } from 'naive-ui';
import { lightTokens, darkTokens, type ThemeMode } from './tokens.js';

const STORAGE_KEY = 'modelharbor-theme';

function readMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  // First visit follows the OS preference; afterwards the explicit choice wins.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Stamp `<html data-theme>` so scoped CSS and echarts can react to mode changes.
 * echarts cannot hot-swap its palette, so `EChart.vue` listens for the
 * `themechange` event and rebuilds the chart.
 */
export function applySystemEffects(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = mode;
  window.dispatchEvent(new CustomEvent('themechange', { detail: mode }));
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readMode());

  const naiveTheme = computed<GlobalTheme | null>(() => (mode.value === 'dark' ? darkTheme : null));
  const overrides = computed<GlobalThemeOverrides>(() =>
    mode.value === 'dark' ? darkTokens : lightTokens,
  );
  const isDark = computed(() => mode.value === 'dark');

  function setMode(next: ThemeMode): void {
    mode.value = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore quota / privacy-mode failures
    }
    applySystemEffects(next);
  }

  function toggle(): void {
    setMode(mode.value === 'dark' ? 'light' : 'dark');
  }

  return { mode, naiveTheme, overrides, isDark, setMode, toggle };
});
