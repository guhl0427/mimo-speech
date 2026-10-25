# 声息 · MiMo 语音工作台

一个个人自用的双向语音工具：录音或上传音频转成文字，输入文字生成语音。后端只接小米 MiMo，前端是暖纸风格的响应式单页应用。

> **范围**：个人自用。服务默认只监听 `127.0.0.1`，没有账号体系和公开部署鉴权，请勿直接暴露到公网。

## 功能

- **文字转语音**
  - `mimo-v2.5-tts`，单次最多 1,000 字符。
  - 9 个 MiMo 音色，按默认 / 中文 / 英文分组。
  - 6 组语气预设（通用、情绪、角色、场景、方言、英文），选择后仍可手动输入。
  - 语速 0.5×–1.5×，支持取消生成。
  - 生成后可在页面播放、下载；TTS 音频存入本地 IndexedDB 历史。
- **语音转文字**
  - 浏览器真实录音，或上传 mp3 / wav / m4a / webm / ogg / flac / mp4。
  - 单次最长 5 分钟、上传不超过 25MB；服务端用 ffmpeg 转成 MP3 后提交 MiMo ASR。
  - 中文 / 英文 / 自动识别；转写结果可编辑、复制、导出 TXT。
  - 转写前显示预估费用；首次使用需确认计费，不自动重试，不静默扣费。
  - STT 音频不保存到服务端，也不写入本地历史。
- **个人 API Key 设置**
  - 页面右上角「设置」可直接保存个人 MiMo Key，保存后立即生效，无需重启。
  - 支持「验证连接」和「清除个人 Key」；验证只请求模型列表，不生成音频或转写。
  - 个人 Key 存在服务端 `data/settings.json`，优先于 `.env`；浏览器只会看到尾号提示。
- **本地历史**
  - IndexedDB 保存最近 30 条 / 80MB；TTS 保存音频，STT 只保存文本。
  - 支持打开历史、回放 TTS 音频、删除单条、清空全部。
  - 历史音频只在这台浏览器里；清理后不可恢复。
- **界面**
  - 暖纸 + 墨色 + 朱砂的编辑台风格；桌面双栏、移动端单列。
  - 模式切换、音色列表、语气预设都支持键盘操作；弹出层会跟随视口定位，兼容触屏。
  - 已验证 1440px、390px、320px 宽度下无横向溢出。

## 快速开始

### 环境要求

- Node.js 22+
- npm
- 目前主要在 Windows 上开发验证；其他平台如遇 ffmpeg 二进制问题，请重新安装依赖或替换 `@ffmpeg-installer` 对应平台包。

### 安装与启动

```bash
npm install
npm run dev
```

打开：

- 前端：<http://127.0.0.1:5173>
- API：<http://127.0.0.1:8787>

建议使用 `127.0.0.1` 而不是 `localhost`，避免本机 DNS 解析到其他端口上的项目。

### 配置 MiMo Key

推荐在页面里配置：

1. 打开右上角「设置」。
2. 粘贴 MiMo API Key。
3. 点击「保存并验证」。
4. 验证通过后状态会变为 `MIMO READY`，TTS / ASR 立即可用。

也可以写入根目录 `.env`：

```dotenv
MIMO_API_KEY=你的Key
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
PORT=8787
MOCK_MIMO=0
```

修改 `.env` 后需要重启 API 服务。若个人 Key 已存在，它会覆盖 `.env` 中的 Key；在设置中清除个人 Key 后会回退到 `.env`。

`.env` 和 `data/` 都已加入 `.gitignore`，不要把真实 Key 提交到仓库。

### 无 Key 预览（Mock 模式）

在 `.env` 中设置：

```dotenv
MOCK_MIMO=1
```

重启服务后，TTS 会返回本地示例 WAV，STT 会返回固定示例文本，不会调用 MiMo。页面会显示 `MOCK 模式` 和黄色提示条。Mock 优先级高于任何 Key。

### 生产构建

```bash
npm run build
npm start
```

打开 <http://127.0.0.1:8787>。生产模式下 Express 同时提供 API 和 `client/dist` 静态文件。

