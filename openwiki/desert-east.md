# desert_east — 사막·동양풍 칩셋 (아라비아·실크로드·이집트·메소포타미아)

16px 3/4 탑뷰 코드 손 도트 공용 번들 칩셋. 계열 `oprn-desert-east`, 텍스처 `tex_desert_east`, 시트 `public/assets/desert-east/desert-east-chipset.png`(한 줄 48칸).
야외(오아시스 마을·바자르·궁전·피라미드 유적·대상 숙소)와 실내(찻집·가게·알현실·묘실·함맘·여관)를 한 시트에 담는다. 생성 이미지·사람·글자·상표 없음.

## 파일 지도
| 무엇 | 어디 |
|---|---|
| 잠긴 팔레트 | `scripts/content/desert-east/art/palette.json` (램프마다 7단) |
| 그림 등록부 | `art/terrain.py`(바닥·모서리 왕 타일 5벌) · `buildings.py` · `props.py` · `interior.py` — `python3 <파일>.py` 가 `tiledata/desert-east/<묶음>/_gate/de-*.png` + `items.jsonl` + `preview.png` 를 쓴다 |
| 굽기 | `scripts/content/desert-east/bake_de.py` (관문 영수증 pass 만 굽는다 — 이야기 기물 8종과 첫 판 늘리기 그림은 오너 면제, 아래 두 절, `DE_UNGATED=/tmp/x` 는 관문 없이 /tmp 로만 — 개발용) |
| 참고문서 | `bake_refs_de.py` → `src/assets/desertEastReferences.json` + `public/assets/desert-east-references/*.png` (용도 de-outdoor · de-interior) |
| 구성기(순수 함수) | `src/project/desertEastComposer.ts` — `composeDesertEast`(야외 5종) · `composeDesertRoom`(실내 6종, 배치 둘) · `desertPaletteFromTileset`(게임 열쇠로 그림·재질을 고르는 사전) |
| 타일셋 정의·보정 | `src/project/defaults/desertEast.ts` (`ensureDesertEastTileset`·`ensureDesertEastReferences`, `defaultAssets.ts` 의 `ensureBundledTilesets` 가 부른다) |
| 조수 정책·도구 | `src/ai/desertEastPolicy.ts` · `src/editor/tools/desertEastTools.ts` (`compose_desert_east_map` · `compose_desert_east_room` · `link_desert_east_interior`) |
| QA 렌더 | `scripts/content/desert-east/qa/compose-scene.mts` · `compose-room.mts` · `render_scene.py` |

## 바닥 문법
- 꼭짓점 재질 격자 (W+1)×(H+1): s 모래 · r 다진 흙길 · f 포석 · g 풀 · w 물 · d 사구.
- 칸 번호 = NW1 + NE2 + SW4 + SE8 (그 벌의 재질인 모서리). 물이 한 모서리라도 있으면 물 벌, 아니면 모래가 아닌 모서리를 모두 다수 벌로 센다 — 흙길↔포석, 풀↔포석이 만나는 칸에 모래 이(V자 틈)가 끼지 않는다.
- 순수 칸(15)은 변형을 섞는다(모래 4 + 물결·자갈 조각, 풀 3).

