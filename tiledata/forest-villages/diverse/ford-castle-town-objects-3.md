# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 화분
```json
{
  "name": "화분",
  "x": 44,
  "y": 81,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "ford-castle-town-house-9",
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
  "x": 51,
  "y": 82,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "ford-castle-town-house-10",
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

## 벤치
```json
{
  "id": "mid-market-plaza-1",
  "name": "벤치",
  "x": 38,
  "y": 57,
  "purpose": "우물가에 앉아 쉬는 자리",
  "near": "낮은 돌 우물",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "mid-market",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 38,
    "y": 58
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

## 꽃 화단
```json
{
  "id": "mid-market-plaza-2",
  "name": "꽃 화단",
  "x": 43,
  "y": 56,
  "purpose": "마을 한가운데를 꾸미는 화단",
  "near": "낮은 돌 우물",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "mid-market",
  "lower": "KEEP",
  "upper": [
    2611,
    2612,
    2616,
    2617
  ],
  "useAt": {
    "x": 42,
    "y": 56
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

## 벤치
```json
{
  "id": "mid-market-plaza-3",
  "name": "벤치",
  "x": 40,
  "y": 58,
  "purpose": "우물가에 앉아 쉬는 자리",
  "near": "낮은 돌 우물",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "mid-market",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 40,
    "y": 59
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

## 숲 나무 · 작은 덤불
```json
{
  "name": "숲 나무 · 작은 덤불",
  "x": 64,
  "y": 14,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "clump": 1,
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

## 숲 나무 · 둥근 덤불
```json
{
  "name": "숲 나무 · 둥근 덤불",
  "x": 61,
  "y": 13,
  "w": 3,
  "h": 3,
  "kind": "vegetation",
  "clump": 1,
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
  "x": 13,
  "y": 20,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 1,
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
  "x": 11,
  "y": 21,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 1,
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
  "x": 14,
  "y": 22,
  "w": 1,
  "h": 1,
  "kind": "vegetation",
  "scene": 1,
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

## 숲 나무 · 활엽수
```json
{
  "name": "숲 나무 · 활엽수",
  "x": 42,
  "y": 49,
  "w": 3,
  "h": 4,
  "kind": "vegetation",
  "scene": 3,
  "lower": [
    240,
    240,
    240,
    240,
    240,
    240,
    1038,
    1039,
    1040,
    1068,
    1069,
    1070
  ],
  "upper": [
    978,
    979,
    980,
    1008,
    1009,
    1010,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1
  ],
  "width": 3,
  "height": 4,
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
    ],
    [
      1038,
      1039,
      1040
    ],
    [
      1068,
      1069,
      1070
    ]
  ],
  "upperTiles": [
    [
      978,
      979,
      980
    ],
    [
      1008,
      1009,
      1010
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

## 숲 나무 · 활엽수
```json
{
  "name": "숲 나무 · 활엽수",
  "x": 39,
  "y": 48,
  "w": 3,
  "h": 4,
  "kind": "vegetation",
  "scene": 3,
  "lower": [
    240,
    240,
    240,
    240,
    240,
    240,
    1038,
    1039,
    1040,
    1068,
    1069,
    1070
  ],
  "upper": [
    978,
    979,
    980,
    1008,
    1009,
    1010,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1
  ],
  "width": 3,
  "height": 4,
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
    ],
    [
      1038,
      1039,
      1040
    ],
    [
      1068,
      1069,
      1070
    ]
  ],
  "upperTiles": [
    [
      978,
      979,
      980
    ],
    [
      1008,
      1009,
      1010
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
  "x": 42,
  "y": 53,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 3,
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
  "x": 10,
  "y": 51,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 17,
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
  "x": 12,
  "y": 52,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 17,
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
  "x": 10,
  "y": 53,
  "w": 1,
  "h": 1,
  "kind": "vegetation",
  "scene": 17,
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

## 바위
```json
{
  "name": "바위",
  "x": 25,
  "y": 49,
  "w": 1,
  "h": 1,
  "kind": "vegetation",
  "scene": 26,
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
  "x": 26,
  "y": 49,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 26,
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
  "x": 25,
  "y": 50,
  "w": 1,
  "h": 1,
  "kind": "vegetation",
  "scene": 26,
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
