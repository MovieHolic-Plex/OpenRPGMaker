# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 씨앗 자루
```json
{
  "name": "씨앗 자루",
  "x": 70,
  "y": 47,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "pine-hamlets-house-6",
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
  "x": 36,
  "y": 52,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "pine-hamlets-house-7",
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
  "x": 38,
  "y": 52,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "pine-hamlets-house-7",
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

## 낮은 돌 우물
```json
{
  "id": "well-1",
  "name": "낮은 돌 우물",
  "x": 42,
  "y": 26,
  "purpose": "윗단과 아랫마을 주민이 함께 쓰는 급수",
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
    "y": 26
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
  "y": 27,
  "purpose": "길어 온 물을 담는 용기",
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
  "y": 28,
  "purpose": "우물 앞 물 튀는 땅의 발 디딤",
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
    "y": 29
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
  "x": 45,
  "y": 25,
  "purpose": "우물에 모인 주민의 마을 공지",
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
    "x": 44,
    "y": 25
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

## 돌등
```json
{
  "id": "well-5",
  "name": "돌등",
  "x": 41,
  "y": 27,
  "purpose": "우물과 연결 길목 조명",
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
    "y": 27
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
  "x": 21,
  "y": 40,
  "purpose": "집에서 정원으로 들어가는 열린 문",
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
    "x": 21,
    "y": 41
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
  "x": 18,
  "y": 41,
  "purpose": "정원 입구의 왼쪽 화단",
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
    "x": 17,
    "y": 41
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
  "x": 24,
  "y": 41,
  "purpose": "정원 입구의 오른쪽 화단",
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
    "x": 23,
    "y": 41
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
  "x": 21,
  "y": 43,
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
    "x": 21,
    "y": 44
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
  "x": 24,
  "y": 39,
  "purpose": "정원 가장자리 새 쉼터",
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
    "x": 23,
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
  "x": 18,
  "y": 44,
  "purpose": "정원 남쪽 경계의 짧은 패널",
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
    "x": 18,
    "y": 45
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
  "x": 23,
  "y": 44,
  "purpose": "열린 가운데 통로를 남긴 경계",
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
    "x": 23,
    "y": 45
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
  "id": "entry-1",
  "name": "표지판",
  "x": 37,
  "y": 58,
  "purpose": "산촌으로 들어오는 여행자 방향 안내",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "entry",
  "lower": "KEEP",
  "upper": [
    2610,
    2615
  ],
  "useAt": {
    "x": 36,
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
  "id": "entry-2",
  "name": "돌등",
  "x": 42,
  "y": 57,
  "purpose": "입구 오솔길 조명",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "entry",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 41,
    "y": 57
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

## 우편함
```json
{
  "id": "front-1",
  "name": "우편함",
  "x": 16,
  "y": 15,
  "purpose": "집 입구에서 우편 수취",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "front",
  "lower": "KEEP",
  "upper": [
    350
  ],
  "useAt": {
    "x": 16,
    "y": 16
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
  "x": 10,
  "y": 14,
  "purpose": "현관 옆 환영 식물",
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
    "x": 11,
    "y": 14
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
  "id": "lamp-3-1",
  "name": "벽걸이 등불",
  "x": 66,
  "y": 16,
  "purpose": "현관 옆 벽면 조명",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lamp-3",
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
  "x": 64,
  "y": 48,
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

## 벤치
```json
{
  "id": "overlook-1",
  "name": "벤치",
  "x": 44,
  "y": 15,
  "purpose": "절벽 끝에서 아랫마을을 내려다보며 쉬는 자리",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "overlook",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 44,
    "y": 16
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

## 벤치
```json
{
  "id": "overlook-2",
  "name": "벤치",
  "x": 33,
  "y": 15,
  "purpose": "계단을 오른 뒤 숨 돌리는 자리",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "overlook",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 33,
    "y": 16
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

## 나무 이정표
```json
{
  "id": "overlook-3",
  "name": "나무 이정표",
  "x": 38,
  "y": 14,
  "purpose": "윗마을 동서 갈림길 방향 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "overlook",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 38,
    "y": 15
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
  "id": "stair-signs-1",
  "name": "나무 이정표",
  "x": 37,
  "y": 25,
  "purpose": "가운데 계단으로 오르는 길 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "stair-signs",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 37,
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

## 나무 이정표
```json
{
  "id": "west-stair-sign-1",
  "name": "나무 이정표",
  "x": 19,
  "y": 26,
  "purpose": "서쪽 계단으로 오르는 길 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "west-stair-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 19,
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
      596
    ]
  ]
}
```

## 나무 이정표
```json
{
  "id": "east-stair-sign-1",
  "name": "나무 이정표",
  "x": 60,
  "y": 28,
  "purpose": "동쪽 계단으로 오르는 길 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "east-stair-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 60,
    "y": 29
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

## 장작 더미
```json
{
  "id": "woodyard-1",
  "name": "장작 더미",
  "x": 58,
  "y": 16,
  "purpose": "목공 작업에서 나온 장작을 쌓아 두는 자리",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "woodyard",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 58,
    "y": 17
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

## 장작 더미
```json
{
  "id": "woodyard-2",
  "name": "장작 더미",
  "x": 57,
  "y": 19,
  "purpose": "겨울용 땔감 두 번째 더미",
  "near": "장작 더미",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "woodyard",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 57,
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
      349
    ]
  ]
}
```

## 술통
```json
{
  "id": "woodyard-3",
  "name": "술통",
  "x": 70,
  "y": 16,
  "purpose": "작업용 물을 받아 두는 통",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "woodyard",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "useAt": {
    "x": 70,
    "y": 17
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
      177
    ]
  ]
}
```

## 모닥불
```json
{
  "id": "campfire-1",
  "name": "모닥불",
  "x": 11,
  "y": 38,
  "purpose": "저녁에 샘가 주민이 모이는 불자리",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "campfire",
  "lower": "KEEP",
  "upper": [
    381
  ],
  "useAt": {
    "x": 11,
    "y": 39
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

## 벤치
```json
{
  "id": "campfire-2",
  "name": "벤치",
  "x": 11,
  "y": 40,
  "purpose": "불가 남쪽 앉을 자리",
  "near": "모닥불",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "campfire",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 11,
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
      327,
      328
    ]
  ]
}
```
