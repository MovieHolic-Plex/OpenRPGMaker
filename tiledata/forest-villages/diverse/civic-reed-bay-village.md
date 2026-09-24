# 공동 공간과 정원의 배치(완성 맵 좌표)

개정14에서 우물가에 광장 소품(id …-plaza-N)을 더했다. civic-programs.json 은 압축 전 저작 입력이다.

```json
[
  {
    "id": "market",
    "name": "밭과 골목 사이 수확물 판매 자리",
    "anchor": {
      "type": "farm",
      "x": 20,
      "y": 40,
      "maxDistance": 11
    },
    "items": [
      {
        "id": "market-1",
        "name": "가로 탁자",
        "x": 20,
        "y": 33,
        "purpose": "수확물을 선별하고 판매하는 작업면"
      },
      {
        "id": "market-3",
        "name": "과일 상자",
        "x": 23,
        "y": 33,
        "purpose": "판매대에 보충할 과일 저장",
        "near": "가로 탁자"
      },
      {
        "id": "market-4",
        "name": "게시판",
        "x": 19,
        "y": 31,
        "purpose": "판매 자리와 마을 소식 안내"
      },
      {
        "id": "market-5",
        "name": "징검돌",
        "x": 20,
        "y": 35,
        "purpose": "판매자와 손님이 서는 자리",
        "near": "가로 탁자"
      },
      {
        "id": "market-6",
        "name": "나무 울타리",
        "x": 20,
        "y": 39,
        "purpose": "밭 북쪽 경계 보호"
      }
    ],
    "site": {
      "x": 20,
      "y": 40,
      "w": 6,
      "h": 4,
      "layer": "lower"
    }
  },
  {
    "id": "well",
    "name": "중앙 골목의 공동 우물",
    "anchor": {
      "type": "road",
      "x": 39,
      "y": 22,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "well-1",
        "name": "낮은 돌 우물",
        "x": 43,
        "y": 20,
        "purpose": "주택과 선착장 이용자의 급수"
      },
      {
        "id": "well-2",
        "name": "항아리",
        "x": 45,
        "y": 22,
        "purpose": "우물물을 담는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-3",
        "name": "징검돌",
        "x": 43,
        "y": 22,
        "purpose": "우물 앞 보행 자리",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-4",
        "name": "게시판",
        "x": 46,
        "y": 19,
        "purpose": "골목 주민의 공동 공지"
      },
      {
        "id": "well-plaza-1",
        "name": "벤치",
        "x": 46,
        "y": 21,
        "purpose": "우물가에 앉아 쉬는 자리",
        "near": "낮은 돌 우물"
      },
      {
        "id": "well-plaza-2",
        "name": "돌등",
        "x": 41,
        "y": 22,
        "purpose": "밤에 우물가를 밝히는 돌등",
        "near": "낮은 돌 우물"
      }
    ],
    "site": {
      "x": 39,
      "y": 22,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "garden",
    "name": "윗집의 환영 정원",
    "anchor": {
      "type": "house",
      "id": "reed-bay-village-house-2",
      "maxDistance": 16
    },
    "items": [
      {
        "id": "garden-1",
        "name": "덩굴 아치",
        "x": 32,
        "y": 9,
        "purpose": "집 옆 정원 입구"
      },
      {
        "id": "garden-2",
        "name": "꽃 화단",
        "x": 30,
        "y": 8,
        "purpose": "정원 입구 화단",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-3",
        "name": "꽃 화단",
        "x": 34,
        "y": 8,
        "purpose": "정원 입구 화단",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-4",
        "name": "징검돌",
        "x": 32,
        "y": 11,
        "purpose": "정원 안 보행 자리",
        "near": "덩굴 아치"
      },
      {
        "id": "garden-5",
        "name": "새집",
        "x": 34,
        "y": 6,
        "purpose": "정원의 조용한 가장자리",
        "near": "꽃 화단"
      },
      {
        "id": "garden-6",
        "name": "나무 울타리",
        "x": 30,
        "y": 11,
        "purpose": "정원 남쪽 경계",
        "near": "꽃 화단"
      },
      {
        "id": "garden-7",
        "name": "나무 울타리",
        "x": 34,
        "y": 11,
        "purpose": "열린 보행 틈을 남긴 정원 경계",
        "near": "꽃 화단"
      }
    ],
    "site": {
      "x": 25,
      "y": 2,
      "w": 8,
      "h": 6,
      "layer": "lower"
    }
  },
  {
    "id": "dock",
    "name": "선착장 진입 안내",
    "anchor": {
      "type": "dock",
      "x": 46,
      "y": 39,
      "maxDistance": 8
    },
    "items": [
      {
        "id": "dock-1",
        "name": "표지판",
        "x": 50,
        "y": 36,
        "purpose": "선착장 이용 방향 안내"
      },
      {
        "id": "dock-2",
        "name": "돌등",
        "x": 52,
        "y": 37,
        "purpose": "선착장 진입부 조명"
      }
    ],
    "site": {
      "x": 46,
      "y": 39,
      "w": 21,
      "h": 2,
      "layer": "upper"
    }
  },
  {
    "id": "front",
    "name": "여관의 환영 마당",
    "anchor": {
      "type": "house",
      "id": "reed-bay-village-house-6",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "front-1",
        "name": "화분",
        "x": 48,
        "y": 33,
        "purpose": "여관 현관 옆 환영 식물"
      },
      {
        "id": "front-2",
        "name": "우편함",
        "x": 42,
        "y": 31,
        "purpose": "여관 투숙객 우편 수취"
      }
    ],
    "site": {
      "x": 43,
      "y": 25,
      "w": 5,
      "h": 7,
      "layer": "lower"
    }
  },
  {
    "id": "lamp-2",
    "name": "현관 옆 벽등",
    "anchor": {
      "type": "house",
      "id": "reed-bay-village-house-2",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "lamp-2-1",
        "name": "벽걸이 등불",
        "x": 30,
        "y": 6,
        "purpose": "현관 옆 벽면 조명"
      }
    ],
    "site": {
      "x": 25,
      "y": 2,
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
      "id": "reed-bay-village-house-6",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "lamp-6-1",
        "name": "벽걸이 등불",
        "x": 46,
        "y": 30,
        "purpose": "현관 옆 벽면 조명"
      }
    ],
    "site": {
      "x": 43,
      "y": 25,
      "w": 5,
      "h": 7,
      "layer": "lower"
    }
  },
  {
    "id": "lamp-8",
    "name": "현관 옆 벽등",
    "anchor": {
      "type": "house",
      "id": "reed-bay-village-house-8",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "lamp-8-1",
        "name": "벽걸이 등불",
        "x": 33,
        "y": 39,
        "purpose": "현관 옆 벽면 조명"
      }
    ],
    "site": {
      "x": 28,
      "y": 32,
      "w": 7,
      "h": 9,
      "layer": "lower"
    }
  },
  {
    "id": "dock-store",
    "name": "선착장 짐 부리는 곳",
    "anchor": {
      "type": "dock",
      "x": 46,
      "y": 39,
      "maxDistance": 8
    },
    "items": [
      {
        "id": "dock-store-1",
        "name": "술통",
        "x": 46,
        "y": 36,
        "purpose": "배에서 내린 물통"
      },
      {
        "id": "dock-store-2",
        "name": "술통",
        "x": 47,
        "y": 36,
        "purpose": "절인 생선을 담은 통",
        "near": "술통"
      },
      {
        "id": "dock-store-3",
        "name": "나무 상자",
        "x": 43,
        "y": 38,
        "purpose": "배로 들여온 짐 상자"
      },
      {
        "id": "dock-store-4",
        "name": "낚시 바구니",
        "x": 48,
        "y": 42,
        "purpose": "선착장 끝에서 쓰는 낚시 바구니"
      }
    ],
    "site": {
      "x": 46,
      "y": 39,
      "w": 21,
      "h": 2,
      "layer": "upper"
    }
  },
  {
    "id": "market-stall",
    "name": "밭 옆 판매 자리 노점",
    "anchor": {
      "type": "farm",
      "x": 20,
      "y": 40,
      "maxDistance": 11
    },
    "items": [
      {
        "id": "market-stall-1",
        "name": "장터 노점",
        "x": 25,
        "y": 33,
        "purpose": "밭에서 거둔 채소를 파는 좌판"
      },
      {
        "id": "market-stall-2",
        "name": "작은 오크통",
        "x": 24,
        "y": 36,
        "purpose": "노점 음료 통",
        "near": "장터 노점"
      }
    ],
    "site": {
      "x": 20,
      "y": 40,
      "w": 6,
      "h": 4,
      "layer": "lower"
    }
  },
  {
    "id": "west-stair-sign",
    "name": "서쪽 계단 아래 길잡이",
    "anchor": {
      "type": "road",
      "x": 15,
      "y": 21,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "west-stair-sign-1",
        "name": "나무 이정표",
        "x": 13,
        "y": 21,
        "purpose": "윗단 서쪽 집으로 오르는 계단 안내"
      }
    ],
    "site": {
      "x": 15,
      "y": 21,
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
      "x": 25,
      "y": 18,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "east-stair-sign-1",
        "name": "나무 이정표",
        "x": 23,
        "y": 19,
        "purpose": "윗단 파랑 지붕 집으로 오르는 계단 안내"
      }
    ],
    "site": {
      "x": 25,
      "y": 18,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "entry-sign",
    "name": "서쪽 입구 길잡이",
    "anchor": {
      "type": "road",
      "x": 4,
      "y": 27,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "entry-sign-1",
        "name": "나무 이정표",
        "x": 4,
        "y": 25,
        "purpose": "마을 서쪽 입구 방향 안내"
      }
    ],
    "site": {
      "x": 4,
      "y": 27,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "beach-fire",
    "name": "남쪽 물가 모닥불",
    "anchor": {
      "type": "house",
      "id": "reed-bay-village-house-7",
      "maxDistance": 12
    },
    "items": [
      {
        "id": "beach-fire-1",
        "name": "모닥불",
        "x": 17,
        "y": 44,
        "purpose": "물가에서 저녁에 불을 피우는 자리"
      },
      {
        "id": "beach-fire-2",
        "name": "벤치",
        "x": 14,
        "y": 45,
        "purpose": "물가를 보고 앉는 자리",
        "near": "모닥불"
      },
      {
        "id": "beach-fire-3",
        "name": "장작 더미",
        "x": 18,
        "y": 43,
        "purpose": "모닥불 장작",
        "near": "모닥불"
      }
    ],
    "site": {
      "x": 9,
      "y": 35,
      "w": 6,
      "h": 8,
      "layer": "lower"
    }
  },
  {
    "id": "overlook",
    "name": "윗단 절벽 끝 쉼터",
    "anchor": {
      "type": "house",
      "id": "reed-bay-village-house-1",
      "maxDistance": 10
    },
    "items": [
      {
        "id": "overlook-1",
        "name": "벤치",
        "x": 18,
        "y": 13,
        "purpose": "절벽 끝에서 포구를 내려다보는 자리"
      }
    ],
    "site": {
      "x": 8,
      "y": 6,
      "w": 4,
      "h": 7,
      "layer": "lower"
    }
  }
]
```
