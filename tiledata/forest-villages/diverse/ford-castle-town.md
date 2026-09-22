# 여울성 나루

맨 윗단에 둥근 탑과 깃발을 단 작은 성이 서고, 동쪽 강이 두 줄 절벽에서 폭포로 떨어지며 성 아랫마을 세 단을 다리로 잇는다. 시작점 (40,68); 집 9채. 0기준 맵 좌표. 모든 집은 고정 조각이며 회전/잘라내기 금지. cliffs.points는 x가 증가하는 절벽 윗선 꼭짓점, height는 윗선→밑단의 y 차이다. stairs=[x,y,height]는 폭2, 윗선 행 y부터 y+height까지이고 양끝 착지칸은 y-1/y+height+1이다. 이전 plateaus 윤곽은 사용하지 않는다. 몸통·지붕·소품 전체 배열은 다음 부품 문서와 연결한다.

![여울성 나루 완성](images/ford-castle-town.png)

## 랜드마크
```json
[
  {
    "id": "ford-castle-town-castle",
    "kind": "castle",
    "label": "작은 성",
    "x": 35,
    "y": 5,
    "w": 12,
    "h": 8,
    "doors": [
      {
        "x": 40,
        "y": 12
      },
      {
        "x": 41,
        "y": 12
      }
    ]
  }
]
```


