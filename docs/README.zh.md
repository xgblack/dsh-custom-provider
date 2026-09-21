# dsh-custom-provider

这是 DeepSeek Harness 内置 `llm-pi-ai` 适配器的补充配置界面。在 **设置 → 模型** 的 `llm-pi-ai` 提供方卡片中展开「增强配置」即可使用。本插件不新增提供方路由、不接管派发，也不管理凭据。

## 安装

目标 dsh profile 需同时启用 `llm-pi-ai` 和 Web 模型设置页。在仓库根目录使用临时覆盖预览，不安装到现有 profile：

```sh
dsh --profile web --patch test/local.patch.yml --no-open --port 0
```

启动输出包含本地访问 token 的 URL。需要持久安装时，在仓库根目录执行 `dsh plugin --profile web add "$PWD"`；npm 发布后才可直接按包名安装。bundle patch 已插入 `dsh-custom-provider` 行，不要手动添加同 id 的第二行。提供方新增、凭据和官方已有的模型名称、容量、输入模态仍在原设置页编辑。

## 配置语义

- 提供方级可编辑 `compat`、`reasoning`、`thinkingBudgets`、超时、传输、请求头、重试、默认容量与图片预算；模型级可编辑 `reasoningEfforts` 和 `compat`。字段来自当前安装的 `llm-pi-ai` schema。
- 「保存」向 `~/.dsh/settings.yaml` 的 `llm-pi-ai` 分节写入用户覆盖；「恢复」删除覆盖、回到宿主继承链。数组和动态字典用 JSON 编辑，写入被拒时保留草稿并显示错误。
- 已在用户层显式声明 `models` 的路由，以整个数组为提交单元，保留其余模型。组合层继承的模型数组在此只读，避免修改一个字段却接管整份列表。使用 pi-ai 内置目录的路由写入 `modelOverrides.<模型ID>`；需输入准确的内置模型 ID，服务端会拒绝不存在的条目。
- models.dev 只显示模型名称、上下文、输出上限、输入模态的对照值，不参与配置继承，也不会自动写入。同名后缀命中多个厂商时不显示猜测结果。

界面展示的是**解析后的 settings 值**，不等同于适配器与内置目录合成后的最终模型能力。服务端负责协议及可用性校验；并发编辑冲突时先刷新再重试。

## 开发验证

```sh
npm run build
npm test
npm pack --dry-run
```

`lib/client.js` 是由 `lib/client.source.js` 与 `lib/config.js` 生成并提交的浏览器 bundle，无运行时 npm 依赖。最终仍需在真实 dsh 中验证：保存增强字段、检查 `settings.yaml`、恢复字段、重启后确认命名空间与路由仍存在，并用实际请求核查影响 wire 参数的字段。

本项目 fork 自 [Luck9Star/dsh-gateway-provider](https://github.com/Luck9Star/dsh-gateway-provider)；已移除原网关实现，保留原 MIT 许可与版权信息。
