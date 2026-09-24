# 기후 마을 — 설원·화산·사막·가을

숲마을 칩셋(이식 포함)을 한 장으로 구워 기후별로 다시 칠한 네 칩셋과, 그 위에 그린 마을 열 곳.
같은 시트로 옮긴 마을 사이 필드는 `tiledata/field-routes/`.
칸 번호·통행은 숲마을(`forest_harmony`)과 같아서 숲마을 조립·문서를 그대로 쓴다. 지형 참고 사례이고 이벤트는 없다.

| 타일셋 | 시트 | 칸 | 바뀐 것 |
|---|---|---|---|
| `forest_harmony_snow` 설원 마을 | `public/assets/climate-villages/snow-chipset.png` | 3030 | 잔디→눈, 수관·지붕에 눈, 물은 그대로. 2730~2867은 물 칸의 얼음 사본(걸을 수 있음), 2880~는 눈 얹힌 고목 |
| `forest_harmony_volcano` 화산 마을 | `public/assets/climate-villages/volcano-chipset.png` | 3030 | 잔디→재, 잎 그을림, 물 칸 전부 용암, 나무다리→현무암 다리, 2880~는 그을린 고목 |
| `forest_harmony_desert` 사막 마을 | `public/assets/climate-villages/desert-chipset.png` | 3030 | 잔디→모래, 숲·잎→마른 덤불, 절벽 흙벽→사암, 지붕 흙빛, 물은 오아시스 물 그대로, 2880~는 바랜 고목 |
| `forest_harmony_autumn` 가을 마을 | `public/assets/climate-villages/autumn-chipset.png` | 2730 | 잔디→금빛 풀, 숲→단풍(적갈·주황·금빛), 활엽수 노랑·덤불 빨강 |

| 파일 | 내용 |
|---|---|
| `sheets.json` | 시트 제작 결과: 칸 수, 물→얼음 대응표, 용암 칸, 현무암 다리 칸, 사암 절벽 칸, 지붕 칸 |
| `catalog.json` | 계획(원본 숲마을·기후 편집·입구·검사 목표·집)과 맵 6장 |
| `validation.json` | 입구에서 모든 집 문 앞(+얼음판)까지 런타임 `canMove`로 닿는지 |
| `images/` | 앱 렌더러로 그린 그림(`source-*`는 원본 숲마을) |
| `*.md` | 공용 AI 문서 사본(`src/assets/sharedClimateVillageReferences.json`과 같은 본문) |
| `storage-proof.json` | 정본 `.oprn-projects/climate-villages-20260923` 저장·재오픈 증명 |

재생성 순서(렌더·캡처는 dev 서버 `npm run dev:worktree`가 떠 있어야 한다):

```bash
python3 scripts/content/build-climate-chipsets.py
node scripts/content/prepare-climate-tilesets.mjs
node scripts/content/author-climate-villages.mjs
node scripts/content/render-climate-villages.mjs
node scripts/content/prepare-climate-references.mjs
node scripts/content/save-climate-villages.mjs
node scripts/content/prepare-climate-regions.mjs output/evidence/climate-villages/reloaded.json
node scripts/qa/capture-climate-villages.mjs
```

