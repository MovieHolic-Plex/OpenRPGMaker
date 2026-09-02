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

## 6. 시설 다양화 — 여관 하나에서 초안 아홉 종으로 (2026-09-02 후속)

사용자 요청: 「개념 꾸러미를 통해 다양한 실내를 만들 수 있게」. 도면·구성·칩 집행 규칙은 그대로 두고 **데이터(초안)와 그 데이터를 드나드는 면**을 넓혔다.

### 6.1 초안 묶음 (`src/project/defaults/conceptFacilityTemplates.ts`)

| id | 시설 | 장소(역할·크기) | 벽 | 특징 |
|---|---|---|---|---|
| inn | 여관 | 침실 room·m ×2 → 복도 walkway → 식당/홀 entrance·l | 크림 | 기존 그대로(첫째) |
| house | 민가 | 침방 room·s · 부엌 room·s(널) → 거실 entrance·l | 크림 | 화덕·식탁·돗자리 |
| shop | 상점 | 물품 창고 room·s → 매장 entrance·l(널) | 크림 | 계산대·진열대·선반 |
| tavern | 술집 | 주방 room·s(널) · 객실 room·s → 홀 entrance·l | 크림 | 카운터·피아노·간판·객실 침대 sleep |
| library | 서재 | 개인 서재 room·m → 열람실 entrance·l(널) | 크림 | 책장 ×2 + 붉은 카펫 |
| smithy | 대장간 | 자재 창고 room·s → 작업장 entrance·l(돌) | 석재 벽돌 | 화덕=단조로, 갑옷·검 거치대 |
| church | 교회 | 사제실 room·s → 예배당 entrance·l(돌) | 크림 | 성상·제단·흉상 ×2·붉은 카펫 |
| warehouse | 창고 | 보관실 entrance·l(널) | 크림 | 방 하나, 상자·술통 7개 |
| guild | 길드 | 회의실 room·l → 복도 walkway → 접수홀 entrance·l(널) | 금빛 벽돌 | 카운터·의뢰 진열대·회의 탁자 |

시드: `tileset.scratchConceptBundles === undefined` 인 실내 칩셋에 아홉 종을 한 번에 얹는다(`ensureConceptBundles`·DB 탭 `ensureScratchBundles`). 빈 배열은 여전히 재시드 금지. 옛 프로젝트(여관만 시드)는 시설 띠의 「초안 넣기」로 빠진 초안만 골라 넣는다 — 자동으로 되돌리지 않는다.

### 6.2 스키마 확장 (선택 필드, 기본값은 필드 삭제)

- 장소 `floor?: "wood" | "stone" | "plank" | "mat"` → `RoomSpec.floorTile`(72·12·102·139). 번호 표는 `conceptBundleResolve.CONCEPT_FLOOR_TILES`(파이프라인 미의존 유지).
- 시설 `wall?: "cream" | "gold-brick" | "stone-brick"` → `InteriorRoomPlan.wallMaterial`. 파이프라인이 원래 갖고 있던 리틴트(가구 배치 뒤 통타일 교체)를 그대로 쓴다.
- 검증기 `shapeResourceFields` 가 모르는 값을 거절하고 `cloneConceptBundle` 이 보존한다.

### 6.3 구성기 보정 (초안 실측으로 드러난 것)

1. **홀 넓힘** `BAND_SPREAD=1`: 복도 없이 방 둘 이상이 홀 바로 위에 서면 홀을 좌우 1열씩 넓힌다. 방문 착지 열(방 중앙)이 홀 북벽을 2칸 조각으로 쪼개 3칸 가구(카운터·피아노·책장)가 설 자리가 없었다.
2. **러그 먼저**: 벽 가구(필수 먼저) → 러그 → 바닥·구석(필수 먼저). 러그 칸은 상위 레이어 가구에만 자리로 열린다(하부 레이어 상자·책장은 러그를 덮어 구멍을 내므로 불허). 입구 표지(`ENTRY_SENTINEL`) 위에도 깔린다. 방 전체를 훑어 중앙에 가장 가까운 자리를 고른다.
3. **구석 소품 둘레 확장**: 네 구석 → 남·북 행 → 서·동 열 → 안쪽.
4. **북벽 앵커 공유**: 북벽 가구·키 큰 가구·복도 끝 계단이 서로를 앵커로 보고 퍼진다(흉상 둘이 동쪽에 나란히 서던 결함).
5. 조사 문장에 시설명(`ConceptEventOptions.facilityLabel`).

