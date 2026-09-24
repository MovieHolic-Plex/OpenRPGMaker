# 솔바람 흩어진 산촌

숲에서 숲까지 이어진 절벽 위 윗단과 아랫마을, 계단 세 곳, 갈라지는 오솔길과 작은 샘. 시작점 (30,49); 집 7채. 0기준 맵 좌표. 모든 집은 고정 조각이며 회전/잘라내기 금지. cliffs.points는 x가 증가하는 절벽 윗선 꼭짓점, height는 윗선→밑단의 y 차이다. stairs=[x,y,height]는 폭2, 윗선 행 y부터 y+height까지이고 양끝 착지칸은 y-1/y+height+1이다. 이전 plateaus 윤곽은 사용하지 않는다. 몸통·지붕·소품 전체 배열은 다음 부품 문서와 연결한다.

![솔바람 흩어진 산촌 완성](images/pine-hamlets.png)


## 입력 계획과 예약할 접근칸
```json
{
  "mapId": "pine-hamlets",
  "width": 61,
  "height": 53,
  "seed": 191,
  "start": {
    "x": 30,
    "y": 49
  },
  "yards": [
    {
      "ownerId": "pine-hamlets-house-1",
      "kit": "laundry",
      "name": "세탁·건조",
      "reason": "상단 서쪽 집의 생활 마당을 세탁·건조 공간으로 지정",
      "x": 11,
      "y": 9,
      "side": "right",
      "w": 4,
      "h": 2
    },
    {
      "ownerId": "pine-hamlets-house-2",
      "kit": "growing",
      "name": "텃밭 돌보기",
      "reason": "집 동쪽의 평탄한 빈터를 가족 텃밭으로 지정",
      "x": 18,
      "y": 6,
      "side": "left",
      "w": 4,
      "h": 4
    },
    {
      "ownerId": "pine-hamlets-house-3",
      "kit": "woodwork",
      "name": "목재 가공",
      "reason": "북동 숲 생활권의 집에 목재 작업 기능을 부여",
      "x": 41,
      "y": 9,
      "side": "left",
      "w": 4,
      "h": 3
    },
    {
      "ownerId": "pine-hamlets-house-4",
      "kit": "herbs",
      "name": "약초 손질",
      "reason": "서쪽 숲길 가까운 집의 야외 작업을 약초 손질로 지정",
      "x": 15,
      "y": 30,
      "side": "right",
      "w": 4,
      "h": 3
    },
    {
      "ownerId": "pine-hamlets-house-5",
      "kit": "laundry",
      "name": "세탁·건조",
      "reason": "중앙 갈림길의 주거 집에는 세탁 기능만 지정",
      "x": 39,
      "y": 29,
      "side": "right",
      "w": 4,
      "h": 2
    },
    {
      "ownerId": "pine-hamlets-house-6",
      "kit": "growing",
      "name": "텃밭 돌보기",
      "reason": "남동 집 옆 빈터를 소규모 자급 텃밭으로 지정",
      "x": 51,
      "y": 34,
      "side": "right",
      "w": 4,
      "h": 4
    },
    {
      "ownerId": "pine-hamlets-house-7",
      "kit": "storage",
      "name": "물자 보관",
      "reason": "남쪽 진입 생활권의 집을 물자 보관 거점으로 지정",
      "x": 17,
      "y": 39,
      "side": "left",
      "w": 4,
      "h": 3
    }
  ],
  "activitySites": {},
  "civicPlaces": [
    {
      "id": "well",
      "name": "가운데 계단 아래 공동 우물터",
      "anchor": {
        "type": "road",
        "x": 29,
        "y": 21,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "well-1",
          "name": "낮은 돌 우물",
          "x": 31,
          "y": 22,
          "purpose": "윗단과 아랫마을 주민이 함께 쓰는 급수"
        },
        {
          "id": "well-2",
          "name": "항아리",
          "x": 33,
          "y": 23,
          "purpose": "길어 온 물을 담는 용기",
          "near": "낮은 돌 우물"
        },
        {
          "id": "well-3",
          "name": "징검돌",
          "x": 31,
          "y": 24,
          "purpose": "우물 앞 물 튀는 땅의 발 디딤",
          "near": "낮은 돌 우물"
        },
        {
          "id": "well-4",
          "name": "게시판",
          "x": 34,
          "y": 21,
          "purpose": "우물에 모인 주민의 마을 공지"
        },
        {
          "id": "well-5",
          "name": "돌등",
          "x": 30,
          "y": 23,
          "purpose": "우물과 연결 길목 조명",
          "near": "낮은 돌 우물"
        },
        {
          "id": "well-plaza-1",
          "name": "벤치",
          "x": 30,
          "y": 20,
          "purpose": "우물가에 앉아 쉬는 자리",
          "near": "낮은 돌 우물"
        },
        {
          "id": "well-plaza-2",
          "name": "화분",
          "x": 32,
          "y": 26,
          "purpose": "우물가를 꾸미는 화분",
          "near": "낮은 돌 우물"
        }
      ],
      "site": {
        "x": 29,
        "y": 21,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1512
        ]
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
          "x": 14,
          "y": 34,
          "purpose": "집에서 정원으로 들어가는 열린 문"
        },
        {
          "id": "garden-2",
          "name": "꽃 화단",
          "x": 12,
          "y": 35,
          "purpose": "정원 입구의 왼쪽 화단",
          "near": "덩굴 아치"
        },
        {
          "id": "garden-3",
          "name": "꽃 화단",
          "x": 17,
          "y": 35,
          "purpose": "정원 입구의 오른쪽 화단",
          "near": "덩굴 아치"
        },
        {
          "id": "garden-4",
          "name": "징검돌",
          "x": 14,
          "y": 37,
          "purpose": "정원 안 보행 자리",
          "near": "덩굴 아치"
        },
        {
          "id": "garden-5",
          "name": "새집",
          "x": 17,
          "y": 33,
          "purpose": "정원 가장자리 새 쉼터",
          "near": "꽃 화단"
        },
        {
          "id": "garden-6",
          "name": "나무 울타리",
          "x": 12,
          "y": 37,
          "purpose": "정원 남쪽 경계의 짧은 패널",
          "near": "꽃 화단"
        },
        {
          "id": "garden-7",
          "name": "나무 울타리",
          "x": 16,
          "y": 38,
          "purpose": "열린 가운데 통로를 남긴 경계",
          "near": "꽃 화단"
        }
      ],
      "site": {
        "x": 11,
        "y": 26,
        "w": 4,
        "h": 7,
        "layer": "lower",
        "tiles": [
          374,
          374,
          374,
          374,
          375,
          375,
          375,
          375,
          375,
          375,
          375,
          375,
          405,
          405,
          405,
          405,
          15,
          16,
          16,
          17,
          45,
          329,
          46,
          47,
          75,
          359,
          76,
          77
        ]
      }
    },
    {
      "id": "entry",
      "name": "남쪽 입구 안내",
      "anchor": {
        "type": "road",
        "x": 30,
        "y": 47,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "entry-1",
          "name": "표지판",
          "x": 28,
          "y": 47,
          "purpose": "산촌으로 들어오는 여행자 방향 안내"
        },
        {
          "id": "entry-2",
          "name": "돌등",
          "x": 32,
          "y": 46,
          "purpose": "입구 오솔길 조명"
        }
      ],
      "site": {
        "x": 30,
        "y": 47,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1494
        ]
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
          "y": 11,
          "purpose": "집 입구에서 우편 수취"
        },
        {
          "id": "front-2",
          "name": "화분",
          "x": 4,
          "y": 10,
          "purpose": "현관 옆 환영 식물"
        }
      ],
      "site": {
        "x": 6,
        "y": 5,
        "w": 4,
        "h": 7,
        "layer": "lower",
        "tiles": [
          374,
          374,
          374,
          374,
          375,
          375,
          375,
          375,
          375,
          375,
          375,
          375,
          405,
          405,
          405,
          405,
          15,
          16,
          16,
          17,
          45,
          329,
          46,
          47,
          75,
          359,
          76,
          77
        ]
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
          "x": 51,
          "y": 12,
          "purpose": "현관 옆 벽면 조명"
        }
      ],
      "site": {
        "x": 46,
        "y": 8,
        "w": 8,
        "h": 6,
        "layer": "lower",
        "tiles": [
          240,
          406,
          406,
          406,
          406,
          406,
          406,
          240,
          406,
          406,
          406,
          406,
          406,
          406,
          406,
          407,
          467,
          467,
          467,
          467,
          467,
          467,
          467,
          467,
          15,
          16,
          16,
          16,
          16,
          16,
          16,
          17,
          45,
          46,
          46,
          329,
          46,
          46,
          46,
          47,
          75,
          76,
          76,
          359,
          76,
          76,
          76,
          77
        ]
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
          "x": 49,
          "y": 38,
          "purpose": "현관 옆 벽면 조명"
        }
      ],
      "site": {
        "x": 46,
        "y": 33,
        "w": 5,
        "h": 7,
        "layer": "lower",
        "tiles": [
          436,
          436,
          436,
          436,
          436,
          437,
          437,
          437,
          437,
          437,
          437,
          437,
          437,
          437,
          437,
          467,
          467,
          467,
          467,
          467,
          15,
          16,
          16,
          16,
          17,
          45,
          329,
          46,
          46,
          47,
          75,
          359,
          76,
          76,
          77
        ]
      }
    },
    {
      "id": "overlook",
      "name": "가운데 계단 위 전망 쉼터",
      "anchor": {
        "type": "road",
        "x": 28,
        "y": 13,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "overlook-3",
          "name": "나무 이정표",
          "x": 27,
          "y": 10,
          "purpose": "윗마을 동서 갈림길 방향 안내"
        }
      ],
      "site": {
        "x": 28,
        "y": 13,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1508
        ]
      }
    },
    {
      "id": "stair-signs",
      "name": "계단 아래 길잡이",
      "anchor": {
        "type": "road",
        "x": 28,
        "y": 20,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "stair-signs-1",
          "name": "나무 이정표",
          "x": 26,
          "y": 21,
          "purpose": "가운데 계단으로 오르는 길 안내"
        }
      ],
      "site": {
        "x": 28,
        "y": 20,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1490
        ]
      }
    },
    {
      "id": "west-stair-sign",
      "name": "서쪽 계단 아래 길잡이",
      "anchor": {
        "type": "road",
        "x": 11,
        "y": 23,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "west-stair-sign-1",
          "name": "나무 이정표",
          "x": 13,
          "y": 22,
          "purpose": "서쪽 계단으로 오르는 길 안내"
        }
      ],
      "site": {
        "x": 11,
        "y": 23,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1515
        ]
      }
    },
    {
      "id": "east-stair-sign",
      "name": "동쪽 계단 아래 길잡이",
      "anchor": {
        "type": "road",
        "x": 48,
        "y": 24,
        "maxDistance": 10
      },
      "items": [],
      "site": {
        "x": 48,
        "y": 24,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1496
        ]
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
          "x": 43,
          "y": 12,
          "purpose": "목공 작업에서 나온 장작을 쌓아 두는 자리"
        },
        {
          "id": "woodyard-3",
          "name": "술통",
          "x": 55,
          "y": 12,
          "purpose": "작업용 물을 받아 두는 통"
        }
      ],
      "site": {
        "x": 46,
        "y": 8,
        "w": 8,
        "h": 6,
        "layer": "lower",
        "tiles": [
          240,
          406,
          406,
          406,
          406,
          406,
          406,
          240,
          406,
          406,
          406,
          406,
          406,
          406,
          406,
          407,
          467,
          467,
          467,
          467,
          467,
          467,
          467,
          467,
          15,
          16,
          16,
          16,
          16,
          16,
          16,
          17,
          45,
          46,
          46,
          329,
          46,
          46,
          46,
          47,
          75,
          76,
          76,
          359,
          76,
          76,
          76,
          77
        ]
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
          "y": 32,
          "purpose": "저녁에 샘가 주민이 모이는 불자리"
        },
        {
          "id": "campfire-2",
          "name": "벤치",
          "x": 7,
          "y": 34,
          "purpose": "불가 남쪽 앉을 자리",
          "near": "모닥불"
        },
        {
          "id": "campfire-3",
          "name": "벤치",
          "x": 8,
          "y": 31,
          "purpose": "불가 북쪽 앉을 자리",
          "near": "모닥불"
        },
        {
          "id": "campfire-4",
          "name": "장작 더미",
          "x": 9,
          "y": 33,
          "purpose": "모닥불에 쓸 장작",
          "near": "모닥불"
        }
      ],
      "site": {
        "x": 11,
        "y": 26,
        "w": 4,
        "h": 7,
        "layer": "lower",
        "tiles": [
          374,
          374,
          374,
          374,
          375,
          375,
          375,
          375,
          375,
          375,
          375,
          375,
          405,
          405,
          405,
          405,
          15,
          16,
          16,
          17,
          45,
          329,
          46,
          47,
          75,
          359,
          76,
          77
        ]
      }
    },
    {
      "id": "market",
      "name": "우물 아래 작은 장터",
      "anchor": {
        "type": "road",
        "x": 23,
        "y": 28,
        "maxDistance": 12
      },
      "items": [
        {
          "id": "market-1",
          "name": "장터 노점",
          "x": 25,
          "y": 30,
          "purpose": "아랫마을 주민이 채소와 과일을 파는 좌판"
        }
      ],
      "site": {
        "x": 23,
        "y": 28,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1512
        ]
      }
    }
  ],
  "entrance": {
    "x": 30,
    "y": 52
  },
  "crest": null,
  "patches": [
    [
      3,
      8,
      12,
      9,
      9
    ],
    [
      31,
      3,
      10,
      9,
      10
    ],
    [
      58,
      15,
      10,
      14,
      8
    ]
  ],
  "clearings": [
    [
      11,
      4,
      9,
      6,
      9
    ]
  ],
  "cliffs": [
    {
      "points": [
        [
          2,
          17
        ],
        [
          6,
          17
        ],
        [
          7,
          16
        ],
        [
          17,
          16
        ],
        [
          18,
          15
        ],
        [
          21,
          15
        ],
        [
          22,
          14
        ],
        [
          35,
          14
        ],
        [
          37,
          15
        ],
        [
          39,
          15
        ],
        [
          42,
          18
        ],
        [
          56,
          18
        ],
        [
          57,
          17
        ],
        [
          58,
          17
        ]
      ],
      "height": 5
    }
  ],
  "stairs": [
    [
      10,
      16,
      5
    ],
    [
      28,
      14,
      5
    ],
    [
      47,
      18,
      5
    ]
  ],
  "ponds": [
    [
      6,
      39,
      5,
      4
    ]
  ],
  "coast": false,
  "dock": null,
  "cave": null,
  "spine": [
    [
      30,
      49
    ],
    [
      30,
      44
    ],
    [
      29,
      34
    ],
    [
      22,
      28
    ],
    [
      13,
      24
    ],
    [
      22,
      28
    ],
    [
      28,
      22
    ],
    [
      28,
      12
    ],
    [
      17,
      13
    ],
    [
      28,
      12
    ],
    [
      39,
      13
    ],
    [
      47,
      16
    ],
    [
      47,
      26
    ],
    [
      42,
      33
    ],
    [
      51,
      30
    ]
  ],
  "access": [
    {
      "role": "stairs-top",
      "x": 10,
      "y": 15
    },
    {
      "role": "stairs-bottom",
      "x": 10,
      "y": 22
    },
    {
      "role": "stairs-top",
      "x": 28,
      "y": 13
    },
    {
      "role": "stairs-bottom",
      "x": 28,
      "y": 20
    },
    {
      "role": "stairs-top",
      "x": 47,
      "y": 17
    },
    {
      "role": "stairs-bottom",
      "x": 47,
      "y": 24
    },
    {
      "role": "door-front",
      "x": 7,
      "y": 12
    },
    {
      "role": "door-front",
      "x": 24,
      "y": 10
    },
    {
      "role": "door-front",
      "x": 49,
      "y": 14
    },
    {
      "role": "door-front",
      "x": 12,
      "y": 33
    },
    {
      "role": "door-front",
      "x": 37,
      "y": 32
    },
    {
      "role": "door-front",
      "x": 47,
      "y": 40
    },
    {
      "role": "door-front",
      "x": 23,
      "y": 45
    },
    {
      "role": "map-entrance",
      "x": 29,
      "y": 52
    },
    {
      "role": "map-entrance",
      "x": 30,
      "y": 52
    },
    {
      "role": "map-entrance",
      "x": 31,
      "y": 52
    },
    {
      "role": "map-entrance",
      "x": 29,
      "y": 51
    },
    {
      "role": "map-entrance",
      "x": 30,
      "y": 51
    },
    {
      "role": "map-entrance",
      "x": 31,
      "y": 51
    },
    {
      "role": "map-entrance",
      "x": 29,
      "y": 50
    },
    {
      "role": "map-entrance",
      "x": 30,
      "y": 50
    },
    {
      "role": "map-entrance",
      "x": 31,
      "y": 50
    },
    {
      "role": "map-entrance",
      "x": 29,
      "y": 49
    },
    {
      "role": "map-entrance",
      "x": 30,
      "y": 49
    },
    {
      "role": "map-entrance",
      "x": 31,
      "y": 49
    },
    {
      "role": "map-entrance",
      "x": 29,
      "y": 48
    },
    {
      "role": "map-entrance",
      "x": 30,
      "y": 48
    },
    {
      "role": "map-entrance",
      "x": 31,
      "y": 48
    },
    {
      "role": "civic-use",
      "x": 30,
      "y": 22,
      "placeId": "well",
      "propId": "well-1"
    },
    {
      "role": "civic-use",
      "x": 34,
      "y": 23,
      "placeId": "well",
      "propId": "well-2"
    },
    {
      "role": "civic-use",
      "x": 31,
      "y": 25,
      "placeId": "well",
      "propId": "well-3"
    },
    {
      "role": "civic-use",
      "x": 33,
      "y": 21,
      "placeId": "well",
      "propId": "well-4"
    },
    {
      "role": "civic-use",
      "x": 29,
      "y": 23,
      "placeId": "well",
      "propId": "well-5"
    },
    {
      "role": "civic-use",
      "x": 14,
      "y": 35,
      "placeId": "garden",
      "propId": "garden-1"
    },
    {
      "role": "civic-use",
      "x": 11,
      "y": 35,
      "placeId": "garden",
      "propId": "garden-2"
    },
    {
      "role": "civic-use",
      "x": 16,
      "y": 35,
      "placeId": "garden",
      "propId": "garden-3"
    },
    {
      "role": "civic-use",
      "x": 14,
      "y": 38,
      "placeId": "garden",
      "propId": "garden-4"
    },
    {
      "role": "civic-use",
      "x": 16,
      "y": 33,
      "placeId": "garden",
      "propId": "garden-5"
    },
    {
      "role": "civic-use",
      "x": 12,
      "y": 38,
      "placeId": "garden",
      "propId": "garden-6"
    },
    {
      "role": "civic-use",
      "x": 16,
      "y": 39,
      "placeId": "garden",
      "propId": "garden-7"
    },
    {
      "role": "civic-use",
      "x": 27,
      "y": 47,
      "placeId": "entry",
      "propId": "entry-1"
    },
    {
      "role": "civic-use",
      "x": 31,
      "y": 46,
      "placeId": "entry",
      "propId": "entry-2"
    },
    {
      "role": "civic-use",
      "x": 10,
      "y": 12,
      "placeId": "front",
      "propId": "front-1"
    },
    {
      "role": "civic-use",
      "x": 5,
      "y": 10,
      "placeId": "front",
      "propId": "front-2"
    },
    {
      "role": "civic-use",
      "x": 27,
      "y": 11,
      "placeId": "overlook",
      "propId": "overlook-3"
    },
    {
      "role": "civic-use",
      "x": 26,
      "y": 22,
      "placeId": "stair-signs",
      "propId": "stair-signs-1"
    },
    {
      "role": "civic-use",
      "x": 13,
      "y": 23,
      "placeId": "west-stair-sign",
      "propId": "west-stair-sign-1"
    },
    {
      "role": "civic-use",
      "x": 43,
      "y": 13,
      "placeId": "woodyard",
      "propId": "woodyard-1"
    },
    {
      "role": "civic-use",
      "x": 55,
      "y": 13,
      "placeId": "woodyard",
      "propId": "woodyard-3"
    },
    {
      "role": "civic-use",
      "x": 7,
      "y": 33,
      "placeId": "campfire",
      "propId": "campfire-1"
    },
    {
      "role": "civic-use",
      "x": 7,
      "y": 35,
      "placeId": "campfire",
      "propId": "campfire-2"
    },
    {
      "role": "civic-use",
      "x": 8,
      "y": 32,
      "placeId": "campfire",
      "propId": "campfire-3"
    },
    {
      "role": "civic-use",
      "x": 9,
      "y": 34,
      "placeId": "campfire",
      "propId": "campfire-4"
    },
    {
      "role": "civic-use",
      "x": 24,
      "y": 30,
      "placeId": "market",
      "propId": "market-1"
    },
    {
      "role": "civic-use",
      "x": 30,
      "y": 21,
      "placeId": "well",
      "propId": "well-plaza-1"
    },
    {
      "role": "civic-use",
      "x": 31,
      "y": 26,
      "placeId": "well",
      "propId": "well-plaza-2"
    }
  ]
}
```


