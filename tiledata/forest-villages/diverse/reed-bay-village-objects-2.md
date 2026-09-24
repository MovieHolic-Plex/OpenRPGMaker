# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 39,
  "y": 14,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "reed-bay-village-house-3",
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
  "x": 41,
  "y": 14,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "reed-bay-village-house-3",
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
  "x": 42,
  "y": 14,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    207
  ],
  "ownerId": "reed-bay-village-house-3",
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
  "x": 39,
  "y": 16,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "ownerId": "reed-bay-village-house-3",
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
  "x": 42,
  "y": 16,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "ownerId": "reed-bay-village-house-3",
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

## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 33,
  "y": 23,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2623,
    2624
  ],
  "ownerId": "reed-bay-village-house-5",
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
  "x": 35,
  "y": 23,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "reed-bay-village-house-5",
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
  "x": 33,
  "y": 25,
  "w": 3,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "ownerId": "reed-bay-village-house-5",
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
  "x": 36,
  "y": 25,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "reed-bay-village-house-5",
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

## 낚시 바구니
```json
{
  "name": "낚시 바구니",
  "x": 48,
  "y": 29,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2646
  ],
  "ownerId": "reed-bay-village-house-6",
  "kit": "fishing",
  "purpose": "부두에 가져갈 낚시 도구",
  "anchor": "dock",
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
      2646
    ]
  ]
}
```