## 입력 계획과 예약할 접근칸
```json
{
  "mapId": "ford-castle-town",
  "width": 88,
  "height": 72,
  "seed": 907,
  "start": {
    "x": 40,
    "y": 68
  },
  "yards": [
    {
      "ownerId": "ford-castle-town-house-1",
      "kit": "storage",
      "name": "물자 보관",
      "reason": "성 서쪽 기사 숙소에 마구와 보급품을 쌓아 둔다",
      "x": 23,
      "y": 13,
      "side": "right",
      "w": 3,
      "h": 1
    },
    {
      "ownerId": "ford-castle-town-house-3",
      "kit": "laundry",
      "name": "세탁·건조",
      "reason": "가운데 단 서쪽 집은 세탁 마당만 둔다",
      "x": 17,
      "y": 36,
      "side": "right",
      "w": 4,
      "h": 2
    },
    {
      "ownerId": "ford-castle-town-house-4",
      "kit": "herbs",
      "name": "약초 손질",
      "reason": "성 병사를 돌보는 약초 손질집",
      "x": 29,
      "y": 37,
      "side": "right",
      "w": 5,
      "h": 3
    },
    {
      "ownerId": "ford-castle-town-house-5",
      "kit": "storage",
      "name": "물자 보관",
      "reason": "성으로 올릴 곡식과 물자를 보관한다",
      "x": 56,
      "y": 38,
      "side": "right",
      "w": 3,
      "h": 1
    },
    {
      "ownerId": "ford-castle-town-house-7",
      "kit": "growing",
      "name": "텃밭 돌보기",
      "reason": "아랫단 서쪽 집이 가족 텃밭을 기른다",
      "x": 19,
      "y": 58,
      "side": "right",
      "w": 5,
      "h": 4
    },
    {
      "ownerId": "ford-castle-town-house-8",
      "kit": "woodwork",
      "name": "목재 가공",
      "reason": "나루 배와 다리를 고치는 목수집",
      "x": 40,
      "y": 58,
      "side": "left",
      "w": 3,
      "h": 3
    },
    {
      "ownerId": "ford-castle-town-house-9",
      "kit": "storage",
      "name": "물자 보관",
      "reason": "나루로 들어온 짐을 보관한다",
      "x": 63,
      "y": 59,
      "side": "right",
      "w": 3,
      "h": 1
    }
  ],
  "activitySites": {},
  "civicPlaces": [
    {
      "id": "castle-drill",
      "name": "성 앞 훈련 마당",
      "anchor": {
        "type": "landmark",
        "id": "ford-castle-town-castle",
        "maxDistance": 7
      },
      "items": [
        {
          "id": "castle-drill-1",
          "name": "무기 거치대",
          "x": 33,
          "y": 13,
          "purpose": "성 병사들이 창과 칼을 거는 자리"
        },
        {
          "id": "castle-drill-2",
          "name": "무기 거치대",
          "x": 35,
          "y": 13,
          "purpose": "두 번째 무기 거치대",
          "near": "무기 거치대"
        },
        {
          "id": "castle-drill-3",
          "name": "나무통",
          "x": 31,
          "y": 15,
          "purpose": "훈련 뒤 마실 물통",
          "near": "무기 거치대"
        },
        {
          "id": "castle-drill-4",
          "name": "돌등",
          "x": 39,
          "y": 14,
          "purpose": "성문 서쪽을 밝히는 등"
        },
        {
          "id": "castle-drill-5",
          "name": "돌등",
          "x": 44,
          "y": 14,
          "purpose": "성문 동쪽을 밝히는 등",
          "near": "돌등"
        }
      ],
      "site": {
        "x": 35,
        "y": 5,
        "w": 12,
        "h": 8,
        "layer": "lower",
        "tiles": [
          240,
          240,
          240,
          240,
          21,
          22,
          22,
          22,
          23,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          51,
          52,
          52,
          52,
          53,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          81,
          82,
          82,
          82,
          83,
          240,
          240,
          240,
          24,
          25,
          240,
          240,
          81,
          82,
          82,
          82,
          83,
          240,
          24,
          25,
          54,
          55,
          21,
          22,
          22,
          22,
          22,
          22,
          22,
          23,
          54,
          55,
          51,
          53,
          51,
          52,
          52,
          52,
          52,
          52,
          52,
          53,
          51,
          53,
          81,
          83,
          81,
          82,
          82,
          329,
          329,
          82,
          82,
          83,
          81,
          83,
          141,
          143,
          141,
          142,
          142,
          359,
          359,
          142,
          142,
          143,
          141,
          143
        ]
      }
    },
    {
      "id": "castle-stores",
      "name": "성 동쪽 보급터",
      "anchor": {
        "type": "landmark",
        "id": "ford-castle-town-castle",
        "maxDistance": 8
      },
      "items": [
        {
          "id": "castle-stores-1",
          "name": "나무 상자",
          "x": 50,
          "y": 10,
          "purpose": "성으로 들일 보급 상자"
        },
        {
          "id": "castle-stores-2",
          "name": "술통",
          "x": 52,
          "y": 10,
          "purpose": "성 창고에 들일 술통",
          "near": "나무 상자"
        },
        {
          "id": "castle-stores-3",
          "name": "장작 더미",
          "x": 50,
          "y": 12,
          "purpose": "성 부엌에 들일 땔감",
          "near": "나무 상자"
        }
      ],
      "site": {
        "x": 35,
        "y": 5,
        "w": 12,
        "h": 8,
        "layer": "lower",
        "tiles": [
          240,
          240,
          240,
          240,
          21,
          22,
          22,
          22,
          23,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          51,
          52,
          52,
          52,
          53,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          81,
          82,
          82,
          82,
          83,
          240,
          240,
          240,
          24,
          25,
          240,
          240,
          81,
          82,
          82,
          82,
          83,
          240,
          24,
          25,
          54,
          55,
          21,
          22,
          22,
          22,
          22,
          22,
          22,
          23,
          54,
          55,
          51,
          53,
          51,
          52,
          52,
          52,
          52,
          52,
          52,
          53,
          51,
          53,
          81,
          83,
          81,
          82,
          82,
          329,
          329,
          82,
          82,
          83,
          81,
          83,
          141,
          143,
          141,
          142,
          142,
          359,
          359,
          142,
          142,
          143,
          141,
          143
        ]
      }
    },
    {
      "id": "top-bridge-watch",
      "name": "윗다리 망보는 자리",
      "anchor": {
        "type": "road",
        "x": 64,
        "y": 17,
        "maxDistance": 8
      },
      "items": [
        {
          "id": "top-bridge-watch-1",
          "name": "돌등",
          "x": 64,
          "y": 14,
          "purpose": "윗다리 서쪽 목 밝히기"
        },
        {
          "id": "top-bridge-watch-2",
          "name": "나무 이정표",
          "x": 62,
          "y": 19,
          "purpose": "강 건너 망루지기 집 안내"
        }
      ],
      "site": {
        "x": 64,
        "y": 17,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1501
        ]
      }
    },
    {
      "id": "mid-market",
      "name": "가운데 단 장터",
      "anchor": {
        "type": "road",
        "x": 40,
        "y": 40,
        "maxDistance": 9
      },
      "items": [
        {
          "id": "mid-market-1",
          "name": "장터 노점",
          "x": 43,
          "y": 42,
          "purpose": "성 아랫마을 좌판"
        },
        {
          "id": "mid-market-2",
          "name": "과일 좌판",
          "x": 47,
          "y": 42,
          "purpose": "아랫단 텃밭에서 거둔 과일",
          "near": "장터 노점"
        },
        {
          "id": "mid-market-3",
          "name": "낮은 돌 우물",
          "x": 36,
          "y": 39,
          "purpose": "가운데 단 공동 우물"
        },
        {
          "id": "mid-market-4",
          "name": "게시판",
          "x": 38,
          "y": 36,
          "purpose": "성의 포고문을 붙이는 판"
        }
      ],
      "site": {
        "x": 40,
        "y": 40,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1494
        ]
      }
    },
    {
      "id": "pool-rest",
      "name": "가운데 단 폭포 소",
      "anchor": {
        "type": "road",
        "x": 67,
        "y": 39,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "pool-rest-1",
          "name": "벤치",
          "x": 62,
          "y": 35,
          "purpose": "폭포 아래 소를 보며 쉬는 자리"
        },
        {
          "id": "pool-rest-2",
          "name": "낚시 바구니",
          "x": 64,
          "y": 33,
          "purpose": "소에서 쓰는 낚시 바구니"
        }
      ],
      "site": {
        "x": 67,
        "y": 39,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1497
        ]
      }
    },
    {
      "id": "lower-fire",
      "name": "나루 모닥불",
      "anchor": {
        "type": "house",
        "id": "ford-castle-town-house-9",
        "maxDistance": 12
      },
      "items": [
        {
          "id": "lower-fire-1",
          "name": "모닥불",
          "x": 62,
          "y": 63,
          "purpose": "나루 일꾼들이 저녁에 불을 피우는 자리"
        },
        {
          "id": "lower-fire-2",
          "name": "벤치",
          "x": 62,
          "y": 65,
          "purpose": "불가에 앉는 자리",
          "near": "모닥불"
        },
        {
          "id": "lower-fire-3",
          "name": "장작 더미",
          "x": 64,
          "y": 63,
          "purpose": "모닥불 장작",
          "near": "모닥불"
        }
      ],
      "site": {
        "x": 56,
        "y": 57,
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
      "id": "entry-sign",
      "name": "남쪽 입구 길잡이",
      "anchor": {
        "type": "road",
        "x": 40,
        "y": 68,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "entry-sign-1",
          "name": "나무 이정표",
          "x": 38,
          "y": 67,
          "purpose": "성으로 오르는 길 안내"
        },
        {
          "id": "entry-sign-2",
          "name": "돌등",
          "x": 43,
          "y": 67,
          "purpose": "입구 길 밝히기"
        }
      ],
      "site": {
        "x": 40,
        "y": 68,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1516
        ]
      }
    }
  ],
  "entrance": {
    "x": 40,
    "y": 71
  },
  "crest": null,
  "patches": [
    [
      4,
      10,
      8,
      14,
      10
    ],
    [
      84,
      10,
      8,
      14,
      10
    ],
    [
      4,
      62,
      8,
      10,
      9
    ],
    [
      84,
      64,
      8,
      10,
      9
    ],
    [
      60,
      6,
      5,
      5,
      8
    ]
  ],
  "clearings": [
    [
      40,
      10,
      16,
      8,
      12
    ],
    [
      16,
      12,
      10,
      6,
      8
    ],
    [
      40,
      34,
      26,
      7,
      10
    ],
    [
      36,
      60,
      24,
      6,
      10
    ]
  ],
  "cliffs": [
    {
      "points": [
        [
          6,
          22
        ],
        [
          30,
          22
        ],
        [
          32,
          21
        ],
        [
          50,
          21
        ],
        [
          52,
          22
        ],
        [
          82,
          22
        ]
      ],
      "height": 6
    },
    {
      "points": [
        [
          6,
          46
        ],
        [
          24,
          46
        ],
        [
          26,
          45
        ],
        [
          44,
          45
        ],
        [
          46,
          46
        ],
        [
          82,
          46
        ]
      ],
      "height": 6
    }
  ],
  "stairs": [
    [
      20,
      22,
      6
    ],
    [
      40,
      21,
      6
    ],
    [
      30,
      45,
      6
    ],
    [
      58,
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
      40,
      70
    ],
    [
      40,
      62
    ],
    [
      31,
      56
    ],
    [
      31,
      53
    ],
    [
      31,
      43
    ],
    [
      40,
      40
    ],
    [
      40,
      28
    ],
    [
      40,
      16
    ],
    [
      22,
      17
    ],
    [
      21,
      20
    ],
    [
      22,
      17
    ],
    [
      40,
      16
    ],
    [
      60,
      17
    ],
    [
      66,
      17
    ],
    [
      76,
      17
    ],
    [
      60,
      17
    ],
    [
      40,
      16
    ],
    [
      40,
      28
    ],
    [
      40,
      40
    ],
    [
      16,
      40
    ],
    [
      40,
      40
    ],
    [
      58,
      40
    ],
    [
      67,
      39
    ],
    [
      78,
      40
    ],
    [
      58,
      40
    ],
    [
      58,
      45
    ],
    [
      58,
      53
    ],
    [
      52,
      65
    ],
    [
      40,
      62
    ],
    [
      18,
      64
    ],
    [
      40,
      62
    ]
  ],
  "access": [
    {
      "role": "stairs-top",
      "x": 20,
      "y": 21
    },
    {
      "role": "stairs-bottom",
      "x": 20,
      "y": 29
    },
    {
      "role": "stairs-top",
      "x": 40,
      "y": 20
    },
    {
      "role": "stairs-bottom",
      "x": 40,
      "y": 28
    },
    {
      "role": "stairs-top",
      "x": 30,
      "y": 44
    },
    {
      "role": "stairs-bottom",
      "x": 30,
      "y": 52
    },
    {
      "role": "stairs-top",
      "x": 58,
      "y": 45
    },
    {
      "role": "stairs-bottom",
      "x": 58,
      "y": 53
    },
    {
      "role": "bridge-west",
      "x": 66,
      "y": 16
    },
    {
      "role": "bridge-east",
      "x": 71,
      "y": 16
    },
    {
      "role": "bridge-west",
      "x": 67,
      "y": 38
    },
    {
      "role": "bridge-east",
      "x": 72,
      "y": 38
    },
    {
      "role": "door-front",
      "x": 17,
      "y": 14
    },
    {
      "role": "door-front",
      "x": 75,
      "y": 15
    },
    {
      "role": "door-front",
      "x": 12,
      "y": 38
    },
    {
      "role": "door-front",
      "x": 24,
      "y": 41
    },
    {
      "role": "door-front",
      "x": 51,
      "y": 39
    },
    {
      "role": "door-front",
      "x": 77,
      "y": 38
    },
    {
      "role": "door-front",
      "x": 16,
      "y": 63
    },
    {
      "role": "door-front",
      "x": 46,
      "y": 64
    },
    {
      "role": "door-front",
      "x": 58,
      "y": 65
    },
    {
      "role": "landmark-door",
      "x": 40,
      "y": 13,
      "landmarkId": "ford-castle-town-castle"
    },
    {
      "role": "landmark-door",
      "x": 41,
      "y": 13,
      "landmarkId": "ford-castle-town-castle"
    },
    {
      "role": "map-entrance",
      "x": 39,
      "y": 71
    },
    {
      "role": "map-entrance",
      "x": 40,
      "y": 71
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 71
    },
    {
      "role": "map-entrance",
      "x": 39,
      "y": 70
    },
    {
      "role": "map-entrance",
      "x": 40,
      "y": 70
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 70
    },
    {
      "role": "map-entrance",
      "x": 39,
      "y": 69
    },
    {
      "role": "map-entrance",
      "x": 40,
      "y": 69
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 69
    },
    {
      "role": "map-entrance",
      "x": 39,
      "y": 68
    },
    {
      "role": "map-entrance",
      "x": 40,
      "y": 68
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 68
    },
    {
      "role": "map-entrance",
      "x": 39,
      "y": 67
    },
    {
      "role": "map-entrance",
      "x": 40,
      "y": 67
    },
    {
      "role": "map-entrance",
      "x": 41,
      "y": 67
    },
    {
      "role": "civic-use",
      "x": 32,
      "y": 13,
      "placeId": "castle-drill",
      "propId": "castle-drill-1"
    },
    {
      "role": "civic-use",
      "x": 34,
      "y": 13,
      "placeId": "castle-drill",
      "propId": "castle-drill-2"
    },
    {
      "role": "civic-use",
      "x": 31,
      "y": 16,
      "placeId": "castle-drill",
      "propId": "castle-drill-3"
    },
    {
      "role": "civic-use",
      "x": 38,
      "y": 14,
      "placeId": "castle-drill",
      "propId": "castle-drill-4"
    },
    {
      "role": "civic-use",
      "x": 43,
      "y": 14,
      "placeId": "castle-drill",
      "propId": "castle-drill-5"
    },
    {
      "role": "civic-use",
      "x": 50,
      "y": 11,
      "placeId": "castle-stores",
      "propId": "castle-stores-1"
    },
    {
      "role": "civic-use",
      "x": 52,
      "y": 11,
      "placeId": "castle-stores",
      "propId": "castle-stores-2"
    },
    {
      "role": "civic-use",
      "x": 50,
      "y": 13,
      "placeId": "castle-stores",
      "propId": "castle-stores-3"
    },
    {
      "role": "civic-use",
      "x": 63,
      "y": 14,
      "placeId": "top-bridge-watch",
      "propId": "top-bridge-watch-1"
    },
    {
      "role": "civic-use",
      "x": 62,
      "y": 20,
      "placeId": "top-bridge-watch",
      "propId": "top-bridge-watch-2"
    },
    {
      "role": "civic-use",
      "x": 42,
      "y": 42,
      "placeId": "mid-market",
      "propId": "mid-market-1"
    },
    {
      "role": "civic-use",
      "x": 47,
      "y": 43,
      "placeId": "mid-market",
      "propId": "mid-market-2"
    },
    {
      "role": "civic-use",
      "x": 35,
      "y": 39,
      "placeId": "mid-market",
      "propId": "mid-market-3"
    },
    {
      "role": "civic-use",
      "x": 38,
      "y": 35,
      "placeId": "mid-market",
      "propId": "mid-market-4"
    },
    {
      "role": "civic-use",
      "x": 62,
      "y": 36,
      "placeId": "pool-rest",
      "propId": "pool-rest-1"
    },
    {
      "role": "civic-use",
      "x": 64,
      "y": 34,
      "placeId": "pool-rest",
      "propId": "pool-rest-2"
    },
    {
      "role": "civic-use",
      "x": 62,
      "y": 64,
      "placeId": "lower-fire",
      "propId": "lower-fire-1"
    },
    {
      "role": "civic-use",
      "x": 62,
      "y": 66,
      "placeId": "lower-fire",
      "propId": "lower-fire-2"
    },
    {
      "role": "civic-use",
      "x": 64,
      "y": 64,
      "placeId": "lower-fire",
      "propId": "lower-fire-3"
    },
    {
      "role": "civic-use",
      "x": 38,
      "y": 68,
      "placeId": "entry-sign",
      "propId": "entry-sign-1"
    },
    {
      "role": "civic-use",
      "x": 42,
      "y": 67,
      "placeId": "entry-sign",
      "propId": "entry-sign-2"
    }
  ]
}
```


