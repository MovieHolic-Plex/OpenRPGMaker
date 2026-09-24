# 공동 공간과 정원의 배치(완성 맵 좌표)

개정14에서 우물가에 광장 소품(id …-plaza-N)을 더했다. civic-programs.json 은 압축 전 저작 입력이다.

```json
[
  {
    "id": "well",
    "name": "상단 두 집의 공동 우물터",
    "anchor": {
      "type": "road",
      "x": 33,
      "y": 15,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "well-1",
        "name": "낮은 돌 우물",
        "x": 28,
        "y": 11,
        "purpose": "상단 주택에서 계단을 내려가지 않고 물 긷기"
      },
      {
        "id": "well-2",
        "name": "항아리",
        "x": 30,
        "y": 12,
        "purpose": "물을 담아 집으로 옮기는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-3",
        "name": "징검돌",
        "x": 28,
        "y": 13,
        "purpose": "급수 작업 발 디딤",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-4",
        "name": "꽃 화단",
        "x": 27,
        "y": 9,
        "purpose": "주민이 가꾸는 우물터 화단",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-plaza-1",
        "name": "벤치",
        "x": 30,
        "y": 10,
        "purpose": "우물가에 앉아 쉬는 자리",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-plaza-2",
        "name": "돌등",
        "x": 26,
        "y": 12,
        "purpose": "밤에 우물가를 밝히는 돌등",
        "near": "낮은 돌 우물"
      }
    ],
    "site": {
      "x": 33,
      "y": 15,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "stairs",
    "name": "중단 계단의 안내 자리",
    "anchor": {
      "type": "road",
      "x": 23,
      "y": 26,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "stairs-2",
        "name": "표지판",
        "x": 25,
        "y": 25,
        "purpose": "상단 주거지와 하단 출구 방향"
      },
      {
        "id": "stairs-3",
        "name": "돌등",
        "x": 22,
        "y": 24,
        "purpose": "계단 하단 야간 조명"
      }
    ],
    "site": {
      "x": 23,
      "y": 26,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
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
        "x": 24,
        "y": 46,
        "purpose": "집에서 꽃마당으로 들어가는 문"
      },
      {
        "id": "garden-2",
        "name": "꽃 화단",
        "x": 22,
        "y": 46,
        "purpose": "마당 입구 화단",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-3",
        "name": "꽃 화단",
        "x": 27,
        "y": 46,
        "purpose": "마당 입구 화단",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-4",
        "name": "징검돌",
        "x": 24,
        "y": 48,
        "purpose": "꽃마당의 보행 자리",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-5",
        "name": "새집",
        "x": 27,
        "y": 48,
        "purpose": "정원의 조용한 새 쉼터",
        "near": "꽃 화단"
      },
      {
        "id": "garden-6",
        "name": "나무 울타리",
        "x": 27,
        "y": 50,
        "purpose": "통로를 가리지 않는 정원 경계",
        "near": "꽃 화단"
      }
    ],
    "site": {
      "x": 11,
      "y": 45,
      "w": 6,
      "h": 8,
      "layer": "lower"
    }
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
        "x": 17,
        "y": 52,
        "purpose": "길에서 접근하는 우편 수취"
      },
      {
        "id": "front-2",
        "name": "화분",
        "x": 10,
        "y": 50,
        "purpose": "집 앞을 가꾸는 화분"
      }
    ],
    "site": {
      "x": 11,
      "y": 45,
      "w": 6,
      "h": 8,
      "layer": "lower"
    }
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
        "x": 41,
        "y": 13,
        "purpose": "현관 옆 벽면 조명"
      }
    ],
    "site": {
      "x": 36,
      "y": 6,
      "w": 7,
      "h": 9,
      "layer": "lower"
    }
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
        "x": 31,
        "y": 30,
        "purpose": "현관 옆 벽면 조명"
      }
    ],
    "site": {
      "x": 26,
      "y": 26,
      "w": 8,
      "h": 6,
      "layer": "lower"
    }
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
        "x": 38,
        "y": 53,
        "purpose": "현관 옆 벽면 조명"
      }
    ],
    "site": {
      "x": 35,
      "y": 48,
      "w": 5,
      "h": 7,
      "layer": "lower"
    }
  },
  {
    "id": "overlook",
    "name": "윗단 절벽 끝 전망 쉼터",
    "anchor": {
      "type": "road",
      "x": 37,
      "y": 15,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "overlook-2",
        "name": "나무 이정표",
        "x": 31,
        "y": 14,
        "purpose": "서쪽 계단으로 내려가는 길 안내"
      },
      {
        "id": "overlook-3",
        "name": "나무 이정표",
        "x": 45,
        "y": 14,
        "purpose": "동쪽 계단으로 내려가는 길 안내"
      }
    ],
    "site": {
      "x": 37,
      "y": 15,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "mid-east-sign",
    "name": "동쪽 계단 아래 길잡이",
    "anchor": {
      "type": "road",
      "x": 47,
      "y": 24,
      "maxDistance": 10
    },
    "items": [],
    "site": {
      "x": 47,
      "y": 24,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "lower-signs",
    "name": "아랫단 계단 발치 길잡이",
    "anchor": {
      "type": "road",
      "x": 19,
      "y": 43,
      "maxDistance": 10
    },
    "items": [],
    "site": {
      "x": 19,
      "y": 43,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "lower-east-sign",
    "name": "아랫단 동쪽 계단 발치",
    "anchor": {
      "type": "road",
      "x": 34,
      "y": 43,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "lower-east-sign-1",
        "name": "나무 이정표",
        "x": 36,
        "y": 43,
        "purpose": "가운데 단으로 오르는 동쪽 계단 안내"
      }
    ],
    "site": {
      "x": 34,
      "y": 43,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "cave-camp",
    "name": "동쪽 아랫단 불자리",
    "anchor": {
      "type": "house",
      "id": "terrace-cliff-village-house-8",
      "maxDistance": 12
    },
    "items": [],
    "site": {
      "x": 53,
      "y": 45,
      "w": 4,
      "h": 7,
      "layer": "lower"
    }
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
        "x": 21,
        "y": 32,
        "purpose": "세 단 주민이 모두 들르는 가운데 단 좌판"
      },
      {
        "id": "mid-market-2",
        "name": "과일 좌판",
        "x": 21,
        "y": 34,
        "purpose": "윗단 과수에서 딴 과일",
        "near": "장터 노점"
      },
      {
        "id": "mid-market-3",
        "name": "작은 오크통",
        "x": 23,
        "y": 30,
        "purpose": "노점 음료를 담는 통",
        "near": "장터 노점"
      },
      {
        "id": "mid-market-4",
        "name": "벤치",
        "x": 23,
        "y": 34,
        "purpose": "장 보러 온 사람의 쉼 자리"
      }
    ],
    "site": {
      "x": 26,
      "y": 26,
      "w": 8,
      "h": 6,
      "layer": "lower"
    }
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
        "x": 15,
        "y": 27,
        "purpose": "서쪽 집의 겨울 땔감"
      },
      {
        "id": "mid-woodpile-2",
        "name": "장작 더미",
        "x": 15,
        "y": 29,
        "purpose": "땔감 두 번째 더미",
        "near": "장작 더미"
      }
    ],
    "site": {
      "x": 8,
      "y": 22,
      "w": 6,
      "h": 8,
      "layer": "lower"
    }
  }
]
```
