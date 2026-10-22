# 계단 입구 계약 · 검사 (2026-10-22)

계단·사다리·에스컬레이터·바닥 구멍 키트에 「어느 칸으로 들어서는가」를 데이터로 붙였다. 전에는 설명에 무엇인지만 있어
조수·방 조립기·데모 빌더가 계단을 남쪽 벽에 붙이거나, 앞 칸을 가구로 막거나, 오르는 계단으로 지하에 가게 놓았다
(첫사랑 사무층: 옥상으로 가는 길에 내려가는 계단통).

## 계약 — 정본 `src/assets/stairContracts.json`
- 생성: `npx --no-install tsx scripts/content/stairs/build-stair-contracts.mts [--dump out.json]`. 키트 106개(번들 칩셋 + 몬스터·에메랄드), 사양 물건 47개.
  고르는 규칙(INCLUDE/EXCLUDE 정규식)과 유도: 1×1 밟는 칸은 side any, 그 밖은 맨 아래 밟는 줄 = 이동 칸, 그 아래 = 앞 칸(남쪽), 맨 아래 줄이 막혔으면 bump.
- 사람 확인: `tiledata/stairs/overrides.json` — 4배 그림을 보고 키트마다 확인(`{}`) 또는 고침(`why` 필수). `drop` 은 계단이 아닌 것. 에메랄드 사본은 `monster_*` 고침을 물려받는다.
- 필드(키트 왼쪽 위 기준): `w h` · `trigger`(이동 이벤트 칸) · `approach`/`side`(들어서는 앞 칸, 키트 밖) · `passable` · `mode` walk|bump · `leads` up|down|same · `exit`(same 의 위 끝) · `note`(조수가 읽는 한 줄).
- 조립기 사양 물건 → 키트: `objects[ts][objId] = {kit, lift}`, 키트 원점 = (o.x, o.y − lift). 벽에 붙는 travel 조각(h1, up ≤ 16)은 한 줄 올려 그려 lift = −minDy + 1.
- 코드: `src/project/stairs/contract.ts`(읽기·문장), `detect.ts`(맵 네 층 칸 번호로 깔린 계단 찾기, 75% 일치 + 겹침 제거), `fit.ts`(이동·도착 맞추기·짝 맞추기), `placement.ts`(찍을 때 앞 칸 검사).

## 검사 — `src/project/lint/stairEntranceLint.ts` (전부 warning, `lintScenePolish` → validate·쓰기 뒤 장면 검사)
- `stair-entrance-blocked` 앞 칸이 모두 못 밟거나, 도착·시작 칸에서 걸어서 닿지 않는다.
- `stair-trigger-off` 계단 영역의 층 이동 이벤트가 이동 칸이 아니다.
- `stair-misfacing` 짝 계단이 같은 방향 · 맵 이름 층(옥상 1000, 지하 음수, N층)과 방향이 어긋남 · 도착이 계단 칸 위거나 계단을 바라본다.
- 안 보는 것: 그림과 벽 윗줄의 시각 정합, 이벤트 실행, 이름에 층이 없을 때의 위/아래, **계단 그림이 없는 「계단」 이동**(예: 문 칸에 「계단을 올라」 문구).

## 배치에 쓰는 곳
- `build_hand_interior_room`: 조립기가 앞 칸이 바닥이 아니면 오류 `stair-entrance-blocked`(furnish.ts 는 오류 수로 자리 후보를 거르므로 막힌 자리를 피한다),
  links 의 이동 이벤트를 이동 칸에(bump → priority same), 도착을 앞 칸·계단을 등진 방향으로. 끝에 `fitStairTransfers` 로 이어진 맵까지 맞춘다.
