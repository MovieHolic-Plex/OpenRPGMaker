# 03 — 이벤트 편집기 좌측 패널 "기억과 정리"(rail group slug=memory) 감사

워크트리: `/home/main/z-project/rpg-zzu-event-page-props`
조사 전용. `src/` 수정 없음. 새로 쓴 파일: 이 보고서 + `test/_probe-memory.test.ts`.

## 0. 한 줄 결론

"기억과 정리" 그룹에는 **기억(셀프 스위치)도 정리(Erase Event)도 들어 있지 않다.**
실제로 렌더되는 것은 claim 실패로 흘러들어온 **읽기 전용 요약 칩 3개(언제 / 겹침 / NPC)** 뿐이고,
그룹 이름이 약속하는 두 기능은 각각 "언제 보이나요" 그룹(조건)과 중앙 명령 열(명령)에 있다.
그룹 제목이 가리키는 `page.overlapForbidden` 조차 이 그룹의 편집 컨트롤이 아니라 "언제 보이나요" 밑에 있다.

---

## 1. 이 그룹에 실제로 렌더되는 노드 전체 목록

### 1.1 코드 증거 — 왜 그렇게 되는가

`renderEventPageProps` 가 `.event-page-props` 컨테이너(`source`)에 붙이는 **직속 자식 8개**의 순서
(`src/editor/panels/eventEditor/pageProps.ts:681-724`):

| # | 직속 자식 | 정의 | 
|---|---|---|
| 1 | `.presence` (스프라이트 + 트리거/우선순위/이동 요약) | pageProps.ts:637 |
| 2 | `.fact` — label "언제" | pageProps.ts:654 |
| 3 | `.fact` — label "겹침" (칩) | pageProps.ts:662 |
| 4 | `.fact` — label "NPC" | pageProps.ts:670 |
| 5 | `[data-testid=event-classic-conditions]` (조건 섹션) | pageProps.ts:686 |
| 6 | `[data-testid=event-classic-graphic]` (모습 fieldset) | pageProps.ts:694 |
| 7 | `[data-testid=event-page-trigger-priority-stack]` (시작 방식 / 우선순위 / **겹침 체크박스** / 안전 경고) | pageProps.ts:695-703 |
| 8 | `[data-testid=event-classic-movement-section]` (움직임) | pageProps.ts:704 |

`wrapPageSettingsAsAccordion` (pageProps.ts:769-820)의 그룹별 셀렉터:

```ts
// pageProps.ts:774-777
const look   = ... ".presence, [data-testid='event-classic-graphic']"
const when   = ... "[data-testid='event-classic-conditions'], [data-testid='event-page-trigger-priority-stack']"
const move   = ... "[data-testid='event-classic-movement-section']"
const memory = ... "[data-testid='event-classic-overlap']"     // ← 겹침 체크박스 fieldset
```

claim 루프 (pageProps.ts:788-802):

```ts
const claimed = new Set<HTMLElement>();
for (const group of groups) {                       // look-talk → when → move → memory 순서
  for (const node of group.nodes) {
    const closestHost = node.closest(".event-page-props > *");
    const host = node.parentElement === source ? node : closestHost ?? node;
    if (claimed.has(host) || host.parentElement !== source) continue;   // ← 여기서 memory 가 전부 탈락
    claimed.add(host);
    body.append(host);
  }
  rail.append(railGroup(group, body));
}
```

`event-classic-overlap` 은 `source` 의 직속 자식이 **아니다** — 부모는 #7 `event-page-behavior-sections` 이다
(pageProps.ts:695-703). 따라서 `host` 는 `closest(".event-page-props > *")` = #7 로 승격된다.
그런데 #7 은 이미 두 번째 그룹 `when` 이 claim 했으므로(`when` 셀렉터에 명시, pageProps.ts:775),
`claimed.has(host)` 가 true → `continue`. **memory 그룹은 claim 노드 0개로 빈 body 를 갖고 rail 에 붙는다.**

이어지는 잉여 자식 흘려보내기 (pageProps.ts:804-807):

```ts
Array.from(source.children).forEach((child) => {
  if (!(child instanceof HTMLElement) || child === rail) return;
  rail.lastElementChild?.querySelector(".event-editor-settings-accordion-body")?.append(child);
});
```