## 건물의 전체 하위·상위
### pine-hamlets-house-1
```json
{
  "id": "pine-hamlets-house-1",
  "role": "주거",
  "label": "왕궁 도시 · 주황 박공 회벽집 4×7 ②",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 6,
  "y": 5,
  "w": 4,
  "h": 7,
  "template": 3,
  "doorAt": {
    "x": 7,
    "y": 11
  },
  "front": {
    "x": 7,
    "y": 12
  },
  "activity": "laundry",
  "reason": "상단 서쪽 집의 생활 마당을 세탁·건조 공간으로 지정",
  "width": 4,
  "height": 7,
  "lowerTiles": [
    [
      374,
      374,
      374,
      374
    ],
    [
      375,
      375,
      375,
      375
    ],
    [
      375,
      375,
      375,
      375
    ],
    [
      405,
      405,
      405,
      405
    ],
    [
      15,
      16,
      16,
      17
    ],
    [
      45,
      329,
      46,
      47
    ],
    [
      75,
      359,
      76,
      77
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      85,
      -1
    ],
    [
      2632,
      -1,
      -1,
      -1
    ]
  ]
}
```

### pine-hamlets-house-2
```json
{
  "id": "pine-hamlets-house-2",
  "role": "텃밭집",
  "label": "왕궁 도시 · 파랑 박공 회벽집 6×8 ②",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 22,
  "y": 2,
  "w": 6,
  "h": 8,
  "template": 0,
  "doorAt": {
    "x": 24,
    "y": 9
  },
  "front": {
    "x": 24,
    "y": 10
  },
  "activity": "growing",
  "reason": "집 동쪽의 평탄한 빈터를 가족 텃밭으로 지정",
  "width": 6,
  "height": 8,
  "lowerTiles": [
    [
      436,
      436,
      436,
      436,
      436,
      436
    ],
    [
      437,
      406,
      406,
      407,
      407,
      437
    ],
    [
      467,
      406,
      406,
      407,
      407,
      467
    ],
    [
      15,
      406,
      46,
      46,
      407,
      15
    ],
    [
      45,
      46,
      46,
      46,
      46,
      45
    ],
    [
      75,
      15,
      16,
      16,
      17,
      75
    ],
    [
      240,
      45,
      329,
      46,
      47,
      240
    ],
    [
      240,
      75,
      359,
      76,
      77,
      240
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      356,
      357,
      -1,
      -1
    ],
    [
      -1,
      356,
      -1,
      -1,
      357,
      -1
    ],
    [
      -1,
      208,
      386,
      387,
      -1,
      -1
    ],
    [
      85,
      386,
      -1,
      -1,
      387,
      85
    ],
    [
      -1,
      -1,
      -1,
      -1,
      2645,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      2632,
      -1,
      -1,
      -1,
      -1
    ]
  ]
}
```

