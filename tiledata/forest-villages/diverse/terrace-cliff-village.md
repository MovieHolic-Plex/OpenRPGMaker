# 층바위 절벽마을

세 높이의 대지, 네 계단과 절벽 아래 작업 마당. 시작점 (42,68); 집 8채. 0기준 맵 좌표. 모든 집은 고정 조각이며 회전/잘라내기 금지. cliffs.points는 x가 증가하는 절벽 윗선 꼭짓점, height는 윗선→밑단의 y 차이다. stairs=[x,y,height]는 폭2, 윗선 행 y부터 y+height까지이고 양끝 착지칸은 y-1/y+height+1이다. 이전 plateaus 윤곽은 사용하지 않는다. 몸통·지붕·소품 전체 배열은 다음 부품 문서와 연결한다.

![층바위 절벽마을 완성](images/terrace-cliff-village.png)


## 입력 계획과 예약할 접근칸
```json
{
  "mapId": "terrace-cliff-village",
  "width": 88,
  "height": 72,
  "seed": 347,
  "start": {
    "x": 42,
    "y": 68
  },
  "yards": [
    {
      "ownerId": "terrace-cliff-village-house-1",
      "kit": "laundry",
      "name": "세탁·건조",
      "reason": "상단 서쪽 주거 마당은 세탁·건조 공간",
      "x": 34,
      "y": 15,
      "side": "right",
      "w": 4,
      "h": 2
    },
    {
      "ownerId": "terrace-cliff-village-house-2",
      "kit": "herbs",
      "name": "약초 손질",
      "reason": "상단 동쪽 마당에 약초 재배·손질 작업을 지정",
      "x": 43,
      "y": 16,
      "side": "left",
      "w": 5,
      "h": 3
    },
    {
      "ownerId": "terrace-cliff-village-house-3",
      "kit": "storage",
      "name": "물자 보관",
      "reason": "중단 서쪽 길가 집을 물자 보관 거점으로 지정",
      "x": 9,
      "y": 36,
      "side": "left",
      "w": 3,
      "h": 1
    },
    {
      "ownerId": "terrace-cliff-village-house-4",
      "kit": "woodwork",
      "name": "목재 가공",
      "reason": "중단 작업 생활권에 가공 작업대를 지정",
      "x": 46,
      "y": 36,
      "side": "right",
      "w": 3,
      "h": 3
    },
    {
      "ownerId": "terrace-cliff-village-house-5",
      "kit": "growing",
      "name": "텃밭 돌보기",
      "reason": "중단 동쪽 평탄한 마당을 자급 텃밭으로 지정",
      "x": 70,
      "y": 39,
      "side": "right",
      "w": 5,
      "h": 4
    },
    {
      "ownerId": "terrace-cliff-village-house-7",
      "kit": "storage",
      "name": "물자 보관",
      "reason": "남쪽 입구와 연결되는 하단 집에 보관 기능 지정",
      "x": 53,
      "y": 65,
      "side": "right",
      "w": 3,
      "h": 1
    },
    {
      "ownerId": "terrace-cliff-village-house-8",
      "kit": "herbs",
      "name": "약초 손질",
      "reason": "하단 동쪽 집에서 약초를 손질하는 공간 지정",
      "x": 64,
      "y": 60,
      "side": "left",
      "w": 5,
      "h": 3
    }
  ],
  "activitySites": {},
  "civicPlaces": [
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
      ],
      "site": {
        "x": 44,
        "y": 20,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1480
        ]
      }
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
      ],
      "site": {
        "x": 34,
        "y": 32,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1500
        ]
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
      ],
      "site": {
        "x": 18,
        "y": 55,
        "w": 6,
        "h": 8,
        "layer": "lower",
        "tiles": [
          374,
          374,
          374,
          374,
          374,
          374,
          375,
          376,
          376,
          377,
          377,
          375,
          405,
          376,
          376,
          377,
          377,
          405,
          15,
          376,
          46,
          46,
          377,
          15,
          45,
          46,
          46,
          46,
          46,
          45,
          75,
          15,
          16,
          16,
          17,
          75,
          240,
          45,
          329,
          46,
          47,
          240,
          240,
          75,
          359,
          76,
          77,
          240
        ]
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
      ],
      "site": {
        "x": 18,
        "y": 55,
        "w": 6,
        "h": 8,
        "layer": "lower",
        "tiles": [
          374,
          374,
          374,
          374,
          374,
          374,
          375,
          376,
          376,
          377,
          377,
          375,
          405,
          376,
          376,
          377,
          377,
          405,
          15,
          376,
          46,
          46,
          377,
          15,
          45,
          46,
          46,
          46,
          46,
          45,
          75,
          15,
          16,
          16,
          17,
          75,
          240,
          45,
          329,
          46,
          47,
          240,
          240,
          75,
          359,
          76,
          77,
          240
        ]
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
          "x": 54,
          "y": 18,
          "purpose": "현관 옆 벽면 조명"
        }
      ],
      "site": {
        "x": 49,
        "y": 11,
        "w": 7,
        "h": 9,
        "layer": "lower",
        "tiles": [
          376,
          404,
          404,
          404,
          404,
          404,
          377,
          376,
          404,
          404,
          404,
          404,
          404,
          377,
          376,
          404,
          404,
          404,
          404,
          404,
          377,
          405,
          405,
          405,
          405,
          405,
          405,
          405,
          12,
          13,
          13,
          13,
          13,
          13,
          14,
          42,
          43,
          43,
          43,
          43,
          43,
          44,
          42,
          43,
          43,
          43,
          43,
          43,
          44,
          42,
          43,
          43,
          329,
          43,
          43,
          44,
          72,
          73,
          73,
          359,
          73,
          73,
          74
        ]
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
          "x": 42,
          "y": 37,
          "purpose": "현관 옆 벽면 조명"
        }
      ],
      "site": {
        "x": 37,
        "y": 33,
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
      ],
      "site": {
        "x": 47,
        "y": 59,
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
      ],
      "site": {
        "x": 50,
        "y": 20,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1501
        ]
      }
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
      ],
      "site": {
        "x": 62,
        "y": 29,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1494
        ]
      }
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
      ],
      "site": {
        "x": 27,
        "y": 53,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1501
        ]
      }
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
      ],
      "site": {
        "x": 46,
        "y": 53,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1501
        ]
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
      ],
      "site": {
        "x": 70,
        "y": 56,
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
      ],
      "site": {
        "x": 37,
        "y": 33,
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
      ],
      "site": {
        "x": 13,
        "y": 29,
        "w": 6,
        "h": 8,
        "layer": "lower",
        "tiles": [
          376,
          404,
          404,
          404,
          404,
          377,
          376,
          404,
          404,
          404,
          404,
          377,
          405,
          405,
          405,
          376,
          404,
          377,
          12,
          13,
          14,
          376,
          404,
          377,
          42,
          43,
          44,
          405,
          405,
          405,
          72,
          73,
          74,
          12,
          13,
          14,
          240,
          240,
          240,
          42,
          329,
          44,
          240,
          240,
          240,
          72,
          359,
          74
        ]
      }
    }
  ],
  "entrance": {
    "x": 42,
    "y": 71
  },
  "crest": {
    "x": 26,
    "y": 4,
    "width": 39,
    "shoulder": 3
  },
  "patches": [
    [
      9,
      13,
      13,
      10,
      11
    ],
    [
      76,
      9,
      13,
      12,
      11
    ],
    [
      40,
      1,
      12,
      7,
      9
    ]
  ],
  "clearings": [
    [
      44,
      8,
      22,
      6,
      12
    ],
    [
      4,
      34,
      6,
      8,
      7
    ]
  ],
  "cliffs": [
    {
      "points": [
        [
          7,
          45
        ],
        [
          14,
          45
        ],
        [
          16,
          46
        ],
        [
          28,
          46
        ],
        [
          30,
          47
        ],
        [
          40,
          47
        ],
        [
          42,
          46
        ],
        [
          56,
          46
        ],
        [
          58,
          45
        ],
        [
          83,
          45
        ]
      ],
      "height": 6
    },
    {
      "points": [
        [
          19,
          21
        ],
        [
          30,
          21
        ],
        [
          32,
          20
        ],
        [
          36,
          20
        ],
        [
          38,
          21
        ],
        [
          44,
          21
        ],
        [
          46,
          22
        ],
        [
          58,
          22
        ],
        [
          60,
          21
        ],
        [
          66,
          21
        ],
        [
          68,
          20
        ],
        [
          74,
          20
        ]
      ],
      "height": 6
    }
  ],
  "stairs": [
    [
      34,
      20,
      6
    ],
    [
      62,
      21,
      6
    ],
    [
      26,
      46,
      6
    ],
    [
      45,
      46,
      6
    ]
  ],
  "ponds": [],
  "coast": false,
  "dock": null,
  "cave": null,
  "spine": [
    [
      42,
      68
    ],
    [
      42,
      63
    ],
    [
      27,
      56
    ],
    [
      27,
      53
    ],
    [
      27,
      40
    ],
    [
      34,
      31
    ],
    [
      34,
      27
    ],
    [
      34,
      18
    ],
    [
      62,
      19
    ],
    [
      62,
      28
    ],
    [
      60,
      40
    ],
    [
      46,
      44
    ],
    [
      46,
      53
    ],
    [
      46,
      58
    ],
    [
      70,
      66
    ]
  ],
  "access": [
    {
      "role": "stairs-top",
      "x": 34,
      "y": 19
    },
    {
      "role": "stairs-bottom",
      "x": 34,
      "y": 27
    },
    {
      "role": "stairs-top",
      "x": 62,
      "y": 20
    },
    {
      "role": "stairs-bottom",
      "x": 62,
      "y": 28
    },
    {
      "role": "stairs-top",
      "x": 26,
      "y": 45
    },
    {
      "role": "stairs-bottom",
      "x": 26,
      "y": 53
    },
    {
      "role": "stairs-top",
      "x": 45,
      "y": 45
    },
    {
      "role": "stairs-bottom",
      "x": 45,
      "y": 53
    },
    {
      "role": "door-front",
      "x": 29,
      "y": 17
    },
    {
      "role": "door-front",
      "x": 52,
      "y": 20
    },
    {
      "role": "door-front",
      "x": 17,
      "y": 37
    },
    {
      "role": "door-front",
      "x": 40,
      "y": 39
    },
    {
      "role": "door-front",
      "x": 66,
      "y": 43
    },
    {
      "role": "door-front",
      "x": 20,
      "y": 63
    },
    {
      "role": "door-front",
      "x": 48,
      "y": 66
    },
    {
      "role": "door-front",
      "x": 71,
      "y": 63
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 71
    },
    {
      "role": "map-entrance",
      "x": 42,
      "y": 71
    },
    {
      "role": "map-entrance",
      "x": 43,
      "y": 71
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 70
    },
    {
      "role": "map-entrance",
      "x": 42,
      "y": 70
    },
    {
      "role": "map-entrance",
      "x": 43,
      "y": 70
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 69
    },
    {
      "role": "map-entrance",
      "x": 42,
      "y": 69
    },
    {
      "role": "map-entrance",
      "x": 43,
      "y": 69
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 68
    },
    {
      "role": "map-entrance",
      "x": 42,
      "y": 68
    },
    {
      "role": "map-entrance",
      "x": 43,
      "y": 68
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 67
    },
    {
      "role": "map-entrance",
      "x": 42,
      "y": 67
    },
    {
      "role": "map-entrance",
      "x": 43,
      "y": 67
    },
    {
      "role": "civic-use",
      "x": 38,
      "y": 16,
      "placeId": "well",
      "propId": "well-1"
    },
    {
      "role": "civic-use",
      "x": 41,
      "y": 18,
      "placeId": "well",
      "propId": "well-2"
    },
    {
      "role": "civic-use",
      "x": 39,
      "y": 19,
      "placeId": "well",
      "propId": "well-3"
    },
    {
      "role": "civic-use",
      "x": 37,
      "y": 14,
      "placeId": "well",
      "propId": "well-4"
    },
    {
      "role": "civic-use",
      "x": 30,
      "y": 29,
      "placeId": "stairs",
      "propId": "stairs-1"
    },
    {
      "role": "civic-use",
      "x": 35,
      "y": 31,
      "placeId": "stairs",
      "propId": "stairs-2"
    },
    {
      "role": "civic-use",
      "x": 34,
      "y": 30,
      "placeId": "stairs",
      "propId": "stairs-3"
    },
    {
      "role": "civic-use",
      "x": 33,
      "y": 57,
      "placeId": "garden",
      "propId": "garden-1"
    },
    {
      "role": "civic-use",
      "x": 29,
      "y": 56,
      "placeId": "garden",
      "propId": "garden-2"
    },
    {
      "role": "civic-use",
      "x": 35,
      "y": 56,
      "placeId": "garden",
      "propId": "garden-3"
    },
    {
      "role": "civic-use",
      "x": 33,
      "y": 59,
      "placeId": "garden",
      "propId": "garden-4"
    },
    {
      "role": "civic-use",
      "x": 35,
      "y": 58,
      "placeId": "garden",
      "propId": "garden-5"
    },
    {
      "role": "civic-use",
      "x": 36,
      "y": 61,
      "placeId": "garden",
      "propId": "garden-6"
    },
    {
      "role": "civic-use",
      "x": 24,
      "y": 63,
      "placeId": "front",
      "propId": "front-1"
    },
    {
      "role": "civic-use",
      "x": 16,
      "y": 60,
      "placeId": "front",
      "propId": "front-2"
    },
    {
      "role": "civic-use",
      "x": 46,
      "y": 17,
      "placeId": "overlook",
      "propId": "overlook-1"
    },
    {
      "role": "civic-use",
      "x": 42,
      "y": 20,
      "placeId": "overlook",
      "propId": "overlook-2"
    },
    {
      "role": "civic-use",
      "x": 59,
      "y": 20,
      "placeId": "overlook",
      "propId": "overlook-3"
    },
    {
      "role": "civic-use",
      "x": 64,
      "y": 30,
      "placeId": "mid-east-sign",
      "propId": "mid-east-sign-1"
    },
    {
      "role": "civic-use",
      "x": 24,
      "y": 54,
      "placeId": "lower-signs",
      "propId": "lower-signs-1"
    },
    {
      "role": "civic-use",
      "x": 48,
      "y": 54,
      "placeId": "lower-east-sign",
      "propId": "lower-east-sign-1"
    },
    {
      "role": "civic-use",
      "x": 74,
      "y": 54,
      "placeId": "cave-camp",
      "propId": "cave-camp-1"
    },
    {
      "role": "civic-use",
      "x": 72,
      "y": 55,
      "placeId": "cave-camp",
      "propId": "cave-camp-2"
    },
    {
      "role": "civic-use",
      "x": 67,
      "y": 54,
      "placeId": "cave-camp",
      "propId": "cave-camp-3"
    },
    {
      "role": "civic-use",
      "x": 65,
      "y": 55,
      "placeId": "cave-camp",
      "propId": "cave-camp-4"
    },
    {
      "role": "civic-use",
      "x": 28,
      "y": 39,
      "placeId": "mid-market",
      "propId": "mid-market-1"
    },
    {
      "role": "civic-use",
      "x": 29,
      "y": 43,
      "placeId": "mid-market",
      "propId": "mid-market-2"
    },
    {
      "role": "civic-use",
      "x": 32,
      "y": 38,
      "placeId": "mid-market",
      "propId": "mid-market-3"
    },
    {
      "role": "civic-use",
      "x": 32,
      "y": 43,
      "placeId": "mid-market",
      "propId": "mid-market-4"
    },
    {
      "role": "civic-use",
      "x": 20,
      "y": 35,
      "placeId": "mid-woodpile",
      "propId": "mid-woodpile-1"
    },
    {
      "role": "civic-use",
      "x": 21,
      "y": 37,
      "placeId": "mid-woodpile",
      "propId": "mid-woodpile-2"
    }
  ]
}
```


