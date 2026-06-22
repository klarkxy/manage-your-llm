import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/Login.vue'),
    meta: { standalone: true },
  },
  {
    path: '/',
    name: 'overview',
    component: () => import('../pages/Overview.vue'),
  },
  {
    path: '/upstream-keys',
    name: 'upstream-keys',
    component: () => import('../pages/UpstreamKeys.vue'),
  },
  {
    path: '/oauth/callback',
    name: 'oauth-callback',
    component: () => import('../pages/OAuthCallback.vue'),
    meta: { standalone: true },
  },
  {
    path: '/auth/callback',
    name: 'oauth-callback-alias',
    component: () => import('../pages/OAuthCallback.vue'),
    meta: { standalone: true },
  },
  {
    path: '/public-models',
    name: 'public-models',
    component: () => import('../pages/PublicModels.vue'),
  },
  {
    path: '/model-groups',
    name: 'model-groups',
    component: () => import('../pages/ModelGroups.vue'),
  },
  {
    path: '/model-reference',
    name: 'model-reference',
    component: () => import('../pages/ModelReference.vue'),
  },
  {
    path: '/apps',
    name: 'apps',
    component: () => import('../pages/Apps.vue'),
  },
  {
    path: '/usage',
    name: 'usage',
    component: () => import('../pages/Usage.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../pages/Settings.vue'),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) {
    try {
      await auth.fetchMe();
    } catch {
      auth.$patch({ user: null, ready: true });
    }
  }
  if (to.name === 'login') {
    if (auth.isAuthenticated) {
      return { name: 'overview' };
    }
    return true;
  }
  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});
