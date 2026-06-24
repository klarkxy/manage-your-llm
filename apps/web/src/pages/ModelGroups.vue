<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NButton,
  NCard,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NSwitch,
  NTag,
  NText,
  NPopconfirm,
  NTooltip,
  useMessage,
  type DataTableColumns,
} from 'naive-ui';
import { ReorderFourOutline } from '@vicons/ionicons5';
import {
  modelGroupsApi,
  publicModelsApi,
  type AutoGroupRecommendation,
  type ModelGroup,
  type ModelGroupCreatePayload,
  type ModelGroupMember,
  type PublicModel,
} from '../api/admin.js';
import { useDraggableList } from '../composables/useDraggableList.js';

const message = useMessage();
const { t } = useI18n();

const items = ref<ModelGroup[]>([]);
const publicModelOptions = ref<PublicModel[]>([]);
const loading = ref(false);
const drawerOpen = ref(false);
const submitting = ref(false);
const previewLoading = ref(false);
const autoPreview = ref<AutoGroupRecommendation[]>([]);

// Detail drawer state — opened when a table row is clicked. The
// drawer shows the existing members of the group with per-row
// enable/disable toggles plus a "Load 5 more" button when the group
// is in auto mode.
const detailOpen = ref(false);
const detailGroup = ref<ModelGroup | null>(null);
const detailLoading = ref(false);
const detailTogglingId = ref<string | null>(null);
const detailLoadingMore = ref(false);

const form = ref<ModelGroupCreatePayload>({
  name: '',
  displayName: '',
  description: '',
  routingPolicy: 'priority',
  mode: 'manual',
  autoPreset: 'balanced',
  autoTopN: 5,
});
const memberRows = ref<Array<{ publicModelId: string; priority: number; weight: number }>>([]);

// Drag-and-drop for the "members" list inside the drawer. Reorder is local —
// the per-group Save button persists the new order along with the rest of the
// payload.
const memberDrag = useDraggableList<
  { publicModelId: string; priority: number; weight: number }
>(memberRows, () => undefined, { prefix: 'drag' });

function resetForm() {
  form.value = {
    name: '',
    displayName: '',
    description: '',
    routingPolicy: 'priority',
    mode: 'manual',
    autoPreset: 'balanced',
    autoTopN: 5,
  };
  memberRows.value = [];
  autoPreview.value = [];
}

