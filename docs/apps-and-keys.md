# 应用与 Consumer Key

App 和 Consumer Key 用于管理下游接入。一个 App 代表一个业务应用，Consumer Key 则是该应用调用网关的凭证。

---

## 概念

- **App**：应用维度的租户边界，用于聚合用量和统一管理多个 Consumer Key。
- **Consumer Key**：形如 `mh_...` 的调用凭证。每个 key 属于一个 App，并被授权访问特定的公共模型或模型组。
- **Access grants**：Consumer Key 与模型/模型组之间的授权关系。

App 和 Consumer Key 本身**没有配额和限流**。配额和限流只针对上游密钥。

---

## 创建应用

1. 进入 **Apps → New app**。
2. 填写应用名称和描述，例如：
   - Name：`internal-ide`
   - Description：`内部 IDE 插件与代码助手`
3. 保存。

创建后可以在应用详情页看到：

- 概览：请求量、token 量、失败率。
- Consumer Keys：该应用下的所有 key。
- Access：该应用下 key 的默认或独立授权。

---

## 创建 Consumer Key

1. 进入应用详情页，选择 **Consumer Keys** 标签。
2. 点击 **New consumer key**。
3. 填写名称，例如 `cline-plugin`。
4. 选择该 key 可以访问的模型或模型组。
5. 保存。
6. 在弹窗中复制原始 key。**它只会显示一次**。

> 如果丢失了原始 key，只能 revoke 后重新创建或 rotate。

---

## 授权范围

Consumer Key 的访问范围可以是：

- 一个或多个 **Public Model**。
- 一个或多个 **Model Group**。
- 同时包含模型和模型组。

如果 Consumer Key 没有被授权访问某个目标，客户端会收到 `403`。

---

## 轮换与撤销

| 操作 | 说明 |
| --- | --- |
| **Rotate** | 生成新的 Consumer Key，旧 key 立即失效。新 key 只会显示一次。 |
| **Revoke** | 永久禁用该 key，调用时返回 401。 |

建议在怀疑 key 泄露、员工离职或定期安全审计时执行轮换。

---

## 下游调用方式

Consumer Key 支持两种传递方式：

```bash
# 推荐方式
Authorization: Bearer mh_your_consumer_key

# Anthropic 兼容客户端
x-api-key: mh_your_consumer_key
```

如果同时存在两个 header，`Authorization` 优先。

完整调用示例见 [API 使用指南](api-usage.md)。

---

## 用量归属

所有网关请求会按 Consumer Key 归属到对应的 App，再聚合到公共模型/模型组/上游密钥等维度。你可以在 **Usage** 页面按 App 或 Consumer Key 筛选。

---

## 最佳实践

- 每个独立应用创建一个 App，不要多个系统共用一个 App。
- 为每个部署环境（开发/测试/生产）分别创建 Consumer Key。
- 按需授权，避免一个 key 访问所有模型。
- 定期轮换长期使用的 key。
