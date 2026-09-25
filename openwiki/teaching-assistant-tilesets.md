# 조수에게 타일셋 까는 법 가르치기

> 2026-09-24 조사. 새 타일셋(번들이든 사용자 업로드든)을 **에디터 AI 조수가 제대로 깔게** 하려면
> 무엇을 넣어야 하는지 정리한 입구 문서다. 참고문서 저장·읽기 계약의 세부는
> [tileset-reference-documents.md](tileset-reference-documents.md), 레이어 판정은
> [tile-layer-policy.md](tile-layer-policy.md), 칸 크기·격자는 [tile-geometry.md](tile-geometry.md).

## 한 줄 요약

**조수는 타일셋 그림을 보지 않는다. 타일셋에 붙은 글(참고문서·칸 이름표·묶음)과 도구가 돌려주는 값만 보고 깐다.**
그래서 새 타일셋을 조수에게 가르치는 일은 곧 「글과 번호로 된 지식을 타일셋 정의에 붙이는 일」이다.
그림만 넣고 끝내면 조수는 뜻 모르는 번호를 칠한다.

## 조수가 실제로 받는 것

조수 채팅의 실행 경로는 Pi 다(`aiChatPanel` → `runPiTurn` → Bun 워커 → `runPiAgent`).
시스템 프롬프트는 `src/ai/piAgent/systemPrompt.ts` `buildPiAgentSystemPrompt` 이고
(`scripts/lib/piAgentRuntime.ts` 가 요청에 `systemPrompt` 가 없을 때 부른다), 여기에 들어가는 타일셋 정보는 이것뿐이다.

| 들어가는 것 | 위치 |
|---|---|
| 대상 맵의 id·이름·크기 (타일셋 id·칸 크기는 **없음**) | `systemPrompt.ts:16`, `:32` |
| 새 야외·마을의 기본 칩셋 이름, 「기존 맵 칩셋은 유지」 | `systemPrompt.ts:43` |
| 「타일 배치 전 참고문서를 조회·정독하라」 한 줄 | `systemPrompt.ts:47` |
| 대상 타일셋이 네 층 타일셋일 때만 「MZ 네 층 + 그림자 … stamp_layer_block」 한 줄 | `systemPrompt.ts` `fourLayerTilesetLines` (아래 「네 층 타일셋 가르치기」) |

칸 번호의 뜻, tileMeta, tileGroups, 팔레트, 참고문서 본문, 아틀라스 그림, 맵 스크린숏은 **처음부터 주지 않는다.**
옛 세션 경로의 `src/ai/contextBuilder.ts`(프리셋·승인 묶음·사용자 설명 요약)는 Pi 경로에서 쓰이지 않는다.
나머지는 전부 조수가 **도구를 불러서** 알아낸다.

| 도구 | 조수가 얻는 것 | 비고 |
|---|---|---|
| `list_tileset_references` → `read_tileset_reference` | 용도별 MD 전 페이지 + 첨부 그림(실제 이미지 입력) | 도구 목록을 줄여도 항상 노출(`piAgentRuntime.ts`) |
| `tile_query`, `get_tile_info` | 칸 이름표·설명·배치 규칙 | 비어 있으면 `Tile N` / "No tile meaning has been recorded yet." (`tilesetSemanticChecker.ts:111`) |
| 재료 이름 도구 `build_wall`·`build_roof`·`fill_region`·`lay_path`·`place_props` 등 | 「흰 집 벽」 같은 **이름표 문자열**로 묶음을 찾아 전개 | `resolveMaterialByLabel`(`src/project/tileVocabulary.ts:361`) — 이름표가 없으면 재료를 못 찾는다 |
| `paint_tiles`, `paint_road`, `stamp_structure` | **번호 직접 입력** | 뜻을 모르면 추측 번호가 된다 |
| `stamp_tile_recipe`, `inspect_tile_recipe` | 조립법(두 레이어 배열·접근칸) 원형 배치 | **forest_harmony 전용** — `publicRecipe` 가 `compileForestRecipe` 로 숲마을 아틀라스를 강제(`publicTileRecipes.ts:11`) |
| `show_map_region` | 이미 칠한 **맵** 그림 (+ 맵에 있으면 2층·4층·그림자 배열) | Pi 에서 모델이 보는 유일한 렌더 그림. 타일셋 자체 그림은 아니다 |
| `stamp_layer_block`, `paint_shadow` | 네 층 배열 찍기·그림자 | 칠하기 게이트 안(`TILESET_REFERENCE_TILE_CHOOSERS`) |
| `show_tiles`, `show_tile_grid` | 모델에겐 **JSON 텍스트만** | 그림은 채팅 창의 사람에게만 그려진다 |
| `find_similar_tiles` | 시트 위치·메타 점수 | 그림 비교가 아니다 |

