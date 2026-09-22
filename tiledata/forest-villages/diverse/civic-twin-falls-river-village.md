# 공동 공간과 정원의 명시 배치 입력

```json
[
  {
    "id": "falls-overlook",
    "name": "윗 폭포 전망 쉼터",
    "anchor": {
      "type": "road",
      "x": 38,
      "y": 10,
      "maxDistance": 12
    },
    "items": [
      {
        "id": "falls-overlook-1",
        "name": "벤치",
        "x": 37,
        "y": 17,
        "purpose": "윗 폭포가 떨어지는 소리를 들으며 쉬는 자리"
      },
      {
        "id": "falls-overlook-2",
        "name": "벤치",
        "x": 45,
        "y": 15,
        "purpose": "강 건너편에서 폭포를 보는 자리"
      },
      {
        "id": "falls-overlook-3",
        "name": "돌등",
        "x": 39,
        "y": 12,
        "purpose": "다리 서쪽 목 밝히기"
      }
    ]
  },
  {
    "id": "top-bridge-sign",
    "name": "윗다리 길잡이",
    "anchor": {
      "type": "road",
      "x": 48,
      "y": 10,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "top-bridge-sign-1",
        "name": "나무 이정표",
        "x": 49,
        "y": 8,
        "purpose": "윗단 동쪽 집으로 가는 길 안내"
      }
    ]
  },
  {
    "id": "well",
    "name": "가운데 단 공동 우물",
    "anchor": {
      "type": "road",
      "x": 30,
      "y": 38,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "well-1",
        "name": "낮은 돌 우물",
        "x": 24,
        "y": 33,
        "purpose": "가운데 단 서쪽 주민의 급수"
      },
      {
        "id": "well-2",
        "name": "항아리",
        "x": 28,
        "y": 34,
        "purpose": "길어 온 물을 담는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-3",
        "name": "게시판",
        "x": 22,
        "y": 36,
        "purpose": "우물에 모인 주민의 마을 공지"
      }
    ]
  },
  {
    "id": "bridge-market",
    "name": "가운데 다리목 장터",
    "anchor": {
      "type": "road",
      "x": 46,
      "y": 37,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "bridge-market-1",
        "name": "장터 노점",
        "x": 46,
        "y": 40,
        "purpose": "강 양쪽 주민이 만나는 다리목 좌판"
      },
      {
        "id": "bridge-market-2",
        "name": "과일 좌판",
        "x": 50,
        "y": 41,
        "purpose": "가운데 단 텃밭에서 거둔 과일",
        "near": "장터 노점"
      },
      {
        "id": "bridge-market-3",
        "name": "술통",
        "x": 44,
        "y": 41,
        "purpose": "장터 음료 통",
        "near": "장터 노점"
      }
    ]
  },
  {
    "id": "lower-pool-fishing",
    "name": "아랫 소 낚시터",
    "anchor": {
      "type": "road",
      "x": 36,
      "y": 63,
      "maxDistance": 12
    },
    "items": [
      {
        "id": "lower-pool-fishing-1",
        "name": "낚시 바구니",
        "x": 34,
        "y": 53,
        "purpose": "폭포 아래 소에서 쓰는 낚시 바구니"
      },
      {
        "id": "lower-pool-fishing-2",
        "name": "나무통",
        "x": 33,
        "y": 55,
        "purpose": "잡은 물고기를 담는 통",
        "near": "낚시 바구니"
      },
      {
        "id": "lower-pool-fishing-3",
        "name": "벤치",
        "x": 35,
        "y": 57,
        "purpose": "소를 바라보며 낚싯대를 드리우는 자리"
      }
    ]
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
        "x": 52,
        "y": 52,
        "purpose": "폭포 아래에서 저녁에 불을 피우는 자리"
      },
      {
        "id": "pool-fire-2",
        "name": "벤치",
        "x": 54,
        "y": 54,
        "purpose": "불가에 앉는 자리",
        "near": "모닥불"
      },
      {
        "id": "pool-fire-3",
        "name": "장작 더미",
        "x": 55,
        "y": 52,
        "purpose": "모닥불 장작",
        "near": "모닥불"
      }
    ]
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
        "x": 12,
        "y": 15,
        "purpose": "목공 작업에서 나온 장작"
      },
      {
        "id": "woodyard-2",
        "name": "장작 더미",
        "x": 14,
        "y": 16,
        "purpose": "겨울 땔감 두 번째 더미",
        "near": "장작 더미"
      }
    ]
  },
  {
    "id": "entry-sign",
    "name": "남쪽 입구 길잡이",
    "anchor": {
      "type": "road",
      "x": 24,
      "y": 68,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "entry-sign-1",
        "name": "나무 이정표",
        "x": 22,
        "y": 68,
        "purpose": "마을 남쪽 입구 방향 안내"
      },
      {
        "id": "entry-sign-2",
        "name": "돌등",
        "x": 26,
        "y": 65,
        "purpose": "입구 길 밝히기"
      }
    ]
  },
  {
    "id": "stair-signs-w",
    "name": "서쪽 계단 길잡이",
    "anchor": {
      "type": "road",
      "x": 22,
      "y": 52,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "stair-signs-w-1",
        "name": "나무 이정표",
        "x": 20,
        "y": 53,
        "purpose": "가운데 단으로 오르는 서쪽 계단 안내"
      }
    ]
  },
  {
    "id": "stair-signs-e",
    "name": "동쪽 계단 길잡이",
    "anchor": {
      "type": "road",
      "x": 64,
      "y": 52,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "stair-signs-e-1",
        "name": "나무 이정표",
        "x": 66,
        "y": 53,
        "purpose": "가운데 단으로 오르는 동쪽 계단 안내"
      }
    ]
  }
]
```
