# 실제 소품의 완전한 두 레이어 배열

각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.
## 채소밭
```json
{
  "name": "채소밭",
  "x": 67,
  "y": 46,
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
  "ownerId": "pine-hamlets-house-6",
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
  "x": 67,
  "y": 44,
  "w": 1,
  "h": 2,
  "kind": "prop",
  "lower": "KEEP",
  "upper": [
    2651,
    2654
  ],
  "ownerId": "pine-hamlets-house-6",
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
