import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { NConfigProvider } from "naive-ui";
import AdminLayout from "../layouts/AdminLayout.vue";

function mountApp() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "overview", component: { template: "<div>overview</div>" } },
      { path: "/upstream-keys", name: "upstream-keys", component: { template: "<div>keys</div>" } },
    ],
  });
  return mount(NConfigProvider, {
    global: {
      plugins: [router],
    },
    slots: {
      default: AdminLayout,
    },
  });
}

describe("AdminLayout smoke", () => {
  it("renders the brand name", async () => {
    const wrapper = mountApp();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("ModelHarbor");
  });
});