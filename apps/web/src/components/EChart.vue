<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import * as echarts from 'echarts/core';
import type { EChartsOption } from 'echarts';
import { useThemeStore } from '../theme/index.js';
import { ensureECharts } from '../composables/useECharts.js';

const props = withDefaults(
  defineProps<{
    option: EChartsOption;
    height?: number;
    loading?: boolean;
  }>(),
  { height: 280, loading: false },
);

const el = ref<HTMLDivElement | null>(null);
const chart = shallowRef<echarts.ECharts | null>(null);
const theme = useThemeStore();

function readCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function palette(): string[] {
  if (theme.isDark) {
    return ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#f472b6'];
  }
  return ['#2563eb', '#12b886', '#f59e0b', '#fa5252', '#7c5cff', '#228be6', '#e64980'];
}

function baseOption(): EChartsOption {
  const text = readCssVar('--n-text-color-2', '#475467');
  const border = readCssVar('--n-border-color', '#e4e7ec');
  const surface = readCssVar('--n-card-color', '#ffffff');
  return {
    color: palette(),
    textStyle: { color: text, fontFamily: 'Inter, sans-serif' },
    grid: { left: 40, right: 16, top: 32, bottom: 28, containLabel: true },
    legend: { textStyle: { color: text }, top: 4 },
    tooltip: {
      backgroundColor: surface,
      borderColor: border,
      textStyle: { color: text },
    },
  };
}

function render(): void {
  if (!chart.value) return;
  chart.value.setOption({ ...baseOption(), ...props.option }, true);
  chart.value.resize();
}

function build(): void {
  if (!el.value) return;
  ensureECharts();
  chart.value = echarts.init(el.value, undefined, { renderer: 'canvas' });
  render();
  if (props.loading) showLoading();
}

function showLoading(): void {
  const primary = readCssVar('--n-primary-color', '#2563eb');
  const mask = theme.isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.7)';
  chart.value?.showLoading('default', {
    text: '',
    color: primary,
    maskColor: mask,
  });
}

function onResize(): void {
  chart.value?.resize();
}

function onThemeChange(): void {
  // echarts can't hot-swap its palette, so the simplest correct behaviour is
  // to tear down and re-init. The new chart picks up the latest CSS-var-derived
  // colors via `render()`.
  if (!el.value) return;
  chart.value?.dispose();
  chart.value = null;
  build();
}

onMounted(() => {
  build();
  window.addEventListener('resize', onResize);
  window.addEventListener('themechange', onThemeChange);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('themechange', onThemeChange);
  chart.value?.dispose();
  chart.value = null;
});

watch(() => props.option, render, { deep: true });
watch(
  () => props.loading,
  (v) => {
    if (!chart.value) return;
    if (v) showLoading();
    else chart.value.hideLoading();
  },
);
</script>

<template>
  <div ref="el" class="echart" :style="{ height: height + 'px' }" />
</template>

<style scoped>
.echart {
  width: 100%;
}
</style>
