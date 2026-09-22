# 공동 공간과 정원의 명시 배치 입력

```json
[
  {
    "id": "well",
    "name": "가운데 계단 아래 공동 우물터",
    "anchor": {
      "type": "road",
      "x": 40,
      "y": 25,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "well-1",
        "name": "낮은 돌 우물",
        "x": 42,
        "y": 26,
        "purpose": "윗단과 아랫마을 주민이 함께 쓰는 급수"
      },
      {
        "id": "well-2",
        "name": "항아리",
        "x": 44,
        "y": 27,
        "purpose": "길어 온 물을 담는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-3",
        "name": "징검돌",
        "x": 42,
        "y": 28,
        "purpose": "우물 앞 물 튀는 땅의 발 디딤",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-4",
        "name": "게시판",
        "x": 45,
        "y": 25,
        "purpose": "우물에 모인 주민의 마을 공지"
      },
      {
        "id": "well-5",
        "name": "돌등",
        "x": 41,
        "y": 27,
        "purpose": "우물과 연결 길목 조명",
        "near": "낮은 돌 우물"
      }
    ]
  },
  {
    "id": "garden",
    "name": "샘 윗집의 앞마당 정원",
    "anchor": {
      "type": "house",
      "id": "pine-hamlets-house-4",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "garden-1",
        "name": "덩굴 아치",
        "x": 21,
        "y": 40,
        "purpose": "집에서 정원으로 들어가는 열린 문"
      },
      {
        "id": "garden-2",
        "name": "꽃 화단",
        "x": 18,
        "y": 41,
        "purpose": "정원 입구의 왼쪽 화단",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-3",
        "name": "꽃 화단",
        "x": 24,
        "y": 41,
        "purpose": "정원 입구의 오른쪽 화단",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-4",
        "name": "징검돌",
        "x": 21,
        "y": 43,
        "purpose": "정원 안 보행 자리",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-5",
        "name": "새집",
        "x": 24,
        "y": 39,
        "purpose": "정원 가장자리 새 쉼터",
        "near": "꽃 화단"
      },
      {
        "id": "garden-6",
        "name": "나무 울타리",
        "x": 18,
        "y": 44,
        "purpose": "정원 남쪽 경계의 짧은 패널",
        "near": "꽃 화단"
      },
      {
        "id": "garden-7",
        "name": "나무 울타리",
        "x": 23,
        "y": 44,
        "purpose": "열린 가운데 통로를 남긴 경계",
        "near": "꽃 화단"
      }
    ]
  },
  {
    "id": "entry",
    "name": "남쪽 입구 안내",
    "anchor": {
      "type": "road",
      "x": 40,
      "y": 58,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "entry-1",
        "name": "표지판",
        "x": 37,
        "y": 58,
        "purpose": "산촌으로 들어오는 여행자 방향 안내"
      },
      {
        "id": "entry-2",
        "name": "돌등",
        "x": 42,
        "y": 57,
        "purpose": "입구 오솔길 조명"
      }
    ]
  },
  {
    "id": "front",
    "name": "북쪽 집의 현관",
    "anchor": {
      "type": "house",
      "id": "pine-hamlets-house-1",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "front-1",
        "name": "우편함",
        "x": 16,
        "y": 15,
        "purpose": "집 입구에서 우편 수취"
      },
      {
        "id": "front-2",
        "name": "화분",
        "x": 10,
        "y": 14,
        "purpose": "현관 옆 환영 식물"
      }
    ]
  },
  {
    "id": "lamp-3",
    "name": "현관 옆 벽등",
    "anchor": {
      "type": "house",
      "id": "pine-hamlets-house-3",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "lamp-3-1",
        "name": "벽걸이 등불",
        "x": 66,
        "y": 16,
        "purpose": "현관 옆 벽면 조명"
      }
    ]
  },
  {
    "id": "lamp-6",
    "name": "현관 옆 벽등",
    "anchor": {
      "type": "house",
      "id": "pine-hamlets-house-6",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "lamp-6-1",
        "name": "벽걸이 등불",
        "x": 64,
        "y": 48,
        "purpose": "현관 옆 벽면 조명"
      }
    ]
  },
  {
    "id": "overlook",
    "name": "가운데 계단 위 전망 쉼터",
    "anchor": {
      "type": "road",
      "x": 39,
      "y": 17,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "overlook-1",
        "name": "벤치",
        "x": 44,
        "y": 15,
        "purpose": "절벽 끝에서 아랫마을을 내려다보며 쉬는 자리"
      },
      {
        "id": "overlook-2",
        "name": "벤치",
        "x": 33,
        "y": 15,
        "purpose": "계단을 오른 뒤 숨 돌리는 자리"
      },
      {
        "id": "overlook-3",
        "name": "나무 이정표",
        "x": 38,
        "y": 14,
        "purpose": "윗마을 동서 갈림길 방향 안내"
      }
    ]
  },
  {
    "id": "stair-signs",
    "name": "계단 아래 길잡이",
    "anchor": {
      "type": "road",
      "x": 39,
      "y": 24,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "stair-signs-1",
        "name": "나무 이정표",
        "x": 37,
        "y": 25,
        "purpose": "가운데 계단으로 오르는 길 안내"
      }
    ]
  },
  {
    "id": "west-stair-sign",
    "name": "서쪽 계단 아래 길잡이",
    "anchor": {
      "type": "road",
      "x": 17,
      "y": 27,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "west-stair-sign-1",
        "name": "나무 이정표",
        "x": 19,
        "y": 26,
        "purpose": "서쪽 계단으로 오르는 길 안내"
      }
    ]
  },
  {
    "id": "east-stair-sign",
    "name": "동쪽 계단 아래 길잡이",
    "anchor": {
      "type": "road",
      "x": 63,
      "y": 28,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "east-stair-sign-1",
        "name": "나무 이정표",
        "x": 60,
        "y": 28,
        "purpose": "동쪽 계단으로 오르는 길 안내"
      }
    ]
  },
  {
    "id": "woodyard",
    "name": "목공 작업집 땔감 마당",
    "anchor": {
      "type": "house",
      "id": "pine-hamlets-house-3",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "woodyard-1",
        "name": "장작 더미",
        "x": 58,
        "y": 16,
        "purpose": "목공 작업에서 나온 장작을 쌓아 두는 자리"
      },
      {
        "id": "woodyard-2",
        "name": "장작 더미",
        "x": 57,
        "y": 19,
        "purpose": "겨울용 땔감 두 번째 더미",
        "near": "장작 더미"
      },
      {
        "id": "woodyard-3",
        "name": "술통",
        "x": 70,
        "y": 16,
        "purpose": "작업용 물을 받아 두는 통"
      }
    ]
  },
  {
    "id": "campfire",
    "name": "샘가 모닥불 쉼터",
    "anchor": {
      "type": "house",
      "id": "pine-hamlets-house-4",
      "maxDistance": 12
    },
    "items": [
      {
        "id": "campfire-1",
        "name": "모닥불",
        "x": 11,
        "y": 38,
        "purpose": "저녁에 샘가 주민이 모이는 불자리"
      },
      {
        "id": "campfire-2",
        "name": "벤치",
        "x": 11,
        "y": 40,
        "purpose": "불가 남쪽 앉을 자리",
        "near": "모닥불"
      },
      {
        "id": "campfire-3",
        "name": "벤치",
        "x": 13,
        "y": 36,
        "purpose": "불가 북쪽 앉을 자리",
        "near": "모닥불"
      },
      {
        "id": "campfire-4",
        "name": "장작 더미",
        "x": 14,
        "y": 38,
        "purpose": "모닥불에 쓸 장작",
        "near": "모닥불"
      }
    ]
  },
  {
    "id": "market",
    "name": "우물 아래 작은 장터",
    "anchor": {
      "type": "road",
      "x": 32,
      "y": 33,
      "maxDistance": 12
    },
    "items": [
      {
        "id": "market-1",
        "name": "장터 노점",
        "x": 34,
        "y": 36,
        "purpose": "아랫마을 주민이 채소와 과일을 파는 좌판"
      },
      {
        "id": "market-2",
        "name": "과일 좌판",
        "x": 38,
        "y": 38,
        "purpose": "산에서 딴 과일을 늘어놓은 상자",
        "near": "장터 노점"
      },
      {
        "id": "market-3",
        "name": "술통",
        "x": 33,
        "y": 40,
        "purpose": "장터 음료 통",
        "near": "장터 노점"
      },
      {
        "id": "market-4",
        "name": "벤치",
        "x": 35,
        "y": 42,
        "purpose": "장 보러 온 사람의 쉼 자리"
      }
    ]
  }
]
```
