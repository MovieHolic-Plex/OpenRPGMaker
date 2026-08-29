# Editor Observability — 계측 초크포인트 · 편집 감사 로그 · 오류 트랩

편집기의 mutation 경로를 건드리기 전에, 그리고 "방금 뭘 했더니 이렇게 됐다" 를 사후에 재구성해야 할 때 읽는다.
2026-08-29 관측성 감사에서 만든 계층이며, 그 전에는 사람 편집이 기록에 **한 줄도** 남지 않았다.

소유 파일:

| 파일 | 무엇을 소유하나 |
|---|---|
| `src/util/logger.ts` | 레벨·네임스페이스·링버퍼(1000) 로거. `createLogger(ns)` |
| `src/project/store.ts` | 계측 초크포인트(`markLocalMutation` → `recordChangeActivity`), `ProjectChangeAnnotation` |
| `src/editor/editActivityLog.ts` | 편집 행위 감사 로그(링버퍼 500 + localStorage 200 + 디스크 미러) |
| `src/editor/eventDiffLabel.ts` | `EventDiff` → 사람이 읽는 라벨 + 필드 목록 |
| `src/editor/editActivityEndpoint.ts` | `EDIT_ACTIVITY_DISK_ENDPOINT = "/__oprn/edit-activity"` |
| `src/app/errorTrap.ts` | 전역 오류 트랩(`window.onerror` / `unhandledrejection` / 리소스 404) |
| `vite.config.ts` | dev/preview 미들웨어 — `output/edit-activity/` 로 미러 |
| `scripts/list-edit-activity.mjs` | `npm run edit:log` (무브라우저 조회 경로) |

## 계측 초크포인트는 `store.markLocalMutation` 하나다

`ProjectStore` 에서 상태를 바꾸는 메서드는 5개고, 전부 `markLocalMutation` 을 지난다.
그 메서드들의 호출자는 **전부 클래스 안에** 있으므로 우회 경로가 없다 —
`mutationGeneration` 을 올리는 자리가 곧 계측 자리다.

| 메서드 | 기본 descriptor | 비고 |
|---|---|---|
| `update(mutator, change)` | `{ scope: "project" }` | 압도적 다수. 호출부 244곳 |
| `updateMap(mapId, mapMutator, change)` | `{ scope: "map", mapId }` | `cells` 로 셀 수가 넘어온다 |
| `replace(project, { change })` | `{ scope: "project" }` | undo·AI 적용·원격 병합이 공유 |
| `replaceProject(project, change)` | `label: "프로젝트 교체"` | 드래프트 금고를 버린다 |
| `clearAll()` | `label: "전체 초기화"` | |
| `restoreEventDraftFromVault(mapId, eventId)` | `label: "드래프트 금고 복원", origin: "system"` | |

이 성질 덕분에 **mutation 호출부 전량이 외부 파일 수정 없이 계측된다.**

```bash
grep -rnoE "store\.(update|updateMap|replace|replaceProject|clearAll|restoreEventDraftFromVault)\(" src/ | wc -l
# 2026-08-29 재측정 277 (store.ts 주석은 275 — 이 브랜치 작업 중 호출부가 늘었다).
# 정확한 수는 브랜치마다 흔들린다. 계약은 "전량이 한 지점을 지난다" 쪽이다.
```

계측이 편집을 막지 않게 만든 두 가지:

- `recordChangeActivity` 는 `try/catch` 로 감싸고 실패는 `log.warn` 으로만 남긴다. 기록 실패로 편집이 죽으면 관측 계층이 결함이 된다.
- `emit()` 은 리스너별 `try/catch` + `log.error` 다. 실측(2026-08-29): 격리가 없어서 구독자 하나가 던지면 뒤에 등록된 구독자 전부가 그 프레임에서 건너뛰어졌다(캔버스 재렌더·자동저장 예약·패널 갱신이 동시에 멈추는데 원인 로그가 없었다).

`normalizeCurrentProject` 는 예외다. 어느 정규화기가 적용됐는지 이름 배열로 기록하지만 **`mutationGeneration` 은 올리지 않는다** — 그 값은 저장 경합 판정용(local-first)이라 정규화가 사용자 편집으로 보이면 안 된다.

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

## 되돌리기 스택과 감사 로그는 다르다

`mapEditHistory`(되돌리기)와 `editActivityLog`(감사)는 요구가 정반대다. 한 자료구조로 겸업하면 둘 다 나빠진다.

