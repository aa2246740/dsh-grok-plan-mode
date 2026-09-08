[中文](README.md) | English

# dsh-grok-plan-mode

Replace official DeepSeek Harness Web 0.1.2-rc.1 Plan with Grok's hard gate.

After `/plan`, the model can only edit this session's `plan.md`. `exit_plan_mode` opens a review card: approve, request changes, quit. auto / always-approve cannot skip it.

Official DSH Plan is a prompt plus two buttons. It does not block file writes. This plugin does. See [xAI Plan Mode](https://docs.x.ai/build/features/plan-mode).

![Plan chip, then the review card](docs/screenshots/plan-review.gif)

![Plan chip on the composer](docs/screenshots/plan-chip.png)

![`/view-plan` opens the saved plan.md](docs/screenshots/plan-review.png)

![Same card with notes](docs/screenshots/plan-review-comments.png)

DSH Web has no Shift+Tab. After `/plan`, **Plan** appears on the composer. Click × or type `/plan off` to leave. During review the chip becomes **Plan approval**.

- Approve: leave Plan and implement `plan.md`
- Request changes: keep notes and stay in Plan
- Quit: drop the plan and leave Plan mode

While Active, `write` / `edit` / `str_replace_editor` / `apply_patch` can only touch this session's `plan.md`. bash is not gated. Subagents do not inherit the parent gate.

## Install

Unload official Plan first. `/plan`, `exit_plan_mode`, and `conversation.input.plan` are single-seat.

```sh
dsh plugin --profile web add github:aa2246740/dsh-grok-plan-mode
```

Or from a clone:

```sh
git clone https://github.com/aa2246740/dsh-grok-plan-mode.git
dsh plugin --profile web add ./dsh-grok-plan-mode
```

For first installation follow the DSHX manifest activation decision. An already-loaded bundle supports same-PID server updates with bundle-aware DSHX; do not reinstall or restart it merely to update code. `cordis.yml` disables host `ui-plan` / `plan-mode` and inserts this plugin.

Plan is replaced across Standard, PTC, Minimal, Creator Mode, Creator Mode+, and future custom presets. A Cordis lifecycle observer suppresses official Plan rows before activation and replaces existing instances without rewriting preset files. Active legacy plans migrate conservatively into Grok Plan without approval. Unloading restores the runtime rows owned by this replacement.

## Commands

| Entry | What |
|---|---|
| `/plan` | Enter. Active on the next prompt |
| `/plan <text>` | Enter and start this turn |
| `/plan off` | Leave (same as the chip ×) |
| `/view-plan` `/show-plan` `/plan-view` | Open the saved plan |
| `/grok-plan-leave` | Leave (alias) |
| `enter_plan_mode` | Model enters on its own |
| `exit_plan_mode` | Read `plan.md` on disk and stop for review |

Files:

```
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan.md
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan_mode.json
```

With no cwd it falls back to `.grok/plan.md`, same as Grok Build. Missing files are created empty. Existing content is never truncated.

## License

MIT. See [LICENSE](LICENSE).