## 구성기 규칙 (적대 검수 2026-10-14 뒤 한 번 고친 것)
- 건물 문은 남향, 문 아래 접근칸은 길. 모든 접근칸이 시작 칸에서 닿아야 한다(씨앗 6번까지 다시, 도구는 엔진 `isPassable` BFS 로 다시 확인하고 실패하면 맵을 바꾸지 않는다).
- 소품 발 밑(키트 맨 아랫줄)의 꼭짓점: 덤불·마른 풀·바위·낙타·작은 천막은 모래(마른 풀은 사구도)만, 야자·협죽도는 풀만, 갈대는 물가 풀. 물 위에는 아무것도.
- 야영지는 다진 흙 마당 + 천막 둘 + 모닥불 + 깔개 + 앉은/선 낙타를 한 무리로. 바자르는 앞줄 노점(통로 향함) + 뒷줄 장인 묶음(같은 묶음 이웃 금지).
- 궁전: 앞 단은 마당 폭 끝까지, 정원은 축선 길까지 붙이고 분수 마당을 다시 깐다, 북쪽 귀퉁이 화단. 대상 숙소: 같은 방을 틈 없이 한 줄, 우물 단 → 성문 포석 길.
- 피라미드: 대피라미드(14×9, 오른쪽 2칸 땅 그림자), 입구 = px+5, 남쪽 끝 탑문(성문 키트), 신전 터 배치는 셋 중 하나(거울 금지), 아치는 판석 위.
- 실내: 맨 윗줄 천장, 그 아래 두 줄 벽면(1×2 키트), 아래 모서리는 일반 천장(테 조각 쓰지 않음), 벽등은 창·벽감 위에 걸지 않는다, 무덤 통로는 비운다(부장품은 묘실 벽 앞, 넣을 때마다 문에서 닿는지 확인 `putSafe`).

## 3/4 관문
`npm run harness -- object-gate review --batch tiledata/desert-east/<묶음>/_gate/items.jsonl --force` (묶음 terrain·buildings·props·interior).
모서리 왕 타일은 한 벌 4×4 묶음 그림 `de-wang-<벌>.png` 의 영수증이 16칸을 덮는다. 보정 프로필이 미보정이라 통과는 잠정이다(`object-gate status`).

## 이야기 기물 8종 (2026-11-12, 시트 928~949) — 3/4 관문 미통과 · 오너 면제
게임들이 실제로 바랐는데 시트에 없던 물건을 Claude Fable 5.2 medium 이 한 방에 그린 것(이 프로젝트를 위해 그린 자체 저작) 가운데 오너가 반영하라고 한 여덟: `de-seal-altar`(봉인 제단 2×2, 928~931) · `de-flower-bed`(화단 2×1, 932~933) · `de-spring`(샘 3×3, 934~942) · `de-record-stand`(기록부 1×2, 943~944) · `de-note`(쪽지 1×1 바닥 그림, 945) · `de-marker`(돌탑 표식, 946) · `de-shard`(빛나는 파편, 947) · `de-inscription-stone`(비문 돌 1×2, 948~949).
- **관문:** 이 그림들은 3/4 관문을 통과하지 않았다. 오너 면제 묶음 `fable-oneshot-2026-11-12`(`harness-data/object-gate/waivers/`)가 그림 화소 해시·종류에 묶여 번들 출구만 연다(스토어 출구는 막힌다). 굽기는 영수증 없는 조각을 관문 자신의 출구 규칙(`object_gate.refusal(context='bundle')`)에 묻는다 — `de_bake_lib.gate_status` 에 둘째 규칙은 없다. 한 화소라도 바꾸면 면제가 풀려 굽기가 그 조각을 막는다.
- **원본·목록:** `tiledata/desert-east/objects/pieces/de-*.png`(한 화소도 고치지 않는다) + `spec.json`(이름·낱말·크기·놓는 법·막힌 칸·규칙). `bake_de.py` 가 등록부 조각 **뒤에** 이 목록을 덧붙인다 — 새 항목은 `items` 끝에만(칸 번호는 자리 키 핀).
- **통행:** 서 있는 기물(prop·tall) = `block` 칸 막힘, 나머지 칸은 ★(걸어 지나가고 사람 위에 그려짐) · 바닥 그림(decal, 쪽지) = 밟고 지나감. 킷 태그 끝의 `prop`/`tall`/`decal` 이 `stamp_tileset_object` 의 놓는 법이다.
- **조수가 찾는 길:** 낱말 목록이 아니라 킷 이름·태그다(`spec.json` 의 `words` 가 태그가 된다 — 「샘」「물이 솟는 돌 샘」「돌무더기」「샘의 심장」). `list_tileset_objects(query)` · v2 `draw_object(what)` 가 «이미 있다 → place_object(de-…)» 로 이른다. 게임들이 쓴 이름은 `objects/ask.json`(탐침 전용).
- **참고문서:** `de-outdoor` 용도의 `de-objects` 문서(사전·순서·전체 배열·정상/오류 그림 `objects-scene*.png`·`objects-err.png`, 검사 코드 E_OBJ_LAYER·E_OBJ_INCOMPLETE·E_OBJ_PASSAGE) — `bake_refs_de.py` 가 같이 굽는다.
- **탐침(모델 없음):** `bun scripts/content/story-objects/probe.mts desert_east <outDir> --base-sheet <고치기 전 시트> --saved <저장본 폴더>` — 새 프로젝트·시트 칸 관문(번들 0 / 스토어 22 미덮임)·기존 저장본·낱말→킷·v2 `place_object` 통행·주인공이 선 1배 장면. 칩셋 표는 `scripts/content/story-objects/chipsets.json`(다음 칩셋도 같은 탐침을 쓴다).