### 참고문서 읽기 게이트

칠하기 도구(`TILESET_REFERENCE_TILE_CHOOSERS`: paint_tiles·fill_region·build_wall·place_door·place_window·build_roof·
lay_path·place_props·arrange_rows·paint_road·stamp_structure·build_house·stamp_forest_recipe·stamp_tile_recipe,
`src/editor/tools/tilesetReferenceTools.ts:24`)는 그 타일셋에 참고문서가 있으면 **전부 읽기 전에는 거부**된다.
참고문서가 **없으면 게이트가 아예 걸리지 않는다**(`src/ai/tilesetReferenceEvidence.ts:74` `if (!groups.length) continue;`).
즉 참고문서 없는 타일셋에서 조수는 아무 제약 없이 번호를 칠한다. 게이트는 「전달」만 확인하고 이해·품질은 보장하지 않는다.

## 타일셋 종류별로 조수가 아는 정도

| | 번들 타일셋(forest_harmony·성·Slates 등) | 사용자 업로드 커스텀 |
|---|---|---|
| 칸 이름표(tileMeta) | 테마 팩·시맨틱 표가 채운다 | **없음** — `themePackForTileset` 이 번들 이미지만 받는다(`themePacks.ts:396`) |
| 묶음(tileGroups)·재료 도구 | 작동 | 이름표가 없어 재료를 못 찾는다 |
| 참고문서 | 번들이 들고 태어난다(`ensure*References`) | **0개** → 게이트 없음 |
| `generate_map` | 전용 프로필 | 「전용 맵 생성 로직이 아직 없습니다」로 실패(`mapGenerationProfiles.ts:166`) |
| 문법 프로필 | 타일셋별 | 없으면 RM2k 문법 `RM_TYPE_GRAMMAR_PROFILE` 로 떨어진다(`grammarProfiles.ts:105`) |
| 조립법 도구 | forest_harmony 만 | 사용 불가 |

업로드 경로 `makeTilesetFromUpload`(`src/editor/panels/resourceManager.ts:81`)는 칸 수만 계산하고
전부 통행 가능·하위 레이어·지형 0 으로 만든다. 메타는 아무것도 유도하지 않는다.

## 가르치는 수단 — 효과 큰 순

1. **참고문서(`referenceDocuments`) — 제일 먼저.** 붙이는 순간 게이트가 걸려 조수가 반드시 읽는다.
   용도(카테고리)를 작업 단위로 나눈다(예: 「도시 거리」「건물 외관」「병원」「사무실」).
   한 용도에 들어갈 것은 [AI-REFERENCE-CONTRACT](../tiledata/AI-REFERENCE-CONTRACT.md) 가 정한다 — 요점:
   - 0기준 칸 번호 사전(다른 칩셋 번호 섞지 않기), 칸 크기, 하위/상위 배열
   - 부품별 조립 순서·반복식·모서리 방향·최소 크기·금지 조건 (「적절히」로 끝내지 않기)
   - **완성 예제 = 두 레이어 번호 배열 + 원본 해상도 그림.** 조수는 예시를 따라 할 때 가장 잘 깐다
     (조각 조립 실험: 예시 기반 13/13 vs 규칙 생성 3/13).
   - 정상/오류 나란한 그림(잘린 뿌리·잘못된 레이어·막힌 입구)
   - 그림은 한 장에 담긴 칸이 조수가 읽을 수 있는 해상도여야 한다. 아틀라스 통째(수천 칸)는 소용없다.
2. **칸 이름표·묶음(`tileMeta`·`tileGroups`).** 「차도」「인도」「병원 타일 바닥」「회색 칸막이 벽」처럼
   사람 말 이름을 붙이면 재료 이름 도구와 `tile_query` 가 살아난다. 이어지는 바닥·길은 `autotileGroups`
   (8비트 이웃 마스크 → 칸 번호)로 묶어야 대충 칠해도 이음새가 맞는다.
3. **실행형 조립법.** 두 레이어 배열·역할·접근칸을 가진 조립법이면 조수가 원형 그대로 찍고 도구가 검사한다.
   지금은 forest_harmony 전용(`publicTileRecipes.ts`)이라, 다른 타일셋에 쓰려면 조립법 카탈로그를 타일셋별로
   받도록 도구를 넓혀야 한다. 성채·숲 마감의 `get_tile_assembly_part`/`validate_tile_assembly`
   (`src/project/tileAssemblyGuide.ts`)도 같은 방향의 선례다.
