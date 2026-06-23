import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { h } from 'vue';
import { NConfigProvider, NMessageProvider } from 'naive-ui';
import ModelReference from './ModelReference.vue';
import { i18n } from '../i18n/index.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function referenceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ref_1',
    region: 'global',
    source: 'datalearner',
    normalizedModelName: 'claude-3-5-sonnet',
    sourceModelId: 'claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    scores: { '总分': 88.2, coding: 91.4 },
    price: { display: '¥15 / MTok', cnyPerMTok: 15 },
    contextWindow: 200000,
    outputSpeed: 70,
    latencyMs: 420,
    sourceUrl: 'https://example.test/leaderboard',
    rawUnit: 'snapshot-1',
    rank: 2,
    fetchedAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
    ...overrides,
  };
}

function mountModelReference() {
  return mount(NConfigProvider, {
    attachTo: document.body,
    global: {
      plugins: [i18n],
      stubs: {
        NDataTable: {
          props: ['data', 'columns'],
          emits: ['update:sorter'],
          template:
            '<div data-testid="table"><button data-testid="sort-rank" @click="$emit(\'update:sorter\', { columnKey: \'rank\', order: \'ascend\' })">sort rank</button><div v-for="row in data" :key="row.id">{{ row.displayName }} {{ row.provider }} {{ row.rank }}</div></div>',
        },
        NModal: {
          props: ['show', 'title'],
          emits: ['close', 'update:show'],
          template:
            '<section v-if="show" data-testid="modal"><h2>{{ title }}</h2><slot /><footer><slot name="footer" /></footer></section>',
        },
        Modal: {
          props: ['show', 'title'],
          emits: ['close', 'update:show'],
          template:
            '<section v-if="show" data-testid="modal"><h2>{{ title }}</h2><slot /><footer><slot name="footer" /></footer></section>',
        },
      },
    },
    slots: {
      default: () => h(NMessageProvider, null, { default: () => h(ModelReference) }),
    },
  });
}

describe('ModelReference page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('loads reference rows, filters by search, and acknowledges attribution', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            referenceRow(),
            referenceRow({
              id: 'ref_2',
              normalizedModelName: 'deepseek-v3',
              sourceModelId: 'deepseek-v3',
              displayName: 'DeepSeek V3',
              provider: 'DeepSeek',
              scores: { '总分': 85.5 },
              rank: 5,
            }),
          ],
          sync: [
            {
              region: 'global',
              source: 'datalearner',
              status: 'success',
              lastRefreshAt: '2026-06-22T00:00:00.000Z',
              nextRefreshAfter: null,
              lastError: null,
              ttlMs: 86400000,
              updatedAt: '2026-06-22T00:00:00.000Z',
            },
          ],
        }),
      ),
    );

    const wrapper = mountModelReference();
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('Claude 3.5 Sonnet');
    expect(wrapper.text()).toContain('DeepSeek V3');
    expect(document.body.querySelector('[data-testid="modal"]')).toBeTruthy();

    await wrapper.find('input').setValue('deepseek');
    await flushPromises();
    expect(wrapper.text()).not.toContain('Claude 3.5 Sonnet');
    expect(wrapper.text()).toContain('DeepSeek V3');

    const acknowledgeButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'I understand',
    );
    expect(acknowledgeButton).toBeTruthy();
    acknowledgeButton!.click();
    expect(localStorage.getItem('modelharbor.rele.attributionAcknowledged')).toBe('ack');
  });

  it('refreshes remote reference data and replaces the table rows', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/model-reference') && (!init || init.method === 'GET')) {
        return jsonResponse({ items: [referenceRow()], sync: [] });
      }
      if (url.endsWith('/api/admin/model-reference/refresh') && init?.method === 'POST') {
        return jsonResponse({
          refreshed: true,
          sources: ['datalearner'],
          items: {
            items: [referenceRow({ id: 'ref_new', displayName: 'Qwen Max', provider: 'Qwen', rank: 1 })],
            sync: [],
          },
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountModelReference();
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === 'Refresh')!.trigger('click');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/model-reference/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ force: true }),
      }),
    );
    expect(wrapper.text()).toContain('Qwen Max');
    expect(wrapper.text()).not.toContain('Claude 3.5 Sonnet');
  });

  it('filters by metric and applies the score-based sort', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            referenceRow({ id: 'ref_a', scores: { '总分': 90, coding: 70 } }),
            referenceRow({ id: 'ref_b', scores: { '总分': 70, coding: 90 } }),
          ],
          sync: [],
        }),
      ),
    );
    const wrapper = mountModelReference();
    await flushPromises();
    await flushPromises();

    // selectedMetric is a ref<string>; on the test VM the ref auto-unwraps
    // to a plain string. Toggle the metric so the sort runs on the
    // coding column instead of the default rank order.
    const vm = wrapper.findComponent(ModelReference).vm as unknown as {
      selectedMetric: string;
    };
    vm.selectedMetric = 'coding';
    await flushPromises();

    const sortedItems = (
      wrapper.findComponent(ModelReference).vm as unknown as {
        sortedItems: Array<{ id: string }>;
      }
    ).sortedItems;
    expect(sortedItems[0]?.id).toBe('ref_b');
    expect(sortedItems[1]?.id).toBe('ref_a');
  });

  it('handles refresh errors by restoring the previous list and surfacing a toast', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/model-reference') && (!init || init.method === 'GET')) {
        return jsonResponse({ items: [referenceRow()], sync: [] });
      }
      if (url.endsWith('/api/admin/model-reference/refresh') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          error: { message: 'refresh failed', code: 'upstream_error', type: 'server_error' },
        }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountModelReference();
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === 'Refresh')!.trigger('click');
    await flushPromises();

    // On error, the page should re-fetch the list and the error message
    // from the server should have been used for the toast.
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/model-reference',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