## 나무통
```json
{
  "name": "나무통",
  "x": 50,
  "y": 29,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "reed-bay-village-house-6",
  "kit": "fishing",
  "purpose": "어획물을 담을 용기",
  "anchor": "낚시 바구니",
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

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 48,
  "y": 31,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "reed-bay-village-house-6",
  "kit": "fishing",
  "purpose": "어구 보관",
  "anchor": "낚시 바구니",
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

## 항아리
```json
{
  "name": "항아리",
  "x": 50,
  "y": 31,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "reed-bay-village-house-6",
  "kit": "fishing",
  "purpose": "어획물을 절일 소금",
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
      352
    ]
  ]
}
```

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "x": 5,
  "y": 41,
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
  "ownerId": "reed-bay-village-house-7",
  "kit": "laundry",
  "purpose": "세탁물을 말리는 자리",
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
  "x": 7,
  "y": 42,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "reed-bay-village-house-7",
  "kit": "laundry",
  "purpose": "빨래를 헹구는 물통",
  "anchor": "빨랫줄",
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

## 항아리
```json
{
  "name": "항아리",
  "x": 8,
  "y": 42,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "reed-bay-village-house-7",
  "kit": "laundry",
  "purpose": "세탁에 쓸 물 보관",
  "anchor": "빨랫줄",
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
      352
    ]
  ]
}
```

## 씨앗 자루
```json
{
  "name": "씨앗 자루",
  "x": 26,
  "y": 40,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "reed-bay-village-house-8",
  "kit": "field-tending",
  "purpose": "그 밭의 파종 준비",
  "anchor": "farm",
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

## 화분
```json
{
  "name": "화분",
  "x": 8,
  "y": 12,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "reed-bay-village-house-1",
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
  "x": 11,
  "y": 12,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "reed-bay-village-house-1",
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

## 화분
```json
{
  "name": "화분",
  "x": 26,
  "y": 7,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "reed-bay-village-house-2",
  "kit": "doorway",
  "purpose": "현관 옆에 둔 꽃 화분",
  "anchor": "door",
  "side": "left",
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
  "x": 47,
  "y": 16,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "reed-bay-village-house-3",
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

## 화분
```json
{
  "name": "화분",
  "x": 31,
  "y": 25,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "reed-bay-village-house-5",
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
  "x": 46,
  "y": 31,
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
  "ownerId": "reed-bay-village-house-6",
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
  "x": 9,
  "y": 42,
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
  "ownerId": "reed-bay-village-house-7",
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

## 화분
```json
{
  "name": "화분",
  "x": 30,
  "y": 40,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "reed-bay-village-house-8",
  "kit": "doorway",
  "purpose": "현관 옆에 둔 꽃 화분",
  "anchor": "door",
  "side": "left",
  "width": 1,
  "height": 2,
  "lowerTiles": [
    [
      73
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

## 벤치
```json
{
  "id": "well-plaza-1",
  "name": "벤치",
  "x": 46,
  "y": 21,
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
    "x": 46,
    "y": 22
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

## 돌등
```json
{
  "id": "well-plaza-2",
  "name": "돌등",
  "x": 41,
  "y": 22,
  "purpose": "밤에 우물가를 밝히는 돌등",
  "near": "낮은 돌 우물",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "well",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 40,
    "y": 22
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

## 나룻배
```json
{
  "name": "나룻배",
  "x": 59,
  "y": 34,
  "w": 8,
  "h": 4,
  "kind": "harbor-prop",
  "owner": "dock",
  "upper": [
    2657,
    2658,
    2659,
    2660,
    2661,
    2662,
    2663,
    2664,
    2665,
    2666,
    2667,
    2668,
    2669,
    2695,
    2696,
    2697,
    2698,
    2699,
    2703,
    2704,
    2705,
    2706,
    2707,
    2708,
    -1,
    2710,
    2711,
    2712,
    2713,
    2714,
    2715,
    2716
  ],
  "width": 8,
  "height": 4,
  "lowerTiles": [
    [
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563
    ],
    [
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563
    ],
    [
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563
    ],
    [
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563
    ]
  ],
  "upperTiles": [
    [
      2657,
      2658,
      2659,
      2660,
      2661,
      2662,
      2663,
      2664
    ],
    [
      2665,
      2666,
      2667,
      2668,
      2669,
      2695,
      2696,
      2697
    ],
    [
      2698,
      2699,
      2703,
      2704,
      2705,
      2706,
      2707,
      2708
    ],
    [
      -1,
      2710,
      2711,
      2712,
      2713,
      2714,
      2715,
      2716
    ]
  ]
}
```

## 나룻배
```json
{
  "name": "나룻배",
  "x": 59,
  "y": 42,
  "w": 8,
  "h": 4,
  "kind": "harbor-prop",
  "owner": "dock",
  "upper": [
    2657,
    2658,
    2659,
    2660,
    2661,
    2662,
    2663,
    2664,
    2665,
    2666,
    2667,
    2668,
    2669,
    2695,
    2696,
    2697,
    2698,
    2699,
    2703,
    2704,
    2705,
    2706,
    2707,
    2708,
    -1,
    2710,
    2711,
    2712,
    2713,
    2714,
    2715,
    2716
  ],
  "width": 8,
  "height": 4,
  "lowerTiles": [
    [
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563
    ],
    [
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563
    ],
    [
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563
    ],
    [
      1558,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563,
      1563
    ]
  ],
  "upperTiles": [
    [
      2657,
      2658,
      2659,
      2660,
      2661,
      2662,
      2663,
      2664
    ],
    [
      2665,
      2666,
      2667,
      2668,
      2669,
      2695,
      2696,
      2697
    ],
    [
      2698,
      2699,
      2703,
      2704,
      2705,
      2706,
      2707,
      2708
    ],
    [
      -1,
      2710,
      2711,
      2712,
      2713,
      2714,
      2715,
      2716
    ]
  ]
}
```

## 계류 말뚝
```json
{
  "name": "계류 말뚝",
  "x": 66,
  "y": 38,
  "w": 1,
  "h": 1,
  "kind": "harbor-prop",
  "owner": "dock",
  "upper": [
    2717
  ],
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      1563
    ]
  ],
  "upperTiles": [
    [
      2717
    ]
  ]
}
```

## 계류 말뚝
```json
{
  "name": "계류 말뚝",
  "x": 66,
  "y": 41,
  "w": 1,
  "h": 1,
  "kind": "harbor-prop",
  "owner": "dock",
  "upper": [
    2717
  ],
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      1563
    ]
  ],
  "upperTiles": [
    [
      2717
    ]
  ]
}
```

## 계류 말뚝
```json
{
  "name": "계류 말뚝",
  "x": 62,
  "y": 38,
  "w": 1,
  "h": 1,
  "kind": "harbor-prop",
  "owner": "dock",
  "upper": [
    2717
  ],
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      1563
    ]
  ],
  "upperTiles": [
    [
      2717
    ]
  ]
}
```
