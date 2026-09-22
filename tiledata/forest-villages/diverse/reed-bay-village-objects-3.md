# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 벤치
```json
{
  "id": "beach-fire-2",
  "name": "벤치",
  "x": 17,
  "y": 52,
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
    "x": 17,
    "y": 53
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
  "x": 23,
  "y": 50,
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
    "x": 23,
    "y": 51
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
  "x": 22,
  "y": 16,
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
    "x": 22,
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
