# Readest 仓库总结说明

本文档基于仓库当前文件进行整理，用于帮助新成员快速理解 Readest 项目的定位、技术栈、目录组织、运行方式和开发重点。

## 1. 项目定位

Readest 是一个开源电子书阅读器，目标是提供沉浸式、深度阅读体验。项目支持多种电子书格式，并面向多个平台提供应用形态，包括 Web、PWA、macOS、Windows、Linux、Android、iOS 与 iPadOS。

从功能上看，Readest 不只是一个基础阅读器，还包含书库管理、全文搜索、标注与高亮、词典/Wikipedia 查询、翻译、TTS 朗读、跨平台同步、辅助阅读、并行阅读等能力。

## 2. 技术栈概览

项目采用 monorepo 组织方式，核心技术包括：

- **前端框架**：Next.js 16、React 19、TypeScript
- **桌面/移动壳层**：Tauri v2
- **后端/系统能力**：Rust、Cargo、Tauri plugins
- **包管理器**：pnpm
- **样式与 UI**：Tailwind CSS、daisyUI、Radix UI、lucide-react 等
- **状态管理**：Zustand
- **阅读/解析能力**：foliate-js、PDF.js、zip.js、fflate 等
- **PWA 能力**：Serwist
- **云端/Web 部署**：OpenNext Cloudflare、Wrangler
- **测试工具**：Vitest、Playwright、WebdriverIO、Tauri WebDriver

## 3. 仓库结构

当前仓库是 pnpm workspace，主要工作区包括：

```text
.
├── apps/
│   └── readest-app/          # 主应用，包含 Next.js 前端与 Tauri 配置/原生能力
├── packages/
│   └── foliate-js/           # 阅读解析相关的核心包/子模块
├── data/                     # 截图、元信息、赞助商资源等项目数据
├── ops/                      # Nix/开发环境相关配置
├── patches/                  # pnpm patchedDependencies 使用的补丁
├── package.json              # monorepo 顶层脚本与依赖覆盖
├── pnpm-workspace.yaml       # pnpm workspace 配置
├── README.md                 # 项目主说明
└── CONTRIBUTING.md           # 贡献指南
```

其中最重要的业务代码集中在 `apps/readest-app`。

## 4. 主应用说明：`apps/readest-app`

`apps/readest-app` 是 Readest 的核心应用包，承担以下职责：

1. 提供 Web/PWA 版本的阅读器界面。
2. 通过 Tauri 打包桌面端与移动端应用。
3. 管理电子书导入、解析、阅读、标注、搜索、同步、翻译、TTS 等功能。
4. 维护跨平台构建、发布、测试与资源准备脚本。

该包的 `package.json` 中包含大量脚本，可按用途分为以下几类：

### 4.1 本地开发

- `pnpm dev-web`：启动 Web 版本开发服务。
- `pnpm tauri dev`：启动 Tauri 桌面应用开发模式。
- `pnpm preview`：使用 OpenNext Cloudflare 预览 Web 构建结果。

### 4.2 构建发布

- `pnpm tauri build`：构建桌面端应用。
- `pnpm tauri android build`：构建 Android 应用。
- `pnpm tauri ios build`：构建 iOS 应用。
- `pnpm build-web`：构建 Web 版本。
- `pnpm deploy` / `pnpm upload`：面向 Cloudflare 的部署或上传流程。

### 4.3 测试与检查

- `pnpm test`：运行 Vitest 单元测试。
- `pnpm test:browser`：运行浏览器测试。
- `pnpm test:tauri`：运行 Tauri 相关测试。
- `pnpm test:all`：运行综合测试流程。
- `pnpm lint`：执行 TypeScript 类型检查与 ESLint。
- `pnpm check:translations`：检查未翻译字符串。
- `pnpm check:lookbehind-regex`：检查构建产物中不兼容的正则语法。

### 4.4 第三方资源准备

应用需要将一些 vendor 资源复制到 `public/vendor`，例如：

- PDF.js worker、wasm、字体、样式文件
- SimpleCC wasm 资源

常用命令：

```bash
pnpm --filter @readest/readest-app setup-vendors
```

## 5. Tauri 配置与跨平台能力

Tauri 配置位于：

```text
apps/readest-app/src-tauri/tauri.conf.json
apps/readest-app/src-tauri/Cargo.toml
```

### 5.1 Tauri 应用配置

`tauri.conf.json` 定义了应用名称、包标识、构建命令、CSP 安全策略、资源访问范围、文件关联、打包平台与插件配置。

重要信息包括：

- 产品名：`Readest`
- 应用标识：`com.bilingify.readest`
- 前端构建产物：`../out`
- 开发服务地址：`http://localhost:3000`
- 支持文件关联：`epub`、`mobi`、`azw`、`azw3`、`fb2`、`cbz`、`pdf`
- 桌面深链协议：`readest://`
- 移动深链域名：`web.readest.com`
- 自动更新端点：Readest 下载站与 GitHub Release

