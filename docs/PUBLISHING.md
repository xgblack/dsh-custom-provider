# 发布流程

把 `dsh-custom-provider` 发布到 npmjs.org 的操作手册，面向维护者。

## 前提

- `package.json` 的 `publishConfig.registry` 固定为 `https://registry.npmjs.org/`

## 首次发布（只做一次，必须本地执行）

OIDC 可信发布要求包在 npmjs 上已经存在，所以第一版不能用 CI 发。

```sh
# 1. 登录
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/

# 2. 发布前检查
npm test                # prepack 会重建 lib/client.js
npm pack --dry-run      # 期望只有 index.js、lib/client.js、cordis.patch.yml、package.json、README.md、LICENSE 与 docs/
npm publish --dry-run   # 期望 Publishing to https://registry.npmjs.org/

# 3. 发布
npm publish
```

校验与安装验证：

```sh
npm view dsh-custom-provider version dist.tarball --registry=https://registry.npmjs.org/

preview_home="$(mktemp -d "${TMPDIR:-/tmp}/dsh-plugin-add.XXXXXX")"
DSH_HOME="$preview_home" dsh plugin --profile web add dsh-custom-provider
```

## 日常发版（首发之后）

先在 npmjs.com → 包 → Settings → Trusted publishing 添加 GitHub Actions：user `xgblack`、repo `dsh-custom-provider`、workflow filename `npm-publish.yml`。之后每次：

```sh
npm version patch        # 或 minor / major，产生提交与 v* 标签
git push --follow-tags
```

标签推送触发 `.github/workflows/npm-publish.yml`，两件事依次完成：

1. `publish` 任务：`npm test` → `npm publish`，走 OIDC，不需要 token 或 OTP。
2. `release` 任务（`needs: publish`，只在 npm 发布成功后执行）：用 `gh release create "$GITHUB_REF_NAME" --generate-notes` 为同一个标签创建 GitHub Release，标题即标签名，说明由 GitHub 按“上一个标签到本次标签”的提交自动生成。

Release 由工作流自带的 `GITHUB_TOKEN` 创建，因此 workflow 需要 `contents: write`；若仓库把 Actions 的默认 token 权限收紧到只读，需在仓库 Settings → Actions → General 里放行，或改用个人 token。同版本号重复发版时 `npm publish` 会先失败，`release` 任务不会执行，不会产生孤儿 Release。

## 常见报错

| 报错 | 处理 |
|---|---|
| `ENEEDAUTH` | 未登录，或 token 未落到 `~/.npmrc` |
| `EOTP` | 账号开了 2FA，加 `--otp=XXXXXX` |
| `cannot publish over previously published version` | 版本号已被占用，先 `npm version patch` |
| `E403 You do not have permission to publish` | 包名已被他人占用，改用 scope 名 `@xgblack/dsh-custom-provider`（此时需要 `--access public`） |

## 注意

- 登录凭据存在 `~/.npmrc` 的 `//registry.npmjs.org/:_authToken`。项目 `.gitignore` 未忽略 `.npmrc`，不要把 token 写进项目里的 `.npmrc`。
- 发布后包名与版本号即被占用。72 小时内可以 unpublish，但会留下痕迹，版本号不可复用。
- 使用 npmmirror 的机器要等镜像同步，必要时执行 `cnpm sync dsh-custom-provider`。
- 无 TTY 的环境里 `npm login --auth-type=web` 会因为 stdin 不是终端而退出，需要用真正的 pty（`pty.fork`）包装才能保持轮询。
