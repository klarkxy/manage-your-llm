<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NAlert,
  NButton,
  NCode,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSpace,
  NTag,
  NText,
  useMessage,
  type DataTableColumns,
} from 'naive-ui';
import {
  consumerKeysApi,
  type AppSummary,
  type ConsumerKey,
} from '../api/admin.js';

const props = defineProps<{
  app: AppSummary;
}>();

const message = useMessage();
const { t } = useI18n();

const items = ref<ConsumerKey[]>([]);
const loading = ref(false);
const createOpen = ref(false);
const submitting = ref(false);
const form = ref<{ name: string }>({ name: '' });
const justCreated = ref<ConsumerKey | null>(null);

async function refresh() {
  loading.value = true;
  try {
    const res = await consumerKeysApi.list(props.app.id);
    items.value = res.items;
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);

function openCreate() {
  form.value = { name: '' };
  createOpen.value = true;
}

async function onCreate() {
  if (!form.value.name.trim()) {
    message.error(t('consumerKeys.validation.required'));
    return;
  }
  submitting.value = true;
  try {
    const created = await consumerKeysApi.create(props.app.id, {
      name: form.value.name.trim(),
    });
    items.value = [created, ...items.value];
    createOpen.value = false;
    justCreated.value = created;
    message.success(t('consumerKeys.toast.created'));
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    submitting.value = false;
  }
}

async function revoke(row: ConsumerKey) {
  try {
    const updated = await consumerKeysApi.revoke(row.id);
    items.value = items.value.map((i) => (i.id === row.id ? updated : i));
    message.success(t('consumerKeys.toast.revoked'));
  } catch (err) {
    message.error((err as Error).message);
  }
}

async function rotate(row: ConsumerKey) {
  try {
    const updated = await consumerKeysApi.rotate(row.id);
    items.value = items.value.map((i) => (i.id === row.id ? updated : i));
    justCreated.value = updated;
    message.success(t('consumerKeys.toast.rotated'));
  } catch (err) {
    message.error((err as Error).message);
  }
}

const columns = computed<DataTableColumns<ConsumerKey>>(() => [
  { title: t('consumerKeys.columns.name'), key: 'name', width: 160, sorter: true },
  { title: t('consumerKeys.columns.prefix'), key: 'keyPrefix', width: 130, sorter: true },
  { title: t('consumerKeys.columns.suffix'), key: 'keySuffix', width: 130, sorter: true },
  {
    title: t('consumerKeys.columns.lastUsed'),
    key: 'lastUsedAt',
    width: 160,
    sorter: true,
    render: (row) =>
      row.lastUsedAt
        ? h(NText, { depth: 3, size: 'small' }, () => new Date(row.lastUsedAt!).toLocaleString())
        : h(NText, { depth: 3, size: 'small' }, () => t('consumerKeys.neverUsed')),
  },
  {
    title: t('consumerKeys.columns.status'),
    key: 'enabled',
    width: 110,
    sorter: true,
    render: (row) =>
      !row.enabled
        ? h(NTag, { type: 'error', size: 'small' }, () => t('consumerKeys.status.revoked'))
        : h(NTag, { type: 'success', size: 'small' }, () => t('consumerKeys.status.active')),
  },
  {
    title: t('consumerKeys.columns.actions'),
    key: 'actions',
    width: 200,
    render: (row) =>
      h(NSpace, { size: 'small' }, () => [
        h(
          NPopconfirm,
          { onPositiveClick: () => rotate(row) },
          {
            trigger: () => h(NButton, { size: 'small' }, () => t('consumerKeys.actions.rotate')),
            default: () => t('consumerKeys.confirm.rotate'),
          },
        ),
        h(
          NPopconfirm,
          { disabled: !row.enabled, onPositiveClick: () => revoke(row) },
          {
            trigger: () =>
              h(NButton, { size: 'small', type: 'warning', disabled: !row.enabled }, () =>
                t('consumerKeys.actions.revoke'),
              ),
            default: () => t('consumerKeys.confirm.revoke'),
          },
        ),
      ]),
  },
]);

function dismissJustCreated() {
  justCreated.value = null;
}
</script>

<template>
  <div>
    <NSpace align="center" justify="space-between" style="margin-bottom: 12px">
      <NText depth="3">{{ t('consumerKeys.keyCount', { count: items.length }) }}</NText>
      <NButton type="primary" size="small" @click="openCreate">{{ t('consumerKeys.new') }}</NButton>
    </NSpace>

    <NDataTable
      :columns="columns"
      :data="items"
      :loading="loading"
      :bordered="false"
      :single-line="false"
      :row-key="(row) => row.id"
      :empty="h(NEmpty, { description: t('consumerKeys.empty') })"
    />

    <NModal
      :show="createOpen"
      preset="card"
      style="max-width: 560px"
      :title="t('consumerKeys.modal.createTitle')"
      @update:show="(v) => (createOpen = v)"
    >
      <NForm label-placement="top">
        <NFormItem :label="t('consumerKeys.modal.name')" required>
          <NInput
            v-model:value="form.name"
            :placeholder="t('consumerKeys.modal.placeholder.name')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="createOpen = false">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="submitting" @click="onCreate">{{
            t('common.create')
          }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      :show="justCreated !== null"
      preset="card"
      style="max-width: 640px"
      :title="t('consumerKeys.createdModal.title')"
      @update:show="(v) => v || dismissJustCreated()"
    >
      <NAlert type="warning" :show-icon="false" style="margin-bottom: 12px">
        {{ t('consumerKeys.createdModal.warning') }}
      </NAlert>
      <NCode v-if="justCreated" :code="justCreated.key ?? ''" language="text" />
      <NSpace justify="end" style="margin-top: 12px">
        <NButton type="primary" @click="dismissJustCreated">{{
          t('consumerKeys.createdModal.saved')
        }}</NButton>
      </NSpace>
    </NModal>
  </div>
</template>
