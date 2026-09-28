> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Editor Observability — 계측 초크포인트 · 편집 감사 로그 · 오류 트랩

편집기의 mutation 경로를 건드리기 전에, 그리고 "방금 뭘 했더니 이렇게 됐다" 를 사후에 재구성해야 할 때 읽는다.
2026-08-29 관측성 감사에서 만든 계층이며, 그 전에는 사람 편집이 기록에 **한 줄도** 남지 않았다.

소유 파일:

| 파일 | 무엇을 소유하나 |
|---|---|
| `src/util/logger.ts` | 레벨·네임스페이스·링버퍼(1000) 로거. `createLogger(ns)` |
| `src/project/store.ts` | 계측 초크포인트(`markLocalMutation` → `recordChangeActivity`), `ProjectChangeAnnotation` |
| `src/editor/editActivityLog.ts` | 편집 행위 감사 로그(링버퍼 500 + localStorage 200 + 디스크 미러 + 커밋 첨부 슬라이스) |
| `src/editor/eventDiffLabel.ts` | `EventDiff` → 사람이 읽는 라벨 + 필드 목록 |
| `src/editor/editActivityEndpoint.ts` | `EDIT_ACTIVITY_DISK_ENDPOINT = "/__oprn/edit-activity"` |
| `src/app/errorTrap.ts` | 전역 오류 트랩(`window.onerror` / `unhandledrejection` / 리소스 404) |
| `src/ai/errorDiagnostic.ts` | 조수 턴이 잡은 예외의 이름·스택·cause 덤프 |
| `src/editor/panels/assistantErrorDetail.ts` | 조수 오류 말풍선의 「자세히 보기」·「복사」 |
| `vite.config.ts` | dev/preview 미들웨어 — `output/edit-activity/` 로 미러 |
| `src/project/projectCommitLog.ts` | 커밋 경계에서 행위 기록을 잘라 커밋 row 에 싣는다(커서 소유) |
| `scripts/list-edit-activity.mjs` | `npm run edit:log` (라이브 세션 — 디스크 미러 조회) |
| `scripts/list-project-commits.mjs` | `npm run commit:log` (저장된 것 — DB 커밋 + 실린 행위 조회) |

## 높이 붓·높이 조수 도구의 기록 (2026-09-26)

- 사람: `paintRelief` 는 `store.updateMapTiles(mapId, …, { label: "높이 붓", relief: true })` 한 경로다 — 초크포인트를 지나고 `TilePaintEngine.applyStrokeEdit` 가 스트로크당 되돌리기 한 번을 남긴다. 라벨이 고정이라 드래그가 600ms 병합으로 한 줄이 된다.
- 조수: `sculpt_relief` 는 draft 의 `map.relief` 만 바꾸는 쓰기 도구라 일반 AI 적용 경로(맵 단위 체크포인트, `origin:"ai"`)를 탄다.

## 조수 오류 자세히 보기 (2026-09-25)

채팅·영역 작업·클러스터·설정집 정리에서 오류 말풍선이 뜨면 「자세히 보기」와 「복사」가 붙는다.
본문은 선택 가능한 `<pre>`다. 내용은 예외 이름·메시지·스택·cause, 그 시점의 로거 링버퍼 최신 80건,
리소스 404를 뺀 오류 트랩 최신 20건이다. 세션이 Error를 아직 들고 있으면 `TurnResult.errorDetail`
(`formatThrownDiagnostic`)이 스택을 보존한다. 메시지 문자열만 있는 경로는 로그·트랩만 싣는다.

## 조수 실행 기록과 표시 수준 (2026-09-21)

작업 이미지의 정본은 `activityVisual.ts`가 도구 실행 시 복사한 대상 데이터다. 화면에서 현재 store로 과거
그림을 다시 만들지 않는다. `activityMediaArchive.ts`는 텍스트 로그와 별도 IDB에 PNG/렌더 재료를 보존하며,
`ActivityEntry.visuals`에는 참조만 기록한다. 도구 완료와 초안 적용/저장 성공을 혼동하지 말 것.
이미지 누락은 로그나 도구 실행 실패로 전파하지 않는다. 상세 계약은 `editor-ai-panel.md`의 이미지 중심 피드 절.


`src/ai/activityTrace.ts`의 실행 영수증은 편집 감사/opt-in 진단과 별도다. 기본 작업 표시가
`간단히 보기`여도 도구 입력·결과·실패는 정해진 상한 안에서 보존한다. `매우 자세히 보기`는
이 기록을 펼친다. 새 기록만 기기 IndexedDB에 보관하며 원격 업로드나 진단 수집을 시작하지 않는다.
호출 ID 결합·인증 정보 가림·명시적 생략·보존 상한과 화면 경로는 `editor-ai-panel.md`의
「작업 표시 네 단계와 별도 실행 기록」을 따른다. 적용 후 저장 표시는 자동저장 관찰만 하고
추가 저장/재로드를 실행하지 않는다. 모델의 비공개 사고 본문은 수집하지 않는다.

## Opt-in local diagnostics (issue 693 OUT-009 / OUT-010)

- The assistant export menu opens `localDiagnosticsDialog`, not raw audit JSON.
  Empty conversation is not disabled: explicit consent and category choices precede
  collection. Prior conversation/log history is never backfilled.
- `LocalDiagnosticSession` retains at most 500 projected receipts for 30 minutes
  from consent, in memory only. Stop detaches sources; clear, expiry, project switch
  and reload discard the session. Its persistent indicator survives the closed report
  and Test Play. Starting another session requires fresh category choices.
- Categories: conversation role/character count (no text), authoring/save generation,
  completed movement, terrain/event collision, interpreter lifecycle, transfer,
  asset readiness/missing count and boolean boot outcome, warning/error occurrence. Every retained string is
  an enum, except the locally generated session UUID. IDs, names, prompts, reasoning,
  log text, credentials, paths and URLs are excluded instead of best-effort redacted.
  No QA/debug mutation capability is enabled.
- `diagnosticObserver` performs no payload work while off. The editor adapter
  subscribes to existing edit activity/logger sources only during consent; it adds
  no disk/AI-activity sink, console interception, or changes to existing telemetry.
- Store integration is additive in `persistCurrent`: successful local override
  publishes `storage: local`; an accepted remote receipt publishes `storage: remote`
  and captured submitted mutation generation, after the lineage guard and only if
  its diagnostic-session token still matches. No target, hash, content, generation
  or persistence policy changes. Late event/transfer/assistant completions also
  cannot join a newly consented session.
- Native battle recovery ends the interpreter without a fabricated result or
  continuation. Its handled failure still emits the token-gated event `failed`
  receipt, not `cancelled`; stopped/replaced or initially disabled diagnostic
  sessions receive no late receipt. `eventBattleFailure` covers this integration.
- Boot callbacks capture `diagnosticToken()` when `bootPlayGame` starts; loader
  failure callbacks capture it when `PlayScene.preload` starts. The local boot
  projection requires that same nonempty token and asset-category consent at
  publication. An initially disabled operation cannot join a later session.
  Asset receipts retain `ok: false` even when fallback textures let play reach
  `ready` afterward; ready is not proof that all assets loaded successfully.
  Raw boot logs and host sinks are unchanged and do not require this token.
  `scripts/qa/issue693-boot-diagnostics.mjs` replays four real Test Play cases;
  it defers Phaser's asset XHR, not the earlier editor Image warmup.
