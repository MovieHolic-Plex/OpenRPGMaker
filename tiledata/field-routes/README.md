# 마을 사이 필드

집 없이 맵 가장자리에서 가장자리로 흙길이 이어지는 필드. 숲마을과 같은 부품(절벽 열 문법·돌계단·여울과 폭포·나무다리·흙길 오토타일·숲 윤곽·나무 도장·소품)으로 짰다.
지형만 있고 이벤트는 없다. 출구마다 어느 마을 입구와 맞닿는지(`meets`)만 적어 두었다.

| 필드 | 타일셋 | 크기 | 지형 | 출구 → 마을 |
|---|---|---|---|---|
| 숲속 세 갈래길 | forest_harmony(이식 포함) | 96×64 | 갈림길 빈터·이정표·쉼터, 풀밭 못 | 서 → 갈대물굽이 포구, 북 → 솔바람 산촌, 동 → 다음 필드 |
| 여울 건너 벼랑길 | forest_harmony(이식 포함) | 100×72 | 한 줄 절벽·계단, 여울이 폭포로 넘음, 나무다리 | 남 → 여울성 나루, 동 → 다음 필드, 북 → 종탑 언덕 교구 |
| 두 단 고갯길 | forest_harmony(이식 포함) | 80×80 | 절벽 두 줄·계단 둘, 가운뎃단 못, 윗단 동굴 | 남 → 필드 남쪽, 북 → 안개못 폐촌 |
| 눈 덮인 두 단 고갯길 | forest_harmony_snow | 80×80 | 두 단 고갯길 + 못이 얼음판 | 북 → 얼어붙은 안개못 |
| 용암 강 벼랑길 | forest_harmony_volcano | 100×72 | 벼랑길의 여울이 용암 강·용암 폭포, 현무암 다리, 화산 봉우리 | 남 → 잿빛 여울성, 북 → 용암못 폐촌 |
| 오아시스 세 갈래길 | forest_harmony_desert | 96×64 | 세 갈래길의 못이 오아시스, 야자·선인장 | 서 → 모래 물굽이 포구, 북 → 사암 층바위 협곡마을 |
| 단풍 여울 벼랑길 | forest_harmony_autumn | 100×72 | 벼랑길 그대로 가을빛 | 남 → 가을 두 폭포 강마을, 북 → 가을 종탑 언덕 교구 |

| 파일 | 내용 |
|---|---|
| `catalog.json` | 계획(출구·절벽·계단·강·다리·숲 덩이·소품·기후 편집·검사 목표)과 맵 7장 |
| `validation.json` | 첫 출구에서 모든 출구·계단 끝·다리 끝·동굴 앞(+얼음판)까지 런타임 `canMove`로 닿는지, 계단 없이 윗단에 못 오르는지, 쓴 숲 무늬 씨앗 |
| `images/` | 앱 렌더러로 그린 그림 |
| `*.md` | 공용 AI 문서 사본(`src/assets/sharedFieldRouteReferences.json`과 같은 본문) |
| `storage-proof.json` | 정본 `.oprn-projects/field-routes-20260923` 저장·재오픈 증명 |

재생성 순서(렌더·캡처는 dev 서버 `npm run dev:worktree`가 떠 있어야 한다. 기후 시트가 바뀌었으면 `tiledata/climate-villages/README.md`의 앞 두 단계를 먼저):

```bash
node scripts/content/author-field-routes.mjs              # 숲 필드 셋 + 기후 필드 넷, 검사 실패하면 멈춤 (FIELD_ONLY=<id> 한 필드만)
DEV_URL=http://127.0.0.1:<port> node scripts/content/render-field-routes.mjs
node scripts/content/prepare-field-routes-references.mjs
node scripts/content/save-field-routes.mjs
node scripts/content/prepare-field-routes-regions.mjs output/evidence/field-routes/reloaded.json
BASE=http://127.0.0.1:<port> node scripts/qa/capture-climate-villages.mjs field-routes
```

- 숲 필드는 숲마을 「다양한 마을」 타일셋(forest_harmony + 이식 2550~2729)을 쓴다. 번들 forest_harmony(2550칸)에는 수관·절벽·폭포·다리 이식 번호가 없으니 내려받기의 타일셋을 함께 쓴다. 기후 필드는 이식이 구워진 기후 시트라 번호를 그대로 쓴다.
- 절벽 끝은 반드시 숲에 묻는다. 숲 줄기 수리가 얇은 숲 가장자리를 깎아 절벽 끝이 뚫리면(계단 없이 윗단에 닿으면) 검사가 실패하고, 저작기는 숲 무늬 씨앗만 하나 올려 다시 칠한다. 쓴 씨앗은 `validation.json`의 `forestSeed`.
- 수관 안에 갇힌 40칸 미만 풀밭은 수관으로 메운다(`sealedPocketCells`).
- 기후 편집(얼리기·화산 봉우리·사막 식물)은 기후 마을과 같은 `scripts/content/lib/climate-edits.mjs`.
- 분류는 `field-routes-*-v5`(v2 정확한 폭, v3 폭 2 조각 제거, v4 수관 잎 채움, v5 야외 장소 추가), 설원 `field-routes-snow-v6`(v6 서리성 요새 성벽에 눈 쌓인 사본), 화산·사막 `field-routes-volcano-v6`·`field-routes-desert-v6`(v6 빈칸을 기후 지형으로: 흩은 바위·꽃 관목·나무 자리 선인장·잎 달린 덤불을 걷고 용암 판·균열·웅덩이 / 사구 벌판·모래 물결·갈라진 땅·메사·선인장 무리로 필드 게이트 ≤5·≤50%를 넘긴다 — `author-field-routes.mjs` 의 `ground`). v5 부터 같은 분류에 [야외 장소](../rpg-outdoors/README.md) 문서가 함께 들어가고, 월드 칩셋에 `rpg-outdoors-world-v1` 분류가 생겼다. 저장·등록 스크립트 둘(`save-field-routes`·`prepare-field-routes-regions`)이 야외 장소 24곳도 같은 정본 프로젝트·스냅샷(`regionReferences/field-routes.json`)으로 다룬다. 개정할 때는 먼저 `node scripts/content/record-previous-references.mjs src/assets/sharedFieldRouteReferences.json tiledata/field-routes/previous-reference.json` 으로 배포본을 기록한 뒤 id 를 올린다. `ensureFieldRouteReferences` 는 기록과 정확히 같은 옛 사본만 은퇴시키고 고친 사본은 남긴다.
- 줄기는 수관 밑변과 정확히 같은 폭(`forestTrunkTiles.ts`). 밑변보다 넓게 옆 수관 밑으로 넣거나 옛 4칸 마감을 쓰면 몸통이 반쯤 잘려 보이고, 폭 2 조각은 가는 뿌리가 매달린 것처럼 보인다(최소 폭 3). 숲 수관에 갇힌 빈터를 메울 때는 그 위 수관 밑의 줄기 첫 행도 함께 지운다. 다시 그린 뒤 `node scripts/content/check-forest-trunks.mjs` 가 0 을 내야 한다.
- 수관 속은 잎으로 채운 깊이 변형이다(얕은 속 2568·2597~2601, 깊은 속 2602~2607 — [수관 잎 채움](../forest-villages/canopy-leaves/README.md)). 숲 윤곽 붓이 칠할 때 고르고, 빈터를 메운 뒤에는 저작기가 `shadeForestCanopy` 로 다시 고른다.