## 使用说明

### 文字转语音

1. 切换到「文字转语音」。
2. 输入或粘贴文本，最多 1,000 字符。
3. 选择音色、语气和语速；语气可以从预设组里挑，也可以直接手动改。
4. 点击「生成语音」，完成后播放或下载。

当前 MiMo TTS 标注为限时免费；若官方结束免费，以 MiMo 官方计费为准。

### 语音转文字

1. 切换到「语音转文字」。
2. 点击麦克风录音，或拖入/选择音频。
3. 选择识别语言。
4. 查看预估费用，确认后开始转写。
5. 结果可编辑、复制或导出 TXT。

MiMo ASR 按约 ¥0.5/小时计费（以官方为准），单次上限 5 分钟。失败后需要手动重试，不会自动重复提交。

### 历史记录

- 最近记录显示在工具台下方。
- 点击 STT 记录会恢复文本；点击 TTS 记录会加载本地音频。
- 单条记录右侧有删除按钮；「清空记录」会同时删除 IndexedDB 中的音频。
- Mock 生成的记录会带 `MOCK` 标记。

## 配置项

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MIMO_API_KEY` | 空 | 可选；个人设置中的 Key 优先 |
| `MIMO_BASE_URL` | `https://api.xiaomimimo.com/v1` | MiMo API Base URL |
| `PORT` | `8787` | API 服务端口 |
| `MOCK_MIMO` | `0` | `1` 时启用本地 Mock，不调用 MiMo |

个人 Key 存储位置：`data/settings.json`（服务端，文件权限尽可能为 `0600`；Windows 不强制 POSIX 权限）。该目录已被 `.gitignore` 忽略。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 同时启动 Vite（5173）和 Express（8787） |
| `npm run dev:client` | 只启动前端 |
| `npm run dev:server` | 只启动 API（tsx watch） |
| `npm run typecheck` | 前后端 TypeScript 检查 |
| `npm run build` | 编译服务端 + 构建前端 |
| `npm start` | 运行已构建的服务 |

当前仓库没有提交自动化测试脚本；验证方式见下方「验证」。

## 技术架构

```text
浏览器
  React 19 + TypeScript + Vite 8
   ├─ 语音工作台 / 历史 / 设置
   ├─ MediaRecorder 录音
   ├─ IndexedDB（历史 + TTS 音频）
   └─ fetch /api/*（浏览器不持有 Key）
             │
Express 5（Node 22+）
   ├─ /api/tts  → MiMo chat/completions + audio
   ├─ /api/stt  → ffmpeg 转 MP3 → MiMo ASR
   ├─ /api/settings/* → Key 保存/验证/清除
   ├─ Key 解析：data/settings.json > .env
   ├─ 限流、Zod 校验、统一错误、请求 ID
   └─ 生产环境托管 client/dist
```

服务端不保存文本和音频；音频只在处理期间存在于内存和临时目录，处理完即删除。请求日志只记录状态、耗时、字符数/音频时长等元数据。

### 目录结构

```text
re-tts/
├─ client/                 # React + Vite 前端
│  ├─ src/
│  │  ├─ components/       # 模式切换、TTS/STT、播放器、设置、历史、弹窗
│  │  ├─ hooks/            # 录音、浮层定位
│  │  ├─ lib/              # API、IndexedDB、格式化
│  │  ├─ App.tsx
│  │  └─ styles.css
│  └─ dist/                # 构建产物（不提交）
├─ server/                 # Express API
│  ├─ src/
│  │  ├─ index.ts          # 路由、限流、静态托管
│  │  ├─ mimo.ts           # MiMo TTS/ASR/Key 验证
│  │  ├─ audio.ts          # ffmpeg/ffprobe
│  │  ├─ settings.ts       # 个人 Key 存储
│  │  └─ config.ts
│  └─ dist/                # 编译产物（不提交）
├─ data/                   # 个人 Key（已忽略，不提交）
├─ design/prototype.html   # 早期静态视觉原型
├─ PRD.md
├─ .env                    # 本地配置（已忽略，不提交）
├─ .env.example
└─ package.json
```

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查与当前模式 |
| GET | `/api/config` | 模式、Key 状态/尾号、音色、限额、价格 |
| POST | `/api/tts` | JSON：`text`、`voiceId`、`style`、`speed`；返回音频二进制 |
| POST | `/api/stt` | multipart：`file`、`language`、`durationSec`；返回文本与费用 |
| POST | `/api/settings/mimo-key` | 保存个人 Key（服务端存储） |
| DELETE | `/api/settings/mimo-key` | 清除个人 Key，回退到 `.env` |
| POST | `/api/settings/mimo-key/test` | 通过 MiMo `/models` 验证当前 Key |

