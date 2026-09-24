# 공동 공간과 정원의 배치(완성 맵 좌표)

개정14에서 우물가에 광장 소품(id …-plaza-N)을 더했다. civic-programs.json 은 압축 전 저작 입력이다.

```json
[
  {
    "id": "well",
    "name": "가운데 계단 아래 공동 우물터",
    "anchor": {
      "type": "road",
      "x": 33,
      "y": 23,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "well-1",
        "name": "낮은 돌 우물",
        "x": 35,
        "y": 24,
        "purpose": "윗단과 아랫마을 주민이 함께 쓰는 급수"
      },
      {
        "id": "well-2",
        "name": "항아리",
        "x": 37,
        "y": 25,
        "purpose": "길어 온 물을 담는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-3",
        "name": "징검돌",
        "x": 35,
        "y": 26,
        "purpose": "우물 앞 물 튀는 땅의 발 디딤",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-4",
        "name": "게시판",
        "x": 38,
        "y": 23,
        "purpose": "우물에 모인 주민의 마을 공지"
      },
      {
        "id": "well-5",
        "name": "돌등",
        "x": 34,
        "y": 25,
        "purpose": "우물과 연결 길목 조명",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-plaza-1",
        "name": "벤치",
        "x": 34,
        "y": 22,
        "purpose": "우물가에 앉아 쉬는 자리",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-plaza-2",
        "name": "화분",
        "x": 36,
        "y": 28,
        "purpose": "우물가를 꾸미는 화분",
        "near": "낮은 돌 우물"
      }
    ],
    "site": {
      "x": 33,
      "y": 23,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
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
        "x": 15,
        "y": 36,
        "purpose": "집에서 정원으로 들어가는 열린 문"
      },
      {
        "id": "garden-2",
        "name": "꽃 화단",
        "x": 12,
        "y": 37,
        "purpose": "정원 입구의 왼쪽 화단",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-3",
        "name": "꽃 화단",
        "x": 18,
        "y": 37,
        "purpose": "정원 입구의 오른쪽 화단",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-4",
        "name": "징검돌",
        "x": 15,
        "y": 39,
        "purpose": "정원 안 보행 자리",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-5",
        "name": "새집",
        "x": 18,
        "y": 35,
        "purpose": "정원 가장자리 새 쉼터",
        "near": "꽃 화단"
      },
      {
        "id": "garden-6",
        "name": "나무 울타리",
        "x": 12,
        "y": 39,
        "purpose": "정원 남쪽 경계의 짧은 패널",
        "near": "꽃 화단"
      },
      {
        "id": "garden-7",
        "name": "나무 울타리",
        "x": 17,
        "y": 40,
        "purpose": "열린 가운데 통로를 남긴 경계",
        "near": "꽃 화단"
      }
    ],
    "site": {
      "x": 11,
      "y": 28,
      "w": 4,
      "h": 7,
      "layer": "lower"
    }
  },
  {
    "id": "entry",
    "name": "남쪽 입구 안내",
    "anchor": {
      "type": "road",
      "x": 34,
      "y": 48,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "entry-1",
        "name": "표지판",
        "x": 31,
        "y": 49,
        "purpose": "산촌으로 들어오는 여행자 방향 안내"
      },
      {
        "id": "entry-2",
        "name": "돌등",
        "x": 36,
        "y": 47,
        "purpose": "입구 오솔길 조명"
      }
    ],
    "site": {
      "x": 34,
      "y": 48,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
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
        "x": 10,
        "y": 13,
        "purpose": "집 입구에서 우편 수취"
      },
      {
        "id": "front-2",
        "name": "화분",
        "x": 4,
        "y": 12,
        "purpose": "현관 옆 환영 식물"
      }
    ],
    "site": {
      "x": 6,
      "y": 7,
      "w": 4,
      "h": 7,
      "layer": "lower"
    }
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
        "x": 55,
        "y": 14,
        "purpose": "현관 옆 벽면 조명"
      }
    ],
    "site": {
      "x": 50,
      "y": 10,
      "w": 8,
      "h": 6,
      "layer": "lower"
    }
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
        "x": 53,
        "y": 40,
        "purpose": "현관 옆 벽면 조명"
      }
    ],
    "site": {
      "x": 50,
      "y": 35,
      "w": 5,
      "h": 7,
      "layer": "lower"
    }
  },
  {
    "id": "overlook",
    "name": "가운데 계단 위 전망 쉼터",
    "anchor": {
      "type": "road",
      "x": 32,
      "y": 15,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "overlook-1",
        "name": "벤치",
        "x": 37,
        "y": 13,
        "purpose": "절벽 끝에서 아랫마을을 내려다보며 쉬는 자리"
      },
      {
        "id": "overlook-2",
        "name": "벤치",
        "x": 26,
        "y": 13,
        "purpose": "계단을 오른 뒤 숨 돌리는 자리"
      },
      {
        "id": "overlook-3",
        "name": "나무 이정표",
        "x": 31,
        "y": 12,
        "purpose": "윗마을 동서 갈림길 방향 안내"
      }
    ],
    "site": {
      "x": 32,
      "y": 15,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "stair-signs",
    "name": "계단 아래 길잡이",
    "anchor": {
      "type": "road",
      "x": 32,
      "y": 22,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "stair-signs-1",
        "name": "나무 이정표",
        "x": 30,
        "y": 23,
        "purpose": "가운데 계단으로 오르는 길 안내"
      }
    ],
    "site": {
      "x": 32,
      "y": 22,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "west-stair-sign",
    "name": "서쪽 계단 아래 길잡이",
    "anchor": {
      "type": "road",
      "x": 11,
      "y": 25,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "west-stair-sign-1",
        "name": "나무 이정표",
        "x": 13,
        "y": 24,
        "purpose": "서쪽 계단으로 오르는 길 안내"
      }
    ],
    "site": {
      "x": 11,
      "y": 25,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "east-stair-sign",
    "name": "동쪽 계단 아래 길잡이",
    "anchor": {
      "type": "road",
      "x": 52,
      "y": 26,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "east-stair-sign-1",
        "name": "나무 이정표",
        "x": 49,
        "y": 26,
        "purpose": "동쪽 계단으로 오르는 길 안내"
      }
    ],
    "site": {
      "x": 52,
      "y": 26,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
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
        "x": 47,
        "y": 14,
        "purpose": "목공 작업에서 나온 장작을 쌓아 두는 자리"
      },
      {
        "id": "woodyard-2",
        "name": "장작 더미",
        "x": 46,
        "y": 17,
        "purpose": "겨울용 땔감 두 번째 더미",
        "near": "장작 더미"
      },
      {
        "id": "woodyard-3",
        "name": "술통",
        "x": 59,
        "y": 14,
        "purpose": "작업용 물을 받아 두는 통"
      }
    ],
    "site": {
      "x": 50,
      "y": 10,
      "w": 8,
      "h": 6,
      "layer": "lower"
    }
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
        "x": 7,
        "y": 34,
        "purpose": "저녁에 샘가 주민이 모이는 불자리"
      },
      {
        "id": "campfire-2",
        "name": "벤치",
        "x": 7,
        "y": 36,
        "purpose": "불가 남쪽 앉을 자리",
        "near": "모닥불"
      },
      {
        "id": "campfire-3",
        "name": "벤치",
        "x": 8,
        "y": 33,
        "purpose": "불가 북쪽 앉을 자리",
        "near": "모닥불"
      },
      {
        "id": "campfire-4",
        "name": "장작 더미",
        "x": 9,
        "y": 35,
        "purpose": "모닥불에 쓸 장작",
        "near": "모닥불"
      }
    ],
    "site": {
      "x": 11,
      "y": 28,
      "w": 4,
      "h": 7,
      "layer": "lower"
    }
  },
  {
    "id": "market",
    "name": "우물 아래 작은 장터",
    "anchor": {
      "type": "road",
      "x": 26,
      "y": 30,
      "maxDistance": 12
    },
    "items": [
      {
        "id": "market-1",
        "name": "장터 노점",
        "x": 28,
        "y": 32,
        "purpose": "아랫마을 주민이 채소와 과일을 파는 좌판"
      },
      {
        "id": "market-2",
        "name": "과일 좌판",
        "x": 32,
        "y": 34,
        "purpose": "산에서 딴 과일을 늘어놓은 상자",
        "near": "장터 노점"
      },
      {
        "id": "market-3",
        "name": "술통",
        "x": 27,
        "y": 36,
        "purpose": "장터 음료 통",
        "near": "장터 노점"
      },
      {
        "id": "market-4",
        "name": "벤치",
        "x": 29,
        "y": 37,
        "purpose": "장 보러 온 사람의 쉼 자리"
      }
    ],
    "site": {
      "x": 26,
      "y": 30,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  }
]
```
