# 현대 도시 · 도쿄풍 번들 타일셋 (modern_city)

modern-chipset 하네스가 합성한 도시(건물·도로·소품·차량)를 16px 칸으로 자른 번들 칩셋. 새 프로젝트가 처음부터 갖고, 기존 프로젝트는 로드할 때 심긴다.

## 식별자

| 항목 | 값 |
|---|---|
| 타일셋 id | `modern_city` |
| 텍스처 키 | `tex_modern_city` (id 는 `bundledEasyRpgTilesetId` 규칙 = 접두 `tex_` 제거와 같아 `bundledTilesetIdForAsset` 에 분기 없음) |
| 계열 | `oprn-modern` (라벨 "현대 도시(도트)", `src/project/tilesetFamily.ts`) |
| 이름 | 현대 도시 · 도쿄풍 (도트) |
| 조립 부품·참고문서 id 머리 | `mc-` (번들 소유) |

## 파일

- 정의 모듈 `src/project/defaults/modernCity.ts` — `createModernCityTileset`, `ensureModernCityTileset`, `ensureModernCityReferences`, `isModernCityTileset`.
- 시트 그림 `public/assets/modern-city/modern-city-chipset.png`, 시트 메타 `src/assets/modernCitySheet.json`(`count`, `tilesPerRow`), 정의 `src/assets/modernCityTileset.json` — 굽기 스크립트(`src/harnesses/modern-chipset/bake_tileset.py`)가 만든다.
- 참고문서 `src/assets/modernCityReferences.json` (`TilesetReferenceCategory[]`, 이미지 바이트 없음).
- 배선: `src/assets/bundled.ts`(항목·`bundledChipsetFrameCount`), `src/assets/bundledChipsetGeometry.ts`(열 수), `src/project/defaults/defaultAssets.ts`(`ensureBundledTilesets` 기존 사본 블록·`bundledEasyRpgTilesetBase`), `src/project/tilesetHarness/combinedTown.ts`(RM2k3 투명 칩 보정 제외), `test/bundledTilesetIdParity.test.ts`.

## 기존 프로젝트 갱신 규칙

칸 번호는 덧붙이기 전용이다(다시 구워도 앞 번호 불변, 새 칸은 끝). `ensureModernCityTileset`:

- 열 수가 같고 칸 수 <= 번들: 같은 시트의 옛 굽기 — 번들 소유 칸 표(`count`·`passability`·`priority`·`terrain`·`tileMeta`·`tileGroups`·`autotileGroups`·`animationStrips`)와 `mc-` 부품을 새 굽기로 바꾼다. 저자 부품(`mc-` 아님)·맵·저작 참고문서는 건드리지 않는다.
- 칸 수 > 번들(더 새 번들에서 저장): 줄이지 않는다.
- 열 수가 다름: 다른 시트로 보고 칸 표를 통째로 바꾼다.
- 변경 감지는 층·통행 요약과 표 길이로만 한다(키트 본문이 같은 개수로 바뀐 경우는 못 잡는다).

## 조수 정책 (2026-10-14, `src/ai/modernCityPolicy.ts`)

옛 PAW 전용 게이트(`modernTilesetPolicy.ts`)는 2026-10-07 저작권 정리로 지워졌다. 지금 길:

- **첫 승자 사슬 자리:** `plainTurn.ts` 의 시대 테마(전국→스팀펑크→SF→선사) → jp_city → 고딕 → 해적 → 하늘섬 → 캠퍼스 → **modern_city** → 버들항. 앞이 잡으면 보지 않는다. `routingAudit` 꼬리 「→ 도쿄풍 도시 맵 / 실내」, 노트는 `executionRoute.ts` 의 같은 순서 사슬(`formatModernCityNote`), 노출 도구 `MODERN_CITY_EXPOSED_TOOLS`.
- **잡는 경우는 셋뿐:** ① 대상(보는) 맵이 modern_city ② 칩셋 이름(`modern_city`·`oprn-modern`·「도쿄풍 도시 칩셋」) ③ 실내 요청이고 프로젝트가 modern_city 맵을 쓰면서 jp_city 맵은 안 쓸 때. 번들이라 모든 프로젝트에 있으므로 「현대 도시·번화가·편의점」 거리 낱말만으로는 잡지 않는다(jp_city 몫 — `jpCityPolicy` 는 보는 맵이 modern_city 면 거리 요청을 놓아 준다). 학교 낱말은 캠퍼스에 양보(`describesCampus`), SF·고딕 등은 사슬 앞에서 이긴다.
- 시스템 프롬프트 줄(`modernCityPromptLines`)은 범위에 modern_city 맵이 있을 때만 붙는다.
- 연기 시험: `npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/routing.mts`(사슬을 그대로 따라 11건).

