<script setup lang="ts">
import { NIcon, NText } from 'naive-ui';
import type { Component } from 'vue';

defineProps<{
  label: string;
  value: string | number;
  icon?: Component;
  iconColor?: string;
  trend?: { value: number; direction: 'up' | 'down'; good?: boolean };
  /** Optional sparkline; rendered when the consumer wires up an EChart (stage 4). */
  sparkline?: boolean;
  loading?: boolean;
}>();
</script>

<template>
  <div class="stat-card" :class="{ 'stat-card--loading': loading }">
    <div class="stat-card__top">
      <span
        v-if="icon"
        class="stat-card__icon"
        :style="
          iconColor
            ? { background: iconColor + '20', color: iconColor }
            : undefined
        "
      >
        <NIcon :size="20">
          <component :is="icon" />
        </NIcon>
      </span>
      <div class="stat-card__body">
        <NText depth="3" class="stat-card__label">{{ label }}</NText>
        <NText strong class="stat-card__value">{{ value }}</NText>
      </div>
    </div>
    <div v-if="trend || sparkline" class="stat-card__foot">
      <span
        v-if="trend"
        class="stat-card__trend"
        :class="trend.good ? 'is-good' : 'is-bad'"
      >
        {{ trend.direction === 'up' ? '▲' : '▼' }}
        {{ Math.abs(trend.value).toFixed(1) }}%
      </span>
      <div v-if="sparkline" class="stat-card__spark">
        <slot name="sparkline" />
      </div>
    </div>
    <div v-if="$slots.default" class="stat-card__extra">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--n-card-color);
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  padding: 16px 20px;
  box-shadow: var(--n-box-shadow, 0 1px 2px rgba(16, 24, 40, 0.06));
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 92px;
}
.stat-card--loading {
  opacity: 0.6;
}
.stat-card__top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.stat-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--n-color-target, rgba(37, 99, 235, 0.08));
  color: var(--n-primary-color);
  flex-shrink: 0;
}
.stat-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.stat-card__label {
  font-size: 12px;
  line-height: 1.2;
}
.stat-card__value {
  font-size: 22px;
  line-height: 1.2;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.stat-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.stat-card__trend {
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.stat-card__trend.is-good {
  color: var(--n-success-color);
}
.stat-card__trend.is-bad {
  color: var(--n-error-color);
}
.stat-card__spark {
  flex: 1;
  min-width: 80px;
  height: 40px;
}
</style>
