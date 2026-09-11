# Grok Plan Mode development

This repository root is the existing `dsh-grok-plan-mode` plugin package. Edit,
test, build, commit, and install this same package. Resolve the root with
`git rev-parse --show-toplevel`; confirm its `package.json` name and `dshx.yml` id.

Use the existing-project DSHX workflow. `creator scaffold` creates a new plugin
and must not be run inside this package. Keep one source tree; installation links
must resolve to the Git root, including the target Harness `my-plugins` link and
the selected profile dependency. If they disagree, report both paths and reconcile
their changes before activation. Never fix disagreement by copying a second tree.

For changes to commands, approval, edit gating, composition, or installation,
read `.dsh/skills/verify-grok-plan-mode/SKILL.md`. Select the actual target Harness
and classify activation using DSHX's current live-activation contract.

Commit the tested source and rebuilt `lib/client.js` together. Verify the pushed
remote branch commit against local HEAD; a successful push does not prove Host
activation. Keep local logs, test homes, credentials, and rollback archives out
of commits.