- `list_hand_interior_parts` 행의 `entrance`, `list_spatial_designs` 의 kit 행 `entrance`, roomKit `kitHandObjects` 설명에 계약 문장.
- `create_transfer_pair`: 쓰기 뒤 `fitStairTransfers` + 짝 방향 경고(`stairPairMismatch`).
- `stamp_object`(kitPlacementRules `checkKitPlacement`): 앞 칸이 막히면 거절. 편집기 키트 붓은 첫 칸에서 안내 토스트(막지 않음).
- `fitStairTransfers` 짝 맞추기: 오르는 계단으로 위층의 오르는 계단 앞에 내리면, 위층에서 이 맵으로 돌아오는 내려가는 계단 앞으로 옮긴다.

## 참고문서 — 번들 소유
- `scripts/content/stairs/prepare_stair_references.py` → `src/assets/sharedStairReferences.json`(칩셋 19 · 그림 106, 경로만) + `public/assets/stair-references/<칩셋>/NN.png`(4배, 정상/오류 나란히).
- `ensureStairEntranceReferences`(`src/project/defaults/stairReferences.ts`)를 `ensureBundledTilesets` 끝에서 모든 칩셋에 부른다 — 새·옛 사본 모두 빠진 「계단 입구」(id `stair-entrance`)만 덧붙인다. 공유 포인터·일부러 비운 []·같은 id·32 상한은 건드리지 않는다.
- 계약을 고치면: overrides → build-stair-contracts → prepare_stair_references 순서로 다시 굽는다.

## 일괄 점검 스크립트
- `scripts/qa/staging/lint-bundled-stairs.mts` — 방 견본(계단 든 44개, 벽 상자+남문 합성) · 일본 집 2층 청사진 · 공용 장소 72곳.
- `scripts/qa/staging/lint-flagship-stairs.mts` — 첫사랑·Fallen Star·Astra.
- `scripts/content/stairs/fit-bundled-places.mts [--write]` — 공용 장소의 이동·도착만 계약대로(그림·지형은 안 바꾼다).
- 2026-10-22 결과: 공용 장소 경고 13 → 7(남은 것은 계단 그림이 남쪽 벽에 붙은 배치 5곳 + 학교 2층→3층 짝: 3층 내려가는 계단통이 막혀 짝을 못 옮김).
  방 견본 원 좌표 11건(예제 맵에서 자른 견본이 계단을 방 남쪽 끝에 둠) — 실제 조립은 furnish 가 막힌 자리를 피한다.
- 2026-10-22 후속: 공용 장소 경고 7 → 0. `scripts/content/stairs/move-shipped-stairs.mts --write` 가 남쪽 벽에 붙은 계단 그림 5곳
  (단독주택 2층 · 맨션 외복도 · 학교 3층 · 시계탑 · 부엉이 탑)을 한 줄 위로 옮기고(계단 칸만, 비운 줄은 그 방 바닥),
  `fit-bundled-places.mts --write` 가 층 이동·도착을 다시 맞췄다 — 학교 2층 오르는 계단은 이제 3층 내려가는 계단통 앞 (23,13) 에 내린다.
  마법 학교 두 곳은 정본 `tiledata/wizarding/spaces/*.json` 을 고치고 같은 층 값을 게시본(`public/…/wz-space-*.oprn.json`·`src/project/regionReferences/wz-space-*.json`·미리보기 PNG)에 옮겼다
  (`publish_places_wz.py` 는 지금 없는 템플릿 `interior-inn-tavern-1f.oprn.json` 을 읽어 멈춘다).
  남은 것: 일본 예제 JSON(`tiledata/jp-city/interior/examples/school-3f.json`·`mansion-corridor.json`)과 마법 학교 레시피(`space_recipes.py` 의 계단 `corner`·`access=False`)는
  옛 자리 그대로다 — 다시 지어 게시하면 조립기 검사(`stair-entrance-blocked`)가 먼저 막는다. 검사 ①(짝 방향)은 도착 칸에 가장 가까운 계단을 본다(나란한 두 계단에서 첫 계단을 잡던 것).
  출하 플레이어 걷기: `scripts/qa/runtime/stair-moved.scenario.mjs`(다섯 곳을 모은 픽스처, 6비트).
