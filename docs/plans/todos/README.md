# TODO Index

本目录把阶段计划拆成可执行 TODO。每个 TODO 使用稳定编号，后续提交、PR、测试和文档更新都可以引用这些编号。

## 文件

- `phase-0-foundation.todo.md`
- `phase-1-domain-data.todo.md`
- `phase-2-admin-console.todo.md`
- `phase-3-gateway-routing.todo.md`
- `phase-4-streaming-resilience.todo.md`
- `phase-5-observability-cost.todo.md`

## TODO 格式

```text
- [ ] P0-001 Task title
  - Depends on: none
  - Deliverables: files/modules/results
  - Acceptance: concrete checks
```

## 状态规则

- `[ ]` 未开始。
- `[~]` 进行中。
- `[x]` 已完成。
- 如果任务被拆分，保留原编号并新增子编号，不复用编号。
- 如果任务取消，保留条目并标记 `Cancelled`，说明原因。

