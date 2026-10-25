# 声息 · 纯 MiMo 语音工作台 PRD

| 项目 | 内容 |
| --- | --- |
| 版本 | v2.1（v1.0 实现版） |
| 日期 | 2026-10-25 |
| 状态 | 已实现；Mock、响应式与外观切换验证通过 |
| 使用范围 | **个人自用**；默认只监听 `127.0.0.1`，不做公开部署 |
| 产品形态 | Web 单页应用，桌面优先，移动端响应式 |
| 外部 API | 仅小米 MiMo：TTS + ASR |
| 运行说明 | 见 [README.md](./README.md) |

> v2.1 说明：新增浅色 / 深色 / 跟随系统三种外观。默认跟随系统，偏好仅保存在浏览器，首次绘制前应用；不涉及 API、服务端存储或数据结构变化。

> v2.0 说明：本版在 v1.1「纯 MiMo MVP」基础上同步了实际交付内容。相对原需求新增了**个人 API Key 设置**、**9 个音色**、**6 组语气预设**、独立模式切换和移动端浮层适配；SRT 与实时识别仍未包含在 v1 范围内。

---

## 0. 实现摘要

### 0.1 已交付

| 模块 | 已实现 |
| --- | --- |
| TTS | MiMo TTS、1,000 字符上限、9 音色、语气预设 + 手动输入、语速、生成/取消、播放、下载、历史回放 |
| STT | 真实录音、文件上传、语言选择、5 分钟 / 25MB 限制、ffmpeg 转码、费用预估、首次计费确认、可编辑结果、复制、TXT |
| Key | 页面内保存个人 Key、验证连接、清除 Key、个人 Key 优先 `.env`、不向浏览器回传完整 Key、无需重启 |
| 历史 | IndexedDB、30 条 / 80MB、TTS 音频 + STT 文本、单条删除、全部清空、Mock 标记 |
| 界面 | 暖纸 + 墨色 + 朱砂；浅色 / 深色 / 跟随系统三态外观；桌面双栏 / 移动端单列、模式切换、音色与语气浮层、键盘与触屏支持 |
| 工程 | TypeScript 严格模式、Vite 生产构建、Express API、Mock 模式、错误映射、限流、请求 ID |

### 0.2 v1 不包含

- SRT / 时间戳、字幕对齐（MiMo ASR 不返回时间戳）
- 实时说话出字（v1 使用录音后转写，不做流式 ASR）
- 多供应商自动降级（只接 MiMo）
- 超过 5 分钟的长音频、批量处理、视频转写
- 流式 TTS、声音克隆 / 声音设计
- 账号、云端同步、公开部署鉴权

### 0.3 已锁定决策

1. 个人自用；不做账号、云端同步和公开运营。
2. 只接 MiMo；TTS 与 ASR 共用同一套 MiMo Key。
3. Key 可来自页面设置或服务端 `.env`；**个人设置优先**，两者都只存在服务端。
4. SRT 与实时识别延后；v1 不做。
5. 单次文本 1,000 字符，单次音频 5 分钟；超过限制直接阻止，不做静默截断。
6. 转写按量计费；首次使用必须确认，失败不自动重试，不静默扣费。
7. 外观默认跟随系统，可选浅色 / 深色；偏好只存浏览器 `localStorage`，不写入服务端。

---

## 1. 产品定义

一个个人使用的 MiMo 专用语音工作台：

- **文字转语音**：输入文字 → 选音色、语气、语速 → 生成可播放/下载的语音。
- **语音转文字**：录音或上传音频 → 看到预估费用 → 确认后转写 → 编辑/复制/导出 TXT。
- **Key 自管理**：在页面设置中填入自己的 MiMo Key，保存后立即生效；也可以继续使用 `.env`。
- **本地优先**：历史只存在浏览器；服务端不保存文本和音频，只保存个人 Key 配置。

一句话：**打开就能转写或配音，Key 自己管，费用看得见，结果留在本机。**

---

## 2. 用户与核心流程

### 2.1 用户

个人创作者、学生或开发者，在自己机器 / 个人服务器上使用，不希望注册账号，也不想把历史内容上传到第三方数据库。

### 2.2 首次使用

```
打开页面
  → 若没有 Key：显示 SETUP 提示，引导打开设置
  → 设置中粘贴 Key → 保存并验证（/models）
  → 状态变为 MIMO READY
  → 开始 TTS 或 STT
```

