---
name: verify-grok-plan-mode
description: Verify Grok Plan Mode after changes to commands, approval, edit gating, plugin composition, or installation; compare Git source, installed package, Host activation, and Web behavior.
---

# Verify Grok Plan Mode

## Source and installation

1. Work from this repository's Git root, whose package name and DSHX id are
   `dsh-grok-plan-mode`. Use the existing-project workflow. Check that the target
   Harness `my-plugins/dsh-grok-plan-mode` and active profile dependency both
   resolve to this root. A nested copy is a source mismatch, not a build target.
2. Inspect current DSHX status for the Harness, Home, profile, port, and Host
   identity. Inside Creator+, claim the plugin with the fixed tool. An external
   supervisor uses its authorized CLI workflow; do not impersonate another claim.
3. Read DSHX's current `contracts/live-activation` and select the changed surface.
   Existing-client builds use client HMR; server changes require bounded module
   replacement proof. A bundle declaration alone does not make every edit a
   manifest change. Source relocation also requires proof that the running Host
   no longer resolves the old package path.

## Source checks

Run `npm test`, `npm run typecheck`, and `npm run build` at the root with
`DSHX_HARNESS` set to the selected checkout. Run `dshx check` on this exact root.
Record command exit codes and tested commit/source hashes.

Run `vitest run --config vitest.verify.config.ts` with `DSH_HOME` set to a fresh
temporary test directory. This mounts installed public DSH services with fixture
agents and question answers; it makes no model requests. Retain test output and
remove only that invocation's temporary Home when done.

For global replacement, run `node --experimental-strip-types
tests/global-replacement.mjs --harness <selected-checkout>` against the target
runtime. Existing and future presets must resolve Grok Plan without patching each
preset. Local unit tests against other installed package versions do not replace
this target-runtime check.

## Web acceptance

Use the current agent's permitted browser or native-app tools in a separate
verification conversation in the `test` workspace. Codex uses native CUA/Browser.
Discover current UI controls; keep authentication enabled and credentials out of
logs. Use `/plan`, `/plan off`, and the Plan chip's exit control to check entry and
exit without invoking a model. Preserve unrelated conversations and workspaces.

When approval changes, verify the rendered plan review, `Approve`,
`Chat about it` / `Request changes`, and `Quit`; the source marker is
`[data-grok-plan-review]`. Request changes must answer the Host question rather
than cancel it. Verify the displayed plan snapshot and selected feedback.

Keep source checks, target-runtime tests, Host activation, and Web acceptance as
separate results. A build, HTTP 200, or successful Git push proves only its own
layer. Record any untested path explicitly; never spend model tokens merely to
check package resolution or command toggles.

## Delivery

Commit the root source, verification instructions, and rebuilt `lib/client.js`
together, then compare local HEAD with the intended remote branch. All active
installation paths must resolve to that same Git root. Keep archival evidence
outside the active package and exclude temporary test data from the commit.
