# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 텃밭
```json
{
  "name": "텃밭",
  "x": 20,
  "y": 40,
  "w": 6,
  "h": 4,
  "kind": "farm",
  "lower": [
    156,
    157,
    157,
    157,
    157,
    158,
    186,
    187,
    187,
    187,
    187,
    188,
    186,
    187,
    187,
    187,
    187,
    188,
    216,
    217,
    217,
    217,
    217,
    218
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
      156,
      157,
      157,
      157,
      157,
      158
    ],
    [
      186,
      187,
      187,
      187,
      187,
      188
    ],
    [
      186,
      187,
      187,
      187,
      187,
      188
    ],
    [
      216,
      217,
      217,
      217,
      217,
      218
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
  "x": 16,
  "y": 3,
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
  "x": 53,
  "y": 21,
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

## 숲 나무 · 활엽수
```json
{
  "name": "숲 나무 · 활엽수",
  "x": 51,
  "y": 11,
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
  "x": 35,
  "y": 26,
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
  "x": 36,
  "y": 30,
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
  "x": 52,
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

## 숲 나무 · 활엽수
```json
{
  "name": "숲 나무 · 활엽수",
  "x": 2,
  "y": 38,
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
  "x": 53,
  "y": 30,
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
  "x": 56,
  "y": 20,
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

## 낮은 돌 우물
```json
{
  "id": "well-1",
  "name": "낮은 돌 우물",
  "x": 43,
  "y": 20,
  "purpose": "주택과 선착장 이용자의 급수",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "well",
  "lower": "KEEP",
  "upper": [
    2639,
    2640,
    2641,
    2642
  ],
  "useAt": {
    "x": 42,
    "y": 20
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
      2639,
      2640
    ],
    [
      2641,
      2642
    ]
  ]
}
```

## 항아리
```json
{
  "id": "well-2",
  "name": "항아리",
  "x": 45,
  "y": 22,
  "purpose": "우물물을 담는 용기",
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
    "x": 45,
    "y": 23
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

## 징검돌
```json
{
  "id": "well-3",
  "name": "징검돌",
  "x": 43,
  "y": 22,
  "purpose": "우물 앞 보행 자리",
  "near": "낮은 돌 우물",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "well",
  "lower": "KEEP",
  "upper": [
    2649,
    2650
  ],
  "useAt": {
    "x": 43,
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
      2649,
      2650
    ]
  ]
}
```

## 게시판
```json
{
  "id": "well-4",
  "name": "게시판",
  "x": 46,
  "y": 19,
  "purpose": "골목 주민의 공동 공지",
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
    "x": 45,
    "y": 19
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

## 덩굴 아치
```json
{
  "id": "garden-1",
  "name": "덩굴 아치",
  "x": 32,
  "y": 9,
  "purpose": "집 옆 정원 입구",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "garden",
  "lower": "KEEP",
  "upper": [
    2643,
    2644,
    2647,
    2648
  ],
  "useAt": {
    "x": 32,
    "y": 10
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
      2643,
      2644
    ],
    [
      2647,
      2648
    ]
  ]
}
```

## 꽃 화단
```json
{
  "id": "garden-2",
  "name": "꽃 화단",
  "x": 30,
  "y": 8,
  "purpose": "정원 입구 화단",
  "near": "덩굴 아치",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "garden",
  "lower": "KEEP",
  "upper": [
    2611,
    2612,
    2616,
    2617
  ],
  "useAt": {
    "x": 29,
    "y": 8
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

## 꽃 화단
```json
{
  "id": "garden-3",
  "name": "꽃 화단",
  "x": 34,
  "y": 8,
  "purpose": "정원 입구 화단",
  "near": "덩굴 아치",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "garden",
  "lower": "KEEP",
  "upper": [
    2611,
    2612,
    2616,
    2617
  ],
  "useAt": {
    "x": 33,
    "y": 8
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

## 징검돌
```json
{
  "id": "garden-4",
  "name": "징검돌",
  "x": 32,
  "y": 11,
  "purpose": "정원 안 보행 자리",
  "near": "덩굴 아치",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "garden",
  "lower": "KEEP",
  "upper": [
    2649,
    2650
  ],
  "useAt": {
    "x": 33,
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
      2649,
      2650
    ]
  ]
}
```

## 새집
```json
{
  "id": "garden-5",
  "name": "새집",
  "x": 34,
  "y": 6,
  "purpose": "정원의 조용한 가장자리",
  "near": "꽃 화단",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "garden",
  "lower": "KEEP",
  "upper": [
    2622,
    2627
  ],
  "useAt": {
    "x": 33,
    "y": 6
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
      2622
    ],
    [
      2627
    ]
  ]
}
```

## 나무 울타리
```json
{
  "id": "garden-6",
  "name": "나무 울타리",
  "x": 30,
  "y": 11,
  "purpose": "정원 남쪽 경계",
  "near": "꽃 화단",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "garden",
  "lower": "KEEP",
  "upper": [
    2636,
    2637
  ],
  "useAt": {
    "x": 29,
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
      2636,
      2637
    ]
  ]
}
```

## 나무 울타리
```json
{
  "id": "garden-7",
  "name": "나무 울타리",
  "x": 34,
  "y": 11,
  "purpose": "열린 보행 틈을 남긴 정원 경계",
  "near": "꽃 화단",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "garden",
  "lower": "KEEP",
  "upper": [
    2636,
    2637
  ],
  "useAt": {
    "x": 33,
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
      2636,
      2637
    ]
  ]
}
```

## 우편함
```json
{
  "id": "front-2",
  "name": "우편함",
  "x": 42,
  "y": 31,
  "purpose": "여관 투숙객 우편 수취",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "front",
  "lower": "KEEP",
  "upper": [
    350
  ],
  "useAt": {
    "x": 42,
    "y": 32
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
      350
    ]
  ]
}
```

## 벽걸이 등불
```json
{
  "id": "lamp-2-1",
  "name": "벽걸이 등불",
  "x": 30,
  "y": 6,
  "purpose": "현관 옆 벽면 조명",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lamp-2",
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
  "x": 46,
  "y": 30,
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

## 벽걸이 등불
```json
{
  "id": "lamp-8-1",
  "name": "벽걸이 등불",
  "x": 33,
  "y": 39,
  "purpose": "현관 옆 벽면 조명",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lamp-8",
  "lower": "KEEP",
  "upper": [
    2645
  ],
  "width": 1,
  "height": 1,
  "lowerTiles": [
    [
      43
    ]
  ],
  "upperTiles": [
    [
      2645
    ]
  ]
}
```

## 낚시 바구니
```json
{
  "id": "dock-store-4",
  "name": "낚시 바구니",
  "x": 48,
  "y": 42,
  "purpose": "선착장 끝에서 쓰는 낚시 바구니",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "dock-store",
  "lower": "KEEP",
  "upper": [
    2646
  ],
  "useAt": {
    "x": 48,
    "y": 43
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

## 나무 이정표
```json
{
  "id": "east-stair-sign-1",
  "name": "나무 이정표",
  "x": 23,
  "y": 19,
  "purpose": "윗단 파랑 지붕 집으로 오르는 계단 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "east-stair-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 23,
    "y": 20
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
  "id": "entry-sign-1",
  "name": "나무 이정표",
  "x": 4,
  "y": 25,
  "purpose": "마을 서쪽 입구 방향 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "entry-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 4,
    "y": 26
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

## 모닥불
```json
{
  "id": "beach-fire-1",
  "name": "모닥불",
  "x": 17,
  "y": 44,
  "purpose": "물가에서 저녁에 불을 피우는 자리",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "beach-fire",
  "lower": "KEEP",
  "upper": [
    381
  ],
  "useAt": {
    "x": 17,
    "y": 45
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

## 장작 더미
```json
{
  "id": "beach-fire-3",
  "name": "장작 더미",
  "x": 18,
  "y": 43,
  "purpose": "모닥불 장작",
  "near": "모닥불",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "beach-fire",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 18,
    "y": 44
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

## 채소밭
```json
{
  "name": "채소밭",
  "x": 13,
  "y": 11,
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
  "x": 13,
  "y": 9,
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
