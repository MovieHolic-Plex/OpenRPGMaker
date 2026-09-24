# 연금술 공방

연금술사가 약을 달이고 재료를 갈무리하는 작업실. 뒷벽이 재료·책·증류 도구, 오른쪽이 불(작은 대장간 화덕·물약 가마솥·석탄 통), 가운데 작업대에서 재료를 빻고 달인다.

석벽·돌바닥 42, 14×6칸. 뒷벽에 약초 건조장 3×3·연금술 작업대 3×2(물약)·두꺼운 책장·증류 유리병 받침·뿌리 표본병·작은 대장간 화덕, 오른쪽 물약 가마솥·석탄 통(돌바닥 위 불), 가운데 나무 상판 작업대 5×2 위에 절구와 공이·약병 세 개·환약 단지·약초 도마·펼친 처방서, 작업대 옆 걸상 둘, 앞 오른쪽 약초 건조대, 앞 왼쪽 저장 옹기·뚜껑 통. 18×14, tilesetId=tibo_interior_expanded. 입구 (9,11), 주인·담당 자리 (7,9). 통행 검사 목표 [[7,6],[13,7],[4,7]].

![연금술 공방](images/interior-alchemy-workshop.png)

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.
```json
[
  {
    "kind": "tibo-kit",
    "kitId": "tibo-medieval-herbal-cabinet",
    "name": "약초 건조장",
    "x": 2,
    "y": 3,
    "w": 3,
    "h": 3,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-alchemy-desk",
    "name": "연금술 작업대",
    "x": 6,
    "y": 4,
    "w": 3,
    "h": 2,
    "role": "table"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-bookcase",
    "name": "두꺼운 책장",
    "x": 9,
    "y": 4,
    "w": 2,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-147",
    "name": "증류 유리병 받침",
    "x": 11,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-151",
    "name": "뿌리 표본병",
    "x": 12,
    "y": 4,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-104",
    "name": "작은 대장간 화덕",
    "x": 14,
    "y": 4,
    "w": 2,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-166",
    "name": "물약 가마솥",
    "x": 14,
    "y": 7,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-098",
    "name": "석탄 통",
    "x": 15,
    "y": 8,
    "w": 1,
    "h": 1,
    "role": "furn"
  },
  {
    "kind": "tabletop",
    "group": "harness-interior-house-v1-terrain-deck",
    "x": 5,
    "y": 7,
    "w": 5,
    "h": 2,
    "role": "tabletop"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-003",
    "name": "절구와 공이",
    "x": 5,
    "y": 7,
    "w": 1,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-148",
    "name": "약병 세 개",
    "x": 6,
    "y": 7,
    "w": 2,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-155",
    "name": "환약 단지",
    "x": 9,
    "y": 7,
    "w": 1,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-146",
    "name": "약초 도마",
    "x": 5,
    "y": 8,
    "w": 2,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-158",
    "name": "펼친 룬 서적",
    "x": 8,
    "y": 8,
    "w": 2,
    "h": 1,
    "role": "top"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-030",
    "name": "낮은 걸상",
    "x": 7,
    "y": 9,
    "w": 1,
    "h": 1,
    "role": "seat"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-030",
    "name": "낮은 걸상",
    "x": 4,
    "y": 8,
    "w": 1,
    "h": 1,
    "role": "seat"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-fantasy-herb-rack",
    "name": "약초 건조대",
    "x": 11,
    "y": 9,
    "w": 3,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-234",
    "name": "저장 옹기",
    "x": 2,
    "y": 9,
    "w": 1,
    "h": 2,
    "role": "furn"
  },
  {
    "kind": "tibo-kit",
    "kitId": "tibo-library-229",
    "name": "뚜껑 둥근 통",
    "x": 3,
    "y": 9,
    "w": 1,
    "h": 2,
    "role": "furn"
  }
]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