### pine-hamlets-house-3
```json
{
  "id": "pine-hamlets-house-3",
  "role": "목공 작업집",
  "label": "파랑 석벽 rect-wide 집",
  "window": 87,
  "abandoned": false,
  "vines": [],
  "x": 46,
  "y": 8,
  "w": 8,
  "h": 6,
  "template": 7,
  "doorAt": {
    "x": 49,
    "y": 13
  },
  "front": {
    "x": 49,
    "y": 14
  },
  "activity": "woodwork",
  "reason": "북동 숲 생활권의 집에 목재 작업 기능을 부여",
  "width": 8,
  "height": 6,
  "lowerTiles": [
    [
      240,
      406,
      406,
      406,
      406,
      406,
      406,
      240
    ],
    [
      406,
      406,
      406,
      406,
      406,
      406,
      406,
      407
    ],
    [
      467,
      467,
      467,
      467,
      467,
      467,
      467,
      467
    ],
    [
      15,
      16,
      16,
      16,
      16,
      16,
      16,
      17
    ],
    [
      45,
      46,
      46,
      329,
      46,
      46,
      46,
      47
    ],
    [
      75,
      76,
      76,
      359,
      76,
      76,
      76,
      77
    ]
  ],
  "upperTiles": [
    [
      356,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      357
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      386,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      387
    ],
    [
      -1,
      2645,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      87,
      -1,
      -1,
      -1,
      2645,
      -1,
      -1
    ],
    [
      -1,
      2611,
      2612,
      -1,
      -1,
      2632,
      -1,
      -1
    ]
  ]
}
```

