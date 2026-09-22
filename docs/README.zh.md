# dsh-custom-provider

这是 DeepSeek Harness 内置 `llm-pi-ai` 适配器的提供方和模型配置页面。插件会在设置导航的「模型」下面增加独立的「模型配置」，不向官方页面或提供方卡片插入内容。无需打开官方「模型」页，也能新增、编辑、删除提供方，配置接口地址、协议、API Key 和模型。

## 安装

目标 dsh profile 需同时启用 `llm-pi-ai` 和 Web 设置界面。在仓库根目录使用独立的临时配置预览，不安装到现有 profile：

```sh
npm run build
preview_home="$(mktemp -d "${TMPDIR:-/tmp}/dsh-custom-provider.XXXXXX")"
DSH_HOME="$preview_home" dsh --profile web --patch "$PWD/test/local.patch.yml" --no-open --port 0
```

启动输出包含本地访问 token 的 URL。临时配置不含原有提供方和凭据，需要在里面新建测试数据。只用 `--patch` 而不设置独立 `DSH_HOME` 虽不会安装插件，但页面保存操作仍会写入日常 dsh 设置。需要持久安装时，在仓库根目录执行 `dsh plugin --profile web add "$PWD"`；npm 发布后才可直接按包名安装。bundle patch 已插入 `dsh-custom-provider` 行，不要手动添加同 id 的第二行。

## 模型配置

页面采用官方「模型」页的组织方式：提供方以纵向卡片列表呈现，每张卡片内包含 API Key、连接设置、模型列表和高级 JSON；模型配置直接嵌在所属提供方卡片中，不再拆成独立的左右导航。写入规则遵循 dsh 的 `llm-pi-ai` schema。

- 「添加提供方」可启用内置目录提供方，或创建自定义路由（ID、地址、协议）。自定义提供方创建时不预填模型；点击「获取可用模型」后会从提供方拉取并列出模型，不需要的模型可手工删除。常用配置包括显示名称、接口地址和协议；提供方「高级 JSON」只编辑当前路由的用户层对象。组合层继承的提供方不可删除。
- API Key 通过 dsh 凭据服务单独保存，不回显，也不写进设置 JSON；配置中只有凭据引用名。创建提供方后若保存密钥失败，可在当前表单重试，不重复创建。
- 用户显式声明的模型列表可添加、删除模型；内置目录模型按模型覆盖配置，不把整个目录列表写入用户层；组合层继承的模型列表保持只读。

- 「常用配置」固定提供模型名称、推理能力、输入类型、上下文窗口和输出上限。留空表示继承提供方或内置目录；上下文窗口和输出上限支持 `256K`、`1M` 等单位。输入类型和推理能力使用单选；自定义推理默认提供可编辑的 `off`、`low`、`high`、`max` 档位。常用字段修改会实时反映到高级 JSON，协议特有映射仍可在那里维护。
- 「高级 JSON」只包含当前选中模型的对象，不会替换提供方或其他模型。模型 id 不允许修改，避免把配置误写到另一模型。
- 用户层显式声明的 `models` 以整个数组提交，但只替换按 id 命中的当前条目，并保留其他模型及隐藏字段。
- 内置目录模型只写 `modelOverrides.<模型ID>`。保存只含 `id` 的对象会删除该模型的用户覆盖。组合层继承的模型列表保持只读，避免修改一项却接管整份列表。

设置写入进入真实的 `llm-pi-ai` 命名空间并携带当前 revision。提交前执行客户端 schema 校验；服务端拒绝不会清空草稿。并发 revision 冲突会刷新底层配置，同时保留未提交的编辑内容供核对。本页只管理 `llm-pi-ai` 适配器；其他 dsh 适配器仍由各自页面管理。

## 开发验证

```sh
npm run build
npm test
npm pack --dry-run
```

`lib/client.js` 由 `lib/client.source.js` 与 `lib/config.js` 生成并提交，因为 dsh 会直接加载 `exports["./client"]`。本插件没有运行时 npm 依赖。真实宿主验收需确认提供方添加与删除、密钥和地址/协议保存、模型编辑、冲突提示、恢复继承以及重启后的持久化结果。

本项目 fork 自 [Luck9Star/dsh-gateway-provider](https://github.com/Luck9Star/dsh-gateway-provider)；已移除原网关实现，保留原 MIT 许可与版权信息。
