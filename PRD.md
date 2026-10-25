# 声息 · 纯 MiMo 语音工作台 MVP 需求文档

| 项目 | 内容 |
| --- | --- |
| 版本 | v1.1（纯 MiMo MVP） |
| 日期 | 2026-10-25 |
| 状态 | 待开发，确认后进入 M0 |
| 使用范围 | **个人自用**（本机 / 个人 VPS） |
| 产品形态 | Web 单页应用，桌面优先，移动端可用 |
| 外部 API | **仅小米 MiMo**：TTS + ASR |
| 技术栈 | React + TypeScript + Vite / Node + Express / IndexedDB / ffmpeg |
| 预计工期 | 3–5 人日 |

---

## 0. 决策摘要

第一版只接入小米 MiMo API，不做多供应商：

| 能力 | 方案 | 费用 | 说明 |
| --- | --- | --- | --- |
| 文字转语音 | `mimo-v2.5-tts` | 当前限时免费 | 预设音色；不支持时无备用线路 |
| 语音转文字 | `mimo-v2.5-asr` | **¥0.5/小时** | 每次转写都会产生费用；无免费替代 |
| SRT 时间戳 | **v1 不做** | — | MiMo ASR 官方不返回时间戳/分段 |
| 实时说话出字 | **v1 不做** | — | MiMo 无实时音频流式识别；不使用浏览器 Web Speech |

**已锁定决策**

1. 个人自用；不做账号、不做云端同步、不做公开运营防刷。
2. 第一版只接 MiMo，TTS 与 ASR 共用 `MIMO_API_KEY`。
3. SRT 与实时识别移出 v1；后续若要 SRT，需要额外接入支持时间戳的 ASR 或本地强制对齐。
4. MiMo ASR 是唯一转写线路，必须让用户清楚看到时长与预估费用；首次使用显式确认，之后每次仍展示预估。
5. 单次音频上限 **5 分钟**，避免触及 MiMo 的上下文与 10MB Base64 限制；长音频后续做切片。

### 相对 v1.0 的变化

- 移除 Edge TTS 兜底、Groq Whisper、浏览器 Web Speech、MiMo 付费线路开关。
- 移除 SRT、时间戳展示、实时识别、双 STT 模式。
- STT 从“免费优先”变成“按量付费”，因此增加费用预估与确认流程。
- 音频上限从 10 分钟降到 5 分钟；文件统一转成 MP3 后提交。
- 供应商选择、降级路由、多 Key 配置全部删除，架构显著简化。

---

## 1. 产品定义

一个个人使用的 MiMo 专用语音工作台：

- **文字转语音**：输入文字 → 选择 MiMo 音色/语气/语速 → 生成 MP3 → 试听、下载。
- **语音转文字**：录音或上传音频 → 看到时长与预估费用 → 确认后调用 MiMo ASR → 编辑、复制、导出 TXT。
- **本地优先**：历史只存浏览器；TTS 音频可存本地，STT 音频不在服务端或本地持久化。
- **只有一条线路**：MiMo 不可用时直接报错，不自动切换到其他供应商。

一句话：**一个只服务 MiMo 的轻量语音工具，TTS 限时免费，STT 明码计费。**

---

## 2. 目标与非目标

### 2.1 MVP 目标

| 编号 | 目标 | 验收口径 |
| --- | --- | --- |
| G1 | TTS 完整可用 | 1,000 字内生成 MP3，可试听、下载、进历史 |
| G2 | STT 完整可用 | 5 分钟内音频可录音/上传，转写文本可编辑、复制、导出 TXT |
| G3 | 费用透明 | 转写前显示时长与预估费用；首次使用需确认；不静默请求 |
| G4 | 密钥安全 | 前端产物与请求中无 Key；日志无正文 |
| G5 | 轻量可读 | 初始 JS ≤ 180KB gzip；LCP ≤ 2s（4G）；正文 ≥ 15px |

### 2.2 非目标

