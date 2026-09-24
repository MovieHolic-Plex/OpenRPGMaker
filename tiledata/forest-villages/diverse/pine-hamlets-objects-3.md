# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 16,
  "y": 32,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2623,
    2624
  ],
  "ownerId": "pine-hamlets-house-4",
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
  "x": 18,
  "y": 32,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "pine-hamlets-house-4",
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
  "x": 16,
  "y": 34,
  "w": 3,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "ownerId": "pine-hamlets-house-4",
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
  "x": 19,
  "y": 34,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "pine-hamlets-house-4",
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

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "x": 43,
  "y": 31,
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
  "ownerId": "pine-hamlets-house-5",
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
  "x": 45,
  "y": 32,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "pine-hamlets-house-5",
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
  "x": 46,
  "y": 32,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "pine-hamlets-house-5",
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
  "x": 56,
  "y": 38,
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
  "ownerId": "pine-hamlets-house-6",
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
  "x": 56,
  "y": 36,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2651,
    2654
  ],
  "ownerId": "pine-hamlets-house-6",
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
  "x": 58,
  "y": 37,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "pine-hamlets-house-6",
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
  "x": 58,
  "y": 39,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2636,
    2637
  ],
  "ownerId": "pine-hamlets-house-6",
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

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 18,
  "y": 41,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "pine-hamlets-house-7",
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
  "x": 20,
  "y": 41,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "pine-hamlets-house-7",
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

## 작은 오크통
```json
{
  "name": "작은 오크통",
  "x": 21,
  "y": 41,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    207
  ],
  "ownerId": "pine-hamlets-house-7",
  "kit": "storage",
  "purpose": "기름·식초 같은 작은 통 물자",
  "anchor": "나무통",
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
      207
    ]
  ]
}
```

## 과일 상자
```json
{
  "name": "과일 상자",
  "x": 18,
  "y": 43,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "ownerId": "pine-hamlets-house-7",
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

## 술통
```json
{
  "name": "술통",
  "x": 21,
  "y": 43,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "ownerId": "pine-hamlets-house-7",
  "kit": "storage",
  "purpose": "창고에 둔 술",
  "anchor": "나무통",
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
      177
    ]
  ]
}
```

## 화분
```json
{
  "name": "화분",
  "x": 6,
  "y": 13,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "pine-hamlets-house-1",
  "kit": "doorway",
  "purpose": "현관 옆에 둔 꽃 화분",
  "anchor": "door",
  "side": "left",
  "width": 1,
  "height": 2,
  "lowerTiles": [
    [
      75
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

## 화분
```json
{
  "name": "화분",
  "x": 27,
  "y": 11,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "pine-hamlets-house-2",
  "kit": "doorway",
  "purpose": "현관 옆에 둔 꽃 화분",
  "anchor": "door",
  "side": "left",
  "width": 1,
  "height": 2,
  "lowerTiles": [
    [
      75
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

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 51,
  "y": 15,
  "w": 2,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2611,
    2612,
    2616,
    2617
  ],
  "ownerId": "pine-hamlets-house-3",
  "kit": "doorway",
  "purpose": "현관 옆을 밝히는 꽃 화단",
  "anchor": "door",
  "side": "left",
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      76,
      76
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

## 화분
```json
{
  "name": "화분",
  "x": 55,
  "y": 15,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "pine-hamlets-house-3",
  "kit": "doorway",
  "purpose": "현관 옆에 둔 꽃 화분",
  "anchor": "door",
  "side": "right",
  "width": 1,
  "height": 2,
  "lowerTiles": [
    [
      76
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

## 화분
```json
{
  "name": "화분",
  "x": 14,
  "y": 34,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "pine-hamlets-house-4",
  "kit": "doorway",
  "purpose": "현관 옆에 둔 꽃 화분",
  "anchor": "door",
  "side": "right",
  "width": 1,
  "height": 2,
  "lowerTiles": [
    [
      77
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

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 39,
  "y": 33,
  "w": 2,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2611,
    2612,
    2616,
    2617
  ],
  "ownerId": "pine-hamlets-house-5",
  "kit": "doorway",
  "purpose": "현관 옆을 밝히는 꽃 화단",
  "anchor": "door",
  "side": "left",
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      240,
      72
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

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 53,
  "y": 41,
  "w": 2,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2611,
    2612,
    2616,
    2617
  ],
  "ownerId": "pine-hamlets-house-6",
  "kit": "doorway",
  "purpose": "현관 옆을 밝히는 꽃 화단",
  "anchor": "door",
  "side": "right",
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      76,
      77
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

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 23,
  "y": 46,
  "w": 2,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2611,
    2612,
    2616,
    2617
  ],
  "ownerId": "pine-hamlets-house-7",
  "kit": "doorway",
  "purpose": "현관 옆을 밝히는 꽃 화단",
  "anchor": "door",
  "side": "left",
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      240,
      75
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

## 벤치
```json
{
  "id": "well-plaza-1",
  "name": "벤치",
  "x": 34,
  "y": 22,
  "purpose": "우물가에 앉아 쉬는 자리",
  "near": "낮은 돌 우물",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "well",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 34,
    "y": 23
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

## 화분
```json
{
  "id": "well-plaza-2",
  "name": "화분",
  "x": 36,
  "y": 28,
  "purpose": "우물가를 꾸미는 화분",
  "near": "낮은 돌 우물",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "well",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "useAt": {
    "x": 35,
    "y": 28
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
