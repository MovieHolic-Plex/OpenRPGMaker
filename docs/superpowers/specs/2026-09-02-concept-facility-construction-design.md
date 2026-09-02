# 개념 꾸러미 시설 시공 — 여관이 여관으로 읽히게 (2026-09-02)

목표: 에디터 내장 조수에게 「여관 지어줘」라고 치면 `place_concept` 가 데이터베이스 「임시 → 개념 꾸러미」의
라이브 나무를 읽어 **여관으로 보이고 여관으로 작동하는** 실내 맵을 짓는다. 사람이 나무를 고치면 맵이 눈에 띄게 달라진다.

핸드오프(`handoff.md`)의 잠긴 설계는 그대로 둔다: 네 층(시설→장소→물건→칩), 정본은 `tileset.scratchConceptBundles`,
AI 는 소비만, `place_concept` 핀 금지, `conceptBundleResolve` 는 `interiorRoomPipeline` 을 import 하지 않는다.

## 1. 장소 층 최소 확장 (스키마)

장소에 라벨밖에 없어서 도면을 코드가 추측해야 했다. 장소 레코드에 선택 필드 셋을 더한다.

| 필드 | 값 | 기본 | 뜻 |
|---|---|---|---|
| `role` | `entrance` · `walkway` · `room` | `room` | 정문을 품는 홀 / 방을 잇는 복도 / 일반 방 |
| `size` | `s` · `m` · `l` | `m` | 바닥 크기 힌트 (s 5×3 · m 7×4 · l 9×5) |
| `count` | 1..4 | 1 | 같은 장소를 몇 개 짓나 (객실 ×2) |

- 칩은 닫힌 8종 그대로. 산문 규칙은 넣지 않는다.
- 필드가 없는 옛 나무는 기본값으로 읽고, 복도 판정은 라벨 정규식 폴백을 유지한다(기존 사용자 데이터 호환).
- 여관 초안 시드: 식당/홀=`entrance`·`l`, 복도=`walkway`, 침실=`room`·`s`·`count 2`.
- 저작 UI(임시 탭 장소 카드)에 역할 선택·크기 선택·개수 입력을 둔다. 검증기(`shapeResourceFields`)가 enum 을 거절한다.

## 2. 도면 (layoutConceptFacility)

남→북으로 **홀(entrance) → 복도(walkway) → 방들(room)**. 파이프라인 벽 문법을 그대로 따른다.

```
y=4      [방A 5×3][1열][방B 5×3][1열][방C …]      room 들, 크기별 폭
y=7..9   ── 3행 파티션(트림+벽면 2행) ── 문은 각 방 중앙 x, y=7
y=10..12 [========= 복도 3행 =========]           walkway, 계단은 동쪽 끝
y=13..15 ── 3행 파티션 ── 문은 복도 중앙
y=16..20 [========= 홀 5행 ==========]            entrance, 정문은 남쪽 행 중앙
```

- 방 줄 폭 = Σ폭 + (n−1). 복도·홀은 방 줄 폭에 맞춘다. 맵 폭 = 폭 + 좌우 2, 높이 = 홀 남쪽 + 3.
- walkway 가 없으면 방들이 홀에 직접 붙는다. entrance 가 없으면 복도(없으면 첫 방)가 정문을 품는다.
- 옛 나무(역할 없음)는 첫 장소를 entrance 로 승격시키지 않는다 — 복도 정규식 폴백 + 나머지 방, 정문은 복도 남쪽.

## 3. 구성 (paintConceptThings → 슬롯 배치)

방 인스턴스마다 슬롯을 세고 물건을 순서대로 앉힌다. 못 앉힌 물건은 경고로 남긴다(숨기지 않는다).

1. 순서: required → 발자국 큰 것 → snap `wall-north` → `floor` → `wall-any`.
2. `wall-north`: 북쪽 바닥 행의 빈 런을 균등 분할해 앉힌다(RNG 회전 첫 자리 아님). 문 접근로 ±1 은 비운다.
3. `floor`: 방 안쪽 중앙에서 바깥으로. walkway 에서는 `pass` 칩 물건(계단·러그)만 바닥에 놓고 `block` 물건은 끝 구석만.
4. `transfer` 물건(계단)은 복도 동쪽 끝 슬롯을 먼저 받는다.
5. 카탈로그 cells 로 찍고 `canPaintObject` 로 검증. 실패 시 `concept: <물건> 자리 없음 (<장소>)`.

## 4. 칩 집행 (물건이 놓인 자리에 이벤트를 단다)

| 칩 | 집행 |
|---|---|
| `block` | 걷기 BFS 장애물(기존) + 타일셋 통행표가 통과면 경고 |
| `pass` | 계단·러그 셀을 개방 셀로 셈(BFS) — 통행 확보 |
| `sleep` | 물건 앵커 셀에 action 이벤트: `inn`(기본 20G, MP 회복) |
| `event` | (sleep/loot/transfer 없을 때) action 조사 이벤트 「<물건>이다.」 |
| `loot` | selfSwitch A 1회 노획(금화) → 이후 「비어 있다」 |
| `transfer` | action 이벤트 + `transfer` 명령. 대상이 없으면 같은 맵 정문으로 두고 `data.connections` 에 미연결로 보고 + 경고 |

앵커 셀 = 물건 최하단 행의 중앙 열. 이벤트 id `ev_concept_<mapId>_<thing>_<n>`.

## 5. 검증

- 렌더러: 보고서는 에디터와 같은 쿼터 합성으로 PNG 를 만든다(`scripts/lib/renderInteriorMapPng.mts`, pngjs).
- 계약: `test/placeConceptTool.test.ts` 확장(도면·구성·칩), `test/scratchConceptTab.test.ts`(역할·개수 편집), 기존 케이스 유지.
- 조수: 스텁 LLM 으로 「여관 지어줘」 첫 라운드 노출에 `place_concept` 이 있고 호출이 맵을 만드는지, 그리고 실제 에디터에서 `__oprnAiBridge.send` 로 실제 LLM 턴(`test/e2e/_place-concept-inn-evidence.spec.ts`, 진단 스펙).
- 판정은 이미지: `scripts/gen-place-concept-report.mts` 가 초안 vs 수정(피아노 삭제·책장 추가·식당 삭제·개명)을 나란히 찍고 달라진 셀을 표시한다.
