# Phase 1 supervisor integration notes

Read this with the producer result reports before integrating their commits.
The original user goal, sequential phases and final ultrabrain approval gate
remain binding.

## Latest user direction

The user explicitly requires no proxy and says to ignore `CLAUDE.md` instructions.
Speed is a priority. This supersedes previous native-fetch forwarding advice:
remove request-routing/fulfillment relays from QA scripts and use direct browser
connections. Do not add another proxy or transport workaround. Keep actual
behavior assertions and the original final-ultrabrain-approval-before-merge rule.
Reuse completed evidence where valid, avoid duplicate implementation/research,
and finish only the remaining integration and verification work.

## Verified baseline

The supervisor completed the actual 128-entry picker census and default-command
insertion sweep against unchanged production source `32ef1bcd`. The census has
exact ID-set equality with the 128 manifest entries, not only matching counts.
Insertion is not parameter editing, persistence or runtime-completion evidence.

The three parameterized commands `spawnFieldEnemy`, `despawnFieldEnemy` and
`changeLifeSkillExp` each rendered zero input/select/textarea fields. Parameterless
`openSaveMenu` also rendered zero fields but is not the same defect.

Real keyboard RED: Ctrl+K inserts text, toolbar undo is disabled, and Ctrl+Z with
the visible command head focused leaves the command count at 1.
Real popup RED: Escape leaves the command menu mounted and opens the parent's
discard-confirmation dialog.

Evidence is in the parent worktree:
`/home/main/.herdr/worktrees/rpg-zzu/wish-1/.omo/evidence/ulw/wish-event-audit/G002/a1/`.
Read `baseline-summary.json`, `browser-census-and-prefix.json`, the browser batch
JSON files, and `baseline-split-gates.log`.

Split baseline gates: typecheck exit 0, CSS exit 0, surface exit 1.
The surface suite had 107 passing and 6 failing tests across 9 files. Existing
differences are the face/picture AI prompt and queue controls, monster species
selection values, raw-M2 faceset/parallax queues, picker tab 3 tags and NPC charset
teaching controls. Compare exact diagnostics rather than blindly refreshing
snapshots or counting failed filenames.

## Cross-lane contracts

- Validate with `projectWithEventDraftAuthoredWrites(project, mapId, eventId)`.
  Otherwise a newly staged switch incorrectly blocks parent Apply.
- The content rail summary must read the staged character name.
- Resolve `memoryOpeningTemplate.ts` by preserving the controls lane's current
  page, unrelated-page preservation and one local undo, together with the
  transaction lane's canonical/global-history/session isolation.
- Explicit record-picker Create/Rename operations remain separate management
  actions, as the initial ultrabrain review required. Do not invent a parent-Cancel
  rollback contract without evidence.
- Manifest hashes are baseline hashes. After integrating source changes, report
  changed/new files for final manifest refresh; stale baseline artifacts are not
  proof of the integrated tree.

## Atomic integration commits

Do not amend or rewrite producer commits. Replay each verified atomic producer
commit with `git cherry-pick --no-commit`, inspect the staged diff, then create a
new commit preserving its subject and existing attribution. Include:

```text
Ultraworked with [omo](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: sisyphus-dev-ai <sisyphus-dev-ai@users.noreply.github.com>
```

Record the producer-to-integrated SHA mapping. Include evidence commits, but do
not replay controls/transactions commits inherited into the validation branch
twice. No worker pushes, creates a PR, or merges main. The supervisor owns the
final gates, build, browser checks, PR and approval-before-merge enforcement.
