# 다양한 숲마을: 공용 지역과 AI 참고문서

이슬여울은 보존하고 빈 지면에서 새로 만든 외관 참고 맵 7개다. 공용 「지역 → 기본 설계」에 등록한다. 강마을 네 곳은 「장소」에도 같은 스냅숏으로 나온다.

| 맵 | 크기 | 집 | 지형·동선 |
|---|---|---|---|
| 솔바람 흩어진 산촌 | 80×64 | 7 | 숲에서 숲까지 이은 절벽 윗단, 계단 3, 가지 길과 샘 |
| 층바위 절벽마을 | 88×72 | 8 | 세 높이의 대지, 네 계단, 절벽 아래 마당 |
| 갈대물굽이 포구 | 88×64 | 8 | 남·동쪽 물굽이, 골목, 긴 선착장 |
| 두 폭포 강마을 | 88×72 | 8 | 가운데 강, 두 줄 절벽의 폭포 둘과 소, 다리 셋, 계단 넷 |
| 종탑 언덕 교구마을 | 80×64 | 7 | 윗단 스테인드글라스 교회, 외곽 묘지, 폭포 하나와 소, 다리 하나 |
| 여울성 나루 | 100×92 | 10 | 맨 윗단 작은 성(왕궁 도시 내성을 줄인 두 겹 성벽·층층 궁), 동쪽 강의 폭포 둘, 다리 둘 |
| 안개못 폐촌 | 80×64 | 7 | 울타리 친 못과 섬 석상, 폐가 여섯, 못지기 집, 잊힌 묘지 |

아래 세 곳(`series: "concept"`)은 별도 참고문서 분류 `concept-villages-v1`로 나가며, 두 폭포 강마을과 함께 「장소」에도 나온다. 랜드마크는 `landmarks.json`, 비어 있던 칩셋 라벨은 `tile-labels.json`. 창문은 집마다 한 종류(85·86·87), 84는 교회, 88은 폐가.

## 정본과 재현

SQLite 프로젝트 ID: `44d88b94-58eb-4dee-a11a-88737da7001b`.
작업 정본 폴더: `.oprn-projects/village-diversity-20260923` (개인 DB는 git 미포함).
새 프로젝트에 저장한 뒤 같은 폴더를 다시 열어 맵 배열·칩셋 이식·참고문서를 확인했다.
이슬여울 프로젝트 `31250868-3eb7-42c9-a1f6-bd7d1d8e8245`는 저장 전후 JSON 값이 같다.
근거: `verify-shots/village-diversity/storage-proof.json` 및 `README.md`.

- `catalog.json`: 동결한 세 맵, 합성 칩셋, 지형 입력, 집·소품 좌표.
- `part-dictionary.json`: 실제 사용 타일 204개의 원본/합성 좌표, 메타데이터와 통행.
- `*-rows-*.md`: 상위·하위 전체 배열. 각 문서는 최대 16행.
- `cliff-assembly.md`, `forest-assembly.md`: 결합 순서, 반복과 마감, 층·방향·접근칸.
- `validation.md`, `validation.json`, `images/`: 정상 및 의도적으로 손상한 15종 비교.
- `images/`는 원본 렌더, `public/assets/diverse-village-references/`는 열람용 축소본. 축소 그림을 게임 타일로 잘라 쓰지 않는다.

```bash
# 새 저작을 재현할 때만. 이슬여울 정본에서 읽기 전용 export를 먼저 얻는다.
node scripts/content/author-diverse-villages.mjs source-project.json output/new-villages
# 현재 동결 표본의 오류 좌표 확인. 임의 마을의 미적 점수를 매기지 않는다.
node scripts/content/validate-diverse-villages.mjs project.json terrace-cliff-village
# 개발 서버가 켜진 상태에서 실제 타일 렌더 및 의도적인 오류 비교 생성
DIVERSE_DEV_URL=http://127.0.0.1:9816 node scripts/content/render-diverse-village-evidence.mjs
# 번들 생성 — 원격/프로젝트 저장 없음
node scripts/content/prepare-diverse-village-references.mjs
# 반드시 정본 저장/재로드를 마친 export만 배포
node scripts/content/prepare-diverse-village-regions.mjs reloaded-project.json 44d88b94-58eb-4dee-a11a-88737da7001b
# 실제 지역 목록·속성·다운로드 및 AI 전체 행 조회 관측
BASE=http://127.0.0.1:9816 node scripts/qa/capture-diverse-village-regions.mjs
```

