# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
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

## 과일 바구니
```json
{
  "id": "market-2",
  "name": "과일 바구니",
  "x": 25,
  "y": 38,
  "purpose": "소량 판매용 과일 진열",
  "near": "가로 탁자",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "market",
  "lower": "KEEP",
  "upper": [
    2628,
    2629
  ],
  "useAt": {
    "x": 25,
    "y": 39
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
      2628,
      2629
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

## 게시판
```json
{
  "id": "market-4",
  "name": "게시판",
  "x": 23,
  "y": 38,
  "purpose": "판매 자리와 마을 소식 안내",
  "w": 2,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "market",
  "lower": "KEEP",
  "upper": [
    2630,
    2631,
    2633,
    2634
  ],
  "useAt": {
    "x": 22,
    "y": 38
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

## 징검돌
```json
{
  "id": "market-5",
  "name": "징검돌",
  "x": 25,
  "y": 42,
  "purpose": "판매자와 손님이 서는 자리",
  "near": "가로 탁자",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "market",
  "lower": "KEEP",
  "upper": [
    2649,
    2650
  ],
  "useAt": {
    "x": 25,
    "y": 43
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

## 나무 울타리
```json
{
  "id": "market-6",
  "name": "나무 울타리",
  "x": 25,
  "y": 46,
  "purpose": "밭 북쪽 경계 보호",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "market",
  "lower": "KEEP",
  "upper": [
    2636,
    2637
  ],
  "useAt": {
    "x": 25,
    "y": 47
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

## 낮은 돌 우물
```json
{
  "id": "well-1",
  "name": "낮은 돌 우물",
  "x": 42,
  "y": 24,
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
    "x": 41,
    "y": 24
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
  "x": 44,
  "y": 26,
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
    "x": 44,
    "y": 27
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
  "x": 42,
  "y": 27,
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
    "x": 42,
    "y": 28
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
  "x": 41,
  "y": 22,
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
    "x": 40,
    "y": 22
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
  "x": 43,
  "y": 12,
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
    "x": 43,
    "y": 13
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
  "x": 40,
  "y": 12,
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
    "x": 39,
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

## 꽃 화단
```json
{
  "id": "garden-3",
  "name": "꽃 화단",
  "x": 46,
  "y": 12,
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
    "x": 45,
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

## 징검돌
```json
{
  "id": "garden-4",
  "name": "징검돌",
  "x": 43,
  "y": 14,
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
    "x": 43,
    "y": 15
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
  "x": 49,
  "y": 13,
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
    "x": 48,
    "y": 13
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
  "x": 40,
  "y": 16,
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
    "x": 40,
    "y": 17
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
  "x": 46,
  "y": 16,
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
    "x": 46,
    "y": 17
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

## 표지판
```json
{
  "id": "dock-1",
  "name": "표지판",
  "x": 60,
  "y": 42,
  "purpose": "선착장 이용 방향 안내",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "dock",
  "lower": "KEEP",
  "upper": [
    2610,
    2615
  ],
  "useAt": {
    "x": 59,
    "y": 42
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
  "id": "dock-2",
  "name": "돌등",
  "x": 62,
  "y": 43,
  "purpose": "선착장 진입부 조명",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "dock",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 61,
    "y": 43
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
  "id": "front-1",
  "name": "화분",
  "x": 58,
  "y": 39,
  "purpose": "여관 현관 옆 환영 식물",
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
    "x": 57,
    "y": 39
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

## 우편함
```json
{
  "id": "front-2",
  "name": "우편함",
  "x": 51,
  "y": 37,
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
    "x": 51,
    "y": 38
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
  "x": 36,
  "y": 9,
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
  "x": 55,
  "y": 36,
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
  "x": 39,
  "y": 46,
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