### pine-hamlets-house-4
```json
{
  "id": "pine-hamlets-house-4",
  "role": "약초 작업집",
  "label": "왕궁 도시 · 주황 박공 회벽집 4×7 ②",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 11,
  "y": 26,
  "w": 4,
  "h": 7,
  "template": 5,
  "doorAt": {
    "x": 12,
    "y": 32
  },
  "front": {
    "x": 12,
    "y": 33
  },
  "activity": "herbs",
  "reason": "서쪽 숲길 가까운 집의 야외 작업을 약초 손질로 지정",
  "width": 4,
  "height": 7,
  "lowerTiles": [
    [
      374,
      374,
      374,
      374
    ],
    [
      375,
      375,
      375,
      375
    ],
    [
      375,
      375,
      375,
      375
    ],
    [
      405,
      405,
      405,
      405
    ],
    [
      15,
      16,
      16,
      17
    ],
    [
      45,
      329,
      46,
      47
    ],
    [
      75,
      359,
      76,
      77
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      85,
      -1
    ],
    [
      -1,
      -1,
      -1,
      2632
    ]
  ]
}
```

### pine-hamlets-house-5
```json
{
  "id": "pine-hamlets-house-5",
  "role": "주거",
  "label": "오렌지 회벽 l-mirror 집",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 33,
  "y": 24,
  "w": 6,
  "h": 8,
  "template": 1,
  "doorAt": {
    "x": 37,
    "y": 31
  },
  "front": {
    "x": 37,
    "y": 32
  },
  "activity": "laundry",
  "reason": "중앙 갈림길의 주거 집에는 세탁 기능만 지정",
  "width": 6,
  "height": 8,
  "lowerTiles": [
    [
      376,
      404,
      404,
      404,
      404,
      377
    ],
    [
      376,
      404,
      404,
      404,
      404,
      377
    ],
    [
      405,
      405,
      405,
      376,
      404,
      377
    ],
    [
      12,
      13,
      14,
      376,
      404,
      377
    ],
    [
      42,
      43,
      44,
      405,
      405,
      405
    ],
    [
      72,
      73,
      74,
      12,
      13,
      14
    ],
    [
      240,
      240,
      240,
      42,
      329,
      44
    ],
    [
      240,
      240,
      240,
      72,
      359,
      74
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      384,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      85,
      -1,
      384,
      -1,
      385
    ],
    [
      -1,
      2645,
      -1,
      -1,
      -1,
      472
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      2611,
      2612,
      -1,
      -1
    ]
  ]
}
```

