# 마법 상점

마법 도구를 파는 가게. 손님은 청록 러그를 지나 카운터로 가고, 상인은 뒷벽 진열장을 등지고 카운터 뒤에서 물약·수정을 꺼내 준다. 오른쪽 점술대에서 점을 봐 준다.

크림 벽 12×5칸. 뒷벽에 물약 진열장 3×3·마법봉 걸이·달 위상 벽판·별자리 판·두루마리 수납장·부적 진열대·수정구 받침, 나무 상판 카운터(x=6~10, 상인 자리 (8,5)) 위에 약병 세 개·수정구·수정 표본 쟁반, 오른쪽 앞 붉은 러그 위 점술대 329와 마주 앉는 의자 둘, 입구 청록 러그, 왼쪽 앞 상품 진열 받침·봉인 상자. 16×13, tilesetId=tibo_interior_expanded. 입구 (8,10), 주인·담당 자리 (8,5). 통행 검사 목표 [[8,7],[8,5],[11,9]].

![마법 상점](images/interior-magic-shop.png)

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.
```json
[
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v4-2-0",
    "name": "물약 진열장",
    "x": 2,
    "y": 3,
    "w": 3,
    "h": 3,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v4-2-2",
    "name": "두루마리 수납장",
    "x": 11,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-crystal-stand",
    "name": "수정구 받침",
    "x": 13,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-167",
    "name": "부적 진열대",
    "x": 12,
    "y": 5,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-159",
    "name": "마법봉 걸이",
    "x": 6,
    "y": 3,
    "w": 1,
    "h": 2,
    "role": "hang"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-163",
    "name": "달 위상 벽판",
    "x": 8,
    "y": 3,
    "w": 1,
    "h": 2,
    "role": "hang"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-220",
    "name": "직조 벽걸이",
    "x": 10,
    "y": 3,
    "w": 1,
    "h": 2,
    "role": "hang"
  },
  {
    "kind": "tabletop",
    "group": "harness-interior-house-v1-terrain-deck",
    "x": 6,
    "y": 6,
    "w": 5,
    "h": 1,
    "role": "tabletop"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-148",
    "name": "약병 세 개",
    "x": 6,
    "y": 6,
    "w": 2,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-157",
    "name": "수정구 받침",
    "x": 8,
    "y": 6,
    "w": 1,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-165",
    "name": "수정 표본 쟁반",
    "x": 9,
    "y": 6,
    "w": 2,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-red-carpet",
    "x": 10,
    "y": 8,
    "w": 4,
    "h": 2,
    "role": "rug"
  },
  {
    "kind": "tiles",
    "layer": "upper",
    "x": 12,
    "y": 8,
    "w": 1,
    "h": 1,
    "rows": [
      [
        329
      ]
    ],
    "role": "table"
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
    "x": 13,
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
    "kind": "rug",
    "group": "harness-interior-house-v1-terrain-teal-carpet",
    "x": 7,
    "y": 8,
    "w": 3,
    "h": 2,
    "role": "rug"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-126",
    "name": "상품 진열 받침",
    "x": 2,
    "y": 8,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-v10-1-0",
    "name": "봉인 상자",
    "x": 3,
    "y": 9,
    "w": 1,
    "h": 1,
    "role": "furn"
  }
]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
