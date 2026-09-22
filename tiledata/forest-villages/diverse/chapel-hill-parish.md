# 종탑 언덕 교구마을

윗단 언덕에 스테인드글라스 교회와 울타리 친 외곽 묘지가 있고, 북쪽에서 온 강이 절벽을 폭포로 넘어 아랫마을을 가로지른다. 시작점 (40,60); 집 7채. 0기준 맵 좌표. 모든 집은 고정 조각이며 회전/잘라내기 금지. cliffs.points는 x가 증가하는 절벽 윗선 꼭짓점, height는 윗선→밑단의 y 차이다. stairs=[x,y,height]는 폭2, 윗선 행 y부터 y+height까지이고 양끝 착지칸은 y-1/y+height+1이다. 이전 plateaus 윤곽은 사용하지 않는다. 몸통·지붕·소품 전체 배열은 다음 부품 문서와 연결한다.

![종탑 언덕 교구마을 완성](images/chapel-hill-parish.png)

## 랜드마크
```json
[
  {
    "id": "chapel-hill-parish-church",
    "kind": "church",
    "label": "돌벽 교회",
    "x": 30,
    "y": 5,
    "w": 7,
    "h": 9,
    "doors": [
      {
        "x": 33,
        "y": 13
      }
    ]
  },
  {
    "id": "chapel-hill-parish-graveyard",
    "kind": "graveyard",
    "label": "마을 외곽 묘지",
    "x": 10,
    "y": 7,
    "w": 9,
    "h": 7,
    "gate": {
      "x": 14,
      "y": 13,
      "w": 1
    }
  }
]
```


