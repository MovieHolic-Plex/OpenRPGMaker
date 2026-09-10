# LOC-ADOPT — 설계 영역 이관을 진짜 사용자 행위로

Branch `agent/locadopt`, worktree `/home/main/z-project/rpg-zzu-locadopt`, dev port 9862.
Base: `7a00beec5` (main 스냅샷, OPRN-OUT-020 의 `map.locations` 레이어가 이미 들어 있음).

## 무엇을 했는가, 한 문단

OPRN-OUT-020 은 `adoptLayoutRegionsAsLocations` 라는 멱등 원시 동작만 남기고 **기존 빌더 맵의
일괄 이관을 제품 책임자에게 미뤄 뒀다.** 미룬 이유는 능력이 아니라 위험이었다 — 자동 승격은
저작자가 쓴 적 없는 이름 수십 개를 게임에 실어 버린다. 책임자가 이관 경로 구축을 승인했으므로,
**자동화가 아니라 도구**를 만들었다: 읽기 전용 조사 → 역할 필터 → 맵별 선택 → 실행 → 영수증.
자동 승격은 여전히 **없다**. 옛 빌더 맵을 열기만 해서는 예전과 똑같이 아무 일도 일어나지 않는다.

## 커밋

| 해시 | 내용 |
|---|---|
| `76a0d9ce8` | `src/project/mapLocationAdoption.ts` 순수 규칙 + `test/mapLocationAdoption.test.ts` |
| `4c67351b1` | 편집기 상태·창·레이어 진입점·CSS + `test/mapLocationAdoptionPanel.test.ts` |
| `d0b94e56e` | 무변경 실행이 되돌리기 칸을 먹던 결함 수정(브라우저 QA 실측) + 회귀 1건 |
| `42a22d1a0` | 브라우저 QA 스크립트 + `verify-shots/loc-adopt/` 증거 6장 |
| `17af65dac` | 조수 툴 `survey_layout_adoption` 추가 + `adopt_layout_regions` 를 같은 규칙으로 |
| `0febcdc52` | openwiki 3쪽 + INDEX 재생성 + 이 NOTES + `.gitignore` 부정 규칙 |

(마지막 줄의 해시는 이 파일을 담은 커밋의 **직전** 상태에서 적은 것이라, 이 문장을 고친
최종 커밋 해시는 최종 보고를 참조하라.)

## 요구사항 → 증거

### 1. 어느 맵이 아직 이관되지 않았고 몇 개가 들어오는지 볼 수 있어야 한다. 열기는 읽기 전용 — **충족**

- 순수 조사: `surveyProjectAdoption(project, {roles})` / `surveyMapAdoption(map, {roles})`.
  `layoutPlan.regions` 가 있는 맵만 돌려주고, 맵마다 `adoptableCount` · `adoptedCount` ·
  `rebindableCount` · `roleCounts[]` · `collisions[]` · `orphanedLocations[]` 를 준다.
- 화면 진입점 둘: 로케이션 레이어 인스펙터의 한 줄 요약(`map-location-adopt-survey`) 과
  거기서 여는 창(`location-adoption-panel`). 조수는 `survey_layout_adoption`(read).
- **읽기 전용 증명 (기계):** `test/mapLocationAdoption.test.ts`
  - "surveying does not mutate the project — no locations field appears"
    → 조사를 세 가지 필터로 돌린 뒤 `JSON.stringify(project)` 가 문자 하나 다르지 않고
      `maps[VILLAGE].locations` 는 여전히 `undefined`.
  - "lists only maps that have builder regions, with per-map adoptable counts"
    → 설계 기록 없는 `plain_map` 은 목록에 아예 없다.
  - `test/mapLocationAdoptionPanel.test.ts` "opening shows a read-only survey and writes nothing"
    → 창을 연 전후 프로젝트 직렬화 동일.
  - `test/mapLocationTools.test.ts` "survey_layout_adoption counts candidates without changing anything".
- **읽기 전용 증명 (브라우저):** `verify-shots/loc-adopt/02-survey-readonly.png` — 창이 열린 상태에서
  "설계 기록이 있는 맵 2개 · 지금 필터로 승격 후보 3개. 고른 맵이 없어 실행해도 아무것도 바뀌지
  않습니다." 그리고 스크립트가 같은 시점에 실행한 어서션:
  `Object.values(maps).some(m => m.locations?.length > 0) === false`.
  `01-layer-inline-survey.png` 은 창을 열기 전 인스펙터 한 줄("승격 후보 2개").