이 시점 `rail.lastElementChild` = 마지막에 append 된 그룹 = **memory**(pageProps.ts:782).
남아 있는 미claim 직속 자식은 #2·#3·#4 (fact 3개)뿐이므로 이 셋이 그대로 memory body 로 들어간다.

### 1.2 확정 목록 (DOM 프로브로 실측)

| memory body 자식 | 정체 | 편집 가능? | 근거 |
|---|---|---|---|
| `.fact` "언제" | `pageTabConditionText(page)` 텍스트 요약 | 아니오(순수 텍스트) | pageProps.ts:654-660 |
| `.fact` "겹침" | `page.overlapForbidden !== false ? "중복 실행 방지" : "겹침 허용"` 칩 | 아니오(순수 텍스트) | pageProps.ts:662-668 |
| `.fact` "NPC" | `event.characterId` 표시 이름 또는 "연결 안 됨" | 아니오(순수 텍스트) | pageProps.ts:670-679 |

프로브 실측(`test/_probe-memory.test.ts`): memory body 직속 자식 클래스 = `["fact","fact","fact"]`,
label 텍스트 = `["언제","겹침","NPC"]`, body 안 `input/select/textarea/button` 개수 = **0**.

### 1.3 오분류 판정

| 항목 | 판정 |
|---|---|
| memory 그룹이 "기억(셀프 스위치)"을 담는가 | **아니오.** 셀프 스위치 저작 표면(조건 폼 `selfSwitchControl`, conditionForm.ts:710)은 조건 섹션 안 → `when` 그룹. 프로브에서 memory body 텍스트에 "셀프" 없음 확인. |
| memory 그룹이 "정리(Erase Event)"를 담는가 | **아니오.** `eraseEvent` 는 페이지 설정이 아니라 명령(`src/project/types/events.ts` 명령 유니온, 편집은 중앙 명령 열). 좌측 레일 어디에도 소거 관련 컨트롤 없음. |
| 겹침 체크박스는 어디에 있는가 | **`when` 그룹.** 프로브: `[data-testid=event-classic-overlap].closest("[data-testid='evt-rail-group-when']")` truthy, `...-memory` null. |
| memory 그룹의 세 fact 의 원래 주인 | "언제" fact → `when`(조건 요약 중복. `when` summary 가 이미 `조건 N개` 를 보여준다, pageProps.ts:780). "겹침" fact → `when`(체크박스와 같은 곳). "NPC" fact → `npc`("NPC와 일정" 그룹, content.ts:271-275). 즉 **세 fact 모두 memory 소속이 아니다** — memory 는 우연히 마지막이라 잉여물을 받는 쓰레받이(catch-all)다. |
| 오분류 성격 | **구조적 결함 2건.** (a) memory 셀렉터가 `when` 이 이미 삼켜버린 서브트리를 겨누므로 영구히 0개 claim. (b) `rail.lastElementChild` 기반 fallback 이 "마지막 그룹" = memory 를 암묵적 쓰레받이로 만든다. 그룹을 재정렬하면 어느 그룹이든 쓰레받이가 된다 — 위치 의존 버그. |

부수 확인: memory 는 `wrapPageSettingsAsAccordion` 시점엔 마지막이지만 **최종 DOM 에서는 마지막이 아니다** —
`content.ts:271` 이 `appendEventRailGroup` (pageProps.ts:757-767)으로 `npc` 그룹을 뒤에 붙인다.
프로브 실측 rail 순서: `["look-talk","when","move","memory","npc"]`.
`characterId` 가 없어도 일정 편집기(`renderEventScheduleEditor`)가 non-null 이라 npc 그룹은 항상 생긴다.

부수 결함(요약 불일치): 그룹 헤더 요약은 `page.overlapForbidden ? ... : "중복 허용"` (pageProps.ts:782, 순수 truthiness)인데,
칩(pageProps.ts:666)과 체크박스(pageProps.ts:629)는 `?? true` / `!== false` 로 **undefined 를 켜짐으로** 본다.
`overlapForbidden` 미지정 페이지에서 헤더는 "중복 허용", 안의 칩은 "중복 실행 방지", 체크박스는 체크됨 — 프로브 3번째 케이스로 실측 확인.