## 첫 판 늘리기 (2026-11-13, 시트 950~1629) — 변형·새 집·새 기물·바닥 재질 · 3/4 관문 미통과 · 오너 면제
오너(2026-11-13): «근데 보면 버들항 타일만 오브젝트랑 타일이 다양하지 나머지는 너무 적은거같음». 재고(`scripts/content/world-kits/gap.mts`, 아래 「재고·그리기 도구」)로 보니
사막은 저장된 조수 게임 42편 가운데 16편이 쓰는데 키트 135(버들항의 13%), 구성기가 놓는 종류 가운데 11종이 그림 한 장, 방은 씨앗이 달라도 놓인 키트가 100% 같았다.
Claude Fable 5.2 medium 한 방(그림 한 장에 호출 1번 — 142호출 $13.76, 깨진 답 5장만 한 번 다시)으로 그려 굽고, **구성기 사전이 게임 열쇠로 고르게** 했다.

| 무엇 | 수 | id 꼴 | 어떻게 쓰이나 |
|---|---|---|---|
| 같은 종류의 다른 그림(변형) | 93 (원본 70종) | `de-<원본>-<n>` (`de-well-1`) | `ai.variantOf` = 원본. 칸 크기·채운 칸·칸마다 통행·층이 원본과 같다(만들 때 원본이 비운 칸을 지우고 통행은 원본 칸 것을 그대로 준다) |
| 집 변형(평지붕) | 7 (원본 6채) | `de-v-house-<원본>-<n>` | 지붕 덩이 + 벽 덩이를 따로 그려 코드로 이음. 문 칸 = 원본의 문 칸 |
| 새 집 | 2 | `de-house-wide-5`(5×4, 문 dx 2) · `de-house-hut-2`(2×3, 문 dx 0) | 구성기 집 줄·프로그램 `home` 에 섞인다(열쇠가 있을 때) |
| 새 기물 | 7 | `de-barrel` · `de-barrels` · `de-notice-board` · `de-stop-lever` · `de-hatch-down` · `de-room-door` · `de-save-crystal` | 앞의 셋은 구성기가 놓는다. 뒤의 넷은 이름·태그로 찾아 놓는 이야기 기물(구성기는 놓지 않는다). 방 문은 실내 벽면 두 칸 위에 찍힌다(놓기 도구가 «문 아래층이 외벽이 아닙니다» 라고 알리지만 찍는다) |
| 겉모습 재질 칸 | 334 | `de-look-<갈래>-<재질>-…` | 바닥 `red`·`pale`, 길 `cobble`·`brick`, 광장 `zellige`·`marble`·`herring` — 재질 칸 두 장(A·B)만 그림에서 받고 모서리 왕 타일은 `art/terrain.py` 의 가장자리 코드에 그 재질을 넣어 만든다 |