### 2. 명시적·맵별 선택, 멱등, `layoutPlan` 바이트 동일 — **충족**

- `adoptLayoutRegionsForMaps(project, {mapIds, ...})` 는 `mapIds` 가 비면 **아무 일도 하지 않는다.**
  프로젝트 전체 자동 적용 진입점은 코드에 존재하지 않는다. 「후보 있는 맵 모두 고르기」는
  사용자가 누르는 버튼이지 기본값이 아니다(기본 선택은 빈 집합).
- 기계 증거 (`test/mapLocationAdoption.test.ts`):
  - "touches only the selected maps" → `HAMLET` 만 골랐을 때 `VILLAGE.locations === undefined`.
  - "an empty map selection is a no-op — there is no project-wide sweep" → 직렬화 동일.
  - "running twice adds nothing and reports the skips" → 2회차 `adopted 0`, `rebound 0`,
    `skippedAlreadyAdopted 3`, 프로젝트 직렬화 1회차와 동일.
  - "leaves layoutPlan byte-identical across both runs" → 네 역할 전부를 켜고 2회 실행해도
    `JSON.stringify(layoutPlan)` 불변.
  - "refuses to run with no map selected"(창 경로) → store 무변경 + 히스토리 무변경.
- 브라우저 증거: `04-adopted-one-map.png` (고른 `map_blank_start` 에만 2개 생성, `qa_hamlet` 은
  `locations == null` 로 어서트), `05-idempotent-second-run.png`
  ("이미 전부 승격돼 있습니다(2개 건너뜀). 두 번 돌려도 늘지 않습니다." + 개수 여전히 2).
  두 시점 모두 스크립트가 `layoutPlan.regions.length === 5` 를 어서트한다.

### 3. 역할 필터 + 방어 가능한 기본값 + 문서화 — **충족**

`DEFAULT_ADOPTION_ROLES = ["plaza", "market"]`. **근거는 취향이 아니라 코드다:**

- `houseProtection.ts:53` 과 `villageEvaluate.ts:704` 가 `role === "house"` 를 **시공 사실**
  (집 롯의 보호·검증 단위)로 읽는다. 마을 하나에 집 롯이 20~40개 나오므로 기본으로 켜면
  「파랑 지붕 석벽 집 (ㄱ자)」 같은 이름 수십 개가 한 번에 사용자-가시 장소가 된다.
- `river` / `lake` / `forest` 도 지형 기록이지 사람이 가리키는 장소가 아니다.
- 반대로 `villageEvaluate.ts:649` 는 `plaza | market` 을 **"planned commons"**, 즉 마을의 공용
  생활 공간으로 묶어 센다. 사람이 "광장에서 만나자", "장터로 가" 라고 말하는 층이 정확히 그것이다.
- **숨기지 않았다.** 관측된 역할 전량이 필터에 뜨고, 기본에서 빠진 역할은
  `adoptionRoleCaution(role)` 이 왜 껐는지 한 문장으로 화면에 적는다.

증거:
- `test/mapLocationAdoption.test.ts` "defaults to commons roles only and never silently adopts
  construction lots"(집·강이 안 들어옴), "adopts construction roles only when they are explicitly
  selected", "gives a machine-readable reason for every non-default role and none for defaults"
  (`adoptionRoleCaution("house")` 가 `houseProtection` 을 포함), "an empty role selection adopts nothing".
- `test/mapLocationAdoptionPanel.test.ts` "shows the role filter with defaults on and construction
  roles off with a stated reason", "turning a role on immediately re-counts the survey".
- `test/mapLocationTools.test.ts` "adopt_layout_regions defaults to commons roles, not to every
  builder region" — 조수 툴도 `roles` 생략 시 전부가 아니다.
