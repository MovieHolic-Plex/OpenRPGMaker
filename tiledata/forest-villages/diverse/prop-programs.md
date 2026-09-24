# 활동별 부품·상대좌표·목적·기준 및 집별 명시 선언

활동 묶음(개정14: 3~5개)과 현관 꽃(doorway: 문 양옆 화단·화분, 문 앞 한 칸은 통로로 비움). 집별 선언은 완성 맵 좌표의 집 id로 적는다(prop-programs.json 의 x,y 키는 압축 전 저작 좌표).

```json
{
  "activities": {
    "laundry": {
      "name": "세탁·건조",
      "items": [
        [
          "빨랫줄",
          0,
          0,
          "세탁물을 말리는 자리",
          "house"
        ],
        [
          "나무통",
          2,
          1,
          "빨래를 헹구는 물통",
          "빨랫줄"
        ],
        [
          "항아리",
          3,
          1,
          "세탁에 쓸 물 보관",
          "빨랫줄"
        ]
      ],
      "fallbacks": [
        [
          0,
          2
        ]
      ],
      "compact": [
        0,
        2
      ]
    },
    "growing": {
      "name": "텃밭 돌보기",
      "items": [
        [
          "채소밭",
          0,
          2,
          "식재·수확할 작물",
          "house"
        ],
        [
          "허수아비",
          0,
          0,
          "바로 옆 작물 보호",
          "채소밭"
        ],
        [
          "씨앗 자루",
          2,
          1,
          "이 밭에 파종할 씨앗 보관",
          "채소밭"
        ],
        [
          "나무 울타리",
          2,
          3,
          "밭 가장자리를 두르는 울타리",
          "채소밭"
        ]
      ],
      "fallbacks": [
        [
          0,
          1,
          2
        ],
        [
          0,
          1
        ]
      ],
      "compact": [
        0,
        1
      ]
    },
    "woodwork": {
      "name": "목재 가공",
      "items": [
        [
          "가로 탁자",
          0,
          2,
          "목재를 다루는 작업면",
          "house"
        ],
        [
          "장작",
          0,
          0,
          "작업대에 공급할 목재",
          "가로 탁자"
        ],
        [
          "통나무 더미",
          1,
          0,
          "켜서 쓸 원목",
          "가로 탁자"
        ],
        [
          "나무 상자",
          2,
          0,
          "가공한 물건 보관",
          "가로 탁자"
        ],
        [
          "나무통",
          3,
          2,
          "짜 맞춘 통 완성품",
          "가로 탁자"
        ]
      ],
      "fallbacks": [
        [
          0,
          1,
          3
        ],
        [
          0,
          1
        ]
      ],
      "compact": [
        0,
        1
      ]
    },
    "herbs": {
      "name": "약초 손질",
      "items": [
        [
          "약초 화분",
          0,
          0,
          "손질할 약초 재배",
          "house"
        ],
        [
          "씨앗 자루",
          2,
          0,
          "다음에 심을 약초 씨앗",
          "약초 화분"
        ],
        [
          "가로 탁자",
          0,
          2,
          "약초 선별·건조 작업면",
          "약초 화분"
        ],
        [
          "항아리",
          3,
          2,
          "손질한 약초 보관",
          "가로 탁자"
        ]
      ],
      "fallbacks": [
        [
          0,
          2,
          3
        ],
        [
          0,
          2
        ]
      ],
      "compact": [
        0,
        2
      ]
    },
    "storage": {
      "name": "물자 보관",
      "items": [
        [
          "나무 상자",
          0,
          0,
          "운반 물자 보관",
          "house"
        ],
        [
          "나무통",
          2,
          0,
          "같은 창고의 벌크 물자 보관",
          "나무 상자"
        ],
        [
          "작은 오크통",
          3,
          0,
          "기름·식초 같은 작은 통 물자",
          "나무통"
        ],
        [
          "과일 상자",
          0,
          2,
          "나를 수확물 상자",
          "나무 상자"
        ],
        [
          "술통",
          3,
          2,
          "창고에 둔 술",
          "나무통"
        ]
      ],
      "fallbacks": [
        [
          0,
          1,
          3
        ],
        [
          0,
          1
        ]
      ],
      "compact": [
        0,
        1
      ]
    },
    "fishing": {
      "name": "부두 작업 준비",
      "items": [
        [
          "낚시 바구니",
          0,
          0,
          "부두에 가져갈 낚시 도구",
          "dock"
        ],
        [
          "나무통",
          2,
          0,
          "어획물을 담을 용기",
          "낚시 바구니"
        ],
        [
          "나무 상자",
          0,
          2,
          "어구 보관",
          "낚시 바구니"
        ],
        [
          "항아리",
          2,
          2,
          "어획물을 절일 소금",
          "나무통"
        ]
      ],
      "fallbacks": [
        [
          0,
          1,
          2
        ],
        [
          0,
          1
        ]
      ],
      "compact": [
        0,
        1
      ]
    },
    "field-tending": {
      "name": "기존 밭 돌보기",
      "items": [
        [
          "허수아비",
          0,
          0,
          "기존 밭의 작물 보호",
          "farm"
        ],
        [
          "씨앗 자루",
          0,
          3,
          "그 밭의 파종 준비",
          "farm"
        ],
        [
          "나무 상자",
          2,
          3,
          "거둔 작물을 담는 상자",
          "씨앗 자루"
        ]
      ],
      "fallbacks": [
        [
          0,
          1
        ]
      ],
      "compact": [
        0,
        1
      ]
    },
    "abandoned": {
      "name": "버려진 마당",
      "items": [
        [
          "마른 묘목",
          0,
          0,
          "손길이 끊겨 말라 버린 마당 나무",
          "house"
        ],
        [
          "부서진 울타리",
          2,
          0,
          "무너진 채 남은 마당 경계",
          "마른 묘목"
        ],
        [
          "통나무 더미",
          0,
          2,
          "쓰러진 채 썩어 가는 통나무",
          "마른 묘목"
        ]
      ],
      "fallbacks": [
        [
          0,
          1
        ]
      ],
      "compact": [
        0,
        1
      ]
    }
  },
  "doorway": {
    "name": "현관 꽃",
    "note": "문 양옆, 문 앞 한 칸(통로)은 비운다. 아랫단은 문 앞 줄, 윗단은 집 벽 밑단에 겹친다.",
    "items": [
      [
        "꽃 화단",
        0,
        0,
        "현관 옆을 밝히는 꽃 화단",
        "door"
      ],
      [
        "화분",
        0,
        0,
        "현관 옆에 둔 꽃 화분",
        "door"
      ]
    ]
  },
  "houses": {
    "pine-hamlets": [
      {
        "id": "pine-hamlets-house-1",
        "x": 6,
        "y": 7,
        "activity": "laundry",
        "role": "주거",
        "reason": "상단 서쪽 집의 생활 마당을 세탁·건조 공간으로 지정"
      },
      {
        "id": "pine-hamlets-house-2",
        "x": 26,
        "y": 4,
        "activity": "growing",
        "role": "텃밭집",
        "reason": "집 동쪽의 평탄한 빈터를 가족 텃밭으로 지정"
      },
      {
        "id": "pine-hamlets-house-3",
        "x": 50,
        "y": 10,
        "activity": "woodwork",
        "role": "목공 작업집",
        "reason": "북동 숲 생활권의 집에 목재 작업 기능을 부여"
      },
      {
        "id": "pine-hamlets-house-4",
        "x": 11,
        "y": 28,
        "activity": "herbs",
        "role": "약초 작업집",
        "reason": "서쪽 숲길 가까운 집의 야외 작업을 약초 손질로 지정"
      },
      {
        "id": "pine-hamlets-house-5",
        "x": 37,
        "y": 26,
        "activity": "laundry",
        "role": "주거",
        "reason": "중앙 갈림길의 주거 집에는 세탁 기능만 지정"
      },
      {
        "id": "pine-hamlets-house-6",
        "x": 50,
        "y": 35,
        "activity": "growing",
        "role": "텃밭집",
        "reason": "남동 집 옆 빈터를 소규모 자급 텃밭으로 지정"
      },
      {
        "id": "pine-hamlets-house-7",
        "x": 23,
        "y": 39,
        "activity": "storage",
        "role": "물자 보관집",
        "reason": "남쪽 진입 생활권의 집을 물자 보관 거점으로 지정"
      }
    ],
    "terrace-cliff-village": [
      {
        "id": "terrace-cliff-village-house-1",
        "x": 16,
        "y": 7,
        "activity": "laundry",
        "role": "주거",
        "reason": "상단 서쪽 주거 마당은 세탁·건조 공간"
      },
      {
        "id": "terrace-cliff-village-house-2",
        "x": 38,
        "y": 9,
        "activity": "herbs",
        "role": "약초 작업집",
        "reason": "상단 동쪽 마당에 약초 재배·손질 작업을 지정"
      },
      {
        "id": "terrace-cliff-village-house-3",
        "x": 8,
        "y": 25,
        "activity": "storage",
        "role": "물자 보관집",
        "reason": "중단 서쪽 길가 집을 물자 보관 거점으로 지정"
      },
      {
        "id": "terrace-cliff-village-house-4",
        "x": 26,
        "y": 29,
        "activity": "woodwork",
        "role": "목공 작업집",
        "reason": "중단 작업 생활권에 가공 작업대를 지정"
      },
      {
        "id": "terrace-cliff-village-house-5",
        "x": 52,
        "y": 29,
        "activity": "growing",
        "role": "텃밭집",
        "reason": "중단 동쪽 평탄한 마당을 자급 텃밭으로 지정"
      },
      {
        "id": "terrace-cliff-village-house-6",
        "x": 11,
        "y": 48,
        "activity": "laundry",
        "role": "주거",
        "reason": "하단 서쪽 주거 마당은 세탁·건조 공간"
      },
      {
        "id": "terrace-cliff-village-house-7",
        "x": 36,
        "y": 51,
        "activity": "storage",
        "role": "물자 보관집",
        "reason": "남쪽 입구와 연결되는 하단 집에 보관 기능 지정"
      },
      {
        "id": "terrace-cliff-village-house-8",
        "x": 56,
        "y": 48,
        "activity": "herbs",
        "role": "약초 작업집",
        "reason": "하단 동쪽 집에서 약초를 손질하는 공간 지정"
      }
    ],
    "twin-falls-river-village": [
      {
        "id": "twin-falls-river-village-house-1",
        "x": 8,
        "y": 3,
        "activity": "woodwork",
        "role": "목공 작업집",
        "reason": "윗단 서쪽 숲 가장자리 집에 목재 손질 마당을 둔다"
      },
      {
        "id": "twin-falls-river-village-house-2",
        "x": 45,
        "y": 5,
        "activity": "laundry",
        "role": "주거",
        "reason": "윗단 동쪽 강가 집은 세탁·건조 마당만 둔다"
      },
      {
        "id": "twin-falls-river-village-house-3",
        "x": 7,
        "y": 26,
        "activity": "herbs",
        "role": "약초 작업집",
        "reason": "가운데 단 서쪽 숲길 집에서 약초를 손질한다"
      },
      {
        "id": "twin-falls-river-village-house-4",
        "x": 22,
        "y": 24,
        "activity": "storage",
        "role": "물자 보관집",
        "reason": "폭포 아래 서쪽 다리목 집을 물자 보관 거점으로 둔다"
      },
      {
        "id": "twin-falls-river-village-house-5",
        "x": 40,
        "y": 25,
        "activity": "growing",
        "role": "텃밭집",
        "reason": "가운데 단 동쪽 강둑의 평지를 가족 텃밭으로 쓴다"
      },
      {
        "id": "twin-falls-river-village-house-6",
        "x": 54,
        "y": 25,
        "activity": "laundry",
        "role": "주거",
        "reason": "가운데 단 동쪽 끝 집은 세탁 마당만 둔다"
      },
      {
        "id": "twin-falls-river-village-house-7",
        "x": 5,
        "y": 48,
        "activity": "field-tending",
        "role": "밭집",
        "reason": "아랫단 서쪽 집이 바로 옆 밭을 돌본다"
      },
      {
        "id": "twin-falls-river-village-house-8",
        "x": 44,
        "y": 49,
        "activity": "storage",
        "role": "물자 보관집",
        "reason": "아랫단 동쪽 다리목 집을 짐 보관 거점으로 둔다"
      }
    ],
    "reed-bay-village": [
      {
        "id": "reed-bay-village-house-1",
        "x": 8,
        "y": 6,
        "activity": "growing",
        "role": "텃밭집",
        "reason": "북서 높은 마당을 자급 텃밭으로 지정"
      },
      {
        "id": "reed-bay-village-house-2",
        "x": 25,
        "y": 2,
        "activity": "laundry",
        "role": "주거",
        "reason": "북쪽 주거 집에는 세탁·건조 기능 지정"
      },
      {
        "id": "reed-bay-village-house-3",
        "x": 43,
        "y": 9,
        "activity": "storage",
        "role": "물자 보관집",
        "reason": "포구 북쪽 생활권의 물자 보관 거점"
      },
      {
        "id": "reed-bay-village-house-4",
        "x": 9,
        "y": 24,
        "activity": "laundry",
        "role": "주거",
        "reason": "서쪽 입구 인근 주거 마당은 세탁·건조 공간"
      },
      {
        "id": "reed-bay-village-house-5",
        "x": 28,
        "y": 19,
        "activity": "herbs",
        "role": "약초 작업집",
        "reason": "중앙 집의 야외 작업은 약초 재배·손질"
      },
      {
        "id": "reed-bay-village-house-6",
        "x": 43,
        "y": 25,
        "activity": "fishing",
        "role": "어업 준비집",
        "reason": "선착장 진입로 가까운 집에서 어구와 어획 용기 준비; 실제 부두 근접 조건 필요"
      },
      {
        "id": "reed-bay-village-house-7",
        "x": 9,
        "y": 35,
        "activity": "laundry",
        "role": "주거",
        "reason": "남서 물가 주거의 마당은 세탁·건조 공간"
      },
      {
        "id": "reed-bay-village-house-8",
        "x": 28,
        "y": 32,
        "activity": "field-tending",
        "role": "밭 관리집",
        "reason": "이미 있는 서쪽 밭(25,47)을 관리; 새 장식용 밭을 중복 생성하지 않음"
      }
    ],
    "chapel-hill-parish": [
      {
        "id": "chapel-hill-parish-house-1",
        "x": 30,
        "y": 4,
        "activity": "herbs",
        "role": "사제관",
        "reason": "교회 옆 사제관에서 제단에 올릴 약초를 기른다"
      },
      {
        "id": "chapel-hill-parish-house-2",
        "x": 49,
        "y": 3,
        "activity": "laundry",
        "role": "주거",
        "reason": "윗단 강 건너 집은 세탁 마당만 둔다"
      },
      {
        "id": "chapel-hill-parish-house-3",
        "x": 2,
        "y": 27,
        "activity": "woodwork",
        "role": "목수집",
        "reason": "아랫마을 서쪽 목수집이 교회 의자와 관을 짠다"
      },
      {
        "id": "chapel-hill-parish-house-4",
        "x": 14,
        "y": 30,
        "activity": "storage",
        "role": "종지기 집",
        "reason": "종지기가 초와 종 밧줄을 보관한다"
      },
      {
        "id": "chapel-hill-parish-house-5",
        "x": 30,
        "y": 28,
        "activity": "growing",
        "role": "텃밭집",
        "reason": "폭포 아래 강둑 평지를 가족 텃밭으로 쓴다"
      },
      {
        "id": "chapel-hill-parish-house-6",
        "x": 4,
        "y": 42,
        "activity": "laundry",
        "role": "주거",
        "reason": "남서쪽 집은 세탁 마당만 둔다"
      },
      {
        "id": "chapel-hill-parish-house-7",
        "x": 30,
        "y": 42,
        "activity": "field-tending",
        "role": "밭집",
        "reason": "바로 옆 밭을 돌본다"
      }
    ],
    "ford-castle-town": [
      {
        "id": "ford-castle-town-house-1",
        "x": 3,
        "y": 10,
        "activity": "storage",
        "role": "기사 숙소",
        "reason": "성 서쪽 기사 숙소에 마구와 보급품을 쌓아 둔다"
      },
      {
        "id": "ford-castle-town-house-2",
        "x": 72,
        "y": 12,
        "activity": "woodwork",
        "role": "망루지기 집",
        "reason": "강 건너 망루지기가 창 자루를 깎는다"
      },
      {
        "id": "ford-castle-town-house-3",
        "x": 7,
        "y": 29,
        "activity": "laundry",
        "role": "병사 숙소",
        "reason": "성 아래 서쪽 병사 숙소는 빨래 마당만 둔다"
      },
      {
        "id": "ford-castle-town-house-4",
        "x": 2,
        "y": 50,
        "activity": "laundry",
        "role": "주거",
        "reason": "가운데 단 서쪽 집은 세탁 마당만 둔다"
      },
      {
        "id": "ford-castle-town-house-5",
        "x": 16,
        "y": 51,
        "activity": "herbs",
        "role": "약방",
        "reason": "성 병사를 돌보는 약초 손질집"
      },
      {
        "id": "ford-castle-town-house-6",
        "x": 46,
        "y": 49,
        "activity": "storage",
        "role": "성 곳간",
        "reason": "성으로 올릴 곡식과 물자를 보관한다"
      },
      {
        "id": "ford-castle-town-house-7",
        "x": 74,
        "y": 51,
        "activity": "laundry",
        "role": "주거",
        "reason": "강 건너 가운데 단 집은 세탁 마당만 둔다"
      },
      {
        "id": "ford-castle-town-house-8",
        "x": 4,
        "y": 73,
        "activity": "growing",
        "role": "텃밭집",
        "reason": "아랫단 서쪽 집이 가족 텃밭을 기른다"
      },
      {
        "id": "ford-castle-town-house-9",
        "x": 40,
        "y": 74,
        "activity": "woodwork",
        "role": "목수집",
        "reason": "나루 배와 다리를 고치는 목수집"
      },
      {
        "id": "ford-castle-town-house-10",
        "x": 50,
        "y": 75,
        "activity": "storage",
        "role": "나루 창고",
        "reason": "나루로 들어온 짐을 보관한다"
      }
    ],
    "mistpond-hollow": [
      {
        "id": "mistpond-hollow-house-1",
        "x": 2,
        "y": 2,
        "activity": "abandoned",
        "role": "폐가",
        "reason": "사람이 떠나 마당이 말라 버렸고 부서진 울타리만 남았다"
      },
      {
        "id": "mistpond-hollow-house-2",
        "x": 42,
        "y": 4,
        "activity": "abandoned",
        "role": "폐가",
        "reason": "사람이 떠나 마당이 말라 버렸고 부서진 울타리만 남았다"
      },
      {
        "id": "mistpond-hollow-house-3",
        "x": 15,
        "y": 22,
        "activity": "abandoned",
        "role": "폐가",
        "reason": "사람이 떠나 마당이 말라 버렸고 부서진 울타리만 남았다"
      },
      {
        "id": "mistpond-hollow-house-4",
        "x": 44,
        "y": 22,
        "activity": "abandoned",
        "role": "폐가",
        "reason": "사람이 떠나 마당이 말라 버렸고 부서진 울타리만 남았다"
      },
      {
        "id": "mistpond-hollow-house-5",
        "x": 17,
        "y": 40,
        "activity": "abandoned",
        "role": "폐가",
        "reason": "사람이 떠나 마당이 말라 버렸고 부서진 울타리만 남았다"
      },
      {
        "id": "mistpond-hollow-house-6",
        "x": 47,
        "y": 41,
        "activity": "abandoned",
        "role": "폐가",
        "reason": "사람이 떠나 마당이 말라 버렸고 부서진 울타리만 남았다"
      },
      {
        "id": "mistpond-hollow-house-7",
        "x": 35,
        "y": 43,
        "activity": "herbs",
        "role": "못지기 집",
        "reason": "마지막으로 남은 못지기가 못가 약초를 손질하며 석상을 돌본다"
      }
    ]
  }
}
```
