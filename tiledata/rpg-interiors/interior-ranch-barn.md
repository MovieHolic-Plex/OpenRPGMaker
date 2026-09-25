# 목장 · 마구간 헛간

목장 일꾼이 말과 소를 돌보는 헛간. 북벽 먹이통 앞 짚 깔개 칸이 가축 자리이고, 가운데 물통에서 물을 떠 주며, 오른쪽 곡식 자루로 먹이를 채운다. 벽의 마구와 안장을 챙겨 말을 내고, 손수레로 짐을 나른다. 왼쪽 앞은 우유를 휘젓고 달걀을 모으는 자리.

통나무 벽 1980~1985·흙바닥 192, 18×7칸. 북벽 마구간 먹이통 3×2 셋(x=2·6·14) 앞마다 짚 깔개 3×3 칸과 물 양동이, 가운데 물통 3×2, 오른쪽 식재료 자루 3×2·밀가루 포대·목제 손수레 3×3, 먹이통 사이 마구 걸이 셋, 문 곁 안장 받침대, 왼쪽 앞 버터 교반통·달걀 바구니·막대 양동이, 기댄 빗자루. 22×14, tilesetId=tibo_interior_expanded. 입구 (10,12). 통행 검사 목표 [[3,9],[7,9],[15,9],[11,6],[16,10]].

![목장 · 마구간 헛간](images/interior-ranch-barn.png)

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.
```json
[
  {
    "kind": "tibo-kit",
    "kitId": "tibo-medieval-hay-trough",
    "name": "마구간 먹이통",
    "x": 2,
    "y": 4,
    "w": 3,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "rug",
    "tiles": 139,
    "x": 2,
    "y": 6,
    "w": 3,
    "h": 3,
    "role": "rug"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-medieval-hay-trough",
    "name": "마구간 먹이통",
    "x": 6,
    "y": 4,
    "w": 3,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "rug",
    "tiles": 139,
    "x": 6,
    "y": 6,
    "w": 3,
    "h": 3,
    "role": "rug"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-medieval-hay-trough",
    "name": "마구간 먹이통",
    "x": 14,
    "y": 4,
    "w": 3,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "rug",
    "tiles": 139,
    "x": 14,
    "y": 6,
    "w": 3,
    "h": 3,
    "role": "rug"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-water-tub",
    "name": "물통",
    "x": 10,
    "y": 4,
    "w": 3,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-grain-sacks",
    "name": "식재료 자루",
    "x": 17,
    "y": 4,
    "w": 3,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-204",
    "name": "마구 걸이",
    "x": 5,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-204",
    "name": "마구 걸이",
    "x": 9,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-204",
    "name": "마구 걸이",
    "x": 13,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-203",
    "name": "안장 받침대",
    "x": 11,
    "y": 9,
    "w": 2,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-medieval-handcart",
    "name": "목제 손수레",
    "x": 17,
    "y": 8,
    "w": 3,
    "h": 3,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-013",
    "name": "밀가루 포대",
    "x": 16,
    "y": 6,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-butter-churn",
    "name": "버터 교반통",
    "x": 2,
    "y": 10,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-023",
    "name": "달걀 바구니",
    "x": 3,
    "y": 11,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v6-2-1",
    "name": "막대 양동이",
    "x": 4,
    "y": 11,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-061",
    "name": "기댄 빗자루",
    "x": 7,
    "y": 10,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v6-1-1",
    "name": "물 양동이",
    "x": 13,
    "y": 6,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v6-1-1",
    "name": "물 양동이",
    "x": 5,
    "y": 6,
    "w": 1,
    "h": 1,
    "role": "furn"
  }
]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