- SRT、时间戳、字幕对齐。
- 实时语音识别、边说边出字。
- Edge TTS、Groq、Azure、Google、讯飞等任何其他供应商。
- 声音克隆、声音设计、说话人分离、会议摘要。
- 长音频（>5 分钟）、批量处理、视频转写。
- 用户账号、云端同步、公开 API、多用户并发。
- 深色模式、英文界面、公开部署风控。
- 服务端缓存、任务队列、音频 CDN。

---

## 3. 核心流程

### 3.1 TTS

```
输入文字（1–1,000 字）
  → 选择音色 / 语气 / 语速
  → 生成（60s 超时，可取消）
  → 成功：播放器 + 下载 MP3 + 写入本地历史
  → 失败：说明原因 + 重试；无备用线路
```

### 3.2 STT

```
录音（≤5 分钟）或上传文件（≤25MB / ≤5 分钟）
  → 本地读取时长
  → 显示「MiMo ASR ¥0.5/小时 · 预计 ¥0.04」
  → 首次使用：弹窗确认计费；后续：按钮直接确认
  → 服务端校验 → ffmpeg 转 MP3（16kHz 单声道）→ Base64
  → MiMo ASR → 返回文本
  → 编辑 / 复制 / 下载 TXT / 写入历史
  → 失败：原因 + 手动重试（不自动重试，避免重复计费）
```

---

## 4. 功能需求

### 4.1 文字转语音（TTS）

| 编号 | 需求 | 规格 |
| --- | --- | --- |
| TTS-01 | 文本输入 | 多行文本框；保留换行；上限 1,000 字符；实时字数；空内容禁用生成 |
| TTS-02 | 快速操作 | 示例文本、一键清空 |
| TTS-03 | 音色 | MiMo 预设音色；按语言分组；默认中文音色；列表以 M0 实测为准 |
| TTS-04 | 语气描述 | 可选，≤80 字；如「温柔、稍慢，像深夜电台」；通过自然语言指令传递 |
| TTS-05 | 语速 | 0.5x–1.5x，步进 0.1，默认 1.0x；映射为自然语言指令（如「约 0.9 倍语速」） |
| TTS-06 | 生成 | 同时只允许一个任务；可取消；超时 60 秒；失败可重试 |
| TTS-07 | 播放 | 自绘播放器：播放/暂停、进度、当前/总时长；不强制自动播放 |
| TTS-08 | 下载 | 仅 MP3；文件名 `shengxi-{voice}-{YYYYMMDD-HHmm}.mp3` |
| TTS-09 | 历史 | 成功后保存文本、参数、音频 Blob；可再次播放/下载 |
| TTS-10 | 费用提示 | 页面标注「MiMo TTS 当前限时免费，以官方计费为准」，附官方价格页链接 |

**失败处理**

- MiMo 超时、429、5xx、空音频：显示具体原因与「重试」。
- **没有备用供应商**；不调用其他服务，不产生隐藏费用。

### 4.2 语音转文字（STT）

| 编号 | 需求 | 规格 |
| --- | --- | --- |
| STT-01 | 录音 | 麦克风授权；开始/停止；计时；最长 5 分钟；到点自动停止并保留音频等待确认 |
| STT-02 | 上传 | 拖拽/选择文件；支持 mp3 / wav / m4a / webm / ogg / flac / mp4；输入文件 ≤25MB；时长 ≤5 分钟 |
| STT-03 | 时长读取 | 上传后读取音频时长；无法读取时提示并拒绝提交 |
| STT-04 | 费用预估 | 展示「¥0.5/小时 · 本次约 ¥X.XX」；首次使用弹窗确认，确认状态存 localStorage |
| STT-05 | 提交 | 只有用户点击「开始转写」才调用 API；取消则释放音频，不产生请求 |
| STT-06 | 服务端处理 | 校验时长/大小/格式 → ffmpeg 转 MP3（16kHz 单声道，约 48kbps）→ Base64 ≤10MB → MiMo ASR |
| STT-07 | 语言 | 中文（默认）/ 英文；不提供自动检测；通过 `asr_options.language` 传递，取值以 M0 为准 |
| STT-08 | 结果 | 展示可编辑文本、音频时长、实际供应商、预估费用；支持复制、TXT 下载、清空 |
| STT-09 | 历史 | 保存文本、时长、费用预估、供应商；**不保存音频** |
| STT-10 | 重试 | 失败后仅手动重试；每次重试都展示费用；不自动重复提交 |
| STT-11 | 隐私 | 音频仅在内存中处理，服务端不落盘；页面说明音频会发送给 MiMo |
| STT-12 | 明确不支持 | 无实时出字、无时间戳、无 SRT、无说话人分离 |

