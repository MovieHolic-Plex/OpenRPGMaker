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

## 조수 정책

`src/ai/modernTilesetPolicy.ts` 는 현대 맵 요청에 사용자 설치 PAW 업로드 칩셋만 허용한다. `modern_city` 는 번들 이미지(`tile.image.type !== "uploaded"`)라 승인 시트가 못 되어 조수가 이 타일셋으로 현대 맵을 깔면 `modernTilesetViolation` 이 거부한다. 사람이 칠하는 경로와 현대 문구가 없는 요청은 무관하다. 정책 수정은 후속 단계.

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
