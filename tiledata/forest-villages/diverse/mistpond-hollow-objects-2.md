# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 39,
  "y": 47,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2623,
    2624
  ],
  "ownerId": "mistpond-hollow-house-7",
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
  "x": 41,
  "y": 47,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "mistpond-hollow-house-7",
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
  "x": 39,
  "y": 49,
  "w": 3,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "ownerId": "mistpond-hollow-house-7",
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
  "x": 42,
  "y": 49,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "mistpond-hollow-house-7",
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

## 화분
```json
{
  "name": "화분",
  "x": 38,
  "y": 49,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "mistpond-hollow-house-7",
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

## 돌등
```json
{
  "id": "dead-well-plaza-1",
  "name": "돌등",
  "x": 30,
  "y": 41,
  "purpose": "밤에 우물가를 밝히는 돌등",
  "near": "낮은 돌 우물",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "dead-well",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 29,
    "y": 41
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

## 바위
```json
{
  "name": "바위",
  "x": 56,
  "y": 21,
  "w": 1,
  "h": 1,
  "kind": "vegetation",
  "scene": 9,
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
  "x": 54,
  "y": 21,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
  "scene": 9,
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
  "x": 56,
  "y": 22,
  "w": 1,
  "h": 1,
  "kind": "vegetation",
  "scene": 9,
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
  "x": 14,
  "y": 39,
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

## 숲 나무 · 작은 덤불
```json
{
  "name": "숲 나무 · 작은 덤불",
  "x": 12,
  "y": 40,
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

## 덤불
```json
{
  "name": "덤불",
  "x": 15,
  "y": 41,
  "w": 1,
  "h": 1,
  "kind": "vegetation",
  "scene": 14,
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
  "x": 13,
  "y": 31,
  "w": 3,
  "h": 3,
  "kind": "vegetation",
  "scene": 15,
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
