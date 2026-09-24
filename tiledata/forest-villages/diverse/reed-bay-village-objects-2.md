# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 돌등
```json
{
  "id": "dock-2",
  "name": "돌등",
  "x": 52,
  "y": 37,
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
    "x": 51,
    "y": 37
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
  "x": 48,
  "y": 33,
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
    "x": 47,
    "y": 33
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

## 술통
```json
{
  "id": "dock-store-1",
  "name": "술통",
  "x": 46,
  "y": 36,
  "purpose": "배에서 내린 물통",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "dock-store",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "useAt": {
    "x": 46,
    "y": 37
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

## 술통
```json
{
  "id": "dock-store-2",
  "name": "술통",
  "x": 47,
  "y": 36,
  "purpose": "절인 생선을 담은 통",
  "near": "술통",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "dock-store",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "useAt": {
    "x": 47,
    "y": 37
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

## 나무 상자
```json
{
  "id": "dock-store-3",
  "name": "나무 상자",
  "x": 43,
  "y": 38,
  "purpose": "배로 들여온 짐 상자",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "dock-store",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "useAt": {
    "x": 43,
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
      237
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

## 장터 노점
```json
{
  "id": "market-stall-1",
  "name": "장터 노점",
  "x": 25,
  "y": 33,
  "purpose": "밭에서 거둔 채소를 파는 좌판",
  "w": 3,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "market-stall",
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
    "x": 25,
    "y": 32
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

## 작은 오크통
```json
{
  "id": "market-stall-2",
  "name": "작은 오크통",
  "x": 24,
  "y": 36,
  "purpose": "노점 음료 통",
  "near": "장터 노점",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "market-stall",
  "lower": "KEEP",
  "upper": [
    207
  ],
  "useAt": {
    "x": 24,
    "y": 37
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

## 나무 이정표
```json
{
  "id": "west-stair-sign-1",
  "name": "나무 이정표",
  "x": 13,
  "y": 21,
  "purpose": "윗단 서쪽 집으로 오르는 계단 안내",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "west-stair-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 13,
    "y": 22
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

## 벤치
```json
{
  "id": "beach-fire-2",
  "name": "벤치",
  "x": 14,
  "y": 45,
  "purpose": "물가를 보고 앉는 자리",
  "near": "모닥불",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "beach-fire",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 14,
    "y": 46
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

## 벤치
```json
{
  "id": "overlook-1",
  "name": "벤치",
  "x": 18,
  "y": 13,
  "purpose": "절벽 끝에서 포구를 내려다보는 자리",
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
    "x": 18,
    "y": 14
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

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 39,
  "y": 14,
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
  "x": 41,
  "y": 14,
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

## 작은 오크통
```json
{
  "name": "작은 오크통",
  "x": 42,
  "y": 14,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    207
  ],
  "ownerId": "reed-bay-village-house-3",
  "kit": "storage",
  "purpose": "기름·식초 같은 작은 통 물자",
  "anchor": "나무통",
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
      207
    ]
  ]
}
```

## 과일 상자
```json
{
  "name": "과일 상자",
  "x": 39,
  "y": 16,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "ownerId": "reed-bay-village-house-3",
  "kit": "storage",
  "purpose": "나를 수확물 상자",
  "anchor": "나무 상자",
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
      202,
      203
    ]
  ]
}
```

## 술통
```json
{
  "name": "술통",
  "x": 42,
  "y": 16,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "ownerId": "reed-bay-village-house-3",
  "kit": "storage",
  "purpose": "창고에 둔 술",
  "anchor": "나무통",
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
      177
    ]
  ]
}
```

## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 33,
  "y": 23,
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

## 씨앗 자루
```json
{
  "name": "씨앗 자루",
  "x": 35,
  "y": 23,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "reed-bay-village-house-5",
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
  "x": 33,
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
  "x": 36,
  "y": 25,
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
  "x": 48,
  "y": 29,
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
  "x": 50,
  "y": 29,
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
