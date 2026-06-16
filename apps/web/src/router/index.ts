import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "overview",
    component: () => import("../pages/Overview.vue"),
  },
  {
    path: "/upstream-keys",
    name: "upstream-keys",
    component: () => import("../pages/UpstreamKeys.vue"),
  },
  {
    path: "/public-models",
    name: "public-models",
    component: () => import("../pages/PublicModels.vue"),
  },
  {
    path: "/model-groups",
    name: "model-groups",
    component: () => import("../pages/ModelGroups.vue"),
  },
  {
    path: "/apps",
    name: "apps",
    component: () => import("../pages/Apps.vue"),
  },
  {
    path: "/usage",
    name: "usage",
    component: () => import("../pages/Usage.vue"),
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("../pages/Settings.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});