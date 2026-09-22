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

## 채소밭
```json
{
  "name": "채소밭",
  "x": 16,
  "y": 14,
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
  "ownerId": "reed-bay-village-house-1",
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
  "x": 16,
  "y": 12,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2651,
    2654
  ],
  "ownerId": "reed-bay-village-house-1",
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
  "x": 19,
  "y": 15,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "reed-bay-village-house-1",
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

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 59,
  "y": 19,
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
  "x": 61,
  "y": 19,
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

## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 39,
  "y": 26,
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

## 가로 탁자
```json
{
  "name": "가로 탁자",
  "x": 39,
  "y": 28,
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
  "x": 43,
  "y": 28,
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
  "x": 58,
  "y": 35,
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
  "x": 60,
  "y": 35,
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
  "x": 58,
  "y": 37,
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

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "x": 7,
  "y": 48,
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

## 항아리
```json
{
  "name": "항아리",
  "x": 10,
  "y": 49,
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

## 허수아비
```json
{
  "name": "허수아비",
  "x": 31,
  "y": 44,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2651,
    2654
  ],
  "ownerId": "reed-bay-village-house-8",
  "kit": "field-tending",
  "purpose": "기존 밭의 작물 보호",
  "anchor": "farm",
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
  "x": 31,
  "y": 47,
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

## 가로 탁자
```json
{
  "id": "market-1",
  "name": "가로 탁자",
  "x": 25,
  "y": 40,
  "purpose": "수확물을 선별하고 판매하는 작업면",
  "w": 3,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "market",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "useAt": {
    "x": 25,
    "y": 41
  },
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

## 과일 상자
```json
{
  "id": "market-3",
  "name": "과일 상자",
  "x": 28,
  "y": 40,
  "purpose": "판매대에 보충할 과일 저장",
  "near": "가로 탁자",
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
    "x": 28,
    "y": 41
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