**文件与时长限制说明**

- MiMo ASR 仅接受 WAV / MP3；Base64 后 ≤10MB。
- 其上下文约 8K tokens，单次音频实际安全上限约 5–10 分钟；MVP 取 **5 分钟**。
- 统一转成 MP3 可显著降低体积，避免 WAV 在 5 分钟时超出 Base64 限制。
- 超过 5 分钟直接拒绝，提示「第一版单次最长 5 分钟，长音频将在后续版本支持」。

### 4.3 费用与确认

| 项目 | 规则 |
| --- | --- |
| ASR 单价 | ¥0.5/小时（MiMo 官方国内价；海外价另计） |
| 预估公式 | `时长秒 / 3600 × 0.5`，保留 2 位小数；不足 0.01 元按 0.01 元展示 |
| 首次确认 | 首次转写弹窗：「MiMo ASR 按音频时长计费，本次约 ¥X.XX。继续？」确认后记住 |
| 后续确认 | 按钮文案「开始转写 · 约 ¥X.XX」；点击即视为确认 |
| TTS 费用 | 当前限时免费；只展示官方说明，不做扣费逻辑 |
| 账单差异 | 预估仅供参考，实际以 MiMo 控制台账单为准；结果区标注 |
| 禁止 | 自动重试、后台预转写、未点击就调用、隐藏费用 |

### 4.4 本地历史

| 编号 | 需求 | 规格 |
| --- | --- | --- |
| HIS-01 | 存储 | IndexedDB；TTS 音频 Blob；设置与首次计费确认用 localStorage |
| HIS-02 | 容量 | 最多 30 条或 80MB；超出按最旧淘汰 |
| HIS-03 | 内容 | 类型（TTS / STT）、时间、文本、音色/参数、时长、费用预估；仅 TTS 有音频 |
| HIS-04 | 操作 | 打开、TTS 再次播放/下载、单条删除、全部清空 |
| HIS-05 | 隐私 | STT 音频不保存；清空后删除 Blob；提供「本次不保存历史」开关 |

### 4.5 错误与提示

| 场景 | 提示 | 行为 |
| --- | --- | --- |
| 文本为空 / 超 1,000 字 | 对应提示 | 不请求 |
| 录音到 5 分钟 | 「已达单次上限，已停止录音」 | 保留录音，等待确认转写 |
| 文件超 25MB | 显示大小与上限 | 本地拒绝 |
| 文件超 5 分钟 | 显示时长与上限 | 不提交 |
| 无法读取时长 | 「无法读取音频时长，请换一个文件」 | 不提交 |
| 转码失败 | 「音频格式无法处理」 | 不调用 MiMo |
| Base64 超 10MB | 「音频过大」 | 不调用 MiMo |
| MiMo TTS 失败 | 原因 + 重试 | 无备用线路 |
| MiMo ASR 失败 | 原因 + 手动重试（再次显示费用） | 不自动重试 |
| 429 | 「MiMo 当前限流，请稍后重试」 | 不自动重试 |
| 麦克风被拒 | 权限恢复指引 + 上传入口 | 不重复弹权限 |
| 首次计费未确认 | 计费弹窗 | 未确认不发起请求 |

统一错误码：`VALIDATION_ERROR`、`TEXT_TOO_LONG`、`AUDIO_TOO_LONG`、`AUDIO_TOO_LARGE`、`UNSUPPORTED_FORMAT`、`TRANSCODE_FAILED`、`PROVIDER_RATE_LIMITED`、`PROVIDER_UNAVAILABLE`、`TIMEOUT`、`INTERNAL_ERROR`。

