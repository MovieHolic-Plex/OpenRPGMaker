# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 벤치
```json
{
  "id": "overlook-1",
  "name": "벤치",
  "x": 36,
  "y": 15,
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
    "x": 35,
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
  "x": 31,
  "y": 17,
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
    "x": 31,
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
  "x": 48,
  "y": 17,
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
    "x": 48,
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
  "x": 52,
  "y": 26,
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
    "x": 52,
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
  "id": "lower-signs-1",
  "name": "나무 이정표",
  "x": 16,
  "y": 46,
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
    "x": 16,
    "y": 47
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
  "x": 37,
  "y": 46,
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
    "x": 37,
    "y": 47
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
  "x": 60,
  "y": 45,
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
    "x": 60,
    "y": 46
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
  "x": 59,
  "y": 47,
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
    "x": 58,
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
  "x": 54,
  "y": 45,
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
    "x": 54,
    "y": 46
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
  "x": 52,
  "y": 46,
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
    "x": 52,
    "y": 47
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
  "x": 21,
  "y": 35,
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
    "x": 20,
    "y": 35
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
  "x": 21,
  "y": 37,
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
    "x": 21,
    "y": 38
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
  "x": 23,
  "y": 33,
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
    "x": 23,
    "y": 34
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
  "x": 23,
  "y": 37,
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
    "x": 23,
    "y": 38
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
  "id": "mid-woodpile-1",
  "name": "장작 더미",
  "x": 15,
  "y": 30,
  "purpose": "서쪽 집의 겨울 땔감",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "mid-woodpile",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 15,
    "y": 31
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
  "id": "mid-woodpile-2",
  "name": "장작 더미",
  "x": 15,
  "y": 32,
  "purpose": "땔감 두 번째 더미",
  "near": "장작 더미",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "mid-woodpile",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 15,
    "y": 33
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

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "x": 23,
  "y": 9,
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
  "ownerId": "terrace-cliff-village-house-1",
  "kit": "laundry",
  "purpose": "세탁물을 말리는 자리",
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

## 나무통
```json
{
  "name": "나무통",
  "x": 25,
  "y": 10,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "terrace-cliff-village-house-1",
  "kit": "laundry",
  "purpose": "빨래를 헹구는 물통",
  "anchor": "빨랫줄",
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

## 항아리
```json
{
  "name": "항아리",
  "x": 26,
  "y": 10,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "terrace-cliff-village-house-1",
  "kit": "laundry",
  "purpose": "세탁에 쓸 물 보관",
  "anchor": "빨랫줄",
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

## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 46,
  "y": 13,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2623,
    2624
  ],
  "ownerId": "terrace-cliff-village-house-2",
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
  "x": 48,
  "y": 13,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "terrace-cliff-village-house-2",
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
  "x": 46,
  "y": 15,
  "w": 3,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "ownerId": "terrace-cliff-village-house-2",
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
  "x": 49,
  "y": 15,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "terrace-cliff-village-house-2",
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

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 4,
  "y": 30,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    237
  ],
  "ownerId": "terrace-cliff-village-house-3",
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
  "x": 6,
  "y": 30,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2638
  ],
  "ownerId": "terrace-cliff-village-house-3",
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
  "x": 7,
  "y": 30,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    207
  ],
  "ownerId": "terrace-cliff-village-house-3",
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
  "x": 4,
  "y": 32,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    202,
    203
  ],
  "ownerId": "terrace-cliff-village-house-3",
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
  "x": 7,
  "y": 32,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "ownerId": "terrace-cliff-village-house-3",
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

## 가로 탁자
```json
{
  "name": "가로 탁자",
  "x": 35,
  "y": 34,
  "w": 3,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "ownerId": "terrace-cliff-village-house-4",
  "kit": "woodwork",
  "purpose": "목재를 다루는 작업면",
  "anchor": "house",
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

## 장작
```json
{
  "name": "장작",
  "x": 35,
  "y": 32,
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

## 통나무 더미
```json
{
  "name": "통나무 더미",
  "x": 36,
  "y": 32,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    741
  ],
  "ownerId": "terrace-cliff-village-house-4",
  "kit": "woodwork",
  "purpose": "켜서 쓸 원목",
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
      741
    ]
  ]
}
```

## 나무 상자
```json
{
  "name": "나무 상자",
  "x": 37,
  "y": 32,
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
