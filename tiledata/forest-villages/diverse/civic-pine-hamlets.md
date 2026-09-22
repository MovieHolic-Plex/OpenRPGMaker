# 공동 공간과 정원의 명시 배치 입력

```json
[
  {
    "id": "well",
    "name": "두 둔덕 사이 공동 우물터",
    "anchor": {
      "type": "road",
      "x": 30,
      "y": 26,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "well-1",
        "name": "낮은 돌 우물",
        "x": 34,
        "y": 26,
        "purpose": "두 둔덕과 중앙 주거지의 공동 급수"
      },
      {
        "id": "well-2",
        "name": "항아리",
        "x": 37,
        "y": 27,
        "purpose": "길어 온 물을 담는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-3",
        "name": "징검돌",
        "x": 34,
        "y": 29,
        "purpose": "우물 앞 물 튀는 땅의 발 디딤",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-4",
        "name": "게시판",
        "x": 33,
        "y": 23,
        "purpose": "우물에 모인 주민의 마을 공지"
      },
      {
        "id": "well-5",
        "name": "돌등",
        "x": 32,
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
  }
]
```
