# Global Grok Plan acceptance — 2026-09-08

The loaded Web bundle replaces official Plan across all five available modes, including existing Loader instances and future custom presets. It does not edit shipped presets or Harness core. The earlier Creator+ file-only workaround was restored byte-for-byte to its original backup; Creator+ was retested afterward.

## Live evidence

Existing Host PID 19898, port 43127; bounded DSHX root hot reload transaction dc67a751-1e7d-41f9-bc5c-f191c5e939cd. The Host observer proved the exact bundle row, new module generation, identical declared artifact hashes and removal of temporary HMR/observer resources. No restart.

All tests ran in the test workspace through native Codex CUA on DSH.app:

| Mode | Actual path | Observed result |
| --- | --- | --- |
| Standard | /plan, real enter_plan_mode {}, real exit_plan_mode {}, Quit | Grok reminder, empty saved-plan review with three actions, abandoned and off |
| PTC | /plan message, model response, chip exit | Grok command result and reminder, ENTERED, Left plan mode |
| Minimal | /plan message, model response, chip exit | Grok command result and reminder, ENTERED, Left plan mode |
| Creator (cordis) | /plan message, model response, chip exit | Grok command result and reminder, ENTERED, Left plan mode |
| Creator Mode+ | original preset restored, /plan message, model response, chip exit | Grok command result and reminder, ENTERED, Left plan mode |

Standard used Grok 4.6; the other four used the available GLM-5.3-Flash route with short no-tools prompts. These are per-mode entry/exit checks. Saved-plan write, real non-plan write rejection, approve/revise, line/range comments and preview aliases were covered by the prior Creator+ acceptance; they were not duplicated through every model.

## Automated evidence

- 65 Plan unit tests, typecheck/build, 8 public-service tests pass.
- 5 real Cordis/Loader replacement tests pass: existing instances, future modes, rollback, separate Host isolation, and real official Plan command/tool ownership. Run `npm run test:replacement -- --harness /path/to/harness`.
- DSHX 216 tests pass with the explicit target Harness and test concurrency 1. An earlier unrestricted run used a stale default Harness path and hit browser-adapter test timeouts; that failure was retained, then the correct-root sequential run passed.

Legacy active or pending official plans migrate conservatively into Grok Active. A persisted Grok snapshot wins, preventing an old official event from reactivating a plan already exited. No legacy approval is invented. This migration has automated coverage; no user's active legacy plan was driven for testing.

The extension handles official `@deepseek-ai/dsh-plan-mode` Loader entries, including future preset names. It does not replace arbitrary third-party implementations that choose unrelated package names. It applies to the Host/profile where this bundle is installed; it does not install into unrelated DSH Homes or CLI profiles.

## Rollback

Unloading the replacement restores only runtime rows it owns, provided their options were not superseded. Regression tests cover restoration and whole-Host shutdown without resurrecting disposed plugins. No per-mode source-file edits are required.