async function refresh() {
  loading.value = true;
  try {
    const [res, pmRes] = await Promise.all([
      modelGroupsApi.list(),
      publicModelsApi.list(),
    ]);
    items.value = res.items;
    publicModelOptions.value = pmRes.items;
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);

function openCreate() {
  resetForm();
  drawerOpen.value = true;
}

function addMember() {
  if (publicModelOptions.value.length === 0) {
    message.warning(t('modelGroups.toast.createPublicModelFirst'));
    return;
  }
  memberRows.value.push({
    publicModelId: publicModelOptions.value[0]!.id,
    priority: (memberRows.value.length + 1) * 10,
    weight: 1,
  });
}

function removeMember(idx: number) {
  memberRows.value.splice(idx, 1);
}

async function onSubmit() {
  if (!form.value.name) {
    message.error(t('modelGroups.validation.required'));
    return;
  }
  submitting.value = true;
  try {
    const payload: ModelGroupCreatePayload = {
      name: form.value.name.trim(),
      displayName: form.value.displayName?.trim() || undefined,
      description: form.value.description?.trim() || undefined,
      routingPolicy: form.value.routingPolicy,
      mode: form.value.mode,
      ...(form.value.mode === 'auto_snapshot'
        ? {
            autoPreset: form.value.autoPreset,
            autoTopN: form.value.autoTopN,
          }
        : {
            members: memberRows.value.map((m, idx) => ({
              publicModelId: m.publicModelId,
              priority: (idx + 1) * 10,
              weight: 1,
            })),
          }),
    };
    const created = await modelGroupsApi.create(payload);
    items.value = [created, ...items.value];
    drawerOpen.value = false;
    message.success(t('modelGroups.toast.created'));
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    submitting.value = false;
  }
}

async function previewAutoMembers() {
  if (form.value.mode !== 'auto_snapshot') return;
  previewLoading.value = true;
  try {
    const res = await modelGroupsApi.autoPreview({
      preset: form.value.autoPreset ?? 'balanced',
      topN: form.value.autoTopN ?? 5,
    });
    autoPreview.value = res.items;
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    previewLoading.value = false;
  }
}

/**
 * Extend the auto-preview list in the create drawer by 5 more rows
 * ranked under the same preset, skipping any public model ids that
 * are already in the current preview. Used so the admin can "see
 * further down the list" before committing to a top-N.
 */
async function previewAutoMore() {
  if (form.value.mode !== 'auto_snapshot') return;
  previewLoading.value = true;
  try {
    const exclude = new Set(autoPreview.value.map((r) => r.publicModelId));
    const currentTop = autoPreview.value.length;
    const res = await modelGroupsApi.autoPreview({
      preset: form.value.autoPreset ?? 'balanced',
      // Request current + 5 more; the API call here is non-exclusive
      // (preview is informational), so we post-filter on the client
      // for the "5 more after the current preview" UX.
      topN: currentTop + 5 + exclude.size,
    });
    const fresh = res.items
      .filter((r) => !exclude.has(r.publicModelId))
      .slice(0, 5);
    if (fresh.length === 0) {
      message.info(t('modelGroups.toast.noMoreMatches'));
      return;
    }
    autoPreview.value = [...autoPreview.value, ...fresh];
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    previewLoading.value = false;
  }
}

async function refreshAuto(row: ModelGroup) {
  try {
    const updated = await modelGroupsApi.refreshAuto(row.id);
    items.value = items.value.map((item) => (item.id === row.id ? updated : item));
    if (detailGroup.value && detailGroup.value.id === row.id) {
      detailGroup.value = updated;
    }
    message.success(t('modelGroups.toast.refreshed'));
  } catch (err) {
    message.error((err as Error).message);
  }
}

async function remove(row: ModelGroup) {
  try {
    await modelGroupsApi.remove(row.id);
    items.value = items.value.filter((i) => i.id !== row.id);
    message.success(t('modelGroups.toast.deleted'));
  } catch (err) {
    message.error((err as Error).message);
  }
}

async function openDetail(row: ModelGroup) {
  detailOpen.value = true;
  detailGroup.value = row;
  await loadDetail();
}

async function loadDetail() {
  if (!detailGroup.value) return;
  detailLoading.value = true;
  try {
    const full = await modelGroupsApi.get(detailGroup.value.id);
    detailGroup.value = full;
    // Keep the listing in sync (memberCount + autoLastRefreshedAt can
    // change after the user toggles members / loads more).
    items.value = items.value.map((i) => (i.id === full.id ? full : i));
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    detailLoading.value = false;
  }
}

async function toggleMember(member: ModelGroupMember, enabled: boolean) {
  if (!detailGroup.value) return;
  detailTogglingId.value = member.id;
  try {
    const res = await modelGroupsApi.toggleMember(detailGroup.value.id, member.id, enabled);
    // Patch the in-memory list in place so the toggle is instant, then
    // refresh the summary (member count, last-refreshed-at) from the
    // server to keep the listing in sync.
    if (detailGroup.value.members) {
      detailGroup.value = {
        ...detailGroup.value,
        members: detailGroup.value.members.map((m) =>
          m.id === member.id ? { ...m, enabled } : m,
        ),
      };
    }
    detailGroup.value = {
      ...detailGroup.value,
      memberCount: res.members.length,
      members: res.members,
    };
    items.value = items.value.map((i) =>
      i.id === detailGroup.value!.id ? detailGroup.value! : i,
    );
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    detailTogglingId.value = null;
  }
}

async function loadMoreDetail() {
  if (!detailGroup.value) return;
  detailLoadingMore.value = true;
  try {
    const res = await modelGroupsApi.loadMoreAuto(detailGroup.value.id);
    detailGroup.value = {
      ...detailGroup.value,
      memberCount: res.members.length,
      members: res.members,
    };
    items.value = items.value.map((i) =>
      i.id === detailGroup.value!.id ? detailGroup.value! : i,
    );
    if (res.added === 0) {
      message.info(t('modelGroups.toast.noMoreMatches'));
    } else {
      message.success(t('modelGroups.toast.loadedMore', { count: res.added }));
    }
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    detailLoadingMore.value = false;
  }
}

const columns = computed<DataTableColumns<ModelGroup>>(() => [
  { title: t('modelGroups.columns.name'), key: 'name', width: 220, sorter: true },
  { title: t('modelGroups.columns.displayName'), key: 'displayName', width: 200, sorter: true },
  {
    title: t('modelGroups.columns.mode'),
    key: 'mode',
    width: 110,
    sorter: true,
    render: (row) =>
      h(NTag, { size: 'small', type: row.mode === 'auto_snapshot' ? 'info' : 'default' }, () =>
        row.mode === 'auto_snapshot'
          ? t('modelGroups.status.autoSnapshot')
          : t('modelGroups.status.manual'),
      ),
  },
  { title: t('modelGroups.columns.members'), key: 'memberCount', width: 100, sorter: true },
  {
    title: t('modelGroups.columns.status'),
    key: 'enabled',
    width: 100,
    sorter: true,
    render: (row) =>
      row.enabled
        ? h(NTag, { type: 'success', size: 'small' }, () => t('modelGroups.status.enabled'))
        : h(NTag, { type: 'default', size: 'small' }, () => t('modelGroups.status.disabled')),
  },
  {
    title: t('modelGroups.columns.actions'),
    key: 'actions',
    width: 280,
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          { size: 'small', secondary: true, onClick: () => openDetail(row) },
          () => t('modelGroups.actions.view'),
        ),
        row.mode === 'auto_snapshot'
          ? h(
              NButton,
              { size: 'small', secondary: true, onClick: () => refreshAuto(row) },
              () => t('modelGroups.actions.refreshAuto'),
            )
          : null,
        h(
          NPopconfirm,
          { onPositiveClick: () => remove(row) },
          {
            trigger: () =>
              h(NButton, { size: 'small', type: 'error' }, () => t('modelGroups.actions.delete')),
            default: () => t('modelGroups.confirm', { name: row.name }),
          },
        ),
      ]),
  },
]);

