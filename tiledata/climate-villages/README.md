# 기후 마을 — 설원·화산

숲마을 칩셋(이식 포함)을 한 장으로 구워 기후별로 다시 칠한 두 칩셋과, 그 위에 그린 마을 여섯 곳.
칸 번호·통행은 숲마을(`forest_harmony`)과 같아서 숲마을 조립·문서를 그대로 쓴다. 지형 참고 사례이고 이벤트는 없다.

| 타일셋 | 시트 | 칸 | 바뀐 것 |
|---|---|---|---|
| `forest_harmony_snow` 설원 마을 | `public/assets/climate-villages/snow-chipset.png` | 2868 | 잔디→눈, 수관·지붕에 눈, 물은 그대로. 2730~는 물 칸의 얼음 사본(걸을 수 있음) |
| `forest_harmony_volcano` 화산 마을 | `public/assets/climate-villages/volcano-chipset.png` | 2730 | 잔디→재, 잎 그을림, 물 칸 전부 용암, 나무다리→현무암 다리 |

| 파일 | 내용 |
|---|---|
| `sheets.json` | 시트 제작 결과: 칸 수, 물→얼음 대응표, 용암 칸, 현무암 다리 칸, 지붕 칸 |
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
- 못을 얼릴 때는 한 덩어리를 통째로 대응표로 바꾼다. 일부만 바꾸면 물과 얼음 사이에 물가 테두리가 없다.
- 분류(`climate-*-v1`)는 추가만 한다(`ensureClimateVillageReferences`). 개정하면 은퇴 목록부터 만들 것.
- 시트를 다시 칠하면 `prepare-climate-tilesets.mjs`부터 다시 돌린다(얼음 칸 수가 바뀌면 타일셋 칸 수도 바뀐다).
