# 여관 1층 · 주점과 접수대

여관 주인이 운영하는 1층. 손님은 문으로 들어와 오른쪽 접수대에서 방을 잡고, 바에서 술을 받아 긴 식탁에서 먹는다. 왼쪽 돌바닥 주방에서 요리하고, 동벽 계단으로 2층 객실에 오른다.

크림 벽, 주방 5×8(돌바닥 42)과 홀 12×8을 파이프라인 칸막이로 나눴다(문 (7,10)). 주방: 빵 화덕·불 피운 솥 걸이(돌바닥 위)·벽에 말린 약초·향신료 선반·국자 걸이·조리대·구석에 밀가루·쌀 포대·감자 바구니·당근 상자·뚜껑 통 한 덩이. 홀: 뒷벽 술통 선반·맥주통, 그 앞 바 카운터와 높은 걸상 둘(주인 자리 (9,6)), 가운데 뒤 장작 벽난로와 붉은 깔개, 긴 식탁과 벤치, 원형 식탁과 걸상 둘, 오른쪽 뒤 접수 탁자(나무 상판 위 편지 쟁반·동전 쟁반)와 벽 열쇠판·여관 간판, 동벽에 붙은 오르막 계단 111/141/171(x=19, 바닥 위), 앞 오른쪽 야자 화분. 22×15, tilesetId=tibo_interior_expanded. 입구 (13,13), 주인·담당 자리 (9,6). 통행 검사 목표 [[9,6],[17,5],[19,8],[4,7],[14,11]].

![여관 1층 · 주점과 접수대](images/interior-inn-tavern-1f.png)

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
    "x": 5,
    "y": 5,
    "w": 2,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-hanging-herbs",
    "name": "말린 약초 걸이",
    "x": 2,
    "y": 3,
    "w": 2,
    "h": 1,
    "role": "hang"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-011",
    "name": "향신료 선반",
    "x": 4,
    "y": 4,
    "w": 1,
    "h": 1,
    "role": "hang"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-012",
    "name": "국자 걸이",
    "x": 5,
    "y": 3,
    "w": 2,
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
    "kitId": "tibo-library-013",
    "name": "밀가루 포대",
    "x": 2,
    "y": 11,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-014",
    "name": "쌀 포대",
    "x": 3,
    "y": 11,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-015",
    "name": "감자 바구니",
    "x": 2,
    "y": 12,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-018",
    "name": "당근 상자",
    "x": 3,
    "y": 12,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-229",
    "name": "뚜껑 둥근 통",
    "x": 4,
    "y": 11,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-ale-rack",
    "name": "술통 선반",
    "x": 8,
    "y": 4,
    "w": 3,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-133",
    "name": "받침대 맥주통",
    "x": 11,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-bar-counter",
    "name": "바 카운터",
    "x": 8,
    "y": 7,
    "w": 4,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-029",
    "name": "높은 걸상",
    "x": 9,
    "y": 9,
    "w": 1,
    "h": 1,
    "role": "seat"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-029",
    "name": "높은 걸상",
    "x": 11,
    "y": 9,
    "w": 1,
    "h": 1,
    "role": "seat"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-medieval-stone-fireplace",
    "name": "장작 벽난로",
    "x": 13,
    "y": 3,
    "w": 3,
    "h": 3,
    "role": "furn"
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-red-carpet",
    "x": 13,
    "y": 6,
    "w": 3,
    "h": 1,
    "role": "rug"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 12,
    "y": 3,
    "w": 1,
    "h": 1,
    "rows": [
      [
        24
      ]
    ],
    "role": "hang"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 16,
    "y": 3,
    "w": 1,
    "h": 1,
    "rows": [
      [
        24
      ]
    ],
    "role": "hang"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-dining-set",
    "name": "긴 식탁과 벤치",
    "x": 13,
    "y": 8,
    "w": 3,
    "h": 3,
    "role": "table"
  },
  {
    "kind": "tabletop",
    "group": "harness-interior-house-v1-terrain-deck",
    "x": 17,
    "y": 6,
    "w": 2,
    "h": 1,
    "role": "tabletop"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-079",
    "name": "편지 쟁반",
    "x": 17,
    "y": 6,
    "w": 1,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-122",
    "name": "동전 계산 쟁반",
    "x": 18,
    "y": 6,
    "w": 1,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v8-1-0",
    "name": "열쇠판",
    "x": 17,
    "y": 3,
    "w": 2,
    "h": 1,
    "role": "hang"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 19,
    "y": 3,
    "w": 1,
    "h": 1,
    "rows": [
      [
        57
      ]
    ],
    "role": "hang"
  },
  {
    "kind": "tiles",
    "layer": "lower",
    "x": 19,
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
    "kitId": "tibo-library-025",
    "name": "원형 식탁",
    "x": 9,
    "y": 10,
    "w": 1,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-030",
    "name": "낮은 걸상",
    "x": 8,
    "y": 11,
    "w": 1,
    "h": 1,
    "role": "seat"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-030",
    "name": "낮은 걸상",
    "x": 10,
    "y": 11,
    "w": 1,
    "h": 1,
    "role": "seat"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-025",
    "name": "원형 식탁",
    "x": 17,
    "y": 8,
    "w": 1,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-030",
    "name": "낮은 걸상",
    "x": 16,
    "y": 9,
    "w": 1,
    "h": 1,
    "role": "seat"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-030",
    "name": "낮은 걸상",
    "x": 18,
    "y": 9,
    "w": 1,
    "h": 1,
    "role": "seat"
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-red-carpet",
    "x": 12,
    "y": 11,
    "w": 3,
    "h": 2,
    "role": "rug"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-209",
    "name": "키 큰 실내 야자",
    "x": 18,
    "y": 11,
    "w": 2,
    "h": 2,
    "role": "furn"
  }
]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
