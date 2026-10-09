# 로케이션 레이어 어포던스 감사 (2026-09-11)

**상태: A/B/D 구현됨(2026-09-11), C 미적용.** 도구 모드·클릭 1칸 금지·조건 칩도 같은 날 들어갔다.
이 문서는 «무엇이 왜 안 읽히는가» 의 실측 기록이고, 구현분의 계약은 「A 구현」 절과
`openwiki/editor-pre-edit-routing.md` 의 「명명 로케이션 레이어」 절이 소유한다.

계기: "이 로케이션으로 사용자가 뭔가를 할 수 있다는 게 직관적으로 받아들여져야 하는데 그게 안 되는 것 같다."
아래는 그 주장을 파일·줄·측정값으로 좁힌 결과다.

## 결론

**효용은 하류(이벤트 조건 · 구역 드나듦 트리거 · 랜덤 인카운터)에 있는데 표면은 상류(캔버스 툴바 토글)에만
있고, 둘을 잇는 것은 문장 하나다.** 그 문장은 (1) 레이어를 켠 뒤에만 보이고, (2) 쓰는 지점에서는
행동 없는 지시문이며, (3) 인카운터에서는 **아예 렌더되지 않는다**. 즉 사용자가 "이걸로 뭘 할 수 있나" 를
배울 수 있는 순간이 화면에 존재하지 않는다.

## 분류 — «구역이 존재하는 화면» 은 로케이션 레이어다 (2026-09-11 확인)

- **화면 계약(실측):** `render()`(`src/editor/mapLocationLayer.ts:127-149`)는 `enabled` 가 거짓이면
  오버레이와 인스펙터를 **비우고**(`clearChildren`) 돌아간다. 켜져 있을 때만 `is-active` 가 붙고,
  꺼진 오버레이는 `pointer-events: none` 이다. 즉 꺼진 상태에서 이 층의 DOM 은 비어 있고,
  효용을 말하는 힌트 문장도 DOM 에 없다 — 화면에 남는 흔적은 툴바의 명사 버튼 하나뿐이다.
- **그래서 «구역이 존재하는 화면» = 로케이션 레이어가 켜진 상태다.** 새 사용자는 그 화면의 전제 두 개를
  모두 갖지 못한다: (a) 켜짐, (b) 구역 1개 이상. 순서가 순환한다 — 켤 이유는 그 화면에 있고,
  그 화면은 켜야 나온다.
- **소유 경계:** 이 층의 표면 소유는 `src/editor/mapLocationLayer.ts`(오버레이·인스펙터),
  `src/editor/mapLocationLayerState.ts`(상태·행위), `src/styles/editor/map-location-layer.css` 다.
  소비 표면(조건 폼 · 트리거 저작 · 인카운터)은 각자 자기 파일이 소유한다. 그러므로 후보 A 는
  「이벤트 편집기 변경」 이 아니라 **이 기능의 진입 문제**로 분류한다 — 파일이 남의 모듈에 있어도
  소유는 로케이션 레이어 기능에 있다.

## 실측 (2026-09-11, A 적용 **전** 기준선)