## 거리 구성기 `compose_modern_city_street` (2026-10-14)

- 구성기 `src/project/modernCityStreetComposer.ts`(순수 함수), 도구 `src/editor/tools/modernCityTools.ts`. 맵 40×30~120×100, 권장 60×48.
- 계획: 가로 도로 1~3줄(높이/22)·세로 도로 1~2줄(폭 84 이상이면 2), 모두 12줄 단면 키트(`mc-street-ew-section`·`-ns-section`), 교차로 `mc-intersection-12x12`. 띠 높이 ≤11(남는 1~2줄은 첫 띠, 7줄 이상이면 맨 아래 남향 띠, 그 사이는 광장).
- 건물: 가로 도로 첫 보도 줄을 «문 앞 접근칸 줄»로 삼아 키트(`mc-bld-*`)를 남향으로, 접근칸은 키트 `ai.access`. 이웃 같은 종류 금지·종류당 2채, 꼭 넣을 종류(편의점·사무·병원·카페·은행·아파트·로비형) 먼저, 띠 높이에 가까운 건물을 더 자주. 문 접근칸 ±1·아래 한 줄은 소품 금지(`keep`). 건물 뒤 빈 띠는 잔디 + 관목·침엽수.
- 공원(블록 셋 이상일 때 둘째 띠 블록 하나): 잔디·벽돌 길·분수·벤치·공원 등·나무. 소품: 남쪽 보도 가로수·가로등 번갈아, 버스 정류장 하나, 북쪽 보도 둘째 줄 소화전·볼라드·화분, 세로 도로 보도 가로등·가로수, 교차로 남쪽 모서리 신호등, 지하철 입구 하나. 차: 가로 도로 차선마다 0~2대(교차로 2칸 안 금지, 북쪽 차선 동향).
- 도구는 시작 칸 → 모든 문 접근칸 도달·문 칸 막힘을 엔진 통행으로 다시 재고, 실패하면 맵을 안 바꾼다. 건물 이름표(`locations`, 태그 `modern-city-building`)에 문·접근칸·맞는 실내 방 구성(program)을 적는다.
- QA: `qa/compose-street.mts OUT.json [W H seed …]` → `qa/render_map.py OUT.json DIR`.

## 실내 (2026-10-14, `scripts/content/modern-city-int/`)

- 가구 64종·바닥 9·벽면 8·탁자 3·탁상 물건 7 — 코드 손 도트(`pieces.py`, `art_*.py`), object-gate 영수증(문 4종은 조립 방 `assembled.py`). 네 번 다시 그려도 못 넘은 14종은 `pieces.DROPPED`.
- 굽기 `bake_interior.py`(덧붙이기 전용, 시트 10179→10743칸, 칸 키 `tiledata/modern-city/pins.json`·소유 `interior/baked.json`) — `bake_tileset.py` 가 거리 굽기 끝에서 다시 부른다. 방 짓기 사양 `src/assets/modernCityRoomSpec.json`(`HAND_INTERIOR_SPECS.modern_city`), 방 구성 9개는 `extract.mts` 가 `interiorRoomTemplates.json` 에 넣는다(방 종류 14).
- 예제 9장 `examples.py --render` → `tiledata/modern-city/interior/examples/*.json`. 실내 60칸 넘는 한 방은 기둥·알코브로 꺾었다(ㅁ자 경고 0). `layout.ts` 의 `DOOR_OF` 에 병동·대기 복도(병원 문)·뒷방(철문)·회의실(유리문) 한 줄.
- 엔진 검사 `qa/check-rooms.mts`(평면·program 두 경로 18장, 엔진 BFS) · 변조 `qa/tamper.mts`(6종 코드+좌표) · 참고문서 `refs_interior.py` → 용도 `mc-interior`(문서 10·그림 20, `public/assets/modern-city-interior-references/`). `bake_refs.py` 가 끝에서 저장본(`tiledata/modern-city/interior/refs/category.json`)을 다시 붙인다.
- 문 이음 `link_modern_city_interior`(거리 문 ↔ 실내 출입구 틈 왕복, 막힌 문 칸에는 이벤트 없음).

