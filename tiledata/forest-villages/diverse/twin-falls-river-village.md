# 두 폭포 강마을

북쪽 숲에서 나온 강이 마을 한가운데를 흐르며 두 줄 절벽에서 폭포로 떨어지고, 단마다 다리가 양쪽 강둑을 잇는다. 시작점 (17,61); 집 8채. 0기준 맵 좌표. 모든 집은 고정 조각이며 회전/잘라내기 금지. cliffs.points는 x가 증가하는 절벽 윗선 꼭짓점, height는 윗선→밑단의 y 차이다. stairs=[x,y,height]는 폭2, 윗선 행 y부터 y+height까지이고 양끝 착지칸은 y-1/y+height+1이다. 이전 plateaus 윤곽은 사용하지 않는다. 몸통·지붕·소품 전체 배열은 다음 부품 문서와 연결한다.

![두 폭포 강마을 완성](images/twin-falls-river-village.png)


## 입력 계획과 예약할 접근칸
```json
{
  "mapId": "twin-falls-river-village",
  "width": 62,
  "height": 65,
  "seed": 733,
  "start": {
    "x": 17,
    "y": 61
  },
  "yards": [
    {
      "ownerId": "twin-falls-river-village-house-1",
      "kit": "woodwork",
      "name": "목재 가공",
      "reason": "윗단 서쪽 숲 가장자리 집에 목재 손질 마당을 둔다",
      "x": 16,
      "y": 8,
      "side": "right",
      "w": 4,
      "h": 3
    },
    {
      "ownerId": "twin-falls-river-village-house-3",
      "kit": "herbs",
      "name": "약초 손질",
      "reason": "가운데 단 서쪽 숲길 집에서 약초를 손질한다",
      "x": 2,
      "y": 28,
      "side": "left",
      "w": 4,
      "h": 3
    },
    {
      "ownerId": "twin-falls-river-village-house-4",
      "kit": "storage",
      "name": "물자 보관",
      "reason": "폭포 아래 서쪽 다리목 집을 물자 보관 거점으로 둔다",
      "x": 26,
      "y": 26,
      "side": "right",
      "w": 4,
      "h": 3
    },
    {
      "ownerId": "twin-falls-river-village-house-5",
      "kit": "growing",
      "name": "텃밭 돌보기",
      "reason": "가운데 단 동쪽 강둑의 평지를 가족 텃밭으로 쓴다",
      "x": 37,
      "y": 27,
      "side": "left",
      "w": 2,
      "h": 4
    },
    {
      "ownerId": "twin-falls-river-village-house-6",
      "kit": "laundry",
      "name": "세탁·건조",
      "reason": "가운데 단 동쪽 끝 집은 세탁 마당만 둔다",
      "x": 50,
      "y": 31,
      "side": "left",
      "w": 4,
      "h": 2
    },
    {
      "ownerId": "twin-falls-river-village-house-8",
      "kit": "storage",
      "name": "물자 보관",
      "reason": "아랫단 동쪽 다리목 집을 짐 보관 거점으로 둔다",
      "x": 48,
      "y": 53,
      "side": "right",
      "w": 4,
      "h": 3
    }
  ],
  "activitySites": {},
  "civicPlaces": [
    {
      "id": "falls-overlook",
      "name": "윗 폭포 전망 쉼터",
      "anchor": {
        "type": "road",
        "x": 29,
        "y": 7,
        "maxDistance": 12
      },
      "items": [
        {
          "id": "falls-overlook-1",
          "name": "벤치",
          "x": 29,
          "y": 12,
          "purpose": "윗 폭포가 떨어지는 소리를 들으며 쉬는 자리"
        },
        {
          "id": "falls-overlook-2",
          "name": "벤치",
          "x": 36,
          "y": 10,
          "purpose": "강 건너편에서 폭포를 보는 자리"
        },
        {
          "id": "falls-overlook-3",
          "name": "돌등",
          "x": 30,
          "y": 9,
          "purpose": "다리 서쪽 목 밝히기"
        }
      ],
      "site": {
        "x": 29,
        "y": 7,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1501
        ]
      }
    },
    {
      "id": "top-bridge-sign",
      "name": "윗다리 길잡이",
      "anchor": {
        "type": "road",
        "x": 37,
        "y": 7,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "top-bridge-sign-1",
          "name": "나무 이정표",
          "x": 37,
          "y": 5,
          "purpose": "윗단 동쪽 집으로 가는 길 안내"
        }
      ],
      "site": {
        "x": 37,
        "y": 7,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1501
        ]
      }
    },
    {
      "id": "well",
      "name": "가운데 단 공동 우물",
      "anchor": {
        "type": "road",
        "x": 22,
        "y": 33,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "well-1",
          "name": "낮은 돌 우물",
          "x": 17,
          "y": 28,
          "purpose": "가운데 단 서쪽 주민의 급수"
        },
        {
          "id": "well-2",
          "name": "항아리",
          "x": 21,
          "y": 29,
          "purpose": "길어 온 물을 담는 용기",
          "near": "낮은 돌 우물"
        },
        {
          "id": "well-3",
          "name": "게시판",
          "x": 15,
          "y": 31,
          "purpose": "우물에 모인 주민의 마을 공지"
        },
        {
          "id": "well-plaza-1",
          "name": "돌등",
          "x": 18,
          "y": 31,
          "purpose": "밤에 우물가를 밝히는 돌등",
          "near": "낮은 돌 우물"
        }
      ],
      "site": {
        "x": 22,
        "y": 33,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1500
        ]
      }
    },
    {
      "id": "bridge-market",
      "name": "가운데 다리목 장터",
      "anchor": {
        "type": "road",
        "x": 36,
        "y": 32,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "bridge-market-1",
          "name": "장터 노점",
          "x": 36,
          "y": 34,
          "purpose": "강 양쪽 주민이 만나는 다리목 좌판"
        },
        {
          "id": "bridge-market-2",
          "name": "과일 좌판",
          "x": 39,
          "y": 35,
          "purpose": "가운데 단 텃밭에서 거둔 과일",
          "near": "장터 노점"
        },
        {
          "id": "bridge-market-3",
          "name": "술통",
          "x": 35,
          "y": 35,
          "purpose": "장터 음료 통",
          "near": "장터 노점"
        }
      ],
      "site": {
        "x": 36,
        "y": 32,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1508
        ]
      }
    },
    {
      "id": "lower-pool-fishing",
      "name": "아랫 소 낚시터",
      "anchor": {
        "type": "road",
        "x": 27,
        "y": 56,
        "maxDistance": 12
      },
      "items": [
        {
          "id": "lower-pool-fishing-1",
          "name": "낚시 바구니",
          "x": 25,
          "y": 47,
          "purpose": "폭포 아래 소에서 쓰는 낚시 바구니"
        },
        {
          "id": "lower-pool-fishing-2",
          "name": "나무통",
          "x": 24,
          "y": 48,
          "purpose": "잡은 물고기를 담는 통",
          "near": "낚시 바구니"
        },
        {
          "id": "lower-pool-fishing-3",
          "name": "벤치",
          "x": 26,
          "y": 50,
          "purpose": "소를 바라보며 낚싯대를 드리우는 자리"
        }
      ],
      "site": {
        "x": 27,
        "y": 56,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1501
        ]
      }
    },
    {
      "id": "pool-fire",
      "name": "아랫 소 동쪽 모닥불",
      "anchor": {
        "type": "house",
        "id": "twin-falls-river-village-house-8",
        "maxDistance": 14
      },
      "items": [
        {
          "id": "pool-fire-1",
          "name": "모닥불",
          "x": 40,
          "y": 45,
          "purpose": "폭포 아래에서 저녁에 불을 피우는 자리"
        },
        {
          "id": "pool-fire-2",
          "name": "벤치",
          "x": 42,
          "y": 47,
          "purpose": "불가에 앉는 자리",
          "near": "모닥불"
        },
        {
          "id": "pool-fire-3",
          "name": "장작 더미",
          "x": 43,
          "y": 45,
          "purpose": "모닥불 장작",
          "near": "모닥불"
        }
      ],
      "site": {
        "x": 44,
        "y": 49,
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
      "id": "woodyard",
      "name": "윗단 목공집 땔감",
      "anchor": {
        "type": "house",
        "id": "twin-falls-river-village-house-1",
        "maxDistance": 10
      },
      "items": [
        {
          "id": "woodyard-1",
          "name": "장작 더미",
          "x": 7,
          "y": 12,
          "purpose": "목공 작업에서 나온 장작"
        },
        {
          "id": "woodyard-2",
          "name": "장작 더미",
          "x": 9,
          "y": 13,
          "purpose": "겨울 땔감 두 번째 더미",
          "near": "장작 더미"
        }
      ],
      "site": {
        "x": 8,
        "y": 3,
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
      "id": "entry-sign",
      "name": "남쪽 입구 길잡이",
      "anchor": {
        "type": "road",
        "x": 17,
        "y": 61,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "entry-sign-1",
          "name": "나무 이정표",
          "x": 15,
          "y": 61,
          "purpose": "마을 남쪽 입구 방향 안내"
        },
        {
          "id": "entry-sign-2",
          "name": "돌등",
          "x": 19,
          "y": 58,
          "purpose": "입구 길 밝히기"
        }
      ],
      "site": {
        "x": 17,
        "y": 61,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1516
        ]
      }
    },
    {
      "id": "stair-signs-w",
      "name": "서쪽 계단 길잡이",
      "anchor": {
        "type": "road",
        "x": 15,
        "y": 46,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "stair-signs-w-1",
          "name": "나무 이정표",
          "x": 14,
          "y": 47,
          "purpose": "가운데 단으로 오르는 서쪽 계단 안내"
        }
      ],
      "site": {
        "x": 15,
        "y": 46,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1494
        ]
      }
    },
    {
      "id": "stair-signs-e",
      "name": "동쪽 계단 길잡이",
      "anchor": {
        "type": "road",
        "x": 50,
        "y": 46,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "stair-signs-e-1",
          "name": "나무 이정표",
          "x": 52,
          "y": 47,
          "purpose": "가운데 단으로 오르는 동쪽 계단 안내"
        }
      ],
      "site": {
        "x": 50,
        "y": 46,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1503
        ]
      }
    }
  ],
  "entrance": {
    "x": 17,
    "y": 64
  },
  "crest": null,
  "patches": [
    [
      0,
      7,
      10,
      12,
      10
    ],
    [
      61,
      7,
      10,
      12,
      10
    ],
    [
      2,
      53,
      8,
      10,
      9
    ],
    [
      58,
      55,
      8,
      10,
      9
    ]
  ],
  "clearings": [
    [
      20,
      9,
      12,
      6,
      8
    ],
    [
      49,
      9,
      12,
      6,
      8
    ],
    [
      13,
      29,
      12,
      6,
      8
    ],
    [
      48,
      29,
      12,
      6,
      8
    ],
    [
      17,
      53,
      12,
      6,
      8
    ],
    [
      48,
      53,
      12,
      6,
      8
    ]
  ],
  "cliffs": [
    {
      "points": [
        [
          2,
          16
        ],
        [
          8,
          16
        ],
        [
          9,
          15
        ],
        [
          29,
          15
        ],
        [
          30,
          14
        ],
        [
          38,
          14
        ],
        [
          40,
          15
        ],
        [
          54,
          15
        ],
        [
          56,
          16
        ],
        [
          59,
          16
        ]
      ],
      "height": 6
    },
    {
      "points": [
        [
          2,
          39
        ],
        [
          12,
          39
        ],
        [
          13,
          38
        ],
        [
          28,
          38
        ],
        [
          29,
          37
        ],
        [
          38,
          37
        ],
        [
          40,
          38
        ],
        [
          53,
          38
        ],
        [
          55,
          39
        ],
        [
          59,
          39
        ]
      ],
      "height": 6
    }
  ],
  "stairs": [
    [
      19,
      15,
      6
    ],
    [
      49,
      15,
      6
    ],
    [
      15,
      38,
      6
    ],
    [
      50,
      38,
      6
    ]
  ],
  "ponds": [],
  "coast": false,
  "dock": null,
  "cave": null,
  "spine": [
    [
      17,
      63
    ],
    [
      17,
      53
    ],
    [
      15,
      46
    ],
    [
      15,
      36
    ],
    [
      22,
      33
    ],
    [
      19,
      23
    ],
    [
      19,
      14
    ],
    [
      23,
      9
    ],
    [
      29,
      7
    ],
    [
      37,
      7
    ],
    [
      43,
      12
    ],
    [
      49,
      13
    ],
    [
      49,
      23
    ],
    [
      38,
      33
    ],
    [
      50,
      36
    ],
    [
      50,
      46
    ],
    [
      40,
      55
    ],
    [
      27,
      56
    ],
    [
      17,
      53
    ]
  ],
  "access": [
    {
      "role": "stairs-top",
      "x": 19,
      "y": 14
    },
    {
      "role": "stairs-bottom",
      "x": 19,
      "y": 22
    },
    {
      "role": "stairs-top",
      "x": 49,
      "y": 14
    },
    {
      "role": "stairs-bottom",
      "x": 49,
      "y": 22
    },
    {
      "role": "stairs-top",
      "x": 15,
      "y": 37
    },
    {
      "role": "stairs-bottom",
      "x": 15,
      "y": 45
    },
    {
      "role": "stairs-top",
      "x": 50,
      "y": 37
    },
    {
      "role": "stairs-bottom",
      "x": 50,
      "y": 45
    },
    {
      "role": "bridge-west",
      "x": 30,
      "y": 6
    },
    {
      "role": "bridge-east",
      "x": 35,
      "y": 6
    },
    {
      "role": "bridge-west",
      "x": 28,
      "y": 31
    },
    {
      "role": "bridge-east",
      "x": 33,
      "y": 31
    },
    {
      "role": "bridge-west",
      "x": 32,
      "y": 55
    },
    {
      "role": "bridge-east",
      "x": 37,
      "y": 55
    },
    {
      "role": "door-front",
      "x": 11,
      "y": 12
    },
    {
      "role": "door-front",
      "x": 48,
      "y": 11
    },
    {
      "role": "door-front",
      "x": 9,
      "y": 34
    },
    {
      "role": "door-front",
      "x": 23,
      "y": 31
    },
    {
      "role": "door-front",
      "x": 41,
      "y": 32
    },
    {
      "role": "door-front",
      "x": 58,
      "y": 33
    },
    {
      "role": "door-front",
      "x": 7,
      "y": 56
    },
    {
      "role": "door-front",
      "x": 45,
      "y": 56
    },
    {
      "role": "map-entrance",
      "x": 16,
      "y": 64
    },
    {
      "role": "map-entrance",
      "x": 17,
      "y": 64
    },
    {
      "role": "map-entrance",
      "x": 18,
      "y": 64
    },
    {
      "role": "map-entrance",
      "x": 16,
      "y": 63
    },
    {
      "role": "map-entrance",
      "x": 17,
      "y": 63
    },
    {
      "role": "map-entrance",
      "x": 18,
      "y": 63
    },
    {
      "role": "map-entrance",
      "x": 16,
      "y": 62
    },
    {
      "role": "map-entrance",
      "x": 17,
      "y": 62
    },
    {
      "role": "map-entrance",
      "x": 18,
      "y": 62
    },
    {
      "role": "map-entrance",
      "x": 16,
      "y": 61
    },
    {
      "role": "map-entrance",
      "x": 17,
      "y": 61
    },
    {
      "role": "map-entrance",
      "x": 18,
      "y": 61
    },
    {
      "role": "map-entrance",
      "x": 16,
      "y": 60
    },
    {
      "role": "map-entrance",
      "x": 17,
      "y": 60
    },
    {
      "role": "map-entrance",
      "x": 18,
      "y": 60
    },
    {
      "role": "civic-use",
      "x": 29,
      "y": 13,
      "placeId": "falls-overlook",
      "propId": "falls-overlook-1"
    },
    {
      "role": "civic-use",
      "x": 36,
      "y": 11,
      "placeId": "falls-overlook",
      "propId": "falls-overlook-2"
    },
    {
      "role": "civic-use",
      "x": 29,
      "y": 9,
      "placeId": "falls-overlook",
      "propId": "falls-overlook-3"
    },
    {
      "role": "civic-use",
      "x": 37,
      "y": 6,
      "placeId": "top-bridge-sign",
      "propId": "top-bridge-sign-1"
    },
    {
      "role": "civic-use",
      "x": 16,
      "y": 28,
      "placeId": "well",
      "propId": "well-1"
    },
    {
      "role": "civic-use",
      "x": 21,
      "y": 30,
      "placeId": "well",
      "propId": "well-2"
    },
    {
      "role": "civic-use",
      "x": 14,
      "y": 31,
      "placeId": "well",
      "propId": "well-3"
    },
    {
      "role": "civic-use",
      "x": 35,
      "y": 34,
      "placeId": "bridge-market",
      "propId": "bridge-market-1"
    },
    {
      "role": "civic-use",
      "x": 39,
      "y": 36,
      "placeId": "bridge-market",
      "propId": "bridge-market-2"
    },
    {
      "role": "civic-use",
      "x": 35,
      "y": 36,
      "placeId": "bridge-market",
      "propId": "bridge-market-3"
    },
    {
      "role": "civic-use",
      "x": 25,
      "y": 48,
      "placeId": "lower-pool-fishing",
      "propId": "lower-pool-fishing-1"
    },
    {
      "role": "civic-use",
      "x": 24,
      "y": 49,
      "placeId": "lower-pool-fishing",
      "propId": "lower-pool-fishing-2"
    },
    {
      "role": "civic-use",
      "x": 25,
      "y": 50,
      "placeId": "lower-pool-fishing",
      "propId": "lower-pool-fishing-3"
    },
    {
      "role": "civic-use",
      "x": 40,
      "y": 46,
      "placeId": "pool-fire",
      "propId": "pool-fire-1"
    },
    {
      "role": "civic-use",
      "x": 42,
      "y": 48,
      "placeId": "pool-fire",
      "propId": "pool-fire-2"
    },
    {
      "role": "civic-use",
      "x": 43,
      "y": 46,
      "placeId": "pool-fire",
      "propId": "pool-fire-3"
    },
    {
      "role": "civic-use",
      "x": 7,
      "y": 13,
      "placeId": "woodyard",
      "propId": "woodyard-1"
    },
    {
      "role": "civic-use",
      "x": 8,
      "y": 13,
      "placeId": "woodyard",
      "propId": "woodyard-2"
    },
    {
      "role": "civic-use",
      "x": 15,
      "y": 62,
      "placeId": "entry-sign",
      "propId": "entry-sign-1"
    },
    {
      "role": "civic-use",
      "x": 18,
      "y": 58,
      "placeId": "entry-sign",
      "propId": "entry-sign-2"
    },
    {
      "role": "civic-use",
      "x": 14,
      "y": 48,
      "placeId": "stair-signs-w",
      "propId": "stair-signs-w-1"
    },
    {
      "role": "civic-use",
      "x": 52,
      "y": 48,
      "placeId": "stair-signs-e",
      "propId": "stair-signs-e-1"
    },
    {
      "role": "civic-use",
      "x": 17,
      "y": 31,
      "placeId": "well",
      "propId": "well-plaza-1"
    }
  ]
}
```


