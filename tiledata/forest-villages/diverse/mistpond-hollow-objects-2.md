# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 부서진 울타리
```json
{
  "id": "dead-well-2",
  "name": "부서진 울타리",
  "x": 34,
  "y": 46,
  "purpose": "무너진 우물가 울타리",
  "near": "낮은 돌 우물",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "dead-well",
  "lower": "KEEP",
  "upper": [
    410
  ],
  "useAt": {
    "x": 34,
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
      410
    ]
  ]
}
```

## 통나무 더미
```json
{
  "id": "dead-well-3",
  "name": "통나무 더미",
  "x": 38,
  "y": 49,
  "purpose": "썩어 가는 옛 땔감",
  "near": "낮은 돌 우물",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "dead-well",
  "lower": "KEEP",
  "upper": [
    741
  ],
  "useAt": {
    "x": 38,
    "y": 50
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
      741
    ]
  ]
}
```

## 항아리
```json
{
  "id": "falls-lookout-1",
  "name": "항아리",
  "x": 19,
  "y": 31,
  "purpose": "빨래터에 버려진 물항아리",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "falls-lookout",
  "lower": "KEEP",
  "upper": [
    352
  ],
  "useAt": {
    "x": 19,
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
      352
    ]
  ]
}
```

## 마른 묘목
```json
{
  "id": "falls-lookout-2",
  "name": "마른 묘목",
  "x": 20,
  "y": 40,
  "purpose": "물가에 선 마른 나무",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "falls-lookout",
  "lower": "KEEP",
  "upper": [
    740
  ],
  "useAt": {
    "x": 20,
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
      740
    ]
  ]
}
```

## 나무 이정표
```json
{
  "id": "entry-sign-1",
  "name": "나무 이정표",
  "x": 38,
  "y": 58,
  "purpose": "글씨가 바랜 마을 이정표",
  "w": 1,
  "h": 1,
  "kind": "civic-prop",
  "placeId": "entry-sign",
  "lower": "KEEP",
  "upper": [
    596
  ],
  "useAt": {
    "x": 38,
    "y": 59
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
