# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 과일 상자
```json
{
  "name": "과일 상자",
  "x": 41,
  "y": 54,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "ownerId": "terrace-cliff-village-house-7",
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

## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 48,
  "y": 49,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2623,
    2624
  ],
  "ownerId": "terrace-cliff-village-house-8",
  "kit": "herbs",
  "purpose": "손질할 약초 재배",
  "anchor": "house",
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
  "x": 50,
  "y": 49,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "terrace-cliff-village-house-8",
  "kit": "herbs",
  "purpose": "다음에 심을 약초 씨앗",
  "anchor": "약초 화분",
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

## 가로 탁자
```json
{
  "name": "가로 탁자",
  "x": 48,
  "y": 51,
  "w": 3,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "ownerId": "terrace-cliff-village-house-8",
  "kit": "herbs",
  "purpose": "약초 선별·건조 작업면",
  "anchor": "약초 화분",
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

## 항아리
```json
{
  "name": "항아리",
  "x": 51,
  "y": 51,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "terrace-cliff-village-house-8",
  "kit": "herbs",
  "purpose": "손질한 약초 보관",
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
      352
    ]
  ]
}
```

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 16,
  "y": 11,
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
  "ownerId": "terrace-cliff-village-house-1",
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

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 10,
  "y": 29,
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
  "ownerId": "terrace-cliff-village-house-3",
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

## 화분
```json
{
  "name": "화분",
  "x": 28,
  "y": 31,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "terrace-cliff-village-house-4",
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

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 31,
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
  "ownerId": "terrace-cliff-village-house-4",
  "kit": "doorway",
  "purpose": "현관 옆을 밝히는 꽃 화단",
  "anchor": "door",
  "side": "right",
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
  "x": 52,
  "y": 32,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "terrace-cliff-village-house-5",
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
  "x": 12,
  "y": 52,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "terrace-cliff-village-house-6",
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
  "x": 38,
  "y": 54,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "terrace-cliff-village-house-7",
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
  "x": 53,
  "y": 51,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "terrace-cliff-village-house-8",
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
  "x": 56,
  "y": 51,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "terrace-cliff-village-house-8",
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

## 벤치
```json
{
  "id": "well-plaza-1",
  "name": "벤치",
  "x": 30,
  "y": 10,
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
    "x": 30,
    "y": 11
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
  "x": 26,
  "y": 12,
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
    "x": 25,
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
      2655
    ],
    [
      2656
    ]
  ]
}
```

## 화분
```json
{
  "id": "well-plaza-3",
  "name": "화분",
  "x": 32,
  "y": 11,
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
    "x": 31,
    "y": 11
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

## 숲 나무 · 작은 덤불
```json
{
  "name": "숲 나무 · 작은 덤불",
  "x": 45,
  "y": 44,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 6,
  "lower": [
    1073,
    1074,
    1103,
    1104
  ],
  "upper": [
    -1,
    -1,
    -1,
    -1
  ],
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      1073,
      1074
    ],
    [
      1103,
      1104
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1
    ],
    [
      -1,
      -1
    ]
  ]
}
```

## 숲 나무 · 작은 덤불
```json
{
  "name": "숲 나무 · 작은 덤불",
  "x": 43,
  "y": 45,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 6,
  "lower": [
    1073,
    1074,
    1103,
    1104
  ],
  "upper": [
    -1,
    -1,
    -1,
    -1
  ],
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      1073,
      1074
    ],
    [
      1103,
      1104
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1
    ],
    [
      -1,
      -1
    ]
  ]
}
```

## 덤불
```json
{
  "name": "덤불",
  "x": 46,
  "y": 46,
  "w": 1,
  "h": 1,
  "kind": "vegetation",
  "scene": 6,
  "lower": "KEEP",
  "upper": [
    289
  ],
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      240
    ]
  ],
  "upperTiles": [
    [
      289
    ]
  ]
}
```

## 숲 나무 · 둥근 덤불
```json
{
  "name": "숲 나무 · 둥근 덤불",
  "x": 30,
  "y": 47,
  "w": 3,
  "h": 3,
  "kind": "vegetation",
  "scene": 7,
  "lower": [
    983,
    984,
    985,
    1013,
    1014,
    1015,
    1043,
    1044,
    1045
  ],
  "upper": [
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1
  ],
  "width": 3,
  "height": 3,
  "lowerTiles": [
    [
      983,
      984,
      985
    ],
    [
      1013,
      1014,
      1015
    ],
    [
      1043,
      1044,
      1045
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1
    ]
  ]
}
```

## 숲 나무 · 작은 덤불
```json
{
  "name": "숲 나무 · 작은 덤불",
  "x": 28,
  "y": 48,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 7,
  "lower": [
    1073,
    1074,
    1103,
    1104
  ],
  "upper": [
    -1,
    -1,
    -1,
    -1
  ],
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      1073,
      1074
    ],
    [
      1103,
      1104
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1
    ],
    [
      -1,
      -1
    ]
  ]
}
```

## 바위
```json
{
  "name": "바위",
  "x": 44,
  "y": 25,
  "w": 1,
  "h": 1,
  "kind": "vegetation",
  "scene": 14,
  "lower": "KEEP",
  "upper": [
    537
  ],
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      240
    ]
  ],
  "upperTiles": [
    [
      537
    ]
  ]
}
```

## 숲 나무 · 작은 덤불
```json
{
  "name": "숲 나무 · 작은 덤불",
  "x": 42,
  "y": 25,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 14,
  "lower": [
    1073,
    1074,
    1103,
    1104
  ],
  "upper": [
    -1,
    -1,
    -1,
    -1
  ],
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      1073,
      1074
    ],
    [
      1103,
      1104
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1
    ],
    [
      -1,
      -1
    ]
  ]
}
```

## 바위
```json
{
  "name": "바위",
  "x": 44,
  "y": 26,
  "w": 1,
  "h": 1,
  "kind": "vegetation",
  "scene": 14,
  "lower": "KEEP",
  "upper": [
    537
  ],
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      240
    ]
  ],
  "upperTiles": [
    [
      537
    ]
  ]
}
```

## 숲 나무 · 작은 덤불
```json
{
  "name": "숲 나무 · 작은 덤불",
  "x": 49,
  "y": 43,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 16,
  "lower": [
    1073,
    1074,
    1103,
    1104
  ],
  "upper": [
    -1,
    -1,
    -1,
    -1
  ],
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      1073,
      1074
    ],
    [
      1103,
      1104
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1
    ],
    [
      -1,
      -1
    ]
  ]
}
```

## 숲 나무 · 작은 덤불
```json
{
  "name": "숲 나무 · 작은 덤불",
  "x": 47,
  "y": 44,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 16,
  "lower": [
    1073,
    1074,
    1103,
    1104
  ],
  "upper": [
    -1,
    -1,
    -1,
    -1
  ],
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      1073,
      1074
    ],
    [
      1103,
      1104
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1
    ],
    [
      -1,
      -1
    ]
  ]
}
```

## 덤불
```json
{
  "name": "덤불",
  "x": 50,
  "y": 45,
  "w": 1,
  "h": 1,
  "kind": "vegetation",
  "scene": 16,
  "lower": "KEEP",
  "upper": [
    289
  ],
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      240
    ]
  ],
  "upperTiles": [
    [
      289
    ]
  ]
}
```
