# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 나무통
```json
{
  "id": "castle-drill-3",
  "name": "나무통",
  "x": 31,
  "y": 15,
  "purpose": "훈련 뒤 마실 물통",
  "near": "무기 거치대",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "castle-drill",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "useAt": {
    "x": 31,
    "y": 16
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
      2638
    ]
  ]
}
```

## 돌등
```json
{
  "id": "castle-drill-4",
  "name": "돌등",
  "x": 39,
  "y": 14,
  "purpose": "성문 서쪽을 밝히는 등",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "castle-drill",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 38,
    "y": 14
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

## 돌등
```json
{
  "id": "castle-drill-5",
  "name": "돌등",
  "x": 44,
  "y": 14,
  "purpose": "성문 동쪽을 밝히는 등",
  "near": "돌등",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "castle-drill",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 43,
    "y": 14
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

## 나무 상자
```json
{
  "id": "castle-stores-1",
  "name": "나무 상자",
  "x": 50,
  "y": 10,
  "purpose": "성으로 들일 보급 상자",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "castle-stores",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "useAt": {
    "x": 50,
    "y": 11
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
      237
    ]
  ]
}
```

## 술통
```json
{
  "id": "castle-stores-2",
  "name": "술통",
  "x": 52,
  "y": 10,
  "purpose": "성 창고에 들일 술통",
  "near": "나무 상자",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "castle-stores",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "useAt": {
    "x": 52,
    "y": 11
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
      177
    ]
  ]
}
```

## 장작 더미
```json
{
  "id": "castle-stores-3",
  "name": "장작 더미",
  "x": 50,
  "y": 12,
  "purpose": "성 부엌에 들일 땔감",
  "near": "나무 상자",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "castle-stores",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 50,
    "y": 13
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
      349
    ]
  ]
}
```

## 돌등
```json
{
  "id": "top-bridge-watch-1",
  "name": "돌등",
  "x": 64,
  "y": 14,
  "purpose": "윗다리 서쪽 목 밝히기",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "top-bridge-watch",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 63,
    "y": 14
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

## 나무 이정표
```json
{
  "id": "top-bridge-watch-2",
  "name": "나무 이정표",
  "x": 62,
  "y": 19,
  "purpose": "강 건너 망루지기 집 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "top-bridge-watch",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 62,
    "y": 20
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

## 장터 노점
```json
{
  "id": "mid-market-1",
  "name": "장터 노점",
  "x": 43,
  "y": 42,
  "purpose": "성 아랫마을 좌판",
  "w": 3,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "mid-market",
  "lower": "KEEP",
  "upper": [
    468,
    469,
    470,
    234,
    235,
    236
  ],
  "useAt": {
    "x": 42,
    "y": 42
  },
  "width": 3,
  "height": 2,
  "lowerTiles": [
    [
      240,
      240,
      240
    ],
    [
      240,
      240,
      240
    ]
  ],
  "upperTiles": [
    [
      468,
      469,
      470
    ],
    [
      234,
      235,
      236
    ]
  ]
}
```

## 과일 좌판
```json
{
  "id": "mid-market-2",
  "name": "과일 좌판",
  "x": 47,
  "y": 42,
  "purpose": "아랫단 텃밭에서 거둔 과일",
  "near": "장터 노점",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "mid-market",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "useAt": {
    "x": 47,
    "y": 43
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
      202,
      203
    ]
  ]
}
```

## 낮은 돌 우물
```json
{
  "id": "mid-market-3",
  "name": "낮은 돌 우물",
  "x": 36,
  "y": 39,
  "purpose": "가운데 단 공동 우물",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "mid-market",
  "lower": "KEEP",
  "upper": [
    2639,
    2640,
    2641,
    2642
  ],
  "useAt": {
    "x": 35,
    "y": 39
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

## 게시판
```json
{
  "id": "mid-market-4",
  "name": "게시판",
  "x": 38,
  "y": 36,
  "purpose": "성의 포고문을 붙이는 판",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "mid-market",
  "lower": "KEEP",
  "upper": [
    2630,
    2631,
    2633,
    2634
  ],
  "useAt": {
    "x": 38,
    "y": 35
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

## 벤치
```json
{
  "id": "pool-rest-1",
  "name": "벤치",
  "x": 62,
  "y": 35,
  "purpose": "폭포 아래 소를 보며 쉬는 자리",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "pool-rest",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 62,
    "y": 36
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
  "id": "pool-rest-2",
  "name": "낚시 바구니",
  "x": 64,
  "y": 33,
  "purpose": "소에서 쓰는 낚시 바구니",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "pool-rest",
  "lower": "KEEP",
  "upper": [
    2646
  ],
  "useAt": {
    "x": 64,
    "y": 34
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

## 모닥불
```json
{
  "id": "lower-fire-1",
  "name": "모닥불",
  "x": 62,
  "y": 63,
  "purpose": "나루 일꾼들이 저녁에 불을 피우는 자리",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lower-fire",
  "lower": "KEEP",
  "upper": [
    381
  ],
  "useAt": {
    "x": 62,
    "y": 64
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
      381
    ]
  ]
}
```

## 벤치
```json
{
  "id": "lower-fire-2",
  "name": "벤치",
  "x": 62,
  "y": 65,
  "purpose": "불가에 앉는 자리",
  "near": "모닥불",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lower-fire",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 62,
    "y": 66
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

## 장작 더미
```json
{
  "id": "lower-fire-3",
  "name": "장작 더미",
  "x": 64,
  "y": 63,
  "purpose": "모닥불 장작",
  "near": "모닥불",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lower-fire",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 64,
    "y": 64
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
      349
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
  "y": 67,
  "purpose": "성으로 오르는 길 안내",
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
    "y": 68
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

## 돌등
```json
{
  "id": "entry-sign-2",
  "name": "돌등",
  "x": 43,
  "y": 67,
  "purpose": "입구 길 밝히기",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "entry-sign",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 42,
    "y": 67
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