- 물 판정은 색이 아니라 **물 칸 번호 집합**이다. 색으로 하면 파란 지붕·청회색 성벽까지 용암이 된다.
- 사막·가을은 숲 자체도 칠한다. 수관(이식 2550~2596, `TREE` 밖)·숲 줄기 조립(1350·1422~1433·1453~1463)·layerBacking으로 밑에 깔리는 잔디(1141·1145…)까지 함께 칠해야 초록 점이 안 남는다. 선인장 769·야자 770은 일부러 초록으로 둔다.
- 잎 없는 나무(2026-09-25): `scripts/content/bare-trees.py` 가 설원·화산·사막 시트의 **같은 번호** 2880~3029(96~100행, 30열)에 굽는다 — 큰 4×5 ×3·중간 3×4 ×3·작은 2×3 ×3·마른 덤불 1×1 ×5, 그룹 `bare-trees:big-1…shrub-5`(수관 위층·통과, 밑동 줄 아래층·받침 240·통행 불가, 그림 없는 칸 -1). 사막·화산 시트는 91~95행을 빈칸으로 늘렸고 설원 얼음 칸(2730~2867)과 겹치지 않는다. 가을·숲마을엔 없다.
- 사막·화산 마을(`bare`)은 잎 달린 숲(2550~2609·1200~1463)·나무 도장(960~1123)·덤불 289 를 모두 걷고 잎 없는 고목 **덩이**를 세운다(`lib/bare-trees.mjs` clearLeafyTrees → arrangeBareGroves, 가장자리 띠 8칸·안쪽 13칸, 집·길·문·계단·다리·울타리 2칸 밖). 숲이 가려 주던 절벽 끝은 맵 끝까지 잇거나(`extendClearedCliffEnds`) 윗단 옆 가장자리(2677/2678, `cliffEndLedge`)로 막고, 계단을 닫았을 때 윗단·아랫단이 숲마을보다 더 이어지지 않는지 검사한다(validation.json joinedLevels). 빈칸 게이트는 키큰 풀과 마른 풀밭(`growMeadows`)으로만 넘긴다. 사막 물가 야자는 2~3그루 무리(`plantPalmGroves`). 화산은 E·F 만으로 게이트를 못 넘는 집·길 곁에만 G 를 다시 둔다.
- `dressDesert`(나무 도장 → 야자·선인장)는 이제 필드(`author-field-routes.mjs`)만 쓴다.
- 못을 얼릴 때는 한 덩어리를 통째로 대응표로 바꾼다. 일부만 바꾸면 물과 얼음 사이에 물가 테두리가 없다.
- 분류는 설원·화산·사막 `climate-*-villages-v6`(잎 없는 나무), 가을 `climate-autumn-villages-v5`(v2 정확한 폭, v3 폭 2 조각 제거, v4 수관 잎 채움, v5 마을 채우기 — 아래, v6 잎 없는 나무). 개정할 때는 먼저 `node scripts/content/record-previous-references.mjs src/assets/sharedClimateVillageReferences.json tiledata/climate-villages/previous-reference.json` 으로 배포본을 기록한 뒤 id 를 올린다. `ensureClimateVillageReferences` 는 기록과 정확히 같은 옛 사본만 은퇴시키고 고친 사본은 남긴다.
- 원본 숲마을의 줄기를 다시 맞추면(`scripts/content/refit-forest-trunks.mjs`) 여기 `author-climate-villages.mjs` 부터 다시 돈다. 끝나면 `node scripts/content/check-forest-trunks.mjs` 로 줄기 규칙을 확인한다.
- 수관(2550~2596)은 채우기 전의 평평한 그림(`tiledata/forest-villages/canopy-leaves/flat-canopy.png`)으로 칠한 뒤, 시트마다 마지막에 **그 시트 자신의 잎 테두리**로 속을 채우고 속 변형 11칸(2597~2607)을 굽는다(`scripts/content/lib/canopy_leaves.py`). 규칙은 [수관 잎 채움](../forest-villages/canopy-leaves/README.md).
- 시트를 다시 칠하면 `prepare-climate-tilesets.mjs`부터 다시 돌린다(얼음 칸 수가 바뀌면 타일셋 칸 수도 바뀐다).
- 마을 채우기(v5, 2026-09-24 검수 반영): 원본 숲마을 개정14 를 그대로 옮긴 뒤 기후마다 다시 게이트(5칸 정사각형 없음, 17×13 화면 빈 땅 ≤40%)를 덩이 장면으로 넘긴다(`fillNaturalGaps`). 키큰 풀은 E/F/G(PR #1421) — 시트가 서리·재·마른·단풍 풀로 칠한다. 설원·화산은 집·길 곁 G 를 걷고 새 덩이도 E·F 만(G 없이 게이트를 못 넘는 마을은 G 를 남기고 편집 기록 `buried-grass.kept` 에 적는다). 설원·화산·사막에는 꽃이 없다(덤불에 붙은 꽃은 덤불 289 로). 설원의 활엽수는 눈 덮인 둥근 덤불로, 설원·사막 채우기는 나무 장면을 쓰지 않는다. 설원 종탑 언덕은 강과 소가 얼었다(`freezeRiver`, 폭포만 흐른다).
