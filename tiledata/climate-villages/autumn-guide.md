# 가을 마을 — 단풍 든 숲마을

tilesetId=forest_harmony_autumn, 시트 tex_forest_harmony_autumn(30열·16px, 2730칸). 좌표는 0기준.

## 공통 — 숲마을과 같은 번호
- 시트는 「숲마을 · 거리별 잔디」(forest_harmony)와 그 이식 칸(2550~2729)을 **한 장으로 구운 뒤 화소만 다시 칠한 것**이다. 0~2729번 칸의 뜻·통행·우선순위·오토타일은 숲마을과 같다.
- 그래서 집·절벽·계단·흙길·숲 수관 조립, 공용 숲마을 문서(다양한 마을·컨셉 마을)의 배치 규칙과 번호를 **그대로** 쓴다. 숲마을 맵을 기후판으로 바꿀 때는 맵의 tilesetId만 바꾸면 모양이 그대로 유지된다.
- 이식(tileGrafts)이 없다. 이식 그림은 이미 시트에 구워져 있으므로 이 타일셋에 새로 이식하지 말 것.
- 라벨은 기후에 맞게 앞말이 붙어 있다(예: 「눈 덮인 잔디」, 「용암 · 물 오토타일」). 번호 뜻은 숲마을 라벨과 같다.
- 한 맵에서 숲마을 타일셋과 기후 타일셋을 섞을 수 없다(맵 하나 = 타일셋 하나). 기후가 바뀌는 경계는 맵을 나눠 만든다.

## 무엇이 바뀌었나
- 땅: 잔디·풀 칸이 금빛 가을 풀밭이 된다. 흙길·돌길·절벽은 그대로.
- 숲: 숲 벽과 수관이 단풍(그늘 → 짙은 적갈색, 중간 → 주황, 밝은 잎 → 금빛)이 된다.
- 나무: 3×4 활엽수(978~980·1008~1010 수관)는 **노란 잎**, 둥근 덤불·작은 덤불은 **붉은 잎**이다. 숲마을 나무 도장을 그대로 쓰면 된다.
- 물·지붕·벽은 원래 색. 통행·오토타일은 숲마을과 같다.
- 편집은 없다: 숲마을 맵의 tilesetId만 forest_harmony_autumn으로 바꾸면 가을판이 된다.

## 검사
마을 입구에서 런타임 이동 규칙(canMove)으로 모든 집 문 앞에 닿는지 확인했다.
```bash
python3 scripts/content/build-climate-chipsets.py     # 시트 두 장 + sheets.json
node scripts/content/prepare-climate-tilesets.mjs    # 타일셋 정의
node scripts/content/author-climate-villages.mjs     # 맵 + 통행 검사(실패하면 멈춤)
```

```json
[{"id":"climate-autumn-twin-falls","entry":[24,68],"targets":[[17,15],[61,14],[14,39],[31,36],[53,37],[74,38],[12,63],[59,63]],"reachable":2425,"blocked":[]},{"id":"climate-autumn-chapel-hill","entry":[40,60],"targets":[[47,14],[68,14],[14,40],[27,44],[48,41],[14,58],[49,56]],"reachable":2071,"blocked":[]}]
```

## 실제 구분
- 가을 두 폭포 강마을 (climate-autumn-twin-falls, 88×72, 원본 숲마을 twin-falls-river-village): 단풍 든 숲에서 나온 강이 두 줄 절벽을 폭포로 떨어지는 가을 강마을. 금빛 풀밭에 노란 활엽수와 붉은 덤불이 있다.
- 가을 종탑 언덕 교구 (climate-autumn-chapel-hill, 80×64, 원본 숲마을 chapel-hill-parish): 단풍 숲으로 둘러싸인 언덕 위 종탑 교구. 금빛 풀밭의 계단 길과 묘지, 폭포 아래 소가 가을빛이다.
