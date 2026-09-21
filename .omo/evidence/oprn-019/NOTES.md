# OPRN-OUT-019 — Retained map planning items

Branch `agent/oprn019`, worktree `/home/main/z-project/rpg-zzu-oprn019`, dev port 9853.

## Commits on `agent/oprn019` (base `950b14d38`)

| Hash | Unit |
|---|---|
| `8a24fd958` | `feat(project)` schema (`GameMap.planningItems`), fail-closed wire validation, load normalization, authoring actions, `test/mapPlanningItems.test.ts` |
| `47c0381d8` | `feat(editor)` list UI (studio deck 「기획」 tab), reuse choice (none/all/selected), blueprint capture button, token-only CSS, `test/mapPlanningReuse.test.ts` + `test/mapPlanningSpecCapture.test.ts` |
| `b9871d356` | `docs(openwiki)` two wiki pages, capture script, 8 browser PNGs, this NOTES file, `.gitignore` allowlist |
| `21606a050` | `docs(openwiki)` INDEX regeneration after the new modules became tracked files |

## What shipped

A map can now hold a durable, human-readable planning list that outlives the assistant
session, and a later assistant task offers an explicit **none / all / selected** reuse choice
whose exact effect is visible before the turn runs.

The existing `BuildSpec` lifecycle is unchanged — it stays session state that
`dropSession` clears. The new list lives beside it in project data and is only ever written by
a user action.

| Layer | File |
|---|---|
| Schema + pure helpers | `src/project/mapPlanningItems.ts` (new) |
| `GameMap.planningItems?` | `src/project/types/project.ts` |
| Wire shape (fail-closed) | `src/project/io/shapeEventFields.ts` |
| Load normalization | `src/project/io/shape.ts` |
| Authoring actions | `src/editor/mapPlanningActions.ts` (new) |
| List UI (studio deck 「기획」 tab) | `src/editor/panels/aiPlanningList.ts` (new), `src/editor/panels/aiStudioShell.ts` |
| Reuse choice UI | `src/editor/panels/aiPlanningReuse.ts` (new), `src/editor/panels/aiComposer.ts`, `src/editor/panels/aiChatPanel.ts` |
| Blueprint → list capture | `src/editor/panels/aiTurnRunner.ts` |
| Styles (tokens only) | `assistant-composer.css`, `tabs-b-assistant-panel/08-studio-mode-start-screen.css`, `tabs-b-assistant-panel/18-assistant-deck.css` |

## Acceptance criteria

### 1. Users can view the retained planning items for the current map — **MET**

Studio deck gained a **기획** tab (`ai-studio-tab-planning`) whose badge is the active-item
count; the pane shows map name, `사용 가능 N / 전체 M`, and one row per item with its origin
(`직접` / `밑그림`).

- Test: `test/mapPlanningReuse.test.ts` → 「현재 맵의 항목을 상태·출처와 함께 보여주고
  편집·은퇴·삭제 컨트롤을 낸다」, 「스튜디오 덱 「기획」 탭 …」, 「항목이 없으면 보존을 권하는 빈 안내를 낸다」.
- Browser: `verify-shots/oprn-019/01-studio-deck-planning-list.png`, `02-planning-list-crop.png`.

### 2. A later assistant task offers a clear none/all/selected reuse choice — **MET**

Composer rail toggle `ai-planning-toggle` opens a popover with three exclusive segments
`ai-planning-reuse-mode-none|all|selected`. `none` is the default at every open and after every
send. When no active item exists, all/selected are disabled.

- Test: 「기본은 사용 안 함이고 아무 지침도 만들지 않는다」, 「전체를 고르면 …」, 「선택을 고르면
  체크한 항목만 실린다」, 「항목이 없으면 전체·선택을 고를 수 없다」.
- Browser: `04-reuse-default-none.png`, `05-reuse-all-preview.png`, `06-reuse-selected-preview.png`,
  `07-reuse-popover-crop.png`.

### 3. The chosen items and their effect are visible before work is applied — **MET**

`ai-planning-reuse-preview` renders the **exact** guidance block that will be appended to the
payload (asserted equal to `control.guidanceBlock()`), `ai-planning-reuse-effect` states the
count and that it is guidance, and `ai-planning-chip` repeats the choice on the composer action
row. Nothing is sent until the user presses send.

- Test: 「전체를 고르면 실릴 원문이 보내기 전에 보인다」 (preview === guidanceBlock),
  「전체를 고르면 payload 에 지침 블록이 실리고 그 사실이 대화에 남는다」 (real panel →
  `AssistantSession.sendUserMessage` payload contains the same text; `instruction` stays the raw
  utterance).
- Browser: `05`, `06`, `07`, `08-composer-chip-crop.png`.

### 4. Users can edit, retire, or delete stale planning items — **MET**

Inline text input per row (change/Enter commits), a retire/restore toggle, and a delete button.
Retire keeps the row visible and struck through but removes it from the reuse pool; delete
removes it, and emptying the list deletes the field entirely.

