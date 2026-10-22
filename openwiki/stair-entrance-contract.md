# 계단 입구 계약 · 검사 (2026-10-22)

계단·사다리·에스컬레이터·바닥 구멍 키트에 「어느 칸으로 들어서는가」를 데이터로 붙였다. 전에는 설명에 무엇인지만 있어
조수·방 조립기·데모 빌더가 계단을 남쪽 벽에 붙이거나, 앞 칸을 가구로 막거나, 오르는 계단으로 지하에 가게 놓았다
(첫사랑 사무층: 옥상으로 가는 길에 내려가는 계단통).

## 계약 — 정본 `src/assets/stairContracts.json`
- 생성: `npx --no-install tsx scripts/content/stairs/build-stair-contracts.mts [--dump out.json]`. 키트 106개(번들 칩셋 + 몬스터·에메랄드), 사양 물건 47개.
  고르는 규칙(INCLUDE/EXCLUDE 정규식)과 유도: 1×1 밟는 칸은 side any, 그 밖은 맨 아래 밟는 줄 = 이동 칸, 그 아래 = 앞 칸(남쪽), 맨 아래 줄이 막혔으면 bump.
- 사람 확인: `tiledata/stairs/overrides.json` — 4배 그림을 보고 키트마다 확인(`{}`) 또는 고침(`why` 필수). `drop` 은 계단이 아닌 것. 에메랄드 사본은 `monster_*` 고침을 물려받는다.
- 설명 규칙(2026-10-22): 계단 키트의 이름·설명·계약 `note` 는 «올라가는 계단/내려가는 계단 · 들어서는 쪽 · 오를 때 보는 쪽 · 도착 자리»를 글로 적는다. 같은 맵 안의 육교·옆 계단은 `leads: same` + `exit`(위 끝).
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

## 칩셋별 — atlas_biome_interior(손 도트 실내 v5) 계단 다시 그림 (2026-10-22)
사용자 「계단들이 다 씹창 … 내려가는 방향·올라가는 방향을 description 에 확실히」. 그림 `scripts/content/hand-interior/stairs/draw.py`, 굽기 `rebake.py`(같은 칸 번호 위에 덮음 — 새 칸·번호 이동·정의 변경 없음, 키트 밖 칸이 바뀌면 멈춤, 팔레트 v6 밖 색이면 멈춤, object-gate 상태가 통과가 아니면 옛 그림 유지).
- **올라가는 계단**(`stairs up stone`·`stairs up wood`, 3칸 폭, 바닥 줄 + 벽면 두 줄): 맨 위에 윗면 2줄·밝은 앞 모서리·처마 그림자가 있는 갓돌(돌)·인방(나무)이 키트 폭 전체를 덮고, 그 밑 어두운 구멍(위층 계단이 희미하게 이어진다) 아래로 디딤판(밝은 코가 앞 모서리) 위·챌판(짙은 2줄) 아래가 번갈아 놓인다. 디딤판은 5→2줄로 짧아지고 위 두 단은 1px·2px 안으로 들어가 멀어지는 비행을 보인다(원근 사다리꼴은 아님). 위로 갈수록 어둡다. 돌 볼은 바닥 줄까지 쌓기 줄눈을 이어 받침처럼 떠 보이지 않게 한다.
- **내려가는 계단**(`stairs down` 2×2 돌, `stairwell down` 3×2 나무): 바닥에 뚫린 구멍. 첫 디딤판이 키트 남쪽 끝까지 내려와 방 바닥과 같은 높이로 맞닿는다(남쪽 턱·띠를 그리면 상자·화덕·벤치로 읽혀 r10·r16 major). 챌판은 북쪽을 봐 안 보이고 디딤판 윗면만 — 남쪽 첫 판이 가장 밝고(나무는 바닥보다 밝아야 2층 짙은 마루에서 구멍으로 읽힌다, r12 major) 북쪽으로 한 단씩 어둡고 짧아지며, 판 사이는 1px 그림자 줄, 옆 구덩이 벽이 한 단마다 1px 넓어지고, 북쪽 끝은 검다. 북쪽 바닥 턱 3줄 위 낮은 난간(돌: 얇은 회색 갓 + 1px 난간동자, 사이로 바닥이 비친다 — 밝은 갓은 「낮은 벽·카운터」로 읽혀 r15 major), 서·동 난간에 기둥 점.
- **3/4 관문 화풍 규칙에 맞춘 것:** 무채색 근흑 윤곽은 화풍 FAIL(윤곽 = 재질의 어두운 톤) → 돌 그림의 실루엣 둘레 근흑을 팔레트 v6 의 푸른 슬레이트로 바꾼다(`tint_edges`). 5×5 같은 색 평면도 FAIL → 디딤판·볼에 결 점. 인방·갓돌이 앞면만 있으면 3/4 FAIL(「beam drawn only as a vertical face」) → 윗면 2줄 + 앞 모서리 + 그림자. 올라가는 계단은 `structure`(화풍 비교는 `prop`), 내려가는 계단은 `flat`.
- 검수 경로: Opus 적대 VQA 17판(`harness-data/object-gate/vqa/abi-stairs-v5.opus-vqa-r*.json`, r13 은 관문 수정 전 그림이라 무효, 최종 r17 major 0) → object-gate 묶음 `abi-stairs-v5`(올라가는 둘·돌 구멍 provisional PASS, 나무 계단통 REFER — 면제 종류 판정 2/4) → 사용자 위임 허용 4장(`by: delegated`, 근거 r17) → `rebake.py`.
- 다시 그리지 않은 것: `spiral stair`(절차 나선은 16px 에서 「기둥에 지느러미」로 읽혀 세 판 실패 — 옛 그림 유지, 설명만 고침), `ship ladder`·`trapdoor`(위·아래가 이미 분명).
- 설명: 키트 이름·`ai.description`(atlasBiomeInteriorTileset.json)·사양 `ko`·`desc`(handInteriorSpec.json)·overrides `why` 에 올라가는/내려가는 계단, 들어서는 쪽(남쪽 앞 칸), 오를 때·내려갈 때 보는 방향(북쪽), 도착(다른 층 짝 계단의 남쪽 앞 칸, 계단을 등지고 남쪽)을 적었다. 참고문서 사전 행에 계약 `note` 를 싣는다.
- 예제 맵: 저택 2층 계단통 이동 이벤트가 위 줄(y 3)에, 1층에서 오는 도착이 계단통 칸 (12,4) 위였다 → 이동 칸 y 4, 도착 (12,5)(`build_tileset.py` 링크 규칙과 `v5-maps/maps.json` 둘 다).
- 출하 플레이어 걷기: `scripts/qa/runtime/v5-stairs.scenario.mjs`(픽스처 `v5-stairs-fixture.mts` — 저택 1·2층, 지하 감옥 ↔ 돌 바닥 구멍 계단 시험 맵).