| 표면 | 지금 무엇을 말하나 | 근거 |
|---|---|---|
| 시작 상태(두 경로 모두) | **로케이션 0.** 예제 데모는 맵 16 · 로케이션 0 이고, 빈 프로젝트는 맵에 `locations` 필드 자체가 없다 — 새 사용자가 «구역이 존재하는 화면» 을 볼 경로가 없다 | 예제: `jq '[.maps[] \| (.locations // []) \| length] \| add' src/project/defaults/fixtures/dew-village-demo.json` → `0`. 복제는 `createSampleAdventureProject()` — `src/project/defaults/defaultProject.ts:82-83`. 빈 프로젝트: `createBlankMap` 이 필드를 만들지 않는다 — `src/project/defaults/defaultMaps.ts:97-116` |
| 레이어 기본값 | 꺼짐. `localStorage["oprn:map-location-layer"] === "1"` 일 때만 켜진다 | `src/editor/mapLocationLayerState.ts:62-68` |
| 진입점(툴바 버튼) | 라벨이 명사 `로케이션` 하나. 페이로드는 네이티브 `title` 한 문장뿐(호버 ~1초, 잘림) | `src/editor/panels/editorZoomToolbar.ts:106-119`. `canvasChromeDense` 분기(`:121`) **앞**에 append 되므로 Basic 포함 모든 모드에 보인다 |
| 레이어를 켠 직후 | 인스펙터 힌트가 **이 층의 효용을 말하는 유일한 문장**("구역은 이름으로 이벤트 조건과 랜덤 인카운터가 가리킵니다") | `src/editor/mapLocationLayer.ts:266-275`. 켜야만 보인다 |
| 쓰는 지점 — 조건 | `(이 맵에 로케이션이 없습니다)` 선택지 + 오류 문단 "구역을 선택하세요. 맵의 「로케이션」 레이어에서 먼저 그려야 합니다." — **버튼·이동 없음** | `src/editor/panels/eventEditor/conditionForm.ts:1047-1056`(선택지), `:1059-1065`(문구), `:1076`(배치) |
| 쓰는 지점 — 트리거 | 같은 막다른 문장 | `src/editor/locationTriggerAuthoring.ts:82-84`, `:101-107` |
| 쓰는 지점 — 인카운터 | **필드가 통째로 사라진다.** `locations.length > 0 \|\| brokenLocationId` 일 때만 "이름 붙은 구역" 선택기가 렌더된다 | `src/editor/panels/mapProps.ts:712`. 0개 맵에서는 개념 자체가 화면에 없다 |
| 인스펙터 — 참조 | `이 구역을 가리키는 참조 N건` 숫자만. 어떤 이벤트/인카운터인지 목록은 **삭제 확인 대화상자에서만** 나온다 | 개수 `src/editor/mapLocationLayer.ts:399-406`, 사이트 목록 `:428-440`, 모델 `LocationDeletionImpact.sites` `src/editor/mapLocationLayerState.ts:204-207` |

## 막혀 있는 채널 (설계 결정이므로 우회하지 마라)

- **자동 안내 금지.** 편집기 렌더·부팅 경로에서 초보자 코치마크·사용법 카드를 자동 호출하지 않는다
  (2026-09-06 결정, `test/e2e/no-auto-guides.spec.ts` 가 강제). "첫 방문에 팝업" 식 해법은 금지다.
- **지연 툴팁도 아니다.** 롤아웃은 14개 고정 목록이고, 규칙 자체가 "글자가 이미 보이는 버튼에 붙이면 소음"이다.
  텍스트 버튼인 이 토글은 대상이 아니다 — `openwiki/delayed-tooltip.md` 의 「1차 롤아웃 대상」.

## 검증 공백 (실측)

- `scripts/qa/map-location-layer.mjs` 의 16단계는 **기하 · 제스처 소유권 · 참조 · 복구**만 본다
  (`:69-484`). 15단계 「참조된 구역」은 04단계에서 이미 만든 구역을 가리키므로,
  **0개 맵의 인카운터 표면(`mapProps.ts:712` 의 숨김 분기)은 어떤 테스트도 지나지 않는다.**
- `test/mapLocationLayer.test.ts` 는 복사 문구를 고정하지 않는다(구조·상태만 검증).
- 문구를 고정하는 테스트는 `test/locationTransitionAuthoring.test.ts:179`(`「이 맵에 로케이션이 없습니다」`)와
  `:183`(오류에 `「로케이션」` 포함) 뿐이다. 조건 폼 문구(`구역을 선택하세요…`)를 고정하는 테스트는 없다 —
  즉 **선택지를 더하는 변경은 기존 테스트를 깨지 않고, 문구를 갈아치우는 변경은 위 한 건을 깬다.**