4. **결정론 파이프라인·프로필.** `author_village`·`generate_map`·실내 방 하네스처럼 코드가 칸을 고르는 경로.
   품질은 가장 안정적이지만 타일셋마다 전용 코드가 필요하다. 1~3 이 갖춰진 다음 단계다.

## 새 타일셋을 넣을 때 점검표

- [ ] 참고문서 용도 ≥1개, 각 용도에 번호 사전 + 조립 규칙 + 완성 예제(배열+그림) + 오류 예
- [ ] 자주 쓰는 칸에 tileMeta 이름표, 재료 단위 tileGroups, 이어지는 바닥·길은 autotileGroups
- [ ] 통행(passability)·홈 레이어(priority)를 픽셀·용도에서 유도해 검토 — 전부 lower/통행 기본값으로 두지 않는다
- [ ] 16px 전용 자동 보정에서 빠지는지 확인(아래 함정)
- [ ] 번들이면 AGENTS 「새 타일·타일 학습은 공용에 추가한다」 절대로 `tiledata/tilesets/<id>/` + `prepare-*-references` + `ensureBundledTilesets` 배선
- [ ] 조수에게 실제로 시켜 보고(`bun scripts/pi-agent.mts ... --task`) 결과 맵을 기준 그림과 나란히 비교

## 재배포 금지 서드파티 팩 (예: Rasak Modern)