굽기 뒤: 칸 950 → **1,630**(34줄), 키트 135 → **244**(변형 100 = 기물·벽면 93 + 집 7), 조각 696. 옛 950칸은 화소·통행·층·이름표가 그대로고 옛 키트 135개의 칸 배열도 그대로다(덧붙이기 전용 핀).
버린 것: `n-lever-wall`(벽 레버 — 사막 실내의 벽면 칸은 칸 역할이 `terrain` 이라 `stamp_tileset_object` 의 벽걸이 규칙(아래층이 `wall`·`roof` 역할)이 받지 않는다. 놓을 수 없는 그림은 굽지 않았다 — 벽면 칸 역할을 `wall` 로 바꾸면 v2 의 문·입구 판정(`place/entrances.ts` 가 `terrain` 을 땅으로 센다)이 같이 움직여 따로 정할 일이다. 바닥 레버 `de-stop-lever` 가 그 일을 한다) · `n-house-tower-3`(지붕 덩이 48px 가 벽 32px 보다 높다 — 지붕 높이 상한 초과, 굽지 않음) · `v-fountain-1`(답이 잘렸다 — 다시 그리지 않음, 분수는 변형 없음).
이번에 변형을 그리지 않은 것: 성벽 가족(`de-wall-h/v/tower/gate` — 함께 바뀌어야 한다), 돔 집·2층 집·바람탑 집, 궁전·피라미드 같은 큰 건물, 분수.

- **관문:** 3/4 관문을 통과하지 않았다. 오너 면제 묶음 `fable-variety-desert-east-2026-11-13`(409장, 출구 bundle·shared — 스토어 불가). 한 화소라도 바꾸면 면제가 풀려 굽기가 그 조각을 막는다.
- **원본·목록:** `tiledata/desert-east/variety/src/*.png`(모델이 낸 그대로, 135장) → `python3 scripts/content/world-kits/fable/build.py desert_east` → `variety/pieces/*.png` + `spec.json` + `waiver-manifest.json` + `build-report.json` + `objects.json`(새 기물만 탐침 꼴). 새 기물의 변형(게시판 다른 그림 둘)도 같은 목록에 있다 — 굽기는 원본이 같은 목록에 있는 변형을 뒤로 미뤄 덧붙인다. `bake_de.py` 의 `variety_pieces` 가 등록부·이야기 기물 **뒤에** 덧붙인다.
- **재질 칸의 이름표:** 재질 칸은 «그 자리에 원래 깔리던 칸» 의 이름·꼬리표를 물려받는다(자갈 길 칸 = 「다진 흙길 · 재질 road-cobble-a」, 꼬리표 `길`·`흙길` + `겉모습 재질`). 길 판정(`tilesetSurface` 의 사막 선언 = 꼬리표 `흙길`·`포석`)과 바닥 판정이 재질을 바꿔도 같아야 한다 — 꼬리표 없이 구운 첫 판은 명세 은행에서 «길 몫» 이 줄어 잡혔다(자갈·벽돌 길이 길로 세어지지 않았다).
- **벽면 가족(`ai.lookWith`):** 방의 벽은 벽면(`de-wall-plaster`)과 창 난 벽(`de-wall-window-plaster`)이 번갈아 선다 — 따로 고르면 한 방에 두 벽이 섞인다(실측: 여섯 게임 가운데 둘). 창 난 벽·벽감 벽의 변형은
  «그 벽면 변형 + 원본 가족 그림이 벽면과 다른 화소(창·벽감)» 로 코드가 만들고(`worlds/desert_east.py` 의 `ACCENTS`), 변형에 `ai.lookWith = 벽면 원본` 을 단다. `lookKit` 은 그 값이 있으면 벽면 원본의 이름으로 뽑아 같은 순번이 된다(`src/project/kitLook.ts`).
- **참고문서:** `de-outdoor` 용도의 `de-variety` 문서(변형 사전 `variety-variants.png` · 재질 `variety-looks.png` · 새 기물 정상/오류 그림 · 검사 코드) — `bake_refs_de.py` 의 `variety_refs()`.