- Test: 「수정·은퇴·삭제가 각각 다른 일이다」, 「빈 본문은 항목이 되지 않고, 삭제로 취급되지도 않는다」,
  「같은 본문·같은 밑그림 에셋은 두 번 담기지 않는다」.
- Browser: `03-planning-retired-crop.png` (badge 3 → 2, `사용 가능 2 / 전체 3`, struck-through row).

### 5. A new conversation or reopening the project does not discard retained items — **MET**

- New conversation: 「새 대화를 시작해도 항목은 남는다」 clicks the real `ai-new-session` control
  (the path through `dropSession` that clears the blueprint) and the items survive.
- Reopen: 「프로젝트를 저장하고 다시 여는 경로(직렬화 왕복)에서도 남는다」 does
  `deserialize(serialize(current))` → `store.replaceProject` and the items, including a retired
  one, come back.

### 6. Retained guidance does not silently block manual editing or unrelated assistant work — **MET**

No spec-gate, approval-policy, validator or runtime code reads `planningItems`; grep-verified
and asserted behaviourally.

- Test: 「보존 항목이 있어도 수동 편집과 재사용 없는 조수 작업은 막히지 않는다」 — a manual
  `renameMap` commits while items exist, and an unrelated assistant turn's payload contains no
  `[보존 기획]` block.
- Test: 「사용 안 함이면 payload 에 보존 기획 문장이 없다」 — the mere existence of items adds
  nothing to a prompt.
- Test: `mapPlanningSpecCapture` — a confirmed `set_build_spec` writes **nothing** to the project
  until the user presses 보존 기획에 담기, so the session blueprint is never silently promoted to
  permanent guidance.
- The guidance block itself says in-band: 「이 항목들은 지침이며 차단 규칙이 아니다. 새 요청과
  충돌하면 새 요청을 따르고 어긋난 항목을 말해라.」

### 7. Persistence, export/import, and deletion documented and covered by focused tests — **MET**

- Export/import: `serialize` → `deserialize` roundtrip test with both a user item and a retired
  spec-origin item (this is the same path `.oprn` export and project-JSON import take).
- Persistence: reload test above; no schema-version bump (asserted), unauthored maps keep the
  field absent (asserted), so old JSON is byte-stable.
- Wire safety: 6 fail-closed cases (blank text, missing/unknown `status`, unknown `origin`,
  duplicate id, non-array) each reject the load rather than dropping the user's sentence.
- Deletion: last-item deletion removes the field; deleting a chosen item drops it from the reuse
  selection instead of resurrecting it.
- Docs: `openwiki/editor-ai-panel.md` (new top section) and `openwiki/runtime-project-schema.md`
  (schema bullet); `openwiki/INDEX.md` regenerated.

## Verification run in this worktree

| Check | Result |
|---|---|
| `npm run typecheck:app` | exit 0, clean |
| `npx tsc -p tsconfig.json --noEmit` filtered to my files | 0 errors (repo-wide test typecheck is RED at baseline) |
| `npx vitest run test/mapPlanningItems.test.ts test/mapPlanningReuse.test.ts test/mapPlanningSpecCapture.test.ts --maxWorkers=2` | 29 passed |
| Same three + `test/aiDeckCss.test.ts test/aiStudioShell.test.ts` | 56 passed |
| `test/aiComposerDeck aiDeckRail aiPreferenceComposerButton aiComposerInputUx` | 25 passed |
| `node scripts/check-css-budget.mjs` | pass, 0 regressions (hex −5, !important −175 vs baseline) |
| `npm run openwiki:verify` / `openwiki:index --check` | pass / up to date |
| Browser evidence | `verify-shots/oprn-019/` (8 PNG) via `node scripts/capture-map-planning-items.mjs` against `npm run dev:worktree` on 127.0.0.1:9853 |

Flakiness: `mapPlanningSpecCapture` drives the real session loop and measures ~10 s, over the
15 s default under load. It waits on the **event** (the capture button appearing) with a bounded
`vi.waitFor`, and carries an explicit 60 s ceiling as a slow-machine safety net — no sleeps, no
polling delays. 5 consecutive runs pass.

## Pre-existing failures (not caused by this change)

- `test/agentBlueprintTurnEnd.test.ts`: 8 failures. Verified identical (same 8 test names) with
  my changes stashed on the clean base commit `950b14d38`.
- Repo-wide `npm run typecheck` is RED at baseline (`test/` type errors, e.g. 20 uses of the
  removed `getChatDock` panel option).

## Deliberately not done

- No LegacyDb content write: this is editor/schema code, not authored game content, so the
  `AGENTS.md` content rule does not apply. Schema change is proved by load/normalize/save tests
  instead.
- No automatic capture of a `BuildSpec` into the list, and no automatic prompt injection. Both
  are explicit user actions by design — the issue forbids converting the session gate into
  permanent mandatory constraints.
- No AI tool for reading/writing `planningItems`. The issue scopes this to a user-controlled
  surface; exposing a tool would let the model edit its own retained constraints.
