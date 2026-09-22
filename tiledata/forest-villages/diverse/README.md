# 다양한 숲마을: 공용 지역과 AI 참고문서

이슬여울은 보존하고 빈 지면에서 새로 만든 외관 참고 맵 3개다. 공용 「지역 → 기본 설계」에 등록하며 「장소」의 부분 사례와 혼동하지 않는다.

| 맵 | 크기 | 집 | 지형·동선 |
|---|---|---|---|
| 솔바람 흩어진 산촌 | 80×64 | 7 | 두 둔덕, 떨어진 집, 가지 길과 샘 |
| 층바위 절벽마을 | 88×72 | 8 | 세 높이의 대지, 네 계단, 절벽 아래 마당 |
| 갈대물굽이 포구 | 88×64 | 8 | 남·동쪽 물굽이, 골목, 긴 선착장 |

## 정본과 재현

SQLite 프로젝트 ID: `44d88b94-58eb-4dee-a11a-88737da7001b`.
작업 정본 폴더: `.oprn-projects/village-diversity-20260923` (개인 DB는 git 미포함).
새 프로젝트에 저장한 뒤 같은 폴더를 다시 열어 맵 배열·칩셋 이식·참고문서를 확인했다.
이슬여울 프로젝트 `31250868-3eb7-42c9-a1f6-bd7d1d8e8245`는 저장 전후 JSON 값이 같다.
근거: `verify-shots/village-diversity/storage-proof.json` 및 `README.md`.

- `catalog.json`: 동결한 세 맵, 합성 칩셋, 지형 입력, 집·소품 좌표.
- `part-dictionary.json`: 실제 사용 타일 235개의 원본/합성 좌표, 메타데이터와 통행.
- `*-rows-*.md`: 상위·하위 전체 배열. 각 문서는 최대 16행.
- `cliff-assembly.md`, `forest-assembly.md`: 결합 순서, 반복과 마감, 층·방향·접근칸.
- `validation.md`, `validation.json`, `images/`: 정상 및 의도적으로 손상한 12종 비교.
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