### 구성기가 게임 열쇠로 고른다 — `desertPaletteFromTileset(def, pieces, key = activeKitLook())`
#4686 의 고르기(`lookKit`)는 놓기 도구 넷에만 걸려 있었다. **테마 세계 구성기는 키트 칸을 맵에 직접 쓰므로 그 길을 지나지 않는다** — 변형을 굽기만 하면 아무것도 달라지지 않는다. 사막은 구성기 사전에서 고른다:
- `pal.kit(원본 id)` → 그 게임의 그림(원본 또는 변형의 칸 배열, 크기·문 자리는 원본 것). 구성기의 id 목록은 고치지 않았다.
- `pal.tile(조각)` · `pal.wang(벌, 번호)` → 그 게임의 바닥·길·광장 재질(`desertLookFor(pieces, key)` 가 갈래마다 `lookHash("look|<열쇠>|desert_east|<갈래>")` 로 고른다). 색이 같아 경계가 안 보이는 짝(`pieces.looks.clash`: 밝은 모래 + 젤리지·대리석, 붉은 흙 + 벽돌 길)은 길·광장을 원래 그림으로 둔다.
- `pal.varied`(열쇠가 있을 때 참) → 구성기가 스스로 고르는 새 종류(`VARIED_ONLY`: 넓은 흙집·흙움막·통·게시판)를 섞고, 방은 **배치 둘**(`furnish` / `furnishAlt`) 가운데 씨앗으로 고른다.
- **열쇠가 없으면(사람 편집·스크립트·옛 호출) 구성 결과가 이 변경 전과 한 칸도 다르지 않다** — 실측: 야외 5종·방 6종 × 크기 × 씨앗 10 = 450판 가운데 전에 짜이던 349판의 칸·소품·건물 해시가 모두 같다. 전에 못 짜던 41판(찻집 16×12 이상 40 · 여관 13×9 하나)은 이제 짜인다 —
  `composeDesertRoom` 이 씨앗 여섯 번을 다 쓰고도 막히면 길을 막는 가구를 걷어 내며(`Room.openCuts`, 최대 6개) 한 바퀴 더 돈다.
- 열쇠 = 조수 실행의 `ToolContext.lookKey`(실행기가 `withKitLook` 으로 켠다). 새 도구 인자·프롬프트 변화 없음.
- 잰 것(모델 없음, 씨앗 n + 게임 열쇠 n 으로 여섯 게임): 아래 「현황 2026-11-13」.
- **다른 테마 세계도 같다:** 변형을 구우면 그 세계 구성기의 사전(`<세계>PaletteFromTileset`)이나 키트를 푸는 자리에 `lookKit` 을 걸어야 한다. 걸지 않은 변형은 `stamp_object`·`place_object` 로 놓을 때만 고른다.

### 재고·그리기 도구 (`scripts/content/world-kits/`) — 다음 세계도 같은 길
- `gap.mts` — 테마 세계 아홉을 버들항에 견준 재고(모델 없음): `bun scripts/content/world-kits/gap.mts <out.json> [--seeds 6] [--saves <저장 폴더 목록>] [--bank harness-data/assistant-capability/spec-bank] [--only <칩셋,…>]`.
  세계마다 키트·변형·바닥 재질, 구성 도구를 종류마다 씨앗 여섯(게임 열쇠도 여섯)으로 짜서 놓인 키트·«씨앗 사이 같은 키트»(키트 집합의 짝 자카드 평균)·«놓이는데 그림 1장» 인 종류·버들항에만 있는 종류·저장 게임/명세 은행 사용량. 종류 표는 `kinds.json`(id 토큰 — 낱말 목록이 아니라 재고 분류용).
- `fable/draw.py <세계> --list|--prompts|--only <id…>|--all --cap-usd N [--par 4]` — Fable 5.2 medium 한 방(그림 한 장에 호출 1번, 깨진 답만 `--redo` 한 번). 주문·팔레트·참고 그림은 `fable/worlds/<세계>.py`, 장부는 `~/.cache/oprn-world-kits/<세계>/ledger.jsonl`.
  프롬프트(`wk_prompt.py`)에는 그 세계의 잠긴 램프, 주인공 24×32, 변형이면 원본 그림의 행 문자열과 칸 마스크가 들어간다.