也可在 `.env` 中配置 Key；个人设置优先于 `.env`。

### 2.3 TTS 流程

```
输入文本（≤1,000 字）
  → 选音色 / 语气 / 语速
  → 生成（可取消，超时 60s）
  → 成功：播放器 + 下载 + 写入本地历史
  → 失败：原因 + 重试；无备用供应商
```

### 2.4 STT 流程

```
录音（≤5 分钟）或上传文件（≤25MB / ≤5 分钟）
  → 读取时长并显示预估费用
  → 首次：确认计费；后续：按钮上显示费用
  → 服务端 ffmpeg 转 MP3 → MiMo ASR
  → 成功后编辑 / 复制 / 下载 TXT / 写入本地历史
  → 失败：原因 + 手动重试；不自动重试
```

---

## 3. 功能需求与实现状态

### 3.1 文字转语音（TTS）

| 编号 | 需求 | 实现状态 |
| --- | --- | --- |
| TTS-01 | 多行文本输入，保留换行，最多 1,000 字符，实时字数 | ✅ |
| TTS-02 | 示例文本、一键清空 | ✅ |
| TTS-03 | 9 个 MiMo 音色，按默认 / 中文 / 英文分组，选择器支持键盘与触屏 | ✅ |
| TTS-04 | 6 组语气预设；预设只是快捷填充，选中后仍可手动编辑 | ✅ |
| TTS-05 | 语速 0.5×–1.5×，步进 0.1 | ✅ |
| TTS-06 | 生成中可取消，超时 60 秒 | ✅ |
| TTS-07 | 自绘播放器、播放/暂停、进度、时长、下载 | ✅ |
| TTS-08 | 成功后写入 IndexedDB；可回放/下载历史音频 | ✅ |
| TTS-09 | 空文本 / 超长 / 401 / 429 / 超时 / 无音频的错误提示 | ✅ |
| TTS-10 | 只调用 MiMo TTS，不做自动降级 | ✅ |
| TTS-11 | 页面提示 TTS 当前限时免费，以官方计费为准 | ✅ |

**音色清单**

| 分组 | 音色 |
| --- | --- |
| 默认 | `mimo_default`（随集群） |
| 中文 | 冰糖、茉莉（女声）；苏打、白桦（男声） |
| 英文 | Mia、Chloe（女声）；Milo、Dean（男声） |

**语气预设分组**

- 通用：自然亲切、温柔深夜电台、沉稳新闻播报、纪录片旁白、短视频口播。
- 情绪：兴奋、低落、疲惫、紧张、严肃、温柔鼓励。
- 角色：说书人、小女孩、冷峻旁白、广告配音、老师。
- 场景：深夜电台、发布会、客服播报、有声书。
- 方言：四川口音、东北口音、粤语腔。
- 英文：温暖对话、专业新闻、明亮活力、低沉电影预告。

预设选择后写入同一个可编辑输入框，不限制用户继续改写。

### 3.2 语音转文字（STT）

| 编号 | 需求 | 实现状态 |
| --- | --- | --- |
| STT-01 | 浏览器真实录音，开始/停止，实时计时 | ✅ |
| STT-02 | 上传 mp3 / wav / m4a / webm / ogg / flac / mp4，≤25MB | ✅ |
| STT-03 | 单次最长 5 分钟；录音到点自动停止；上传前校验时长 | ✅ |
| STT-04 | 中文 / 英文 / 自动识别 | ✅ |
| STT-05 | 显示时长与预估费用；首次确认计费，状态存 localStorage | ✅ |
| STT-06 | 转写中可取消；失败不自动重试 | ✅ |
| STT-07 | 服务端 ffmpeg 转 16kHz 单声道 MP3；Base64 ≤10MB | ✅ |
| STT-08 | 结果可编辑、复制、下载 TXT | ✅ |
| STT-09 | STT 音频不存服务端、不存本地；历史只保存文本 | ✅ |
| STT-10 | 401 / 429 / 超时 / 无语音 / 格式错误 / 时长超限的错误提示 | ✅ |
| STT-11 | 无 SRT、无实时出字（v1 明确不做） | — |

MiMo ASR 当前约 ¥0.5/小时，按音频时长计费；第一次转写前必须确认，之后按钮上持续显示预估金额。实际金额以 MiMo 控制台账单为准。

