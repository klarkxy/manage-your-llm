import type { Messages } from './types.js';

const messages: Messages = {
  layout: {
    brand: 'ManageYourLLM',
    sub: 'Manage your LLMs',
    version: 'v0.1.0',
    menu: {
      overview: 'Overview',
      upstreamKeys: 'Upstream Keys',
      publicModels: 'Public Models',
      modelGroups: 'Model Groups',
      apps: 'Apps',
      usage: 'Usage',
      settings: 'Settings',
      login: 'Sign in',
    },
  },
  login: {
    title: 'ManageYourLLM · Sign in',
    username: 'Username',
    password: 'Password',
    submit: 'Sign in',
  },
  overview: {
    title: 'Overview',
  },
  upstreamKeys: {
    title: 'Upstream Keys',
  },
  publicModels: {
    title: 'Public Models',
  },
  modelGroups: {
    title: 'Model Groups',
  },
  apps: {
    title: 'Apps',
  },
  usage: {
    title: 'Usage',
  },
  settings: {
    title: 'Settings',
  },
};

export default messages;
