中文 | [English](README.en.md)

# dsh-grok-plan-mode

把 DeepSeek Harness Web 0.1.2-rc.1 的官方 Plan 换成 Grok 那一套硬闸。

`/plan` 之后，模型只能改这个 session 的 `plan.md`。调用 `exit_plan_mode` 时会出现审批卡：去聊天里说、放弃、批准。auto / always-approve 跳不过去。

官方 DSH Plan 是提示词加两个按钮，不拦写文件。这个插件拦。对照 [xAI Plan Mode](https://docs.x.ai/build/features/plan-mode)。

![`/plan` 之后芯片出现，接着打开审批卡](docs/screenshots/plan-review.gif)

![官方输入框上的 Plan 芯片](docs/screenshots/plan-chip.png)

![`/view-plan` 打开已写好的 plan.md](docs/screenshots/plan-review.png)

DSH Web 没有 Shift+Tab。`/plan` 之后输入框上出现 **Plan**。点 × 或打 `/plan off` 退出。审批中芯片变成 **Plan approval**。

审阅卡跟官方 Plan 卡同一套动作，不在卡片上做行批注：

- 去聊天里说：继续停在 Plan，走 Grok 的 Request changes，模型去改；卡关掉后可在输入框补充
- 放弃：丢掉 plan，关掉 Plan mode
- 批准：离开 Plan，按 `plan.md` 开始做

Active 时，`write` / `edit` / `str_replace_editor` / `apply_patch` 只能动 session 的 `plan.md`。bash 不闸。子代理也不走父级这道闸。

## 安装

先卸官方 Plan。`/plan`、`exit_plan_mode`、`conversation.input.plan` 都是单座，不能双注册。

```sh
dsh plugin --profile web add github:aa2246740/dsh-grok-plan-mode
```

或本地 clone：

```sh
git clone https://github.com/aa2246740/dsh-grok-plan-mode.git
dsh plugin --profile web add ./dsh-grok-plan-mode
```

首次安装按 DSHX 的 manifest 激活判断操作；已加载本 bundle 的 Host 可用支持 bundle 定位的 DSHX 做同 PID 服务端热更新，无需重复安装或重启。`cordis.yml` 会禁用 host 上的 `ui-plan` / `plan-mode`，再插入本插件。

插件现在统一接管所有模式的 Plan：标准、PTC、极简、创造模式、Creator Mode+ 以及后续自定义预设。通过 Cordis 生命周期阻止预设重新激活官方 Plan，保留 Loader 中禁用行；不需要复制或修改各份预设。已运行的官方 Plan 也会被替换，旧的活动计划保守迁移为 Grok 活动计划，不会自动批准。卸载时恢复本插件接管的运行行。

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
