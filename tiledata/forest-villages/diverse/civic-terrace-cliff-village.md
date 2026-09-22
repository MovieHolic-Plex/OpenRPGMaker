# 공동 공간과 정원의 명시 배치 입력

```json
[
  {
    "id": "well",
    "name": "상단 두 집의 공동 우물터",
    "anchor": {
      "type": "road",
      "x": 43,
      "y": 19,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "well-1",
        "name": "낮은 돌 우물",
        "x": 44,
        "y": 16,
        "purpose": "상단 주택에서 계단을 내려가지 않고 물 긷기"
      },
      {
        "id": "well-2",
        "name": "항아리",
        "x": 47,
        "y": 17,
        "purpose": "물을 담아 집으로 옮기는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-3",
        "name": "징검돌",
        "x": 44,
        "y": 18,
        "purpose": "급수 작업 발 디딤",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-4",
        "name": "꽃 화단",
        "x": 44,
        "y": 13,
        "purpose": "주민이 가꾸는 우물터 화단",
        "near": "낮은 돌 우물"
      }
    ]
  },
  {
    "id": "stairs",
    "name": "중단 계단의 안내 자리",
    "anchor": {
      "type": "road",
      "x": 34,
      "y": 32,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "stairs-1",
        "name": "게시판",
        "x": 30,
        "y": 31,
        "purpose": "층별 생활권과 공동 작업 공지"
      },
      {
        "id": "stairs-2",
        "name": "표지판",
        "x": 36,
        "y": 31,
        "purpose": "상단 주거지와 하단 출구 방향"
      },
      {
        "id": "stairs-3",
        "name": "돌등",
        "x": 32,
        "y": 31,
        "purpose": "계단 하단 야간 조명"
      }
    ]
  },
  {
    "id": "garden",
    "name": "아랫집의 작은 꽃마당",
    "anchor": {
      "type": "house",
      "id": "terrace-cliff-village-house-6",
      "maxDistance": 16
    },
    "items": [
      {
        "id": "garden-1",
        "name": "덩굴 아치",
        "x": 33,
        "y": 56,
        "purpose": "집에서 꽃마당으로 들어가는 문"
      },
      {
        "id": "garden-2",
        "name": "꽃 화단",
        "x": 30,
        "y": 56,
        "purpose": "마당 입구 화단",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-3",
        "name": "꽃 화단",
        "x": 36,
        "y": 56,
        "purpose": "마당 입구 화단",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-4",
        "name": "징검돌",
        "x": 33,
        "y": 58,
        "purpose": "꽃마당의 보행 자리",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-5",
        "name": "새집",
        "x": 36,
        "y": 58,
        "purpose": "정원의 조용한 새 쉼터",
        "near": "꽃 화단"
      },
      {
        "id": "garden-6",
        "name": "나무 울타리",
        "x": 36,
        "y": 60,
        "purpose": "통로를 가리지 않는 정원 경계",
        "near": "꽃 화단"
      }
    ]
  },
  {
    "id": "front",
    "name": "아랫집 현관",
    "anchor": {
      "type": "house",
      "id": "terrace-cliff-village-house-6",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "front-1",
        "name": "우편함",
        "x": 24,
        "y": 62,
        "purpose": "길에서 접근하는 우편 수취"
      },
      {
        "id": "front-2",
        "name": "화분",
        "x": 17,
        "y": 60,
        "purpose": "집 앞을 가꾸는 화분"
      }
    ]
  },
  {
    "id": "lamp-2",
    "name": "현관 옆 벽등",
    "anchor": {
      "type": "house",
      "id": "terrace-cliff-village-house-2",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "lamp-2-1",
        "name": "벽걸이 등불",
        "x": 54,
        "y": 18,
        "purpose": "현관 옆 벽면 조명"
      }
    ]
  },
  {
    "id": "lamp-4",
    "name": "현관 옆 벽등",
    "anchor": {
      "type": "house",
      "id": "terrace-cliff-village-house-4",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "lamp-4-1",
        "name": "벽걸이 등불",
        "x": 42,
        "y": 37,
        "purpose": "현관 옆 벽면 조명"
      }
    ]
  },
  {
    "id": "lamp-7",
    "name": "현관 옆 벽등",
    "anchor": {
      "type": "house",
      "id": "terrace-cliff-village-house-7",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "lamp-7-1",
        "name": "벽걸이 등불",
        "x": 50,
        "y": 64,
        "purpose": "현관 옆 벽면 조명"
      }
    ]
  }
]
```