### pine-hamlets-house-6
```json
{
  "id": "pine-hamlets-house-6",
  "role": "텃밭집",
  "label": "왕궁 도시 · 파랑 회벽집 5×7",
  "window": null,
  "abandoned": false,
  "vines": [],
  "x": 46,
  "y": 33,
  "w": 5,
  "h": 7,
  "template": 6,
  "doorAt": {
    "x": 47,
    "y": 39
  },
  "front": {
    "x": 47,
    "y": 40
  },
  "activity": "growing",
  "reason": "남동 집 옆 빈터를 소규모 자급 텃밭으로 지정",
  "width": 5,
  "height": 7,
  "lowerTiles": [
    [
      436,
      436,
      436,
      436,
      436
    ],
    [
      437,
      437,
      437,
      437,
      437
    ],
    [
      437,
      437,
      437,
      437,
      437
    ],
    [
      467,
      467,
      467,
      467,
      467
    ],
    [
      15,
      16,
      16,
      16,
      17
    ],
    [
      45,
      329,
      46,
      46,
      47
    ],
    [
      75,
      359,
      76,
      76,
      77
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      443,
      -1,
      -1,
      2645,
      -1
    ],
    [
      -1,
      -1,
      -1,
      2645,
      -1
    ],
    [
      -1,
      -1,
      -1,
      2611,
      2612
    ]
  ]
}
```

