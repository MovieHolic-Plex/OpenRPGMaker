# 암벽 동굴 입구와 접근칸

타일셋 forest_harmony; 원점 (x,y); 전체 폭 7, 높이 6.

## 입력
```json
{
  "mapId": "실제맵ID",
  "placement": {
    "recipeId": "cave-cliff",
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
 618  619  619  619  619  619  620
 651  652  652  652  652  652  653
 651  652  652  652  652  652  653
 651  652  652  893  652  652  653
1141 1141 1141 1141 1141 1141 1141
1141 1141 1141 1141 1141 1141 1141
```

### upperTiles

```text
  -1   -1   -1   -1   -1   -1   -1
  -1   -1   -1   -1   -1   -1   -1
  -1   -1   -1   -1   -1   -1   -1
  -1   -1   -1   -1   -1   -1   -1
  -1   -1   -1   -1   -1   -1   -1
  -1   -1   -1   -1   -1   -1   -1
```

## 부품 사전·원본 시트 좌표·결합·문/접근칸

```json
{
  "id": "cave-cliff",
  "name": "암벽 동굴 입구와 접근칸",
  "kind": "cave",
  "tilesetId": "forest_harmony",
  "width": 7,
  "height": 6,
  "lowerTiles": [
    618,
    619,
    619,
    619,
    619,
    619,
    620,
    651,
    652,
    652,
    652,
    652,
    652,
    653,
    651,
    652,
    652,
    652,
    652,
    652,
    653,
    651,
    652,
    652,
    893,
    652,
    652,
    653,
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
    "cliff-top",
    "cliff-top",
    "cliff-top",
    "cliff-top",
    "cliff-top",
    "cliff-top",
    "cliff-top",
    "edge-west",
    "cliff-face",
    "cliff-face",
    "cliff-face",
    "cliff-face",
    "cliff-face",
    "edge-east",
    "edge-west",
    "cliff-face",
    "cliff-face",
    "cliff-face",
    "cliff-face",
    "cliff-face",
    "edge-east",
    "edge-west",
    "cliff-face",
    "cliff-face",
    "cave-mouth",
    "cliff-face",
    "cliff-face",
    "edge-east",
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
      "x": 3,
      "y": 4,
      "role": "cave-approach"
    },
    {
      "x": 3,
      "y": 5,
      "role": "entry"
    }
  ],
  "doors": [
    {
      "x": 3,
      "y": 3,
      "trigger": "action-from-south",
      "transfer": "must-author-target-map-event"
    }
  ],
  "steps": [
    {
      "part": "cliff-top",
      "rect": [
        0,
        0,
        7,
        1
      ]
    },
    {
      "part": "cliff-face",
      "rect": [
        0,
        1,
        7,
        3
      ]
    },
    {
      "part": "cave-mouth",
      "tile": 893,
      "x": 3,
      "y": 3,
      "backing": 652
    },
    {
      "part": "approach",
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
      "id": 618,
      "col": 18,
      "row": 20,
      "pixelX": 288,
      "pixelY": 320,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 619,
      "col": 19,
      "row": 20,
      "pixelX": 304,
      "pixelY": 320,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 620,
      "col": 20,
      "row": 20,
      "pixelX": 320,
      "pixelY": 320,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 651,
      "col": 21,
      "row": 21,
      "pixelX": 336,
      "pixelY": 336,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 652,
      "col": 22,
      "row": 21,
      "pixelX": 352,
      "pixelY": 336,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 653,
      "col": 23,
      "row": 21,
      "pixelX": 368,
      "pixelY": 336,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 893,
      "col": 23,
      "row": 29,
      "pixelX": 368,
      "pixelY": 464,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": 652,
      "graft": {
        "sourceTile": 413,
        "targetTile": 893,
        "sourceChipset": "tex_easyrpg_chipset_retro_world"
      }
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

![cave-cliff-normal.png](image:cave-cliff-normal)

왼쪽 정상 / 오른쪽 오류(빨간 테두리). blocked-entrance, 실제 맵 (5,6).

![cave-cliff-blocked-entrance.png](image:cave-cliff-blocked-entrance)

