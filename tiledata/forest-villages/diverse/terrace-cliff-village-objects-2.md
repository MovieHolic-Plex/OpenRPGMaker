# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 낮은 돌 우물
```json
{
  "id": "well-1",
  "name": "낮은 돌 우물",
  "x": 39,
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
    "x": 38,
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
  "x": 41,
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
    "x": 41,
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
  "x": 39,
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
    "x": 39,
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
  "x": 38,
  "y": 14,
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
    "x": 37,
    "y": 14
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
  "x": 31,
  "y": 29,
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
    "x": 30,
    "y": 29
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
  "x": 33,
  "y": 30,
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
    "x": 34,
    "y": 30
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

## 벤치
```json
{
  "id": "overlook-1",
  "name": "벤치",
  "x": 47,
  "y": 17,
  "purpose": "가운데 단과 아랫단을 내려다보는 자리",
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
      327,
      328
    ]
  ]
}
```

## 나무 이정표
```json
{
  "id": "overlook-2",
  "name": "나무 이정표",
  "x": 42,
  "y": 19,
  "purpose": "서쪽 계단으로 내려가는 길 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "overlook",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 42,
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
  "id": "overlook-3",
  "name": "나무 이정표",
  "x": 59,
  "y": 19,
  "purpose": "동쪽 계단으로 내려가는 길 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "overlook",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 59,
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
  "id": "mid-east-sign-1",
  "name": "나무 이정표",
  "x": 64,
  "y": 29,
  "purpose": "윗단으로 오르는 동쪽 계단 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "mid-east-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 64,
    "y": 30
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
  "id": "lower-signs-1",
  "name": "나무 이정표",
  "x": 24,
  "y": 53,
  "purpose": "가운데 단으로 오르는 서쪽 계단 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lower-signs",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 24,
    "y": 54
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
  "id": "lower-east-sign-1",
  "name": "나무 이정표",
  "x": 48,
  "y": 53,
  "purpose": "가운데 단으로 오르는 동쪽 계단 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "lower-east-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 48,
    "y": 54
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
  "id": "cave-camp-1",
  "name": "모닥불",
  "x": 74,
  "y": 53,
  "purpose": "저녁에 동쪽 집 주민이 모이는 불",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "cave-camp",
  "lower": "KEEP",
  "upper": [
    381
  ],
  "useAt": {
    "x": 74,
    "y": 54
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
  "id": "cave-camp-2",
  "name": "벤치",
  "x": 73,
  "y": 55,
  "purpose": "불가에 앉는 자리",
  "near": "모닥불",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "cave-camp",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 72,
    "y": 55
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

## 나무 상자
```json
{
  "id": "cave-camp-3",
  "name": "나무 상자",
  "x": 67,
  "y": 53,
  "purpose": "땔감과 불쏘시개를 담는 상자",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "cave-camp",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "useAt": {
    "x": 67,
    "y": 54
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
      237
    ]
  ]
}
```

## 술통
```json
{
  "id": "cave-camp-4",
  "name": "술통",
  "x": 65,
  "y": 54,
  "purpose": "불 곁에 두는 물통",
  "near": "나무 상자",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "cave-camp",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "useAt": {
    "x": 65,
    "y": 55
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

## 장터 노점
```json
{
  "id": "mid-market-1",
  "name": "장터 노점",
  "x": 29,
  "y": 39,
  "purpose": "세 단 주민이 모두 들르는 가운데 단 좌판",
  "w": 3,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "mid-market",
  "lower": "KEEP",
  "upper": [
    468,
    469,
    470,
    234,
    235,
    236
  ],
  "useAt": {
    "x": 28,
    "y": 39
  },
  "width": 3,
  "height": 2,
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
    ]
  ],
  "upperTiles": [
    [
      468,
      469,
      470
    ],
    [
      234,
      235,
      236
    ]
  ]
}
```

## 과일 좌판
```json
{
  "id": "mid-market-2",
  "name": "과일 좌판",
  "x": 29,
  "y": 42,
  "purpose": "윗단 과수에서 딴 과일",
  "near": "장터 노점",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "mid-market",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "useAt": {
    "x": 29,
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
      202,
      203
    ]
  ]
}
```

## 작은 오크통
```json
{
  "id": "mid-market-3",
  "name": "작은 오크통",
  "x": 32,
  "y": 37,
  "purpose": "노점 음료를 담는 통",
  "near": "장터 노점",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "mid-market",
  "lower": "KEEP",
  "upper": [
    207
  ],
  "useAt": {
    "x": 32,
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
      207
    ]
  ]
}
```

## 벤치
```json
{
  "id": "mid-market-4",
  "name": "벤치",
  "x": 32,
  "y": 42,
  "purpose": "장 보러 온 사람의 쉼 자리",
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
    "x": 32,
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
      327,
      328
    ]
  ]
}
```
