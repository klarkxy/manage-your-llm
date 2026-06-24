import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { NConfigProvider } from 'naive-ui';
import Overview from './Overview.vue';
import { i18n } from '../i18n/index.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function mountOverview() {
  setActivePinia(createPinia());
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'overview', component: Overview },
      { path: '/upstream-keys', name: 'upstream-keys', component: { template: '<div>keys</div>' } },
      { path: '/public-models', name: 'public-models', component: { template: '<div>models</div>' } },
      { path: '/apps', name: 'apps', component: { template: '<div>apps</div>' } },
    ],
  });
  return {
    wrapper: mount(NConfigProvider, {
      global: { plugins: [router, i18n] },
      slots: { default: Overview },
    }),
    router,
  };
}

describe('Overview page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('renders the active / frozen upstream key counts after data loads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/apps')) return jsonResponse({ items: [] });
        if (url.endsWith('/model-groups')) return jsonResponse({ items: [] });
        if (url.endsWith('/public-models')) return jsonResponse({ items: [] });
        if (url.endsWith('/upstream-keys')) {
          return jsonResponse({
            items: [
              { id: 'uk_1', name: 'A', enabled: true, frozen: false },
              { id: 'uk_2', name: 'B', enabled: true, frozen: false },
              { id: 'uk_3', name: 'C', enabled: false, frozen: true },
              { id: 'uk_4', name: 'D', enabled: true, frozen: true },
            ],
          });
        }
        return jsonResponse({});
      }),
    );

    const { wrapper } = mountOverview();
    await flushPromises();
    expect(wrapper.text()).toMatch(/active\s*2/);
    expect(wrapper.text()).toMatch(/frozen\s*2/);
  });

  it('shows zeros on every stat card when the API returns empty lists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (
          url.endsWith('/apps') ||
          url.endsWith('/model-groups') ||
          url.endsWith('/public-models') ||
          url.endsWith('/upstream-keys') ||
          url.includes('/consumption/daily')
        ) {
          return jsonResponse({ items: [] });
        }
        return jsonResponse({});
      }),
    );

    const { wrapper } = mountOverview();
    await flushPromises();
    expect(wrapper.text()).toMatch(/active\s*0/);
    expect(wrapper.text()).toMatch(/frozen\s*0/);
  });

  it('renders both usage chart cards with empty state when no consumption data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (
          url.endsWith('/apps') ||
          url.endsWith('/model-groups') ||
          url.endsWith('/public-models') ||
          url.endsWith('/upstream-keys') ||
          url.includes('/consumption/daily')
        ) {
          return jsonResponse({ items: [] });
        }
        return jsonResponse({});
      }),
    );

    const { wrapper } = mountOverview();
    await flushPromises();
    // Both chart card titles are present in the DOM.
    expect(wrapper.text()).toContain('Requests (last 30 days)');
    expect(wrapper.text()).toContain('Token consumption (last 30 days)');
    // Empty state hint is shown when there's no data.
    expect(wrapper.text()).toContain('No usage recorded yet');
  });

  it('places the public-endpoints card before the usage chart cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (
          url.endsWith('/apps') ||
          url.endsWith('/model-groups') ||
          url.endsWith('/public-models') ||
          url.endsWith('/upstream-keys') ||
          url.includes('/consumption/daily')
        ) {
          return jsonResponse({ items: [] });
        }
        if (url.endsWith('/api/admin/settings')) {
          return jsonResponse({
            circuitBreaker: {},
            endpointHealth: {},
            streaming: {},
            contentLogging: {},
            modelReference: { autoPreset: 'balanced', autoWeights: {}, autoTopN: 5 },
            publicEndpoints: {
              basePath: '/v1',
              baseUrl: 'http://localhost:5420',
              endpoints: {
                messages: 'http://localhost:5420/v1/messages',
                chatCompletions: 'http://localhost:5420/v1/chat/completions',
                responses: 'http://localhost:5420/v1/responses',
                models: 'http://localhost:5420/v1/models',
              },
            },
          });
        }
        return jsonResponse({});
      }),
    );

    const { wrapper } = mountOverview();
    await flushPromises();
    const text = wrapper.text();
    const peIdx = text.indexOf('Public endpoints');
    const reqIdx = text.indexOf('Requests (last 30 days)');
    const tokIdx = text.indexOf('Token consumption (last 30 days)');
    expect(peIdx).toBeGreaterThan(-1);
    expect(reqIdx).toBeGreaterThan(-1);
    expect(tokIdx).toBeGreaterThan(-1);
    // Public Endpoints sits between the stat grid and the chart cards.
    expect(peIdx).toBeLessThan(reqIdx);
    expect(peIdx).toBeLessThan(tokIdx);
  });

  it('aggregates app / public-model / model-group counts on the stat cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/apps')) {
          return jsonResponse({
            items: [
              { id: 'a_1', name: 'A' },
              { id: 'a_2', name: 'B' },
            ],
          });
        }
        if (url.endsWith('/model-groups')) {
          return jsonResponse({
            items: [
              { id: 'mg_1', name: 'auto-coder', displayName: 'Auto Coder', memberCount: 4 },
            ],
          });
        }
        if (url.endsWith('/public-models')) {
          return jsonResponse({
            items: [
              { id: 'pm_1', name: 'gpt-4o', displayName: 'GPT-4o', candidateCount: 3 },
            ],
          });
        }
        if (url.endsWith('/upstream-keys')) return jsonResponse({ items: [] });
        return jsonResponse({ items: [] });
      }),
    );

    const { wrapper } = mountOverview();
    await flushPromises();
    // Stat cards render their label + value. Pull the count by looking
    // for the pattern "Apps<N>" / "Public models<N>" / "Model groups<N>".
    const text = wrapper.text();
    expect(text).toMatch(/Apps\s*2/);
    expect(text).toMatch(/Public models\s*1/);
    expect(text).toMatch(/Model groups\s*1/);
  });
});