- `fable/build.py <세계>` → 굽기 입력(위) · `fable/preview.py <세계> <out.png>` → 원본 옆에 놓은 대조 시트.
- 세계를 더하려면 `fable/worlds/<세계>.py` 하나(주문 표·`build_looks`)와 그 세계 굽기의 덧붙이기(`variety_pieces` 꼴), 구성기 사전의 열쇠 배선.

### 이식 칸이 있는 옛 사본 (2026-11-12)
`stamp_tileset_object` 로 다른 칩셋 그림을 붙여 쓴 프로젝트는 사본 끝(928~)에 이식 칸(`tileGrafts`)이 있다. 전에는 «칸이 번들보다 많은 사본» 이라 번들이 자라도 손대지 않았고, 그 프로젝트는 새 킷을 영영 못 받았다(실측: jrpg-v2 저장본, 928·929 = 황무지 표지판).
지금은 `ensureDesertEastTileset(tileset, project)` 가 `settleLocalTail`(`src/project/defaults/localTailRelocation.ts`)로 이식 꼬리를 새 번들 끝 뒤(한 줄 폭 배수)로 밀고 — 맵·킷·changeTile 번호도 같이 — `adoptBundleBeforeTail` 로 번들 구간 칸 표·`de-` 부품을 채운다. 그림은 그대로다(같은 저장본 7맵 렌더 전후 해시 같음). 번들 끝과 꼬리 사이에 이름표가 든 칸이 있으면 더 새 번들에서 저장한 사본으로 보고 손대지 않는다. 다른 테마 번들 13개도 같은 길을 쓴다 — 공용 `settleThemeBundleTail` 한 줄(`openwiki/runtime-project-schema.md` 「시트 끝에 칸을 끼운 번들」 항목).

## 조수 경로
`plainTurn.ts` 가 사막·오아시스·바자르·피라미드·아라비안·실크로드 낱말(로마풍·버들항·지중해 제외)을 보면 `desertEastTargetFor` 노트를 붙이고 위 세 도구를 첫 요청부터 노출한다.
월드맵 테마 `desert-east` 의 마을 칩셋도 desert_east 다(`worldTerrainTools.ts` THEME_TOWN_TILESETS).

## 현황 (2026-10-14)
- 굽기: 칸 928, 키트 127, 조각 245/247 (관문 항목 170/172 통과 — 모서리 왕 타일 5벌은 묶음 그림 5장이 80칸을 덮는다). 보정 프로필 미보정이라 통과는 잠정.
- 미통과로 굽지 않은 것: `de-obelisk`(구성기는 시트에 없으면 `de-stele` 로 대신 놓는다), `de-fence-wood`(구성기가 쓰지 않는다). 첫 판 57개 미통과는 윗면을 키워 다시 그렸다.
- 적대 시각 QA 1판(장면 5 + 방 3, 배치 4~6/10) → 개선 1판: 바닥 이음 V자 틈, 소품 발 밑 재질, 야영지·바자르·궁전·대상 숙소·피라미드 배치, 대피라미드, 방 모서리·벽등·양탄자 길.
- 조수 실제 입력창(gemini-3.8-flash high, `assistant-capability` 실행기 복제): 오아시스 7 · 바자르 6.5 · 피라미드+묘실 6 (연결까지 성공). 피라미드 판에서 배치 품질 권고를 받은 조수가 석재를 낱개로 덧찍어서
  구성기 맵·방에 `composed-layout` 이름표를 달았다(`scripts/lib/piAgentRuntime.ts` 가 그 맵을 권고에서 뺀다). 이 고침 뒤 실조수 재확인은 할당량 소진으로 못 했다.
