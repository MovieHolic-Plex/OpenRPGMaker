# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 통나무 더미
```json
{
  "name": "통나무 더미",
  "x": 41,
  "y": 29,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    741
  ],
  "ownerId": "mistpond-hollow-house-4",
  "kit": "abandoned",
  "purpose": "쓰러진 채 썩어 가는 통나무",
  "anchor": "마른 묘목",
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
      741
    ]
  ]
}
```

## 마른 묘목
```json
{
  "name": "마른 묘목",
  "x": 13,
  "y": 43,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    740
  ],
  "ownerId": "mistpond-hollow-house-5",
  "kit": "abandoned",
  "purpose": "손길이 끊겨 말라 버린 마당 나무",
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
      740
    ]
  ]
}
```

## 부서진 울타리
```json
{
  "name": "부서진 울타리",
  "x": 15,
  "y": 43,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    410
  ],
  "ownerId": "mistpond-hollow-house-5",
  "kit": "abandoned",
  "purpose": "무너진 채 남은 마당 경계",
  "anchor": "마른 묘목",
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
      410
    ]
  ]
}
```

## 통나무 더미
```json
{
  "name": "통나무 더미",
  "x": 13,
  "y": 45,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    741
  ],
  "ownerId": "mistpond-hollow-house-5",
  "kit": "abandoned",
  "purpose": "쓰러진 채 썩어 가는 통나무",
  "anchor": "마른 묘목",
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
      741
    ]
  ]
}
```

## 마른 묘목
```json
{
  "name": "마른 묘목",
  "x": 44,
  "y": 49,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    740
  ],
  "ownerId": "mistpond-hollow-house-6",
  "kit": "abandoned",
  "purpose": "손길이 끊겨 말라 버린 마당 나무",
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
      740
    ]
  ]
}
```

## 부서진 울타리
```json
{
  "name": "부서진 울타리",
  "x": 46,
  "y": 49,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    410
  ],
  "ownerId": "mistpond-hollow-house-6",
  "kit": "abandoned",
  "purpose": "무너진 채 남은 마당 경계",
  "anchor": "마른 묘목",
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
      410
    ]
  ]
}
```

## 약초 화분
```json
{
  "name": "약초 화분",
  "x": 39,
  "y": 47,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2623,
    2624
  ],
  "ownerId": "mistpond-hollow-house-7",
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
  "x": 41,
  "y": 47,
  "w": 2,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2652,
    2653
  ],
  "ownerId": "mistpond-hollow-house-7",
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
  "x": 39,
  "y": 49,
  "w": 3,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    234,
    235,
    236
  ],
  "ownerId": "mistpond-hollow-house-7",
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
  "x": 42,
  "y": 49,
  "w": 1,
  "h": 1,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "ownerId": "mistpond-hollow-house-7",
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

## 화분
```json
{
  "name": "화분",
  "x": 38,
  "y": 49,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2632,
    2635
  ],
  "ownerId": "mistpond-hollow-house-7",
  "kit": "doorway",
  "purpose": "현관 옆에 둔 꽃 화분",
  "anchor": "door",
  "side": "right",
  "width": 1,
  "height": 2,
  "lowerTiles": [
    [
      77
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

## 돌등
```json
{
  "id": "dead-well-plaza-1",
  "name": "돌등",
  "x": 30,
  "y": 41,
  "purpose": "밤에 우물가를 밝히는 돌등",
  "near": "낮은 돌 우물",
  "w": 1,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "dead-well",
  "lower": "KEEP",
  "upper": [
    2655,
    2656
  ],
  "useAt": {
    "x": 29,
    "y": 41
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

## 마른 묘목
```json
{
  "id": "dead-well-plaza-2",
  "name": "마른 묘목",
  "x": 27,
  "y": 38,
  "purpose": "우물가에 말라 버린 묘목",
  "near": "낮은 돌 우물",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "dead-well",
  "lower": "KEEP",
  "upper": [
    740
  ],
  "useAt": {
    "x": 27,
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
      740
    ]
  ]
}
```
