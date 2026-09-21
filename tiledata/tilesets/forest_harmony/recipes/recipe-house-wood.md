# 통나무 집 + 문 앞 2칸

타일셋 forest_harmony; 원점 (x,y); 전체 폭 9, 높이 9.

## 입력
```json
{
  "mapId": "실제맵ID",
  "placement": {
    "recipeId": "house-wood",
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
1141  375  375  375  375  375  375  377 1141
 376  375  375  375  375  375  375  375  377
 376  375  375  375  375  375  375  375  377
 404  405  405  405  405  405  405  405  405
 102  103  103  103  103  103  103  103  104
 132  133  133  133  329  133  133  133  134
 162  163  163  163  359  163  163  163  164
1141 1141 1141 1141 1141 1141 1141 1141 1141
1141 1141 1141 1141 1141 1141 1141 1141 1141
```

### upperTiles

```text
 354   -1   -1   -1   -1   -1   -1   -1  355
  -1   -1   -1   -1   -1   -1   -1   -1   -1
  -1   -1   -1   -1   -1   -1   -1   -1   -1
 384   -1   -1   -1   -1   -1   -1   -1  385
  -1   -1   -1   -1   -1   -1   -1   -1   -1
  -1   -1   85   -1   -1   -1   -1   85   -1
  -1   -1   -1   -1   -1   -1   -1   -1   -1
  -1   -1   -1   -1   -1   -1   -1   -1   -1
  -1   -1   -1   -1   -1   -1   -1   -1   -1
```

## 부품 사전·원본 시트 좌표·결합·문/접근칸

```json
{
  "id": "house-wood",
  "name": "통나무 집 + 문 앞 2칸",
  "kind": "building",
  "tilesetId": "forest_harmony",
  "width": 9,
  "height": 9,
  "lowerTiles": [
    1141,
    375,
    375,
    375,
    375,
    375,
    375,
    377,
    1141,
    376,
    375,
    375,
    375,
    375,
    375,
    375,
    375,
    377,
    376,
    375,
    375,
    375,
    375,
    375,
    375,
    375,
    377,
    404,
    405,
    405,
    405,
    405,
    405,
    405,
    405,
    405,
    102,
    103,
    103,
    103,
    103,
    103,
    103,
    103,
    104,
    132,
    133,
    133,
    133,
    329,
    133,
    133,
    133,
    134,
    162,
    163,
    163,
    163,
    359,
    163,
    163,
    163,
    164,
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
    354,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    355,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    384,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    385,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    85,
    -1,
    -1,
    -1,
    -1,
    85,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1
  ],
  "roles": [
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "roof",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "door-top",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "wall",
    "door-bottom",
    "wall",
    "wall",
    "wall",
    "wall",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
    "ground",
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
      "x": 4,
      "y": 7,
      "role": "door-approach"
    },
    {
      "x": 4,
      "y": 8,
      "role": "entry"
    }
  ],
  "doors": [
    {
      "x": 4,
      "y": 6,
      "top": {
        "x": 4,
        "y": 5
      },
      "trigger": "action-from-south",
      "transfer": "must-author-target-map-event"
    }
  ],
  "steps": [
    {
      "part": "roof",
      "rect": [
        0,
        0,
        9,
        4
      ]
    },
    {
      "part": "wall",
      "rect": [
        0,
        4,
        9,
        3
      ]
    },
    {
      "part": "windows",
      "cells": [
        [
          2,
          5
        ],
        [
          7,
          5
        ]
      ]
    },
    {
      "part": "door",
      "cells": [
        [
          4,
          5
        ],
        [
          4,
          6
        ]
      ]
    },
    {
      "part": "approach",
      "cells": [
        [
          4,
          7
        ],
        [
          4,
          8
        ]
      ]
    }
  ],
  "tileCoordinates": [
    {
      "id": 85,
      "col": 25,
      "row": 2,
      "pixelX": 400,
      "pixelY": 32,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 102,
      "col": 12,
      "row": 3,
      "pixelX": 192,
      "pixelY": 48,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 103,
      "col": 13,
      "row": 3,
      "pixelX": 208,
      "pixelY": 48,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 104,
      "col": 14,
      "row": 3,
      "pixelX": 224,
      "pixelY": 48,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 132,
      "col": 12,
      "row": 4,
      "pixelX": 192,
      "pixelY": 64,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 133,
      "col": 13,
      "row": 4,
      "pixelX": 208,
      "pixelY": 64,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 134,
      "col": 14,
      "row": 4,
      "pixelX": 224,
      "pixelY": 64,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 162,
      "col": 12,
      "row": 5,
      "pixelX": 192,
      "pixelY": 80,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 163,
      "col": 13,
      "row": 5,
      "pixelX": 208,
      "pixelY": 80,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 164,
      "col": 14,
      "row": 5,
      "pixelX": 224,
      "pixelY": 80,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 329,
      "col": 29,
      "row": 10,
      "pixelX": 464,
      "pixelY": 160,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 354,
      "col": 24,
      "row": 11,
      "pixelX": 384,
      "pixelY": 176,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 355,
      "col": 25,
      "row": 11,
      "pixelX": 400,
      "pixelY": 176,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 359,
      "col": 29,
      "row": 11,
      "pixelX": 464,
      "pixelY": 176,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 375,
      "col": 15,
      "row": 12,
      "pixelX": 240,
      "pixelY": 192,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 376,
      "col": 16,
      "row": 12,
      "pixelX": 256,
      "pixelY": 192,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 377,
      "col": 17,
      "row": 12,
      "pixelX": 272,
      "pixelY": 192,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 384,
      "col": 24,
      "row": 12,
      "pixelX": 384,
      "pixelY": 192,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 385,
      "col": 25,
      "row": 12,
      "pixelX": 400,
      "pixelY": 192,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 404,
      "col": 14,
      "row": 13,
      "pixelX": 224,
      "pixelY": 208,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 405,
      "col": 15,
      "row": 13,
      "pixelX": 240,
      "pixelY": 208,
      "width": 16,
      "height": 16,
      "home": "lower",
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

![house-wood-normal.png](image:house-wood-normal)

왼쪽 정상 / 오른쪽 오류(빨간 테두리). blocked-entrance, 실제 맵 (6,9).

![house-wood-blocked-entrance.png](image:house-wood-blocked-entrance)

