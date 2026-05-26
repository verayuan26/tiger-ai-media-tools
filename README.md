# AI Media Tools

AI Media Tools 是一个本地优先的 AI 多媒体素材整理 MVP，用来给本地图片、视频、音频建立可搜索的素材索引。默认行为是不移动、不重命名、不修改原始素材；系统会只读扫描和分析原文件，用于哈希、抽帧、标签、字幕等生成，并把索引、任务状态、AI 生成内容写入本地 `.data` 目录。

项目支持增量导入：同一个目录可以重复扫描，已有素材会跳过或复用索引。当前重点覆盖视频帧、标签、字幕，图片标签，以及音频基础索引。

## 当前能力

- 本地 Express API 服务。
- SQLite 索引库，默认位于 `.data/library.sqlite`。
- 扫描导入本地目录，按图片、视频、音频建立素材记录。
- 任务队列和 `/api/jobs/drain` 处理入口。
- `mock` AI provider，默认不上传任何素材。
- OpenAI-compatible provider 边界，后续可接入兼容接口的视觉和转写模型。
- React UI，用于导入目录、查看素材、筛选标签和处理队列。
- Fixture demo 和 Playwright E2E，用于验证 MVP 流程。

## 快速开始

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` 会先执行 `npm run build`，再启动 Express（默认端口 `8787`），并托管 `dist/client` 中的生产构建产物。Board 或验收场景只需这一条命令，访问 [http://127.0.0.1:8787](http://127.0.0.1:8787) 即可看到与构建一致的 UI。

前端开发如需 Vite HMR，另开终端：

```bash
npm run dev:server   # 终端 1：仅 API
npm run dev:client   # 终端 2：Vite 开发服务器，http://127.0.0.1:5173
```

`dev:client` 通过 CORS 调用 `8787` 上的 API；改 UI 后无需重建 `dist/client`。

## 贡献与 Git 工作流

Paperclip 任务交付须**分阶段 commit + push**，提交信息含 issue ID（如 `EGO-8:`），且在标 `done` 前保证工作区已同步远程。详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 普通导入

### UI 方式

1. 启动后端和前端。
2. 在 UI 输入本地目录绝对路径，例如 `/Users/you/Movies/materials`。
3. 输入主题名，例如 `牛仔面料工厂`。
4. 点击导入。
5. 导入完成后点击处理队列，生成 mock 标签、视频帧/字幕等索引内容。

### API 方式

```bash
curl -X POST http://127.0.0.1:8787/api/sources/import \
  -H 'content-type: application/json' \
  -d '{"rootPath":"/absolute/path/to/materials","name":"牛仔面料工厂"}'

curl -X POST http://127.0.0.1:8787/api/jobs/drain \
  -H 'content-type: application/json' \
  -d '{"limit":25}'
```

## Fixture Demo

生成本地测试素材：

```bash
npm run fixtures
```

Fixture 会写入 `.data/fixtures/factory`。如果要使用开发专用导入接口，需要显式启用 `AI_MEDIA_ENABLE_DEV_ROUTES=1`：

```bash
AI_MEDIA_ENABLE_DEV_ROUTES=1 npm run dev
```

然后调用：

```bash
curl -X POST http://127.0.0.1:8787/api/dev/import-fixtures
curl -X POST http://127.0.0.1:8787/api/jobs/drain \
  -H 'content-type: application/json' \
  -d '{"limit":20}'
```

E2E 会使用 `.data/e2e` 隔离数据，并在 Playwright 启动服务前执行：

```bash
AI_MEDIA_DATA_DIR=.data/e2e npm run fixtures
AI_MEDIA_DATA_DIR=.data/e2e AI_PROVIDER=mock AI_MEDIA_ENABLE_DEV_ROUTES=1 npm run dev
```

## 环境变量

- `AI_MEDIA_DATA_DIR`：本地数据目录，默认 `.data`。SQLite 索引和生成内容会写到这里。
- `AI_MEDIA_PORT`：Express API 端口，默认 `8787`。
- `AI_PROVIDER`：AI provider 名称，默认 `mock`；也可切换到 OpenAI-compatible provider。
- `AI_OPENAI_BASE_URL`：OpenAI-compatible API 地址，默认 `https://api.openai.com/v1`。
- `AI_OPENAI_API_KEY`：OpenAI-compatible API key。
- `AI_OPENAI_VISION_MODEL`：视觉/图片标签模型名。
- `AI_OPENAI_TRANSCRIBE_MODEL`：音频转写模型名。
- `AI_DAILY_BUDGET_CENTS`：默认每日 AI 预算（分），用于初始化 SQLite `app_settings`（UI 可在设置页覆盖）。
- `AI_JOB_COST_CENTS`：每完成一个 AI 阶段任务计入的估算成本（分），默认 `10`。
- `AI_MEDIA_ENABLE_DEV_ROUTES`：仅开发和测试使用。设为 `1` 时启用 `/api/dev/import-fixtures`。

## 设置 API（二期-D）

- `GET /api/settings`：读取持久化设置（API Key 仅返回是否已配置）。
- `PATCH /api/settings`：保存协议、端点、Key、预算、并发等。
- `POST /api/settings/test-ai`：真实探测 AI 可达性（mock 直接成功；openai-compatible 调用 `/models`）。
- `POST /api/jobs/drain`：超预算或并发上限时返回 `429` 与 `blocked.code`。

## 验证命令

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
git diff --check
```

## Contributing（Git 交付规范）

每个 Paperclip 子任务或阶段完成时，代码必须已提交并推送到远程，再标记 issue 为 `done`。避免「仅本地存在、Board 拉不到」的交付断层（参见 [EGO-6](/EGO/issues/EGO-6) 复盘）。

1. **阶段完成即 push**：子任务/阶段验收通过后，执行 `git commit` 与 `git push`，再将 issue 标为 `done`。
2. **提交信息含 issue 编号**：首行必须包含 identifier，例如 `EGO-22: add delivery check script`。
3. **禁止虚假完成**：`git status` 非 clean、或有未 push 提交时，不得将父 epic 或子任务标为 `done`。
4. **前端变更先 build**：改动 `src/client` 时，commit 前运行 `npm run build`（或确保 CI build 通过），因为 `npm run dev` 托管的是 `dist/client` 生产构建。

交付前自检（可选）：

```bash
npm run check:delivery -- before-done --issue EGO-22
npm run check:delivery -- commit-msg "EGO-22: your summary"
npm run check:delivery -- pre-push
```

安装 pre-push 提醒（可选，不阻断 push）：

```bash
npm run git:install-hooks
```

## 数据安全和隐私

- 原始素材默认只读索引，不移动、不重命名、不修改。
- 索引、任务状态、标签、字幕、帧信息等生成内容写入 `.data`。
- 默认 `mock` provider 不上传任何素材；启用 OpenAI-compatible provider 时，会把分析所需的媒体内容发送到配置的外部 API。生产使用前还需要完善采样、预算和隐私策略。

## 当前限制和后续

- 目前不是桌面打包应用，需要分别启动本地 API 和前端开发服务。
- 不做自动整理、自动移动或自动重命名素材。
- 音频仅做基础索引和转写边界，不做音乐结构、节拍、情绪等深度解析。
- OpenAI-compatible provider 已有边界，生产级模型配置、预算、采样和隐私策略仍需继续完善。