## 건물의 전체 하위·상위
### terrace-cliff-village-house-1
```json
{
  "id": "terrace-cliff-village-house-1",
  "role": "주거",
  "label": "왕궁 도시 · 파랑 박공 회벽집 6×8 ②",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 27,
  "y": 9,
  "w": 6,
  "h": 8,
  "template": 0,
  "doorAt": {
    "x": 29,
    "y": 16
  },
  "front": {
    "x": 29,
    "y": 17
  },
  "activity": "laundry",
  "reason": "상단 서쪽 주거 마당은 세탁·건조 공간",
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
      -1,
      -1,
      -1,
      -1,
      -1
    ]
  ]
}
```

### terrace-cliff-village-house-2
```json
{
  "id": "terrace-cliff-village-house-2",
  "role": "약초 작업집",
  "label": "오렌지 회벽 2층 rect-2f 집",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 49,
  "y": 11,
  "w": 7,
  "h": 9,
  "template": 4,
  "doorAt": {
    "x": 52,
    "y": 19
  },
  "front": {
    "x": 52,
    "y": 20
  },
  "activity": "herbs",
  "reason": "상단 동쪽 마당에 약초 재배·손질 작업을 지정",
  "width": 7,
  "height": 9,
  "lowerTiles": [
    [
      376,
      404,
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
      404,
      377
    ],
    [
      376,
      404,
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
      405,
      405,
      405,
      405
    ],
    [
      12,
      13,
      13,
      13,
      13,
      13,
      14
    ],
    [
      42,
      43,
      43,
      43,
      43,
      43,
      44
    ],
    [
      42,
      43,
      43,
      43,
      43,
      43,
      44
    ],
    [
      42,
      43,
      43,
      329,
      43,
      43,
      44
    ],
    [
      72,
      73,
      73,
      359,
      73,
      73,
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
      -1
    ],
    [
      -1,
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
      -1,
      385
    ],
    [
      -1,
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
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      2645,
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
      -1,
      -1
    ]
  ]
}
```

