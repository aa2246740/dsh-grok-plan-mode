中文 | [English](README.en.md)

# dsh-grok-plan-mode

给已经在用 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 的人：把官方 Plan 换成 Grok 那一套硬闸。

`/plan` 之后，模型只能改这个 session 的 `plan.md`。它调用 `exit_plan_mode` 时，你会看到一张审批卡：批准、要求修改、放弃。auto / always-approve **跳不过去**。

官方 DSH Plan 是提示词加两个按钮，**不拦写文件**。这个插件拦。

不改 DSH 源码。对照的是 Grok Build `dsh-v0.1.0-rc.8` 同期的 `PlanModeTracker`、`plan_mode_edit_gate`、`enter_plan_mode` / `exit_plan_mode`、审批面。文档：[xAI Plan Mode](https://docs.x.ai/build/features/plan-mode)。

![`/plan` 之后芯片出现在官方输入框上，接着打开审批卡](docs/screenshots/plan-review.gif)

截图是装上这个插件之后的官方 DeepSeek Harness Web `0.1.0-rc.8`：侧栏、**Into the Unknown**、输入框。GIF 第一帧就是带 Plan 芯片的官方 composer，没有黑场。

## 你会看见什么

### Plan 芯片

DSH Web 没有 Shift+Tab。`/plan` 之后，输入框上出现 **Plan**。点 × 或打 `/grok-plan-leave` 退出。审批中芯片变成 **Plan approval**。

![官方输入框上的 Plan 芯片](docs/screenshots/plan-chip.png)

### 审批卡

`exit_plan_mode` 和 `/view-plan` 打开同一张卡，读的是磁盘上已经写好的 `plan.md`。划词可以写批注，下面还能给模型留说明。空 plan 也开这张面，但产品要看的是写好的计划。

![`/view-plan` 打开写好的 plan.md（标题 RATE-LIMIT POST /login），盖在官方 WebUI 上](docs/screenshots/plan-review.png)

![同一张卡，Notes 里写了说明](docs/screenshots/plan-review-comments.png)

- **Approve** — 离开 Plan，按 `plan.md` 开始做
- **Request changes** — 说明 / 行批注留下来，继续停在 Plan
- **Quit** — 丢掉 plan，关掉 Plan mode

### 编辑闸

Active 时，`write` / `edit` / `str_replace_editor` / `apply_patch` 只能动 session 的 `plan.md`。

bash 不闸。重定向可以写文件。Grok 文档写明闸的是编辑工具，不是 shell，这里不“修”这个洞。子代理（`origin === 'subagent'` 或 `delegationDepth > 0`）也不走父级这道闸。

## 装

先卸官方 Plan。`/plan`、`exit_plan_mode`、`conversation.input.plan` 都是单座，**不能双注册**。

包已经声明了 `dsh.bundle`。从 Harness 源码树：

```sh
git clone https://github.com/aa2246740/dsh-grok-plan-mode.git \
  /path/to/deepseek-harness/my-plugins/dsh-grok-plan-mode

cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add link:./my-plugins/dsh-grok-plan-mode
# 或：pnpm dsh plugin --profile web add github:aa2246740/dsh-grok-plan-mode

pnpm dsh web --no-open --port 3080
```

`cordis.yml` 会禁用 host 上的 `ui-plan` / `plan-mode`，再插入本插件（`name: dsh-grok-plan-mode`，`__DSH_BOOT__` 才能扫到 `dsh.client`）。

Web 还会在 preset `standard` / `code` / `cordis` 里把官方 `plan-mode` 再挂回去。只改 host 不够。把 [`overlays/preset.plan-off.yml`](overlays/preset.plan-off.yml) 合进这三份 preset 副本。那三份 Harness 文件本插件不替你改。

不要再叠一层 dshx `--patch`：bundle 已经插过同一 id。

从 git 装请用带 `lib/client.js` 的提交（已打好的是 RC8 lazy-CJS）。有 dshx `externalClientBundle` 的 Harness 里也可以 `pnpm build`。

还在 dshx 车间、还没进 `dsh.profile.bundles` 时：

```sh
dshx check dsh-grok-plan-mode
dshx verify-boot dsh-grok-plan-mode --keep
```

`verify-boot` 只证明 host `apply()` 和 HTTP。Client 行要靠上面的官方 bundle，`name` 必须是包名，不能是 `src/index.ts`。

## 命令和工具

| 入口 | 作用 |
|---|---|
| `/plan` | 进入，下次提问才 Active |
| `/plan <text>` | 进入并开这一轮 |
| `/view-plan` `/show-plan` `/plan-view` | 打开已保存的 plan |
| 芯片 × / `/grok-plan-leave` | 退出 |
| `enter_plan_mode` | 模型自己觉得任务含糊时进入（不是权限弹窗） |
| `exit_plan_mode` | 读磁盘上的 `plan.md`，停在审批；工具参数是空的 |

## 文件

```
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan.md
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan_mode.json
```

`DSH_HOME` 可改根目录。没有 session 路径时回退 `$cwd/.dsh/plan.md`。没有就建空文件，**从不截断**已有内容。

## 和官方 DSH Plan / Grok 对照

| 行为 | Grok | 本插件 |
|---|---|---|
| 状态 | `Inactive → Pending → Active → ExitPending` | 同左 |
| 恢复 | `Pending` / `ExitPending` 塌回；`plan_mode.json` | session 事件 `grok-plan/state` + 上面的 `plan_mode.json` |
| 计划文件 | session `plan.md`，缺了再回退 `.grok/plan.md` | session `plan.md`，回退 `$cwd/.dsh/plan.md` |
| `/plan` | 下次提问生效；带文本则开一轮 | 同左 |
| 编辑闸 | Active 只许改 session `plan.md`；auto 也拦 | `tools/pre-execute` 硬拒绝 |
| bash | 不闸 | 同左 |
| 子代理 | 父级闸不继承 | `origin === 'subagent'` 或 `delegationDepth > 0` 跳过 |
| 审批 | 空 plan 也开；auto 不能跳过 | Web 按钮和划词批注，快捷键不跟 TUI |

## 明确不搬的

- TUI LineViewer / 快捷键 `a s c q Tab`。能力在，交互改成 Web 按钮和划词。
- Shift+Tab 模式环。DSH composer 没有这条缝。
- 给 bash 加命令检查。
- 官方 Goal 栈。`/goal` 不动。

## 测试

状态机、闸、提醒、审批文案、plan 文件种子不依赖 DSH：

```sh
npm test
```

有 Harness checkout 时还可以跑 RC8 服务集成（不启 Web）：

```sh
DSHX_HARNESS=/path/to/deepseek-harness \
  pnpm --dir "$DSHX_HARNESS" exec vitest run \
  --config my-plugins/dsh-grok-plan-mode/vitest.live.config.ts
```

## 源码指针

- Grok 状态机：`crates/codegen/xai-grok-shell/src/session/plan_mode.rs`
- Grok 编辑闸：`crates/codegen/xai-grok-shell/src/session/acp_session_impl/tool_calls.rs`（`plan_mode_edit_gate`）
- Grok 进入/退出工具：`crates/codegen/xai-grok-tools/src/implementations/grok_build/{enter,exit}_plan_mode`
- Grok 审批面：`crates/codegen/xai-grok-pager/src/views/plan_approval_view.rs`
- DSH 官方 Plan（被替换）：`packages/plan/plan-mode`、`packages/client/ui-plan`
