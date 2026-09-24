# 공동 공간과 정원의 배치(완성 맵 좌표)

개정14에서 우물가에 광장 소품(id …-plaza-N)을 더했다. civic-programs.json 은 압축 전 저작 입력이다.

```json
[
  {
    "id": "falls-overlook",
    "name": "윗 폭포 전망 쉼터",
    "anchor": {
      "type": "road",
      "x": 29,
      "y": 7,
      "maxDistance": 12
    },
    "items": [
      {
        "id": "falls-overlook-2",
        "name": "벤치",
        "x": 36,
        "y": 10,
        "purpose": "강 건너편에서 폭포를 보는 자리"
      },
      {
        "id": "falls-overlook-3",
        "name": "돌등",
        "x": 30,
        "y": 9,
        "purpose": "다리 서쪽 목 밝히기"
      }
    ],
    "site": {
      "x": 29,
      "y": 7,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "top-bridge-sign",
    "name": "윗다리 길잡이",
    "anchor": {
      "type": "road",
      "x": 37,
      "y": 7,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "top-bridge-sign-1",
        "name": "나무 이정표",
        "x": 37,
        "y": 5,
        "purpose": "윗단 동쪽 집으로 가는 길 안내"
      }
    ],
    "site": {
      "x": 37,
      "y": 7,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "well",
    "name": "가운데 단 공동 우물",
    "anchor": {
      "type": "road",
      "x": 22,
      "y": 33,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "well-1",
        "name": "낮은 돌 우물",
        "x": 17,
        "y": 28,
        "purpose": "가운데 단 서쪽 주민의 급수"
      },
      {
        "id": "well-2",
        "name": "항아리",
        "x": 21,
        "y": 29,
        "purpose": "길어 온 물을 담는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-plaza-1",
        "name": "돌등",
        "x": 18,
        "y": 31,
        "purpose": "밤에 우물가를 밝히는 돌등",
        "near": "낮은 돌 우물"
      }
    ],
    "site": {
      "x": 22,
      "y": 33,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "bridge-market",
    "name": "가운데 다리목 장터",
    "anchor": {
      "type": "road",
      "x": 36,
      "y": 32,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "bridge-market-1",
        "name": "장터 노점",
        "x": 36,
        "y": 34,
        "purpose": "강 양쪽 주민이 만나는 다리목 좌판"
      },
      {
        "id": "bridge-market-2",
        "name": "과일 좌판",
        "x": 39,
        "y": 35,
        "purpose": "가운데 단 텃밭에서 거둔 과일",
        "near": "장터 노점"
      },
      {
        "id": "bridge-market-3",
        "name": "술통",
        "x": 35,
        "y": 35,
        "purpose": "장터 음료 통",
        "near": "장터 노점"
      }
    ],
    "site": {
      "x": 36,
      "y": 32,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "lower-pool-fishing",
    "name": "아랫 소 낚시터",
    "anchor": {
      "type": "road",
      "x": 27,
      "y": 56,
      "maxDistance": 12
    },
    "items": [
      {
        "id": "lower-pool-fishing-1",
        "name": "낚시 바구니",
        "x": 25,
        "y": 47,
        "purpose": "폭포 아래 소에서 쓰는 낚시 바구니"
      },
      {
        "id": "lower-pool-fishing-3",
        "name": "벤치",
        "x": 26,
        "y": 50,
        "purpose": "소를 바라보며 낚싯대를 드리우는 자리"
      }
    ],
    "site": {
      "x": 27,
      "y": 56,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "pool-fire",
    "name": "아랫 소 동쪽 모닥불",
    "anchor": {
      "type": "house",
      "id": "twin-falls-river-village-house-8",
      "maxDistance": 14
    },
    "items": [
      {
        "id": "pool-fire-1",
        "name": "모닥불",
        "x": 40,
        "y": 45,
        "purpose": "폭포 아래에서 저녁에 불을 피우는 자리"
      }
    ],
    "site": {
      "x": 44,
      "y": 49,
      "w": 4,
      "h": 7,
      "layer": "lower"
    }
  },
  {
    "id": "woodyard",
    "name": "윗단 목공집 땔감",
    "anchor": {
      "type": "house",
      "id": "twin-falls-river-village-house-1",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "woodyard-1",
        "name": "장작 더미",
        "x": 7,
        "y": 12,
        "purpose": "목공 작업에서 나온 장작"
      },
      {
        "id": "woodyard-2",
        "name": "장작 더미",
        "x": 9,
        "y": 13,
        "purpose": "겨울 땔감 두 번째 더미",
        "near": "장작 더미"
      }
    ],
    "site": {
      "x": 8,
      "y": 3,
      "w": 7,
      "h": 9,
      "layer": "lower"
    }
  },
  {
    "id": "entry-sign",
    "name": "남쪽 입구 길잡이",
    "anchor": {
      "type": "road",
      "x": 17,
      "y": 61,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "entry-sign-1",
        "name": "나무 이정표",
        "x": 15,
        "y": 61,
        "purpose": "마을 남쪽 입구 방향 안내"
      },
      {
        "id": "entry-sign-2",
        "name": "돌등",
        "x": 19,
        "y": 58,
        "purpose": "입구 길 밝히기"
      }
    ],
    "site": {
      "x": 17,
      "y": 61,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "stair-signs-w",
    "name": "서쪽 계단 길잡이",
    "anchor": {
      "type": "road",
      "x": 15,
      "y": 46,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "stair-signs-w-1",
        "name": "나무 이정표",
        "x": 14,
        "y": 47,
        "purpose": "가운데 단으로 오르는 서쪽 계단 안내"
      }
    ],
    "site": {
      "x": 15,
      "y": 46,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "stair-signs-e",
    "name": "동쪽 계단 길잡이",
    "anchor": {
      "type": "road",
      "x": 50,
      "y": 46,
      "maxDistance": 10
    },
    "items": [],
    "site": {
      "x": 50,
      "y": 46,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  }
]
```
