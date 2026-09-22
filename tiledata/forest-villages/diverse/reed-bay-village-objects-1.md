# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 텃밭
```json
{
  "name": "텃밭",
  "x": 25,
  "y": 47,
  "w": 6,
  "h": 4,
  "kind": "farm",
  "lower": [
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188,
    188
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
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
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
  "width": 6,
  "height": 4,
  "lowerTiles": [
    [
      188,
      188,
      188,
      188,
      188,
      188
    ],
    [
      188,
      188,
      188,
      188,
      188,
      188
    ],
    [
      188,
      188,
      188,
      188,
      188,
      188
    ],
    [
      188,
      188,
      188,
      188,
      188,
      188
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
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
  "x": 19,
  "y": 6,
  "w": 3,
  "h": 4,
  "kind": "vegetation",
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

## 숲 나무 · 둥근 덤불
```json
{
  "name": "숲 나무 · 둥근 덤불",
  "x": 63,
  "y": 27,
  "w": 3,
  "h": 3,
  "kind": "vegetation",
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
  "x": 52,
  "y": 47,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
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

## 숲 나무 · 활엽수
```json
{
  "name": "숲 나무 · 활엽수",
  "x": 60,
  "y": 14,
  "w": 3,
  "h": 4,
  "kind": "vegetation",
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

## 숲 나무 · 둥근 덤불
```json
{
  "name": "숲 나무 · 둥근 덤불",
  "x": 42,
  "y": 32,
  "w": 3,
  "h": 3,
  "kind": "vegetation",
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
  "x": 44,
  "y": 36,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
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

## 숲 나무 · 활엽수
```json
{
  "name": "숲 나무 · 활엽수",
  "x": 62,
  "y": 32,
  "w": 3,
  "h": 4,
  "kind": "vegetation",
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

## 숲 나무 · 둥근 덤불
```json
{
  "name": "숲 나무 · 둥근 덤불",
  "x": 26,
  "y": 43,
  "w": 3,
  "h": 3,
  "kind": "vegetation",
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
  "x": 8,
  "y": 26,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
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

## 숲 나무 · 활엽수
```json
{
  "name": "숲 나무 · 활엽수",
  "x": 4,
  "y": 45,
  "w": 3,
  "h": 4,
  "kind": "vegetation",
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
  "x": 63,
  "y": 42,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
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

## 숲 나무 · 활엽수
```json
{
  "name": "숲 나무 · 활엽수",
  "x": 63,
  "y": 36,
  "w": 3,
  "h": 4,
  "kind": "vegetation",
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

## 숲 나무 · 둥근 덤불
```json
{
  "name": "숲 나무 · 둥근 덤불",
  "x": 3,
  "y": 27,
  "w": 3,
  "h": 3,
  "kind": "vegetation",
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
  "x": 6,
  "y": 27,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
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

## 숲 나무 · 활엽수
```json
{
  "name": "숲 나무 · 활엽수",
  "x": 66,
  "y": 26,
  "w": 3,
  "h": 4,
  "kind": "vegetation",
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
  "x": 28,
  "y": 36,
  "w": 2,
  "h": 2,
  "kind": "vegetation",
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

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 16,
  "y": 10,
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
  "ownerId": "reed-bay-village-house-1",
  "kit": "home",
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

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "x": 16,
  "y": 13,
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
  "ownerId": "reed-bay-village-house-1",
  "kit": "home",
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

## 항아리
```json
{
  "name": "항아리",
  "x": 19,
  "y": 13,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "reed-bay-village-house-1",
  "kit": "home",
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

## 허수아비
```json
{
  "name": "허수아비",
  "x": 28,
  "y": 7,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2651,
    2654
  ],
  "ownerId": "reed-bay-village-house-2",
  "kit": "garden",
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

## 채소밭
```json
{
  "name": "채소밭",
  "x": 28,
  "y": 9,
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
  "ownerId": "reed-bay-village-house-2",
  "kit": "garden",
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

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 46,
  "y": 15,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "reed-bay-village-house-3",
  "kit": "work",
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
  "y": 15,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "reed-bay-village-house-3",
  "kit": "work",
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

## 장작
```json
{
  "name": "장작",
  "x": 50,
  "y": 15,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "ownerId": "reed-bay-village-house-3",
  "kit": "work",
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

## 가로 탁자
```json
{
  "name": "가로 탁자",
  "x": 46,
  "y": 17,
  "w": 3,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "ownerId": "reed-bay-village-house-3",
  "kit": "work",
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

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 19,
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
  "ownerId": "reed-bay-village-house-4",
  "kit": "herbs",
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

## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 19,
  "y": 34,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2623,
    2624
  ],
  "ownerId": "reed-bay-village-house-4",
  "kit": "herbs",
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

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 39,
  "y": 24,
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
  "ownerId": "reed-bay-village-house-5",
  "kit": "home",
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

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "x": 39,
  "y": 27,
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
  "ownerId": "reed-bay-village-house-5",
  "kit": "home",
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

## 항아리
```json
{
  "name": "항아리",
  "x": 42,
  "y": 27,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "reed-bay-village-house-5",
  "kit": "home",
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

## 허수아비
```json
{
  "name": "허수아비",
  "x": 58,
  "y": 34,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2651,
    2654
  ],
  "ownerId": "reed-bay-village-house-6",
  "kit": "garden",
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
