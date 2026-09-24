# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 화분
```json
{
  "id": "front-2",
  "name": "화분",
  "x": 4,
  "y": 12,
  "purpose": "현관 옆 환영 식물",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "front",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "useAt": {
    "x": 5,
    "y": 12
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
      2632
    ],
    [
      2635
    ]
  ]
}
```

## 벽걸이 등불
```json
{
  "id": "lamp-3-1",
  "name": "벽걸이 등불",
  "x": 55,
  "y": 14,
  "purpose": "현관 옆 벽면 조명",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lamp-3",
  "lower": "KEEP",
  "upper": [
    2645
  ],
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      46
    ]
  ],
  "upperTiles": [
    [
      2645
    ]
  ]
}
```

## 벽걸이 등불
```json
{
  "id": "lamp-6-1",
  "name": "벽걸이 등불",
  "x": 53,
  "y": 40,
  "purpose": "현관 옆 벽면 조명",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lamp-6",
  "lower": "KEEP",
  "upper": [
    2645
  ],
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      46
    ]
  ],
  "upperTiles": [
    [
      2645
    ]
  ]
}
```

## 벤치
```json
{
  "id": "overlook-1",
  "name": "벤치",
  "x": 37,
  "y": 13,
  "purpose": "절벽 끝에서 아랫마을을 내려다보며 쉬는 자리",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "overlook",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 37,
    "y": 14
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

## 벤치
```json
{
  "id": "overlook-2",
  "name": "벤치",
  "x": 26,
  "y": 13,
  "purpose": "계단을 오른 뒤 숨 돌리는 자리",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "overlook",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 26,
    "y": 14
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

## 나무 이정표
```json
{
  "id": "overlook-3",
  "name": "나무 이정표",
  "x": 31,
  "y": 12,
  "purpose": "윗마을 동서 갈림길 방향 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "overlook",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 31,
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
      596
    ]
  ]
}
```

## 나무 이정표
```json
{
  "id": "stair-signs-1",
  "name": "나무 이정표",
  "x": 30,
  "y": 23,
  "purpose": "가운데 계단으로 오르는 길 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "stair-signs",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 30,
    "y": 24
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
  "id": "west-stair-sign-1",
  "name": "나무 이정표",
  "x": 13,
  "y": 24,
  "purpose": "서쪽 계단으로 오르는 길 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "west-stair-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 13,
    "y": 25
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
  "id": "east-stair-sign-1",
  "name": "나무 이정표",
  "x": 49,
  "y": 26,
  "purpose": "동쪽 계단으로 오르는 길 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "east-stair-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 49,
    "y": 27
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

## 장작 더미
```json
{
  "id": "woodyard-1",
  "name": "장작 더미",
  "x": 47,
  "y": 14,
  "purpose": "목공 작업에서 나온 장작을 쌓아 두는 자리",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "woodyard",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 47,
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
  "x": 46,
  "y": 17,
  "purpose": "겨울용 땔감 두 번째 더미",
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
    "x": 46,
    "y": 18
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

## 술통
```json
{
  "id": "woodyard-3",
  "name": "술통",
  "x": 59,
  "y": 14,
  "purpose": "작업용 물을 받아 두는 통",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "woodyard",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "useAt": {
    "x": 59,
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
      177
    ]
  ]
}
```

## 모닥불
```json
{
  "id": "campfire-1",
  "name": "모닥불",
  "x": 7,
  "y": 34,
  "purpose": "저녁에 샘가 주민이 모이는 불자리",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "campfire",
  "lower": "KEEP",
  "upper": [
    381
  ],
  "useAt": {
    "x": 7,
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
      381
    ]
  ]
}
```

## 벤치
```json
{
  "id": "campfire-2",
  "name": "벤치",
  "x": 7,
  "y": 36,
  "purpose": "불가 남쪽 앉을 자리",
  "near": "모닥불",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "campfire",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 7,
    "y": 37
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

## 벤치
```json
{
  "id": "campfire-3",
  "name": "벤치",
  "x": 8,
  "y": 33,
  "purpose": "불가 북쪽 앉을 자리",
  "near": "모닥불",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "campfire",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 8,
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

## 장작 더미
```json
{
  "id": "campfire-4",
  "name": "장작 더미",
  "x": 9,
  "y": 35,
  "purpose": "모닥불에 쓸 장작",
  "near": "모닥불",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "campfire",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 9,
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
      349
    ]
  ]
}
```

## 장터 노점
```json
{
  "id": "market-1",
  "name": "장터 노점",
  "x": 28,
  "y": 32,
  "purpose": "아랫마을 주민이 채소와 과일을 파는 좌판",
  "w": 3,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "market",
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
    "x": 27,
    "y": 32
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
  "id": "market-2",
  "name": "과일 좌판",
  "x": 32,
  "y": 34,
  "purpose": "산에서 딴 과일을 늘어놓은 상자",
  "near": "장터 노점",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "market",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "useAt": {
    "x": 32,
    "y": 35
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
  "id": "market-3",
  "name": "술통",
  "x": 27,
  "y": 36,
  "purpose": "장터 음료 통",
  "near": "장터 노점",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "market",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "useAt": {
    "x": 27,
    "y": 37
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

## 벤치
```json
{
  "id": "market-4",
  "name": "벤치",
  "x": 29,
  "y": 37,
  "purpose": "장 보러 온 사람의 쉼 자리",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "market",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 29,
    "y": 38
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

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "x": 11,
  "y": 11,
  "w": 2,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2620,
    2621,
    2625,
    2626
  ],
  "ownerId": "pine-hamlets-house-1",
  "kit": "laundry",
  "purpose": "세탁물을 말리는 자리",
  "anchor": "house",
  "side": "right",
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
      2620,
      2621
    ],
    [
      2625,
      2626
    ]
  ]
}
```

## 나무통
```json
{
  "name": "나무통",
  "x": 13,
  "y": 12,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "pine-hamlets-house-1",
  "kit": "laundry",
  "purpose": "빨래를 헹구는 물통",
  "anchor": "빨랫줄",
  "side": "right",
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

## 항아리
```json
{
  "name": "항아리",
  "x": 14,
  "y": 12,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "pine-hamlets-house-1",
  "kit": "laundry",
  "purpose": "세탁에 쓸 물 보관",
  "anchor": "빨랫줄",
  "side": "right",
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

## 채소밭
```json
{
  "name": "채소밭",
  "x": 22,
  "y": 10,
  "w": 2,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2613,
    2614,
    2618,
    2619
  ],
  "ownerId": "pine-hamlets-house-2",
  "kit": "growing",
  "purpose": "식재·수확할 작물",
  "anchor": "house",
  "side": "left",
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
      2613,
      2614
    ],
    [
      2618,
      2619
    ]
  ]
}
```

## 허수아비
```json
{
  "name": "허수아비",
  "x": 22,
  "y": 8,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2651,
    2654
  ],
  "ownerId": "pine-hamlets-house-2",
  "kit": "growing",
  "purpose": "바로 옆 작물 보호",
  "anchor": "채소밭",
  "side": "left",
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
      2651
    ],
    [
      2654
    ]
  ]
}
```

## 씨앗 자루
```json
{
  "name": "씨앗 자루",
  "x": 24,
  "y": 9,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "pine-hamlets-house-2",
  "kit": "growing",
  "purpose": "이 밭에 파종할 씨앗 보관",
  "anchor": "채소밭",
  "side": "left",
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
      2652,
      2653
    ]
  ]
}
```

## 나무 울타리
```json
{
  "name": "나무 울타리",
  "x": 24,
  "y": 11,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2636,
    2637
  ],
  "ownerId": "pine-hamlets-house-2",
  "kit": "growing",
  "purpose": "밭 가장자리를 두르는 울타리",
  "anchor": "채소밭",
  "side": "left",
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
      2636,
      2637
    ]
  ]
}
```

## 가로 탁자
```json
{
  "name": "가로 탁자",
  "x": 45,
  "y": 13,
  "w": 3,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "ownerId": "pine-hamlets-house-3",
  "kit": "woodwork",
  "purpose": "목재를 다루는 작업면",
  "anchor": "house",
  "side": "left",
  "width": 3,
  "height": 1,
  "lowerTiles": [
    [
      240,
      240,
      240
    ]
  ],
  "upperTiles": [
    [
      234,
      235,
      236
    ]
  ]
}
```

## 장작
```json
{
  "name": "장작",
  "x": 45,
  "y": 11,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "ownerId": "pine-hamlets-house-3",
  "kit": "woodwork",
  "purpose": "작업대에 공급할 목재",
  "anchor": "가로 탁자",
  "side": "left",
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

## 통나무 더미
```json
{
  "name": "통나무 더미",
  "x": 46,
  "y": 11,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    741
  ],
  "ownerId": "pine-hamlets-house-3",
  "kit": "woodwork",
  "purpose": "켜서 쓸 원목",
  "anchor": "가로 탁자",
  "side": "left",
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      240
    ]
  ],
  "upperTiles": [
    [
      741
    ]
  ]
}
```

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 47,
  "y": 11,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "pine-hamlets-house-3",
  "kit": "woodwork",
  "purpose": "가공한 물건 보관",
  "anchor": "가로 탁자",
  "side": "left",
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

## 나무통
```json
{
  "name": "나무통",
  "x": 48,
  "y": 13,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "pine-hamlets-house-3",
  "kit": "woodwork",
  "purpose": "짜 맞춘 통 완성품",
  "anchor": "가로 탁자",
  "side": "left",
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
