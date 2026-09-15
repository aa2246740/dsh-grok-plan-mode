中文 | [English](README.en.md)

# dsh-grok-plan-mode

## 维护暂停（2026-09-15）

本项目暂不维护，不再推荐安装或作为 DeepSeek Harness 的 Plan 替代实现。请使用 DSH 官方自带的 `/plan`。源码保留供研究；如需 Grok 原生的 Plan 流程，请在 Grok 中使用。

### 为什么暂停

这套实现接管 `/plan`、进入与退出 Plan 的工具、编辑限制、审批交接、会话状态和输入框控件，并通过 Cordis 生命周期停用现有及后续 Agent 预设中的官方 Plan。它还通过 profile bundle 禁用官方 `ui-plan` / `plan-mode`。这些依赖使替换范围扩展到了 DSH 的会话与运行机制。

实际维护中，预设切换、工具审批、历史回放、状态投影和插件装卸必须一起验证。旧版自定义 `grok-plan/state` 事件曾导致部分历史会话无法被官方持久化层读取；升级和退出需要处理历史兼容。移除包本身也不足以恢复官方 Plan：还要撤销 bundle 的禁用规则和运行中的接管。联动修改和回归检查的成本过高，因此暂停继续适配。

### 已安装用户

由外部 Agent 使用 DSHX 的 `plugin remove dsh-grok-plan-mode --profile web --port <当前端口>` 安全卸载，并确认官方 Plan 命令、工具和面板恢复。本仓库的 Loader 行标识是 `grok-plan-mode`，与包名不同；若 DSHX 报告无法证明 `HOST_TREE_INACTIVE`，应由外部监督器核对并停用实际挂载行、恢复官方 `ui-plan`，再重试原卸载命令，不能提前删除包文件。官方 `plan-mode` 应按原有 profile / 预设恢复，不能一律在根作用域开启。先保留会话目录、`plan.md` 和 `plan_mode.json`；若旧历史仍含不被当前 DSH 识别的 `grok-plan/state`，先备份再处理兼容，不能靠删历史解决。停维护不代表旧计划已获批准或执行完成。

以下内容记录实验版本的设计与用法，仅供研究，不再作为当前安装建议。

---

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