---

## 5. MiMo API 接入

> 以下信息来自 2026-10-25 官方文档与公开实测；M0 必须用真实 Key 再核对一次。

### 5.1 TTS

- 端点：`POST https://api.xiaomimimo.com/v1/chat/completions`
- 模型：`mimo-v2.5-tts`
- 鉴权：`api-key: $MIMO_API_KEY`（社区实测；M0 复核）
- 请求：`messages` + `audio: { format: "mp3", voice }`
- 文本放在 assistant 消息，语气/语速放 user 消息
- 输出：MP3（Base64 在响应 JSON 中；具体字段 M0 确认）
- 计费：当前限时免费
- 预设音色（M0 核对）：`mimo_default`、`default_zh`、`default_en`、`Mia`、`Chloe`、`Milo`、`Dean`
- 参考请求：

```json
{
  "model": "mimo-v2.5-tts",
  "messages": [
    { "role": "user", "content": "温柔、自然、稍慢" },
    { "role": "assistant", "content": "要朗读的文本" }
  ],
  "audio": { "format": "mp3", "voice": "mimo_default" },
  "stream": false
}
```

### 5.2 ASR

- 端点：`POST https://api.xiaomimimo.com/v1/chat/completions`
- 模型：`mimo-v2.5-asr`
- 鉴权：官方示例使用 `api-key` / OpenAI 兼容 Bearer；M0 复核并统一封装
- 输入：`messages[0].content[0].input_audio.data` 为 Base64 Data URI
- 支持格式：WAV / MP3
- 限制：Base64 ≤10MB；上下文约 8K tokens；单次安全时长约 5–10 分钟；RPM 约 100
- 返回：`choices[0].message.content` 为转写文本；**无时间戳/分段**
- 计费：¥0.5/小时（国内）
- 参考请求：

```json
{
  "model": "mimo-v2.5-asr",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_audio",
          "input_audio": { "data": "data:audio/mp3;base64,<BASE64>" }
        }
      ]
    }
  ],
  "asr_options": { "language": "zh" }
}
```

### 5.3 音频处理链路

```
录音（MediaRecorder: webm/mp4）
或上传（mp3/wav/m4a/webm/ogg/flac/mp4）
  → 上传到服务端（内存，≤25MB）
  → ffmpeg 读取时长（≤5 分钟）
  → ffmpeg 转 MP3：16kHz、单声道、约 48kbps
  → 检查 Base64 ≤10MB
  → 调用 MiMo ASR
  → 返回文本 + 时长
  → 释放音频内存
```

- 不做服务端持久化；处理完立即释放。
- 录音同样走上传转写链路；不做实时识别。
- 若 M0 发现 MP3 输入不稳定，回退为 16kHz 单声道 WAV，并把上限降到 3 分钟。
- 费用预估使用客户端读取的时长；最终以服务端 ffmpeg 读取的时长为准展示。

### 5.4 M0 验证清单（0.5–1 天）

1. **TTS**：鉴权头、请求/响应字段、1,000 字耗时、MP3 输出、音色列表、语气与语速是否生效。
2. **TTS 限流**：429 的响应形态；免费截止日期是否可见。
3. **ASR**：`api-key` 与 Bearer 哪个有效；WAV/MP3 均可；5 分钟音频是否稳定；返回文本格式。
4. **ASR 限额**：Base64 10MB 边界、8K token 对应时长、RPM 100 的实际表现。
5. **确认无时间戳**：官方文档与实测均确认无 `segments`/`timestamps`，v1 据此不实现 SRT。
6. **转码链路**：Chrome webm、Safari mp4、m4a、wav 转 MP3 后识别是否正常。
7. **计费口径**：5 分钟实际扣费是否约 ¥0.042；响应中是否返回音频秒数。

---

## 6. 页面与交互

### 6.1 页面结构

单页，两个模式，无供应商选择。

