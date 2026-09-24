# 여관 2층 · 객실

여관 손님이 묵는 2층. 1층 계단을 오르면 복도 왼쪽 끝으로 나오고, 복도에서 1인실·2인실·특실로 들어간다.

방 넷(1인실 5×4·2인실 5×4·특실 6×4·복도 18×3)을 파이프라인 칸막이로 나눴다. 1인실 침대 324/354·협탁·대야 받침·의자·궤짝, 2인실 침대 둘·협탁·서랍장, 특실 목제 침대 3×3·협탁·화장대·쿠션 의자·붉은 러그·커튼 창 56, 복도에 린넨 장·이불 더미·그림·랜턴·빗자루·화분. 내려가는 계단 474는 복도 왼쪽 끝 (3,12). 1인실·2인실에 청록 러그, 2인실 의자, 복도에 붉은 러너와 짧은 벤치. 복도 앞벽 화분 셋, 협탁과 꽃병. 23×16, tilesetId=tibo_interior_expanded. 입구 (3,12). 통행 검사 목표 [[5,6],[11,6],[17,7],[19,12]].

![여관 2층 · 객실](images/interior-inn-rooms-2f.png)

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.
```json
[
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 3,
    "y": 4,
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
    "kitId": "tibo-library-039",
    "name": "침대 옆 협탁",
    "x": 4,
    "y": 4,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-050",
    "name": "대야 받침대",
    "x": 7,
    "y": 3,
    "w": 1,
    "h": 2
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 5,
    "y": 2,
    "w": 1,
    "h": 1,
    "rows": [
      [
        54
      ]
    ]
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v7-1-2",
    "name": "붉은 방석 의자",
    "x": 7,
    "y": 6,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-045",
    "name": "여행용 궤짝",
    "x": 3,
    "y": 7,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 9,
    "y": 4,
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
    "kind": "tiles",
    "layer": "upper",
    "x": 12,
    "y": 4,
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
    "kitId": "tibo-library-039",
    "name": "침대 옆 협탁",
    "x": 10,
    "y": 4,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 11,
    "y": 2,
    "w": 1,
    "h": 1,
    "rows": [
      [
        54
      ]
    ]
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v3-1-1",
    "name": "세 칸 서랍장",
    "x": 13,
    "y": 3,
    "w": 1,
    "h": 2
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-045",
    "name": "여행용 궤짝",
    "x": 9,
    "y": 7,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-bed",
    "name": "목제 침대",
    "x": 15,
    "y": 3,
    "w": 3,
    "h": 3
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-039",
    "name": "침대 옆 협탁",
    "x": 18,
    "y": 4,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-040",
    "name": "화장대",
    "x": 19,
    "y": 4,
    "w": 2,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-warm-bench",
    "name": "쿠션 긴 의자",
    "x": 19,
    "y": 6,
    "w": 2,
    "h": 2
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 18,
    "y": 2,
    "w": 1,
    "h": 1,
    "rows": [
      [
        56
      ]
    ]
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-red-carpet",
    "x": 15,
    "y": 6,
    "w": 2,
    "h": 2
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 3,
    "y": 12,
    "w": 1,
    "h": 1,
    "rows": [
      [
        474
      ]
    ]
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-red-carpet",
    "x": 5,
    "y": 12,
    "w": 14,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-027",
    "name": "짧은 벤치",
    "x": 16,
    "y": 11,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 6,
    "y": 13,
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
    "x": 12,
    "y": 13,
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
    "x": 17,
    "y": 13,
    "w": 1,
    "h": 1,
    "rows": [
      [
        288
      ]
    ]
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-039",
    "name": "침대 옆 협탁",
    "x": 14,
    "y": 11,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 15,
    "y": 11,
    "w": 1,
    "h": 1,
    "rows": [
      [
        296
      ]
    ]
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-teal-carpet",
    "x": 4,
    "y": 6,
    "w": 3,
    "h": 1
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-teal-carpet",
    "x": 10,
    "y": 6,
    "w": 2,
    "h": 2
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v7-1-2",
    "name": "붉은 방석 의자",
    "x": 13,
    "y": 7,
    "w": 1,
    "h": 1
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-059",
    "name": "린넨 장",
    "x": 7,
    "y": 10,
    "w": 1,
    "h": 2
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-037",
    "name": "접은 이불 더미",
    "x": 8,
    "y": 11,
    "w": 1,
    "h": 1
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
        84
      ]
    ]
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 20,
    "y": 11,
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
    "x": 9,
    "y": 9,
    "w": 1,
    "h": 1,
    "rows": [
      [
        206
      ]
    ]
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 15,
    "y": 9,
    "w": 1,
    "h": 1,
    "rows": [
      [
        206
      ]
    ]
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-061",
    "name": "기댄 빗자루",
    "x": 20,
    "y": 12,
    "w": 1,
    "h": 2
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-215",
    "name": "둥근 관목 화분",
    "x": 13,
    "y": 11,
    "w": 1,
    "h": 1
  }
]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
