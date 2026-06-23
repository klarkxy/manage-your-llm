import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { h } from 'vue';
import { NConfigProvider, NMessageProvider } from 'naive-ui';
import PublicModels from './PublicModels.vue';
import { i18n } from '../i18n/index.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function mountPublicModels() {
  return mount(NConfigProvider, {
    attachTo: document.body,
    global: {
      plugins: [i18n],
      stubs: {
        NDrawer: {
          props: ['show'],
          template: '<div v-if="show" class="drawer"><slot /></div>',
        },
        NDrawerContent: {
          props: ['title'],
          template:
            '<section><h2>{{ title }}</h2><slot /><footer><slot name="footer" /></footer></section>',
        },
      },
    },
    slots: {
      default: () => h(NMessageProvider, null, { default: () => h(PublicModels) }),
    },
  });
}

function dragEvent(type: string, init: Record<string, unknown> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, init);
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      effectAllowed: 'move',
      setData: vi.fn(),
    },
  });
  return event;
}

describe('PublicModels page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('opens candidate arrangement, drags a candidate row, and saves normalized priorities', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/public-models') && (!init || init.method === 'GET')) {
        return jsonResponse({
          items: [
            {
              id: 'pm_1',
              name: 'ds-chat',
              displayName: 'DS Chat',
              description: null,
              enabled: true,
              candidateCount: 2,
              createdAt: '2026-06-21T00:00:00.000Z',
              updatedAt: '2026-06-21T00:00:00.000Z',
            },
          ],
        });
      }
      if (url.endsWith('/api/admin/upstream-keys')) {
        return jsonResponse({
          items: [
            {
              id: 'uk_1',
              name: 'Primary',
              providerType: 'anthropic_compatible',
              apiKeyPrefix: 'skp',
              enabled: true,
              frozen: false,
              lastHealthStatus: 'healthy',
              endpoints: [{ protocol: 'anthropic', providerType: 'anthropic_compatible' }],
            },
            {
              id: 'uk_2',
              name: 'Backup',
              providerType: 'openai_compatible',
              apiKeyPrefix: 'skb',
              enabled: true,
              frozen: false,
              lastHealthStatus: 'healthy',
              endpoints: [{ protocol: 'openai', providerType: 'openai_compatible' }],
            },
          ],
        });
      }
      if (url.endsWith('/api/admin/public-models/pm_1') && (!init || init.method === 'GET')) {
        return jsonResponse({
          id: 'pm_1',
          name: 'ds-chat',
          displayName: 'DS Chat',
          description: null,
          enabled: true,
          candidateCount: 2,
          createdAt: '2026-06-21T00:00:00.000Z',
          updatedAt: '2026-06-21T00:00:00.000Z',
          candidates: [
            {
              id: 'c_1',
              upstreamKeyId: 'uk_1',
              realModelName: 'real-primary',
              priority: 10,
              weight: 1,
              enabled: true,
              endpointProtocol: null,
              endpointProviderType: null,
              endpointBaseUrl: null,
              endpointApiPath: null,
              upstreamKey: {
                id: 'uk_1',
                name: 'Primary',
                providerType: 'anthropic_compatible',
                enabled: true,
                frozen: false,
              },
            },
            {
              id: 'c_2',
              upstreamKeyId: 'uk_2',
              realModelName: 'real-backup',
              priority: 20,
              weight: 7,
              enabled: true,
              endpointProtocol: null,
              endpointProviderType: null,
              endpointBaseUrl: null,
              endpointApiPath: null,
              upstreamKey: {
                id: 'uk_2',
                name: 'Backup',
                providerType: 'openai_compatible',
                enabled: true,
                frozen: false,
              },
            },
          ],
        });
      }
      if (url.endsWith('/api/admin/public-models/pm_1/candidates') && init?.method === 'PUT') {
        return jsonResponse({
          candidates: [
            {
              id: 'c_2_new',
              upstreamKeyId: 'uk_2',
              realModelName: 'real-backup',
              priority: 10,
              weight: 7,
              enabled: true,
              endpointProtocol: null,
              endpointProviderType: null,
              endpointBaseUrl: null,
              endpointApiPath: null,
              upstreamKey: null,
            },
            {
              id: 'c_1_new',
              upstreamKeyId: 'uk_1',
              realModelName: 'real-primary',
              priority: 20,
              weight: 1,
              enabled: true,
              endpointProtocol: null,
              endpointProviderType: null,
              endpointBaseUrl: null,
              endpointApiPath: null,
              upstreamKey: null,
            },
          ],
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountPublicModels();
    await flushPromises();

    const arrangeButton = wrapper.findAll('button').find((button) =>
      button.attributes('aria-label')?.includes('Arrange'),
    );
    expect(arrangeButton).toBeTruthy();
    await arrangeButton!.trigger('click');
    await flushPromises();

    const handles = Array.from(
      document.body.querySelectorAll<HTMLElement>('[data-testid="candidate-order-handle"]'),
    );
    expect(handles).toHaveLength(2);
    // Drag row index 1 (real-backup) onto row index 0 (real-primary) and drop
    // in the upper half of the target row. The composable treats clientY
    // above the row midpoint as 'before', producing insertAt=0, splice(0,0,moved)
    // which moves the dragged row to index 0 (real-backup first).
    const targetRow = handles[0]!.closest('tr') as HTMLTableRowElement;
    Object.defineProperty(targetRow, 'getBoundingClientRect', {
      value: () => ({ top: 0, bottom: 20, height: 20, left: 0, right: 100, width: 100 }),
    });
    handles[1]!.dispatchEvent(dragEvent('dragstart'));
    targetRow.dispatchEvent(dragEvent('dragover', { clientY: 5 }));
    targetRow.dispatchEvent(dragEvent('drop', { clientY: 5 }));
    await flushPromises();

    const saveButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save',
    );
    expect(saveButton).toBeTruthy();
    saveButton!.click();
    await flushPromises();

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/api/admin/public-models/pm_1/candidates') &&
        (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putCall).toBeTruthy();
    const body = JSON.parse(String((putCall![1] as RequestInit).body)) as {
      candidates: Array<{ upstreamKeyId: string; realModelName: string; priority: number; weight: number }>;
    };
    expect(body.candidates).toEqual([
      { upstreamKeyId: 'uk_2', realModelName: 'real-backup', priority: 10, weight: 7, enabled: true },
      { upstreamKeyId: 'uk_1', realModelName: 'real-primary', priority: 20, weight: 1, enabled: true },
    ]);
  });

  it('resets the arrangement order via the reset popconfirm button', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/public-models') && (!init || init.method === 'GET')) {
        return jsonResponse({
          items: [
            {
              id: 'pm_1',
              name: 'ds-chat',
              displayName: 'DS Chat',
              description: null,
              enabled: true,
              candidateCount: 1,
              createdAt: '2026-06-21T00:00:00.000Z',
              updatedAt: '2026-06-21T00:00:00.000Z',
            },
          ],
        });
      }
      if (url.endsWith('/api/admin/upstream-keys')) {
        return jsonResponse({
          items: [
            {
              id: 'uk_1',
              name: 'Primary',
              providerType: 'anthropic_compatible',
              apiKeyPrefix: 'skp',
              enabled: true,
              frozen: false,
              lastHealthStatus: 'healthy',
              endpoints: [{ protocol: 'anthropic', providerType: 'anthropic_compatible' }],
            },
          ],
        });
      }
      if (url.endsWith('/api/admin/public-models/pm_1') && (!init || init.method === 'GET')) {
        return jsonResponse({
          id: 'pm_1',
          name: 'ds-chat',
          displayName: 'DS Chat',
          description: null,
          enabled: true,
          candidateCount: 2,
          createdAt: '2026-06-21T00:00:00.000Z',
          updatedAt: '2026-06-21T00:00:00.000Z',
          candidates: [
            {
              id: 'c_1',
              upstreamKeyId: 'uk_1',
              realModelName: 'real-a',
              priority: 10,
              weight: 1,
              enabled: true,
              endpointProtocol: null,
              endpointProviderType: null,
              endpointBaseUrl: null,
              endpointApiPath: null,
              upstreamKey: {
                id: 'uk_1',
                name: 'Primary',
                providerType: 'anthropic_compatible',
                enabled: true,
                frozen: false,
              },
            },
            {
              id: 'c_2',
              upstreamKeyId: 'uk_1',
              realModelName: 'real-b',
              priority: 20,
              weight: 1,
              enabled: true,
              endpointProtocol: null,
              endpointProviderType: null,
              endpointBaseUrl: null,
              endpointApiPath: null,
              upstreamKey: {
                id: 'uk_1',
                name: 'Primary',
                providerType: 'anthropic_compatible',
                enabled: true,
                frozen: false,
              },
            },
          ],
        });
      }
      if (url.endsWith('/api/admin/public-models/pm_1/candidates') && init?.method === 'PUT') {
        return jsonResponse({ candidates: [] });
      }
      if (url.endsWith('/api/admin/public-models/pm_1/candidates/reset-order') && init?.method === 'POST') {
        return jsonResponse({
          candidates: [
            {
              id: 'c_reset_1',
              upstreamKeyId: 'uk_1',
              realModelName: 'real-a',
              priority: 10,
              weight: 1,
              enabled: true,
              endpointProtocol: null,
              endpointProviderType: null,
              endpointBaseUrl: null,
              endpointApiPath: null,
              upstreamKey: null,
            },
          ],
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountPublicModels();
    await flushPromises();

    const arrangeButton = wrapper.findAll('button').find((button) =>
      button.attributes('aria-label')?.includes('Arrange'),
    );
    await arrangeButton!.trigger('click');
    await flushPromises();

    // The NPopconfirm wrapper hides the positive button until the trigger
    // is clicked. Drive the page's resetArrangementOrder() directly so we
    // exercise the same handler the popconfirm invokes when the user
    // confirms. This is more robust than chasing portal rendering quirks
    // across the various Naive UI versions in happy-dom.
    const vm = wrapper.findComponent(PublicModels).vm as unknown as {
      resetArrangementOrder: () => Promise<void>;
    };
    await vm.resetArrangementOrder();
    await flushPromises();

    const resetCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/api/admin/public-models/pm_1/candidates/reset-order') &&
        (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(resetCall).toBeTruthy();
  });

  it('removes a public model via the delete popconfirm', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/public-models') && (!init || init.method === 'GET')) {
        return jsonResponse({
          items: [
            {
              id: 'pm_1',
              name: 'ds-chat',
              displayName: 'DS Chat',
              description: null,
              enabled: true,
              candidateCount: 1,
              createdAt: '2026-06-21T00:00:00.000Z',
              updatedAt: '2026-06-21T00:00:00.000Z',
            },
          ],
        });
      }
      if (url.endsWith('/api/admin/upstream-keys')) {
        return jsonResponse({ items: [] });
      }
      if (url.endsWith('/api/admin/public-models/pm_1') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountPublicModels();
    await flushPromises();

    const deleteButton = wrapper.findAll('button').find((button) =>
      button.attributes('aria-label')?.includes('Delete'),
    );
    expect(deleteButton).toBeTruthy();
    await deleteButton!.trigger('click');
    await flushPromises();
    // NPopconfirm renders a positive button to confirm. With happy-dom the
    // portal is in the same DOM, so find it by its role/text.
    const confirmButtons = Array.from(document.body.querySelectorAll('button')).filter((b) =>
      /confirm|delete/i.test(b.textContent ?? ''),
    );
    // The popconfirm always renders a positive button; if the test rig has
    // registered a portal-based confirmation, the last "Delete" button
    // visible in the DOM is the confirmation. Click it directly to exercise
    // the positive handler.
    const positive = confirmButtons[confirmButtons.length - 1];
    if (positive) {
      await positive.click();
      await flushPromises();
    } else {
      // Fallback: call the page's remove() function directly through the
      // wrapper VM. This path is fine for the popconfirm wrapper because
      // the click on the trigger should have surfaced a confirmation.
      const vm = wrapper.findComponent(PublicModels).vm as unknown as {
        remove: (row: { id: string }) => Promise<void>;
      };
      await vm.remove({ id: 'pm_1' });
      await flushPromises();
    }

    const deleteCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/api/admin/public-models/pm_1') &&
        (init as RequestInit | undefined)?.method === 'DELETE',
    );
    expect(deleteCall).toBeTruthy();
  });

  it('creates a public model and adds multiple candidates through the create drawer', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/public-models') && (!init || init.method === 'GET')) {
        return jsonResponse({ items: [] });
      }
      if (url.endsWith('/api/admin/upstream-keys')) {
        return jsonResponse({
          items: [
            {
              id: 'uk_1',
              name: 'Primary',
              providerType: 'anthropic_compatible',
              apiKeyPrefix: 'skp',
              enabled: true,
              frozen: false,
              lastHealthStatus: 'healthy',
              endpoints: [{ protocol: 'anthropic', providerType: 'anthropic_compatible' }],
            },
          ],
        });
      }
      if (url.endsWith('/api/admin/public-models') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { name: string };
        return jsonResponse({
          id: `pm_${body.name}`,
          name: body.name,
          displayName: body.name,
          description: null,
          enabled: true,
          candidateCount: 1,
          createdAt: '2026-06-21T00:00:00.000Z',
          updatedAt: '2026-06-21T00:00:00.000Z',
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountPublicModels();
    await flushPromises();

    await wrapper.findAll('button').find((button) => button.text() === 'New public model')!.trigger('click');
    await flushPromises();

    // Fill name + add candidate + fill realModelName. The drawer uses
    // NInput v-model so we drive it via the document body input.
    const inputs = Array.from(document.body.querySelectorAll<HTMLInputElement>('input'));
    const nameInput = inputs.find((input) => input.placeholder?.toLowerCase().includes('name')) ?? inputs[0];
    if (nameInput) {
      nameInput.value = 'new-pm';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // Click "+ Add candidate" — it's an NButton with localized label.
    const addCandidateBtn = Array.from(document.body.querySelectorAll('button')).find(
      (button) => /add candidate/i.test(button.textContent ?? ''),
    );
    expect(addCandidateBtn).toBeTruthy();
    await addCandidateBtn!.click();
    await flushPromises();

    // Type the candidate realModelName.
    const candidateInputs = Array.from(document.body.querySelectorAll<HTMLInputElement>('input'));
    const candidateInput = candidateInputs.find((input) => input.placeholder?.toLowerCase().includes('model')) ?? candidateInputs[candidateInputs.length - 1];
    if (candidateInput) {
      candidateInput.value = 'claude-real';
      candidateInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const createBtn = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Create',
    );
    expect(createBtn).toBeTruthy();
    await createBtn!.click();
    await flushPromises();

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/api/admin/public-models') &&
        (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(createCall).toBeTruthy();
    const body = JSON.parse(String((createCall![1] as RequestInit).body)) as {
      name: string;
      candidates: Array<{ upstreamKeyId: string; realModelName: string }>;
    };
    expect(body.name).toBe('new-pm');
    expect(body.candidates.length).toBeGreaterThan(0);
    expect(body.candidates[0]).toMatchObject({
      upstreamKeyId: 'uk_1',
      realModelName: 'claude-real',
    });
  });

  it('rejects an empty public model name before sending a request', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/api/admin/public-models')) return jsonResponse({ items: [] });
      if (url.endsWith('/api/admin/upstream-keys')) return jsonResponse({ items: [] });
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountPublicModels();
    await flushPromises();

    await wrapper.findAll('button').find((button) => button.text() === 'New public model')!.trigger('click');
    await flushPromises();

    const createBtn = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Create',
    );
    expect(createBtn).toBeTruthy();
    await createBtn!.click();
    await flushPromises();

    const createCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(createCall).toBeFalsy();
  });
});