```
┌────────────────────────────────────────────────────────────┐
│ 声息 / MiMo 语音工作台                          隐私说明  │
├────────────────────────────────────────────────────────────┤
│        [ 语音转文字 ]      [ 文字转语音 ]                   │
│        ──────────────                                   │
│                                                            │
│  ┌────────── 语音转文字 ──────────────────────────────┐    │
│  │                                                    │    │
│  │        ● 开始录音          或  拖入音频文件         │    │
│  │        最长 5 分钟             mp3 / wav / m4a…    │    │
│  │                                                    │    │
│  │  已选：meeting.mp3 · 03:12 · 约 ¥0.03              │    │
│  │  MiMo ASR ￥0.5/小时，以官方账单为准               │    │
│  │                              [ 开始转写 · ¥0.03 ]  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  转写结果                                        复制 TXT  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 今天讨论了三件事……                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│  由 MiMo ASR 提供 · 音频不会保存在本站 · 结果需人工核对    │
│                                                            │
│  历史记录                                          [清空]  │
│  10-25 14:32  语音转文字  今天讨论了三件事…  ¥0.03  [删除]│
└────────────────────────────────────────────────────────────┘
```

### 6.2 TTS 页面

```
┌────────── 文字转语音 ──────────────────────────────┐
│  ┌──────────────────────────────────────────────┐  │
│  │ 粘贴或输入文字…                              │  │
│  └──────────────────────────────────────────────┘  │
│  0 / 1000                         [示例] [清空]   │
│  音色 [默认中文 ▾]   语速 [1.0x ▾]                │
│  语气 [温柔、稍慢…（可选）]                       │
│                                   [ 生成语音 ]    │
└──────────────────────────────────────────────────┘
┌────────── 播放器（生成后出现） ───────────────────┐
│  ▶  ━━━━━━━●────────  00:03 / 00:18   [下载]     │
│  由 MiMo TTS 提供 · 当前限时免费                  │
└──────────────────────────────────────────────────┘
```

### 6.3 交互规则

- 模式用 `#tts` / `#stt` 记录，刷新后恢复。
- 录音结束或文件选择后，必须显示时长与费用，才出现「开始转写」。
- 首次计费确认弹窗有「我已知晓」复选框；确认后写入 localStorage。
- 转写中显示进度/等待状态，可取消；取消后不自动重试。
- 生成/转写成功时，焦点落到播放器或结果文本域。
- 错误提示紧贴操作区，不用全屏弹窗（计费确认除外）。
- 历史条目点击恢复文本；TTS 可恢复播放器；STT 不保留音频。

### 6.4 视觉规范

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#F6F4EF` | 暖白纸面 |
| `--surface` | `#FFFEFB` | 卡片、输入区 |
| `--ink` | `#171714` | 主文字 |
| `--muted` | `#6B675F` | 辅助文字（对比度 ≥4.5:1） |
| `--line` | `#E2DDD3` | 边框、分隔线 |
| `--accent` | `#B8462A` | 朱砂：主操作、录音、进度 |
| `--accent-soft` | `#F3E4DD` | 选中背景 |
| `--ok` | `#1F6B4F` | 免费/成功标识 |
| `--danger` | `#A42A1E` | 错误、费用提醒 |

- 正文 15–16px；辅助文字 ≥13px；不使用 10px 以下功能文字。
- 系统字体，不加载中文 Web Font；标题可用系统宋体栈。
- 页面最大宽度 920px；圆角 14px；触控目标 ≥44px。
- 无紫色渐变、无玻璃拟态、无 AI 光晕。
- 动效 160–220ms；尊重 `prefers-reduced-motion`。

### 6.5 响应式与可访问性

- 375px 起可用；参数区纵向堆叠；主按钮保持可见。
- 模式切换支持键盘左右键；图标按钮有 `aria-label`。
- 录音状态用 `aria-live="polite"` 播报开始/停止。
- 费用弹窗使用原生 `dialog` 或焦点陷阱；Esc 可关闭且不发起请求。
- 焦点可见；错误不只靠颜色；对比度 ≥4.5:1。
- 最低目标 WCAG 2.1 AA。

---