### 3.3 个人 API Key 设置

| 编号 | 需求 | 实现状态 |
| --- | --- | --- |
| KEY-01 | 页面右上角「设置」打开 Key 管理弹窗 | ✅ |
| KEY-02 | 粘贴个人 Key，长度 8–512，仅接受可打印 ASCII | ✅ |
| KEY-03 | 保存后立即生效，无需重启 | ✅ |
| KEY-04 | 「验证连接」调用 MiMo `/models`，不生成音频/转写 | ✅ |
| KEY-05 | 显示 Key 来源（个人设置 / 服务端 `.env` / 未配置）与尾号提示 | ✅ |
| KEY-06 | 个人 Key 优先于 `.env`；清除后回退 `.env` | ✅ |
| KEY-07 | 完整 Key 不回传浏览器、不写日志 | ✅ |
| KEY-08 | 服务端存储 `data/settings.json`，尽量设为 `0600` | ✅ |
| KEY-09 | Mock 开启时，保存 Key 也不会调用 MiMo；关闭 Mock 并重启后生效 | ✅ |

### 3.4 本地历史

| 编号 | 需求 | 实现状态 |
| --- | --- | --- |
| HIS-01 | IndexedDB 存储，最多 30 条或 80MB | ✅ |
| HIS-02 | TTS 保存音频 Blob；STT 只保存文本 | ✅ |
| HIS-03 | 点击 STT 记录恢复文本；点击 TTS 记录加载音频 | ✅ |
| HIS-04 | 单条删除、全部清空；清空时删除音频 | ✅ |
| HIS-05 | Mock 记录有 `MOCK` 标记 | ✅ |
| HIS-06 | 历史读取失败时有提示，不阻塞主流程 | ✅ |

### 3.5 界面与交互

- 桌面：左侧品牌 / 说明 / 计费概览，右侧工作台；模式切换在工具台上方。
- 移动端：单列；模式切换、音色选择器、语气预设、历史和弹窗均适配窄屏。
- 顶部：MiMo 状态、外观菜单、设置、说明。
- 外观菜单位于顶栏状态与设置之间，提供跟随系统 / 浅色 / 深色三态，详见 3.6。
- 状态颜色：
  - `MIMO READY`：已连接。
  - `未配置 KEY`：无 Key。
  - `MOCK 模式`：开发 Mock。
  - `API 离线`：服务端不可达。
- 语音/语气弹层使用 Portal，跟随视口定位，支持触屏和键盘方向键。
- 所有交互按钮有可读标签；键盘焦点可见；支持 `prefers-reduced-motion`。

### 3.6 外观与主题

顶栏提供「跟随系统 / 浅色 / 深色」三态外观菜单，默认跟随系统。

| 编号 | 需求 | 实现状态 |
| --- | --- | --- |
| THM-01 | 顶栏外观菜单提供跟随系统 / 浅色 / 深色三种选择 | ✅ |
| THM-02 | 跟随系统时监听 `prefers-color-scheme`，系统外观变化后实时更新，无需刷新 | ✅ |
| THM-03 | 手动选择浅色或深色后不再受系统影响；刷新后保持 | ✅ |
| THM-04 | 偏好保存在浏览器 `localStorage`（`shengxi-theme`），不写服务端 | ✅ |
| THM-05 | 首次绘制前由内联脚本应用已保存主题，避免刷新闪白 | ✅ |
| THM-06 | 深色主题覆盖页面、面板、浮层、对话框、表单、状态色与阴影；正文、辅助信息与强调色保持可读 | ✅ |
| THM-07 | 同步 `color-scheme` 与 `theme-color`，浏览器原生控件和地址栏跟随外观 | ✅ |
| THM-08 | 外观菜单支持键盘打开、Esc 关闭并归还焦点；窄屏弹层右对齐、不溢出 | ✅ |
| THM-09 | 外观仅改变前端展示，不涉及 API、服务端存储或历史数据 | ✅ |

外观属于设备级偏好：删除 `shengxi-theme` 会回到「跟随系统」；清除整站数据会同时删除本地历史。本轮不做跨设备同步。

---

## 4. 非功能需求