---

## 2. `page.overlapForbidden` 런타임 소비 — **ORPHAN 아님. 단, 라벨이 기능을 오설명한다.**

| 단계 | 위치 | 실제 효과 |
|---|---|---|
| 저작 write | `src/editor/panels/eventEditor/pageProps.ts:631` | `updateEventPage(..., { overlapForbidden: overlap.checked })` |
| 스키마 | `src/project/types/events.ts:474` | `overlapForbidden?: boolean` (EventPage) |
| 런타임 뷰 파생 | `src/project/runtimeEventState.ts:94` | `overlapForbidden: page?.overlapForbidden ?? true` — 미지정 기본 **true** |
| 소비 1 — 플레이어 이동 차단 | `src/project/runtimeEventState.ts:223` (`findBlockingRuntimeEventAt`), `:235` (`findBlockingRuntimeEventAtInMap`) | `priority === "same" && overlapForbidden` 인 이벤트가 그 타일에 있으면 통행 불가 |
| 소비 1 호출자 | `src/player/playSceneMovement.ts:397` | 플레이어 한 칸 이동 판정에 사용 |
| 소비 2 — NPC 이동 차단 | `src/player/playSceneAutonomousMapActions.ts:63-78` (`isCharacterBlockedTile`) | 자율 이동 NPC 가 다른 이벤트 타일로 들어가지 못함 |
| 소비 3 — 도달성 검사 | `src/project/defaults/iceGrandExpanseGameplay/sealReachability.ts:20` | 콘텐츠 생성 시 경로 유효성 검사 |
| 소비 4 — 테스트 하네스 | `src/testing/sceneTestRunner.ts:366`, `:431` | 씬 테스트의 이동 판정 |
| 저작 검증 | `src/editor/eventDraftValidator.ts:227` | 투명 + `priority==="same"` + overlapForbidden → "보이지 않는 벽" 경고 |

**판정: 정상 소비. ORPHAN 아님.**
그러나 UI 문구가 틀렸다. 이 플래그는 RM2K3 의 "겹침 금지"(타일 점유 = 통행 차단)이고,
런타임 소비처 4곳 전부 **좌표 점유/통행 판정**이다. **"중복 실행 방지"(= 이벤트 재실행 억제)와는 무관하다** —
`overlapForbidden` 을 읽는 실행 억제 코드는 `src/` 어디에도 없다(`rg overlapForbidden src/` 전수: 인터프리터/트리거 경로 0건).
실제 중복 실행 억제는 별 경로다: `scene.running` 가드(`playSceneInterpreter.ts:49`), `autoStartedKeys`(`playSceneMapRuntime.ts:452-454`).
따라서 라벨 "중복 실행 방지"(pageProps.ts:666, 706, 782)와 그룹 요약은 **오설명**이며, 저작자는 이 체크박스를 껐을 때
이벤트가 두 번 실행될 것으로 기대하게 된다(실제로는 NPC 를 통과할 수 있게 되는 것).

---

## 3. 셀프 스위치(A/B/C/D)의 "기억" 경로 — **끊긴 곳 없음(연결 확인)**

