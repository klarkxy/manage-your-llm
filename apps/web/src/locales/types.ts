// 用于类型推断的消息结构。Phase 0 只提供最小骨架，
// 后续阶段按页面逐步扩展。

export interface Messages {
  layout: {
    brand: string;
    sub: string;
    version: string;
    menu: {
      overview: string;
      upstreamKeys: string;
      publicModels: string;
      modelGroups: string;
      apps: string;
      usage: string;
      settings: string;
      login: string;
    };
  };
  login: {
    title: string;
    username: string;
    password: string;
    submit: string;
  };
  overview: {
    title: string;
  };
  upstreamKeys: {
    title: string;
  };
  publicModels: {
    title: string;
  };
  modelGroups: {
    title: string;
  };
  apps: {
    title: string;
  };
  usage: {
    title: string;
  };
  settings: {
    title: string;
  };
}
