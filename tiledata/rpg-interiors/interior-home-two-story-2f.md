# 민가 · 2층 집 2층

2층 집의 위층 침실. 계단을 오르면 가운데 계단참, 왼쪽이 부부 방(큰 침대·옷장·화장대), 오른쪽이 아이 방(작은 침대·책상·장난감).

방 셋(부부 6×5·계단참 3×5·아이 4×5)을 칸막이로 나누고 칸막이 가운데 줄을 틔웠다. 부부 방 목제 침대 3×3·협탁·옷장 2×3·화장대·전신 거울·궤짝, 계단참 린넨 장·화분·그림과 내려가는 계단 474, 아이 방 침대 324/354·독서 탁자와 의자·목마·장난감 상자·헝겊 인형·곰 인형. 19×13, tilesetId=tibo_interior_expanded. 입구 (10,9). 통행 검사 목표 [[4,7],[14,8]].

![민가 · 2층 집 2층](images/interior-home-two-story-2f.png)

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.
```json
[
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-bed",
    "name": "목제 침대",
    "x": 2,
    "y": 4,
    "w": 3,
    "h": 3
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-039",
    "name": "침대 옆 협탁",
    "x": 5,
    "y": 5,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-wardrobe",
    "name": "옷장",
    "x": 6,
    "y": 4,
    "w": 2,
    "h": 3
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-040",
    "name": "화장대",
    "x": 2,
    "y": 9,
    "w": 2,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-041",
    "name": "타원 전신 거울",
    "x": 7,
    "y": 8,
    "w": 1,
    "h": 2
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-045",
    "name": "여행용 궤짝",
    "x": 4,
    "y": 9,
    "w": 1,
    "h": 1
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
        54
      ]
    ]
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 10,
    "y": 9,
    "w": 1,
    "h": 1,
    "rows": [
      [
        474
      ]
    ]
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-059",
    "name": "린넨 장",
    "x": 9,
    "y": 4,
    "w": 1,
    "h": 2
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 11,
    "y": 5,
    "w": 1,
    "h": 1,
    "rows": [
      [
        288
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
        84
      ]
    ]
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 13,
    "y": 5,
    "w": 1,
    "h": 2,
    "rows": [
      [
        324
      ],
      [
        354
      ]
    ]
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-181",
    "name": "목마",
    "x": 16,
    "y": 9,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-186",
    "name": "열린 장난감 상자",
    "x": 13,
    "y": 9,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-183",
    "name": "헝겊 인형",
    "x": 16,
    "y": 4,
    "w": 1,
    "h": 2
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v4-4-2",
    "name": "독서 탁자",
    "x": 15,
    "y": 5,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 15,
    "y": 6,
    "w": 1,
    "h": 1,
    "rows": [
      [
        268
      ]
    ]
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-184",
    "name": "곰 인형",
    "x": 15,
    "y": 9,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 14,
    "y": 3,
    "w": 1,
    "h": 1,
    "rows": [
      [
        54
      ]
    ]
  }
]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