## 7. 技术方案

### 7.1 架构

```
浏览器（React + TS + Vite）
  ├─ TTS 工作台 / STT 工作台 / 历史
  ├─ 录音：MediaRecorder（无实时识别）
  ├─ 本地：IndexedDB（历史 + TTS 音频）、localStorage（设置/计费确认）
  └─ fetch /api/*（前端无 Key）
              │ HTTPS / 同源
Node 服务（Express + TS）
  ├─ POST /api/tts → mimo-v2.5-tts
  ├─ POST /api/stt → 校验 → ffmpeg → base64 → mimo-v2.5-asr
  ├─ GET /api/config → 音色、单价、限制
  ├─ 限流、错误映射、日志脱敏
  └─ MIMO_API_KEY 仅存环境变量
```

### 7.2 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 前端 | React 19 + TypeScript + Vite | 单页交互、构建快 |
| 样式 | Tailwind CSS v4 + CSS 变量 | 快速实现极简设计 |
| 本地 | `idb` + localStorage | 音频 Blob 用 IndexedDB |
| 图标 | `lucide-react` | 线性图标 |
| 服务端 | Node 22 + Express 5 + TS | 音频转码与长请求 |
| 校验 | Zod | 请求参数校验 |
| 上传 | `multer`（内存） | 不落盘，处理完释放 |
| 音频 | `ffmpeg-static` + `ffprobe-static` | 转 MP3、读取时长 |
| 测试 | Vitest + Testing Library + Playwright | 核心链路 |

### 7.3 目录建议

```
re-tts/
  client/
    src/
      components/        # 播放器、录音器、历史列表、费用弹窗
      features/tts/
      features/stt/
      lib/               # api.ts、db.ts、audio.ts、cost.ts
  server/
    src/
      routes/            # tts.ts、stt.ts、config.ts、health.ts
      providers/mimo.ts  # TTS + ASR 请求与响应解析
      lib/               # validate.ts、transcode.ts、errors.ts、rateLimit.ts
  .env.example
  docker-compose.yml
```

### 7.4 接口契约

**`GET /api/config`**

```json
{
  "tts": {
    "voices": [
      { "id": "mimo_default", "label": "默认", "language": "zh" },
      { "id": "default_zh", "label": "中文", "language": "zh" }
    ],
    "free": "limited"
  },
  "stt": {
    "pricePerHourCny": 0.5,
    "maxDurationSec": 300,
    "maxUploadBytes": 26214400,
    "maxBase64Bytes": 10485760
  }
}
```

**`POST /api/tts`**

```json
{
  "text": "要合成的文本",
  "voiceId": "mimo_default",
  "style": "温柔、稍慢",
  "speed": 1.0
}
```

- 成功：`audio/mpeg` 二进制；响应头 `X-Provider: mimo`、`X-Request-Id`、`Content-Disposition`。
- 失败：`{ "error": { "code", "message", "requestId" } }`。

**`POST /api/stt`**（multipart/form-data）

| 字段 | 说明 |
| --- | --- |
| `file` | 音频文件，≤25MB |
| `language` | `zh` / `en` |

成功：

```json
{
  "text": "转写全文",
  "provider": "mimo",
  "durationSec": 192.4,
  "estimatedCostCny": 0.03
}
```

- 服务端重新读取时长并校验 ≤300 秒；超过直接返回 `AUDIO_TOO_LONG`。
- 不返回 segments；v1 无 SRT。
- 429 透传 `Retry-After`。

**`GET /api/health`**：服务状态与 MiMo Key 是否已配置。

### 7.5 数据模型

```ts
type HistoryItem = {
  id: string;
  mode: "tts" | "stt";
  createdAt: number;
  text: string;
  provider: "mimo";
  voiceId?: string;
  style?: string;
  speed?: number;
  durationSec?: number;
  estimatedCostCny?: number;
  audioKey?: string;     // 仅 TTS
  sizeBytes?: number;
};
```