### 6.4 조수 면

- 툴 설명에 시설명·별칭 낱말(여관·상점·술집·주막·민가·서재·도서관·대장간·교회·성당·창고·길드) + 「지어줘·만들어줘」 → 「X 지어줘」가 승격(matchScore ≥ 20). 핀은 여전히 없다.
- 시스템 프롬프트 개념 절은 **두 단계**다(2026-09-03). 초안 그대로(칩셋에 `scratchConceptBundles` 없음)면 시설명 한 줄(`query=시설명`, 약 200자). 사용자가 고친 나무(배열 있음)면 시설마다 한 줄(장소 `[역할·크기 ×개수·바닥]`·벽·물건 표식, 9시설 ≈ 1,500자). 빈 프로젝트 프롬프트가 20,000자 예산 중 약 19,250자를 이미 써서, 초안에도 시설별 줄을 싣자 뒤의 스타일 문서 발췌가 밀려났다(`test/worldAiExclusion.test.ts`). 장소마다 줄을 쓰던 첫 판은 더 컸다.
- `concept-not-found` 오류에 지금 부를 수 있는 시설 목록.
- 의도 라우터·되묻기에는 여관 외 시설명을 **넣지 않았다**. 「대장간 지어줘」는 야외 건물일 수 있으므로 기존대로 실내/야외를 되묻고, 실내로 답하면 place_concept 이 짓는다(코퍼스 `blacksmith-full` 은 structure+npc-shop).

### 6.5 데이터베이스 면

시설 띠(`scratch-concept-facilities`, 칩 `scratch-concept-facility-<bundleId>`, `+ 시설`, 빠진 초안만 보이는 `초안 넣기…` 셀렉트), 도구줄 `벽 재질`·`시설 삭제`, 장소 카드 `바닥`. 피커는 프로젝트 킷 뒤에 카탈로그에만 있는 소품을 잇는다. 카탈로그 10종 추가(성상·과일 선반·항아리 선반·곡물 자루·잡화 상자·물통·주전자·스툴·붉은 카펫·짚 돗자리, 역할 null).

### 6.6 증거

- `test/conceptFacilityTemplates.test.ts`(20): 초안마다 plan/walkability 경고 0·자리 없음 0·필수 물건 존재, 도면 다양성, 재질 리틴트, 승격, 프롬프트, 시드 규칙.
- `test/scratchConceptTab.test.ts`(17): 시설 띠·초안 넣기·삭제·재질 저장·피커 소품.
- 갤러리 보고서 `reports/concept-facilities/index.html`(`scripts/gen-concept-facility-gallery.mts`, 9/9) + 실제 에디터 사진(`test/e2e/_concept-facility-gallery.spec.ts`, 모델 호출 없음).

## 7. 층 — 계단이 실제로 위층에 닿는다 (2026-09-03)

3장의 미결(「transfer 칩은 연결 지점만 선다」)을 닫는다. 결정: **장소에 `level` 필드(1~3, 기본 1)**. 시설 안 2층 도면을 따로 두는 대안은 장소·물건·칩 나무를 층마다 복제하게 되어 버렸다 — 장소 하나에 층 숫자를 붙이는 쪽이 role·size·count·floor 와 같은 결을 탄다.

### 7.1 도면

