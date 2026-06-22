<script setup lang="ts">
/**
 * Visual drag handle for table rows. Renders the grip pattern and provides the
 * `order-handle` / `order-grip` classes that the shared styles in App.vue
 * theme.
 */
</script>

<template>
  <span class="order-handle" role="button" aria-label="Drag to reorder">
    <span class="order-grip" />
  </span>
</template>
