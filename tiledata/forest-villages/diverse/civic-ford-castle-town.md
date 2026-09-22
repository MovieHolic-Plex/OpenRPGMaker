# 공동 공간과 정원의 명시 배치 입력

```json
[
  {
    "id": "castle-drill",
    "name": "성 앞 훈련 마당",
    "anchor": {
      "type": "landmark",
      "id": "ford-castle-town-castle",
      "maxDistance": 6
    },
    "items": [
      {
        "id": "castle-drill-1",
        "name": "무기 거치대",
        "x": 40,
        "y": 38,
        "purpose": "성 병사들이 창과 칼을 거는 자리"
      },
      {
        "id": "castle-drill-2",
        "name": "무기 거치대",
        "x": 42,
        "y": 38,
        "purpose": "두 번째 무기 거치대",
        "near": "무기 거치대"
      },
      {
        "id": "castle-drill-3",
        "name": "나무통",
        "x": 38,
        "y": 39,
        "purpose": "훈련 뒤 마실 물통",
        "near": "무기 거치대"
      },
      {
        "id": "castle-drill-4",
        "name": "돌등",
        "x": 47,
        "y": 38,
        "purpose": "성문 서쪽을 밝히는 등"
      },
      {
        "id": "castle-drill-5",
        "name": "돌등",
        "x": 52,
        "y": 38,
        "purpose": "성문 동쪽을 밝히는 등",
        "near": "돌등"
      }
    ]
  },
  {
    "id": "castle-stores",
    "name": "성 동쪽 보급터",
    "anchor": {
      "type": "landmark",
      "id": "ford-castle-town-castle",
      "maxDistance": 6
    },
    "items": [
      {
        "id": "castle-stores-1",
        "name": "나무 상자",
        "x": 60,
        "y": 38,
        "purpose": "성으로 들일 보급 상자"
      },
      {
        "id": "castle-stores-2",
        "name": "술통",
        "x": 62,
        "y": 38,
        "purpose": "성 창고에 들일 술통",
        "near": "나무 상자"
      },
      {
        "id": "castle-stores-3",
        "name": "장작 더미",
        "x": 64,
        "y": 38,
        "purpose": "성 부엌에 들일 땔감",
        "near": "나무 상자"
      }
    ]
  },
  {
    "id": "top-bridge-watch",
    "name": "윗다리 망보는 자리",
    "anchor": {
      "type": "road",
      "x": 80,
      "y": 27,
      "maxDistance": 8
    },
    "items": [
      {
        "id": "top-bridge-watch-1",
        "name": "돌등",
        "x": 79,
        "y": 24,
        "purpose": "윗다리 서쪽 목 밝히기"
      },
      {
        "id": "top-bridge-watch-2",
        "name": "나무 이정표",
        "x": 77,
        "y": 29,
        "purpose": "강 건너 망루지기 집 안내"
      }
    ]
  },
  {
    "id": "mid-market",
    "name": "가운데 단 장터",
    "anchor": {
      "type": "road",
      "x": 48,
      "y": 63,
      "maxDistance": 9
    },
    "items": [
      {
        "id": "mid-market-1",
        "name": "장터 노점",
        "x": 42,
        "y": 60,
        "purpose": "성 아랫마을 좌판"
      },
      {
        "id": "mid-market-2",
        "name": "과일 좌판",
        "x": 46,
        "y": 60,
        "purpose": "아랫단 텃밭에서 거둔 과일",
        "near": "장터 노점"
      },
      {
        "id": "mid-market-3",
        "name": "낮은 돌 우물",
        "x": 52,
        "y": 59,
        "purpose": "가운데 단 공동 우물"
      },
      {
        "id": "mid-market-4",
        "name": "게시판",
        "x": 50,
        "y": 56,
        "purpose": "성의 포고문을 붙이는 판"
      }
    ]
  },
  {
    "id": "pool-rest",
    "name": "가운데 단 폭포 소",
    "anchor": {
      "type": "road",
      "x": 81,
      "y": 63,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "pool-rest-1",
        "name": "벤치",
        "x": 76,
        "y": 58,
        "purpose": "폭포 아래 소를 보며 쉬는 자리"
      },
      {
        "id": "pool-rest-2",
        "name": "낚시 바구니",
        "x": 78,
        "y": 60,
        "purpose": "소에서 쓰는 낚시 바구니"
      }
    ]
  },
  {
    "id": "lower-fire",
    "name": "나루 모닥불",
    "anchor": {
      "type": "house",
      "id": "ford-castle-town-house-10",
      "maxDistance": 12
    },
    "items": [
      {
        "id": "lower-fire-1",
        "name": "모닥불",
        "x": 71,
        "y": 82,
        "purpose": "나루 일꾼들이 저녁에 불을 피우는 자리"
      },
      {
        "id": "lower-fire-2",
        "name": "벤치",
        "x": 70,
        "y": 84,
        "purpose": "불가에 앉는 자리",
        "near": "모닥불"
      },
      {
        "id": "lower-fire-3",
        "name": "장작 더미",
        "x": 74,
        "y": 82,
        "purpose": "모닥불 장작",
        "near": "모닥불"
      }
    ]
  },
  {
    "id": "entry-sign",
    "name": "남쪽 입구 길잡이",
    "anchor": {
      "type": "road",
      "x": 48,
      "y": 88,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "entry-sign-1",
        "name": "나무 이정표",
        "x": 46,
        "y": 90,
        "purpose": "성으로 오르는 길 안내"
      },
      {
        "id": "entry-sign-2",
        "name": "돌등",
        "x": 50,
        "y": 85,
        "purpose": "입구 길 밝히기"
      }
    ]
  }
]
```