- 브라우저: `03-role-filter-widened.png` — 집 롯을 켜면 후보가 3 → 5 로 즉시 다시 세어지고,
  스크립트가 끄면 3으로 돌아오는 것까지 어서트한다. `02-survey-readonly.png` 에 기본 상태
  (집 롯·강 꺼짐 + "집 롯은 시공·보호 단위입니다(houseProtection). 수십 개가 한꺼번에 장소 이름이
  됩니다.")가 보인다.
- 문서: `openwiki/runtime-project-schema.md` 「명명 로케이션 레이어」, `openwiki/editor-pre-edit-routing.md`
  「설계 영역 이관 도구」, `openwiki/editor-ai-tools.md`.

### 4. 되돌림은 한 저작 행위, 재시공 후 재실행이 복제하지 않음 — **충족**

**되돌림 한 덩어리:** 여러 맵을 골라도 `recordProjectSnapshot("설계 영역 이관")` 1건 +
`store.update` 1회다.
- "undoes a multi-map adoption with a single undo" → 두 맵에 3개를 만든 뒤 `undoMapEdit()` **한 번**
  으로 양쪽 `locations` 가 모두 `undefined` 로 돌아가고 `canUndo === false`.
- "undo restores the pre-adoption layoutPlan byte-for-byte".
- `test/mapLocationAdoptionPanel.test.ts` "one undo removes the whole adoption made through the panel".
- 브라우저: `06-single-undo.png` — 한 번의 `undoMapEdit()` 뒤 조사가 "승격 후보 2개 · 이미 승격 0개"
  로 되돌아가고 레이어가 "아직 구역이 없습니다", `layoutPlan.regions.length === 5` 유지.

**브라우저 QA 가 잡은 진짜 결함 (유닛 테스트가 놓친 것):** 처음 구현은 무변경 실행에서도
`recordProjectSnapshot` 을 불렀다. 멱등성을 확인하려고 두 번째로 누른 사용자가 Ctrl+Z 를 치면
**빈 스냅샷**이 돌아와 승격이 그대로 남았다 — 사용자에겐 undo 가 고장 난 것이다. 이제 `runAdoption`
은 복제본으로 먼저 예행하고 no-op 이면 스냅샷을 아예 밀지 않는다. 회귀:
"a no-op second run does not consume an undo slot". (커밋 `d0b94e56e`.)

**재시공 후 복제 금지:** 멱등 판정이 두 겹이다. 빌더는 `regions` 를 통째로 갈아치우고
`uniqueHouseRegionId` 는 그때 살아 있는 배열만 보고 번호를 매기므로 **같은 자리의 같은 장소가
새 region ID 를 받을 수 있다.** ID 만 보면 두 번 승격된다. 그래서 같은 사각형이면 로케이션을
다시 만들지 않고 `origin.regionId` 만 새 ID 로 다시 묶는다(rebind).
- "re-running after a rebuild rebinds instead of duplicating the same place" → 재시공 후 재실행이
  `adopted 0` / `rebound 2`, 로케이션 개수와 **로케이션 ID 배열이 그대로**(참조 생존), `origin` 만
  `plaza_7` 로 갱신.
- "a third run after the rebuild is a plain no-op" → 맵 직렬화 동일.
- "a rebuild that truly drops a region reports the leftover as orphaned instead of deleting it"
  → 조사는 고아를 **보고만** 하고 지우지 않는다(사람이 이름을 고쳤을 수 있고 참조가 걸려 있을 수 있다).

### 5. 이름 충돌은 눈에 보이게, 승격본은 안정 ID — **충족**

**충돌:** 원시 동작은 「상점 2」로 말없이 피하지만, 일괄 이관에서는 수십 개가 한 번에 들어와
무엇이 밀렸는지 알 수 없다. 그래서 (a) 조사가 실행 **전에** 충돌을 세어 보여 주고
(`location-adoption-collision-<mapId>`), (b) 실행이 정책을 강제로 고르게 하며, (c) 어느 쪽이든
영수증에 남는다.
- "flags name collisions before anything is written" → `collisions == [{regionId:"plaza_1", name:"중앙 광장"}]`.
- "suffix policy reports the original name it had to move away from" → `renamedFrom === "중앙 광장"`.
- "skip policy leaves the colliding region unadopted and names it in the receipt".
- "never renames or re-ids an existing human location" → 기존 로케이션의 `name`·`id`·`origin` 불변.
- "two regions with the same label inside one run get distinct names" → 한 실행 안의 충돌도 본다.
- 창 경로: "surfaces a name collision in the survey before the run",
  "the collision policy chosen in the workbench reaches the run".

**안정 ID:** 승격본은 `loc<N>` 안정 ID + `origin {kind:"layoutRegion", regionId, planKind}` 스냅샷을
가진다. "adopted locations carry stable ids and a layoutRegion origin snapshot" 는 승격 → 사람이
이름 변경 → 재실행까지 하고 ID 와 바뀐 이름이 모두 살아 있음을 확인한다. 재시공 rebind 도
로케이션 ID 를 건드리지 않으므로 `insideLocation` 조건과 인카운터 `locationId` 참조가 전부 생존한다.

### 저장/불러오기 왕복 — **충족**

`test/mapLocationAdoption.test.ts` "project save / load round-trip" 3건:
승격본이 ID·`origin`·`layoutPlan` 그대로 왕복 / 재로드 후 재실행도 멱등 / 승격한 적 없는
레거시 빌더 맵은 load-save 로 한 바이트도 변하지 않음.

## 이 워크트리에서 실제로 돌린 검증

```
npx tsc --noEmit -p tsconfig.app.json                → exit 0, 에러 0 (편집마다 반복)
npx tsc --noEmit -p tsconfig.json | grep mapLocation → (빈 출력) 내가 만진 테스트 파일은 깨끗
npx vitest run test/mapLocationAdoption.test.ts       --maxWorkers=2 → 33 passed
npx vitest run test/mapLocationAdoptionPanel.test.ts  --maxWorkers=2 →  9 passed
npx vitest run test/mapLocationTools.test.ts          --maxWorkers=2 → 14 passed
npx vitest run test/mapNamedLocations.test.ts         --maxWorkers=2 → 31 passed
npx vitest run test/mapLocationLayer.test.ts          --maxWorkers=2 →  7 passed
npx vitest run test/mapLayoutPlan.test.ts             --maxWorkers=2 →  3 passed
node scripts/check-css-budget.mjs        → undefinedVars 위반 0(내 것), hexLiterals 는 기준선과 동일
node scripts/check-css-graph.mjs         → 0 new (exit 0)
node scripts/check-css-live-classes.mjs  → 게이트 통과 (exit 0)
npm run openwiki:verify                  → "failures": []
npm run openwiki:index                   → 재생성
브라우저: DEV_SERVER_PORT=9862 npm run dev:worktree +
          ADOPTION_QA_URL=http://127.0.0.1:9862 node scripts/qa/map-location-adoption.mjs
          → 6 shots + SUMMARY.md, page error 0, 어서션 전부 통과
```

## 기준선에서 이미 빨간 것 (내 변경이 만든 것이 아님 — 스태시로 확인)

| 항목 | 확인 방법 | 결과 |
|---|---|---|
| `test/modalEscapeLayerGate.test.ts` | `git stash -u` 후 재실행 | 기준선에서도 같은 3건(`delayedTooltip.ts`, `panels/aiStickyChecklist.ts`, `panels/resourceManagerViews.ts`). **내 창은 목록에 없다** — `registerModal` 을 쓴다 |
| `test/aiEditorCapabilityParity.test.ts` | `git stash -u` 후 재실행 | 기준선에서도 1 failed (`upsert_enemy` 몬스터 리소스 매칭). 이 작업과 무관 |
| `check-css-budget.mjs` 의 `hexLiterals` | `git stash -u` 후 재실행 | 기준선과 **완전히 동일한 파일 목록**(내 CSS 파일 없음) |

전체 `npm run typecheck` · 전체 스위트 · `npm run gates` 가 기준선부터 빨간불이라는 과제 전제는
재검증하지 않았다. 테스트를 지우거나 skip 하지 않았다.

## Supabase 하드 룰

해당 없음 — 순수 편집기/엔진 코드다. 새 맵·이벤트·데모를 **저작하지 않았다.** 브라우저 QA 가
쓰는 `layoutPlan` 두 개는 `?blankProject=1`(원격 저장이 의도적으로 꺼진) 세션 안에서만 사는
QA 픽스처이고, 저장소에 프로젝트 파일로 남지 않는다. 스키마는 바꾸지 않았다(새 필드 없음 —
기존 `MapNamedLocation.origin` 만 쓴다). 그래도 load/migrate/save 왕복은 위 3건으로 증명했다.

## 미룬 것 (범위 밖, 명시)

- **콘텐츠 이관 실행 자체.** 과제가 "TOOL 이지 content migration run 이 아니다" 라고 못박았고,
  실제 저작물 이관은 Supabase 프로젝트 행을 건드리므로 책임자가 어느 맵·어느 역할로 돌릴지
  정해야 한다. 도구는 준비됐다.
- **고아 승격본 정리 UI.** 조사가 보고는 하지만 지우거나 다시 묶는 버튼은 없다. 사람이 이름을
  고쳤을 수 있고 참조가 걸려 있을 수 있어 「삭제」는 별도 결정이다 — 기존 로케이션 레이어의
  삭제·복구 경로(참조 진단 + `repairMapLocationReferences`)가 이미 그 일을 한다.
- **역할별 색·태그 프리셋.** 승격본은 `role:<role>` 태그를 달지만 색은 기존 ID 해시 규칙을 쓴다.