| | `mapEditHistory` (되돌리기) | `editActivityLog` (감사) |
|---|---|---|
| 담는 것 | **before** 스냅샷(프로젝트 또는 맵 1개) | **after** 를 포함한 변경 사실 |
| 중복 | dedup — 직전 서명이 같으면 push 안 함, 타이핑은 `recordCoalescedSnapshot` 으로 커밋 1건 | 전량(드래그만 600ms 창에서 병합, 병합 사실도 `mergedCount` 로 남는다) |
| 상한 | 50건, 대형 스냅샷(10,000셀 이상 또는 맵 12개 초과)은 25건 | 500건 |
| 수명 | 휘발 — 새로고침에 사라진다 | 영속 — localStorage 200건 + `output/edit-activity/edits.jsonl` |
| 폐기 | 가능 — `truncateMapEditHistoryFromMarker` 로 잘라낸다 | 불변 — 되돌려도 되돌린 사실이 남는다 |
| 비용 | 스냅샷당 `structuredClone` 1회 | 엔트리당 객체 1개 push |

**모달 드래프트 편집에 전역 스냅샷(`recordProjectSnapshot`)을 넣지 마라.** 이유 세 가지:

1. 스냅샷은 전 프로젝트/맵 복제다. 타이핑마다 넣으면 되돌리기 스택 50칸(대형 맵은 25칸)이 한 필드 편집으로 포화되고, 직전의 페인트·맵 작업이 밀려 나간다.
2. 드래프트 본문은 확정 전까지 편집 세션과 금고(`eventDraftVault`)에만 산다. 미확정 상태를 스냅샷으로 만들면 Ctrl+Z 가 "적용하지 않은 편집" 을 되살린다.
3. 감사 목적이라면 스냅샷이 필요 없다 — `store.update` 의 `label`/`fields` 로 충분하고, 그게 이 페이지의 요점이다.

이벤트 편집기가 이미 이 형태다: 되돌리기 스냅샷은 **적용 시점 1건**(`saveEventDraft` → `recordProjectSnapshot(label, mapId, { kind: "map" })`), 감사 로그는 생성·편집 시작·적용·취소가 각각 1건씩. 취소도 기록한다 — "내가 고친 게 왜 없지?" 를 추적할 때 필요한 정보다.

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

전부 2026-08-29 실측이며, 이번 변경에서 **고치지 않았다.**

| 공백 | 실측 근거 | 결과 / 이어서 할 일 |
|---|---|---|
| store 를 바꾸면서 되돌리기 스냅샷을 남기지 않는 파일 21개 | 아래 재측정 명령 | 그 경로로 바뀐 것은 Ctrl+Z 로 되돌아가지 않는다(감사 로그에는 남는다). **명단을 손으로 관리하면 썩는다 — 구조 테스트로 고정하는 것이 후속 과제다** |
| ~~`resetMapEditHistory()` 프로덕션 호출 0건~~ **고침 (2026-08-29)** | 이전 실측: `grep -rn "resetMapEditHistory" src/` → 정의 1건뿐, 호출은 테스트에만. 그래서 프로젝트를 갈아탄 뒤 Ctrl+Z 가 **이전 프로젝트의 스냅샷**을 새 프로젝트에 적용했다 | `ProjectChangeAnnotation.projectSwitch` 신호로 끝난다. 신호를 싣는 경로는 네 곳이다 — `replaceProject()`, `loadNewRemoteProject()`, `loadNewRemoteProjectTransactionally()`(웰컴 장르 프리셋 경로), `reconnectRemotePersistence()`(작업 선택기에서 저장된 프로젝트 열기). `reloadFromRemote()` 는 **같은 projectId** 를 다시 읽는 경로라 의도적으로 싣지 않는다.

**함정 (실측으로 데이터 손실을 만들었다): `replaceProject()` 는 프로젝트 교체 전용이 아니다 — AI 제안 적용 경로이기도 하다.** `applyChangesetToStore.ts` 는 `recordProjectSnapshot()` 을 찍은 **직후** `reset_project` 턴에서 `replaceProject()` 를 부른다. 마커를 무조건 싣게 두면 구독자가 방금 찍은 되돌리기 스냅샷을 동기적으로 지우고, 그러면서 `aiProposalCard` 는 「되돌리려면 Ctrl+Z」라고 안내한다 — 거짓 복구 약속과 함께 복구 불가가 된다. AI 초기화는 **같은 projectId·같은 원격 행의 대량 편집**이지 교체가 아니므로, 그 호출부는 `{ ...change, projectSwitch: false }` 로 명시적으로 빠져나온다. 그래서 필드 타입이 `?: true` 가 아니라 `?: boolean` 이다. 계약 테스트: `test/projectResetTool.test.ts` 의 「keeps the pre-reset project available through undo」.