## 예제 도시 맵 (60×60, 시드 1)

- 굽기: `python3 src/harnesses/modern-chipset/bake_map.py [--seed 1] [--publish]`. `compose_town.build()`의 합성 결과(건물 23·소품 257·차량)를 **키트 id + 원점**으로 바꿔 4층에 찍는다(땅 1층 · 도로 표시와 접지 그림자 2층 · 키트 3층 · 겹침 4층). compose_town·`town_lib.py` 는 고치지 않고, 굽는 동안 런타임 후킹(`ExactBuildings`)으로 시트에 구워진 벽/지붕 조합만 쓰게 한다(안 하면 건물 약 19/23 이 이름이 가까운 다른 키트로 대체된다 — 시트에 벽×지붕 조합이 없다).
- 산출: `tiledata/modern-city/map/modern-city-<seed>{,-plan,-report,-reach}.json`, `verify-shots/modern-city/{map,map-x2,ref,diff,reach}-<seed>.png`. `-plan.json` = 시작 위치·도로 격자·문 접근 칸·배치 목록(키트 id·원점·찍은 순서). 건물은 키트 그림과 화소 일치 23/23.
- 그림 비교(맵을 시트 칸만으로 다시 그림 vs 원본 합성, 사람·전선 뺌): 전체 화소 16.0% 다름 — 건물 칸 0.23% · 안 놓인 칸 2.3% · 소품 칸 42% · 차량 칸 54%. 소품·차량은 16px 칸에 앉히며 최대 8px 이동했고(건물은 처음부터 칸 정렬) 차 색 일부는 시트에 구워진 색으로 바뀌었다. 연석 주차 표시(ㄴ자 틱)는 칸이 없어 뺐다.
- 도달성: 시작 (20,12)에서 문 앞 접근 칸 54곳(중복 1칸 포함 55) 전부 닿는다 — python BFS(`collision.ts` 규칙 이식)와 `npx vite-node tiledata/modern-city/map/check-reach.mts 1`(저장소 `canMove`)이 같은 답(걸을 수 있는 1800칸 중 1760칸 도달, 나머지 40칸은 좌상단 공사 펜스 안쪽). 접근 칸을 막은 소품 5개는 한 칸 옮기고 2개는 뺐다.

## 참고문서 (번들 소유, AI-REFERENCE-CONTRACT 8항)

- 굽기: `python3 src/harnesses/modern-chipset/bake_refs.py` (bake_tileset → bake_map 다음). 출력 `src/assets/modernCityReferences.json`(6분류·49문서·33그림, 이미지 바이트 없음 — 경로만), `public/assets/modern-city-references/*.png`(긴 변 ≤820px·128색), `tiledata/modern-city/refs/*.md`(문서 사본)·`check-evidence.json`.
- 분류: `mc-start`(읽는 순서·층과 통행·실행 순서, 땅/표시/그림자 칸 사전) · `mc-assemble`(도로·건물·소품 조립 정답) · `mc-buildings`(건물 키트 32계열 문서) · `mc-props`(소품·차량 키트 사전) · `mc-example`(예제 도시 입력·배치 목록·네 층 전체 배열·그림) · `mc-errors`(자동 검사 범위·오류 코드·변조 7종·층 표기 전후).
- 문서의 키트 id·칸 번호·좌표는 전부 정의 JSON·키트 색인·예제 맵에서 읽은 값이다. 쓰기 전에 문서를 다시 파싱해 정의에 없는 키트 id·범위 밖 번호·키트 배열 불일치·층 배열과 맵의 불일치가 있으면 실패한다.
- 층 대조: `npx vite-node tiledata/modern-city/refs/layer-audit.mts` — tileMeta 의 passage/defaultLayer 와 엔진(`tileLayerPolicy`·`passabilityOf`·`mapUpperTileDepth`)을 9997칸 대조, 어긋남 0. 홈 레이어(위층 슬롯)·통행·그림 순서·투명 여부는 별개다(도로 표시·그림자는 홈 `upper`·통행 가능·캐릭터 아래, 예제는 2층에 둔다).
- 번들 소유 확인: `npx vite-node tiledata/modern-city/refs/verify-bundle.mts`(타일셋 정의가 문서를 들고 태어남·`ensureModernCityReferences` 가 빈 프로젝트를 채움·장소 스냅샷 4층이 예제 맵과 같음·그림 파일 존재).
- 알려진 한계: 시트에 벽×지붕 조합·T자/곡선/4차선 도로·연석 주차 틱 칸이 없다. 보도·연석 오토타일(`mc-sidewalk-curb`)은 공원·생울타리·횡단보도 이웃도 도로로 보고 연석을 세운다(공원 둘레는 낱칸). `readRegionReference` 는 1·3층만 돌려주므로 2·4층은 문서 `mc-example-layer*` 로 본다.

