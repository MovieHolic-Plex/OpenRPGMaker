# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 벤치
```json
{
  "id": "campfire-3",
  "name": "벤치",
  "x": 13,
  "y": 36,
  "purpose": "불가 북쪽 앉을 자리",
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
    "x": 13,
    "y": 37
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
  "id": "campfire-4",
  "name": "장작 더미",
  "x": 14,
  "y": 38,
  "purpose": "모닥불에 쓸 장작",
  "near": "모닥불",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "campfire",
  "lower": "KEEP",
  "upper": [
    349
  ],
  "useAt": {
    "x": 14,
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
      349
    ]
  ]
}
```

## 장터 노점
```json
{
  "id": "market-1",
  "name": "장터 노점",
  "x": 34,
  "y": 36,
  "purpose": "아랫마을 주민이 채소와 과일을 파는 좌판",
  "w": 3,
  "h": 2,
  "kind": "civic-prop",
  "placeId": "market",
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
    "x": 33,
    "y": 36
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
  "id": "market-2",
  "name": "과일 좌판",
  "x": 38,
  "y": 38,
  "purpose": "산에서 딴 과일을 늘어놓은 상자",
  "near": "장터 노점",
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
    "x": 38,
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
      202,
      203
    ]
  ]
}
```

## 술통
```json
{
  "id": "market-3",
  "name": "술통",
  "x": 33,
  "y": 40,
  "purpose": "장터 음료 통",
  "near": "장터 노점",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "market",
  "lower": "KEEP",
  "upper": [
    177
  ],
  "useAt": {
    "x": 33,
    "y": 41
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

## 벤치
```json
{
  "id": "market-4",
  "name": "벤치",
  "x": 35,
  "y": 42,
  "purpose": "장 보러 온 사람의 쉼 자리",
  "w": 2,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "market",
  "lower": "KEEP",
  "upper": [
    327,
    328
  ],
  "useAt": {
    "x": 35,
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
