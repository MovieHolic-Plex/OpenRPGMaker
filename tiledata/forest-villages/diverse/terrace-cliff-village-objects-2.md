# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 장작
```json
{
  "name": "장작",
  "x": 46,
  "y": 36,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "ownerId": "terrace-cliff-village-house-4",
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
  "x": 48,
  "y": 36,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "terrace-cliff-village-house-4",
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

## 채소밭
```json
{
  "name": "채소밭",
  "x": 70,
  "y": 41,
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
  "ownerId": "terrace-cliff-village-house-5",
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
  "x": 70,
  "y": 39,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2651,
    2654
  ],
  "ownerId": "terrace-cliff-village-house-5",
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
  "x": 73,
  "y": 42,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "terrace-cliff-village-house-5",
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
  "x": 53,
  "y": 65,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "terrace-cliff-village-house-7",
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
  "x": 55,
  "y": 65,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "terrace-cliff-village-house-7",
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
  "x": 64,
  "y": 60,
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

## 가로 탁자
```json
{
  "name": "가로 탁자",
  "x": 64,
  "y": 62,
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
  "x": 68,
  "y": 62,
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

## 낮은 돌 우물
```json
{
  "id": "well-1",
  "name": "낮은 돌 우물",
  "x": 44,
  "y": 16,
  "purpose": "상단 주택에서 계단을 내려가지 않고 물 긷기",
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
    "x": 43,
    "y": 16
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
  "x": 47,
  "y": 17,
  "purpose": "물을 담아 집으로 옮기는 용기",
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
    "x": 47,
    "y": 18
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
  "x": 44,
  "y": 18,
  "purpose": "급수 작업 발 디딤",
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
    "x": 44,
    "y": 19
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

## 꽃 화단
```json
{
  "id": "well-4",
  "name": "꽃 화단",
  "x": 44,
  "y": 13,
  "purpose": "주민이 가꾸는 우물터 화단",
  "near": "낮은 돌 우물",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "well",
  "lower": "KEEP",
  "upper": [
    2611,
    2612,
    2616,
    2617
  ],
  "useAt": {
    "x": 44,
    "y": 12
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

## 게시판
```json
{
  "id": "stairs-1",
  "name": "게시판",
  "x": 30,
  "y": 31,
  "purpose": "층별 생활권과 공동 작업 공지",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "stairs",
  "lower": "KEEP",
  "upper": [
    2630,
    2631,
    2633,
    2634
  ],
  "useAt": {
    "x": 29,
    "y": 31
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

## 표지판
```json
{
  "id": "stairs-2",
  "name": "표지판",
  "x": 36,
  "y": 31,
  "purpose": "상단 주거지와 하단 출구 방향",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "stairs",
  "lower": "KEEP",
  "upper": [
    2610,
    2615
  ],
  "useAt": {
    "x": 35,
    "y": 31
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
      2610
    ],
    [
      2615
    ]
  ]
}
```

## 돌등
```json
{
  "id": "stairs-3",
  "name": "돌등",
  "x": 32,
  "y": 31,
  "purpose": "계단 하단 야간 조명",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "stairs",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 33,
    "y": 31
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

## 덩굴 아치
```json
{
  "id": "garden-1",
  "name": "덩굴 아치",
  "x": 33,
  "y": 56,
  "purpose": "집에서 꽃마당으로 들어가는 문",
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
    "x": 33,
    "y": 57
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
  "y": 56,
  "purpose": "마당 입구 화단",
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

## 꽃 화단
```json
{
  "id": "garden-3",
  "name": "꽃 화단",
  "x": 36,
  "y": 56,
  "purpose": "마당 입구 화단",
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
    "x": 35,
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

## 징검돌
```json
{
  "id": "garden-4",
  "name": "징검돌",
  "x": 33,
  "y": 58,
  "purpose": "꽃마당의 보행 자리",
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
  "x": 36,
  "y": 58,
  "purpose": "정원의 조용한 새 쉼터",
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
    "x": 35,
    "y": 58
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
  "x": 36,
  "y": 60,
  "purpose": "통로를 가리지 않는 정원 경계",
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
    "x": 36,
    "y": 61
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
  "id": "front-1",
  "name": "우편함",
  "x": 24,
  "y": 62,
  "purpose": "길에서 접근하는 우편 수취",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "front",
  "lower": "KEEP",
  "upper": [
    350
  ],
  "useAt": {
    "x": 24,
    "y": 63
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

## 화분
```json
{
  "id": "front-2",
  "name": "화분",
  "x": 17,
  "y": 60,
  "purpose": "집 앞을 가꾸는 화분",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "front",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "useAt": {
    "x": 16,
    "y": 60
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

## 벽걸이 등불
```json
{
  "id": "lamp-2-1",
  "name": "벽걸이 등불",
  "x": 54,
  "y": 18,
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

## 벽걸이 등불
```json
{
  "id": "lamp-4-1",
  "name": "벽걸이 등불",
  "x": 42,
  "y": 37,
  "purpose": "현관 옆 벽면 조명",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lamp-4",
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
  "id": "lamp-7-1",
  "name": "벽걸이 등불",
  "x": 50,
  "y": 64,
  "purpose": "현관 옆 벽면 조명",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lamp-7",
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