**아직 마커가 없는 곳 하나 — `clearAll()`(`store.ts:821`).** 이건 `createBlankProject()` 로 `this.current` 를 통째로 갈아치우는 진짜 전체 초기화인데 마커 없이 emit 한다. **오늘은 도달 불가**라서 결함이 아니다 — 참조가 정의 자신, 「새 프로젝트」 메뉴가 이걸 일부러 안 쓰게 됐다는 `menu.ts:728` 의 설명 주석, 그리고 `storeMutationInstrumentation.test.ts:120` 뿐이다. 다만 **누군가 `clearAll()` 을 UI 에 다시 연결하면 이 문서 맨 위의 Ctrl+Z 교차 오염이 조용히 되살아난다.** 그때 `projectSwitch: true` 를 함께 실어야 한다. `mapEditHistory` 가 `store.subscribe` 로 받아 스스로 리셋한다(`installProjectSwitchHistoryReset`, `tileActions.ts` 의 lazy-guard 패턴). **`store.replace()` 자신에 리셋을 걸지 마라** — undo 가 스냅샷을 적용하는 경로가 바로 `store.replace()` 다(`mapEditHistory.ts:122`, `:304`). 교체 호출부마다 리셋을 박는 방식도 기각했다(교체 경로가 4곳 이상이라 이 버그가 생긴 방식을 반복한다). 계약 테스트: `test/mapEditHistoryProjectSwitch.test.ts` |
| `getCurrent()` 가 라이브 참조를 반환한다 | `return this.readOnlyProjectSnapshot ?? this.current` (`store.ts:552`). `interface Project` 에 `readonly` 0개 | 호출자가 반환값을 직접 고치면 store 를 지나지 않은 변경이 되어 계측·generation·자동저장 전부를 우회한다. 지금은 규율로만 유지된다(`beginReadOnlyProjectSnapshot` 은 런타임 소비자용 임시 창) |
| `project_changes.patch_json` 이 write-only | 쓰기는 `supabaseProjectSync.ts:993` 1곳, 읽는 프로덕션 코드 0건(테스트 1건) | 원격에 상세 패치를 쌓고 있으나 아무도 읽지 않는다. 읽는 화면을 만들 것인지, 쓰기를 줄일 것인지 결정이 필요하다 |
| `scope: "assets"` 는 타입에만 있다 | `ProjectChangeDescriptor` 와 `EditActivityScope` 에는 있으나 emit 사이트 0건 | 리소스 매니저·타일셋 메타데이터 편집이 `project`/`system` 으로 뭉쳐 기록된다. 에셋 편집을 이 스코프로 라우팅하거나 타입에서 뺄 것 |
| `mapEditLocks` 로 편집이 거부된 사건이 기록되지 않는다 `canEditMap()` 거부 지점(`EditScene.ts`, `TilePaintEngine.ts`, `DragOperationHandler.ts`, `actions.ts`, `panels/basicLeftRail.ts`)은 `toast(mapEditLockNotice(...))` 나 조용한 `return` 만 한다 | "칠했는데 아무 일도 안 일어난다" 가 로그·감사 어디에도 안 남는다. 거부는 mutation 이 아니라 초크포인트를 지나지 않으므로 별도로 남겨야 한다 |

```bash
# 되돌리기 스냅샷 없이 store 를 바꾸는 파일 재측정 (2026-08-29 기준 21개)
for f in $(grep -rlE "store\.(update|updateMap|replace|replaceProject|clearAll)\(" src/); do
  grep -qE "recordProjectSnapshot|recordMapSnapshot" "$f" || echo "$f"
done
```

2026-08-29 시점 명단: `editor/eventActions.ts`, `editor/eventPages.ts`, `editor/tileActions.ts`,
`editor/mapParentLink.ts`, `editor/mapShiftActions.ts`, `editor/harnessSuggestion/structureKitActions.ts`,
`editor/panels/aiAssistantPanel.ts`, `editor/panels/databaseModalDirtySession.ts`,
`editor/panels/eventEditor/pageNpcLiving.ts`, `editor/panels/eventEditor/pageProps.ts`,
`editor/panels/mapProps.ts`, `editor/panels/menu.ts`, `editor/panels/resourceManager.ts`,
`editor/panels/structureKitEditorDialog.ts`, `editor/panels/structureKitInspector.ts`,
`editor/panels/tilesetAiQuestionEditor.ts`, `editor/panels/tilesetMetadataEditor.ts`,
`editor/panels/tilesetTileContextMenu.ts`, `editor/panels/villageInfoModal.ts`,
`player/runtimeDebugPanel.ts`, `project/characterIdIndex.ts`.

## 검증

- 계측·라벨·병합 회귀: `npm test -- test/editActivityRecording.test.ts` (초크포인트 5메서드, 라벨 없는 집계, NPC 편집 세션 재현, 연속 병합, `EventDiff` 라벨).
- 미러 엔드포인트 계약: `npm test -- test/editActivityEndpoint.test.ts` (상수와 미들웨어 경로가 어긋나면 404 로 조용히 죽는다).
- 위키 변경만 했으면 `npm run openwiki:verify`.
