# 공동 공간과 정원의 명시 배치 입력

```json
[
  {
    "id": "well",
    "name": "상단 두 집의 공동 우물터",
    "anchor": {
      "type": "road",
      "x": 44,
      "y": 20,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "well-1",
        "name": "낮은 돌 우물",
        "x": 39,
        "y": 16,
        "purpose": "상단 주택에서 계단을 내려가지 않고 물 긷기"
      },
      {
        "id": "well-2",
        "name": "항아리",
        "x": 41,
        "y": 17,
        "purpose": "물을 담아 집으로 옮기는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-3",
        "name": "징검돌",
        "x": 39,
        "y": 18,
        "purpose": "급수 작업 발 디딤",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-4",
        "name": "꽃 화단",
        "x": 38,
        "y": 14,
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
        "x": 31,
        "y": 29,
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
        "x": 33,
        "y": 30,
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
  },
  {
    "id": "overlook",
    "name": "윗단 절벽 끝 전망 쉼터",
    "anchor": {
      "type": "road",
      "x": 50,
      "y": 20,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "overlook-1",
        "name": "벤치",
        "x": 47,
        "y": 17,
        "purpose": "가운데 단과 아랫단을 내려다보는 자리"
      },
      {
        "id": "overlook-2",
        "name": "나무 이정표",
        "x": 42,
        "y": 19,
        "purpose": "서쪽 계단으로 내려가는 길 안내"
      },
      {
        "id": "overlook-3",
        "name": "나무 이정표",
        "x": 59,
        "y": 19,
        "purpose": "동쪽 계단으로 내려가는 길 안내"
      }
    ]
  },
  {
    "id": "mid-east-sign",
    "name": "동쪽 계단 아래 길잡이",
    "anchor": {
      "type": "road",
      "x": 62,
      "y": 29,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "mid-east-sign-1",
        "name": "나무 이정표",
        "x": 64,
        "y": 29,
        "purpose": "윗단으로 오르는 동쪽 계단 안내"
      }
    ]
  },
  {
    "id": "lower-signs",
    "name": "아랫단 계단 발치 길잡이",
    "anchor": {
      "type": "road",
      "x": 27,
      "y": 53,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "lower-signs-1",
        "name": "나무 이정표",
        "x": 24,
        "y": 53,
        "purpose": "가운데 단으로 오르는 서쪽 계단 안내"
      }
    ]
  },
  {
    "id": "lower-east-sign",
    "name": "아랫단 동쪽 계단 발치",
    "anchor": {
      "type": "road",
      "x": 46,
      "y": 53,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "lower-east-sign-1",
        "name": "나무 이정표",
        "x": 48,
        "y": 53,
        "purpose": "가운데 단으로 오르는 동쪽 계단 안내"
      }
    ]
  },
  {
    "id": "cave-camp",
    "name": "동쪽 아랫단 불자리",
    "anchor": {
      "type": "house",
      "id": "terrace-cliff-village-house-8",
      "maxDistance": 12
    },
    "items": [
      {
        "id": "cave-camp-1",
        "name": "모닥불",
        "x": 74,
        "y": 53,
        "purpose": "저녁에 동쪽 집 주민이 모이는 불"
      },
      {
        "id": "cave-camp-2",
        "name": "벤치",
        "x": 73,
        "y": 55,
        "purpose": "불가에 앉는 자리",
        "near": "모닥불"
      },
      {
        "id": "cave-camp-3",
        "name": "나무 상자",
        "x": 67,
        "y": 53,
        "purpose": "땔감과 불쏘시개를 담는 상자"
      },
      {
        "id": "cave-camp-4",
        "name": "술통",
        "x": 65,
        "y": 54,
        "purpose": "불 곁에 두는 물통",
        "near": "나무 상자"
      }
    ]
  },
  {
    "id": "mid-market",
    "name": "가운데 단 장터",
    "anchor": {
      "type": "house",
      "id": "terrace-cliff-village-house-4",
      "maxDistance": 12
    },
    "items": [
      {
        "id": "mid-market-1",
        "name": "장터 노점",
        "x": 29,
        "y": 39,
        "purpose": "세 단 주민이 모두 들르는 가운데 단 좌판"
      },
      {
        "id": "mid-market-2",
        "name": "과일 좌판",
        "x": 29,
        "y": 42,
        "purpose": "윗단 과수에서 딴 과일",
        "near": "장터 노점"
      },
      {
        "id": "mid-market-3",
        "name": "작은 오크통",
        "x": 32,
        "y": 37,
        "purpose": "노점 음료를 담는 통",
        "near": "장터 노점"
      },
      {
        "id": "mid-market-4",
        "name": "벤치",
        "x": 32,
        "y": 42,
        "purpose": "장 보러 온 사람의 쉼 자리"
      }
    ]
  },
  {
    "id": "mid-woodpile",
    "name": "가운데 단 서쪽 집 땔감",
    "anchor": {
      "type": "house",
      "id": "terrace-cliff-village-house-3",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "mid-woodpile-1",
        "name": "장작 더미",
        "x": 20,
        "y": 34,
        "purpose": "서쪽 집의 겨울 땔감"
      },
      {
        "id": "mid-woodpile-2",
        "name": "장작 더미",
        "x": 21,
        "y": 36,
        "purpose": "땔감 두 번째 더미",
        "near": "장작 더미"
      }
    ]
  }
]
```
