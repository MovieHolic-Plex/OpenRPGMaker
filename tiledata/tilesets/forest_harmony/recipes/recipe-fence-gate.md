# 울타리와 남쪽 출입구

타일셋 forest_harmony; 원점 (x,y); 전체 폭 7, 높이 6.

## 입력
```json
{
  "mapId": "실제맵ID",
  "placement": {
    "recipeId": "fence-gate",
    "x": 2,
    "y": 2
  }
}
```
요청 영역은 원점 (2,2)에서 이 문서에 명시한 전체 폭·높이이다. mapId를 실제 값으로 바꾼다.

## 정답 전체 배치표
각 행은 좌→우, 행 순서는 위→아래. 맵 좌표는 원점+(열,행).

### lowerTiles

```text
1141 1141 1141 1141 1141 1141 1141
1141 1141 1141 1141 1141 1141 1141
1141 1141 1141 1141 1141 1141 1141
1141 1141 1141 1141 1141 1141 1141
1141 1141 1141 1141 1141 1141 1141
1141 1141 1141 1141 1141 1141 1141
```

### upperTiles

```text
 378  379  379  379  379  379  380
 408   -1   -1   -1   -1   -1  408
 408   -1   -1   -1   -1   -1  408
 408   -1   -1   -1   -1   -1  408
 438  379  379   -1  379  379  410
  -1   -1   -1   -1   -1   -1   -1
```

## 부품 사전·원본 시트 좌표·결합·문/접근칸

```json
{
  "id": "fence-gate",
  "name": "울타리와 남쪽 출입구",
  "kind": "fence",
  "tilesetId": "forest_harmony",
  "width": 7,
  "height": 6,
  "lowerTiles": [
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141,
    1141
  ],
  "upperTiles": [
    378,
    379,
    379,
    379,
    379,
    379,
    380,
    408,
    -1,
    -1,
    -1,
    -1,
    -1,
    408,
    408,
    -1,
    -1,
    -1,
    -1,
    -1,
    408,
    408,
    -1,
    -1,
    -1,
    -1,
    -1,
    408,
    438,
    379,
    379,
    -1,
    379,
    379,
    410,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1
  ],
  "roles": [
    "corner-nw",
    "rail",
    "rail",
    "rail",
    "rail",
    "rail",
    "corner-ne",
    "edge-west",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
    "edge-east",
    "edge-west",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
    "edge-east",
    "edge-west",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
    "edge-east",
    "corner-sw",
    "rail",
    "rail",
    "ground",
    "rail",
    "rail",
    "corner-se",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground"
  ],
  "access": [
    {
      "x": 3,
      "y": 3,
      "role": "inside"
    },
    {
      "x": 3,
      "y": 4,
      "role": "gate"
    },
    {
      "x": 3,
      "y": 5,
      "role": "outside"
    }
  ],
  "doors": [],
  "steps": [
    {
      "part": "corners",
      "cells": [
        [
          0,
          0,
          378
        ],
        [
          6,
          0,
          380
        ],
        [
          0,
          4,
          438
        ],
        [
          6,
          4,
          410
        ]
      ]
    },
    {
      "part": "horizontal",
      "tile": 379
    },
    {
      "part": "vertical",
      "tile": 408
    },
    {
      "part": "leave-gate-empty",
      "cells": [
        [
          3,
          4
        ],
        [
          3,
          5
        ]
      ]
    }
  ],
  "tileCoordinates": [
    {
      "id": 378,
      "col": 18,
      "row": 12,
      "pixelX": 288,
      "pixelY": 192,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 379,
      "col": 19,
      "row": 12,
      "pixelX": 304,
      "pixelY": 192,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 380,
      "col": 20,
      "row": 12,
      "pixelX": 320,
      "pixelY": 192,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 408,
      "col": 18,
      "row": 13,
      "pixelX": 288,
      "pixelY": 208,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 410,
      "col": 20,
      "row": 13,
      "pixelX": 320,
      "pixelY": 208,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 438,
      "col": 18,
      "row": 14,
      "pixelX": 288,
      "pixelY": 224,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 1141,
      "col": 1,
      "row": 38,
      "pixelX": 16,
      "pixelY": 608,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    }
  ]
}
```

정상: 원본 16px 칩 조립. 실제 플레이 화면이 아닌 정확한 배열 미리보기.

![fence-gate-normal.png](image:fence-gate-normal)

왼쪽 정상 / 오른쪽 오류(빨간 테두리). blocked-entrance, 실제 맵 (5,6).

![fence-gate-blocked-entrance.png](image:fence-gate-blocked-entrance)

