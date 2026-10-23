# 명령 가족 100개 — 그룹 배분

500개 행렬은 **가족 100 × 변형 5** 다. 가족 하나가 하나의 계약이고, 변형은 같은 계약을 다른 대상·인자·말투로
물어본다(존댓말·반말·짧은 지시·설명형). 판정기·정답·오답이 모두 `args` 를 읽으므로 변형은 문장만 바뀌는 것이 아니다.

- 형식: `src/harnesses/assistant-capability/node/families/types.ts`
- 등록: `families/index.ts` 가 `group-1.ts`..`group-5.ts` 를 합친다. **지금 구현된 것은 group-1 의 두 예제뿐**이고
  group-2..5 는 빈 배열이다.
- 명세 생성: `npm run harness -- assistant-capability matrix500-spec`
  → `harness-data/assistant-capability/command-matrix-500.json`
- 판정기 자기검사: `npm run harness -- assistant-capability matrix500-selfcheck --out <새 폴더>`
  (정답 통과 · 오답 전부 실패 · 쓰기 가족은 무변경 실패)
- 실행: `MATRIX_NATIVE_SPEC=500 npm run harness -- assistant-capability matrix-native --out <새 폴더>`

## 가족을 추가하는 규칙

1. `reference()` 는 **실제 편집기 도구**(`runOn`)로 정답 문서를 만든다. 손으로 고친 JSON 을 정답으로 쓰지 않는다.
2. `wrongs()` 는 실제 모델이 저지르는 그럴듯한 오답 2개 이상: **잘못된 대상/칸**, **다른 곳의 부작용**, **부분 수행**.
3. 판정기는 `args` 로 매개변수화한다. 좌표·이름·개수를 코드에 박으면 변형이 늘 때 판정기가 거짓말한다.
4. 읽기 가족은 `reference()` 가 **정답 문자열**을 돌려주고 `readTools` 에 그 답이 전제하는 조회 도구를 적는다.
5. 픽스처 확장은 **덧붙이기만** 한다 — 기존 id·좌표·타일을 바꾸면 50개 기본 행렬의 판정기가 깨진다.
   `Family.prepare(project)` 로 새 맵·이벤트·DB 행만 더한다.
6. 새 가족을 넣고 `matrix500-spec` + `matrix500-selfcheck` 를 돌려 5변형이 모두 sound 인지 확인한다.

## 픽스처 추가가 필요한 가족 (그룹 작성자가 먼저 넣을 것)

| 가족 | 필요한 픽스처(덧붙이기 전용) |
|---|---|
| `interior-room-*` (5) | `map_interior_house` (24×18, `atlas_biome_interior`) + 실내 문 이벤트. 기존 맵·이벤트 불변 |
| `transfer-*`, `chain-create-then-link` | 두 번째 마을 맵(`map_hamlet`)과 그 안의 문 이벤트 하나 |
| `battle-*` | `database.troops` 기본 troop 1개 + `database.enemies` 1개(기존 DB 행 불변) |
| `db-*` | `database.skills`/`classes`/`states` 최소 1행씩(없으면 생성 가족만 쓸 수 있다) |
| `media-*` | `assets.audio` 트랙 2개(맵 BGM·전투 BGM) |
| `branch-*`, `autorun-page`, `common-event-call` | `commonEvents` 1개 + `variables` 1개 |
| `read-*` | 위 맵·DB·troop 이 있어야 답이 나온다 |

`paint-dirt`·`rename-npc` 는 **추가 픽스처가 필요 없다**(현재 `nativeProject()` 로 그대로 검사된다).

---

## group-1 — 타일·선택 영역 (20)

