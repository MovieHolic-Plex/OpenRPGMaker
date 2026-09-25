# 설원 · 촌장집

설원 마을 촌장의 통나무 집. 가운데 응접실에서 큰 벽난로를 등지고 마을 사람과 연회 식탁에 둘러앉아 겨울 채비를 의논하고, 왼쪽 서재에서 장부를 보며, 오른쪽이 촌장 부부의 침실.

통나무 벽·나무 바닥 72, 방 셋(서재 6×7·응접실 9×7·침실 6×7)을 세로 칸막이로 나누고 칸막이 천장을 북쪽 천장까지 이었다(문 (8,9)·(18,9)). 서재 문서 분류장·지구본·책장 수납장 3×3·청록 러그 위 필경사 책상, 응접실 장작 벽난로·장작 바구니·장작 받침대·사슴뿔 벽판·강 지도 액자·방패 벽 장식·식기장·흰 모피 깔개 위 연회 식탁과 의자 넷, 침실 목제 침대·협탁·옷장·궤짝·흰 모피 깔개·세면대. 27×15, tilesetId=tibo_interior_expanded. 입구 (13,12), 주인·담당 자리 (4,7). 통행 검사 목표 [[4,7],[13,10],[21,8],[10,7]].

![설원 · 촌장집](images/interior-snow-chief-house.png)

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.
```json
[
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-078",
    "name": "문서 분류장",
    "x": 2,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v12-1-2",
    "name": "지구본",
    "x": 3,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v3-1-0",
    "name": "책장 수납장",
    "x": 5,
    "y": 3,
    "w": 3,
    "h": 3,
    "role": "furn"
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-teal-carpet",
    "x": 2,
    "y": 7,
    "w": 5,
    "h": 4,
    "role": "rug"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-medieval-scribe-desk",
    "name": "필경사 책상",
    "x": 3,
    "y": 8,
    "w": 3,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-medieval-stone-fireplace",
    "name": "장작 벽난로",
    "x": 9,
    "y": 3,
    "w": 3,
    "h": 3,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v8-1-2",
    "name": "장작 바구니",
    "x": 12,
    "y": 5,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-223",
    "name": "사슴뿔 벽판",
    "x": 13,
    "y": 3,
    "w": 2,
    "h": 2,
    "role": "hang"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v6-2-0",
    "name": "강 지도 액자",
    "x": 15,
    "y": 3,
    "w": 2,
    "h": 1,
    "role": "hang"
  },
  {
    "kind": "rug",
    "tiles": 2004,
    "x": 11,
    "y": 7,
    "w": 6,
    "h": 4,
    "role": "rug"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-medieval-banquet-table",
    "name": "연회용 긴 식탁",
    "x": 12,
    "y": 7,
    "w": 4,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 13,
    "y": 9,
    "w": 1,
    "h": 1,
    "rows": [
      [
        268
      ]
    ],
    "role": "seat"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 14,
    "y": 9,
    "w": 1,
    "h": 1,
    "rows": [
      [
        268
      ]
    ],
    "role": "seat"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 11,
    "y": 8,
    "w": 1,
    "h": 1,
    "rows": [
      [
        297
      ]
    ],
    "role": "seat"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 16,
    "y": 8,
    "w": 1,
    "h": 1,
    "rows": [
      [
        298
      ]
    ],
    "role": "seat"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-warm-crockery",
    "name": "따뜻한 목재 식기장",
    "x": 16,
    "y": 4,
    "w": 2,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-235",
    "name": "장작 받침대",
    "x": 9,
    "y": 10,
    "w": 2,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-221",
    "name": "방패 벽 장식",
    "x": 17,
    "y": 3,
    "w": 1,
    "h": 2,
    "role": "hang"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-bed",
    "name": "목제 침대",
    "x": 19,
    "y": 4,
    "w": 3,
    "h": 3,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-039",
    "name": "침대 옆 협탁",
    "x": 22,
    "y": 5,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-wardrobe",
    "name": "옷장",
    "x": 23,
    "y": 4,
    "w": 2,
    "h": 3,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-washstand",
    "name": "세면대",
    "x": 22,
    "y": 9,
    "w": 3,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-045",
    "name": "여행용 궤짝",
    "x": 20,
    "y": 7,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 20,
    "y": 3,
    "w": 1,
    "h": 1,
    "rows": [
      [
        54
      ]
    ],
    "role": "hang"
  },
  {
    "kind": "rug",
    "tiles": 2004,
    "x": 19,
    "y": 8,
    "w": 3,
    "h": 3,
    "role": "rug"
  }
]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
