# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 장작 더미
```json
{
  "id": "mid-woodpile-1",
  "name": "장작 더미",
  "x": 20,
  "y": 34,
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
    "x": 20,
    "y": 35
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
  "x": 21,
  "y": 36,
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
    "x": 21,
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
      349
    ]
  ]
}
```