| id | area | mode | 판정기가 보는 것 |
|---|---|---|---|
| `paint-dirt` | tiles | write | ✅ 구현. `args.rect` 안의 모든 칸이 흙(모랫길 오토타일)으로 바뀌고, 영역 밖·타일 밖은 그대로 |
| `clear-region` | tiles | write | 선택 영역만 비고(-1) 영역 밖·이벤트 보존 |
| `copy-region` | tiles | write | 원본 2×2 가 오른쪽 2칸에 화소 그대로, 나머지 불변 |
| `mirror-region` | tiles | write | 좌우 거울상(상하·회전 아님), 영역 밖 불변 |
| `place-trees` | tiles | write | 정확히 3칸, 선택 영역 안, 타일 밖 불변 |
| `place-well` | tiles | write | 선택 영역 안에만 우물 타일, 통행 불가 칸 생성 |
| `forest-path` | tiles | write | 바뀐 칸이 모두 선택 영역 안이고 구멍(빈 바닥)이 없다 |
| `move-start` | maps | write | `startPos` 만 이동, 다른 필드 불변 |
| `selection-single-cell` | tiles | write | 정확히 1칸만 바뀐다(선택 1칸) |
| `selection-column-strip` | tiles | write | 1×N 세로 띠만 바뀐다 |
| `selection-l-shaped` | tiles | write | `args.cells` 의 L 자 칸만 바뀐다(외곽 포함 금지) |
| `selection-whole-map` | tiles | write | 맵 전체가 칠해지고 이벤트는 하나도 사라지지 않는다 |
| `chain-paint-then-place` | tiles | write | 바닥 칠하기 + 그 위 소품 N개가 **둘 다** 있다(1단계만 하면 실패) |
| `region-preview` | read | read | `show_map_region` 호출 + 막힌 칸을 "장식"이라 부르지 않는다 |
| `blocked-cells` | read | read | 통행 불가 좌표 70% 이상, 틀린 좌표 20% 이하, 총칸수 일치 |
| `map-name-size` | read | read | 이름·가로·세로 모두 |
| `find-entrances` | read | read | 출입구 2곳(문·남쪽) 모두 |
| `event-list` | read | read | 이벤트 n-1개 이상 나열 |
| `blocked-entrance` | read | read | 나무로 막힌 남쪽 출입구(12,17) |
| `unreachable-links` | read | read | 연결 점검 도구 호출 + 결론 |

## group-2 — 이벤트·분기·변수 (20)

| id | area | mode | 판정기가 보는 것 |
|---|---|---|---|
| `change-first-line` | events | write | 첫 대사만 교체, 화자·나머지 명령 불변 |
| `add-switch-condition` | events | write | 존재하는 스위치 조건 추가 + 원래 명령 생존 |
| `remove-move-command` | events | write | `moveEvent` 만 삭제 |
| `insert-se` | events | write | `playAudio` 하나만 삽입, 순서 보존 |
| `touch-trigger` | events | write | 트리거만 접촉으로, 명령 불변 |
| `face-right` | events | write | 방향만 right, 그림 유지 |
| `add-npc-line` | events | write | 텍스트 명령 하나만 추가 |
| `npc-schedule` | events | write | 유효한 일정 등록 + 페이지 불변 |
| `screen-shake` | events | write | 흔들림 명령 하나(+대기)만 추가 |
| `dialogue-position` | events | write | 대사 위치 bottom(명령 필드 또는 settings 명령) |
| `remove-final-fade` | events | write | 마지막 페이드 짝만 제거(화면이 어두운 채 남지 않음) |
| `rewind-turn` | events | write | 원래 문서로 복귀 |
| `branch-two-choices` | events | write | 선택지 2개 + 각 분기 비어 있지 않음, 기존 대사 보존 |
| `branch-nested-condition` | events | write | 기존 분기 안에 변수 조건 분기가 들어간다(깊이 유지) |
| `variable-create-and-set` | events | write | 변수 생성 + 지정 값 설정, 삭제 없음 |
| `autorun-page` | events | write | autorun 페이지 추가, 첫 페이지 명령 불변 |
| `common-event-call` | events | write | 커먼 이벤트 호출 명령 삽입, 커먼 이벤트 본문 불변 |
| `chain-switch-then-gate` | events | write | 스위치 생성 + 그 스위치를 페이지 조건으로 사용(둘 다) |
| `unused-switches` | read | read | `sw_unused` 를 이름으로 지목 |
| `walkability-check` | read | read | 도달성 도구 호출 + 가능/불가 결론 |

## group-3 — NPC·상점·DB (20)

