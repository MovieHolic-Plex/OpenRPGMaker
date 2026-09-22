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

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 19,
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

## 화분
```json
{
  "name": "화분",
  "x": 18,
  "y": 9,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
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

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "x": 7,
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
  "width": 2,
  "height": 2,
  "lowerTiles": [
    [
      240,
      240
    ],
    [
      240,
      2692
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

## 새집
```json
{
  "name": "새집",
  "x": 17,
  "y": 11,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2622,
    2627
  ],
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

## 우편함
```json
{
  "name": "우편함",
  "x": 7,
  "y": 9,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    350
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
      350
    ]
  ]
}
```

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "x": 18,
  "y": 12,
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

## 화분
```json
{
  "name": "화분",
  "x": 15,
  "y": 20,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
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

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "x": 7,
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

## 채소밭
```json
{
  "name": "채소밭",
  "x": 41,
  "y": 8,
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
  "x": 42,
  "y": 11,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2651,
    2654
  ],
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
  "x": 43,
  "y": 6,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
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

## 과일 바구니
```json
{
  "name": "과일 바구니",
  "x": 27,
  "y": 8,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2628,
    2629
  ],
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
      2628,
      2629
    ]
  ]
}
```

## 나무 울타리
```json
{
  "name": "나무 울타리",
  "x": 26,
  "y": 5,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2636,
    2637
  ],
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

## 채소밭
```json
{
  "name": "채소밭",
  "x": 41,
  "y": 5,
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
  "x": 41,
  "y": 10,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2651,
    2654
  ],
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
  "x": 39,
  "y": 13,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
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

## 과일 바구니
```json
{
  "name": "과일 바구니",
  "x": 27,
  "y": 12,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2628,
    2629
  ],
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
      2628,
      2629
    ]
  ]
}
```

## 장작
```json
{
  "name": "장작",
  "x": 60,
  "y": 23,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    349
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
      349
    ]
  ]
}
```

## 나무통
```json
{
  "name": "나무통",
  "x": 57,
  "y": 25,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
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
      2638
    ]
  ]
}
```

## 과일 상자
```json
{
  "name": "과일 상자",
  "x": 59,
  "y": 24,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
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

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 60,
  "y": 18,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
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
      237
    ]
  ]
}
```

## 가로 탁자
```json
{
  "name": "가로 탁자",
  "x": 62,
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
  "x": 49,
  "y": 14,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    349
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
      349
    ]
  ]
}
```

## 나무통
```json
{
  "name": "나무통",
  "x": 62,
  "y": 22,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
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
      2638
    ]
  ]
}
```

## 과일 상자
```json
{
  "name": "과일 상자",
  "x": 59,
  "y": 26,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
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

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 52,
  "y": 25,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
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
      237
    ]
  ]
}
```

## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 8,
  "y": 42,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2623,
    2624
  ],
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

## 덩굴 아치
```json
{
  "name": "덩굴 아치",
  "x": 22,
  "y": 42,
  "w": 2,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2643,
    2644,
    2647,
    2648
  ],
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

## 돌등
```json
{
  "name": "돌등",
  "x": 22,
  "y": 44,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
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

## 항아리
```json
{
  "name": "항아리",
  "x": 22,
  "y": 41,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
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
      352
    ]
  ]
}
```

## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 7,
  "y": 45,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2623,
    2624
  ],
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