## jp_city 실내 계단 다시 그리기 (2026-10-22)
사용자: 「계단을 보고 다시 그려라. 내려가는 방향·올라가는 방향을 description 에 확실히 넣어서 잡아라.」
- 그림 13종(`jp-in-stairs-up-wood`·`-wide`·`stairwell-down-wood`·`sc-*`·`mc-*`·`of-*`·`as-*`·`cs-*`)은 공용 모듈
  `scripts/content/jp-city/interior/stairart.py` 하나에서 그린다. 블록(`interior_entry`·`interior_school`·`interior_post`·`interior_office`·
  `dungeon_school`·`dungeon_construction`)은 재질만 고르고 덧칠(녹·잔해·라바콘)만 얹는다.
  - **올라가는 계단:** 단마다 넓고 밝은 디딤판 윗면(결·뒤쪽 그늘 한 줄) + 1px 코 + 1px 더 어두운 챌판 + 그늘 한 줄. 디딤판이 챌판보다 훨씬 넓어야
    「정면 입면」이 아니라 윗면이 보이는 3/4 로 읽힌다. 먼 단일수록 낮고 어둡고 맨 위는 위층 바닥 밑 어둠. 옆판은 원근 톱니(코 줄은 밝게, 챌판 줄은 어둡게).
    벽 쪽 옆판·트인 쪽 난간(1칸 폭은 가는 손잡이)·아래 기둥. 공사장(cs)은 난간 대신 양쪽 콘크리트 옆벽.
  - **내려가는 계단통:** 바닥 2×2 구멍. 디딤판 윗면 일곱 단(2·2·3·3·3·4·5px, 남쪽일수록 크다)이 북벽 바로 밑까지 차고 북쪽 근흑은 2px 뿐이다.
    값은 남쪽(바닥 값) → 북쪽(근흑)으로 단마다 내려가고, 안쪽 구덩이 벽이 북쪽으로 넓어진다(나무 1→5px, 회색 1→3px). 회색 단의 낙차 줄은 두 단만 어둡게
    — 검은 줄 = 그릴 살·오븐·라디에이터(VQA r23~r29 다수). 큰 검은 판 위 줄무늬 몇 개도 같은 오독. 나무는 같은 짜임에 따뜻한 갈색 램프.
    구멍 옆 가장자리는 1px 어두운 절단선(나무는 바깥에 판자 밝은 결 1px 더), 남쪽 입구는 투명(방 바닥이 이어진다). 난간은 가는 손잡이 1px + 그늘 1px +
    4px 간격 동자(굵은 머리대 = 히터 앞판). 회색 옆 손잡이는 중간 쇠색의 납작한 띠(밝은 세로줄 둘 = 가전 틀), 나무 옆 기둥은 남쪽 끝보다 앞에서 끝난다.
  - **공사장 오르는 계단(cs):** 단 다섯(10·9·7·6·5px), 챌판 두 줄(중간·어둠), 서쪽 벽 = 빛 받는 윗면, 동쪽 벽 = 그늘 + 디딤판에 그늘 1px.
    고른 얇은 줄 + 같은 밝은 기둥 둘 = 셔터(VQA r26·r28).