- **A 가 새로 덮은 것:** `scripts/qa/location-draw-cta.mjs` 가 «0개 맵의 인카운터 표면» 과 «빈 상태
  트리거» 를 실 브라우저에서 지난다(위 16단계 하네스가 못 지나던 자리). 조건 폼 쪽은 같은 렌더러를
  쓰는 것을 `test/locationDrawCta.test.ts` 가 고정한다.
- **막힌 자리(편집기 결함, 이 변경의 범위 밖):** 이벤트 편집기의 「고급 조건」에서
  `event-page-advanced-condition-add` 를 누르면 **저장소에는 조건이 들어가지만**
  (`page0Conditions: [] → [{kind:"switch",…}]` 실측) 목록·요약 DOM 이 다시 그려지지 않는다
  (1.2초 대기 후에도 «추가 조건 없음» / «고급 조건 (0)», JS `click()` 으로도 동일). 그래서 그 자리의
  «구역(로케이션)» 행을 브라우저에서 열 수 없어 조건 폼의 CTA 는 유닛으로만 덮인다 — 고치면
  `location-draw-cta.mjs` 에 그 단계를 되돌려 넣어라.

## 후보 수정 (A 만 적용, B/C/D 미적용)

| 안 | 내용 | 비용 | 얻는 것 / 위험 |
|---|---|---|---|
| **A ✅적용** | 쓰는 지점 빈 상태에 **행동 버튼**. 조건·트리거·인카운터가 "이 맵에 구역이 없습니다 → [맵에서 구역 그리기]" 로 `setLocationLayerEnabled(true)`(`src/editor/mapLocationLayerState.ts:103`) + 토스트로 잇는다. 인카운터 필드는 0개일 때도 자리를 남긴다 | 작음, 국소. 데이터 변경 없음 | 의도 최고점에서 개념+행동을 동시에 전달. 레이어가 모든 편집 모드에 상주한다는 기존 계약(`editorZoomToolbar.ts:106-107`)을 그대로 쓴다. 공유 모듈은 `src/editor/locationDrawCta.ts` 하나 |
| **B** | 인스펙터 `참조 N건` → 실제 사이트 목록 + 클릭 이동, 0건이면 "이벤트 조건·인카운터에서 고를 수 있습니다" | 중간 — `LocationDeletionImpact.sites` 를 삭제 경로 밖으로 노출 | 이미 만든 구역의 효용이 즉시 보인다. 첫 접촉 문제는 못 고친다 |
| **C** | 라벨·문구 정비(`로케이션` → 다른 낱말 등) | 큼 — 용어 정본(`INDEX` 「헤더 용어 정본과 중복 감사」) · 문구 고정 테스트 · 위키 파급 | 첫인상. A 대비 파급이 과대 |
| **D** | 캔버스 빈 상태 고스트 — 켰는데 0개면 "여기를 드래그" | 중간 — 오버레이 기하·제스처 계약 | "켰는데 아무것도 안 보인다" 해소. `editor-pre-edit-routing.md` 의 실측 함정 2건(`preventDefault` 금지, `.is-yielding` 복원) 준수 필요 |

전부 **사용자 행동으로만** 뜨므로 `no-auto-guides` 계약과 충돌하지 않는다. A 는 적용됐고
브라우저 증거는 `verify-shots/loc-draw-cta/SUMMARY.md`. B(인스펙터 참조 목록)와 D(캔버스 빈 상태
고스트)는 그대로 후보다 — D 는 A 가 켜 준 뒤의 «0개 화면» 을 채우는 조각이라 다음 순서로 자연스럽다.

## A 구현 (2026-09-11)

구조는 하나다: 세 표면이 각자 문장을 쓰지 않고 **같은 모듈**을 부른다.

- `src/editor/locationDrawCta.ts` — `renderLocationDrawCta({ testId })` 가 구역 0개인 맵에서만 버튼을
  내고, 없으면 `null`(이미 그린 사람에게 소음이 되지 않는다). 누르면
  `startDrawingLocations()` 가 레이어를 켜고, **모달이 열려 있으면**(`hasOpenModalLayer()`) «이 창을 닫으면
  맵에서 …» 문장으로, 아니면 바로 그리라는 문장으로 토스트를 띄운다 — 켠 결과가 가려져 있는 동안
  버튼이 아무 일도 안 한 것처럼 보이지 않게 하는 유일한 장치다.
