# 교회 · 예배당

사제가 예배를 올리고 마을 사람이 앉아 기도하는 곳. 교구마을 「교회 언덕」의 석벽 교회(스테인드글라스 두 장, 가운데 문)와 짝을 이룬다.

석벽·회색 돌바닥 42. 앞쪽(북쪽) 제단부를 무늬 석판 163으로 깔고 제단 3×2 뒤 벽에 성녀 석상 88/118, 벽에 스테인드글라스 144 넷, 양옆 촛대 탁자·설교대 독서대. 문에서 제단까지 폭3 붉은 카펫, 좌우로 제단을 향해 앉는 뒷모습 긴 의자 4×2(2070~2077) 세 줄씩, 옆 통로에 기둥 89/119와 촛대, 제단부 앞 무릎 꿇는 붉은 카펫 한 줄과 화분 둘. 19×18, tilesetId=tibo_interior_expanded. 입구 (9,16), 주인·담당 자리 (9,7). 통행 검사 목표 [[9,7],[3,9],[15,14]].

![교회 · 예배당](images/interior-church-nave.png)

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.
```json
[
  {
    "kind": "floor",
    "tile": 163,
    "x": 4,
    "y": 5,
    "w": 11,
    "h": 3,
    "role": "floor"
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-red-carpet",
    "x": 8,
    "y": 8,
    "w": 3,
    "h": 8,
    "role": "rug"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-altar",
    "name": "제단",
    "x": 8,
    "y": 5,
    "w": 3,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 9,
    "y": 3,
    "w": 1,
    "h": 2,
    "rows": [
      [
        88
      ],
      [
        118
      ]
    ],
    "role": "hang"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 3,
    "y": 3,
    "w": 1,
    "h": 1,
    "rows": [
      [
        144
      ]
    ],
    "role": "hang"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 5,
    "y": 3,
    "w": 1,
    "h": 1,
    "rows": [
      [
        144
      ]
    ],
    "role": "hang"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 13,
    "y": 3,
    "w": 1,
    "h": 1,
    "rows": [
      [
        144
      ]
    ],
    "role": "hang"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 15,
    "y": 3,
    "w": 1,
    "h": 1,
    "rows": [
      [
        144
      ]
    ],
    "role": "hang"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v4-5-2",
    "name": "촛대 탁자",
    "x": 6,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v4-5-2",
    "name": "촛대 탁자",
    "x": 12,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-lectern",
    "name": "독서대",
    "x": 12,
    "y": 6,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-atlas-pew-back",
    "name": "뒷모습 긴 의자(북쪽을 봄)",
    "x": 4,
    "y": 9,
    "w": 4,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-atlas-pew-back",
    "name": "뒷모습 긴 의자(북쪽을 봄)",
    "x": 11,
    "y": 9,
    "w": 4,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-atlas-pew-back",
    "name": "뒷모습 긴 의자(북쪽을 봄)",
    "x": 4,
    "y": 11,
    "w": 4,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-atlas-pew-back",
    "name": "뒷모습 긴 의자(북쪽을 봄)",
    "x": 11,
    "y": 11,
    "w": 4,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-atlas-pew-back",
    "name": "뒷모습 긴 의자(북쪽을 봄)",
    "x": 4,
    "y": 13,
    "w": 4,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-atlas-pew-back",
    "name": "뒷모습 긴 의자(북쪽을 봄)",
    "x": 11,
    "y": 13,
    "w": 4,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 2,
    "y": 8,
    "w": 1,
    "h": 2,
    "rows": [
      [
        89
      ],
      [
        119
      ]
    ],
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 16,
    "y": 8,
    "w": 1,
    "h": 2,
    "rows": [
      [
        89
      ],
      [
        119
      ]
    ],
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 2,
    "y": 12,
    "w": 1,
    "h": 2,
    "rows": [
      [
        89
      ],
      [
        119
      ]
    ],
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 16,
    "y": 12,
    "w": 1,
    "h": 2,
    "rows": [
      [
        89
      ],
      [
        119
      ]
    ],
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 2,
    "y": 11,
    "w": 1,
    "h": 1,
    "rows": [
      [
        204
      ]
    ],
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 16,
    "y": 11,
    "w": 1,
    "h": 1,
    "rows": [
      [
        204
      ]
    ],
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 2,
    "y": 15,
    "w": 1,
    "h": 1,
    "rows": [
      [
        204
      ]
    ],
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 16,
    "y": 15,
    "w": 1,
    "h": 1,
    "rows": [
      [
        204
      ]
    ],
    "role": "furn"
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-red-carpet",
    "x": 5,
    "y": 7,
    "w": 9,
    "h": 1,
    "role": "rug"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 4,
    "y": 6,
    "w": 1,
    "h": 1,
    "rows": [
      [
        288
      ]
    ],
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 14,
    "y": 6,
    "w": 1,
    "h": 1,
    "rows": [
      [
        288
      ]
    ],
    "role": "furn"
  }
]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