## 자동 검사 (구조·통행만)

- `python3 src/harnesses/modern-chipset/bake_map.py --check <맵.json>`(옆의 `-plan.json` 필요). 코드 12종: tile-out-of-range · layer-mismatch · building-in-lower-layer · overlay-in-base-layer · ground-in-object-layer · door-access-blocked · door-not-on-sidewalk · building-on-nonwalk · back-over-front · marking-in-intersection · tall-prop-on-road · curb-mismatch. 굽기는 같은 검사에서 오류가 하나라도 있으면 파일을 아무것도 쓰지 않는다.
- 보지 않는 것: 이벤트 실행·움직이는 차·행인·미적 품질·낮은 모델의 성공률. 변조 7종(실제 변조해 코드와 좌표를 검출)은 `tiledata/modern-city/refs/check-evidence.json`.

## 번들 장소

- 장소 id `modern-city-60x60`, 맵 id `modern-city-example`. `bake_map.py --publish`가 `public/assets/region-references/modern-city.{oprn.json,png}`, `src/project/regionReferences/modern-city.json`(스냅샷), `src/project/modernCityPlaceReferences.ts` 를 쓴다. 등록은 TS 두 군데: `regionReferences.ts`(import·`PLACE_REFERENCES` 펼침)·`regionReferenceSnapshots.ts`(`SNAPSHOT_FILES` 한 줄). 내려받기 `.oprn.json` 은 약 6.3MB(타일셋 메타 포함, 이미지 바이트 없음).

## 승인된 작은 지하 주차장 (2026-10-05)

`mc-parking-two-bays`는 14×7칸 고정 구역이다. 아래층 환경과 위층 차량을 함께 찍어야 한다.
`mc-parking` 참고문서에 전체 두 층 배열·칸 좌표·정상/오류 비교를 동봉했다.
등록 입구는 `modern-chipset publish-parking`, 정본 생성은 `save-parking-project`다.
6회차 선택 그림의 7필수조건/9축 PASS를 보존하며, 공용 칸은 9,998→10,037로 39개만 덧붙였다.
기존 칸 번호·화소 변경 0, 576키트 재조립 불일치 0. 기존 프로젝트에도 `ensureModernCityTileset`과
`ensureModernCityReferences`로 키트/학습 자료가 들어간다. 전체 시설은 이 고정 구역을 반복해서 만들지 않는다.

그룹의 lower/upper/mixed 설명 정정도 같은 칸 수의 기존 프로젝트에 전달되도록
번들 갱신 서명에 그룹 id·defaultLayer·layerHome을 포함한다. 주차장 정본에서 실제로
lower→mixed 갱신을 저장·재로드했다. 개별 칸의 통행/우선순위와 맵 배열은 바뀌지 않는다.

### 12면 확장 실험

같은 승인 칩으로 416×288px(두 면 표본의 4.78배), 두 차로/연결로/12면/차량6대를 조립했다.
공용 `mc-parking`에 전체 배열·조립 규칙·실험 이미지·누락 소재를 추가했다. 독립 시각 판정은
조립 PASS, 시설 INCOMPLETE다. 새 기둥·천장 조명·벽/출입부 키트가 갖춰지기 전에는 이 그림을 완성 시설의 근거로 쓰지 않는다.
