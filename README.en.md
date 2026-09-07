[中文](README.md) | English

# dsh-grok-plan-mode

Replace official DeepSeek Harness Web Plan with Grok's hard gate.

After `/plan`, the model can only edit this session's `plan.md`. `exit_plan_mode` opens a review card: approve, request changes, quit. auto / always-approve cannot skip it.

Official DSH Plan is a prompt plus two buttons. It does not block file writes. This plugin does. See [xAI Plan Mode](https://docs.x.ai/build/features/plan-mode).

![Plan chip, then the review card](docs/screenshots/plan-review.gif)

![Plan chip on the composer](docs/screenshots/plan-chip.png)

![`/view-plan` opens the saved plan.md](docs/screenshots/plan-review.png)

![Same card with notes](docs/screenshots/plan-review-comments.png)

DSH Web has no Shift+Tab. After `/plan`, **Plan** appears on the composer. Click × or type `/grok-plan-leave` to leave. During review the chip becomes **Plan approval**.

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

Then restart that DSH Host and reload the page. `cordis.yml` disables host `ui-plan` / `plan-mode` and inserts this plugin.

Web presets `standard` / `code` / `cordis` still remount official `plan-mode`. Merge [`overlays/preset.plan-off.yml`](overlays/preset.plan-off.yml) into copies of those three presets. This plugin does not edit those Harness files. Do not mount a second copy through another bundle or patch.

## Commands

| Entry | What |
|---|---|
| `/plan` | Enter. Active on the next prompt |
| `/plan <text>` | Enter and start this turn |
| `/view-plan` `/show-plan` `/plan-view` | Open the saved plan |
| chip × / `/grok-plan-leave` | Leave |
| `enter_plan_mode` | Model enters on its own |
| `exit_plan_mode` | Read `plan.md` on disk and stop for review |

Files:

```
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan.md
~/.dsh/sessions/<urlencoded-cwd>/<session-id>/plan_mode.json
```

If there is no session path, it falls back to `$cwd/.dsh/plan.md`. Missing files are created empty. Existing content is never truncated.

## License

MIT. See [LICENSE](LICENSE).