默认限流：

- TTS：10 次/分钟
- STT：5 次/分钟
- 设置接口：20 次/分钟

所有错误返回统一结构：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "先写下要朗读的文字。",
    "requestId": "..."
  }
}
```

## 数据、隐私与安全

- 文本会发送给 MiMo 用于 TTS；音频会经本站转码后发送给 MiMo ASR。
- 服务端不持久化文本或音频；不记录正文日志。
- TTS 音频只保存在当前浏览器的 IndexedDB；STT 只保存文本。
- API Key 只存在服务端：`data/settings.json` 或 `.env`。浏览器只拿到是否配置和尾号。
- `.env`、`data/` 已被 `.gitignore` 忽略。请勿手动提交或截图暴露 Key。
- 设置接口没有登录鉴权，服务默认只绑定 `127.0.0.1`。如果要部署到公网，必须先加认证、HTTPS、访问控制和更严格的配额。
- 转写结果可能出错，请人工核对；不要上传敏感或机密音频。

## 限制与后续

当前 v1 **不包含**：

- SRT / 时间戳（MiMo ASR 不返回时间戳；以后需另接支持时间戳的 ASR 或做本地对齐）
- 实时说话出字
- 多供应商自动降级（只接 MiMo）
- 超过 5 分钟的长音频、批量文件、视频转写
- 流式 TTS、声音克隆 / 声音设计
- 账号体系、云端同步、公开部署鉴权

这些属于后续版本范围。

## 验证

已完成：

- `npm run typecheck`
- `npm run build`
- Mock 模式端到端验证：TTS 生成与播放、真实录音、上传音频、费用确认、转写、刷新后历史持久化、删除/清空、历史回放
- 只读 UI 回归：设置弹窗、9 个音色、6 组语气预设、模式切换、390px / 320px 布局；全程未触发真实 MiMo 调用
- 1440px / 390px / 320px 响应式检查，无横向溢出
- 页面控制台无报错

真实 MiMo 调用可在右上角「设置 → 验证连接」中确认；验证成功后状态显示 `MIMO READY`。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| 状态显示「未配置 KEY」 | 打开设置保存 Key，或检查 `.env` 后重启 |
| 状态显示「API 离线」 | 确认 `npm run dev` 的 API 进程在 8787，或 `npm start` 已启动 |
| 验证失败 / 401 / 403 | 检查 Key 是否完整、是否有 MiMo 权限 |
| 429 | TTS/STT 限流；稍后再试，不要连续重试 |
| 麦克风不可用 | 使用 HTTPS 或 `127.0.0.1`，并允许浏览器麦克风权限 |
| 录音转写失败 | 检查音频时长是否 ≤5 分钟、文件是否 ≤25MB；查看 API 日志中的错误码 |
| 想换回 `.env` 的 Key | 在设置中清除个人 Key |
| 端口冲突 | 修改 `.env` 的 `PORT`，并同步修改 `vite.config.ts` 的代理目标 |

## 相关文档

- [PRD.md](./PRD.md) — 产品范围、实现状态、接口与安全设计
- [design/prototype.html](./design/prototype.html) — 早期静态视觉原型

MiMo 相关能力与价格以官方文档为准：

- <https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go>
- <https://mimo.mi.com/models/en-US/mimo-v2.5-tts>
- <https://mimo.mi.com/models/en-US/mimo-v2.5-asr>