### 5.2 Rust/Tauri 依赖

`Cargo.toml` 中定义了 Tauri 应用的 Rust 侧依赖，包括：

- `tauri` 与常用 Tauri 插件
- 文件系统、对话框、日志、HTTP、Shell、进程、深链、更新器等插件
- 自定义插件，如 native bridge、native TTS、Turso 等
- macOS、Windows、Linux 平台特定依赖
- WebDriver feature，用于端到端测试

这些配置说明 Readest 不只是纯 Web 应用，而是通过 Tauri 将 Web UI 与系统级能力结合起来。

## 6. Next.js 与 Web/PWA 配置

`apps/readest-app/next.config.mjs` 中的配置显示，项目会根据 `NEXT_PUBLIC_APP_PLATFORM` 和开发环境切换不同输出模式：

- 非 Web 平台生产构建时使用静态导出，适配 Tauri。
- Web 平台可结合 OpenNext Cloudflare 部署。
- 开发环境会初始化 Cloudflare 本地开发支持。
- Web 平台生产环境启用 Serwist PWA。
- 配置了 `/reader/:ids` 到 `/reader?ids=:ids` 的 rewrite。
- 对静态资源设置长期缓存。
- 对部分包进行 transpile，以保证构建兼容。

## 7. 主要功能模块理解

从 README、依赖和配置可以归纳出项目的核心功能模块：

| 模块 | 作用 |
| --- | --- |
| 阅读器核心 | 负责电子书解析、分页/滚动阅读、章节导航、样式渲染 |
| 书库管理 | 管理本地或云端书籍、排序、组织和打开文件 |
| 文件格式支持 | 支持 EPUB、MOBI、KF8/AZW3、FB2、CBZ、TXT、实验性 PDF |
| 搜索模块 | 支持书内全文搜索，规划中包含书库级全文搜索 |
| 标注系统 | 支持高亮、书签、笔记、快速标注 |
| 查询与翻译 | 支持词典、Wikipedia、DeepL、Yandex 等查询/翻译能力 |
| TTS 朗读 | 支持多语言文本转语音阅读 |
| 同步系统 | 同步书籍、阅读进度、笔记和书签 |
| 平台适配 | 通过 Tauri 插件接入文件系统、深链、更新、分享、设备信息等平台能力 |
| Web/PWA | 提供在线阅读和可安装 Web 应用体验 |
| 测试与发布 | 包含单元测试、浏览器测试、Tauri 测试、平台构建与发布脚本 |

## 8. 开发环境与启动流程

### 8.1 基础依赖

开发前需要安装：

- Node.js
- pnpm
- Rust
- Cargo
- Tauri 对应平台依赖

README 中推荐先更新 Node 与 Rust，并安装 pnpm：

```bash
nvm install v24
nvm use v24
npm install -g pnpm
rustup update
```

### 8.2 初始化项目

```bash
git clone https://github.com/readest/readest.git
cd readest
git submodule update --init --recursive
pnpm install
pnpm --filter @readest/readest-app setup-vendors
```

### 8.3 启动开发

Web 版本：

```bash
pnpm dev-web
```

Tauri 桌面版本：

```bash
pnpm tauri dev
```

检查 Tauri 环境：

```bash
pnpm tauri info
```

## 9. 维护与开发建议

1. **优先理解主应用目录**：新开发者应先阅读 `apps/readest-app`，它是功能入口和构建入口。
2. **区分 Web 与 Tauri 环境**：很多逻辑会受 `NEXT_PUBLIC_APP_PLATFORM`、`.env.web`、`.env.tauri` 影响。
3. **注意 vendor 资源准备**：PDF.js、SimpleCC 等资源需要通过脚本复制到 `public/vendor`。
4. **跨平台改动需谨慎**：文件系统、深链、更新、TTS、分享等能力可能在桌面端、移动端、Web 端表现不同。
5. **提交前运行检查**：建议至少运行格式化、lint、相关测试和目标平台构建。
6. **国际化要同步维护**：修改用户可见文本时，应关注 i18n 提取与翻译检查。
7. **安全策略需要同步更新**：如新增外部 API、图片源、字体源或 iframe，需要检查 Tauri CSP 与 Web 配置。

## 10. 总结

Readest 是一个以 Next.js 前端为核心、Tauri 作为跨平台容器的现代电子书阅读器。它既要处理复杂的阅读器业务逻辑，又要适配桌面、移动、Web/PWA 多种运行环境。仓库的重点不只是 UI，还包含文件解析、系统集成、同步、翻译、TTS、国际化、测试和发布工程。

对于后续开发，建议按照“先 Web 主流程，再 Tauri 原生能力，再跨平台差异”的顺序理解项目，这样更容易定位问题和扩展功能。
