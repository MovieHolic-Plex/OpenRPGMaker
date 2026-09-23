# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 돌등
```json
{
  "id": "churchyard-4",
  "name": "돌등",
  "x": 35,
  "y": 19,
  "purpose": "교회 문 동쪽을 밝히는 등",
  "near": "돌등",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "churchyard",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 34,
    "y": 19
  },
  "width": 1,
  "height": 2,
  "lowerTiles": [
    [
      240
    ],
    [
      240
    ]
  ],
  "upperTiles": [
    [
      2655
    ],
    [
      2656
    ]
  ]
}
```

## 꽃 화단
```json
{
  "id": "churchyard-5",
  "name": "꽃 화단",
  "x": 38,
  "y": 9,
  "purpose": "교회 벽 옆 제단용 꽃밭",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "churchyard",
  "lower": "KEEP",
  "upper": [
    2611,
    2612,
    2616,
    2617
  ],
  "useAt": {
    "x": 37,
    "y": 9
  },
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      240,
      240
    ],
    [
      240,
      240
    ]
  ],
  "upperTiles": [
    [
      2611,
      2612
    ],
    [
      2616,
      2617
    ]
  ]
}
```

## 돌등
```json
{
  "id": "graveyard-gate-1",
  "name": "돌등",
  "x": 12,
  "y": 15,
  "purpose": "묘지 입구를 밝히는 등",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "graveyard-gate",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 11,
    "y": 15
  },
  "width": 1,
  "height": 2,
  "lowerTiles": [
    [
      240
    ],
    [
      240
    ]
  ],
  "upperTiles": [
    [
      2655
    ],
    [
      2656
    ]
  ]
}
```

## 마른 묘목
```json
{
  "id": "graveyard-gate-2",
  "name": "마른 묘목",
  "x": 20,
  "y": 14,
  "purpose": "묘지 울타리 곁 마른 나무",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "graveyard-gate",
  "lower": "KEEP",
  "upper": [
    740
  ],
  "useAt": {
    "x": 20,
    "y": 15
  },
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      240
    ]
  ],
  "upperTiles": [
    [
      740
    ]
  ]
}
```

## 벤치
```json
{
  "id": "falls-pool-1",
  "name": "벤치",
  "x": 52,
  "y": 33,
  "purpose": "폭포를 바라보며 쉬는 자리",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "falls-pool",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 52,
    "y": 34
  },
  "width": 2,
  "height": 1,
  "lowerTiles": [
    [
      240,
      240
    ]
  ],
  "upperTiles": [
    [
      327,
      328
    ]
  ]
}
```

## 낚시 바구니
```json
{
  "id": "falls-pool-2",
  "name": "낚시 바구니",
  "x": 54,
  "y": 35,
  "purpose": "폭포 아래 소에서 쓰는 낚시 바구니",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "falls-pool",
  "lower": "KEEP",
  "upper": [
    2646
  ],
  "useAt": {
    "x": 54,
    "y": 36
  },
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      240
    ]
  ],
  "upperTiles": [
    [
      2646
    ]
  ]
}
```

## 낮은 돌 우물
```json
{
  "id": "village-well-1",
  "name": "낮은 돌 우물",
  "x": 37,
  "y": 41,
  "purpose": "아랫마을 주민의 급수",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "village-well",
  "lower": "KEEP",
  "upper": [
    2639,
    2640,
    2641,
    2642
  ],
  "useAt": {
    "x": 36,
    "y": 41
  },
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      240,
      240
    ],
    [
      240,
      240
    ]
  ],
  "upperTiles": [
    [
      2639,
      2640
    ],
    [
      2641,
      2642
    ]
  ]
}
```

## 항아리
```json
{
  "id": "village-well-2",
  "name": "항아리",
  "x": 35,
  "y": 41,
  "purpose": "길어 온 물을 담는 용기",
  "near": "낮은 돌 우물",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "village-well",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "useAt": {
    "x": 35,
    "y": 42
  },
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      240
    ]
  ],
  "upperTiles": [
    [
      352
    ]
  ]
}
```

## 게시판
```json
{
  "id": "village-well-3",
  "name": "게시판",
  "x": 43,
  "y": 41,
  "purpose": "교회 소식과 마을 공지를 붙이는 판",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "village-well",
  "lower": "KEEP",
  "upper": [
    2630,
    2631,
    2633,
    2634
  ],
  "useAt": {
    "x": 42,
    "y": 41
  },
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      240,
      240
    ],
    [
      240,
      240
    ]
  ],
  "upperTiles": [
    [
      2630,
      2631
    ],
    [
      2633,
      2634
    ]
  ]
}
```

## 나무 이정표
```json
{
  "id": "entry-sign-1",
  "name": "나무 이정표",
  "x": 38,
  "y": 58,
  "purpose": "교회로 오르는 길 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "entry-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 38,
    "y": 59
  },
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      240
    ]
  ],
  "upperTiles": [
    [
      596
    ]
  ]
}
```

## 나무 이정표
```json
{
  "id": "stair-sign-1",
  "name": "나무 이정표",
  "x": 38,
  "y": 29,
  "purpose": "언덕 위 교회로 오르는 계단 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "stair-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 38,
    "y": 30
  },
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      240
    ]
  ],
  "upperTiles": [
    [
      596
    ]
  ]
}
```
