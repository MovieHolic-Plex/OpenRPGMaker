# 굽이숲 수관 잎 채움 (K · 잎 채움, 2026-09-24 승인)

`forest_harmony_grove_47` 수관은 얇은 잎 테두리 안이 한 가지 어두운 색(초록 시트 (5,28,18))의 평평한 판이었다.
그 평평한 색 화소만 **테두리 자신의 잎**으로 채운다. 테두리는 그대로다.

- 잎 무늬: 북쪽 가장자리 칸(mask 110)의 4..7행 띠를 한 칸에 네 줄로 쌓고, 줄마다 무작위로 가로 이동·좌우 반전, 같은 칸 위쪽(8..15열·0..4행)의 수관 꼭대기 하나를 얹는다(평평한 색은 투명). 칸 안에서 이음매 없이 돈다. 무늬 6종(씨앗 40..45).
- 깊이별 밝기: 가장자리 칸(46칸)의 평평한 부분 ×0.78 / 얕은 속 ×0.60 / 깊은 속 ×0.46.
  속 칸 = 8방향이 모두 수관(mask 255). 2칸 안(체비쇼프 2)에 수관 아닌 칸이나 맵 밖이 있으면 얕은 속, 없으면 깊은 속.
- 칸 번호(모든 시트 공통, 수관 시작 2550 기준): 가장자리 2550..2596 제자리, 얕은 속 `[2568, 2597..2601]`, 깊은 속 `[2602..2607]`.
  2597..2607 은 원래 수관 이식의 빈 채움 칸(라벨 「굽이숲 수관」)이었다. 설원 얼음 사본(2730~)·절벽(2670~)과 겹치지 않는다.
  오토타일 그룹의 `interiorVariants`(깊이 순) 와 `memberTileIds`/`connectTileIds` 에 모두 든다.
- 초록 원본: `tex_forest_cliff_reference`(절벽마을 아틀라스)의 수관 원본 47칸을 제자리에서, 속 변형 11칸은 아틀라스 빈칸 2524..2534 에 굽고 이식으로 붙인다.
  기후 시트(설원·화산·사막·가을)는 자기 시트의 테두리·평평한 색으로 같은 규칙을 굽는다(`build-climate-chipsets.py` 마지막 단계).
- `flat-canopy.png`: 채우기 전 초록 수관 47칸(오프셋 순). 어느 화소가 「평평한 색」인지는 이 그림에서 정한다 — 다시 구울 때 늘 여기서 시작하므로 여러 번 돌려도 같다.

```bash
python3 scripts/content/bake-forest-canopy-leaves.py      # 초록 아틀라스
python3 scripts/content/build-climate-chipsets.py         # 기후 시트 넷(재칠 + 잎 채움)
node scripts/content/shade-forest-canopy.mjs <catalog.json>   # 이미 그린 맵의 속 칸을 깊이 변형으로(제자리)
```

칠하는 도구는 `paintContouredForest`·`paintForestGroves`·`refitForestTrunks` 끝에서 `shadeForestCanopy`(→ `shadeAutotileInterior`)로 속 칸을 고른다.
위치 해시로 고르므로 같은 마스크를 다시 칠하면 같은 칸이 나온다. 속 변형 없는 옛 그룹은 불러올 때 `ensureForestGroveInterior` 가 채움 칸에 더한다.