## 건물의 전체 하위·상위
### ford-castle-town-house-1
```json
{
  "id": "ford-castle-town-house-1",
  "role": "기사 숙소",
  "label": "파랑 석벽 rect-wide 집",
  "window": 87,
  "abandoned": false,
  "vines": [],
  "x": 14,
  "y": 8,
  "w": 8,
  "h": 6,
  "template": 7,
  "doorAt": {
    "x": 17,
    "y": 13
  },
  "front": {
    "x": 17,
    "y": 14
  },
  "activity": "storage",
  "reason": "성 서쪽 기사 숙소에 마구와 보급품을 쌓아 둔다",
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
      -1,
      -1
    ]
  ]
}
```

### ford-castle-town-house-2
```json
{
  "id": "ford-castle-town-house-2",
  "role": "망루지기 집",
  "label": "왕궁 도시 · 주황 박공 회벽집 4×7 ②",
  "window": 87,
  "abandoned": false,
  "vines": [],
  "x": 74,
  "y": 8,
  "w": 4,
  "h": 7,
  "template": 3,
  "doorAt": {
    "x": 75,
    "y": 14
  },
  "front": {
    "x": 75,
    "y": 15
  },
  "activity": "woodwork",
  "reason": "강 건너 망루지기가 창 자루를 깎는다",
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
      87,
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

### ford-castle-town-house-3
```json
{
  "id": "ford-castle-town-house-3",
  "role": "주거",
  "label": "왕궁 도시 · 파랑 박공 회벽집 6×8 ②",
  "window": 86,
  "abandoned": false,
  "vines": [],
  "x": 10,
  "y": 30,
  "w": 6,
  "h": 8,
  "template": 0,
  "doorAt": {
    "x": 12,
    "y": 37
  },
  "front": {
    "x": 12,
    "y": 38
  },
  "activity": "laundry",
  "reason": "가운데 단 서쪽 집은 세탁 마당만 둔다",
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
      86,
      386,
      -1,
      -1,
      387,
      86
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

### ford-castle-town-house-4
```json
{
  "id": "ford-castle-town-house-4",
  "role": "약방",
  "label": "왕궁 도시 · 주황 박공 회벽집 6×8",
  "window": 87,
  "abandoned": false,
  "vines": [],
  "x": 22,
  "y": 33,
  "w": 6,
  "h": 8,
  "template": 2,
  "doorAt": {
    "x": 24,
    "y": 40
  },
  "front": {
    "x": 24,
    "y": 41
  },
  "activity": "herbs",
  "reason": "성 병사를 돌보는 약초 손질집",
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
      87,
      384,
      -1,
      473,
      385,
      87
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

### ford-castle-town-house-5
```json
{
  "id": "ford-castle-town-house-5",
  "role": "성 곳간",
  "label": "오렌지 회벽 2층 rect-2f 집",
  "window": 86,
  "abandoned": false,
  "vines": [],
  "x": 48,
  "y": 30,
  "w": 7,
  "h": 9,
  "template": 4,
  "doorAt": {
    "x": 51,
    "y": 38
  },
  "front": {
    "x": 51,
    "y": 39
  },
  "activity": "storage",
  "reason": "성으로 올릴 곡식과 물자를 보관한다",
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
      86,
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
      86,
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
    ]
  ]
}
```

### ford-castle-town-house-6
```json
{
  "id": "ford-castle-town-house-6",
  "role": "주거",
  "label": "왕궁 도시 · 주황 박공 회벽집 4×7 ②",
  "window": 86,
  "abandoned": false,
  "vines": [],
  "x": 76,
  "y": 31,
  "w": 4,
  "h": 7,
  "template": 5,
  "doorAt": {
    "x": 77,
    "y": 37
  },
  "front": {
    "x": 77,
    "y": 38
  },
  "activity": "laundry",
  "reason": "강 건너 가운데 단 집은 세탁 마당만 둔다",
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
      86,
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

### ford-castle-town-house-7
```json
{
  "id": "ford-castle-town-house-7",
  "role": "텃밭집",
  "label": "오렌지 회벽 l-mirror 집",
  "window": 86,
  "abandoned": false,
  "vines": [],
  "x": 12,
  "y": 55,
  "w": 6,
  "h": 8,
  "template": 1,
  "doorAt": {
    "x": 16,
    "y": 62
  },
  "front": {
    "x": 16,
    "y": 63
  },
  "activity": "growing",
  "reason": "아랫단 서쪽 집이 가족 텃밭을 기른다",
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
      86,
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

### ford-castle-town-house-8
```json
{
  "id": "ford-castle-town-house-8",
  "role": "목수집",
  "label": "왕궁 도시 · 파랑 박공 회벽집 6×8 ②",
  "window": 87,
  "abandoned": false,
  "vines": [],
  "x": 44,
  "y": 56,
  "w": 6,
  "h": 8,
  "template": 0,
  "doorAt": {
    "x": 46,
    "y": 63
  },
  "front": {
    "x": 46,
    "y": 64
  },
  "activity": "woodwork",
  "reason": "나루 배와 다리를 고치는 목수집",
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
      87,
      386,
      -1,
      -1,
      387,
      87
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

### ford-castle-town-house-9
```json
{
  "id": "ford-castle-town-house-9",
  "role": "나루 창고",
  "label": "왕궁 도시 · 주황 박공 회벽집 6×8",
  "window": 86,
  "abandoned": false,
  "vines": [],
  "x": 56,
  "y": 57,
  "w": 6,
  "h": 8,
  "template": 2,
  "doorAt": {
    "x": 58,
    "y": 64
  },
  "front": {
    "x": 58,
    "y": 65
  },
  "activity": "storage",
  "reason": "나루로 들어온 짐을 보관한다",
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
      86,
      384,
      -1,
      473,
      385,
      86
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
