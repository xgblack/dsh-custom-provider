# dsh-custom-provider

[![许可证：MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

这是 DeepSeek Harness 内置 `llm-pi-ai` 适配器的独立提供方和模型配置页面。

插件会在 dsh 官方「模型」设置下面增加「模型配置」，用于管理提供方配置、API 地址、凭据、模型列表和单模型覆盖项。它不修改官方「模型」页面，也不会向官方提供方卡片注入内容。

[English](../README.md)

## 为什么需要这个插件

dsh 内置的 `llm-pi-ai` 适配器负责提供方 schema 和运行时行为，本插件为现有命名空间提供专注的配置入口：

- 在一个页面管理目录提供方和自定义 API 路由。
- 保存自定义提供方前，通过适配器的模型服务发现可用模型。
- 编辑常用模型能力，或只编辑当前模型的 JSON，不替换其他模型。
- 通过 dsh 凭据服务保存 API Key，不把密钥写入设置 JSON。
- 保留 dsh 的 revision 和 schema 校验行为，正确处理并发或非法写入。

## 使用要求

- 已启用 **Web Settings** 的 dsh 安装。
- 与 Web Settings 使用同一个 dsh profile 的内置 `llm-pi-ai` 插件。
- 本地开发或从源码预览需要 Node.js 和 npm。

本项目不提供 LLM 适配器、网关路由或凭据后端，只管理现有的 `llm-pi-ai` 设置和远程服务。

## 安装

### 从源码目录安装

在仓库根目录执行，将插件安装到 `web` profile：

```sh
dsh plugin --profile web add "$PWD"
```

bundle patch 已经注册一次插件，不要再添加相同 id 的 `dsh-custom-provider` 条目。

### 安全地从源码预览

预览时使用独立的 `DSH_HOME`，避免测试修改日常 dsh 的提供方和凭据：

```sh
npm run build

preview_home="$(mktemp -d "${TMPDIR:-/tmp}/dsh-custom-provider.XXXXXX")"
DSH_HOME="$preview_home" dsh --profile web \
  --patch "$PWD/test/local.patch.yml" \
  --no-open \
  --port 0
```

dsh 会输出包含访问 token 的本地 URL。打开该地址后，在临时 profile 中配置测试提供方。只使用 `--patch` 而不设置独立 `DSH_HOME` 不会安装插件，但页面保存操作仍可能修改 dsh 当前选择的 profile。

发布版本后，可将 `dsh-custom-provider` 作为 dsh 插件管理器支持的包目标使用，不必再指向本地目录。

## 快速开始

1. 打开 dsh Web Settings，在「模型」下面进入「模型配置」。
2. 点击「添加模型供应商」。
3. 选择目录提供方，或选择「自定义模型 API」，填写提供方 ID、地址和协议。
4. 如果提供方需要 API Key，先填写密钥，再获取可用模型。
5. 保存提供方，展开模型后编辑常用字段或当前模型的 JSON。

自定义提供方必须明确选择协议。「继承目录」仅适用于已安装的目录提供方。

## 功能

### 提供方管理

- 添加已安装的目录提供方，或创建带有 ID、显示名称、地址和协议的自定义路由。
- 编辑可写提供方的显示名称、地址和协议。
- 删除用户创建的提供方；profile composition 继承的提供方不能在本页删除。
- 使用适配器提供的 `remote.llm` 服务获取和筛选模型。

### 模型管理

- 在用户显式维护的 `models` 列表中添加和删除模型。
- 通过 `modelOverrides.<模型 ID>` 覆盖已安装目录模型，不复制整份目录。
- 编辑模型名称、上下文窗口、输出上限、输入类型和推理能力。
- 上下文窗口和输出上限支持 `256K`、`1M` 等容量写法。
- 在当前模型内打开「编辑 JSON」，模型 ID 固定，不影响同一提供方下的其他模型。
- composition 继承的模型列表保持只读，避免编辑一行时接管整份继承列表。

## 数据与写入行为

页面遵循宿主 `llm-pi-ai` 的 schema 和存储边界：

- 设置写入真实的 `llm-pi-ai` 命名空间，并通过带 revision 的 `remote.settings` 操作提交。
- 提交前执行客户端 schema 校验；宿主拒绝或 revision 冲突时保留未保存草稿。
- 用户显式配置的模型列表会作为保留其他字段和同级模型的完整数组提交。
- 目录模型只写当前的 `modelOverrides.<模型 ID>`；只保存包含 ID 的对象即可恢复目录默认值。
- API Key 通过 `remote.credentials` 保存，不回显、不写入设置 JSON；设置中只保存凭据引用名。
- 如果提供方设置写入成功但凭据保存失败，可以重试密钥，不会重复创建提供方。

## 开发与验证

安装开发依赖后运行以下检查：

```sh
npm install
npm run build
npm test
npm pack --dry-run
```

`lib/client.js` 由 `lib/client.source.js` 和 `lib/config.js` 生成并提交，因为 dsh 会直接加载 `exports["./client"]`。修改任一源文件后都要运行 `npm run build`。

测试覆盖提供方和模型操作范围、同级数据保留、目录覆盖、校验和拒绝路径、revision 冲突以及独立设置区注册；`npm pack --dry-run` 用于检查发布文件集合。

## 范围与限制

- 本项目只管理内置 `llm-pi-ai` 适配器，其他 dsh 适配器继续使用各自的设置页面。
- 官方「模型」页面保持不变；本页面与其出现部分重叠的提供方控制项是有意设计。
- 真实宿主验证仍取决于 dsh 版本、启用的 profile 插件和正在运行的 Web Settings。

## 致谢与许可

本项目 fork 自 [Luck9Star/dsh-gateway-provider](https://github.com/Luck9Star/dsh-gateway-provider)。原网关实现和协议桥接已移除，原 MIT 许可证与版权归属保留在 [LICENSE](../LICENSE) 中。

本项目使用 [MIT License](../LICENSE) 发布。