const detailMemberColumns = computed<DataTableColumns<ModelGroupMember>>(() => [
  { title: t('modelGroups.drawer.members'), key: 'publicModelName' },
  { title: t('modelGroups.columns.priority'), key: 'priority', width: 90, sorter: 'default' },
  { title: t('modelGroups.columns.weight'), key: 'weight', width: 90 },
  {
    title: t('modelGroups.columns.enabled'),
    key: 'enabled',
    width: 100,
    render: (row) =>
      h(NSwitch, {
        value: row.enabled,
        loading: detailTogglingId.value === row.id,
        disabled: !detailGroup.value || detailGroup.value.mode !== 'auto_snapshot',
        onUpdateValue: (val: boolean) => toggleMember(row, val),
      }),
  },
]);

const modelOptions = computed(() =>
  publicModelOptions.value.map((m) => ({ label: m.name, value: m.id })),
);

const policyOptions = computed(() => [
  { label: t('modelGroups.drawer.policies.priority'), value: 'priority' },
  { label: t('modelGroups.drawer.policies.roundRobin'), value: 'round_robin' },
  { label: t('modelGroups.drawer.policies.random'), value: 'random' },
  { label: t('modelGroups.drawer.policies.weighted'), value: 'weighted' },
]);

const modeOptions = computed(() => [
  { label: t('modelGroups.drawer.manualMode'), value: 'manual' },
  { label: t('modelGroups.drawer.autoMode'), value: 'auto_snapshot' },
]);

const presetOptions = computed(() => [
  { label: t('modelGroups.drawer.presets.balanced'), value: 'balanced' },
  { label: t('modelGroups.drawer.presets.code'), value: 'code' },
  { label: t('modelGroups.drawer.presets.chat'), value: 'chat' },
  { label: t('modelGroups.drawer.presets.writing'), value: 'writing' },
  { label: t('modelGroups.drawer.presets.reasoning'), value: 'reasoning' },
  { label: t('modelGroups.drawer.presets.fast'), value: 'fast' },
]);

const previewColumns = computed<DataTableColumns<AutoGroupRecommendation>>(() => [
  { title: t('modelGroups.drawer.members'), key: 'publicModelName' },
  { title: 'Score', key: 'score', width: 90 },
  {
    title: t('modelReference.columns.source'),
    key: 'source',
    width: 120,
    render: (row) => row.reference.source,
  },
]);
</script>