공용 참고문서는 `src/assets/sharedDiverseVillageReferences.json`을 `forestHarmony.ts`의 생성자와 `ensureForestHarmonyReferences`가 소유한다. 별도 등록 스크립트로 몇몇 프로젝트 행에만 넣고 끝내지 않는다. 기존 작성자의 문서와 `referenceSourceTilesetId`는 보존한다. 다운로드에는 해당 맵과 필요한 이식, 통행, 이 참고문서 용도를 포함한다.

## 출처와 한계

원본 나무 몸통을 다시 그리지 않았다. 개정3에는 원본 사선 알파와 현재 바닥을 합성한 색 보정 파생 시트가 추가된다. 기존 번들의 `tex_forest_harmony`, `tex_forest_cliff_reference`, `tex_shared_forest_village_objects`, `tex_easyrpg_chipset_retro_world`를 사용한다. 그림의 기존 출처/라이선스는 `public/assets/ATTRIBUTION.md`, `public/assets/easyrpg/COPYING`, 기존 `tiledata/tilesets/forest_harmony/dewbank-village/` 자료를 따른다. 이 문서와 좌표 설계가 신규 저작이다.

절벽·잔디 경계 2670..2693은 이 세 맵의 명시적 이식 번호다. 일반 forest_harmony의 그 번호가 같은 그림이라고 가정하지 않는다. 다른 프로젝트의 빈 슬롯으로 옮길 때는 사전과 전체 배열을 함께 재매핑한다.

집 문앞·계단 양끝·동굴 접근칸·선착장 끝까지 엔진 타일 통행을 확인했다. 실내·NPC·문 전이 이벤트와 게임 전체 플레이 검증은 포함하지 않는다. 자동 검증은 동결 표본의 배열·이식과 접근 경로 비교이며 임의 마을을 판정하는 범용 생성 검증기가 아니다.

## 절벽 개정2 — 큰 폭포 아래 마을에서 교정

공용 지역 revision=2, 참고문서 용도 `diverse-villages-cliff-v2` (34 MD/13 이미지).
이전 얇은 둘레 띠를 버리고 참고 맵의 상위 윗선/반복 면/밑단을 적용한다. 왼쪽 원본18→231→48,
정면139→172→202, 오른쪽19→232→49를 구분한다. `cliff-source.json`은 기준 맵에서 읽은 실제 전체 열이다.
`cliffs.points`가 윗선이며 h는 윗선과 밑단 사이 y 차이다. stairs=[x,y,h]는 폭2·높이h+1이다.
암벽은 upper, 바닥은 lower에 남긴다. 계단은 lower에 놓고 같은 칸 upper를 비운다.

`previous-reference.json`의 내용 revision과 일치하는 미편집 v1만 v2로 교체한다.
사용자가 편집한 v1은 보존하며 v2를 덧붙인다. 기존 사용자 지도는 자동 재생성하지 않는다.
이슬여울·큰 폭포 아래 마을은 보존하고 이번 세 참고 지도만 갱신했다.
절벽에 겹치던 집 원점과 소품은 새 높이에 맞췄으며 집/나무의 그림 부품은 다시 그리지 않았다.
자동 검사는 기존 5종 외에 사선 면 방향, 밑단, 계단 끝을 열 문법으로 검사한다.
근거와 수정 전후: `verify-shots/village-cliff-repair/`.

## 잔디 경계 개정3 — 현재 바닥240 유지

현재 배포는 region revision3 / `diverse-villages-grass-v3` (35 MD/17 이미지/227개 사용 타일).
`grass-joins.md`에 504/505 및498/499/528/529의 정확한 원본·파생·이식 번호, 레이어,
바닥 받침, 조립 좌표, 두 레이어 전체 예제가 있다. `prepare-forest-grass-joins.mjs`가
9칸의 공용 파생 시트를 만든다. 504/505 모양과 투명 알파를 유지하고 잔디색만 바닥240에 맞춘다.
기존 시트 자체·집/소품 상위 배열·숲 몸통은 변경하지 않는다.
현재 파생 시트의 실제 출처는 `grass-joins-source.json`, 과거 열 구조는 `cliff-source.json`이다.
개정2의 픽셀 동일 주장은 역사적 근거이며 현재 색 맞춤판의 설명으로 쓰지 않는다.
이식 2692/2693은 lower+layerBacking240, 암벽은 upper다.
미편집 v1/v2만 내용 revision으로 교체한다. 사용자 편집본은 보존한다.
정본 revision8 저장/재로드, 새·기존 프로젝트와 실제 지역/문서 화면 근거는
`verify-shots/village-grass-joins/` 및 갱신한 `verify-shots/village-diversity/`.

