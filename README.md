# dsh-grok-plan-mode

Grok Build Plan Mode，完整迁到 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。

这不是提示词仿写，也不是官方 DSH Plan 的换皮。状态机、`plan.md`、编辑硬闸、`enter_plan_mode` / `exit_plan_mode`、审批面、子代理边界，都按 [xai-org/grok-build](https://github.com/xai-org/grok-build) 和 [官方文档](https://docs.x.ai/build/features/plan-mode) 落地。

不改 DSH 源码。只挂已发布的插件缝。独立仓库，不碰 dshx / 其它现有仓库。

对照：Grok Build `dsh-v0.1.0-rc.8` 同期的 Plan 实现（`PlanModeTracker`、`plan_mode_edit_gate`、`enter_plan_mode`、`exit_plan_mode`、`plan_approval_view`）。

## 和官方 DSH Plan 的差别

官方 DSH Plan 是软引导：系统段落 + `exit_plan_mode` 把 markdown 放在工具参数里 + 两个按钮。它**不拦截**写文件。

Grok / 本插件：

| 行为 | Grok | 本插件 |
|---|---|---|
| 状态 | `Inactive → Pending → Active → ExitPending` | 同左 |
| 恢复 | `Pending` / `ExitPending` 塌回；`plan_mode.json` | session 事件 `grok-plan/state` + `~/.dsh/sessions/<cwd>/<id>/plan_mode.json` |
| 计划文件 | session 目录 `plan.md`，缺了再回退 `.grok/plan.md` | session 目录 `plan.md`，回退 `$cwd/.dsh/plan.md` |
| 种子 | 没有就建空文件，**从不截断**已有内容 | 同左 |
| `/plan` | 下次提问生效；`/plan 文本` 进入并开一轮 | 同左 |
| `/view-plan` | 别名 `/show-plan` `/plan-view` | 同左 |
| 模型入口 | `enter_plan_mode`（文档写明这不是权限弹窗） | 同左 |
| 模型出口 | `exit_plan_mode` 读磁盘上的 plan，**参数是空的** | 同左 |
| 编辑闸 | Active 时只允许改 session `plan.md`；auto / always-approve 也拦 | `tools/pre-execute` 硬拒绝 |
| bash | 不闸，重定向可以写文件 | 同左，不“修”这个洞 |
| 子代理 | 父级闸不继承；孩子能改文件，不会自动打开/执行 plan | `origin === 'subagent'` 或 `delegationDepth > 0` 跳过闸 |
| 审批 | 空 plan 也打开；auto 不能跳过；批准 / 要求修改 / 行批注 / 放弃 | Web 面板，鼠标即可，快捷键不跟 TUI |
| 提醒 | 满/疏交替、再入、退出，包在 `<system-reminder>` | `agent/pre-step` 注入，文案对齐 |

DSH 没有 Shift+Tab 切模式的缝。Web 用输入框上的 Plan 芯片和 `/plan` 代替。

## 装

先卸官方 Plan，再挂本插件。`/plan` 和 `exit_plan_mode` **不能双注册**。`conversation.input.plan` 也是单座。

Web 会在 host 上关掉 `plan-mode`，再在 preset `standard` / `code` / `cordis` 里重新挂上。只改 host 不够。

### 官方 profile 挂（真机验收走过的路）

包声明了 `dsh.bundle`。从 Harness 源码树：

```sh
git clone https://github.com/aa2246740/dsh-grok-plan-mode.git \
  /path/to/deepseek-harness/my-plugins/dsh-grok-plan-mode

cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add link:./my-plugins/dsh-grok-plan-mode
# 或：pnpm dsh plugin --profile web add github:aa2246740/dsh-grok-plan-mode
```

`cordis.yml` 会禁用 host 上的 `ui-plan` / `plan-mode`，并插入本插件（`name: dsh-grok-plan-mode`，这样 `__DSH_BOOT__` 才会扫到 `dsh.client`）。

Web 还会在 preset `standard` / `code` / `cordis` 里重新挂官方 `plan-mode`。只改 host 不够。把 `overlays/preset.plan-off.yml` 合进你自己的 preset 副本，或改用户 preset。那三份 Harness 文件本插件不替你改。

然后用官方 Web，不要再叠一层 dshx `--patch` overlay（会和 bundle 重复插入同一 id）：

```sh
pnpm dsh web --no-open --port 3080
```

已打好的 `lib/client.js` 是 RC8 lazy-CJS。从 git 装时请用带 `lib/` 的提交，或在有 dshx `externalClientBundle` 的 Harness 里 `pnpm build`。

### 用 dshx 车间

dshx 是辅助，不要改它的仓库。插件已经作为 profile bundle 装好时，直接 `dshx start web`（不要带插件名，避免再写一份绝对路径 overlay）。还在车间里、没进 `dsh.profile.bundles` 时：

```sh
dshx check dsh-grok-plan-mode
dshx verify-boot dsh-grok-plan-mode --keep
```

`verify-boot` 只证明 host `apply()` 和 HTTP。Client 行要靠上面的官方 bundle 安装，`name` 必须是包名而不是 `src/index.ts`。

## 命令和工具

| 入口 | 作用 |
|---|---|
| `/plan` | 进入，下次提问生效 |
| `/plan <text>` | 进入并开一轮 |
| `/view-plan` `/show-plan` `/plan-view` | 打开已保存预览 |
| 芯片 × / `/grok-plan-leave` | 退出（Web 没有 Shift+Tab） |
| `enter_plan_mode` | 模型自己认为任务含糊时进入 |
| `exit_plan_mode` | 读 `plan.md`，停在审批，不把 plan 放进工具参数 |

审批：

- **Approve** — 离开 Plan，开始按 `plan.md` 实施
- **Request changes** — 留下说明/行批注，继续停在 Plan
- **Quit** — 丢掉 plan，关掉 Plan mode
- 空 plan 也打开这张面
- auto / always-approve **不会**跳过

## 文件

```
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan.md
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan_mode.json
```

`DSH_HOME` 可改根目录。没有 session 路径时回退 `$cwd/.dsh/plan.md`。

## 测试

核心状态机、闸、提醒、审批文案、plan 文件种子不依赖 DSH：

```sh
npm test
```

对照 Grok 源码里的同名用例：`PlanModeTracker`、`plan_mode_edit_gate`、reminder 模板、`format_feedback`、`probe_or_create_empty_plan_file`。

在已装官方 DSH 的 Harness checkout 里，还可以跑 RC8 服务集成（不启 Web）：

```sh
DSHX_HARNESS=/path/to/deepseek-harness \
  pnpm --dir "$DSHX_HARNESS" exec vitest run \
  --config my-plugins/dsh-grok-plan-mode/vitest.live.config.ts
```

## 明确不搬的东西

- TUI LineViewer / 快捷键 `a s c q Tab`。能力在，交互改成 Web 按钮和划词批注。
- Shift+Tab 模式环。DSH composer 没有这条缝。
- 给 bash 加命令检查。Grok 文档写明闸的是编辑工具，不是 shell。
- 官方 Goal 栈。`/goal` 不动。

## 源码指针

- Grok 状态机：`crates/codegen/xai-grok-shell/src/session/plan_mode.rs`
- Grok 编辑闸：`crates/codegen/xai-grok-shell/src/session/acp_session_impl/tool_calls.rs`（`plan_mode_edit_gate`）
- Grok 进入/退出工具：`crates/codegen/xai-grok-tools/src/implementations/grok_build/{enter,exit}_plan_mode`
- Grok 审批面：`crates/codegen/xai-grok-pager/src/views/plan_approval_view.rs`
- DSH 官方 Plan（被替换）：`packages/plan/plan-mode`、`packages/client/ui-plan`