| 단계 | 위치 | 내용 |
|---|---|---|
| 저작 — 페이지 조건 | `src/editor/panels/eventEditor/conditionForm.ts:14` (`{ value: "selfSwitch", label: "이 이벤트 기억" }`), `:245-251`, `:710` (`selfSwitchControl`) | 키 A~D + ON/OFF 선택 |
| 저작 — 고급 조건 | `src/editor/panels/eventEditor/pageAdvancedConditions.ts:34` | 동일 종류 노출 |
| 저작 — 명령 | `src/editor/eventCommandFactory.ts:176-177` → `{ kind: "setSelfSwitch", key: "A", value: true }` | 명령 생성 |
| 스키마 | `src/project/types/events.ts:39` (조건), `:400` (명령) | `SelfSwitchKey` |
| 런타임 write | `src/player/interpreter/commandCatalog.ts:766-773` | `state.session.selfSwitches[eventId][key] = value`. **`currentEventId` 없으면 무시**(:767) |
| 세션 스키마 | `src/project/session.ts:179` | `selfSwitches: Record<eventId, Partial<Record<key, boolean>>>` |
| 새 세션 초기화 | `src/project/session.ts:334` | `selfSwitches: {}` |
| 페이지 재선택(read) | `src/project/io/pageResolution.ts:39-42` | `resolveEventPage` 가 뒤에서 앞으로 스캔하며 `selfSwitches[event.id][key]` 비교 |
| 뷰 파생 | `src/project/runtimeEventState.ts:80` | `runtimeEventView` → `resolveEventPage(event, session)` |
| 화면 반영 | `src/player/playSceneMapRuntime.ts:326` (`renderEvents` → `runtimeEventViewsForMap`), `:442-447` (`refreshRuntimeSurfaces` → `renderTiles`) | 페이지 교체 시 스프라이트/마커 재생성 |
| 명령 종료 후 갱신 트리거 | `src/player/playSceneInterpreter.ts:187`, `:198` (`runCommands` 의 start 직후 + finally) | `setSelfSwitch` 실행 후 즉시 `refreshRuntimeSurfaces()` → 페이지 재선택이 화면에 반영 |
| 분기 조건(fork) read | `src/project/session.ts:733-738` (`evalCondition`) | `host` 로 eventId 미전달 시 **항상 false**(주석 명시) |
| 세이브 write | `src/player/saveSlots.ts:285` | `selfSwitches: structuredClone(session.selfSwitches)` |
| 로드 restore | `src/player/saveSlots.ts:450` | `session.selfSwitches = structuredClone(snapshot.session.selfSwitches ?? {})` |
| 로드 sanitize | `src/player/saveSlots.ts:787` | `isSelfSwitchesRecord` 검사 통과 시만 채택 |
| 로드 후 맵 재구성 | `src/player/PlayScene.ts:464` (`applySession` → `loadMap(..., preserveErasedEvents: true, ...)`) | 복원 세션으로 페이지 재선택 재수행 |
| 전투 경로 write-back | `src/battle/battleEvents.ts:576-587` → `src/player/battleRewardsToSession.ts:141-146` | 배틀 이벤트의 `setSelfSwitch` 를 세션에 머지 |

**판정: 저작 → session → 세이브/로드 → 페이지 재선택 체인이 전부 이어져 있다.**
검증: `test/selfSwitch.test.ts` 10/10 통과(§6), `test/battleEventsSelfSwitch.test.ts` 가 전투→세션→맵 페이지 전환까지 커버.

주의(결함 아님, 스키마 유휴): `ProjectStartState`(= `ProjectSession`, `src/project/types/project.ts:223, 278`)에 `selfSwitches?` 가 선언돼 있으나
`startSession` 은 `switches`/`variables` 와 달리 시작값을 시드하지 않고 `{}` 로 덮는다(`src/project/session.ts:334`).
편집기에 이 값을 쓰는 저작 표면은 없다(`rg selfSwitches src/editor/` 결과: 미리보기 시뮬레이터 `previewSimulation.ts` 와 AI 툴 `storyTools.ts:311` 뿐).
→ 현재 사용자 영향 없음. 저작 표면이 생기면 조용히 버려질 함정.

---

## 4. 이벤트 소거(Erase Event)와 초기화 경로