## 현재: 굽은 지형·입구 개정4

공용 용도 `diverse-villages-winding-v4`, 35 MD/19 이미지. 지역 revision4.
504–559–505 완전한 마감(9번559 추가, 총10칸), 절벽 굴곡과 계단 평탄부,
군집/빈터 숲 밀도장, 맵 가장자리 폭3 출입구. 나무 몸통 원본·기본 바닥240은 유지한다.
옛 조립 지침은 역사적 설명이며 현재 입력/정답은 catalog와 개정4 문서다.
연구 출처·실제 적용·미구현 범위는 `research-layout.md`.
현재 정본 저장은 revision10, 근거 `verify-shots/winding-villages/`.

## 현재: 생활 마당 개정5

공용 용도 `diverse-villages-households-v5`,33 MD/21 이미지, 지역 revision5.
중앙/집 주변 무작위 소품을 제거하고 집 소유자와 용도가 있는 좌·우 마당 묶음으로 배치한다.
소품 수는 산촌64→17, 절벽65→21, 포구70→22. 집마다2–4개 묶음 하나이며 맞지 않으면 비워 둔다.
지형·숲·개별 나무·길·집은 이전과 정확히 같다. retained-vegetation.json은 승인한 독립 나무 좌표다.
정본 revision11 저장/재오픈 근거와 소품 외 배열 보존 증거: `verify-shots/household-props/`.

## 현재: 사용 목적 개정6

단순히 집별로 모으는 개정5를 보완한다. 집 순번 교대를 제거하고 실제 활동과 사용 관계를 지정한다.
prop-programs.json이 집별 용도/할 일/지정 이유 및 부품의 목적/기준 대상/최소 구성을 소유한다.
부두 없는 낚시 준비, 밭 없는 허수아비, 작업대 없는 재료/완제품 배치는 오류다.
원문 지침 household-props.md와 입력 사전 prop-programs.md는 공용 문서 v6에 포함된다.
지역 revision6,33 MD/22이미지. 정본 revision12 저장/재조회: verify-shots/prop-purpose/.

## 공동 공간·정원 개정7

`civic-programs.json` → 명시 장소·목적·관계 → `village-civic-props.mjs` 전체 부품 배치.
공동 우물터·정원·계단 안내·판매 자리·현관·선착장에 60개 소품을 더한다(산촌18/절벽18/포구24).
기존11종에14종을 더해 세 마을 전체25종을 사용한다. 하위 및 기존 상위 보존.
`civic-props.md` 실행 규칙과 장소별 입력/전체 배열/사용칸/정상·오류 그림을 공용 civic-v7에 포함한다.
현재38 MD/25이미지/237사용타일/18종 오류. 정본SQLite revision13 저장·재오픈 및 보존/동선 근거: `verify-shots/village-civic/`.

## 계단 대지 개정8 — 절벽 높이·문·소품

사용자 지적: 절벽에 높이가 없다(끝을 돌아 윗단에 걸어갈 수 있었다), 문 위 칸이 검정이 아니다, 소품이 모자란다.
- 절벽: 솔바람은 V자 둘 → 숲에서 숲까지 한 줄 + 계단3. 갈대물굽이는 오른쪽 끝을 북쪽 숲까지 막고(rightFrom:8) 계단2. 층바위는 톱니를 거의 수평 굽이로.
  각 끝 바깥 4열은 숲 강제 칸이며 길 경로에서도 막는다. 저작 스크립트와 검증기 모두 「계단을 막으면 윗단 도달 불가」를 단언한다(`terrace-without-stairs`).
