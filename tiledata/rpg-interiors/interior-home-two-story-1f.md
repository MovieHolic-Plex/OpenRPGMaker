# 민가 · 2층 집 1층

네 식구가 사는 2층 집의 아래층. 왼쪽 돌바닥 부엌(화덕·솥·조리대), 가운데 식탁, 오른쪽 거실(벽난로·책장·쿠션 의자), 동벽 계단으로 2층 침실에 오른다.

크림 벽, 부엌 4×5(돌바닥 42)와 거실 10×5를 칸막이로 나눴다(문 (6,7)). 부엌에 작은 빵 화덕·불 피운 솥 걸이·향신료 선반·조리대·당근 상자·밀가루 포대, 거실에 붉은 러그 위 식탁과 의자 둘·괘종시계 389/419, 장작 벽난로 앞 청록 러그와 쿠션 긴 의자, 두꺼운 책장, 동벽에 붙은 오르막 계단(x=16, 바닥 위), 문 옆 옷걸이·신발 받침대. 19×13, tilesetId=tibo_interior_expanded. 입구 (9,10). 통행 검사 목표 [[8,8],[16,8],[3,7],[13,9]].

![민가 · 2층 집 1층](images/interior-home-two-story-1f.png)

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.
```json
[
  {
    "kind": "tibo-kit",
    "kitId": "tibo-bread-oven",
    "name": "작은 빵 화덕",
    "x": 2,
    "y": 5,
    "w": 2,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-hanging-pot",
    "name": "솥 걸이",
    "x": 4,
    "y": 5,
    "w": 2,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-011",
    "name": "향신료 선반",
    "x": 3,
    "y": 3,
    "w": 1,
    "h": 1,
    "role": "hang"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-prep-table",
    "name": "조리대",
    "x": 2,
    "y": 8,
    "w": 3,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-018",
    "name": "당근 상자",
    "x": 5,
    "y": 8,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-013",
    "name": "밀가루 포대",
    "x": 5,
    "y": 9,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-red-carpet",
    "x": 8,
    "y": 6,
    "w": 3,
    "h": 3,
    "role": "rug"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-026",
    "name": "정사각 식탁",
    "x": 9,
    "y": 6,
    "w": 1,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v7-1-2",
    "name": "붉은 방석 의자",
    "x": 8,
    "y": 7,
    "w": 1,
    "h": 1,
    "role": "seat"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 10,
    "y": 7,
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
    "x": 7,
    "y": 4,
    "w": 1,
    "h": 2,
    "rows": [
      [
        389
      ],
      [
        419
      ]
    ],
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-medieval-stone-fireplace",
    "name": "장작 벽난로",
    "x": 11,
    "y": 3,
    "w": 3,
    "h": 3,
    "role": "furn"
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-teal-carpet",
    "x": 10,
    "y": 7,
    "w": 4,
    "h": 2,
    "role": "rug"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-warm-bench",
    "name": "쿠션 긴 의자",
    "x": 11,
    "y": 7,
    "w": 2,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-bookcase",
    "name": "두꺼운 책장",
    "x": 14,
    "y": 4,
    "w": 2,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tiles",
    "layer": "lower",
    "x": 16,
    "y": 5,
    "w": 1,
    "h": 3,
    "rows": [
      [
        111
      ],
      [
        141
      ],
      [
        171
      ]
    ],
    "role": "stairs"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-coat-rack",
    "name": "옷걸이",
    "x": 15,
    "y": 8,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-boot-rack",
    "name": "신발 받침대",
    "x": 7,
    "y": 9,
    "w": 2,
    "h": 1,
    "role": "furn"
  }
]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