### pine-hamlets-house-7
```json
{
  "id": "pine-hamlets-house-7",
  "role": "물자 보관집",
  "label": "왕궁 도시 · 주황 박공 회벽집 6×8",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 21,
  "y": 37,
  "w": 6,
  "h": 8,
  "template": 2,
  "doorAt": {
    "x": 23,
    "y": 44
  },
  "front": {
    "x": 23,
    "y": 45
  },
  "activity": "storage",
  "reason": "남쪽 진입 생활권의 집을 물자 보관 거점으로 지정",
  "width": 6,
  "height": 8,
  "lowerTiles": [
    [
      374,
      374,
      374,
      374,
      374,
      374
    ],
    [
      375,
      376,
      376,
      377,
      377,
      375
    ],
    [
      405,
      376,
      376,
      377,
      377,
      405
    ],
    [
      15,
      376,
      46,
      46,
      377,
      15
    ],
    [
      45,
      46,
      46,
      46,
      46,
      45
    ],
    [
      75,
      15,
      16,
      16,
      17,
      75
    ],
    [
      240,
      45,
      329,
      46,
      47,
      240
    ],
    [
      240,
      75,
      359,
      76,
      77,
      240
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      354,
      355,
      -1,
      -1
    ],
    [
      -1,
      354,
      -1,
      -1,
      355,
      -1
    ],
    [
      -1,
      -1,
      384,
      385,
      -1,
      -1
    ],
    [
      85,
      384,
      -1,
      473,
      385,
      85
    ],
    [
      -1,
      -1,
      -1,
      -1,
      2645,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      2611,
      2612,
      -1,
      -1,
      -1,
      -1
    ]
  ]
}
```