<template>
  <div class="page">
    <NCard>
      <NSpace align="center" justify="space-between" style="margin-bottom: 16px">
        <NText strong>{{ t('modelGroups.title') }}</NText>
        <NButton type="primary" @click="openCreate">{{ t('modelGroups.new') }}</NButton>
      </NSpace>

      <NDataTable
        :columns="columns"
        :data="items"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        :row-key="(row) => row.id"
        :empty="h(NEmpty, { description: t('modelGroups.empty') })"
      />
    </NCard>

    <NDrawer v-model:show="drawerOpen" :width="520">
      <NDrawerContent :title="t('modelGroups.drawer.title')" closable>
        <NForm label-placement="top">
          <NFormItem :label="t('modelGroups.drawer.name')" required>
            <NInput
              v-model:value="form.name"
              :placeholder="t('modelGroups.drawer.placeholders.name')"
            />
          </NFormItem>
          <NFormItem :label="t('modelGroups.drawer.displayName')">
            <NInput
              v-model:value="form.displayName"
              :placeholder="t('modelGroups.drawer.placeholders.displayName')"
            />
          </NFormItem>
          <NFormItem :label="t('modelGroups.drawer.description')">
            <NInput v-model:value="form.description" type="textarea" :rows="2" />
          </NFormItem>
          <NFormItem :label="t('modelGroups.drawer.mode')">
            <NSelect v-model:value="form.mode" :options="modeOptions" />
          </NFormItem>
          <template v-if="form.mode === 'auto_snapshot'">
            <NFormItem :label="t('modelGroups.drawer.autoPreset')">
              <NSelect v-model:value="form.autoPreset" :options="presetOptions" />
            </NFormItem>
            <NFormItem :label="t('modelGroups.drawer.autoTopN')">
              <NInputNumber v-model:value="form.autoTopN" :min="1" :max="20" style="width: 160px" />
            </NFormItem>
            <NFormItem :label="t('modelGroups.drawer.members')">
              <NSpace vertical style="width: 100%">
                <NSpace>
                  <NButton size="small" :loading="previewLoading" @click="previewAutoMembers">
                    {{ t('modelGroups.drawer.preview') }}
                  </NButton>
                  <NButton
                    size="small"
                    :disabled="autoPreview.length === 0"
                    :loading="previewLoading"
                    @click="previewAutoMore"
                  >
                    {{ t('modelGroups.drawer.loadMore5') }}
                  </NButton>
                </NSpace>
                <NDataTable
                  size="small"
                  :columns="previewColumns"
                  :data="autoPreview"
                  :bordered="false"
                  :pagination="false"
                />
              </NSpace>
            </NFormItem>
          </template>
          <NFormItem v-else :label="t('modelGroups.drawer.members')">
            <NSpace vertical size="small" style="width: 100%">
              <div
                v-for="(m, idx) in memberRows"
                :key="idx"
                class="member-row"
                :class="{
                  'drag-dragging': memberDrag.draggingIndex.value === idx,
                  [`drag-drop-${memberDrag.dragOverPosition.value}`]: memberDrag.dragOverIndex.value === idx,
                }"
                v-bind="memberDrag.rowProps(idx)"
              >
                <div
                  class="order-handle"
                  draggable="true"
                  :title="t('modelGroups.drawer.dragHandle')"
                  @dragstart="(event: DragEvent) => {
                    memberDrag.startDrag(idx);
                    event.dataTransfer?.setData('text/plain', String(idx));
                    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
                  }"
                  @dragend="memberDrag.clear"
                >
                  <span class="order-grip" aria-hidden="true" />
                </div>
                <NSelect
                  v-model:value="m.publicModelId"
                  :options="modelOptions"
                  style="flex: 1"
                  :placeholder="t('modelGroups.drawer.placeholders.publicModel')"
                />
                <NButton size="small" type="error" tertiary @click="removeMember(idx)">×</NButton>
              </div>
              <NButton size="small" @click="addMember">{{
                t('modelGroups.drawer.addMember')
              }}</NButton>
            </NSpace>
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="drawerOpen = false">{{ t('common.cancel') }}</NButton>
            <NButton type="primary" :loading="submitting" @click="onSubmit">{{
              t('common.create')
            }}</NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>

    <NDrawer v-model:show="detailOpen" :width="640">
      <NDrawerContent
        :title="detailGroup ? detailGroup.name : t('modelGroups.detail.title')"
        closable
      >
        <NSpin v-if="detailLoading && !detailGroup" />
        <template v-else-if="detailGroup">
          <NSpace vertical size="medium">
            <NSpace align="center" :size="8">
              <NTag
                size="small"
                :type="detailGroup.mode === 'auto_snapshot' ? 'info' : 'default'"
              >
                {{
                  detailGroup.mode === 'auto_snapshot'
                    ? t('modelGroups.status.autoSnapshot')
                    : t('modelGroups.status.manual')
                }}
              </NTag>
              <NText depth="3" style="font-size: 12px">
                {{ t('modelGroups.detail.preset', { preset: detailGroup.autoPreset ?? '—' }) }}
              </NText>
              <NText depth="3" style="font-size: 12px">
                {{ t('modelGroups.detail.lastRefreshed', {
                  at: detailGroup.autoLastRefreshedAt
                    ? new Date(detailGroup.autoLastRefreshedAt).toLocaleString()
                    : '—',
                }) }}
              </NText>
            </NSpace>

            <NSpace v-if="detailGroup.mode === 'auto_snapshot'">
              <NButton
                size="small"
                :loading="detailLoadingMore"
                @click="loadMoreDetail"
              >
                {{ t('modelGroups.detail.loadMore5') }}
              </NButton>
              <NButton
                size="small"
                secondary
                :loading="detailLoading"
                @click="loadDetail"
              >
                {{ t('modelGroups.actions.refreshAuto') }}
              </NButton>
            </NSpace>

            <NDataTable
              size="small"
              :columns="detailMemberColumns"
              :data="detailGroup.members ?? []"
              :bordered="false"
              :row-key="(row) => row.id"
              :empty="h(NEmpty, { description: t('modelGroups.detail.noMembers') })"
            />
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
}

.member-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
