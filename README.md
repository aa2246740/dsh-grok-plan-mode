中文 | [English](README.en.md)

# dsh-grok-plan-mode

把官方 DeepSeek Harness Plan 换成 Grok 那一套硬闸。

```sh
dsh plugin --profile web add github:aa2246740/dsh-grok-plan-mode
```

PATH 上要有 **pnpm**，以及 `dsh`（或 `npx @deepseek-ai/dsh`）。装完**重启这个 Host，再刷新页面**。`dsh plugin add` 只写 profile，不会热挂正在跑的进程。仓库已提交 `lib/`，git 安装不用再 build。

`dsh` 不在 PATH 时：

```sh
npx @deepseek-ai/dsh plugin --profile web add github:aa2246740/dsh-grok-plan-mode
```

或本地 clone：

```sh
git clone https://github.com/aa2246740/dsh-grok-plan-mode.git
dsh plugin --profile web add ./dsh-grok-plan-mode
```

```sh
dsh plugin --profile web remove dsh-grok-plan-mode
```

面向官方 DSH **0.1.5-rc.2** 的 web profile。DSH.app 的插件窗口只收 npm 包名；桌面用户请用 `dsh web` 再跑上面这条。

`/plan` 之后，模型只能改这个 session 的 `plan.md`。调用 `exit_plan_mode` 时会出现审批卡：去聊天里说、放弃、批准。auto / always-approve 跳不过去。

官方 DSH Plan 是提示词加两个按钮，不拦写文件。这个插件拦。对照 [xAI Plan Mode](https://docs.x.ai/build/features/plan-mode)。

![`/plan` 之后芯片出现，接着打开审批卡](docs/screenshots/plan-review.gif)

![官方输入框上的 Plan 芯片](docs/screenshots/plan-chip.png)

![`/view-plan` 打开已写好的 plan.md](docs/screenshots/plan-review.png)

DSH Web 没有 Shift+Tab。`/plan` 之后输入框上出现 **Plan**。点 × 或打 `/plan off` 退出。审批中芯片变成 **Plan approval**。

`cordis.yml` 会禁用 Host 上的 `ui-plan` / `plan-mode`，再插入本插件。`/plan`、`exit_plan_mode`、`conversation.input.plan` 都是单座，不要再挂一份官方 Plan。

审阅卡跟官方 Plan 卡同一套动作，不在卡片上做行批注：

- 去聊天里说：继续停在 Plan，走 Grok 的 Request changes，模型去改；卡关掉后可在输入框补充
- 放弃：丢掉 plan，关掉 Plan mode
- 批准：离开 Plan，按 `plan.md` 开始做

Active 时，`write` / `edit` / `str_replace_editor` / `apply_patch` 只能动 session 的 `plan.md`。bash 不闸。子代理也不走父级这道闸。

插件接管当前 Host 上各预设里的官方 Plan：标准、PTC、极简、创造模式，以及之后的自定义预设。通过 Cordis 生命周期阻止预设重新激活官方 Plan，保留 Loader 中禁用行；不需要复制或修改各份预设。已运行的官方 Plan 也会被替换，旧的活动计划保守迁移为 Grok 活动计划，不会自动批准。卸载时恢复本插件接管的运行行。

## 命令

| 入口 | 作用 |
|---|---|
| `/plan` | 进入，下次提问才 Active |
| `/plan <text>` | 进入并开这一轮 |
| `/plan off` | 退出（和芯片 × 一样） |
| `/view-plan` `/show-plan` `/plan-view` | 打开已保存的 plan |
| `/grok-plan-leave` | 退出（别名） |
| `enter_plan_mode` | 模型自己进入 |
| `exit_plan_mode` | 读磁盘上的 `plan.md`，停在审批 |

文件在：

```
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan.md
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan_mode.json
```

没有 cwd 时回退 `.grok/plan.md`（和 Grok Build 一样）。没有就建空文件，从不截断已有内容。

## 许可

MIT。见 [LICENSE](LICENSE)。