- 남은 일: 오벨리스크 관문, 바자르 격자 단조로움, 조수 재확인.
- 2026-11-12: 이야기 기물 8종을 덧붙여 칸 950, 키트 135, 조각 253/255(막힌 둘은 그대로 `de-obelisk`·`de-fence-wood`). 참고문서를 다시 구우며 예제 그림 넷(`ex-bazaar`·`ex-caravanserai`·`ex-palace`·`ex-pyramid`)도 지금 구성기 출력으로 갱신됐다 — 지난 굽기 뒤 구성기가 바뀌어 있었다(이 묶음과 무관한 밀린 갱신).

- **시작 위치 (2026-10-14):** `compose_desert_east_map` 이 빈 시작 맵을 이 맵의 시작 칸으로 옮긴다(`src/editor/tools/composerStart.ts`; 실내 `compose_desert_east_room`·작가가 정한 시작은 제외). 모델이 `set_start_position` 을 안 부르면 시작 맵이 빈 맵으로 남던 결함.
- **화풍 정렬 quality-b (2026-10-14):** 버들항 수준 명암·질감으로 야자(렌즈 잎·빛/그늘 반·빗살 틈, 줄기 비늘, 밑동 풀 그늘), 평지붕 윗면(`bparts.flat_roof` 빛 기울기 디더·미장 덩이·빗물 얼룩·잔금 → 건물 15종), 풀(짙은 풀 덩이·풀잎 점), 흙길(눌린 흙 디더·잔돌·발굽 홈), 모래 잔 결, 물(흩어진 물결 — 칸마다 찍히던 글자 무늬 제거)을 다시 그렸다. 칸 번호·키트 크기 그대로. 관문 영수증 새로 52장(PASS 48 · FAIL 4: 지붕 첫 판의 회당·궁전 2 — 덩이를 둥글게 고친 뒤 통과, 오벨리스크 시도 2), 오벨리스크는 두 번 다시 그려도 미통과라 원래 그림으로(여전히 비석으로 대체). 시트 지표(칸당 고유색 중앙 7·p90 13, 어두운 V 62→61, 채도 0.49)는 잠긴 램프(6~7단) 때문에 거의 그대로 — 차이는 단 배치·디더라 눈으로 본다. 조수(gemini-4-argon medium, 실제 입력창) 「사막 오아시스 마을 만들어줘」 6 → 7(저장·재로드 일치). 남은 것: 야자 키트가 작아 버들항 나무만큼 덩이가 크지 않음, 사암 포석 광장이 평평함.
- 2026-11-13 첫 판 늘리기(위 절): 칸 1,630 · 키트 244(변형 100) · 조각 696. 재고로 잰 전 → 후(씨앗 n + 게임 열쇠 n 으로 여섯 게임, `gap.mts --only desert_east`):
  «씨앗 사이 같은 키트» 야외 5종 평균 **88% → 40%**(오아시스 88→33 · 바자르 85→37 · 궁전 77→40 · 피라미드 91→57 · 대상 숙소 97→35), 방 6종 평균 **100% → 36%**(찻집 39 · 가게 40 · 알현실 36 · 묘실 33 · 함맘 35 · 여관 33),
  «놓이는데 그림 1장» 인 종류 **11 → 7**(남은 일곱은 모두 큰 건물: 성벽 세로·성벽 탑·성문·대상 숙소 문·돔 회당·미나렛·궁전 — 성벽은 함께 바뀌어야 하는 가족이고 나머지는 한 호출 화소 상한을 넘는다), 여섯 씨앗에 놓인 키트 116/135 → 217/244, 야외 바닥 재질 6 → 13.
  저장된 조수 게임의 사막 맵 83장(14편)은 전/후 렌더가 화소까지 같다. 열쇠 없는 구성 450판 가운데 전에 짜이던 349판은 해시가 같다. v2 골든 157 요청 같음(프롬프트·도구 노출 변화 없음).
  아직 변형이 없는데 구성기가 놓는 것: 성벽 가족·큰 건물(위) · 분수 · 돔 집·2층 집·바람탑 집. 구성기가 놓지 않는 새 종류: `de-stop-lever` · `de-hatch-down` · `de-room-door` · `de-save-crystal`(이야기가 부를 때 이름·태그로).
