# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 나무 이정표
```json
{
  "id": "entry-sign-1",
  "name": "나무 이정표",
  "x": 34,
  "y": 85,
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
    "x": 34,
    "y": 86
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
  "x": 38,
  "y": 80,
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
    "x": 37,
    "y": 80
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
  "name": "나무 상자",
  "x": 12,
  "y": 13,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "ford-castle-town-house-1",
  "kit": "storage",
  "purpose": "운반 물자 보관",
  "anchor": "house",
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
      237
    ]
  ]
}
```

## 나무통
```json
{
  "name": "나무통",
  "x": 14,
  "y": 13,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "ford-castle-town-house-1",
  "kit": "storage",
  "purpose": "같은 창고의 벌크 물자 보관",
  "anchor": "나무 상자",
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

## 작은 오크통
```json
{
  "name": "작은 오크통",
  "x": 15,
  "y": 13,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    207
  ],
  "ownerId": "ford-castle-town-house-1",
  "kit": "storage",
  "purpose": "기름·식초 같은 작은 통 물자",
  "anchor": "나무통",
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
      207
    ]
  ]
}
```

## 과일 상자
```json
{
  "name": "과일 상자",
  "x": 12,
  "y": 15,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "ownerId": "ford-castle-town-house-1",
  "kit": "storage",
  "purpose": "나를 수확물 상자",
  "anchor": "나무 상자",
  "side": "right",
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
  "name": "술통",
  "x": 15,
  "y": 15,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "ownerId": "ford-castle-town-house-1",
  "kit": "storage",
  "purpose": "창고에 둔 술",
  "anchor": "나무통",
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
      177
    ]
  ]
}
```

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "x": 13,
  "y": 35,
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
  "ownerId": "ford-castle-town-house-3",
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
  "x": 15,
  "y": 36,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "ford-castle-town-house-3",
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
  "x": 16,
  "y": 36,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "ford-castle-town-house-3",
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

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "x": 8,
  "y": 55,
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
  "ownerId": "ford-castle-town-house-4",
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
  "x": 10,
  "y": 56,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "ford-castle-town-house-4",
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
  "x": 11,
  "y": 56,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "ford-castle-town-house-4",
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

## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 23,
  "y": 55,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2623,
    2624
  ],
  "ownerId": "ford-castle-town-house-5",
  "kit": "herbs",
  "purpose": "손질할 약초 재배",
  "anchor": "house",
  "side": "right",
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
      2623,
      2624
    ]
  ]
}
```

## 씨앗 자루
```json
{
  "name": "씨앗 자루",
  "x": 25,
  "y": 55,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "ford-castle-town-house-5",
  "kit": "herbs",
  "purpose": "다음에 심을 약초 씨앗",
  "anchor": "약초 화분",
  "side": "right",
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

## 가로 탁자
```json
{
  "name": "가로 탁자",
  "x": 23,
  "y": 57,
  "w": 3,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "ownerId": "ford-castle-town-house-5",
  "kit": "herbs",
  "purpose": "약초 선별·건조 작업면",
  "anchor": "약초 화분",
  "side": "right",
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

## 항아리
```json
{
  "name": "항아리",
  "x": 26,
  "y": 57,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "ford-castle-town-house-5",
  "kit": "herbs",
  "purpose": "손질한 약초 보관",
  "anchor": "가로 탁자",
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

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 54,
  "y": 55,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "ford-castle-town-house-6",
  "kit": "storage",
  "purpose": "운반 물자 보관",
  "anchor": "house",
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
      237
    ]
  ]
}
```

## 나무통
```json
{
  "name": "나무통",
  "x": 56,
  "y": 55,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "ford-castle-town-house-6",
  "kit": "storage",
  "purpose": "같은 창고의 벌크 물자 보관",
  "anchor": "나무 상자",
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

## 작은 오크통
```json
{
  "name": "작은 오크통",
  "x": 57,
  "y": 55,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    207
  ],
  "ownerId": "ford-castle-town-house-6",
  "kit": "storage",
  "purpose": "기름·식초 같은 작은 통 물자",
  "anchor": "나무통",
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
      207
    ]
  ]
}
```

## 과일 상자
```json
{
  "name": "과일 상자",
  "x": 54,
  "y": 57,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "ownerId": "ford-castle-town-house-6",
  "kit": "storage",
  "purpose": "나를 수확물 상자",
  "anchor": "나무 상자",
  "side": "right",
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
  "name": "술통",
  "x": 57,
  "y": 57,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "ownerId": "ford-castle-town-house-6",
  "kit": "storage",
  "purpose": "창고에 둔 술",
  "anchor": "나무통",
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
      177
    ]
  ]
}
```

## 채소밭
```json
{
  "name": "채소밭",
  "x": 11,
  "y": 78,
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
  "ownerId": "ford-castle-town-house-8",
  "kit": "growing",
  "purpose": "식재·수확할 작물",
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
  "x": 11,
  "y": 76,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2651,
    2654
  ],
  "ownerId": "ford-castle-town-house-8",
  "kit": "growing",
  "purpose": "바로 옆 작물 보호",
  "anchor": "채소밭",
  "side": "right",
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
  "x": 13,
  "y": 77,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "ford-castle-town-house-8",
  "kit": "growing",
  "purpose": "이 밭에 파종할 씨앗 보관",
  "anchor": "채소밭",
  "side": "right",
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
  "x": 13,
  "y": 79,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2636,
    2637
  ],
  "ownerId": "ford-castle-town-house-8",
  "kit": "growing",
  "purpose": "밭 가장자리를 두르는 울타리",
  "anchor": "채소밭",
  "side": "right",
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
  "x": 47,
  "y": 81,
  "w": 3,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "ownerId": "ford-castle-town-house-9",
  "kit": "woodwork",
  "purpose": "목재를 다루는 작업면",
  "anchor": "house",
  "side": "right",
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
  "x": 47,
  "y": 79,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "ownerId": "ford-castle-town-house-9",
  "kit": "woodwork",
  "purpose": "작업대에 공급할 목재",
  "anchor": "가로 탁자",
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
      349
    ]
  ]
}
```

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 49,
  "y": 79,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "ford-castle-town-house-9",
  "kit": "woodwork",
  "purpose": "가공한 물건 보관",
  "anchor": "가로 탁자",
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
      237
    ]
  ]
}
```

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 46,
  "y": 78,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "ford-castle-town-house-10",
  "kit": "storage",
  "purpose": "운반 물자 보관",
  "anchor": "house",
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
  "y": 78,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "ford-castle-town-house-10",
  "kit": "storage",
  "purpose": "같은 창고의 벌크 물자 보관",
  "anchor": "나무 상자",
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

## 과일 상자
```json
{
  "name": "과일 상자",
  "x": 46,
  "y": 80,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "ownerId": "ford-castle-town-house-10",
  "kit": "storage",
  "purpose": "나를 수확물 상자",
  "anchor": "나무 상자",
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
      202,
      203
    ]
  ]
}
```
