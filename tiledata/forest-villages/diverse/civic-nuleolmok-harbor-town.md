# 공동 공간과 정원의 배치(완성 맵 좌표)

개정14에서 우물가에 광장 소품(id …-plaza-N)을 더했다. civic-programs.json 은 압축 전 저작 입력이다.

```json
[
  {
    "id": "market",
    "name": "장터 광장 좌판",
    "anchor": {
      "type": "road",
      "x": 25,
      "y": 33,
      "maxDistance": 9
    },
    "items": [
      {
        "id": "market-1",
        "name": "장터 노점",
        "x": 27,
        "y": 30,
        "purpose": "항구에서 들어온 물건과 밭 작물을 파는 좌판"
      },
      {
        "id": "market-2",
        "name": "과일 좌판",
        "x": 31,
        "y": 31,
        "purpose": "윗단 농가에서 내려온 과일",
        "near": "장터 노점"
      },
      {
        "id": "market-3",
        "name": "과일 상자",
        "x": 27,
        "y": 33,
        "purpose": "좌판에 보충할 과일",
        "near": "장터 노점"
      },
      {
        "id": "market-4",
        "name": "게시판",
        "x": 29,
        "y": 27,
        "purpose": "배 드나드는 날과 장날을 붙이는 판",
        "near": "장터 노점"
      }
    ],
    "site": {
      "x": 25,
      "y": 33,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "well",
    "name": "장터 광장 우물",
    "anchor": {
      "type": "road",
      "x": 25,
      "y": 37,
      "maxDistance": 8
    },
    "items": [
      {
        "id": "well-1",
        "name": "낮은 돌 우물",
        "x": 29,
        "y": 35,
        "purpose": "장터와 아랫단 집들의 급수"
      },
      {
        "id": "well-2",
        "name": "항아리",
        "x": 31,
        "y": 36,
        "purpose": "우물물을 담는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-plaza-1",
        "name": "벤치",
        "x": 29,
        "y": 33,
        "purpose": "우물가에 앉아 쉬는 자리",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-plaza-2",
        "name": "꽃 화단",
        "x": 26,
        "y": 36,
        "purpose": "마을 한가운데를 꾸미는 화단",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-plaza-3",
        "name": "돌등",
        "x": 33,
        "y": 36,
        "purpose": "밤에 우물가를 밝히는 돌등",
        "near": "낮은 돌 우물"
      }
    ],
    "site": {
      "x": 25,
      "y": 37,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "church-lamps",
    "name": "교회 앞 돌등",
    "anchor": {
      "type": "landmark",
      "id": "nuleolmok-harbor-town-church",
      "maxDistance": 6
    },
    "items": [
      {
        "id": "church-lamps-1",
        "name": "돌등",
        "x": 6,
        "y": 13,
        "purpose": "교회 앞길 서쪽을 밝히는 등"
      },
      {
        "id": "church-lamps-2",
        "name": "돌등",
        "x": 14,
        "y": 13,
        "purpose": "교회 앞길 동쪽을 밝히는 등",
        "near": "돌등"
      }
    ],
    "site": {
      "x": 7,
      "y": 7,
      "w": 7,
      "h": 9,
      "layer": "lower"
    }
  }
]
```