| id | area | mode | 판정기가 보는 것 |
|---|---|---|---|
| `rename-npc` | npc | write | ✅ 구현. `args.eventId` 의 표시 이름 = `args.name`, 대사 화자도 같은 이름, 대사 본문·다른 명령 불변 |
| `npc-shop` | npc | write | 유효한 상점 명령 추가 + 기존 대사 보존 |
| `remove-shop-herb` | npc | write | 약초만 재고에서 제거(상점 명령 자체는 생존) |
| `place-chest` | events | write | (4,7)에 상자 이벤트 1개, 다른 내용 불변 |
| `potion-price` | database | write | 회복약 가격 30, 다른 항목 불변 |
| `sword-attack` | database | write | 철검 공격력 +5, 다른 장비 불변 |
| `item-description` | database | write | 설명 없던 아이템 하나에만 설명 추가 |
| `create-key-item` | database | write | 열쇠 아이템 하나 추가, 기존 항목 불변 |
| `db-skill-create` | database | write | 스킬 1개, 위력·코스트가 `args` 와 일치, id 중복 없음 |
| `db-enemy-stat` | database | write | 지정 적의 HP·공격력만 `args` 만큼 변화 |
| `db-class-skill-list` | database | write | 지정 클래스가 지정 레벨에 지정 스킬을 배운다 |
| `db-item-price-batch` | database | write | 나열한 아이템 가격만 변화, 나머지 불변 |
| `db-troop-member-count` | database | write | 지정 troop 의 구성 수만 `args` 로, 다른 troop 불변 |
| `db-state-duration` | database | write | 지정 상태의 지속 턴만 변화 |
| `chain-db-item-then-shop` | database | write | 아이템 생성 + 그 아이템이 상점 재고에 들어감(가격 일치) |
| `chain-npc-then-line` | npc | write | NPC 배치 + 그 NPC 에 대사 한 줄(다른 이벤트 불변) |
| `ambiguous-this-npc` | npc | write | **선택한 이벤트만** 바뀐다(다른 이벤트·맵 불변) |
| `ambiguous-tidy-area` | plan | write | 선택 영역 안의 작은 개선 또는 되묻기 — 이벤트 삭제·바닥 전부 지우기는 실패 |
| `show-tool-log` | read | read | 방금 수정한 타일 (14,2) 를 목록에 넣는다 |
| `undo-preview` | read | read | `list_edit_history` 호출 + 되돌릴 변경(나무) 제시 |

## group-4 — 출입구·전이·전투 (20)

| id | area | mode | 판정기가 보는 것 |
|---|---|---|---|
| `move-door` | events | write | 한 칸 왼쪽 이동, 페이지(전이 목적지) 보존 |
| `remove-barrels` | events | write | 영역 안 통 2개만 제거(상자·먼 통 보존) |
| `door-se` | transfer | write | 이동(transfer) **앞에** 효과음 하나 |
| `door-to-plaza` | transfer | write | 집 문 → `map_plaza` 전이 생성 |
| `align-portals` | transfer | write | 두 문의 방향이 서로 마주 봄, 좌표·목적지 불변 |
| `worldmap-north` | transfer | write | 월드맵 북쪽 ↔ 마을 양방향, 출입구 밖 타일·기존 이벤트 불변 |
| `transfer-two-way` | transfer | write | 양방향 전이 + 착지 칸이 서로의 문 앞, 방향이 문 밖을 향함 |
| `transfer-landing-offset` | transfer | write | 착지 좌표만 `args.dx/dy` 만큼 이동 |
| `transfer-conditional` | transfer | write | 전이가 스위치 조건 페이지로 게이팅(무조건 전이 제거는 요청 시에만) |
| `transfer-fade-choice` | transfer | write | 그 문의 fade 만 `args.fade` 로 |
| `chain-create-then-link` | transfer | write | 새 맵 생성 + 그 맵으로 가는 양방향 문(맵 id 일관) |
| `battle-troop-create` | battle | write | troop 1개, 적 id·수가 `args` 와 일치, 기존 troop 불변 |
| `battle-event-start` | battle | write | 이벤트 페이지가 그 troop 으로 전투 명령 실행, 기존 명령 보존 |
| `battle-escape-allowed` | battle | write | 도망 플래그만 변화 |
| `battle-defeat-branch` | battle | write | 승리·패배 분기 존재, 패배 분기가 게임오버 없이 맵으로 복귀 |
| `battle-encounter-rate` | battle | write | 그 맵의 조우 스텝만 `args` 로, 다른 맵 불변 |
| `event-playtest` | read | read | `run_scene_test` 호출 |
| `summarize-diff` | read | read | 방금 놓은 나무(14,2) 요약 |
| `plan-only` | plan | read | 문서 무변경 + 선택 영역 기준 계획(또는 되묻기), 없는 실내 공사 지어내기 금지 |
| `suggest-selection-actions` | plan | read | 선택 영역 기준 추천 20자 이상 |

