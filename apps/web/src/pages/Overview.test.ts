import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { NConfigProvider } from "naive-ui";
import Overview from "./Overview.vue";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Overview page", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the active / frozen upstream key counts after data loads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith("/apps")) return jsonResponse({ items: [] });
        if (url.endsWith("/model-groups")) return jsonResponse({ items: [] });
        if (url.endsWith("/public-models")) return jsonResponse({ items: [] });
        if (url.endsWith("/upstream-keys")) {
          return jsonResponse({
            items: [
              { id: "uk_1", name: "A", enabled: true, frozen: false },
              { id: "uk_2", name: "B", enabled: true, frozen: false },
              { id: "uk_3", name: "C", enabled: false, frozen: true },
              { id: "uk_4", name: "D", enabled: true, frozen: true },
            ],
          });
        }
        return jsonResponse({});
      }),
    );

    const wrapper = mount(NConfigProvider, { slots: { default: Overview } });
    await flushPromises();
    expect(wrapper.text()).toMatch(/active\s*2/);
    expect(wrapper.text()).toMatch(/frozen\s*2/);
  });
});