- `conceptFacilityLevels(bundle, facility)` → 장소들이 서는 층(오름차순). `layoutConceptFacility(bundle, facility, { level, minBandWidth })` 는 그 층의 장소만 편다. 위층엔 보통 정문 역할이 없으므로 마지막 방이 문 밴드로 승격되고(종전 promoted 규칙), 그 문 자리가 **내려가는 계단 착지**가 된다.
- `minBandWidth`: 층마다 건물 외곽(밴드 폭)을 가장 넓은 층에 맞춘다. 홀만 남은 1층이 자기 발자국 폭(9)으로 좁아지면 계단·카운터·피아노가 북벽 한 줄을 나눠 설 자리가 없었다(실측 「카운터 런 자리 없음」).

### 7.2 시공·연결 (`placeConceptTool`)

층마다 `runRoomPipeline` 한 번. 1층 = `mapId`, 위층 = `<mapId>_<n>f`, 이름 `<시설명> n층`. 그 뒤 코드가 잇는다:

| 어디 | 무엇 | 대상 |
|---|---|---|
| n층 계단(transfer 칩, 미연결) | `linkConceptTransfers` | n+1층 착지 = 위층 문 자리 바로 북쪽 바닥 `(door.x, door.y-1)` |
| n+1층 정문 이벤트 `ev_entrance_<mapId>` | `convertEntranceToDescent` → 「계단(아래)」 | n층 첫 계단 앞 = 계단 이벤트 남쪽 한 칸(같은 방 안이면), 아니면 계단 칸 |
| 맨 위층 계단 | `linkConceptTransfers` | 아래층 계단 앞(같은 대상) |

n층에 계단이 없으면 위층은 서되 내려오는 자리가 n층 정문 앞이고 경고 `concept: n층에 계단(transfer 칩) 물건이 없다` 를 남긴다. 층이 둘 이상이면 시공 중 나온 「연결 대상이 없다」 경고는 이었으므로 뺀다. 결과 `data.floors[{level,mapId,name}]`, `data.connections[]` 에 `mapId·level`, 요약 끝에 「2층 map_inn_2f」.

### 7.3 면

- DB 장소 카드 「층」 셀렉트(`scratch-concept-place-level-<id>`), 1층은 필드 삭제. 검증기 정수 1..3. 프롬프트 상세 줄에 `·2층`. 툴 설명에 층 문장.
- 초안 아홉 종은 그대로 한 층. 2층은 사용자가 켠다 — 기본 여관을 두 층으로 바꾸면 기존 증거 스펙(침대 앞 여관 창)과 갤러리가 흔들리고, 무엇보다 사용자 나무가 정본이라는 원칙에 맞다.

### 7.4 증거

`test/conceptFacilityLevels.test.ts`(5): 한 층 도면 불변, 검증·복제, 층별 도면, 맵 두 장 + 계단 양방향, 계단 없는 1층 경고. 갤러리 보고서 「층 — 여관을 두 층으로」 절(판정 10/10, `png/map_inn2f*.png`).

## 8. 조수 코어 두 건 (2026-09-03)

- **중복 시공**: 라운드 끝 successTools 자동 완료가 성공 툴 집합을 비운 뒤 모델이 같은 항목을 명시 `complete_work_item` → 「기록 없음」 거부 → 재시공. done/skipped 항목은 `completeWorkItemById` 가 `alreadyDone` 으로 받는다.
- **볼륨 계약 폭주**: 패널이 매 턴 붙이는 「도구 규칙」 가이드의 마을·상점·NPC 낱말이 의도 스캔에 섞여 `requestNeedsVolumePlan` 이 참이 됐다(모든 공간 요청). `stripContextFooter` 가 가이드 첫 줄부터 뗀다. `buildVolumeWorkPlan` 은 막대가 요구하는 축만 항목으로 둔다. 실측(`test/e2e/_concept-inn-audit.spec.ts`): 「여관 지어줘」 66초·툴 19회·시작 맵 오염 → 10초·툴 3회·시작 맵 무변경.