## 입력 계획과 예약할 접근칸
```json
{
  "mapId": "chapel-hill-parish",
  "width": 80,
  "height": 64,
  "seed": 811,
  "start": {
    "x": 40,
    "y": 60
  },
  "yards": [
    {
      "ownerId": "chapel-hill-parish-house-1",
      "kit": "herbs",
      "name": "약초 손질",
      "reason": "교회 옆 사제관에서 제단에 올릴 약초를 기른다",
      "x": 40,
      "y": 11,
      "side": "left",
      "w": 5,
      "h": 3
    },
    {
      "ownerId": "chapel-hill-parish-house-2",
      "kit": "laundry",
      "name": "세탁·건조",
      "reason": "윗단 강 건너 집은 세탁 마당만 둔다",
      "x": 61,
      "y": 11,
      "side": "left",
      "w": 4,
      "h": 2
    },
    {
      "ownerId": "chapel-hill-parish-house-3",
      "kit": "woodwork",
      "name": "목재 가공",
      "reason": "아랫마을 서쪽 목수집이 교회 의자와 관을 짠다",
      "x": 17,
      "y": 37,
      "side": "right",
      "w": 3,
      "h": 3
    },
    {
      "ownerId": "chapel-hill-parish-house-4",
      "kit": "storage",
      "name": "물자 보관",
      "reason": "종지기가 초와 종 밧줄을 보관한다",
      "x": 32,
      "y": 42,
      "side": "right",
      "w": 3,
      "h": 1
    },
    {
      "ownerId": "chapel-hill-parish-house-5",
      "kit": "growing",
      "name": "텃밭 돌보기",
      "reason": "폭포 아래 강둑 평지를 가족 텃밭으로 쓴다",
      "x": 53,
      "y": 37,
      "side": "right",
      "w": 5,
      "h": 4
    },
    {
      "ownerId": "chapel-hill-parish-house-6",
      "kit": "laundry",
      "name": "세탁·건조",
      "reason": "남서쪽 집은 세탁 마당만 둔다",
      "x": 19,
      "y": 51,
      "side": "right",
      "w": 4,
      "h": 2
    }
  ],
  "activitySites": {
    "farm": {
      "x": 24,
      "y": 50,
      "w": 6,
      "h": 4
    }
  },
  "civicPlaces": [
    {
      "id": "churchyard",
      "name": "교회 앞마당",
      "anchor": {
        "type": "landmark",
        "id": "chapel-hill-parish-church",
        "maxDistance": 6
      },
      "items": [
        {
          "id": "churchyard-1",
          "name": "벤치",
          "x": 29,
          "y": 16,
          "purpose": "예배 전후 앉아 기다리는 자리"
        },
        {
          "id": "churchyard-2",
          "name": "벤치",
          "x": 36,
          "y": 15,
          "purpose": "교회 앞 동쪽 쉼 자리"
        },
        {
          "id": "churchyard-3",
          "name": "돌등",
          "x": 32,
          "y": 14,
          "purpose": "교회 문 서쪽을 밝히는 등"
        },
        {
          "id": "churchyard-4",
          "name": "돌등",
          "x": 35,
          "y": 19,
          "purpose": "교회 문 동쪽을 밝히는 등",
          "near": "돌등"
        },
        {
          "id": "churchyard-5",
          "name": "꽃 화단",
          "x": 38,
          "y": 9,
          "purpose": "교회 벽 옆 제단용 꽃밭"
        }
      ],
      "site": {
        "x": 30,
        "y": 5,
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
      "id": "graveyard-gate",
      "name": "묘지 들머리",
      "anchor": {
        "type": "landmark",
        "id": "chapel-hill-parish-graveyard",
        "maxDistance": 6
      },
      "items": [
        {
          "id": "graveyard-gate-1",
          "name": "돌등",
          "x": 12,
          "y": 15,
          "purpose": "묘지 입구를 밝히는 등"
        },
        {
          "id": "graveyard-gate-2",
          "name": "마른 묘목",
          "x": 20,
          "y": 14,
          "purpose": "묘지 울타리 곁 마른 나무"
        }
      ],
      "site": {
        "x": 10,
        "y": 7,
        "w": 9,
        "h": 7,
        "layer": "lower",
        "tiles": [
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240,
          240
        ]
      }
    },
    {
      "id": "falls-pool",
      "name": "폭포 아래 소",
      "anchor": {
        "type": "road",
        "x": 53,
        "y": 31,
        "maxDistance": 8
      },
      "items": [
        {
          "id": "falls-pool-1",
          "name": "벤치",
          "x": 52,
          "y": 33,
          "purpose": "폭포를 바라보며 쉬는 자리"
        },
        {
          "id": "falls-pool-2",
          "name": "낚시 바구니",
          "x": 54,
          "y": 35,
          "purpose": "폭포 아래 소에서 쓰는 낚시 바구니"
        }
      ],
      "site": {
        "x": 53,
        "y": 31,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1498
        ]
      }
    },
    {
      "id": "village-well",
      "name": "아랫마을 공동 우물",
      "anchor": {
        "type": "road",
        "x": 40,
        "y": 44,
        "maxDistance": 8
      },
      "items": [
        {
          "id": "village-well-1",
          "name": "낮은 돌 우물",
          "x": 37,
          "y": 41,
          "purpose": "아랫마을 주민의 급수"
        },
        {
          "id": "village-well-2",
          "name": "항아리",
          "x": 35,
          "y": 41,
          "purpose": "길어 온 물을 담는 용기",
          "near": "낮은 돌 우물"
        },
        {
          "id": "village-well-3",
          "name": "게시판",
          "x": 43,
          "y": 41,
          "purpose": "교회 소식과 마을 공지를 붙이는 판"
        }
      ],
      "site": {
        "x": 40,
        "y": 44,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1503
        ]
      }
    },
    {
      "id": "entry-sign",
      "name": "남쪽 입구 길잡이",
      "anchor": {
        "type": "road",
        "x": 40,
        "y": 60,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "entry-sign-1",
          "name": "나무 이정표",
          "x": 38,
          "y": 58,
          "purpose": "교회로 오르는 길 안내"
        }
      ],
      "site": {
        "x": 40,
        "y": 60,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1516
        ]
      }
    },
    {
      "id": "stair-sign",
      "name": "계단 아래 길잡이",
      "anchor": {
        "type": "road",
        "x": 40,
        "y": 28,
        "maxDistance": 10
      },
      "items": [
        {
          "id": "stair-sign-1",
          "name": "나무 이정표",
          "x": 38,
          "y": 29,
          "purpose": "언덕 위 교회로 오르는 계단 안내"
        }
      ],
      "site": {
        "x": 40,
        "y": 28,
        "w": 1,
        "h": 1,
        "layer": "lower",
        "tiles": [
          1490
        ]
      }
    }
  ],
  "entrance": {
    "x": 40,
    "y": 63
  },
  "crest": null,
  "patches": [
    [
      3,
      30,
      8,
      14,
      10
    ],
    [
      77,
      30,
      8,
      14,
      10
    ],
    [
      73,
      40,
      6,
      10,
      10
    ],
    [
      70,
      58,
      10,
      8,
      9
    ],
    [
      4,
      60,
      8,
      8,
      9
    ]
  ],
  "clearings": [
    [
      33,
      10,
      12,
      8,
      10
    ],
    [
      16,
      10,
      9,
      6,
      9
    ],
    [
      30,
      42,
      20,
      8,
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
          20,
          22
        ],
        [
          22,
          21
        ],
        [
          34,
          21
        ],
        [
          36,
          22
        ],
        [
          74,
          22
        ]
      ],
      "height": 5
    }
  ],
  "stairs": [
    [
      26,
      21,
      5
    ],
    [
      40,
      22,
      5
    ]
  ],
  "ponds": [],
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
      44
    ],
    [
      40,
      28
    ],
    [
      40,
      20
    ],
    [
      33,
      16
    ],
    [
      22,
      18
    ],
    [
      14,
      16
    ],
    [
      22,
      18
    ],
    [
      27,
      20
    ],
    [
      33,
      16
    ],
    [
      48,
      16
    ],
    [
      56,
      15
    ],
    [
      66,
      16
    ],
    [
      48,
      16
    ],
    [
      40,
      20
    ],
    [
      40,
      32
    ],
    [
      53,
      31
    ],
    [
      40,
      32
    ],
    [
      40,
      44
    ],
    [
      20,
      44
    ],
    [
      14,
      47
    ],
    [
      20,
      44
    ],
    [
      40,
      44
    ],
    [
      52,
      44
    ]
  ],
  "access": [
    {
      "role": "stairs-top",
      "x": 26,
      "y": 20
    },
    {
      "role": "stairs-bottom",
      "x": 26,
      "y": 27
    },
    {
      "role": "stairs-top",
      "x": 40,
      "y": 21
    },
    {
      "role": "stairs-bottom",
      "x": 40,
      "y": 28
    },
    {
      "role": "bridge-west",
      "x": 56,
      "y": 14
    },
    {
      "role": "bridge-east",
      "x": 61,
      "y": 14
    },
    {
      "role": "door-front",
      "x": 47,
      "y": 14
    },
    {
      "role": "door-front",
      "x": 68,
      "y": 14
    },
    {
      "role": "door-front",
      "x": 14,
      "y": 40
    },
    {
      "role": "door-front",
      "x": 27,
      "y": 44
    },
    {
      "role": "door-front",
      "x": 48,
      "y": 41
    },
    {
      "role": "door-front",
      "x": 14,
      "y": 58
    },
    {
      "role": "door-front",
      "x": 49,
      "y": 56
    },
    {
      "role": "landmark-door",
      "x": 33,
      "y": 14,
      "landmarkId": "chapel-hill-parish-church"
    },
    {
      "role": "yard-gate",
      "x": 14,
      "y": 14,
      "landmarkId": "chapel-hill-parish-graveyard"
    },
    {
      "role": "yard-inside",
      "x": 14,
      "y": 12,
      "landmarkId": "chapel-hill-parish-graveyard"
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
      "x": 29,
      "y": 17,
      "placeId": "churchyard",
      "propId": "churchyard-1"
    },
    {
      "role": "civic-use",
      "x": 36,
      "y": 16,
      "placeId": "churchyard",
      "propId": "churchyard-2"
    },
    {
      "role": "civic-use",
      "x": 31,
      "y": 14,
      "placeId": "churchyard",
      "propId": "churchyard-3"
    },
    {
      "role": "civic-use",
      "x": 34,
      "y": 19,
      "placeId": "churchyard",
      "propId": "churchyard-4"
    },
    {
      "role": "civic-use",
      "x": 37,
      "y": 9,
      "placeId": "churchyard",
      "propId": "churchyard-5"
    },
    {
      "role": "civic-use",
      "x": 11,
      "y": 15,
      "placeId": "graveyard-gate",
      "propId": "graveyard-gate-1"
    },
    {
      "role": "civic-use",
      "x": 20,
      "y": 15,
      "placeId": "graveyard-gate",
      "propId": "graveyard-gate-2"
    },
    {
      "role": "civic-use",
      "x": 52,
      "y": 34,
      "placeId": "falls-pool",
      "propId": "falls-pool-1"
    },
    {
      "role": "civic-use",
      "x": 54,
      "y": 36,
      "placeId": "falls-pool",
      "propId": "falls-pool-2"
    },
    {
      "role": "civic-use",
      "x": 36,
      "y": 41,
      "placeId": "village-well",
      "propId": "village-well-1"
    },
    {
      "role": "civic-use",
      "x": 35,
      "y": 42,
      "placeId": "village-well",
      "propId": "village-well-2"
    },
    {
      "role": "civic-use",
      "x": 42,
      "y": 41,
      "placeId": "village-well",
      "propId": "village-well-3"
    },
    {
      "role": "civic-use",
      "x": 38,
      "y": 59,
      "placeId": "entry-sign",
      "propId": "entry-sign-1"
    },
    {
      "role": "civic-use",
      "x": 38,
      "y": 30,
      "placeId": "stair-sign",
      "propId": "stair-sign-1"
    }
  ]
}
```


