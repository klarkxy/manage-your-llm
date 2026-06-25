# 备份与恢复指南

ManageYourLLM 的 SQLite 数据库保存了所有配置、用量、trace 和加密后的上游密钥。妥善备份是保障数据安全的关键。

## 备份类型

### 1. 完整数据库备份（Full）

- 内容：整个 SQLite 数据库文件，包括加密后的上游密钥、Consumer Key hash、配置、用量、trace 等。
- 恢复条件：**必须使用与备份时相同的 `MYLLM_SECRET_KEY`**，否则加密数据无法解密。
- 适用场景：灾难恢复、升级前备份、迁移服务器。

### 2. 非敏感配置导出（Config）

- 内容：上游密钥 preset、public model、model group、pricing、plan 等配置元数据，不包含任何原始 secret。
- 限制：导入后需要重新填写上游 API key 和 Consumer Key。
- 适用场景：分享配置模板、跨环境同步非敏感配置。

## 手动备份

1. 登录管理台，进入左侧菜单 **Backups（备份）**。
2. 点击 **Create Backup（创建备份）**。
3. 选择备份类型：
   - **Full**：完整数据库备份。
   - **Config**：非敏感配置导出。
4. 可选填写备注。
5. 备份完成后，文件会保存在 `backups/` 目录下，同时可在列表中查看文件名、类型、大小和 schema 版本。

## 恢复数据库

> 警告：恢复会覆盖当前数据库。操作前系统会自动再备份一次当前库，但仍请谨慎。

1. 进入管理台 **Backups** 页面。
2. 在目标备份行点击 **Restore（恢复）**。
3. 输入确认信息（如需）。
4. 确认后，当前数据库会先被自动备份。
5. 恢复完成后，页面会提示“数据库已恢复，请重新启动服务以完成生效”。
6. 重启容器或进程：
   ```bash
   docker restart manageyourllm
   ```

## 命令行迁移

如果你更习惯命令行，也可以直接复制数据库文件：

```bash
# 备份
cp data/manageyourllm.sqlite backups/manageyourllm-$(date +%Y%m%d-%H%M%S).sqlite

# 恢复前务必先备份当前库
cp data/manageyourllm.sqlite backups/manageyourllm-before-restore.sqlite
cp backups/target.sqlite data/manageyourllm.sqlite
```

> 命令行恢复同样要求 `MYLLM_SECRET_KEY` 与备份时一致。

## 灾难恢复 checklist

- [ ] 数据库文件已备份到安全位置。
- [ ] `MYLLM_SECRET_KEY` 已妥善保存且与备份时一致。
- [ ] 容器/进程启动时环境变量已正确设置。
- [ ] 数据卷 `data/` 已正确挂载。

## 安全建议

- 不要将完整数据库备份上传到公开仓库。
- `MYLLM_SECRET_KEY` 丢失后将无法解密上游密钥，建议离线保存。
- 非敏感配置导出可以在团队或环境间共享，但导入后必须重新输入 API key。