## group-5 — 실내·미디어·읽기 (20)

| id | area | mode | 판정기가 보는 것 |
|---|---|---|---|
| `night-mood` | media | write | 그 맵의 ambient 가 어두워지고 색이 밤, 다른 맵 불변 |
| `interior-room-build` | interior | write | 새 실내 맵: 바닥 전체 칠함 + 외곽 벽 + 문 1개, 기존 맵 불변 |
| `interior-room-furnish` | interior | write | 가구가 바닥 칸 안(벽 위 금지), 문에서 도달 가능 |
| `interior-room-doorway` | interior | write | 출입구 1개(1~2칸), 바닥이 문턱을 지나 연결 |
| `interior-room-size-change` | interior | write | 방 확장분에 바닥·벽 추가, 기존 가구 보존 |
| `interior-room-light` | interior | write | 실내 광원/밝기만 변화, 다른 맵 불변 |
| `media-bgm-map` | media | write | 그 맵 BGM 만 `args.track` |
| `media-weather-rain` | media | write | 그 맵 날씨만 rain |
| `media-screen-tint` | media | write | 지정 이벤트의 tint 명령 색·농도만, 다른 명령 보존 |
| `media-battle-bgm` | media | write | 시스템 전투 BGM 만 변화 |
| `media-se-volume` | media | write | 지정 이벤트의 효과음 명령 인자만 변화 |
| `ambiguous-make-it-nicer` | plan | write | 선택 영역 안의 변화 + 통행성 보존(전맵 재작성·삭제는 실패) |
| `ambiguous-add-something` | plan | write | 선택 영역 안에 그럴듯한 기물/이벤트 1개 추가 또는 되묻기, 기존 삭제 금지 |
| `read-map-list` | read | read | 모든 맵 id/이름 나열 |
| `read-event-pages` | read | read | 선택 이벤트의 페이지 수·조건 |
| `read-db-items` | read | read | 아이템 id 와 가격 나열 |
| `read-troop-list` | read | read | troop id 와 구성 수 |
| `read-switch-usage` | read | read | 그 스위치를 쓰는 이벤트 이름 |
| `read-tileset-refs` | read | read | 타일셋 참고문서 용도 목록 |
| `read-unreachable-map` | read | read | 시작 맵에서 연결되지 않은 맵 이름 |

---

## 진행 상태

- 구현: `paint-dirt`, `rename-npc` (group-1, 각 5변형 → 10행). `matrix500-selfcheck` 로 10/10 sound 확인.
- 실모델 1건(`paint-dirt__selection-plain`)이 판정기 결함을 하나 잡았다: 모델은 「흙」을 `버들항 농장 흙길`로 칠했고, 판정기가
  모랫길 그룹만 흙으로 인정해 정답을 실패시켰다. 지금은 `tileMeta.tags`(sand/farmland/farm_lane)로 판정한다.
  **자기검사는 자기 정답만 검사하므로 이 종류의 결함을 못 잡는다** — 새 가족은 실모델 1건으로 반드시 확인한다.
- 나머지 98 가족은 위 표의 계약대로 group 파일에 추가한다. 추가할 때마다 `matrix500-spec` 이
  `가족 n/100 · 행 m/500` 을 다시 세고, `complete` 가 false 인 동안 명세는 그만큼만 실행한다.