## 건물의 전체 하위·상위
### twin-falls-river-village-house-1
```json
{
  "id": "twin-falls-river-village-house-1",
  "role": "목공 작업집",
  "label": "오렌지 회벽 2층 rect-2f 집",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 8,
  "y": 3,
  "w": 7,
  "h": 9,
  "template": 4,
  "doorAt": {
    "x": 11,
    "y": 11
  },
  "front": {
    "x": 11,
    "y": 12
  },
  "activity": "woodwork",
  "reason": "윗단 서쪽 숲 가장자리 집에 목재 손질 마당을 둔다",
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
      -1,
      -1
    ],
    [
      -1,
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

### twin-falls-river-village-house-2
```json
{
  "id": "twin-falls-river-village-house-2",
  "role": "주거",
  "label": "파랑 석벽 rect-wide 집",
  "window": 87,
  "abandoned": false,
  "vines": [],
  "x": 45,
  "y": 5,
  "w": 8,
  "h": 6,
  "template": 7,
  "doorAt": {
    "x": 48,
    "y": 10
  },
  "front": {
    "x": 48,
    "y": 11
  },
  "activity": "laundry",
  "reason": "윗단 동쪽 강가 집은 세탁·건조 마당만 둔다",
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
      2632,
      -1,
      -1,
      2611,
      2612,
      -1
    ]
  ]
}
```

### twin-falls-river-village-house-3
```json
{
  "id": "twin-falls-river-village-house-3",
  "role": "약초 작업집",
  "label": "왕궁 도시 · 파랑 박공 회벽집 6×8 ②",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 7,
  "y": 26,
  "w": 6,
  "h": 8,
  "template": 0,
  "doorAt": {
    "x": 9,
    "y": 33
  },
  "front": {
    "x": 9,
    "y": 34
  },
  "activity": "herbs",
  "reason": "가운데 단 서쪽 숲길 집에서 약초를 손질한다",
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
      2611,
      2612,
      -1,
      -1,
      2632,
      -1
    ]
  ]
}
```

### twin-falls-river-village-house-4
```json
{
  "id": "twin-falls-river-village-house-4",
  "role": "물자 보관집",
  "label": "왕궁 도시 · 주황 박공 회벽집 4×7 ②",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 22,
  "y": 24,
  "w": 4,
  "h": 7,
  "template": 5,
  "doorAt": {
    "x": 23,
    "y": 30
  },
  "front": {
    "x": 23,
    "y": 31
  },
  "activity": "storage",
  "reason": "폭포 아래 서쪽 다리목 집을 물자 보관 거점으로 둔다",
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
      2632
    ]
  ]
}
```

### twin-falls-river-village-house-5
```json
{
  "id": "twin-falls-river-village-house-5",
  "role": "텃밭집",
  "label": "왕궁 도시 · 파랑 회벽집 5×7",
  "window": null,
  "abandoned": false,
  "vines": [],
  "x": 40,
  "y": 25,
  "w": 5,
  "h": 7,
  "template": 6,
  "doorAt": {
    "x": 41,
    "y": 31
  },
  "front": {
    "x": 41,
    "y": 32
  },
  "activity": "growing",
  "reason": "가운데 단 동쪽 강둑의 평지를 가족 텃밭으로 쓴다",
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
      -1,
      -1
    ],
    [
      2632,
      -1,
      -1,
      2632,
      -1
    ]
  ]
}
```

### twin-falls-river-village-house-6
```json
{
  "id": "twin-falls-river-village-house-6",
  "role": "주거",
  "label": "오렌지 회벽 l-mirror 집",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 54,
  "y": 25,
  "w": 6,
  "h": 8,
  "template": 1,
  "doorAt": {
    "x": 58,
    "y": 32
  },
  "front": {
    "x": 58,
    "y": 33
  },
  "activity": "laundry",
  "reason": "가운데 단 동쪽 끝 집은 세탁 마당만 둔다",
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

### twin-falls-river-village-house-7
```json
{
  "id": "twin-falls-river-village-house-7",
  "role": "밭집",
  "label": "왕궁 도시 · 주황 박공 회벽집 6×8",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 5,
  "y": 48,
  "w": 6,
  "h": 8,
  "template": 2,
  "doorAt": {
    "x": 7,
    "y": 55
  },
  "front": {
    "x": 7,
    "y": 56
  },
  "activity": "field-tending",
  "reason": "아랫단 서쪽 집이 바로 옆 밭을 돌본다",
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

### twin-falls-river-village-house-8
```json
{
  "id": "twin-falls-river-village-house-8",
  "role": "물자 보관집",
  "label": "왕궁 도시 · 주황 박공 회벽집 4×7 ②",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 44,
  "y": 49,
  "w": 4,
  "h": 7,
  "template": 3,
  "doorAt": {
    "x": 45,
    "y": 55
  },
  "front": {
    "x": 45,
    "y": 56
  },
  "activity": "storage",
  "reason": "아랫단 동쪽 다리목 집을 짐 보관 거점으로 둔다",
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
