# U03 / G1-F20 - verified GREEN

## Outcome

`transferPlayerDialog.ts` compares with its latest emission and patches the command,
including the standalone apply path. A -> B -> A restores mapA; authored transition
survives. No change was needed in `commandBodyAdvanced.ts`.

## Proof

| Layer | Result | Receipt |
| --- | --- | --- |
| Captured RED | 7 passed, 2 failed; six assertions show stale mapB and missing transition | red.json, red.log |
| Related GREEN | 13/13; all original nine cases retained | green.log |
| Scoped compiler diagnostics | Zero in all five TS/config files | diagnostics.log |
| Firefox editor | Confirm/Apply, reopen, two real imports, direction-only edit, Cancel | editor-observation.json |
| Chromium dedicated player | Two fresh contexts; four positive beats and two negative discriminators | player-observation.json, player-*/manifest.json |
| Resource cleanup | All owned ports closed; temporary root/caches/fixtures and local mirrors removed | cleanup.log |

`manifest.json` records exact commands, source digests, retained fields, attempts,
local screenshot hashes, and verification boundaries. `prep-manifest.md` is the
historical RED receipt, not the current status. `wiki-amendment.md` is text for the
lead to apply; no shared documentation file was changed.

## Reproduce

1. Create an owned temporary root and put its absolute path in `owned-root.txt`.
2. Prepare the fixture with `node node_modules/vite-node/vite-node.mjs --script scripts/prepare-event-command-remediation.mts U03 /tmp/owned-root/fixtures` (set unique `VITE_CACHE_DIR` and freeze).
3. Run `node .omo/evidence/event-command-remediation/U03/editor-runner.mjs`; it runs the scoped Playwright spec with Firefox and writes the two temporary editor exports.
4. Run `node .omo/evidence/event-command-remediation/U03/player-runner.mjs`; it uses Chromium and the dedicated player route, not editor play.
5. Remove the owned temporary root and the editor's local activity mirrors after verifying server/browser cleanup.

No full build/gates, DB writes, package installs, push, PR, merge, or rebase were
performed. Screenshot files are local, not committed. This model cannot inspect
image attachments; no pixel-level visual review is claimed.
