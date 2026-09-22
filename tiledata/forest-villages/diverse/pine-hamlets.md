# 솔바람 흩어진 산촌

세 빈터에 흩어진 집, 두 둔덕, 갈라지는 오솔길과 작은 샘. 시작점 (40,60); 집 7채. 0기준 맵 좌표. 모든 집은 고정 조각이며 회전/잘라내기 금지. cliffs.points는 x가 증가하는 절벽 윗선 꼭짓점, height는 윗선→밑단의 y 차이다. stairs=[x,y,height]는 폭2, 윗선 행 y부터 y+height까지이고 양끝 착지칸은 y-1/y+height+1이다. 이전 plateaus 윤곽은 사용하지 않는다. 몸통·지붕·소품 전체 배열은 다음 부품 문서와 연결한다.

![솔바람 흩어진 산촌 완성](images/pine-hamlets.png)

## 입력 계획과 예약할 접근칸
```json
{
  "mapId": "pine-hamlets",
  "width": 80,
  "height": 64,
  "seed": 191,
  "start": {
    "x": 40,
    "y": 60
  },
  "yards": [
    {
      "ownerId": "pine-hamlets-house-1",
      "kit": "laundry",
      "name": "세탁·건조",
      "reason": "상단 서쪽 집의 생활 마당을 세탁·건조 공간으로 지정",
      "x": 17,
      "y": 13,
      "side": "right",
      "w": 4,
      "h": 2
    },
    {
      "ownerId": "pine-hamlets-house-2",
      "kit": "growing",
      "name": "텃밭 돌보기",
      "reason": "집 동쪽의 평탄한 빈터를 가족 텃밭으로 지정",
      "x": 40,
      "y": 10,
      "side": "right",
      "w": 5,
      "h": 4
    },
    {
      "ownerId": "pine-hamlets-house-3",
      "kit": "woodwork",
      "name": "목재 가공",
      "reason": "북동 숲 생활권의 집에 목재 작업 기능을 부여",
      "x": 57,
      "y": 13,
      "side": "left",
      "w": 3,
      "h": 3
    },
    {
      "ownerId": "pine-hamlets-house-5",
      "kit": "laundry",
      "name": "세탁·건조",
      "reason": "중앙 갈림길의 주거 집에는 세탁 기능만 지정",
      "x": 39,
      "y": 29,
      "side": "left",
      "w": 4,
      "h": 2
    },
    {
      "ownerId": "pine-hamlets-house-6",
      "kit": "growing",
      "name": "텃밭 돌보기",
      "reason": "남동 집 옆 빈터를 소규모 자급 텃밭으로 지정",
      "x": 67,
      "y": 44,
      "side": "right",
      "w": 5,
      "h": 4
    },
    {
      "ownerId": "pine-hamlets-house-7",
      "kit": "storage",
      "name": "물자 보관",
      "reason": "남쪽 진입 생활권의 집을 물자 보관 거점으로 지정",
      "x": 36,
      "y": 52,
      "side": "right",
      "w": 3,
      "h": 1
    }
  ],
  "activitySites": {},
  "civicPlaces": [
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
      ],
      "site": {
        "x": 30,
        "y": 26,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1494
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
      ],
      "site": {
        "x": 17,
        "y": 31,
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
          359,
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
      ],
      "site": {
        "x": 40,
        "y": 58,
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
      ],
      "site": {
        "x": 12,
        "y": 9,
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
          359,
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
          "x": 66,
          "y": 16,
          "purpose": "현관 옆 벽면 조명"
        }
      ],
      "site": {
        "x": 61,
        "y": 12,
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
          359,
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
          "x": 64,
          "y": 48,
          "purpose": "현관 옆 벽면 조명"
        }
      ],
      "site": {
        "x": 61,
        "y": 43,
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
          359,
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
    }
  ],
  "entrance": {
    "x": 40,
    "y": 63
  },
  "crest": {
    "x": 9,
    "y": 4,
    "width": 20,
    "shoulder": 3
  },
  "patches": [
    [
      5,
      12,
      12,
      9,
      9
    ],
    [
      43,
      3,
      10,
      9,
      10
    ],
    [
      76,
      19,
      10,
      14,
      8
    ]
  ],
  "clearings": [
    [
      20,
      8,
      9,
      6,
      9
    ]
  ],
  "cliffs": [
    {
      "points": [
        [
          8,
          17
        ],
        [
          11,
          20
        ],
        [
          14,
          20
        ],
        [
          17,
          23
        ],
        [
          21,
          23
        ],
        [
          24,
          20
        ],
        [
          26,
          20
        ],
        [
          29,
          17
        ]
      ],
      "height": 5
    },
    {
      "points": [
        [
          50,
          18
        ],
        [
          54,
          22
        ],
        [
          57,
          22
        ],
        [
          62,
          27
        ],
        [
          66,
          27
        ],
        [
          69,
          24
        ],
        [
          72,
          24
        ],
        [
          76,
          20
        ]
      ],
      "height": 5
    }
  ],
  "stairs": [
    [
      19,
      23,
      5
    ],
    [
      64,
      27,
      5
    ]
  ],
  "ponds": [
    [
      10,
      47,
      5,
      4
    ]
  ],
  "coast": false,
  "dock": null,
  "cave": null,
  "spine": [
    [
      40,
      60
    ],
    [
      40,
      54
    ],
    [
      38,
      43
    ],
    [
      29,
      28
    ],
    [
      30,
      21
    ],
    [
      42,
      19
    ],
    [
      49,
      24
    ],
    [
      56,
      37
    ],
    [
      66,
      36
    ]
  ],
  "access": [
    {
      "role": "stairs-top",
      "x": 19,
      "y": 22
    },
    {
      "role": "stairs-bottom",
      "x": 19,
      "y": 29
    },
    {
      "role": "stairs-top",
      "x": 64,
      "y": 26
    },
    {
      "role": "stairs-bottom",
      "x": 64,
      "y": 33
    },
    {
      "role": "door-front",
      "x": 13,
      "y": 16
    },
    {
      "role": "door-front",
      "x": 35,
      "y": 14
    },
    {
      "role": "door-front",
      "x": 64,
      "y": 18
    },
    {
      "role": "door-front",
      "x": 18,
      "y": 38
    },
    {
      "role": "door-front",
      "x": 48,
      "y": 36
    },
    {
      "role": "door-front",
      "x": 62,
      "y": 50
    },
    {
      "role": "door-front",
      "x": 31,
      "y": 55
    },
    {
      "role": "map-entrance",
      "x": 39,
      "y": 63
    },
    {
      "role": "map-entrance",
      "x": 40,
      "y": 63
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 63
    },
    {
      "role": "map-entrance",
      "x": 39,
      "y": 62
    },
    {
      "role": "map-entrance",
      "x": 40,
      "y": 62
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 62
    },
    {
      "role": "map-entrance",
      "x": 39,
      "y": 61
    },
    {
      "role": "map-entrance",
      "x": 40,
      "y": 61
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 61
    },
    {
      "role": "map-entrance",
      "x": 39,
      "y": 60
    },
    {
      "role": "map-entrance",
      "x": 40,
      "y": 60
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 60
    },
    {
      "role": "map-entrance",
      "x": 39,
      "y": 59
    },
    {
      "role": "map-entrance",
      "x": 40,
      "y": 59
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 59
    },
    {
      "role": "civic-use",
      "x": 33,
      "y": 26,
      "placeId": "well",
      "propId": "well-1"
    },
    {
      "role": "civic-use",
      "x": 37,
      "y": 28,
      "placeId": "well",
      "propId": "well-2"
    },
    {
      "role": "civic-use",
      "x": 34,
      "y": 30,
      "placeId": "well",
      "propId": "well-3"
    },
    {
      "role": "civic-use",
      "x": 32,
      "y": 23,
      "placeId": "well",
      "propId": "well-4"
    },
    {
      "role": "civic-use",
      "x": 31,
      "y": 27,
      "placeId": "well",
      "propId": "well-5"
    },
    {
      "role": "civic-use",
      "x": 21,
      "y": 41,
      "placeId": "garden",
      "propId": "garden-1"
    },
    {
      "role": "civic-use",
      "x": 17,
      "y": 41,
      "placeId": "garden",
      "propId": "garden-2"
    },
    {
      "role": "civic-use",
      "x": 23,
      "y": 41,
      "placeId": "garden",
      "propId": "garden-3"
    },
    {
      "role": "civic-use",
      "x": 21,
      "y": 44,
      "placeId": "garden",
      "propId": "garden-4"
    },
    {
      "role": "civic-use",
      "x": 23,
      "y": 39,
      "placeId": "garden",
      "propId": "garden-5"
    },
    {
      "role": "civic-use",
      "x": 18,
      "y": 45,
      "placeId": "garden",
      "propId": "garden-6"
    },
    {
      "role": "civic-use",
      "x": 23,
      "y": 45,
      "placeId": "garden",
      "propId": "garden-7"
    },
    {
      "role": "civic-use",
      "x": 36,
      "y": 58,
      "placeId": "entry",
      "propId": "entry-1"
    },
    {
      "role": "civic-use",
      "x": 41,
      "y": 57,
      "placeId": "entry",
      "propId": "entry-2"
    },
    {
      "role": "civic-use",
      "x": 16,
      "y": 16,
      "placeId": "front",
      "propId": "front-1"
    },
    {
      "role": "civic-use",
      "x": 11,
      "y": 14,
      "placeId": "front",
      "propId": "front-2"
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
  "x": 12,
  "y": 9,
  "w": 4,
  "h": 7,
  "template": 3,
  "doorAt": {
    "x": 13,
    "y": 15
  },
  "front": {
    "x": 13,
    "y": 16
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
      359,
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
  "x": 33,
  "y": 6,
  "w": 6,
  "h": 8,
  "template": 0,
  "doorAt": {
    "x": 35,
    "y": 13
  },
  "front": {
    "x": 35,
    "y": 14
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
      359,
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
      -1,
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
  "x": 61,
  "y": 12,
  "w": 8,
  "h": 6,
  "template": 7,
  "doorAt": {
    "x": 64,
    "y": 17
  },
  "front": {
    "x": 64,
    "y": 18
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
      359,
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
      -1,
      -1,
      -1,
      -1,
      -1,
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
  "x": 17,
  "y": 31,
  "w": 4,
  "h": 7,
  "template": 5,
  "doorAt": {
    "x": 18,
    "y": 37
  },
  "front": {
    "x": 18,
    "y": 38
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
      359,
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
      -1
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
  "x": 44,
  "y": 28,
  "w": 6,
  "h": 8,
  "template": 1,
  "doorAt": {
    "x": 48,
    "y": 35
  },
  "front": {
    "x": 48,
    "y": 36
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
      359,
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
      -1,
      -1,
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
  "x": 61,
  "y": 43,
  "w": 5,
  "h": 7,
  "template": 6,
  "doorAt": {
    "x": 62,
    "y": 49
  },
  "front": {
    "x": 62,
    "y": 50
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
      359,
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
      -1,
      -1
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
  "x": 29,
  "y": 47,
  "w": 6,
  "h": 8,
  "template": 2,
  "doorAt": {
    "x": 31,
    "y": 54
  },
  "front": {
    "x": 31,
    "y": 55
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
      359,
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
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ]
  ]
}
```