- `history`：元数据 + 文本；`audio`：仅 TTS 的 MP3 Blob。
- 30 条 / 80MB；写入前按最旧淘汰。
- localStorage：最近音色/语速、计费确认标记、是否保存历史。
- Object URL 用完释放。

### 7.6 安全与部署

- 环境变量：`MIMO_API_KEY`、`PORT`、`APP_ORIGIN`。
- 校验文本长度、语言枚举、文件 MIME/文件头/大小/时长。
- 不接受任意 URL、模型名或 Base64 直接来自客户端；音频由服务端转码后生成 Base64。
- 同源部署；生产开启 CSP、`X-Content-Type-Options`、`Referrer-Policy`。
- 日志只记请求 ID、耗时、状态码、字符数、音频时长、预估费用；不记录正文。
- 限流：TTS 10 次/分钟、STT 5 次/分钟；同时任务数 1。
- 本地：Vite 5173 + Express 8787；localhost 可直接用麦克风。
- 个人 VPS：Docker 单服务 + Caddy/Nginx HTTPS；必须 HTTPS 才能录音。
- **不要公开绑定到互联网**；如要公开，先加认证/Turnstile（不在 v1 范围）。

---

## 8. 验收标准

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| AC-01 | 输入 500 字中文，MiMo 默认音色生成 | 15 秒内返回可播放 MP3；文件名合法；历史新增 |
| AC-02 | 输入为空 / 1,001 字 | 对应提示；不发起请求 |
| AC-03 | 模拟 MiMo TTS 429/超时 | 显示原因与重试；不调用其他服务 |
| AC-04 | 上传 3 分钟 mp3 | 显示时长与约 ¥0.03；首次弹窗确认；确认后返回文本；可复制/TXT |
| AC-05 | 首次弹窗取消 | 不发起 ASR 请求；不产生费用 |
| AC-06 | 上传 6 分钟音频 | 本地/服务端拒绝，提示单次 5 分钟上限；不调用 MiMo |
| AC-07 | 上传 26MB 文件 | 本地拒绝并提示 25MB 上限 |
| AC-08 | 录制 30 秒并转写 | 停止后显示费用；确认后返回文本 |
| AC-09 | 麦克风权限拒绝 | 显示指引 + 上传入口；页面不崩溃 |
| AC-10 | 转写失败后重试 | 再次显示费用；不自动重试；不重复请求 |
| AC-11 | 刷新页面 | 历史仍在；TTS 音频可播放；STT 音频未保存；最近音色保留 |
| AC-12 | 检查构建产物与请求 | 找不到 `MIMO_API_KEY`；服务端日志无正文 |
| AC-13 | 390px 移动端 | 模式切换、录音/上传、确认费用、结果编辑、下载均可用 |

测试补充：

- **单元**：字数校验、费用估算、时长格式化、错误映射、文件名。
- **组件**：录音状态、费用弹窗、播放器、历史删除。
- **E2E**：TTS 模拟成功；STT 上传 + 费用确认；麦克风拒绝；历史持久化。
- **真实 API 冒烟**：MiMo TTS、ASR 各 1 次；记录耗时、响应、实际计费。
- **手动**：Chrome/Safari 录音转码；5 分钟边界；429；移动端。

---

## 9. 开发计划（3–5 天）

| 阶段 | 任务 | 产出 |
| --- | --- | --- |
| D1 | M0 验证；初始化 client/server；设计 token；配置与健康检查 | 可运行骨架 + 验证记录 |
| D2 | MiMo TTS 适配、TTS UI、播放器、下载、TTS 历史 | TTS 完整链路 |
| D3 | 录音/上传、ffmpeg 转码、时长校验、费用确认、MiMo ASR、结果编辑/导出 | STT 完整链路 |
| D4 | 错误态、移动端、可访问性、E2E、Docker/本地部署 | MVP 候选 |
| D5 | 缓冲：真实 API/真机问题修复 | 可交付版本 |

**开发顺序**：先打通 MiMo TTS 垂直切片 → 再做音频转码与 MiMo ASR → 最后补历史、费用提示与移动端。TTS 与 ASR 的请求解析都封装在 `providers/mimo.ts`。