- 이름·설명은 모두 「올라가는/내려가는」을 앞에 두고, 설명 끝에 들어서는 쪽(남쪽 앞 칸)·오를/내려갈 때 보는 방향(북쪽)·도착(짝 계단 남쪽 앞 칸, 남쪽을 보고 선다)을 적는다.
  같은 문장이 `tiledata/stairs/overrides.json` 의 `why` 로 계약·참고문서에 들어간다.
- **벽면 파고듦 수정:** 계단통은 바닥 세 줄(구멍·밟는 줄·앞 칸)이 필요한데 단독주택 2층·맨션 외복도·학교 3층 복도는 두 줄이라 #3256 이 계단통을 벽면으로 한 줄 올렸었다.
  `scripts/content/stairs/widen-jp-stair-corridors.mts --write` 가 세 복도에 바닥 한 줄을 더하고 계단통을 첫 바닥 줄로 내린다(이벤트·이동·시작 위치도 한 줄 내림, 두 번 돌려도 같다).
  이어 `fit-bundled-places.mts --write`. 예제 JSON(`mansion-corridor`·`school-3f`·`school-2f`·`mansion-lobby`)도 같이 고쳤다. `lint-bundled-stairs` 공용 장소 경고 0.
- 출하 플레이어 걷기: `scripts/qa/runtime/jp-stairs-redraw.scenario.mjs`(단독주택 2F↔1F · 맨션 외복도↔로비 · 학교 2F↔3F).
- 검수: Opus 적대 VQA 영수증 `harness-data/object-gate/vqa/jp-in-stairs-13.opus-vqa-r*.json`, object-gate 묶음 `jp-in-stairs-13`.

## 마법 학교(wizarding_world) 계단 다시 그림 (2026-10-22)
사용자 「계단들이 다 씹창」 → 여섯 키트를 공용 도우미 `scripts/content/wizarding/pieces/_wz_stairs.py` 두 형태로 다시 그렸다.
- **올라가는 계단 2×3**(`wz-castle-stair-up` 돌 첨두 아치 · `wz-clock-stair` 리벳 무쇠 틀 · `wz-hd-stairs-down` 돌 아치 · `wz-owl-stair-up` 나무 틀, walk SS/FF/ff):
  북벽에 붙인다. 위 두 줄이 북벽 정면 자리의 문틀이고, 디딤판(윗면 + 밝은 앞 모서리) · 챌판이 북쪽으로 올라가 위층 빛 속으로 사라진다.
  들어서는 쪽 남쪽(맨 아래 줄 바로 남쪽 앞 칸) · 오를 때 북쪽을 본다 · 도착은 위층 내려가는 계단통의 남쪽 앞 칸, 계단을 등지고 남쪽.
  방 가운데 홀로 선 계단은 「어디로 가는지 모르는 단상」으로 읽혀(적대 검수 r1·r2) 북벽 문틀형으로 바꿨다.
- **내려가는 계단통 2×2**(`wz-castle-stair-down` 돌 난간 · `wz-owl-stair-down` 나무 난간, walk ff/ff): 바닥 구멍. 턱 없이 방 바닥이 구멍 끝까지 오고,
  북·서·동에 위에서 본 얇은 손잡이(기둥 없음), 남쪽만 열림. 안은 민 어둠의 북쪽 안벽과 디딤판 다섯 단(밝은 코, 북쪽으로 갈수록 어둡다).
  벽돌 줄눈·기울인 옆벽·솟은 기둥·밝은 둘레 턱은 「아궁이·문틀」로 읽혀 뺐다(적대 검수 r6~r10).
  들어서는 쪽 남쪽 · 내려갈 때 북쪽을 본다 · 도착은 아래층 올라가는 계단 맨 아래 줄의 남쪽 앞 칸, 계단을 등지고 남쪽.
- `wz-hd-stairs-down` 은 id 의 down 이 옛 이름이고 **올라가는** 계단(지하 창고 → 위층 가게)이다 — 이름표·설명·계약(`leads: up`) 모두 「올라가는」.
- 계약 문장(`overrides.json` 의 `why`)에 들어서는 쪽·보는 방향·도착을 적었고, `prepare_stair_references.py` 가 키트 행에 `note`(계약 문장)를 함께 싣는다(모든 칩셋).
- 출하 장소: 시계탑 기어실 계단을 방 서쪽 (1,11) → 북벽 (1,2)(그 자리 벽걸이 공구판 하나 뗌), 부엉이 탑 (1,8) 은 올라가는 계단 → **내려가는 계단통**(탑 꼭대기 방),
  허니듀크 지하 (13,2) 는 그대로. 다시 찍기 `scripts/content/stairs/restamp-wz-stairs.py --write`. 조립기는 계단 키트를 깔개(전부 f 칸)로 보지 않는다(`builder.ts` flatOnly).
- 출하 플레이어 걷기: `scripts/qa/runtime/wz-stairs.scenario.mjs`.
