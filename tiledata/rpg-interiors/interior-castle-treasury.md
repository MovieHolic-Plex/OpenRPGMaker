# 성 · 보물고

왕실 보물을 넣어 두는 작은 방. 문 양옆 갑옷 전시대가 지키고, 가운데 돌 제단의 수정구가 가장 귀한 보물, 양옆 벽에 전설의 무기·방패·갑옷, 바닥에 궤짝과 금속 주괴.

금벽돌 벽·돌바닥 42, 12×5칸(작다). 뒷벽 가운데 작은 돌 제단과 수정구 받침, 방패 벽 장식 둘, 검 진열대 263/293 둘, 벽에 건 갑옷 290·방패 262·검 260·망치 261, 왼쪽 여행용 궤짝 둘·봉인 상자·수정 표본 쟁반·주괴 더미·목걸이 321, 오른쪽 궤짝 둘·금고함·룬 석판·주괴 더미, 문 양옆 갑옷 전시대 87/117, 문에서 제단까지 붉은 카펫. 16×13, tilesetId=tibo_interior_expanded. 입구 (8,10). 통행 검사 목표 [[8,6],[3,6],[12,6]].

![성 · 보물고](images/interior-castle-treasury.png)

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.
```json
[
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-red-carpet",
    "x": 7,
    "y": 7,
    "w": 3,
    "h": 3
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-162",
    "name": "작은 돌 제단",
    "x": 7,
    "y": 5,
    "w": 2,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-crystal-stand",
    "name": "수정구 받침",
    "x": 9,
    "y": 4,
    "w": 1,
    "h": 2
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-221",
    "name": "방패 벽 장식",
    "x": 5,
    "y": 3,
    "w": 1,
    "h": 2
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-221",
    "name": "방패 벽 장식",
    "x": 11,
    "y": 3,
    "w": 1,
    "h": 2
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 3,
    "y": 4,
    "w": 1,
    "h": 2,
    "rows": [
      [
        263
      ],
      [
        293
      ]
    ]
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 12,
    "y": 4,
    "w": 1,
    "h": 2,
    "rows": [
      [
        263
      ],
      [
        293
      ]
    ]
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 2,
    "y": 4,
    "w": 1,
    "h": 1,
    "rows": [
      [
        290
      ]
    ]
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 13,
    "y": 4,
    "w": 1,
    "h": 1,
    "rows": [
      [
        262
      ]
    ]
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 4,
    "y": 3,
    "w": 1,
    "h": 1,
    "rows": [
      [
        260
      ]
    ]
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 10,
    "y": 3,
    "w": 1,
    "h": 1,
    "rows": [
      [
        261
      ]
    ]
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-045",
    "name": "여행용 궤짝",
    "x": 2,
    "y": 7,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-045",
    "name": "여행용 궤짝",
    "x": 2,
    "y": 9,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-045",
    "name": "여행용 궤짝",
    "x": 13,
    "y": 7,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-045",
    "name": "여행용 궤짝",
    "x": 13,
    "y": 9,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-100",
    "name": "금속 주괴 더미",
    "x": 3,
    "y": 9,
    "w": 2,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-100",
    "name": "금속 주괴 더미",
    "x": 11,
    "y": 9,
    "w": 2,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-238",
    "name": "자물쇠 금고함",
    "x": 12,
    "y": 7,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v10-1-0",
    "name": "봉인 상자",
    "x": 3,
    "y": 7,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-165",
    "name": "수정 표본 쟁반",
    "x": 3,
    "y": 5,
    "w": 2,
    "h": 1
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 5,
    "y": 9,
    "w": 1,
    "h": 1,
    "rows": [
      [
        321
      ]
    ]
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v10-1-1",
    "name": "룬 석판",
    "x": 12,
    "y": 5,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 6,
    "y": 8,
    "w": 1,
    "h": 2,
    "rows": [
      [
        87
      ],
      [
        117
      ]
    ]
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 10,
    "y": 8,
    "w": 1,
    "h": 2,
    "rows": [
      [
        87
      ],
      [
        117
      ]
    ]
  }
]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
