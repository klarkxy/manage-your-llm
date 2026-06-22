import { h, type VNode, type Component } from 'vue';
import { NIcon } from 'naive-ui';
import {
  GridOutline,
  KeyOutline,
  CubeOutline,
  LayersOutline,
  StatsChartOutline,
  GitNetworkOutline,
  PulseOutline,
  SettingsOutline,
} from '@vicons/ionicons5';

/**
 * Render helpers for the sidebar menu icons. `icon()` returns a thunk that
 * builds an `NIcon`, matching Naive UI's `MenuOption.icon` (`() => VNode`).
 */
function icon(component: Component): () => VNode {
  return () => h(NIcon, null, { default: () => h(component) });
}

export const menuIcons: Record<string, () => VNode> = {
  overview: icon(GridOutline),
  'upstream-keys': icon(KeyOutline),
  'public-models': icon(CubeOutline),
  'model-groups': icon(LayersOutline),
  'model-reference': icon(StatsChartOutline),
  apps: icon(GitNetworkOutline),
  usage: icon(PulseOutline),
  settings: icon(SettingsOutline),
};