| 类别 | 要求 | 当前情况 |
| --- | --- | --- |
| 性能 | 初始 JS 目标 ≤180KB gzip | 当前约 92KB gzip |
| 字体 | 不加载中文 Web Font | 中文使用系统宋体/无衬线；拉丁字体来自 Google Fonts，可回退 |
| 外观 | 默认跟随系统，支持浅色 / 深色并即时响应系统变化 | 已通过浏览器验证；偏好仅存本机 |
| 响应式 | 375px 以上可用 | 已验证 1440 / 390 / 320 无横向溢出 |
| 浏览器 | Chromium 优先；麦克风需安全上下文 | Chrome/Edge 验证；录音依赖 MediaRecorder；主题半透明强调色使用 `color-mix()`（Chromium 111+） |
| 可访问性 | 键盘可完成主流程，焦点可见 | 模式切换、音色/语气浮层、外观菜单、弹窗均有键盘支持 |
| 限流 | 防止误操作和额度滥用 | TTS 10/min、STT 5/min、设置 20/min |
| 安全 | Key 不下发浏览器、不打印正文 | 服务端保存 Key；日志只记元数据 |

---

## 5. 技术架构

```text
浏览器（React 19 + TypeScript + Vite 8）
  ├─ TTS / STT / 历史 / 设置
  ├─ MediaRecorder 录音
  ├─ IndexedDB（历史 + TTS 音频）
  └─ fetch /api/*（浏览器不持有 Key）
              │
Express 5（Node 22+）
  ├─ /api/tts  → MiMo chat/completions + audio
  ├─ /api/stt  → ffmpeg → MiMo chat/completions + input_audio
  ├─ /api/settings/* → Key 保存/验证/清除
  ├─ Key 优先级：data/settings.json > .env
  ├─ Zod、Multer、express-rate-limit、统一错误
  ├─ ffmpeg / ffprobe（npm 平台二进制）
  └─ 生产环境托管 client/dist
```

### 5.1 技术栈（实际）

| 层 | 选型 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite 8 |
| 样式 | 手写 CSS + CSS 变量；`data-theme` 深色令牌与 `color-mix()`（不使用 Tailwind） |
| 图标 | lucide-react |
| 状态 | React hooks + 组件级本地状态 |
| 本地存储 | `idb`（IndexedDB）+ localStorage |
| 服务端 | Node 22+、Express 5、tsx（开发） |
| 校验 / 上传 / 限流 | Zod、Multer、express-rate-limit |
| 音频 | `@ffmpeg-installer/ffmpeg`、`@ffprobe-installer/ffprobe` |
| 构建 | `tsc` + Vite |
| 测试 | 仓库未提交测试套件；使用 typecheck / build / Mock 端到端手动验证 |

### 5.2 关键实现

- `client/src/components/SettingsDialog.tsx`：个人 Key 保存、验证、清除。
- `client/src/components/ThemeMenu.tsx`：顶栏三态外观菜单、右对齐浮层与焦点归还。
- `client/src/hooks/useTheme.ts`：外观模式、系统偏好监听、localStorage 持久化与 `theme-color` 同步。
- `client/index.html`：内联脚本在首帧前应用已保存主题，避免闪白。
- `server/src/settings.ts`：Key 持久化与来源解析。
- `server/src/mimo.ts`：TTS、ASR、Key 验证（`/models`）。
- `client/src/hooks/useRecorder.ts`：真实录音、5 分钟自动停止。
- `server/src/audio.ts`：ffprobe 时长、ffmpeg 转 MP3、Mock WAV。
- `client/src/lib/db.ts`：历史/音频的 IndexedDB 存取与清理。

---

## 6. API 契约

### 6.1 接口清单

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查、当前模式 |
| GET | `/api/config` | 模式、Key 来源/尾号、音色、限额、价格 |
| POST | `/api/tts` | `{ text, voiceId, style, speed }` → 音频二进制 |
| POST | `/api/stt` | multipart `file`、`language`、`durationSec` → 文本/费用 |
| POST | `/api/settings/mimo-key` | `{ apiKey }` 保存个人 Key |
| DELETE | `/api/settings/mimo-key` | 清除个人 Key |
| POST | `/api/settings/mimo-key/test` | 通过 `/models` 验证当前 Key |

### 6.2 模式

- `live`：有 Key（个人设置或 `.env`），真实调用 MiMo。
- `mock`：`MOCK_MIMO=1`；返回本地示例 WAV / 固定转写文本。
- `unconfigured`：无 Key；TTS/STT 接口返回 503。

