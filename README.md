中文 | [English](README.en.md)

# dsh-grok-plan-mode

把 DeepSeek Harness Web 的官方 Plan 换成 Grok 那一套硬闸。

`/plan` 之后，模型只能改这个 session 的 `plan.md`。调用 `exit_plan_mode` 时会出现审批卡：批准、要求修改、放弃。auto / always-approve 跳不过去。

官方 DSH Plan 是提示词加两个按钮，不拦写文件。这个插件拦。对照 [xAI Plan Mode](https://docs.x.ai/build/features/plan-mode)。

![`/plan` 之后芯片出现，接着打开审批卡](docs/screenshots/plan-review.gif)

![官方输入框上的 Plan 芯片](docs/screenshots/plan-chip.png)

![`/view-plan` 打开已写好的 plan.md](docs/screenshots/plan-review.png)

![同一张卡，Notes 里写了说明](docs/screenshots/plan-review-comments.png)

DSH Web 没有 Shift+Tab。`/plan` 之后输入框上出现 **Plan**。点 × 或打 `/grok-plan-leave` 退出。审批中芯片变成 **Plan approval**。

- Approve：离开 Plan，按 `plan.md` 开始做
- Request changes：说明和行批注留下来，继续停在 Plan
- Quit：丢掉 plan，关掉 Plan mode

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

然后重启这个 DSH Host，刷新页面。`cordis.yml` 会禁用 host 上的 `ui-plan` / `plan-mode`，再插入本插件。

Web 还会在 preset `standard` / `code` / `cordis` 里把官方 `plan-mode` 再挂回去。把 [`overlays/preset.plan-off.yml`](overlays/preset.plan-off.yml) 合进这三份 preset 副本。那三份 Harness 文件本插件不替你改。不要再通过另一份 bundle 或 patch 重复挂载。

## 命令

| 入口 | 作用 |
|---|---|
| `/plan` | 进入，下次提问才 Active |
| `/plan <text>` | 进入并开这一轮 |
| `/view-plan` `/show-plan` `/plan-view` | 打开已保存的 plan |
| 芯片 × / `/grok-plan-leave` | 退出 |
| `enter_plan_mode` | 模型自己进入 |
| `exit_plan_mode` | 读磁盘上的 `plan.md`，停在审批 |

文件在：

```
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan.md
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan_mode.json
```

没有 session 路径时回退 `$cwd/.dsh/plan.md`。没有就建空文件，从不截断已有内容。

## 许可

MIT。见 [LICENSE](LICENSE)。