- `savedGeneration` means the latest observed accepted save in this session, not
  proof that every running scene executes that revision. Null means unknown.
  Runtime receipts prove only the recorded operation; written/observed/unverified
  remain distinct and the report never declares overall goal success.
- Section choices create a frozen Markdown/JSON preview. Native clipboard/file
  output each requires the shared explicit confirmation; cancellation or project
  replacement before confirmation creates no artifact or transcript. No network send.
- Focused tests: `localDiagnosticSession`, `localDiagnosticsWorkflow`,
  `localDiagnosticSources`, and local-diagnostics cases in movement, interpreter,
  house transfer, persistence proof and AI-panel suites. Browser replay:
  `scripts/qa/issue693-diagnostics.mjs` (Firefox, real editor/Test Play, isolated
  local dev showcase, non-origin traffic blocked). Port 38425;
  `VITE_CACHE_DIR=/dev/shm/rpg-zzu-issue693-diagnostics/vite`. Captures and confirmed
  file default to `/dev/shm/rpg-zzu-issue693-diagnostics/evidence`.
  Full gates/build and independent visual approval remain lead-owned.

## 계측 초크포인트는 `store.markLocalMutation` 하나다

2026-09-20: AI 적용 후 설정집에 `적용된 작업` 카드를 추가하던 경로를 제거했다.
새 작업은 기존 mutation 감사 로그와 project commit 경로가 기록한다. 구형 자동 카드는
원본 ID·시각·내용·관계를 보존하고 `작업 기록 → 행위 기록 → 이전 AI 작업 기록`에서
읽기 전용으로 조회한다(`legacyWikiActivityPanel.ts`, 30건씩 더 보기).
설정집/AI 입력에서는 제외하며 사용자 수동 메모는 유지한다. 기존 JSON을 삭제하거나
현재 시각의 커밋으로 재발행하지 않는 호환 조회 방식이다. 상세 계약은 `project-wiki.md`.

`ProjectStore` 에서 상태를 바꾸는 메서드는 6개고, 전부 `markLocalMutation` 을 지난다.
그 메서드들의 호출자는 **전부 클래스 안에** 있으므로 우회 경로가 없다 —
`mutationGeneration` 을 올리는 자리가 곧 계측 자리다.

| 메서드 | 기본 descriptor | 비고 |
|---|---|---|
| `update(mutator, change)` | `{ scope: "project" }` | 압도적 다수. 호출부 244곳 |
| `updateMap(mapId, mapMutator, change)` | `{ scope: "map", mapId }` | `cells` 로 셀 수가 넘어온다 |
| `updateMapTiles(mapId, mapMutator, change)` | `{ scope: "map", mapId }` | 대형 맵의 페인트·지우개·채우기 전용. 타일 배열만 얕게 복제한다 |
| `replace(project, { change })` | `{ scope: "project" }` | undo·AI 적용·원격 병합이 공유 |
| `replaceProject(project, change)` | `label: "프로젝트 교체"` | 드래프트 금고를 버린다 |
| `clearAll()` | `label: "전체 초기화"` | |
| `restoreEventDraftFromVault(mapId, eventId)` | `label: "드래프트 금고 복원", origin: "system"` | |

이 성질 덕분에 **mutation 호출부 전량이 외부 파일 수정 없이 계측된다.**

```bash
grep -rnoE "store\.(update|updateMap|updateMapTiles|replace|replaceProject|clearAll|restoreEventDraftFromVault)\(" src/ | wc -l
# 2026-08-29 재측정 277 (store.ts 주석은 275 — 이 브랜치 작업 중 호출부가 늘었다).
# 정확한 수는 브랜치마다 흔들린다. 계약은 "전량이 한 지점을 지난다" 쪽이다.
```

계측이 편집을 막지 않게 만든 두 가지:

- `recordChangeActivity` 는 `try/catch` 로 감싸고 실패는 `log.warn` 으로만 남긴다. 기록 실패로 편집이 죽으면 관측 계층이 결함이 된다.
- `emit()` 은 리스너별 `try/catch` + `log.error` 다. 실측(2026-08-29): 격리가 없어서 구독자 하나가 던지면 뒤에 등록된 구독자 전부가 그 프레임에서 건너뛰어졌다(캔버스 재렌더·자동저장 예약·패널 갱신이 동시에 멈추는데 원인 로그가 없었다).

`normalizeCurrentProject` records candidate normalizers by name. Since 2026-09-07,
only an actual before/after structural mutation sets dirty and advances
`mutationGeneration`; it remains `origin: "system"`, not a human edit. This prevents
a save in flight from clearing a newer migration and avoids autosaving forever when
a helper reports a transient change but the final structure is unchanged. See
`runtime-project-schema.md` for deferred migration persistence and lineage ownership.

## 새 편집 기능을 추가할 때 — 라벨을 넣어라

`ProjectChangeAnnotation`(`label` / `origin` / `fields` / `eventId`)은 전부 optional 이라 라벨을 빼도 컴파일된다.
빼면 그 편집은 `label: null` 로 기록되고 `__oprnUnlabeledEditCount()` 에 잡히며, 로그·CLI 에는 `(라벨 없음: project)` 로 뜬다.

```ts
store.update(
  (project) => { /* … */ },
  { scope: "map", mapId, label: `이벤트 편집: ${name}`, eventId },
);
```

규칙:

- **`label`** — 사람이 읽는 행위 이름. 스코프·컬렉션은 로그가 알아서 붙이므로 "무엇을 했나"만 쓴다.
- **`origin`** — 생략하면 `"human"`. AI·툴·시스템 경로는 반드시 명시한다(`"ai"` / `"tool"` / `"system"`). 이게 없으면 AI 변경이 사람 편집으로 오귀속된다 — 경로별 값은 아래 [AI 적용 경로](#ai-적용-경로--이쪽이-주-경로다) 표에 있다.
- **`fields`** — **호출자가 이미 계산해 둔 diff 만** 넘긴다. 초크포인트에서 diff 를 계산하면 페인트 스트로크마다 전 맵 비교가 돌아 그 자체가 새 병목이 된다. 선례는 `eventDraftActions.saveEventDraft` — `commitEventDraft` 가 draft 를 지우기 전에 `eventDraftDiffById` 로 읽어 `describeEventDiff`(라벨) + `eventDiffFields`(필드)로 나눈다.
- **연속 병합을 의식해라** — 같은 `scope:mapId:collection:label` 이 600ms 안에 연달아 오면 한 엔트리로 합치고 `cellCount` 를 누적, `mergedCount` 를 올린다(100셀 드래그가 100줄이 되지 않게). 라벨에 좌표나 카운터를 박아 매번 다르게 만들면 병합이 깨진다. `fields` 가 붙은 엔트리는 상세가 섞이면 못 읽으므로 병합하지 않는다.

## AI 적용 경로 — 이쪽이 주 경로다

이 프로젝트의 실제 편집은 대부분 채팅/영역 AI 로 이뤄진다. **손편집만 계측하면 계측하지 않은 것과 같다.**
실측(2026-08-29): 아래 5곳이 전부 descriptor 없이 `store.replace(project)` 를 부르고 있어서
AI 로 만든 편집 전량이 `{ scope: "project" }` + 라벨 없음 + `origin: "human"` 으로 떨어졌다.
고치려던 증상이 주 경로에 그대로 남아 있었고, 게다가 AI 작업이 사람 손편집으로 오귀속됐다.

| 경로 | `origin` | 라벨 형태 |
|---|---|---|
| `applyToolToStore` — 사람이 에디터에서 툴 직접 실행 | `tool` | `툴 paint_tiles: <요약>` |
| `applyToolSequenceToStore({ source: "human" })` — 툴 묶음 | `tool` | `툴 묶음: <요약>` |
| `applyToolSequenceToStore({ source: "agent", agentName })` — 채팅 에이전트 | `ai` | `AI 적용 (claude-opus-5): <요약>` |
| `applyProposedProject({ source: "agent" })` — 제안 카드 수락 | `ai` | `AI 제안 적용: <요약>` |
| `applyProposedProject({ source: "agent-milestone" })` — 자율 런 마일스톤 | `ai` | `AI 마일스톤 적용: <요약>` |
| `applyRegionProjectWithHistory` — 영역 작업 | `ai` | `AI 영역 작업: <지시문>` |
| 같은 함수의 롤백 분기 | `system` | `AI 영역 작업 롤백: <지시문>` |

규칙 세 가지:

- **`origin` 으로 사람과 AI 를 나눈다.** 사람이 툴을 직접 실행한 것(`tool`)과 에이전트가 실행한 것(`ai`)은
  같은 함수를 지나므로 `options.source` 로만 구분된다. 새 진입점을 만들면 `source` 를 반드시 넘긴다.
- **라벨에 에이전트 이름과 지시문을 그대로 싣는다.** "무엇을 시켰더니 이렇게 됐다" 가 조사의 출발점이고,
  모델을 바꿔 가며 쓰면 어느 에이전트였는지가 단서다.
- **diff 를 초크포인트에서 새로 계산하지 않는다.** 호출부가 이미 `ChangeSummary` 를 들고 있다
  (`applyAnnotation()` 이 그걸 `fields` 로 바꾼다). `applyProposedProject` 만 예외적으로
  `summarizeChanges` 를 부르는데, **`store.replace` 전에** 불러야 한다 — 교체 전 스토어가 필요하고
  라벨이 그 시점에 확정돼야 한다. 값이 0 인 축은 싣지 않는다(0 이 스무 줄이면 정작 바뀐 축을 못 찾는다).

`test/aiApplyActivityLabels.test.ts` 가 이 계약을 고정하고, 마지막 케이스가
"AI 경로를 전부 돌려도 `unlabeledEditActivityCount() === 0` 이고 `origin: "human"` 엔트리가 없다" 를 잠근다.

## P3 owner-bound publication (2026-09-07)

Run/operation identity is in-memory authority, not another outcome/evidence ledger.
The session prepares its terminal result, recap and outcome before subscriber
reentry. Successful tool audit/protocol/proposal accounting also exists before its
callbacks can cancel A or start B. An old stack can't acquire B's operation after
the callback returns. Cancellation retires old authority before terminal callbacks;
normal authoring settlement still permits valid current-owner apply and P1 proof.

`recordAppliedMutation` records the adapter's actual local `onApplied` milestone
after the live replacement and mutation counters, before synchronous activity/store
observers can retire its owner. Calling it only after `store.replace` returned was
too late: the independent R1 subscriber retired A and started B while A still
reported its applied title as a pending draft. The repaired boundary credits A's
existing ledger first; its prepared cancellation result retains delivery `applied`,
while B remains independent. Neither replay nor B-owned accounting repairs history.

The captured `commitProject` identifies the replacement object, not a later live
edit. `recordAppliedProject` supplies normal completion metadata. These share the
existing application ledger; they aren't two applications. Early
`commitId:null, persisted:false` is provisional, not an accepted-save receipt.
If the accounting outcome observer throws, `finally` still completes activity,
store notification and autosave scheduling without swallowing the original error.
Retiring A leaves already-applied content and accepted store history intact, but
blocks A's late result/proof/UI publication through B.

Panel bridge sends capture their result at the owner's settlement before queue
drain. They don't wait for global idle and then read whichever session is latest.
Retired registration send/abort closures can't act through a replacement host;
HTTP command IDs deduplicate execution within the registration. Late hello/command
completion can't reconnect or schedule the retired transport. The existing pending
work tracker backs `whenAiAssistantBridgeSettled()` for actual transport teardown,
not run success. Conversation-save and maintenance notifications also check their
captured owners. Native bridge evidence here is the registered window surface,
not external MCP HTTP or remote telemetry delivery.

Terminal activity and actual detached application completion are different events.
P3 intentionally lets A's terminal UI settle while its original proposal-host
promise is still pending, so that B can run. For a late-completion race, subscribe
before A starts and await that exact host promise plus terminal activity after
release. HTTP continuation, a render frame, idle state, or a terminal activity
already published before release can't prove the detached continuation finished.
The [native completion observer](../scripts/qa/ai-harness-p3-completion.mjs) returns
the original promise unchanged; its QA-only served transform is enabled only for
`late-cancel`. The first terminal-only apparent GREEN remains an unaccepted gap.

In the repaired human-edit race, the finite human edit/save/read owner controls
transport release, including retries. Failure or cleanup rejects the hold instead
of returning a final AI response. Observers subscribe before Send; only this race
defers its unchanged completion timers until immediately before successful release.
Human actions, evaluations, remote reads and cleanup keep rejecting bounds. This
removes the competing hold timer, not the product request bound or latency limits.

The integrated packet records tile 7, width 336 and existing `item_potion` price 137
saved and independently read at action 74, owner completion while still held at 75,
release at 76 and final HTTP response at 77. At 75, A has no result or terminal
activity, no successful apply receipts and no rejection notifications. After stale
rejection, all three values remain local and remote; successful receipts remain
empty and two Panel/runner rejection notifications appear. Those are notifications,
not two adapter invocations. Typed consumers agree on `failed / unassessed / draft`,
not a prose-derived verdict. Earlier deadline failures and isolated successes stay
historical; a faster successful run alone doesn't prove the lifetime correction.

Sources: [session](../src/ai/assistantSession.ts), [runner](../src/editor/panels/aiTurnRunner.ts),
[Panel](../src/editor/panels/aiChatPanel.ts), [bridge](../src/editor/aiAssistantBridge.ts),
[apply boundary](../src/editor/tools/applyChangesetToStore.ts).
See [source-bound evidence and limits](../output/evidence/ai-harness/p3/README.md).
No durable checkpoints, remote schema or distributed/two-tab writer guarantee is implied.

## P2 outcome publication (2026-09-06)

Use typed outcome fields to distinguish execution, goal assessment and current
delivery. Don't infer them from assistant prose, status labels, scheduler
`done/skipped` or legacy `stoppedReason`. The latter keeps its existing values.
[Contract and UI hooks](editor-ai-panel.md#p2-run-outcomes-and-user-scope-actions-2026-09-06)
describe the axes; [P2 evidence](../output/evidence/ai-harness/p2/README.md) records
which actual entry points were exercised.

| Surface | Current contract |
| --- | --- |
| Session | `TurnResult.runOutcome`, `getRunOutcome()`, `getHarnessSnapshot().runOutcome` |
| Event | `{ type: "run_outcome", runOutcome }` at real settlement |
| Bridge | `AiBridgeTurnResult.runOutcome` on completed Panel sends; harness reads the live session |
| Activity | `AiActivityLogRecord.result.runOutcome` and `result.recap.runOutcome`, retained by `buildAiActivityLogRecord` |
| Recap | `RunRecap.runOutcome`, including compact `run-recap` JSON |
| UI | One visible `ai-run-outcome` node with execution/goal/delivery data attributes |

Ordinary application settles the original returned result and recap after the
actual apply response and P1 proof, before final runner activity/bridge/UI
publication. Applied milestones and later pending calls remain distinct; draft
display precedence doesn't discard or replay milestones. The existing compact
recap audit slot is updated, not appended as a duplicate. Late proof callbacks
can't settle a newer result owner. Read-only getters recheck freshness but don't
rewrite stored activity, audit or acceptance evidence. Post-turn withdrawal
refreshes the live session/UI; it doesn't rewrite already-published activity rows.

R1 separates inspectable session context from current question delivery. After a
successful write is cancelled, `getProposedProject()` can still expose its detached
draft while explicit or inferred Ask publishes no proposed calls and no draft
delivery (`hasPendingDraft: false`). Don't infer apply authority from that snapshot
or a pending baseline-sync refusal. The [R1 native scenario](testing.md#p2-r1-retained-draft-ask-2026-09-07)
checks result, recap, getter, harness, fresh serialized activity and visible DOM
outcome agreement. Its successful-apply receipts aren't apply-invocation counts;
the real-adapter unit regression asserts those counts, including zero calls.

R3 wiki delivery comes from coordinator apply/save callbacks, not a later global
store diff or tool count. The writer captures the applied project inside the
mutation, before synchronous subscribers can replace it. The store's private
receipt association records the actual `projectAtSubmit`;
`isPersistenceReceiptForProject(receipt, project)` checks that submitted owner,
not content equality or the latest live revision. A copied, missing or unrelated
receipt can't establish owned persistence, nor can a catch-up save of a human edit.
Accepted persistence remains historical fact after a later edit/cancel, while
`isPersistenceReceiptCurrent` and P1 proof separately determine current verification.
Late old-run callbacks can't republish either result. Post-tool wiki progress has
its own later revision, so don't attach the earlier tool commit ID to its proof.

Outcome fields are optional in compatibility types. Legacy stored records without
them remain without them; `parseRunRecapPayload` accepts only the typed axis
literals and doesn't recover authority from prose. Bridge readiness/configuration
or other pre-send errors may omit the field too. A retained historical proof isn't
current delivery authority, and commit-log POST failure isn't project-save failure.
The real browser matrix injects a labelled commit-log HTTP fault while still
saving/proving the project; this isn't evidence of a remote outage. Browser checks
use the registered production window bridge and local activity serialization,
not external MCP HTTP or remote telemetry delivery.

Sources: [session settlement](../src/ai/assistantSession.ts),
[runner](../src/editor/panels/aiTurnRunner.ts),
[activity builder](../src/ai/activityLog.ts), [recap parser](../src/ai/runRecap.ts),
[bridge](../src/editor/aiAssistantBridge.ts).

## 되돌리기 스택과 감사 로그는 다르다

`mapEditHistory`(되돌리기)와 `editActivityLog`(감사)는 요구가 정반대다. 한 자료구조로 겸업하면 둘 다 나빠진다.

| | `mapEditHistory` (되돌리기) | `editActivityLog` (감사) |
|---|---|---|
| 담는 것 | **before** 스냅샷(프로젝트 또는 맵 1개) | **after** 를 포함한 변경 사실 |
| 중복 | dedup — 직전 서명이 같으면 push 안 함, 타이핑은 `recordCoalescedSnapshot` 으로 커밋 1건 | 전량(드래그만 600ms 창에서 병합, 병합 사실도 `mergedCount` 로 남는다) |
| 상한 | 50건, 대형 스냅샷(10,000셀 이상 또는 맵 12개 초과)은 25건 | 500건 |
| 수명 | 휘발 — 새로고침에 사라진다 | 영속 — localStorage 200건 + `output/edit-activity/edits.jsonl` + **저장할 때마다 DB 커밋 row** |
| 폐기 | 가능 — `truncateMapEditHistoryFromMarker` 로 잘라낸다 | 불변 — 되돌려도 되돌린 사실이 남는다 |
| 비용 | 스냅샷당 `structuredClone` 1회 | 엔트리당 객체 1개 push |

**모달 드래프트 편집에 전역 스냅샷(`recordProjectSnapshot`)을 넣지 마라.** 이유 세 가지:

1. 스냅샷은 전 프로젝트/맵 복제다. 타이핑마다 넣으면 되돌리기 스택 50칸(대형 맵은 25칸)이 한 필드 편집으로 포화되고, 직전의 페인트·맵 작업이 밀려 나간다.
2. 드래프트 본문은 확정 전까지 편집 세션과 금고(`eventDraftVault`)에만 산다. 미확정 상태를 스냅샷으로 만들면 Ctrl+Z 가 "적용하지 않은 편집" 을 되살린다.
3. 감사 목적이라면 스냅샷이 필요 없다 — `store.update` 의 `label`/`fields` 로 충분하고, 그게 이 페이지의 요점이다.

이벤트 편집기가 이미 이 형태다: 되돌리기 스냅샷은 **적용 시점 1건**(`saveEventDraft` → `recordProjectSnapshot(label, mapId, { kind: "map" })`), 감사 로그는 생성·편집 시작·적용·취소가 각각 1건씩. 취소도 기록한다 — "내가 고친 게 왜 없지?" 를 추적할 때 필요한 정보다.

## Toolbar history confirmation lifetime (PR716, 2026-09-09)

- `tileHistoryMenu.ts` binds multi-step confirmation to both the rendered stack's
  `getMapEditHistoryRevision()` and the current project object. The revision advances
  synchronously on history changes, before coalesced UI notifications, and never
  resets with the entry marker. New snapshots, traversal, truncation, reset/repopulate,
  and same-ID project replacement invalidate the pending decision. A stale Confirm
  leaves the current project and both stacks untouched and asks for a fresh selection.
- Disclosure clicks read live `openDirection`; a render-time expanded flag is stale
  after outside-pointer/Escape dismissal and would require two clicks to reopen.
- The history group uses the surrounding toolbar gap without an extra right margin.
  The redundant 2px margin produced a measured 233/234px client/scroll width; the
  repaired Standard toolbar measures 233/233px at 1024, 1280 and 1440px viewports.
- Regression seams: `tileToolbarHistoryMenus.test.ts`, `mapEditRedoEntries.test.ts`,
  `mapEditHistoryProjectSwitch.test.ts`. `scripts/qa/pr716-repair.mjs` checks the real
  toolbar Confirm after a concurrent local edit, asserting unchanged project/stacks.
  Test confirmation spies call through to the real modal and await its continuation
  with a bounded deadline; no sleeps or guessed microtask counts.

## 디버깅 레시피

브라우저 콘솔:

| 호출 | 무엇을 주나 |
|---|---|
| `__oprnEditActivity({ limit: 30 })` | 편집 행위 엔트리(최신순, 객체) |
| `__oprnEditActivityText()` | 같은 것을 사람이 읽는 한 줄씩 — `라벨 · mapId · 12셀 · ×3 · [pages[0].name]` |
| `__oprnExportEditActivity()` | JSON 덤프(붙여넣기용) |
| `__oprnUnlabeledEditCount()` | 라벨 없이 들어온 mutation 수. 0 이 목표 |
| `__oprnLogs({ minLevel: "warn", ns: "store" })` | 로거 링버퍼(전량 적재, 최신순) |
| `__oprnLogText({ minLevel: "warn" })` | 같은 것을 텍스트로 |
| `__oprnErrors({ excludeResource: true })` | 트랩된 예외/거부 Promise. 리소스 404 를 뺀 게 기본 시야 |
| `__oprnErrorCount()` | 접힌 발생 횟수까지 합친 총계(엔트리 수만 보면 폭주를 놓친다) |
| `__oprnSetLogLevel("debug")` | 콘솔 임계값 변경(저장됨) |
| `__oprnFlushEditActivityMirror()` | 디스크 미러 배치를 즉시 밀어낸다 |

디스크(에이전트·CLI 경로 — 브라우저 콘솔에 손이 닿지 않을 때):

```bash
npm run edit:log                    # 표. --limit N / --scope map|database|system|assets|project / --map <id> / --json
cat output/edit-activity/edits.jsonl # append-only 원본(필드 상세 포함)
cat output/edit-activity/index.json  # CLI 표가 읽는 최근 200건 요약
```

미러는 1500ms 배치로 `POST /__oprn/edit-activity` 를 쳐서 dev/preview 미들웨어가 파일로 흘린다.
미들웨어가 없는 환경(실제 배포)에서는 **첫 실패로 스스로 꺼지고** `log.warn` 한 줄만 남긴다 —
`output/edit-activity/` 가 안 갱신되면 먼저 dev 서버로 띄운 세션인지 확인하고,
`VITE_EDIT_ACTIVITY_DISK_MIRROR=0` 으로 명시적으로 끈 것이 아닌지 본다.

**AI 경로는 별도 채널이다.** `output/ai-activity/` + `npm run ai:log`(`src/ai/activityLog.ts`).
편집은 분당 수십 건이라 한 채널에 섞으면 AI 턴이 묻힌다. AI 턴을 조사할 때는 `ai:log`,
사람 편집을 조사할 때는 `edit:log` 를 본다.

**사용자 창구는 ☰ 「사용 로그 내려받기」다 (2026-09-09).** 위 두 줄은 워크트리에 손이 닿는
에이전트·개발자용이다. 브라우저만 있는 사용자에게는 경로가 없었으므로, AI 패널 두 ☰ 표면
(`ai-more-usage-log` / `ai-command-menu-usage-log`)에서 링버퍼 전체를 그 자리에서
`ai-usage-log-<시각>.txt` 로 내려받는다. 서식은 `src/ai/activityLogText.ts` — **JSON 이 아니라
사람이 통독하는 글**이고(한 턴이 한 문단), 예산에 걸려 잘린 몫은 `잘린 기록:` 으로 밝히고,
기록이 0건이면 빈 파일 대신 안내 토스트를 띄운다. 기계 판독용 `serializeAiActivityLogs()` 는
그대로 남는다. 상세: `openwiki/editor-ai-panel.md` 「사용 로그는 그 자리에서 .txt 로 나온다」.

### 저장된 것 — DB 커밋에 실린 행위 (`npm run commit:log`)

Audit writes to `project_commits` / `project_changes` are append-only POSTs with
`Prefer: return=minimal`. Do not inherit `resolution=merge-duplicates` from ordinary
upserts: anon intentionally has no UPDATE/DELETE privilege on these tables.
Task37's disposable HTTP proof and limitations are in
[`test/integration/spatial-audit-append.md`](../test/integration/spatial-audit-append.md).

위의 두 채널은 **세션 자산**이다. 링버퍼는 새로고침에 끊기고, 디스크 미러는 워크트리를 바꾸면
갈리고 배포 환경에는 아예 없다. 그래서 "며칠 전 그 세션에 무슨 행위가 있었나" 를 조사할 수단이
없었다. 저장 경계마다 행위 기록을 **커밋 row 에 실어** 그 구멍을 메운다.

```bash
npm run commit:log                  # 커밋 표(최신순) + 커밋별 행위 건수
npm run commit:log -- --edits       # 커밋마다 그 안의 행위를 펼친다
npm run commit:log -- --origin ai   # AI 편집이 실린 커밋만 (human|ai|tool|system)
npm run commit:log -- --map map_x   # 그 맵을 건드린 행위가 실린 커밋만
npm run commit:log -- 50 --json     # 원본 JSON(에이전트·스크립트용)
```

경계와 상한 (`takeEditActivitySince`):

| 축 | 값 | 왜 |
|---|---|---|
| 실리는 범위 | 지난 커밋 이후(커서) | 커서가 없으면 매 저장에 세션 전체가 반복돼 row 가 계속 커진다 |
| 개수 상한 | 300건, **최신 쪽**을 남긴다 | 저장 시점에 가까운 행위가 그 저장을 설명한다. 링버퍼·localStorage 와 절단 방향이 같다 |
| 덩치 상한 | 직렬화 6.4만 자 | 필드 상세가 붙은 엔트리는 최악 40필드 × 400자 — 개수만 막으면 row 가 수 MB 가 된다 |
| 빠진 몫 | `patch_json.editsOmitted` | 조용히 자르면 "이 저장에는 편집이 3건뿐" 으로 읽힌다. `실린 것 + 빠진 것 = 있었던 것` 이 불변식이다 |
| 행위 0건 | `edits` 키를 **넣지 않는다** | `edits: []` 를 쓰면 "이 축이 붙기 전 커밋" 과 구분이 안 된다. 리더는 `-` 로 보여준다 |

커서는 원격 기록이 실패해도 전진한다 — 재시도하면 같은 엔트리가 두 커밋에 실린다.
감사 기록에서 중복은 누락보다 나쁘다(같은 행위가 두 번 있었던 것으로 읽힌다).
dedup baseline(`lastManualSerialized`)은 정반대로 실패 시 전진하지 않는데, 그쪽은 커밋 자체가
영구히 사라지는 문제라 보수적으로 잡는 것이 맞다.

## 로거

```ts
import { createLogger } from "@/util/logger";
const log = createLogger("store");   // 네임스페이스 = 서브시스템 이름, 필터 축
log.warn("편집 행위 기록 실패", error);
```

- **링버퍼(1000)는 레벨과 무관하게 전량 적재한다.** 콘솔 출력만 임계값으로 막는다 — 사고 조사에서 필요한 건 보통 그때의 `debug` 인데, 임계값으로 버퍼까지 막으면 정작 필요한 순간에 비어 있다.
- 임계값 결정 순서: URL `?logLevel=debug` → localStorage `oprn:log-level` → DEV 는 `debug`, 그 외 `info`. URL 이 최우선인 이유는 QA·에이전트가 저장소를 건드리지 않고 한 세션만 시끄럽게 만들 수 있어야 하기 때문이다.
- `detail` 은 복사·직렬화하지 않고 그대로 들고 있는다. 직렬화는 조회 시점(`serializeLogEntries`)에 한다.
- 새 `console.warn` / `console.error` 를 심지 말고 `createLogger` 를 쓴다. raw 콘솔은 버퍼에 남지 않아 사후 조사에서 존재하지 않는 것과 같다.
- 오류 트랩은 `preventDefault()` 를 부르지 않는다 — 브라우저 기본 리포팅과 Playwright `pageerror` 를 그대로 살려 둔다. 리소스 404 는 `warn` + `kind: "resource"` 로 분리해 링버퍼가 에셋 404 로 덮이지 않게 한다.

## 알려진 남은 공백 (여기 손대는 사람이 이어서 하라)

달리 적지 않았으면 2026-08-29 실측이며, 이번 변경에서 **고치지 않았다.**

| 공백 | 실측 근거 | 결과 / 이어서 할 일 |
|---|---|---|
| store 를 바꾸면서 되돌리기 스냅샷을 남기지 않는 파일 24개 | `test/storeUndoSnapshotInventory.test.ts` (2026-09-14 실측) | 그 경로로 바뀐 것은 Ctrl+Z 로 되돌아가지 않는다(감사 로그에는 남는다). ~~명단을 손으로 관리하면 썩는다 — 구조 테스트로 고정하는 것이 후속 과제다~~ **고정함 (2026-09-14)** — 명단은 이제 그 테스트의 `KNOWN_WITHOUT_SNAPSHOT` 이 정본이고, **여기 다시 적지 않는다**. 양방향 래칫이라 새 구멍이 생겨도, 고친 파일을 명단에서 안 빼도 실패한다 |
| ~~`resetMapEditHistory()` 프로덕션 호출 0건~~ **고침 (2026-08-29)** | 이전 실측: `grep -rn "resetMapEditHistory" src/` → 정의 1건뿐, 호출은 테스트에만. 그래서 프로젝트를 갈아탄 뒤 Ctrl+Z 가 **이전 프로젝트의 스냅샷**을 새 프로젝트에 적용했다 | `ProjectChangeAnnotation.projectSwitch` 신호로 끝난다. 신호를 싣는 경로는 네 곳이다 — `replaceProject()`, `loadNewRemoteProject()`, `loadNewRemoteProjectTransactionally()`(웰컴 장르 프리셋 경로), `reconnectRemotePersistence()`(작업 선택기에서 저장된 프로젝트 열기). `reloadFromRemote()` 는 **같은 projectId** 를 다시 읽는 경로라 의도적으로 싣지 않는다.

**함정 (실측으로 데이터 손실을 만들었다): `replaceProject()` 는 프로젝트 교체 전용이 아니다 — AI 제안 적용 경로이기도 하다.** `applyChangesetToStore.ts` 는 `recordProjectSnapshot()` 을 찍은 **직후** `reset_project` 턴에서 `replaceProject()` 를 부른다. 마커를 무조건 싣게 두면 구독자가 방금 찍은 되돌리기 스냅샷을 동기적으로 지우고, 그러면서 `aiProposalCard` 는 「되돌리려면 Ctrl+Z」라고 안내한다 — 거짓 복구 약속과 함께 복구 불가가 된다. AI 초기화는 **같은 projectId·같은 원격 행의 대량 편집**이지 교체가 아니므로, 그 호출부는 `{ ...change, projectSwitch: false }` 로 명시적으로 빠져나온다. 그래서 필드 타입이 `?: true` 가 아니라 `?: boolean` 이다. 계약 테스트: `test/projectResetTool.test.ts` 의 「keeps the pre-reset project available through undo」.

**아직 마커가 없는 곳 하나 — `clearAll()`(`store.ts:821`).** 이건 `createBlankProject()` 로 `this.current` 를 통째로 갈아치우는 진짜 전체 초기화인데 마커 없이 emit 한다. **오늘은 도달 불가**라서 결함이 아니다 — 참조가 정의 자신, 「새 프로젝트」 메뉴가 이걸 일부러 안 쓰게 됐다는 `menu.ts:728` 의 설명 주석, 그리고 `storeMutationInstrumentation.test.ts:120` 뿐이다. 다만 **누군가 `clearAll()` 을 UI 에 다시 연결하면 이 문서 맨 위의 Ctrl+Z 교차 오염이 조용히 되살아난다.** 그때 `projectSwitch: true` 를 함께 실어야 한다. `mapEditHistory` 가 `store.subscribe` 로 받아 스스로 리셋한다(`installProjectSwitchHistoryReset`, `tileActions.ts` 의 lazy-guard 패턴). **`store.replace()` 자신에 리셋을 걸지 마라** — undo 가 스냅샷을 적용하는 경로가 바로 `store.replace()` 다(`mapEditHistory.ts:122`, `:304`). 교체 호출부마다 리셋을 박는 방식도 기각했다(교체 경로가 4곳 이상이라 이 버그가 생긴 방식을 반복한다). 계약 테스트: `test/mapEditHistoryProjectSwitch.test.ts` |
| `getCurrent()` 가 라이브 참조를 반환한다 | `return this.readOnlyProjectSnapshot ?? this.current` (`store.ts:552`). `interface Project` 에 `readonly` 0개 | 호출자가 반환값을 직접 고치면 store 를 지나지 않은 변경이 되어 계측·generation·자동저장 전부를 우회한다. 지금은 규율로만 유지된다(`beginReadOnlyProjectSnapshot` 은 런타임 소비자용 임시 창) |
| `scope: "assets"` 는 타입에만 있다 | `ProjectChangeDescriptor` 와 `EditActivityScope` 에는 있으나 emit 사이트 0건 | 리소스 매니저·타일셋 메타데이터 편집이 `project`/`system` 으로 뭉쳐 기록된다. 에셋 편집을 이 스코프로 라우팅하거나 타입에서 뺄 것 |
| `mapEditLocks` 로 편집이 거부된 사건이 기록되지 않는다 `canEditMap()` 거부 지점(`EditScene.ts`, `TilePaintEngine.ts`, `DragOperationHandler.ts`, `actions.ts`)은 `toast(mapEditLockNotice(...))` 나 조용한 `return` 만 한다 | "칠했는데 아무 일도 안 일어난다" 가 로그·감사 어디에도 안 남는다. 거부는 mutation 이 아니라 초크포인트를 지나지 않으므로 별도로 남겨야 한다 |

```bash
# 되돌리기 스냅샷 없이 store 를 바꾸는 파일 — 명단은 테스트가 들고 있다
npx vitest run test/storeUndoSnapshotInventory.test.ts
```

**명단을 여기 옮겨 적지 마라.** 2026-08-29 에 21개로 적어 둔 명단을 2026-09-14 에 다시 재니
24개였고, 그 사이 다섯 개(`eventPages.ts`, `pageProps.ts`, `structureKitEditorDialog.ts`,
`structureKitInspector.ts`, `tilesetMetadataEditor.ts`)는 **고쳐졌는데 명단에 남아 있었고** 여덟 개는
**새로 생겼는데 명단에 없었다** — 문서를 읽은 사람이 두 방향 모두에서 틀린 지도를 받았다. 그래서
정본을 `test/storeUndoSnapshotInventory.test.ts` 의 `KNOWN_WITHOUT_SNAPSHOT` 으로 옮겼다. 그 테스트는
새 구멍이 생겨도, 고친 파일을 명단에서 안 빼도 실패한다.

판정 잣대는 위 재측정 명령과 같은 **파일 단위 어림**이다 — 한 파일 안에서 어떤 함수는 스냅샷을 찍고
어떤 함수는 안 찍으면 초록이다. 통과를 "되돌리기가 된다"로 읽지 마라. 호출부 단위 판정은 남은 과제다.

## AI 툴·액션 이유 (2026-09-02)

채팅 턴이 죽은 뒤에도 `tile_erase` 같은 쓰기의 **한 줄 이유**가 남아야 한다. 빈 pending 시작 행이 풍부한 행을 덮으면 안 된다.

- 모델 툴: 스키마 필수 `reason`. 없으면 실행하지 않는다 (`src/ai/toolReason.ts`).
- 하네스(검증·밑그림 NPC): 코드가 이유를 붙인다.
- 프론트 클릭: `사용자 클릭: <label>` (`recordAiUiEvent`).
- 편집 행위: `EditActivityEntry.reason` — AI 적용은 툴 reason, 사람 편집은 라벨에서 만든다.
- 저장: 같은 값이 localStorage + LegacyDb `payload_json` / `entries_json` / 커밋 첨부 슬라이스에 실립니다. 중간 업서트는 `aiTurnRunner` 의 매 `tool_call`.

## 맵 화면이 버벅일 때 (2026-09-24)

타일 그림은 Phaser Tilemap 이 아니다. 칸마다 GameObject 라서, **도구·선택 타일·레이어가 바뀔 때 `renderEditScene` 으로 전부 부수면** 큰 맵이 멈춘다. 그 입력은 `EditScene.viewChromeKey` 와 `applyEditTileLayerPresentation` 이 색·오버레이만 고친다. 타일 오브젝트를 다시 만드는 키(`renderStateKey`)는 맵 id 와 배경 미리보기뿐이다.

맵 목록 썸네일도 같은 통지에 다시 그려지면 안 된다. `editorStateNeedsMapTreeRefresh` 는 현재 맵이 바뀔 때만 참이다. 타일·도구·레이어는 `schedulePaletteOnlyRefresh` 로 팔레트만 다시 그린다.

플레이 쪽 화면 밖 정지는 `playSceneTileCulling` 이 16칸 버킷으로 하고, 창 밖에 나간 스프라이트 애니메이션은 `pause` 한다. `active = false` 로 끄지 마라. 그 플래그는 파괴된 객체를 뜻해서, 다음 창에서 타일이 되살아나지 않는다.

## 검증

- 계측·라벨·병합 회귀: `npm test -- test/editActivityRecording.test.ts` (초크포인트 6메서드, 라벨 없는 집계, NPC 편집 세션 재현, 연속 병합, `EventDiff` 라벨).
- 미러 엔드포인트 계약: `npm test -- test/editActivityEndpoint.test.ts` (상수와 미들웨어 경로가 어긋나면 404 로 조용히 죽는다).
- 커밋 첨부 계약: `npm test -- test/commitEditActivityAttachment.test.ts` (patch_json 에 실리는지, 커서가 반복을 막는지, 상한이 숫자로 남는지, 리더 CLI 가 같은 키를 읽는지).
- 위키 변경만 했으면 `npm run openwiki:verify`.

## Feature16 저작 보조 관측 경계 (2026-09-21)

`panels/aiAuthoring/shared.saveSettings`는 프로젝트 undo 스냅샷을 남기고
`store.update(..., {label, fields:['aiAuthoring']})`로 라이브러리/문체 규칙을 편집한다.
「프로젝트에 반영」과 실제 저장 receipt는 구분한다. 대사 검토는 읽기 전용이며
구조 검사와 LLM 검토의 출처를 지적마다 명시한다.
프롬프트 검사기는 `ai/authoring/promptInspection.ts`의 메모리 한 건만 사용한다.
LLM 전송 본문과 Pi provider payload에서 민감값을 가린 뒤 표시용 사본만 보관한다.
Pi의 `prompt_inspection` 이벤트는 client에서 소비하고 일반 감사/대화 이벤트 전달에서
제외한다. 기존 로컬 진단 수집 동의나 영구 AI 로그에 새 원문 저장 경로를 추가하지 않는다.
상세 UI/수명/중앙 검증 명령은 `editor-ai-panel.md`의 Feature16 절을 따른다.

## 연속 AI 적용의 구독자 비용 (2026-09-28)

`editor/projectReferenceIssues.ts`는 작성 여정·진행 패널의 참조 검증 결과를 Project 객체와
store lineage/generation으로 공유한다. 로드 정규화가 쓰는 순수 검증기는 캐시하지 않는다.
`editor.ts`는 작성 진행 기록을 통지마다 저장하고, 표면 갱신만 rAF로 합친다.
서로 다른 범위나 팔레트 요청이 겹치면 전체 패널 갱신으로 승격하며, teardown 뒤 예약은 버린다.
지연된 store 구독자 오류도 기존 store 로거에 남긴다.

맵 연결 인덱스·그래프는 맵 구성/순서/id, 각 events 배열, mapConnections, startMapId로
재사용하고 이벤트 명령 순회도 events 배열별로 공유한다. 연결 패널은 그래프·맵 이름·선택이
같으면 DOM을 보존한다. 이벤트 배열 내부는 제자리 수정하지 않는 store 불변성 계약을 따른다.

열린 규칙 감사 패널은 마지막 통지 뒤 250ms에 검사한다. 닫힘·재마운트·포인터 대기를
다시 확인하여 폐기된 패널이나 진행 중인 새 편집에 옛 예약이 끼어들지 않게 한다.
전역 count 규칙과 좌표 없는 위반의 보고 범위를 유지하려고 mapIds 부분 병합은 하지 않았다.

EditScene은 store 렌더 계획이 skip이면 유휴 게이트를 깨우지 않는다. 실제 변경은
requestEditRenderFrame으로 한 프레임만 요청하고, 카메라·포인터의 연속 렌더 정책은 유지한다.

직접 도구·도구 묶음은 `toolMapCellApply`로 단일 맵의 타일 변경만 증명된 경우 기존
`mapCellApply` → `replace({renderCells})` 경로를 사용한다. 네 층·그림자·스택을 비교하고,
오토타일 이웃 확장은 기존 렌더러가 맡는다. `replace`에는 changedMapIds 옵션이 없으므로
여러 맵/속성/이벤트/프로젝트 데이터 변경, 추가·삭제와 2,048셀 초과는 전체 통지를 유지한다.

새 워크트리 재측정: 이벤트 2,000건 기준 검증 5.338→0.196ms/호출, project 통지 200회
패널 DOM 4,400→22개. Chromium 연결 패널은 0.946→0.023ms/통지, DOM 18,800→0개.
규칙 감사(100ms 간격 20회)는 7→1회, 100×100 한 칸 렌더는 10,000→9객체.
하네스·명령·원자료·제한은 `verify-shots/perf-editor-subs/SUMMARY.md`에 기록했다.

### 텍스처 완료 redraw 합치기 (2026-09-28)

`EditScene`의 캐릭셋·이벤트 스프라이트·업로드 타일셋·번들 로더 onReady 및 맵 전환의
타일셋 onReady는 같은 rAF 예약 함수를 사용한다. 한 프레임에 완료된 텍스처 수와 무관하게
전체 redraw와 단발 렌더 요청은 한 번이다. cleanup은 예약을 취소하고 종료 중에는
늦은 완료 콜백을 무시한다. 재시작 전 예약은 epoch로 무효화하되, 씬별 pending 로더가
재사용하는 완료 콜백은 재시작 후 새 프레임을 요청할 수 있게 유지한다.
동기 store redraw와 프레임 등록·로드 오류 처리는 유지한다. 실측은
`verify-shots/perf-editor-subs/SUMMARY.md`의 텍스처 완료 항목에 기록한다.

실측(실제 EditScene 메서드 + 로더/rAF/그리기 대역): 같은 프레임 전 84개 완료의 redraw는
84→1회, 6묶음은 504→6회다. 동기 store redraw 6회는 양쪽 모두 유지한다. 완료가 여러
프레임에 걸치면 각 프레임마다 한 번이며, 위 수치는 감독자 프로파일의 전체 소요 시간 개선율이 아니다.

실행 중지 정정 후에는 Vitest·tsc를 재실행하지 않고 독립 Node 스크립트로 관련 메서드
원문을 실행하여 84→1회/6묶음 504→6회를 재확인했다. 84개 완료를 6프레임으로 나누면
84→6회다(`verify-shots/perf-editor-subs/texture-node.json`). 실제 Phaser 수명 이벤트 연결은
이 호출 수 하네스 범위 밖이며, 과거 테스트 실행 이력과 정정 후 코드 검토는 SUMMARY에서 구분한다.


## 조수 적용·체크리스트 경로의 전체 문서 비용 (2026-09-28)

새 프로젝트 기본 자료(약 149MB: 타일셋 82MB · 업로드 자산 66MB)에서 조수 체크포인트 하나가 메인 스레드를 약 4s 멈췄다.
실측 도구는 `scripts/qa/ai-assistant-lag-perf.mjs`(실제 편집기·스토어, 전송만 NDJSON 대본, `PROFILE=1` 이면 CDP 프로파일 상위 함수를 남긴다).
원인과 대응은 아래와 같다. 판정 결과는 바꾸지 않았고, 비용만 줄였다.

- **체크리스트 갱신**(`AssistantSession.refreshAcceptance`, 스토어 통지마다): 프로젝트 두 개의 `JSON.stringify` 비교(149MB 에서 2.2~2.6s)와
  `structuredClone`(1.3s)를 `sameAcceptanceContent`(내용 요약 비교 — 지문과 같은 판정)와 `cloneProjectSharingSharedDictionaries`(타일셋·업로드 공유)로 바꿨다.
  세션·원장의 다른 전체 프로젝트 지문 비교도 같은 함수로 옮겼다. 첫 비교의 판정 차이는 하나다: 키 순서만 다른 같은 내용을 더는 «바뀜» 으로 보지 않는다.
- **적용 권위 요약**(`applyChangesetToStore` 의 `withIdentityScope`): 같은 동기 구간 안에서는 요약의 노드 대조를 한 번만 한다(`withContentDigestEpoch`).
  `projectIdentityDigest` 는 한 번 요약한 타일셋·업로드 자산 항목을 다음 권위 요약부터 대조하지 않는다(`withTrustedSharedEntries` —
  projectClone 계약: 두 사전의 항목은 제자리에서 고치지 않는다). 사람 편집의 제자리 수정이 일어나는 맵·DB·시스템은 계속 대조한다.
  로드 정규화처럼 공유 항목을 제자리에서 고치고 전후 요약으로 알아내는 곳은 믿음 없이 끝까지 대조한다.
- **저장 왕복 검사**(`projectLint.checkRoundtrip`, 적용 커밋마다): 글은 `serializeReusingSharedDictionaries`(항목 글 기억, `serialize` 와 글자까지 같다)로 만들고,
  이미 왕복을 통과한 타일셋·업로드 항목(같은 객체)은 뼈대 글로 되읽는다(`serializeForRoundtripCheck`). 공간 저작이 있는 문서는 뼈대를 쓰지 않는다
  (공간 참조가 타일셋 `structureKits` 를 읽는다). 맵·DB 등 나머지 문서의 깨짐과 새 타일셋 객체의 깨짐은 그대로 잡힌다.
- **실행 요청의 무거운 키 해시**(`heavyWire.planHeavyWire`, 턴마다): 사전 객체가 새것이어도 내용 요약이 같으면 글·SHA-256 을 다시 만들지 않는다.
- **첫 턴·첫 적용 준비 비용**: 조수 패널이 뜬 뒤와 무거운 키가 바뀐 스토어 통지 뒤, 한가할 때(`requestIdleCallback`) 무거운 키 글·해시
  (`warmHeavyWire`)와 첫 적용의 왕복 통과 기록·권위 요약 기억(`warmApplyCaches`)을 미리 만든다. 판정에는 영향이 없다 —
  미리 만든 값은 값 대조를 통과할 때만 쓰인다. 이 준비가 없으면 첫 전송 직후 약 7s, 첫 체크포인트 약 2.7s 멈췄다.
- 편집기 구독자·캔버스(텍스처 적재마다 전체 redraw 등)는 위 "연속 AI 적용의 구독자 비용" 절, 조수 패널 DOM 은 `editor-ai-panel.md` 의 "AI 패널 렌더 비용" 절.

새 경로를 추가할 때: 전체 프로젝트를 `JSON.stringify`/`acceptanceFingerprint`/`structuredClone` 하는 비교·복제를 스토어 통지나 체크포인트마다 부르지 마라.
내용 비교는 `sameAcceptanceContent` 또는 `jsonContentDigest`, 읽기 전용 사본은 `cloneProjectSharingSharedDictionaries` 를 쓴다.