- 붙은 자리 셋: `conditionForm.ts`(`event-condition-inside-location-draw`),
  `locationTriggerAuthoring.ts`(`event-page-trigger-location-draw`),
  `mapProps.ts`(`map-encounter-location-draw-<i>` — 이제 0개일 때도 필드를 숨기지 않는다).
- **«대신 만들어 주기» 는 하지 않는다.** 임의 위치에 구역을 만들면 사용자가 만들지 않은 장소가 조건·
  인카운터의 후보가 된다 — 「전부 승격」 버튼을 걷어낸 결정과 같은 이유다.
- 회귀: `test/locationDrawCta.test.ts`(5건 — 0개에서만 버튼·클릭이 레이어를 켬·토스트·맵 없음·조건 폼 배선),
  `test/locationTransitionAuthoring.test.ts`(빈 상태 트리거가 버튼을 내고 클릭이 레이어를 켬),
  `test/mapEncounterPanel.test.ts`(0개 맵에서도 필드·안내·버튼이 있다).
- 브라우저 증거: `scripts/qa/location-draw-cta.mjs` → `verify-shots/loc-draw-cta/`(6장 + SUMMARY).
  검사 14건 전부 통과. 실 브라우저에서 «빈 상태 → 버튼 클릭 → 레이어 켜짐 → 드래그로 구역 생성 →
  선택기에 그 구역이 뜸» 까지 닫힌 루프를 돈다.

## 남은 일 (B/D)

B(인스펙터 참조 목록·0건 안내)와 D(빈 화면 고스트)는 적용됐다.
고스트는 **카메라 재배치 계약**을 따른다(`repositionMapLocationLayer` 가 옮긴다) —
1차 구현은 그 줄이 없어 팬 한 번에 점선 상자가 맵 밖으로 나갔다(2026-09-11 실측).
1칸짜리 구역은 Shift+클릭이 명시 통로다. 같은 변경에서 로케이션은 켠 동안
구역 그리기 도구로 보이고, 같은 칸 클릭은 구역을 만들지 않으며, 페이지 조건 칩에 「구역」이 있다.
고급 목록은 첫 구역 조건을 칩으로 보내고 초과분만 고급에 남긴다 — 예전에는 `insideLocation` 이
고급 목록 집계에서 빠져 저장소에만 남고 화면에서 사라졌다.

C(용어 `로케이션` 교체)는 그대로 후보다. 남은 알려진 한계: 켜짐이 localStorage 에 남고,
시작 방식 「구역에 드나들면」은 이벤트 편집기의 시작 방식 선택기에서 바로 고를 수 있고,
페이지 조건 쪽은 칩으로 들어왔지만 인카운터 빈 상태 CTA 는 여전히 대신 그려 주지 않는다.

## 검증 좌표

- `npm run openwiki:index` — `openwiki/INDEX.md` 는 생성 파일이다. 손으로 고치지 마라.
- 브라우저(이 기능): `npm run dev:worktree` +
  `LOCATION_CTA_QA_URL=http://127.0.0.1:<포트> node scripts/qa/location-draw-cta.mjs` → `verify-shots/loc-draw-cta/`.
- 회귀(이 기능): `test/locationDrawCta.test.ts`, `test/locationTransitionAuthoring.test.ts`,
  `test/mapEncounterPanel.test.ts`.
- 브라우저: `npm run dev:worktree` +
  `MAP_LOCATION_QA_URL=http://127.0.0.1:<포트> node scripts/qa/map-location-layer.mjs` → `verify-shots/oprn-020/`.
- 계약 원본: `openwiki/runtime-project-schema.md` 의 「명명 로케이션 레이어」 절,
  `openwiki/editor-pre-edit-routing.md` 의 같은 이름 절.
