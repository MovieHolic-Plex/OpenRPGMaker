# 카지노

돈을 걸고 노는 도박장. 들어오면 오른쪽 뒷벽을 등진 환전 창구(나무 상판 위 돈 서랍·동전 쟁반·금고함)에서 칩을 바꾸고, 청록 카펫 위 카드 탁자·주사위 탁자·체스판에서 놀고, 왼쪽 뒤 바에서 술을 마신다.

금벽돌 벽·돌바닥 42, 18×8칸. 왼쪽 뒤 포도주 선반·술통 선반 앞 바 카운터 4×2와 높은 걸상 둘, 오른쪽 뒤 뒷벽을 등진 환전 탁자(점원 자리 (16,5))와 풍경화·여자 흉상, 가운데 청록 카펫 위 카드 탁자 둘과 양옆 의자, 주사위 탁자(나무 상판 위 주사위 쟁반)와 의자 둘, 체스판 둘과 의자, 뒷벽 업라이트 피아노·다트판, 문 양옆 기둥과 야자 화분. 22×15, tilesetId=tibo_interior_expanded. 입구 (11,13), 주인·담당 자리 (16,5). 통행 검사 목표 [[16,7],[10,9],[3,6]].

![카지노](images/interior-casino.png)

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.
```json
[
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-134",
    "name": "포도주 병 선반",
    "x": 2,
    "y": 4,
    "w": 2,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-ale-rack",
    "name": "술통 선반",
    "x": 4,
    "y": 4,
    "w": 3,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-bar-counter",
    "name": "바 카운터",
    "x": 2,
    "y": 7,
    "w": 4,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-029",
    "name": "높은 걸상",
    "x": 3,
    "y": 9,
    "w": 1,
    "h": 1,
    "role": "seat"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-029",
    "name": "높은 걸상",
    "x": 5,
    "y": 9,
    "w": 1,
    "h": 1,
    "role": "seat"
  },
  {
    "kind": "tabletop",
    "group": "harness-interior-house-v1-terrain-deck",
    "x": 15,
    "y": 6,
    "w": 4,
    "h": 1,
    "role": "tabletop"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-121",
    "name": "돈 서랍",
    "x": 15,
    "y": 6,
    "w": 2,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-122",
    "name": "동전 계산 쟁반",
    "x": 17,
    "y": 6,
    "w": 1,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-238",
    "name": "자물쇠 금고함",
    "x": 18,
    "y": 6,
    "w": 1,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-217",
    "name": "풍경화",
    "x": 16,
    "y": 3,
    "w": 2,
    "h": 1,
    "role": "hang"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 19,
    "y": 4,
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
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v7-1-3",
    "name": "찻잔 탁자",
    "x": 17,
    "y": 9,
    "w": 1,
    "h": 1,
    "role": "table"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 16,
    "y": 9,
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
    "x": 18,
    "y": 9,
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
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-teal-carpet",
    "x": 7,
    "y": 7,
    "w": 8,
    "h": 5,
    "role": "rug"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-140",
    "name": "카드 탁자",
    "x": 8,
    "y": 7,
    "w": 2,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-140",
    "name": "카드 탁자",
    "x": 12,
    "y": 7,
    "w": 2,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 7,
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
    "x": 10,
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
    "x": 14,
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
    "kind": "tabletop",
    "group": "harness-interior-house-v1-terrain-deck",
    "x": 10,
    "y": 10,
    "w": 2,
    "h": 1,
    "role": "tabletop"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-139",
    "name": "주사위 쟁반",
    "x": 10,
    "y": 10,
    "w": 2,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 10,
    "y": 11,
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
    "y": 11,
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
    "kind": "tibo-kit",
    "kitId": "tibo-chessboard",
    "name": "체스판",
    "x": 8,
    "y": 10,
    "w": 1,
    "h": 1,
    "role": "table"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 7,
    "y": 10,
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
    "kind": "tibo-kit",
    "kitId": "tibo-chessboard",
    "name": "체스판",
    "x": 13,
    "y": 10,
    "w": 1,
    "h": 1,
    "role": "table"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 14,
    "y": 10,
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
    "kitId": "tibo-library-169",
    "name": "작은 업라이트 피아노",
    "x": 9,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-138",
    "name": "술집 다트판",
    "x": 11,
    "y": 3,
    "w": 2,
    "h": 2,
    "role": "hang"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 2,
    "y": 11,
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
    "x": 19,
    "y": 11,
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
    "kind": "tibo-kit",
    "kitId": "tibo-library-209",
    "name": "키 큰 실내 야자",
    "x": 16,
    "y": 11,
    "w": 2,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-209",
    "name": "키 큰 실내 야자",
    "x": 4,
    "y": 11,
    "w": 2,
    "h": 2,
    "role": "furn"
  }
]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
