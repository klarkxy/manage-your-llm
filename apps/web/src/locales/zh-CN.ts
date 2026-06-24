import type { Messages } from './types.js';

const messages: Messages = {
  layout: {
    brand: 'ManageYourLLM',
    sub: '管理你的大模型',
    version: 'v0.1.0',
    menu: {
      overview: '概览',
      upstreamKeys: '上游密钥',
      publicModels: '公共模型',
      modelGroups: '模型组',
      apps: '应用',
      usage: '用量',
      settings: '设置',
      login: '登录',
    },
  },
  login: {
    title: 'ManageYourLLM · 登录',
    username: '用户名',
    password: '密码',
    submit: '登录',
  },
  overview: {
    title: '概览',
  },
  upstreamKeys: {
    title: '上游密钥',
  },
  publicModels: {
    title: '公共模型',
  },
  modelGroups: {
    title: '模型组',
  },
  apps: {
    title: '应用',
  },
  usage: {
    title: '用量',
  },
  settings: {
    title: '设置',
  },
};

export default messages;