`/api/config` 返回：

```json
{
  "mode": "live",
  "mimoConfigured": true,
  "mock": false,
  "keySource": "settings",
  "keyHint": "4 位尾号",
  "envConfigured": true,
  "voices": [],
  "limits": {},
  "tts": { "model": "mimo-v2.5-tts", "free": "limited" },
  "stt": { "model": "mimo-v2.5-asr", "pricePerHourCny": 0.5 }
}
```

### 6.3 限额

| 项 | 值 |
| --- | --- |
| TTS 文本 | 1,000 字符 |
| 语气描述 | 80 字 |
| 语速 | 0.5–1.5 |
| STT 单次时长 | 300 秒 |
| STT 上传 | 25MB |
| MiMo ASR Base64 | 10MB |
| 历史上限 | 30 条 / 80MB |
| TTS 限流 | 10 次/分钟 |
| STT 限流 | 5 次/分钟 |
| 设置限流 | 20 次/分钟 |

### 6.4 错误码（主要）

`VALIDATION_ERROR`、`MIMO_NOT_CONFIGURED`、`PROVIDER_AUTH_ERROR`、`PROVIDER_RATE_LIMITED`、`PROVIDER_UNAVAILABLE`、`PROVIDER_TIMEOUT`、`PROVIDER_RESPONSE_INVALID`、`AUDIO_TOO_LONG`、`AUDIO_TOO_LARGE`、`AUDIO_DURATION_UNKNOWN`、`TRANSCODE_FAILED`、`RATE_LIMITED`、`INTERNAL_ERROR`。

