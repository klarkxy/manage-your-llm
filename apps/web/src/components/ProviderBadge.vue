<script setup lang="ts">
import { NText } from 'naive-ui';

withDefaults(
  defineProps<{
    /** Emoji icon from `ProviderDescriptor.branding.icon` (presets.ts). */
    icon?: string;
    /** Human-readable provider name. */
    name: string;
    /** Brand colour from `branding.color`; currently only Anthropic/OpenAI populate it. */
    color?: string;
    size?: 'small' | 'medium';
  }>(),
  { size: 'medium' },
);
</script>

<template>
  <span
    class="provider-badge"
    :class="[`provider-badge--${size}`]"
    :style="color ? { '--provider-brand': color } : undefined"
  >
    <span v-if="icon" class="provider-badge__icon" aria-hidden="true">{{ icon }}</span>
    <NText class="provider-badge__name">{{ name }}</NText>
  </span>
</template>

<style scoped>
.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--n-border-color);
  background: var(--n-color-target, transparent);
  line-height: 1.4;
}
.provider-badge--small {
  padding: 1px 6px;
  gap: 4px;
}
.provider-badge__icon {
  font-size: 14px;
  line-height: 1;
}
.provider-badge--small .provider-badge__icon {
  font-size: 12px;
}
.provider-badge__name {
  white-space: nowrap;
  font-size: 13px;
}
.provider-badge--small .provider-badge__name {
  font-size: 12px;
}
/* When brand colour is available, tint the border to make the row scannable. */
.provider-badge[style*='--provider-brand'] {
  border-color: var(--provider-brand);
}
</style>
