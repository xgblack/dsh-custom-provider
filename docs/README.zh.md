# dsh-custom-provider

这是 DeepSeek Harness 内置 `llm-pi-ai` 适配器的模型配置页面。插件会在设置导航的「模型」下面增加独立的「模型配置」，不再向官方模型页面或提供方卡片插入内容。提供方、凭据、地址、协议和模型列表仍由官方「模型」页面管理。

## 安装

目标 dsh profile 需同时启用 `llm-pi-ai` 和 Web 设置界面。在仓库根目录使用临时覆盖预览，不安装到现有 profile：

```sh
dsh --profile web --patch test/local.patch.yml --no-open --port 0
```

启动输出包含本地访问 token 的 URL。需要持久安装时，在仓库根目录执行 `dsh plugin --profile web add "$PWD"`；npm 发布后才可直接按包名安装。bundle patch 已插入 `dsh-custom-provider` 行，不要手动添加同 id 的第二行。

## 模型配置

页面参考 [pi-web](https://github.com/agegr/pi-web) 的「提供方 → 模型」导航，但配置字段和写入规则严格遵循 dsh 当前安装的 `llm-pi-ai` schema。

- 「常用配置」固定提供模型名称、推理能力、输入类型、上下文窗口和输出上限。留空表示继承提供方或内置目录；标准推理会写入 dsh 的显式推理档位映射，协议特有映射仍在高级 JSON 中维护。
- 「高级 JSON」只包含当前选中模型的对象，不会替换提供方或其他模型。模型 id 不允许修改，避免把配置误写到另一模型。
- 用户层显式声明的 `models` 以整个数组提交，但只替换按 id 命中的当前条目，并保留其他模型及隐藏字段。
- 内置目录模型只写 `modelOverrides.<模型ID>`。保存只含 `id` 的对象会删除该模型的用户覆盖。组合层继承的模型列表保持只读，避免修改一项却接管整份列表。

所有写入都进入真实的 `llm-pi-ai` 命名空间并携带当前 revision。提交前执行客户端 schema 校验；服务端拒绝不会清空草稿。并发 revision 冲突会刷新底层配置，同时保留未提交的编辑内容供核对。

## 开发验证

```sh
npm run build
npm test
npm pack --dry-run
```

`lib/client.js` 由 `lib/client.source.js` 与 `lib/config.js` 生成并提交，因为 dsh 会直接加载 `exports["./client"]`。本插件没有运行时 npm 依赖。真实宿主验收需确认设置菜单顺序、目录模型加载、常用字段保存、高级 JSON 保存、冲突提示、恢复继承以及重启后的持久化结果。

本项目 fork 自 [Luck9Star/dsh-gateway-provider](https://github.com/Luck9Star/dsh-gateway-provider)；已移除原网关实现，保留原 MIT 许可与版权信息。