| 단계 | 위치 | 내용 |
|---|---|---|
| 명령 실행 | `src/player/playSceneInterpreter.ts:379-381` (`case "eraseEvent"`) → `:559-563` (`eraseRuntimeEvent`) | `session.erasedEventIds` 에 id 추가 + 스프라이트/무버 제거(`:571-578`) |
| 스케줄러 경로 | `src/player/playSceneSchedulers.ts:335-338` | 동일한 `erasedEventIds` 추가 + 표면 제거 |
| 테스트 하네스 | `src/testing/sceneTestRunner.ts:762` | 동일 로직 |
| 세션 스키마/초기값 | `src/project/session.ts:229`, `:372` | `erasedEventIds: string[]`, 새 세션 `[]` |
| 소비 — 뷰 제외 | `src/project/runtimeEventState.ts:112` (`runtimeEventViewsForMap`), `:195`, `:221` | 소거된 이벤트는 렌더/트리거/차단 판정에서 전부 빠짐 |
| **맵 재진입 초기화** | `src/player/playSceneMapRuntime.ts:123` — `if (!options.preserveErasedEvents) scene.session.erasedEventIds = [];` | 기본 `loadMap` 이 목록을 **통째로 비운다** |
| 그 경로의 호출자 | `src/player/playSceneMapCommands.ts:58` (`transferPlayer` → `scene.loadMap(request.mapId)`, 옵션 없음) | 맵 이동/재진입 시 **모든 맵의** 소거 상태가 복원 = RM2K3 "Erase Event 는 일시적" 규칙과 일치 |
| 보존하는 경로 | `src/player/PlayScene.ts:199` (부팅), `:464` (`applySession` = 세이브 로드/체크포인트) — `preserveErasedEvents: true` | 로드 직후 소거 상태 유지 |
| 세이브/로드 | `src/player/saveSlots.ts:330` write, `:521` restore, `:834` sanitize | 소거 상태가 세이브에 담김 |
| **방 리셋(roguelike)** | `src/project/roguelikeRooms.ts:28-51` (`syncRoguelikeRoomEventGeneration`) | 세대 키(`runId:seed:floor:roomId:resetCount`, `:16-22`)가 바뀌면 그 맵 이벤트들의 `selfSwitches` **삭제**(`:38-40`) + `erasedEventIds` 에서 **제거**(`:41-43`). `map.roguelikeRoom.resetEventState === false` 면 skip(`:32`) |
| 방 리셋 호출자 | `src/player/playSceneFieldSpawns.ts:34`, `:62` → `resetRoguelikeRoomEventRuntime`(`:78-88`), `src/testing/sceneTestRunner.ts:1591` | 런타임 무버/auto 키/패턴 오버라이드까지 초기화 |
| `resetEventState` 저작 표면 | `src/editor/tools/mapTools.ts:1115-1120`, `:1405` (AI 툴 스키마) / GUI 패널 없음 (`rg roguelikeRoom src/editor/panels/` → 0건) | **GUI 미노출 = UNKNOWN 아님, 확인된 부재** |

**판정: 소거 write/read/세이브/맵 재진입 초기화/방 리셋 모두 연결되어 동작한다.**
좌측 패널 "기억과 정리" 그룹과의 접점은 **0** — 소거는 명령이고, 방 리셋 스위치(`resetEventState`)는 맵 속성이며 GUI 저작 표면이 없다.
즉 그룹 제목의 "정리"에 대응하는 좌측 패널 컨트롤은 존재하지 않는다.

---

## 5. 제안 최소 수정

결함마다 수정 파일 + 3줄 이내. (실제 수정은 하지 않음.)

**D1. memory 그룹이 영구히 빈 상태 + 쓰레받이 (최우선)**
- 파일: `src/editor/panels/eventEditor/pageProps.ts`
- 수정: `event-classic-overlap` 을 `event-page-behavior-sections` 밖으로 꺼내 `source` 직속 자식으로 만들고(pageProps.ts:695-703 → append 목록으로 승격), `memory` 셀렉터는 그 직속 노드를 겨누게 둔다.

**D2. `rail.lastElementChild` 암묵 쓰레받이 (위치 의존 버그)**
- 파일: `src/editor/panels/eventEditor/pageProps.ts:804-807`
- 수정: fallback 대상을 `rail.lastElementChild` 대신 명시 슬러그(예: `rail.querySelector("[data-rail-group='when']")`)로 고정하거나, 미claim 자식이 남으면 개발 빌드에서 `console.warn` 하여 조용한 오분류를 막는다.

**D3. fact 3개의 소속 오류 (언제/겹침 = when, NPC = npc)**
- 파일: `src/editor/panels/eventEditor/pageProps.ts:654-679`, `src/editor/panels/eventEditor/content.ts:271`
- 수정: `factWhen`/`factOverlap` 을 `when` 그룹 nodes 에 명시 claim, `factNpc` 는 `appendEventRailGroup("npc", ...)` 인자로 넘긴다. `when` summary 와 중복되는 `factWhen` 은 삭제 후보.

**D4. 그룹 요약과 칩/체크박스의 기본값 불일치**
- 파일: `src/editor/panels/eventEditor/pageProps.ts:782`
- 수정: `page.overlapForbidden ?` → `page.overlapForbidden !== false ?` 로 통일(칩 :666, 체크박스 :629 와 동일 규약).