### terrace-cliff-village-house-3
```json
{
  "id": "terrace-cliff-village-house-3",
  "role": "물자 보관집",
  "label": "오렌지 회벽 l-mirror 집",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 13,
  "y": 29,
  "w": 6,
  "h": 8,
  "template": 1,
  "doorAt": {
    "x": 17,
    "y": 36
  },
  "front": {
    "x": 17,
    "y": 37
  },
  "activity": "storage",
  "reason": "중단 서쪽 길가 집을 물자 보관 거점으로 지정",
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
      -1,
      -1,
      -1,
      -1
    ]
  ]
}
```

### terrace-cliff-village-house-4
```json
{
  "id": "terrace-cliff-village-house-4",
  "role": "목공 작업집",
  "label": "파랑 석벽 rect-wide 집",
  "window": 87,
  "abandoned": false,
  "vines": [],
  "x": 37,
  "y": 33,
  "w": 8,
  "h": 6,
  "template": 7,
  "doorAt": {
    "x": 40,
    "y": 38
  },
  "front": {
    "x": 40,
    "y": 39
  },
  "activity": "woodwork",
  "reason": "중단 작업 생활권에 가공 작업대를 지정",
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

### terrace-cliff-village-house-5
```json
{
  "id": "terrace-cliff-village-house-5",
  "role": "텃밭집",
  "label": "왕궁 도시 · 주황 박공 회벽집 4×7 ②",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 65,
  "y": 36,
  "w": 4,
  "h": 7,
  "template": 5,
  "doorAt": {
    "x": 66,
    "y": 42
  },
  "front": {
    "x": 66,
    "y": 43
  },
  "activity": "growing",
  "reason": "중단 동쪽 평탄한 마당을 자급 텃밭으로 지정",
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
      -1
    ]
  ]
}
```

### terrace-cliff-village-house-6
```json
{
  "id": "terrace-cliff-village-house-6",
  "role": "주거",
  "label": "왕궁 도시 · 주황 박공 회벽집 6×8",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 18,
  "y": 55,
  "w": 6,
  "h": 8,
  "template": 2,
  "doorAt": {
    "x": 20,
    "y": 62
  },
  "front": {
    "x": 20,
    "y": 63
  },
  "activity": "laundry",
  "reason": "하단 서쪽 주거 마당은 세탁·건조 공간",
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

### terrace-cliff-village-house-7
```json
{
  "id": "terrace-cliff-village-house-7",
  "role": "물자 보관집",
  "label": "왕궁 도시 · 파랑 회벽집 5×7",
  "window": null,
  "abandoned": false,
  "vines": [],
  "x": 47,
  "y": 59,
  "w": 5,
  "h": 7,
  "template": 6,
  "doorAt": {
    "x": 48,
    "y": 65
  },
  "front": {
    "x": 48,
    "y": 66
  },
  "activity": "storage",
  "reason": "남쪽 입구와 연결되는 하단 집에 보관 기능 지정",
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
      -1,
      -1
    ]
  ]
}
```

### terrace-cliff-village-house-8
```json
{
  "id": "terrace-cliff-village-house-8",
  "role": "약초 작업집",
  "label": "왕궁 도시 · 주황 박공 회벽집 4×7 ②",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 70,
  "y": 56,
  "w": 4,
  "h": 7,
  "template": 3,
  "doorAt": {
    "x": 71,
    "y": 62
  },
  "front": {
    "x": 71,
    "y": 63
  },
  "activity": "herbs",
  "reason": "하단 동쪽 집에서 약초를 손질하는 공간 지정",
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
      -1
    ]
  ]
}
```