错误统一返回：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "用户可读的中文说明",
    "requestId": "..."
  }
}
```

---

## 7. 数据、Key 与隐私

### 7.1 数据流

| 功能 | 数据 | 去向 | 服务端留存 |
| --- | --- | --- | --- |
| TTS | 文本、音色、语气、语速 | 服务端 → MiMo TTS | 不保存文本/音频 |
| STT | 音频、语言 | 服务端转码 → MiMo ASR | 音频仅内存/临时目录，处理完删除 |
| Key | 个人 Key | 浏览器 → 服务端 `data/settings.json` | 保存；只显示尾号 |
| 历史 | 文本、TTS 音频、参数 | 浏览器 IndexedDB | 服务端不接触 |
| 外观 | 主题偏好 | 浏览器 `localStorage` | 服务端不接触 |

### 7.2 安全要求

- 完整 Key 不回传浏览器；`/api/config` 只返回来源和尾号。
- `data/settings.json` 与 `.env` 均在 `.gitignore` 中；Key 不写日志。
- 设置接口没有鉴权，服务默认绑定 `127.0.0.1`。**公开部署前必须加认证、HTTPS、访问控制和配额。**
- 服务端不记录正文；只记录请求 ID、状态、耗时、字符数/音频时长等元数据。
- 转写和合成结果需要人工核对；不要上传敏感/机密音频。
- Windows 不强制 POSIX `0600` 权限；需要另外保护 `data/` 目录。

---

## 8. 验证与验收

### 8.1 已验证（仓库内 / Mock）

- `npm run typecheck` 通过。
- `npm run build` 通过；前端初始 JS 约 92KB gzip。
- Mock 端到端：TTS 生成/播放/下载、真实录音、上传、费用确认、转写、刷新后历史、删除/清空、历史回放。
- 只读 UI 回归：设置弹窗、9 音色、6 组语气预设、模式切换、1440 / 390 / 320 布局；未触发真实 MiMo 调用。
- 外观验证：默认跟随系统；模拟系统深浅色切换时页面与 `theme-color` 实时更新；手动浅 / 深色刷新后保持。
- 深色 UI 抽查：顶栏、首页、TTS 面板、设置弹窗、音色弹层、外观弹层；1280 / 390 / 320 宽度无横向溢出。
- 外观菜单：Esc 关闭并归还焦点；320px 弹层右对齐、不溢出。
- 1440 / 390 / 320 宽度无横向溢出，无控制台报错。
- Key 设置、音色选择、语气预设的点击 / Esc 交互已验证；触屏浮层建议真机复查。

### 8.2 真实接口

- 真实 MiMo 连通性可通过页面「设置 → 验证连接」确认。
- 验证通过后状态显示 `MIMO READY`；实际 TTS/ASR 结果以 MiMo 返回为准。
- 仓库未提交自动化真实 API 测试，避免消耗额度。

### 8.3 验收清单

| 编号 | 结果 |
| --- | --- |
| AC-01 TTS 生成可播放音频 | ✅（Mock 验证；真实调用需 Key） |
| AC-02 TTS 取消/超时/失败提示 | ✅ |
| AC-03 STT 录音/上传/5 分钟限制 | ✅ |
| AC-04 首次计费确认与费用展示 | ✅ |
| AC-05 STT 音频不持久化 | ✅（代码路径） |
| AC-06 Key 保存/验证/清除/优先级 | ✅（代码与交互） |
| AC-07 历史持久化/删除/清空 | ✅ |
| AC-08 响应式与键盘操作 | ✅ |
| AC-09 完整 Key 不出现在浏览器/API 响应 | ✅ |
| AC-10 真实 MiMo TTS/ASR 端到端 | 以设置页验证结果为准 |
| AC-11 浅色 / 深色 / 跟随系统切换与系统实时跟随 | ✅ |
| AC-12 外观偏好刷新保持，深色弹窗与浮层可读 | ✅ |

---

## 9. 风险与后续

### 9.1 风险

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| MiMo TTS 结束限时免费 | TTS 出现成本 | 页面链接官方价格；显示以官方为准；暂无备用线路 |
| MiMo ASR 按量计费 | 转写有成本 | 5 分钟上限、费用预估、首次确认、不自动重试 |
| MiMo API 不可用 | 单一线路故障 | 明确报错与手动重试；不做隐藏降级 |
| Key 被他人获取 | 额度/费用损失 | 仅本机访问、Key 服务端存储、`.gitignore`、必要时清除/更换 |
| 设置接口无鉴权 | 暴露后他人可改 Key | 默认绑定 localhost；公网部署前加认证 |
| 5 分钟限制 | 会议等长音频不可用 | 后续做切片与文本拼接 |
| 无 SRT / 实时 | 功能缺口 | 作为后续版本；SRT 需时间戳 ASR 或本地对齐 |
| ffmpeg 平台差异 | 转码失败 | 依赖 npm 平台二进制；README 说明重新安装 |

### 9.2 后续版本

- SRT / 时间戳（需支持时间戳的 ASR 或本地强制对齐）
- 实时识别
- 长音频切片与合并
- 多供应商备用线路
- 流式 TTS
- 声音克隆 / 声音设计（需授权与合规评估）
- 公开部署的认证、配额与人机验证
- 批量文件、视频转写

---

## 10. 运行与配置

完整步骤见 [README.md](./README.md)。

- 开发：`npm run dev` → <http://127.0.0.1:5173>
- 生产：`npm run build && npm start` → <http://127.0.0.1:8787>
- Key：右上角设置，或 `.env` 的 `MIMO_API_KEY`
- 无 Key 预览：`.env` 设置 `MOCK_MIMO=1` 并重启
- 个人 Key 优先于 `.env`；清除个人 Key 后回退
- 外观：右上角外观菜单选择跟随系统 / 浅色 / 深色；偏好保存在浏览器，不通过 `.env` 配置

---

## 附录：MiMo 请求形态

### TTS

```json
{
  "model": "mimo-v2.5-tts",
  "messages": [
    { "role": "user", "content": "温柔、自然、稍慢" },
    { "role": "assistant", "content": "要朗读的文本" }
  ],
  "audio": { "format": "mp3", "voice": "冰糖" },
  "stream": false
}
```

### ASR

```json
{
  "model": "mimo-v2.5-asr",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_audio",
          "input_audio": { "data": "data:audio/mpeg;base64,<MP3_BASE64>" }
        }
      ]
    }
  ],
  "asr_options": { "language": "zh" }
}
```

服务端会同时发送 `api-key` 与 OpenAI 兼容的 Bearer 鉴权头；以 MiMo 官方为准。

## 参考来源

- MiMo 价格：<https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go>
- MiMo TTS：<https://mimo.mi.com/models/en-US/mimo-v2.5-tts>
- MiMo ASR：<https://mimo.mi.com/models/en-US/mimo-v2.5-asr>
- MiMo ASR API：<https://mimo.mi.com/docs/zh-CN/api/audio/Speech-Recognition>
- MiMo ASR 使用指南：<https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/Speech-Recognition>