**D5. "중복 실행 방지" 라벨이 기능을 오설명 (통행 차단이 실제 효과)**
- 파일: `src/editor/panels/eventEditor/pageProps.ts:666, 706, 782`
- 수정: 문구를 "겹침 금지(같은 칸 통행 차단)" 계열로 교체하고 title 에 "다른 캐릭터가 이 이벤트 칸을 지나갈 수 없습니다"를 넣는다. 스키마 키(`overlapForbidden`)는 그대로.

**D6. 그룹 제목 "기억과 정리"가 내용과 무관**
- 파일: `src/editor/panels/eventEditor/pageProps.ts:782`
- 수정: 두 갈래 중 택1 — (a) 제목을 실제 내용에 맞춰 "겹침과 통행"으로 바꾼다, 또는 (b) 제목을 유지하고 셀프 스위치 조건 요약 + `eraseEvent` 명령 존재 여부 배지를 이 그룹에 실어 이름을 실현한다. D1~D3 이후에 결정할 UX 판단.

**D7. `ProjectStartState.selfSwitches` 유휴 스키마 (저수위)**
- 파일: `src/project/session.ts:334`
- 수정: `selfSwitches: { ...(start.selfSwitches ?? {}) }` 로 시드하거나, 반대로 `ProjectSession` 에서 필드를 제거해 스키마와 런타임을 일치시킨다.

**D8. 방 리셋(`resetEventState`) GUI 저작 표면 부재 (범위 밖, 기록용)**
- 파일: 맵 속성 패널(현재 미확인 — `src/editor/panels/` 에 roguelikeRoom 표면 0건)
- 수정: 이 노드 범위 밖. 별도 노드에서 맵 속성 패널에 체크박스 노출 여부를 판단할 것.

---

## 6. VERIFY 출력

### 6.1 요구된 회귀 스펙

```
$ cd /home/main/z-project/rpg-zzu-event-page-props && node scripts/run-vitest.mjs run test/selfSwitch.test.ts --configLoader bundle

 RUN  v3.2.4 /home/main/z-project/rpg-zzu-event-page-props

 ✓ test/selfSwitch.test.ts (10 tests) 11ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  02:14:00
   Duration  10.88s (transform 6.48s, setup 0ms, collect 9.16s, tests 11ms, environment 1ms, prepare 286ms)
```

### 6.2 그룹 구성 프로브 (이 조사에서 새로 작성)

```
$ node scripts/run-vitest.mjs run test/_probe-memory.test.ts --configLoader bundle

 RUN  v3.2.4 /home/main/z-project/rpg-zzu-event-page-props

 ✓ test/_probe-memory.test.ts (4 tests) 1806ms
   ✓ memory 그룹 body 는 읽기 전용 fact 3개(언제/겹침/NPC)만 담는다  615ms
   ✓ 겹침 체크박스는 memory 가 아니라 when 그룹에 들어간다  466ms
   ✓ overlapForbidden 미지정 시 memory 요약과 체크박스가 어긋난다(요약 '중복 허용' vs 체크됨)  418ms
   ✓ memory 그룹은 레일의 마지막이 아니다 — npc 그룹이 뒤에 붙는다

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

프로브는 현재 동작을 고정하는 조사용 스냅샷이다. D1~D4 를 고치면 이 파일의 기대값도 함께 갱신/삭제해야 한다.

---

## 7. UNKNOWN

- 실제 브라우저에서 memory 그룹이 시각적으로 어떻게 보이는지(빈 것처럼 느껴지는지, fact 3개가 위 그룹과 중복돼 보이는지)는 감독자 재현 담당. CSS 는 `src/styles/editor/event-editor.balanced.css:965-1041`(레일)과 `:438-459`(`.fact`, `.chip`)에 존재하며 숨김 규칙은 없다 — 즉 렌더는 된다.
- `event-editor.balanced.css` 와 `event-editor.part-4.css` 중 어느 쪽이 최종 적용되는지(임포트 순서/우선순위)는 확인하지 않았다.
- `pageMovement.ts` / `pageConditions.ts` / `npcSchedules.ts` 내부 세부는 다른 노드 담당이라 읽기만 했고 판정하지 않았다.
