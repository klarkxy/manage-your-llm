# 上游密钥指引文档

本目录汇总 ModelHarbor 支持的每一个上游提供商的「如何获取密钥」指引。管理后台的「新建上游密钥」抽屉中会通过超链接打开对应的指引，帮助管理员快速完成凭证填写。

> 提示：所有指引文档同时托管在 Web 静态资源目录 [apps/web/public/docs/provider-guides/](../../apps/web/public/docs/provider-guides/) 中。仓库中保留本目录的副本以便 PR 审阅；修改时请保持两边一致（文件路径一一对应）。

## 索引

| 提供商 | 预设 id | 认证方式 | 指引 |
| --- | --- | --- | --- |
| OpenAI | `openai` | PAT | [openai.md](../../apps/web/public/docs/provider-guides/openai.md) |
| Anthropic | `anthropic` | PAT | [anthropic.md](../../apps/web/public/docs/provider-guides/anthropic.md) |
| OpenAI Codex | `codex` | OAuth（默认）/ PAT | [codex.md](../../apps/web/public/docs/provider-guides/codex.md) |
| Coze（扣子） | `coze` | OAuth JWT | [coze.md](../../apps/web/public/docs/provider-guides/coze.md) |
| DeepSeek | `deepseek` | PAT | [deepseek.md](../../apps/web/public/docs/provider-guides/deepseek.md) |
| Moonshot (Kimi)（国际） | `moonshot` | PAT | [moonshot.md](../../apps/web/public/docs/provider-guides/moonshot.md) |
| Moonshot (Kimi)（国内） | `moonshot-cn` | PAT | [moonshot-cn.md](../../apps/web/public/docs/provider-guides/moonshot-cn.md) |
| MiniMax（国际） | `minimax-intl` | PAT | [minimax-intl.md](../../apps/web/public/docs/provider-guides/minimax-intl.md) |
| MiniMax（国内） | `minimax` | PAT | [minimax.md](../../apps/web/public/docs/provider-guides/minimax.md) |
| OpenRouter | `openrouter` | PAT | [openrouter.md](../../apps/web/public/docs/provider-guides/openrouter.md) |
| OpenCode Go | `opencode-go` | PAT | [opencode-go.md](../../apps/web/public/docs/provider-guides/opencode-go.md) |
| OpenCode Zen | `opencode-zen` | PAT | [opencode-zen.md](../../apps/web/public/docs/provider-guides/opencode-zen.md) |
| Groq | `groq` | PAT | [groq.md](../../apps/web/public/docs/provider-guides/groq.md) |
| Together AI | `together` | PAT | [together.md](../../apps/web/public/docs/provider-guides/together.md) |
| Cerebras | `cerebras` | PAT | [cerebras.md](../../apps/web/public/docs/provider-guides/cerebras.md) |
| Fireworks AI | `fireworks` | PAT | [fireworks.md](../../apps/web/public/docs/provider-guides/fireworks.md) |
| xAI (Grok) | `xai` | PAT | [xai.md](../../apps/web/public/docs/provider-guides/xai.md) |
| 阿里云通义千问（国内） | `qwen` | PAT | [qwen.md](../../apps/web/public/docs/provider-guides/qwen.md) |
| 阿里云通义千问（国际） | `qwen-intl` | PAT | [qwen-intl.md](../../apps/web/public/docs/provider-guides/qwen-intl.md) |
| 智谱 GLM | `zhipu` | PAT | [zhipu.md](../../apps/web/public/docs/provider-guides/zhipu.md) |
| 智谱 GLM 编程包 | `zhipu-coding` | PAT | [zhipu-coding.md](../../apps/web/public/docs/provider-guides/zhipu-coding.md) |
| 硅基流动 | `siliconflow` | PAT | [siliconflow.md](../../apps/web/public/docs/provider-guides/siliconflow.md) |
| 百川 | `baichuan` | PAT | [baichuan.md](../../apps/web/public/docs/provider-guides/baichuan.md) |
| 字节火山方舟 | `bytedance` | PAT | [bytedance.md](../../apps/web/public/docs/provider-guides/bytedance.md) |
| 腾讯混元 | `hunyuan` | PAT | [hunyuan.md](../../apps/web/public/docs/provider-guides/hunyuan.md) |
| 百度千帆 | `qianfan` | PAT | [qianfan.md](../../apps/web/public/docs/provider-guides/qianfan.md) |
| 阶跃星辰 | `stepfun` | PAT | [stepfun.md](../../apps/web/public/docs/provider-guides/stepfun.md) |
| Agnes AI | `agnes-ai` | PAT | [agnes-ai.md](../../apps/web/public/docs/provider-guides/agnes-ai.md) |
| Kimi Code | `kimi-code` | PAT | [kimi-code.md](../../apps/web/public/docs/provider-guides/kimi-code.md) |

## 新增指引

1. 在 `apps/web/public/docs/provider-guides/{id}.md`（英文，与 Web 资源同源）创建指引文件。
2. 在 `docs/provider-guides/{id}.md` 同步保留仓库版本（可选用中文）。
3. 在 `apps/api/src/modules/providers/{id}.ts` 的 `preset` 对象中加入 `guideUrl: providerGuideUrl('id')`。
4. 把新的提供商追加到上表，保持按字母顺序排列。