## 건물의 전체 하위·상위
### chapel-hill-parish-house-1
```json
{
  "id": "chapel-hill-parish-house-1",
  "role": "사제관",
  "label": "왕궁 도시 · 주황 박공 회벽집 4×7 ②",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 46,
  "y": 7,
  "w": 4,
  "h": 7,
  "template": 3,
  "doorAt": {
    "x": 47,
    "y": 13
  },
  "front": {
    "x": 47,
    "y": 14
  },
  "activity": "herbs",
  "reason": "교회 옆 사제관에서 제단에 올릴 약초를 기른다",
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

### chapel-hill-parish-house-2
```json
{
  "id": "chapel-hill-parish-house-2",
  "role": "주거",
  "label": "왕궁 도시 · 파랑 박공 회벽집 6×8 ②",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 66,
  "y": 6,
  "w": 6,
  "h": 8,
  "template": 0,
  "doorAt": {
    "x": 68,
    "y": 13
  },
  "front": {
    "x": 68,
    "y": 14
  },
  "activity": "laundry",
  "reason": "윗단 강 건너 집은 세탁 마당만 둔다",
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

### chapel-hill-parish-house-3
```json
{
  "id": "chapel-hill-parish-house-3",
  "role": "목수집",
  "label": "오렌지 회벽 l-mirror 집",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 10,
  "y": 32,
  "w": 6,
  "h": 8,
  "template": 1,
  "doorAt": {
    "x": 14,
    "y": 39
  },
  "front": {
    "x": 14,
    "y": 40
  },
  "activity": "woodwork",
  "reason": "아랫마을 서쪽 목수집이 교회 의자와 관을 짠다",
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

### chapel-hill-parish-house-4
```json
{
  "id": "chapel-hill-parish-house-4",
  "role": "종지기 집",
  "label": "오렌지 회벽 2층 rect-2f 집",
  "window": 86,
  "abandoned": false,
  "vines": [],
  "x": 24,
  "y": 35,
  "w": 7,
  "h": 9,
  "template": 4,
  "doorAt": {
    "x": 27,
    "y": 43
  },
  "front": {
    "x": 27,
    "y": 44
  },
  "activity": "storage",
  "reason": "종지기가 초와 종 밧줄을 보관한다",
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

### chapel-hill-parish-house-5
```json
{
  "id": "chapel-hill-parish-house-5",
  "role": "텃밭집",
  "label": "왕궁 도시 · 주황 박공 회벽집 6×8",
  "window": 85,
  "abandoned": false,
  "vines": [],
  "x": 46,
  "y": 33,
  "w": 6,
  "h": 8,
  "template": 2,
  "doorAt": {
    "x": 48,
    "y": 40
  },
  "front": {
    "x": 48,
    "y": 41
  },
  "activity": "growing",
  "reason": "폭포 아래 강둑 평지를 가족 텃밭으로 쓴다",
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

### chapel-hill-parish-house-6
```json
{
  "id": "chapel-hill-parish-house-6",
  "role": "주거",
  "label": "왕궁 도시 · 파랑 박공 회벽집 6×8 ②",
  "window": 86,
  "abandoned": false,
  "vines": [],
  "x": 12,
  "y": 50,
  "w": 6,
  "h": 8,
  "template": 0,
  "doorAt": {
    "x": 14,
    "y": 57
  },
  "front": {
    "x": 14,
    "y": 58
  },
  "activity": "laundry",
  "reason": "남서쪽 집은 세탁 마당만 둔다",
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

### chapel-hill-parish-house-7
```json
{
  "id": "chapel-hill-parish-house-7",
  "role": "밭집",
  "label": "파랑 석벽 rect-wide 집",
  "window": 87,
  "abandoned": false,
  "vines": [],
  "x": 46,
  "y": 50,
  "w": 8,
  "h": 6,
  "template": 7,
  "doorAt": {
    "x": 49,
    "y": 55
  },
  "front": {
    "x": 49,
    "y": 56
  },
  "activity": "field-tending",
  "reason": "바로 옆 밭을 돌본다",
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
