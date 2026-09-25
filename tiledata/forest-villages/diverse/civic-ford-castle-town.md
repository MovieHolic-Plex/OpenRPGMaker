# 공동 공간과 정원의 배치(완성 맵 좌표)

개정14에서 우물가에 광장 소품(id …-plaza-N)을 더했다. civic-programs.json 은 압축 전 저작 입력이다.

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
        "x": 28,
        "y": 36,
        "purpose": "성 병사들이 창과 칼을 거는 자리"
      },
      {
        "id": "castle-drill-2",
        "name": "무기 거치대",
        "x": 30,
        "y": 36,
        "purpose": "두 번째 무기 거치대",
        "near": "무기 거치대"
      },
      {
        "id": "castle-drill-3",
        "name": "나무통",
        "x": 26,
        "y": 36,
        "purpose": "훈련 뒤 마실 물통",
        "near": "무기 거치대"
      },
      {
        "id": "castle-drill-4",
        "name": "돌등",
        "x": 35,
        "y": 36,
        "purpose": "성문 서쪽을 밝히는 등"
      },
      {
        "id": "castle-drill-5",
        "name": "돌등",
        "x": 40,
        "y": 36,
        "purpose": "성문 동쪽을 밝히는 등",
        "near": "돌등"
      }
    ],
    "site": {
      "x": 17,
      "y": 2,
      "w": 42,
      "h": 33,
      "layer": "lower"
    }
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
        "x": 48,
        "y": 36,
        "purpose": "성으로 들일 보급 상자"
      },
      {
        "id": "castle-stores-2",
        "name": "술통",
        "x": 50,
        "y": 36,
        "purpose": "성 창고에 들일 술통",
        "near": "나무 상자"
      },
      {
        "id": "castle-stores-3",
        "name": "장작 더미",
        "x": 52,
        "y": 36,
        "purpose": "성 부엌에 들일 땔감",
        "near": "나무 상자"
      }
    ],
    "site": {
      "x": 17,
      "y": 2,
      "w": 42,
      "h": 33,
      "layer": "lower"
    }
  },
  {
    "id": "top-bridge-watch",
    "name": "윗다리 망보는 자리",
    "anchor": {
      "type": "road",
      "x": 65,
      "y": 25,
      "maxDistance": 8
    },
    "items": [
      {
        "id": "top-bridge-watch-1",
        "name": "돌등",
        "x": 64,
        "y": 22,
        "purpose": "윗다리 서쪽 목 밝히기"
      },
      {
        "id": "top-bridge-watch-2",
        "name": "나무 이정표",
        "x": 62,
        "y": 27,
        "purpose": "강 건너 망루지기 집 안내"
      }
    ],
    "site": {
      "x": 65,
      "y": 25,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "mid-market",
    "name": "가운데 단 장터",
    "anchor": {
      "type": "road",
      "x": 36,
      "y": 59,
      "maxDistance": 9
    },
    "items": [
      {
        "id": "mid-market-1",
        "name": "장터 노점",
        "x": 30,
        "y": 56,
        "purpose": "성 아랫마을 좌판"
      },
      {
        "id": "mid-market-2",
        "name": "과일 좌판",
        "x": 34,
        "y": 56,
        "purpose": "아랫단 텃밭에서 거둔 과일",
        "near": "장터 노점"
      },
      {
        "id": "mid-market-3",
        "name": "낮은 돌 우물",
        "x": 40,
        "y": 55,
        "purpose": "가운데 단 공동 우물"
      },
      {
        "id": "mid-market-4",
        "name": "게시판",
        "x": 38,
        "y": 52,
        "purpose": "성의 포고문을 붙이는 판"
      },
      {
        "id": "mid-market-plaza-1",
        "name": "벤치",
        "x": 38,
        "y": 57,
        "purpose": "우물가에 앉아 쉬는 자리",
        "near": "낮은 돌 우물"
      },
      {
        "id": "mid-market-plaza-2",
        "name": "꽃 화단",
        "x": 43,
        "y": 56,
        "purpose": "마을 한가운데를 꾸미는 화단",
        "near": "낮은 돌 우물"
      },
      {
        "id": "mid-market-plaza-3",
        "name": "벤치",
        "x": 40,
        "y": 58,
        "purpose": "우물가에 앉아 쉬는 자리",
        "near": "낮은 돌 우물"
      }
    ],
    "site": {
      "x": 36,
      "y": 59,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "pool-rest",
    "name": "가운데 단 폭포 소",
    "anchor": {
      "type": "road",
      "x": 66,
      "y": 59,
      "maxDistance": 10
    },
    "items": [],
    "site": {
      "x": 66,
      "y": 59,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
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
        "x": 59,
        "y": 77,
        "purpose": "나루 일꾼들이 저녁에 불을 피우는 자리"
      },
      {
        "id": "lower-fire-2",
        "name": "벤치",
        "x": 58,
        "y": 79,
        "purpose": "불가에 앉는 자리",
        "near": "모닥불"
      }
    ],
    "site": {
      "x": 50,
      "y": 75,
      "w": 6,
      "h": 8,
      "layer": "lower"
    }
  },
  {
    "id": "entry-sign",
    "name": "남쪽 입구 길잡이",
    "anchor": {
      "type": "road",
      "x": 36,
      "y": 83,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "entry-sign-1",
        "name": "나무 이정표",
        "x": 34,
        "y": 85,
        "purpose": "성으로 오르는 길 안내"
      },
      {
        "id": "entry-sign-2",
        "name": "돌등",
        "x": 38,
        "y": 80,
        "purpose": "입구 길 밝히기"
      }
    ],
    "site": {
      "x": 36,
      "y": 83,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  }
]
```