itch.io 의 [Rasak Modern](https://rasak.itch.io/rasak-modern)처럼 「사용·수정은 되지만 재배포 금지, 링크만 허용」인 팩은
위 hard rule 대로 번들에 그림을 넣을 수 **없다.** 이때 방향:

- 저장소에는 **그림 없이** 번호·이름표·조립 규칙·예시 번호 배열만 둔다.
- 사용자가 원본을 올리면 파일명·해시로 판본을 알아보고, 에디터가 원본에서 아틀라스를 **결정적으로** 구워
  칸 번호를 고정한다(판본이 다르면 번호가 어긋나므로 해시로 막는다). 참고문서의 그림도 이때 사용자 원본에서 잘라 만든다.
- RPG Maker MV/MZ 48px 팩은 에디터가 A1~A4 오토타일 규격을 해석하지 못한다(`TilesetKind` 는 rpg2k|custom).
  굽는 단계에서 오토타일 형태를 전부 평타일로 펼쳐야 한다. 2026-09-24 실측: rpg_core 쿼터 표로 펼친 아틀라스로
  제작자 프리뷰 5장을 칸 단위로 역재구성해 픽셀 일치 98.0~99.98% 를 냈다(작업물은 저장소 밖).
- 한 칸 세 겹 이상(바닥+장식+소품+그림자)은 이제 MZ식 네 층 + 그림자로 싣는다(PR ① #1447, 설계
  `docs/superpowers/specs/2026-09-24-mz-four-layer-design.md`). 합성 칸을 따로 굽지 않는다. 조수에게 가르치는 법은
  아래 「네 층 타일셋 가르치기」. (옛 `tileStackAt` 스택 경로는 여전히 비활성 — `src/project/mapOverlayTiles.ts`.)

## 네 층 타일셋 가르치기

> 2026-09-25, 계획 `docs/superpowers/plans/2026-09-25-mz-layers-assistant.md`. RPG Maker MZ 식 팩(Rasak Fantasy 48px)처럼
> 한 칸에 바닥·바닥 장식·물체·물체 위 물체·그림자가 겹치는 타일셋. 층 번호와 맵 칸의 대응은 [tile-layer-policy.md](tile-layer-policy.md)
> 「층 번호 ↔ 맵 칸 ↔ 도구 인자」 표.

### 조수가 지금 받는 것

| 무엇 | 어디 | 내용 |
|---|---|---|
| 층 인자 | `paint_tiles`·`fill_region` `layer`, `tile_erase` `layer` | 문자열 enum `"lower"\|"upper"\|"1"\|"2"\|"3"\|"4"`(lower=1, upper=3). `tile_erase` 는 `both`·`all`·`shadow` 도. Gemini 때문에 정수 enum 은 쓰지 않는다 |
| 한 번에 여러 층 찍기 | `stamp_layer_block {mapId,x,y,layers:{"1"?,"2"?,"3"?,"4"?,shadow?}, reshape?}` | 층별 2차원 배열. -1 건드리지 않음, -2 비움. 번호가 범위 밖이거나 맵 밖 칸이면 호출 전체 거부(부분 쓰기 없음). 1·2층 자동타일 멤버는 찍은 뒤 이웃에 맞춰 다시 모양을 잡는다(`reshape:false` 면 그대로) |
| 그림자 | `paint_shadow {mapId,cells:[{x,y,quarters?,bits?}],mode?}` | 사분면 tl=1 tr=2 bl=4 br=8 |
| 층 뜻 한 문장 | `FOUR_LAYER_GUIDANCE`(`src/editor/tools/mapHelpers.ts`) — 층 인자를 받는 도구 설명이 모두 같은 문장을 쓴다 | 1층 바닥 자동타일 / 2층 바닥 장식(캐릭터 아래) / 3층 물체(★ 은 캐릭터 위) / 4층 물체 위 물체 / 그림자 |
| 보기 | `show_map_region` | 맵에 그 칸이 있을 때만 `layer2`·`layer4`·`shadow` 배열이 붙고, 그림은 1 → 2 → 그림자 → 캐릭터 아래 이벤트 → 3 → 4 순으로 그린다(`src/ai/toolImageRenderer.ts`). 헤드리스 `scripts/pi-agent.mts` 도 그림을 받는다. 턴 시작 뷰포트 그림(`mapRegionImagePayload`)도 같은 층을 싣는다 |
| 시스템 프롬프트 한 줄 | `buildPiAgentSystemPrompt`(`src/ai/piAgent/systemPrompt.ts` `fourLayerTilesetLines`) | 대상 맵의 타일셋이 **네 층 타일셋**일 때만: 「MZ 네 층 + 그림자 … 참고문서 용도를 먼저 읽고 예제 배열을 stamp_layer_block 로 그대로 찍어라, 바닥 종류는 대표 타일로 칠하면 가장자리가 저절로 잡힌다」. 판정은 ① 같은 tilesetId 맵 중 하나라도 2층·4층·그림자가 있다, 또는 ② 그 타일셋(참고문서 원본) 용도의 **첫 문서 첫 줄이 `layer-model: mz4`**. 둘 다 아니면 줄이 없다 — 옛 프로젝트 프롬프트는 글자까지 같다(`test/piAgentSystemPromptFourLayer.test.ts`) |
| 고스트·변경 집계 | `mapDelta.ts`(layer2/layer4/shadow, 사라지면 `absent`), `changeset.ts` `countTileChanges`·`tileBuffersDiffer` | 2층만 바꾼 쓰기도 `tilesChanged > 0`·재검사 대상. 고스트는 선택 층 변화 칸을 테두리로만 표시(그 층 그림은 PR ②) |

빈 맵에서도 한 줄이 붙게 하려면 표지 ②를 쓴다 — 맵에 아직 2층이 없으면 ①로는 알 수 없다.

### 네 층 팩을 가르치는 순서

1. **칸 이름표(`tileMeta`).** 자동타일 종류(kind)마다 사람 말 이름·역할(물·바닥·벽·지붕·바닥 장식)·권장 층(1 또는 2),
   물체는 이름·크기·권장 층(3/4)·통행. `A2 kind 8 shape 0` 같은 기술 이름만 두면 조수는 뜻 모를 번호를 칠한다(r0 실측).
2. **이어지는 바닥은 `autotileGroups`(8이웃).** MZ 바닥 모양 0~47·벽 0~15·폭포 0~3 을 `AUTOTILE_DIR` 비트
   (N1 E2 S4 W8 NE16 SE32 SW64 NW128, `src/project/defaults/autotileEngine.ts`) 마스크 → 칸 번호 `variantMap` 으로 싣는다.
   모양 표는 `scripts/content/rasak/mz_autotile.py` 의 사분면 표(rmmz_core.js 와 같은 순서)에서 유도한다.
   이게 있어야 조수가 대표 번호 하나로 칠해도 도구(`paint_tiles`·`fill_region`·`stamp_layer_block`)가 1·2층 가장자리를 맞춘다.
   3·4층은 다시 모양을 잡지 않는다 — B~E 물체는 찍은 번호 그대로다.
3. **참고문서 용도 = 작업 단위**(예: 늪지 / 일본 정원·성 / 절벽·폭포 숲 / 얼음 동굴 / 용암 동굴). 용도마다
   [AI-REFERENCE-CONTRACT](../tiledata/AI-REFERENCE-CONTRACT.md) 항목을 채우되 네 층용으로:
   - 첫 문서 첫 줄 `layer-model: mz4`(위 프롬프트 표지) + 네 층 규칙 + 그 팩의 층별 실측 분포
   - 번호 사전: 자동타일 종류 → 칠할 대표 번호, 물체 → 칸 배열·층
   - 조립 순서: 1층 바탕 → 2층 장식 → 3층 물체 → 4층 겹침 → 그림자
   - **완성 예제는 `stamp_layer_block` 인자 그대로의 층별 배열**(10×8 안팎 창) + 원본 해상도 그림 + 층별 분해 그림.
     조수는 예시를 베낄 때 가장 잘 깐다(조각 조립 실험 13/13 vs 3/13).
   - 정상/오류 나란한 그림: 물체를 1층에(바닥이 사라짐), 장식을 3층에(캐릭터 위로 뜸), 2층 없이 자동타일(가장자리 끊김)
4. **용도 하나는 MD ≤5페이지(페이지 약 6000자 `REFERENCE_PAGE_SIZE` — 문단·코드 블록 경계에서 끊으며 한 코드 블록은 최대 3배까지 한 페이지, `referencePageStarts`)·그림 ≤8장.** 게이트가 칠하기 전에 용도 전부를
   읽게 하므로(위 「참고문서 읽기 게이트」) 용도가 크면 첫 턴이 그만큼 무거워진다. 크면 용도를 쪼갠다.

### Rasak Fantasy 파이프라인 (저장소 밖 그림)

그림·아틀라스·맵은 저장소에 넣지 않는다(재배포 금지). 저장소에는 스크립트와 텍스트만:
`scripts/content/rasak/bake_atlas.py`(사용자 원본 → 굽기 아틀라스, `mz_autotile.py` 표로 오토타일 펼침) →
`stack_to_layers.py`·`fold_layers.py`(프리뷰 → 4층·그림자) → 조수 지식 묶음 `scripts/content/rasak/build_assistant_pack.py` +
`scripts/content/rasak/apply-assistant-pack.mts`(이름표·묶음·autotileGroups·참고문서를 로컬 연구 프로젝트에 저장; 계획 Task 6·7).
`apply` 는 저장 직전 `fuser` 로 `project.sqlite`(-wal/-shm)를 연 다른 프로세스(호스트·편집기)가 있으면 저장하지 않고 멈춘다(fuser 가 없어도 멈춘다).
팩이 소유한 것만 갈아 끼운다 — 참고문서는 팩의 용도 id, `tileGroups`·`autotileGroups` 는 `rasak_` 접두어 id. 저자가 쓴 용도·그룹은 남는다. 판본은 `tiledata/rasak-fantasy/bundles.json` sha256,
이름·번호 같은 텍스트만 `tiledata/rasak-fantasy/` 에 둔다. 작업물은 `~/third-party-assets/rasak/`.

**마을·실내 묶음(2026-09-25).** `rasak_town`(A1~A5 City + Town·Building·Structure·Market + 울타리·정원·밭·작물·여름 나무)과
`rasak_interior`(A2_Inside·A4/A5_House + HouseInterieur·LivingRoom·Tavern·Storage + 대장간·재봉·왕실). 제작자 프리뷰가 없으므로
기준 맵은 `scripts/content/rasak/compose_examples.py`(+`_specs.py`)가 MZ 자동타일 규칙으로 조립한다(마을·광장·민가 방·주점 4장).
참고문서 용도 `town_village`·`town_city`·`interior_house`·`interior_tavern`. 시험에서 배운 것 — 조수는 예제를 **통째로 복사**하고
(방 하나를 stamp_layer_block 한 번으로 붙였다) 창을 지붕 줄에 단다. 그래서 문서에 집·방 **뼈대 배열**(작은 집·2층 집·방)과
「통째로 붙이지 않는다」, 오류 ⑦「창·문을 지붕 줄에」를 넣었다. 지원 시트 45/176 — 남은 큰 것은 Special_Buildings·Forestfolk·Dungeon.

**예제가 허접하면 조수도 허접하다(적대적 시각 QA 2026-09-25).** 첫 예제 네 장은 빈 바닥 46~60%·도시 좌우 대칭·방 하나 상자·의자 없는 식탁이었고,
조수 결과는 그보다 더 비었다(빈 바닥 50~88%, 대칭 배수 7~18). 예제를 제작자 수준으로 다시 조립하고 `scripts/content/rasak/check_examples.py`
(빈 바닥·빈 정사각형·대칭·허공, 제작자 맵으로 잰 기준)를 넘게 했다. 두 검수(구성 / 타일 칸 단위)를 따로 돌리면 서로 다른 결함을 잡는다 —
타일 검수가 엔진 결함(맵 가장자리 자동타일 = 끊김 → `AutotileGroup.edgeConnects`)과 조립기 버그(3줄 벽에서 뜨는 문)를 찾았다.
숫자만 보고 끝내지 않는다: 밀도 기준을 1칸 덤불로 채운 숲은 통과했지만 죽은 숲처럼 보였다.

**문서·예제만으로는 전체 배치가 옮겨지지 않는다 → 끝에서 한 번 수리 권고(2026-09-25).** 예제를 고친 뒤에도 조수 마을은 빈 바닥 44%였다.
Pi 런타임(`scripts/lib/piAgentRuntime.ts`)은 모델이 끝났다고 할 때 `src/ai/piAgent/layoutQuality.ts` 로 이번 실행이 1층을 25% 넘게 칠한 맵
(새 맵 포함, 마을 계약 맵 제외, 150칸·바닥 40칸 미만 제외)을 잰다. 정의·한도는 `check_examples.py` 와 같다(빈 바닥 ≤30%·빈 정사각형 ≤5·대칭 ≤2.2).
넘으면 가장 빈 6×6 창 좌표와 함께 **수리 프롬프트를 한 번** 보낸다. 거부·되돌리기는 없고, 두 번째 결과는 `execution_status layout_quality` 로 알리기만 한다.
헤드리스 D4(같은 프로젝트·과제): 마을 빈 바닥 58→44%, 도시 38%→통과, 민가 빈 바닥 38%→통과(대칭 5.2→4.8, 식탁 둘레 의자처럼 원래 대칭인 덩이가 끌어올린다).
같은 실행에 **무변화 반복 차단**(`src/ai/piAgent/repeatBreaker.ts`)도 붙였다 — 키 순서만 바꾼 같은 호출이 맵을 안 바꾸면 3번째에 한 번 일러 주고 12번째에 멈춘다
(실측: stamp_layer_block 같은 칸 137번 → 시간 상한 사망).

## 알려진 함정

- **16px 표가 48px 업로드를 건드린다.** `ensureTilesetHarnesses` → `applyCustomChipsetMinimalHarness`
  (`src/project/tilesetHarness/combinedTown.ts:55`, `:63`)가 합본 마을이 아닌 모든 타일셋(번들 성·LPC 가구만 예외)에
  RM2k3 투명 칩 번호표 `isTransparentChipsetTile` 로 `priority="upper"` 를 강제한다. 다른 규격의 업로드에선 엉뚱한 칸이 상위로 간다.
- **참고문서가 없으면 시스템 프롬프트의 「참고문서 읽어라」가 빈 목록만 돌려준다** — 조수는 그대로 번호를 칠한다.
- **`show_tiles` 그림은 조수가 못 본다.** 조수에게 칸 모양을 보여 주려면 참고문서 그림으로 넣는다.
- **`generate_map` 은 프로필 없는 타일셋에서 실패**하고, 문법 프로필은 RM2k 로 조용히 떨어진다.
- 새 칠하기 도구를 추가하면 `TILESET_REFERENCE_TILE_CHOOSERS` 목록에도 넣어야 게이트가 걸린다.

## 강제 장치 (이 문서를 안 읽어도 걸리는 것)

위키는 LLM 이 반드시 읽는다는 보장이 없다. 그래서 핵심 두 가지는 테스트가 막는다 — `test/tilesetTeachingGuards.test.ts`:

- **칠하기 도구가 게이트 밖에 있으면 실패.** `mapId` 와 칸 선택 인자(tile·tiles·tileId(s)·material(s)·recipeId·presetId·paletteRole·template)를
  함께 받는 쓰기 도구는 `TILESET_REFERENCE_TILE_CHOOSERS` 에 있거나, 코드가 칸을 고르는 도구 목록 `CODE_PICKS_TILES`
  (지금 author_village·place_concept·place_storage_chest)에 있어야 한다. 게이트 목록의 이름 오타·삭제도 잡는다.
- **새 번들 타일셋에 참고문서가 없으면 실패.** 2026-09-24 기준 참고문서 없는 번들 16개는 `BUNDLED_WITHOUT_REFERENCES` 에
  적어 두었고, 이 목록은 **줄어들기만** 한다(참고문서가 생기면 목록에서 빼라고 실패한다).

그리고 Claude Code 가 `AGENTS.md` 를 자동으로 읽도록 저장소 루트 `CLAUDE.md` 가 한 줄짜리 가져오기(골뱅이 + AGENTS.md)로 불러온다
(Claude Code 는 `CLAUDE.md` 만 자동 로드한다. Codex 는 `AGENTS.md` 를 직접 읽는다).
`tilesetReferenceTools.ts` 머리 주석도 이 문서를 가리킨다.

## 칩셋 계열 규칙 (2026-09-25 사용자 결정)

사용자 말: 「지금 보고 있는 칩에서 파생된 걸 쓰던가(easyrpg 계열이면 easyrpg), 타일이 달라지는 경우에는 사용자에게 말해야 한다 —
견본까지 보여 줘야 한다.」 그래서 조수는 **사용자가 보고 있는 맵과 같은 계열**로만 맵을 만들고 칩셋을 바꾼다.

- **계열 판정** `src/project/tilesetFamily.ts` `tilesetFamily(project, tilesetId)` — 순서: (1) `TilesetDef.family`(선택 문자열, 예
  `"rasak-fantasy"`) (2) `referenceSourceTilesetId` 를 따라 뿌리로 가서 다시 판정 (3) 업로드 칩셋이고 family 가 없으면 `uploaded:<뿌리 id>`
  (4) 번들은 `tilesetArtStyle()` 값(`easyrpg`·`castle`·`slates`·`lpc`·`modern`·`oga`·`scarloxy`·`other`; forest_harmony·기후 시트·tibo 는
  easyrpg). 없는 id 는 `unknown:<id>`. 사람용 이름은 `tilesetFamilyLabel`, 같은 계열 목록은 `sameFamilyTilesets`.
  업로드 팩 여러 장을 한 계열로 묶으려면 각 타일셋에 같은 `family` 를 적는다(Rasak 묶음은 `rasak-fantasy`).
- **실행기 검사** `toolRunner.rejectTilesetFamilyChange` — 기준 = `ctx.currentMapId` 맵의 계열, 대상 = 이번 호출로 새로 생긴 맵 +
  `tilesetId` 가 바뀐 맵. 계열이 다르고 `ctx.approvedTilesetFamilies` 에도 없으면 `tileset-family-change` 로 거부(draft 버림).
  메시지는 같은 계열 후보(최대 8개)를 주고 「후보를 tilesetId 로 다시 불러라(못 받는 도구면 create_map(tilesetId=후보) 후 칠하기 도구) ·
  없으면 ask_tileset_change 로 묻고 턴을 끝내라」고 지시한다. `currentMapId` 가 없으면(옛 호출자·MCP·헤드리스 `--current` 없음) 검사하지 않는다.
  `allowsTilesetChange` 도구(`revert_last_edit`·`reset_project`)와 읽기 도구는 빠지고, dryRun 은 같은 검사를 탄다.
  업로드 바꿔치기 검사(`uploaded-tileset-replaced`)는 currentMapId 없이도 도는 안전망으로 그대로 있다.
- **create_map 기본 칩셋**: `tilesetId` 없이 불리면 도구 기본값(숲마을 `defaultOutdoorTilesetId`)이 지금 보는 맵과 **다른 계열일 때만**
  실행기가 지금 보는 맵의 `tilesetId` 를 넣는다(`ToolDefinition.defaultTilesetId`, create_map 만 켬). 같은 계열이면 도구 기본값을 둔다 —
  EasyRPG 실내를 보며 만든 새 야외 맵이 실내 칩셋이 되지 않게(결정 기록: 규칙 1 을 「같은 계열」로 읽었다). 업로드 칩셋은
  `isCombinedTownCompatibleTileset` 이 아니라 빈 칸으로 채워진다(없는 번호를 깔지 않는다). generate_map·던전/실내 파이프라인·성 시공기처럼
  EasyRPG 번호를 가정하는 도구에는 주입하지 않는다 — 계열 검사가 막는다.
- **묻기** `ask_tileset_change{toTilesetId, reason, purpose?, mapId?}`(읽기, core 로 늘 노출) — 실행기가 비어 있는 `mapId` 를 지금 보는 맵으로
  채운다(`ToolDefinition.fillsCurrentMapId`; `run(draft,args)` 가 ctx 를 못 받아서 고른 가장 작은 길). 같은 계열이면 `tileset-same-family` 로
  거부한다. 결과 `data.kind:"tileset-change-question"`, 요약은 「답을 기다리며 이 턴을 끝내라」.
- **질문 카드** `src/editor/panels/aiTilesetChangeCard.ts` — Pi 턴 이벤트에서 성공한 `ask_tileset_change` 를 잡아(`tilesetQuestionFromEvent`,
  팀 `agent_event` 포장도 푼다) 턴이 끝난 뒤 대화 끝에 붙인다. 왼쪽 「지금」 = 지금 맵 가운데 최대 16×10칸을 `drawMapTileLayers` 로 그린 것,
  오른쪽 「바뀐 뒤」 = 대상 칩셋 참고문서 그림(purpose 가 맞는 용도, 없으면 그림 있는 첫 용도의 첫 그림), 없으면 아틀라스 앞 12×8칸.
  「이 타일로 바꿔도 좋아요」 → 패널 대화 상태 `approvedTilesetFamilies` 에 toFamily 추가 + `[사용자 승인] 칩셋 계열 변경 허용: … 원래 요청을 이어서 하라.`
  전송, 「아니요, 지금 타일로」 → `[사용자 거절] … 계열 안에서만 만들어라 …` 전송. 승인 목록은 새 대화에서 비운다.
- **ctx 가 받는 곳**: Pi 요청 `currentMapId`·`approvedTilesetFamilies`(`protocol.ts`) → 워커 `runPiAgent` 가 도구 ctx 에 싣는다(팀 레인은 요청을 펼쳐 그대로 받는다).
  채팅 세션은 `AssistantSession.toolContext` 의 게터가 `contextOptions.getCurrentMapId`·`getApprovedTilesetFamilies` 를 매 호출 읽는다.
- **헤드리스**: `bun scripts/pi-agent.mts --current <mapId> --approve-tileset-family <계열>`(반복 가능). `--current` 가 없으면 계열 검사가 꺼진다.
- 프롬프트: `promptPolicies.TILESET_FAMILY_POLICY_LINE`(채팅·Pi 공통 한 줄). 회귀: `test/tilesetFamily.test.ts`·`test/tilesetFamilyGuard.test.ts`·
  `test/aiTilesetChangeCard.test.ts`.

## 문서의 번호가 새 프로젝트에 있어야 한다 (2026-09-25)

조수 시험에서 문서대로 칠한 번호가 새 프로젝트에 없었다 — 숲마을 시트는 2550칸인데 장소 문서는 2550~2759(굽이숲 수관·절벽·계단·
폭포·다리·배·말뚝·생활 소품·판타지 폐성)를 쓰고, 던전 문서는 새 프로젝트에 없는 `oprn_dungeon_*` 타일셋으로 그렸다.

- **forest_harmony 공용 뒤쪽 칸**: `src/project/defaults/forestHarmonyExtension.ts` 가 새 프로젝트(번들 생성 경로)와 옛 프로젝트
  (`ensureBundledTilesets`, 로드 때)에 2550~2759 이식·칸 규칙·굽이숲 그룹·항구 조각 그룹·생활 소품 킷 19종을 붙인다. 끝 뒤 칸과
  빈 칸(원본 시트 밖, 이식 없음)만 쓰고, 그 자리에 다른 이식(생성 건물 등)이 있는 프로젝트는 건드리지 않는다.
  원본 `src/assets/forestHarmonyVillageExtension.json` ← `node scripts/content/extract-forest-harmony-extension.mjs`
  (너울목 + 판타지 폐성 내려받기). `createForestHarmonyTileset()` 자체는 원본 2550칸 그대로다(테스트 계약).
- **던전 재칠 시트**: `src/project/defaults/dungeonSheetTilesets.ts` 의 `ensureDocumentedTileset` 이 `create_map`·`set_map_properties`
  ·`import_region_reference` 에서 처음 쓸 때 `oprn_dungeon_cave|stone|desert|sea|lair` 를 프로젝트의 `easyrpg_chipset_dungeon`
  바탕으로 만든다(칸 번호 같음, 뒤 30칸 계단·보물상자 이식, 문서는 `referenceSourceTilesetId` 로 원본과 공유).
  원본 `src/assets/dungeonSheetTilesets.json` ← `node scripts/content/extract-dungeon-sheet-tilesets.mjs`.
- **`stamp_forest_recipe`** 는 원본 칸(0~2549)의 이식만 비교한다 — 전에는 칸 수가 2550이 아니면 번들 원본도 「파생판」으로 거부했다.
- 새 문서가 새 칸 번호를 쓰면 위 두 JSON 을 다시 뽑아 번들한다. 기후 시트(3030칸, 고목 2880~)는 이미 구운 시트라 해당 없음.
