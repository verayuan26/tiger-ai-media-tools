# 贡献指南

本文档约定 Paperclip 任务交付时的 Git 工作流，避免「代码仅在本地、远程仍是旧构建」导致 Board 验收失败（参见 [EGO-6](/EGO/issues/EGO-6) 占位页事件）。

## 分阶段提交与推送（必须）

1. **每个 Paperclip 子任务/阶段标记 `done` 之前**：必须 `git commit` 且 `git push` 到远程默认分支（通常为 `main`）。
2. **提交信息必须包含 issue identifier**，便于追溯，例如：
   - `EGO-8: wire LibraryPage to listAssets API`
   - `EGO-9: add TagsPage CRUD dialogs`
3. **禁止**在以下情况将 issue（含父 epic）标为 `done`：
   - `git status` 仍有未提交变更；
   - 变更仅存在于本地、尚未 `git push`；
   - 前端已改但 Board 使用的 `npm run dev` 仍会服务旧 `dist/client`（见下条）。
4. **涉及 `src/client` 的前端变更**：在 commit 前运行 `npm run build`（或确保 CI 的 build 步骤通过）。`npm run dev` 会先 build 再启动 Express，依赖最新构建产物。

## 推荐交付检查清单

在 Paperclip issue 标为 `done` 前，依次执行：

```bash
npm run typecheck
npm test
# 若改动了 src/client：
npm run build
git status          # 应为 clean，或有待 commit 的变更
git add … && git commit -m "EGO-N: …"
git push origin main
git status          # 再次确认 clean 且与 origin 同步
```

也可运行项目内置检查：

```bash
npm run check:delivery
```

该脚本会执行 typecheck、单元测试，并确认工作区无未提交变更。

## Co-author 行（Agent 提交）

由 Paperclip agent 创建的 commit，消息末尾应包含：

```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

## 开发命令速查

| 命令 | 用途 |
|------|------|
| `npm run dev` | build + 启动 API（8787），Board 验收用 |
| `npm run dev:server` | 仅 API，配合 HMR |
| `npm run dev:client` | Vite HMR（5173） |
| `npm run build` | 生产前端构建到 `dist/client` |