---

## 10. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| MiMo ASR 按量计费 | 每次转写都有成本 | 5 分钟上限；提交前显示费用；不自动重试；历史记录预估费用 |
| MiMo TTS 免费结束 | TTS 出现成本 | 页面链接官方价格；显示「以官方计费为准」；不做隐藏调用 |
| MiMo 不可用 | 无备用线路 | 明确报错；保留手动重试；接受这是单供应商 MVP 的代价 |
| 5 分钟限制 | 长录音不可用 | v1 明确提示；后续版本做切片与文本拼接 |
| 8K 上下文 / 10MB Base64 | 长音频失败 | MP3 16kHz 单声道；5 分钟上限；服务端二次校验 |
| 转码失败 | 部分格式不可用 | 明确错误；支持列表收敛；M0 覆盖 Chrome/Safari 录音 |
| 无 SRT / 无实时 | 功能缺失 | 已在 v1 明确不做；后续接时间戳 ASR 或本地对齐 |
| 误操作产生费用 | 个人成本 | 首次确认 + 每次按钮标注价格 + 取消不发请求 |
| 隐私 | 音频发送给 MiMo | 页面说明；服务端不落盘；STT 音频不保存 |

---

## 11. 不在 v1 / 后续版本

| 能力 | 说明 |
| --- | --- |
| SRT / 时间戳 | MiMo ASR 不支持；需额外接入支持时间戳的 ASR，或本地强制对齐（WhisperX/FunASR） |
| 实时识别 | 需要流式 ASR 或浏览器 Web Speech；当前不做 |
| 长音频 | 需要按静音切片、逐段识别、拼接文本；P1 |
| Edge/Groq/Azure | 多供应商与降级；P1 |
| 声音克隆/声音设计 | 需授权与合规评估；P2 |
| 公开部署 | 认证、Turnstile、配额；P1 |
| 深色模式/英文 | P1 |
| 缓存/流式 TTS | P1 |

---

## 12. 下一步

1. 确认本版范围，尤其是：**5 分钟上限**、**STT 每次计费**、**v1 无 SRT / 无实时识别**。
2. 提供 `MIMO_API_KEY`，执行 M0：TTS 与 ASR 各跑一次，验证鉴权、返回字段、5 分钟稳定性与费用。
3. M0 通过后初始化项目，按第 9 节实现。

---

## 附录 A：MiMo TTS 请求参考

```ts
const res = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "api-key": process.env.MIMO_API_KEY!,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mimo-v2.5-tts",
    messages: [
      { role: "user", content: style || "自然、清晰" },
      { role: "assistant", content: text },
    ],
    audio: { format: "mp3", voice: voiceId },
    stream: false,
  }),
});
```

## 附录 B：MiMo ASR 请求参考

```ts
const res = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "api-key": process.env.MIMO_API_KEY!,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mimo-v2.5-asr",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: { data: `data:audio/mp3;base64,${base64Audio}` },
          },
        ],
      },
    ],
    asr_options: { language: language === "auto" ? undefined : language },
  }),
});
```

> 鉴权头、音频字段与响应结构以 M0 实测为准；全部封装在 `providers/mimo.ts`。

## 附录 C：参考来源（访问日期 2026-10-25）

- 小米 MiMo 价格页：<https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go>
- MiMo V2.5 TTS 模型页：<https://mimo.mi.com/models/en-US/mimo-v2.5-tts>
- MiMo V2.5 ASR 模型页：<https://mimo.mi.com/models/en-US/mimo-v2.5-asr>
- MiMo ASR API 文档：<https://mimo.mi.com/docs/zh-CN/api/audio/Speech-Recognition>
- MiMo ASR 使用指南：<https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/Speech-Recognition>
- MiMo ASR 无时间戳与限制实测：<https://juejin.cn/post/7667537840746414122>
- MiMo ASR 10MB / 8000 token / RPM 限制实测：<https://cloud.tencent.com/developer/article/2696296>
- MiMo TTS 协议调研：<https://blog.csdn.net/yxl219/article/details/164863072>
