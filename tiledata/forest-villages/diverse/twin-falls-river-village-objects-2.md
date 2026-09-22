# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 항아리
```json
{
  "id": "well-2",
  "name": "항아리",
  "x": 28,
  "y": 34,
  "purpose": "길어 온 물을 담는 용기",
  "near": "낮은 돌 우물",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "well",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "useAt": {
    "x": 28,
    "y": 35
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
  "id": "well-3",
  "name": "게시판",
  "x": 22,
  "y": 36,
  "purpose": "우물에 모인 주민의 마을 공지",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "well",
  "lower": "KEEP",
  "upper": [
    2630,
    2631,
    2633,
    2634
  ],
  "useAt": {
    "x": 21,
    "y": 36
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

## 장터 노점
```json
{
  "id": "bridge-market-1",
  "name": "장터 노점",
  "x": 46,
  "y": 40,
  "purpose": "강 양쪽 주민이 만나는 다리목 좌판",
  "w": 3,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "bridge-market",
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
    "x": 45,
    "y": 40
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
  "id": "bridge-market-2",
  "name": "과일 좌판",
  "x": 50,
  "y": 41,
  "purpose": "가운데 단 텃밭에서 거둔 과일",
  "near": "장터 노점",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "bridge-market",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "useAt": {
    "x": 50,
    "y": 42
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

## 술통
```json
{
  "id": "bridge-market-3",
  "name": "술통",
  "x": 44,
  "y": 41,
  "purpose": "장터 음료 통",
  "near": "장터 노점",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "bridge-market",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "useAt": {
    "x": 44,
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
      177
    ]
  ]
}
```

## 낚시 바구니
```json
{
  "id": "lower-pool-fishing-1",
  "name": "낚시 바구니",
  "x": 34,
  "y": 53,
  "purpose": "폭포 아래 소에서 쓰는 낚시 바구니",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lower-pool-fishing",
  "lower": "KEEP",
  "upper": [
    2646
  ],
  "useAt": {
    "x": 34,
    "y": 54
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

## 나무통
```json
{
  "id": "lower-pool-fishing-2",
  "name": "나무통",
  "x": 33,
  "y": 55,
  "purpose": "잡은 물고기를 담는 통",
  "near": "낚시 바구니",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lower-pool-fishing",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "useAt": {
    "x": 33,
    "y": 56
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

## 벤치
```json
{
  "id": "lower-pool-fishing-3",
  "name": "벤치",
  "x": 35,
  "y": 57,
  "purpose": "소를 바라보며 낚싯대를 드리우는 자리",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lower-pool-fishing",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 34,
    "y": 57
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

## 모닥불
```json
{
  "id": "pool-fire-1",
  "name": "모닥불",
  "x": 52,
  "y": 52,
  "purpose": "폭포 아래에서 저녁에 불을 피우는 자리",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "pool-fire",
  "lower": "KEEP",
  "upper": [
    381
  ],
  "useAt": {
    "x": 52,
    "y": 53
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
  "id": "pool-fire-2",
  "name": "벤치",
  "x": 54,
  "y": 54,
  "purpose": "불가에 앉는 자리",
  "near": "모닥불",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "pool-fire",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 54,
    "y": 55
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
  "id": "pool-fire-3",
  "name": "장작 더미",
  "x": 55,
  "y": 52,
  "purpose": "모닥불 장작",
  "near": "모닥불",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "pool-fire",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 55,
    "y": 53
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

## 장작 더미
```json
{
  "id": "woodyard-1",
  "name": "장작 더미",
  "x": 12,
  "y": 15,
  "purpose": "목공 작업에서 나온 장작",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "woodyard",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 12,
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
      349
    ]
  ]
}
```

## 장작 더미
```json
{
  "id": "woodyard-2",
  "name": "장작 더미",
  "x": 14,
  "y": 16,
  "purpose": "겨울 땔감 두 번째 더미",
  "near": "장작 더미",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "woodyard",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 13,
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
  "x": 22,
  "y": 68,
  "purpose": "마을 남쪽 입구 방향 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "entry-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 22,
    "y": 69
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
  "x": 26,
  "y": 65,
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
    "x": 25,
    "y": 65
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
  "id": "stair-signs-w-1",
  "name": "나무 이정표",
  "x": 20,
  "y": 53,
  "purpose": "가운데 단으로 오르는 서쪽 계단 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "stair-signs-w",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 20,
    "y": 54
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
  "id": "stair-signs-e-1",
  "name": "나무 이정표",
  "x": 66,
  "y": 53,
  "purpose": "가운데 단으로 오르는 동쪽 계단 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "stair-signs-e",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 66,
    "y": 54
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