- 문: 1×2 문 위 칸 359→329(완전 검정 문/입구), 아래 칸 359 유지. 23채 전부.
- 소품: `extra-parts.json` 8종, 새 장소 21곳·소품 46개(산촌17·절벽16·포구13, `civic-props.md` 개정8 절). 지형 이동으로 겹친 보존 나무는 자르지 않고 뺐다.
- 공용 AI 용도 `diverse-villages-terrace-v8`, 지역 revision 8. `previous-reference.json` 에 civic-v7 을 기록해 미편집 v7 만 교체한다.
- 사용자 판정 후속: 과일 바구니는 배율이 커서 제외(부품 목록에서 뺀다). 층바위 절벽의 동굴 입구를 없앴고 그 앞 쉼터는 동쪽 아랫단 불자리로 바꿨다.

## 강과 폭포 개정9 — 두 폭포 강마을

사용자 요청: 비취 대계곡의 폭포·물 사용법으로 마을 한가운데 강, 2단 절벽을 타고 내려가는 폭포.
- 비취 대계곡의 물(World120)·물가는 이 시트의 lake_47(1563 등)과 같은 그림이다. 폭포(World123)와 다리(World102/103)만
  `tex_easyrpg_chipset_world`(CC0)에서 이식했다(`catalog.riverTiles`). 기존 102/103은 통나무 벽이라 번호를 재사용하지 않는다.
- 저작 입력: `river={width,points,pools}`, `bridges=[x,y,w]`. 절벽을 지나는 열은 윗선=물, 면·밑단=폭포. 폭포 열과 좌우는 윗선 높이를 같게.
- 검사: `waterfall-gap`(폭포 열 중간이 다른 타일), 기존 `terrace-without-stairs`로 다리·계단 외 경로 없음 확인.
- 한계: 번들 칩셋은 타일 애니메이션이 없다(uploadedTilesets 전용) → 폭포는 첫 프레임 정지 그림.
- 공용 AI 용도 `diverse-villages-river-v9`(51 MD·28 이미지·20종 오류), 지역 revision 9, 정본 revision 18.

## 나무 몸통 개정11 — 잘린 줄기

사용자 지적: 나무 몸통이 이상하다, 잘린 곳이 있다.
- 원인: 옛 4칸 마감은 끝 열이 몸통 반쪽이고, 폭이 4·짝수8+가 아닌 밑변은 span 8 조각이 옆 수관 밑으로 들어가 그 외곽 칸의 투명한 가장자리로 반만 보였다. 마을당 30~50칸.
- 고침: 줄기를 밑변과 정확히 같은 폭으로(폭 2~5 좁은 조립 포함, 규칙은 `forest-assembly.md`), 폭 1 밑변만 이웃 열 높이로 한 칸 옮긴다.
- 맵은 다시 저작하지 않고 `node scripts/content/refit-forest-trunks.mjs tiledata/forest-villages/diverse/catalog.json` 로 제자리에서 맞췄다. 수관·집·길·소품은 그대로이고
  바뀐 밑변만 한 칸씩 움직였다. 검증기 7곳 통과(정상 0 오류, 오류 예시 22종은 좌표만 이동).
- 공용 AI 용도 `diverse-villages-trunks-v11`(52 MD·30 이미지) + `concept-villages-v2`(27 MD·3 이미지), 지역 revision 11, 정본 revision 21.
  `previous-reference.json` 에 windows-v10·concept-v1 을 기록해 미편집 사본만 교체한다. 기후 마을(`tiledata/climate-villages/`)은 이 카탈로그에서 다시 만든다.

## 나무 몸통 개정12 — 폭 2 조각 제거

사용자 지적(개정11 뒤): 여전히 이상하다. 폭 2 조립(LEFT 첫 열+RIGHT 끝 열)은 닫히긴 하지만 수관 계단 끝에 가는 뿌리 하나가 매달린 모양이었다.
- 최소 폭 3(`FOREST_TRUNK_MIN_WIDTH`). 폭 1·2 밑변은 `fitBottomEdges` 가 이웃 열 밑변 높이로 올리거나 내려 합친다.
- 같은 refit 으로 다시 맞췄다. 공용 용도 `diverse-villages-trunks-v12` + `concept-villages-v3`, 지역 revision 12.
- 확인: `node scripts/content/check-forest-trunks.mjs` — 다양한 마을·기후 마을·필드 카탈로그와 지역 스냅샷 전부에서 폭 3 미만 밑변·밑변과 다른 줄기·밑변 밖 줄기를 센다(0 이어야 한다). 2026-09-24 「여전히 뿌리만 보인다」 신고의 그림은 이 개정 전(개정11) 비교 그림이었다.

