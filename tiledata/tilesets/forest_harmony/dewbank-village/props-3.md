# 소품 사전 3

하위 KEEP, 상위 아래 전체 배열. 각 셀은 16×16. sourceX/Y는 원본 시트 칸, pixelX/Y는 원본 픽셀 좌상단. targetX/Y는 이식된 30열 시트 칸. passability와 priority는 홈 레이어와 별도이다.

## 나무 울타리
```json
{
  "name": "나무 울타리",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 2,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      36,
      37
    ]
  ],
  "targetUpper": [
    [
      2636,
      2637
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 36,
      "sourceX": 0,
      "sourceY": 6,
      "pixelX": 0,
      "pixelY": 96,
      "targetTile": 2636,
      "targetX": 26,
      "targetY": 87,
      "passability": {
        "up": false,
        "down": false,
        "left": false,
        "right": false
      },
      "priority": "upper",
      "tileMeta": {
        "role": "prop",
        "label": "나무 울타리",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "layerBacking": "none"
      }
    },
    {
      "dx": 1,
      "dy": 0,
      "sourceTile": 37,
      "sourceX": 1,
      "sourceY": 6,
      "pixelX": 16,
      "pixelY": 96,
      "targetTile": 2637,
      "targetX": 27,
      "targetY": 87,
      "passability": {
        "up": false,
        "down": false,
        "left": false,
        "right": false
      },
      "priority": "upper",
      "tileMeta": {
        "role": "prop",
        "label": "나무 울타리",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "layerBacking": "none"
      }
    }
  ]
}
```

## 과일 바구니
```json
{
  "name": "과일 바구니",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 2,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      24,
      25
    ]
  ],
  "targetUpper": [
    [
      2628,
      2629
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 24,
      "sourceX": 0,
      "sourceY": 4,
      "pixelX": 0,
      "pixelY": 64,
      "targetTile": 2628,
      "targetX": 18,
      "targetY": 87,
      "passability": {
        "up": false,
        "down": false,
        "left": false,
        "right": false
      },
      "priority": "upper",
      "tileMeta": {
        "role": "prop",
        "label": "과일 바구니",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "description": "기존 승인 소품의 16px 원본 칩 복사",
        "layerBacking": "none"
      }
    },
    {
      "dx": 1,
      "dy": 0,
      "sourceTile": 25,
      "sourceX": 1,
      "sourceY": 4,
      "pixelX": 16,
      "pixelY": 64,
      "targetTile": 2629,
      "targetX": 19,
      "targetY": 87,
      "passability": {
        "up": false,
        "down": false,
        "left": false,
        "right": false
      },
      "priority": "upper",
      "tileMeta": {
        "role": "prop",
        "label": "과일 바구니",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "description": "기존 승인 소품의 16px 원본 칩 복사",
        "layerBacking": "none"
      }
    }
  ]
}
```

## 과일 상자
```json
{
  "name": "과일 상자",
  "tilesetId": "forest_harmony",
  "imageId": "tex_forest_harmony",
  "tileSize": 16,
  "tilesPerRow": 30,
  "width": 2,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      202,
      203
    ]
  ],
  "targetUpper": [
    [
      202,
      203
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 202,
      "sourceX": 22,
      "sourceY": 6,
      "pixelX": 352,
      "pixelY": 96,
      "targetTile": 202,
      "targetX": 22,
      "targetY": 6,
      "passability": {
        "up": false,
        "down": false,
        "left": false,
        "right": false
      },
      "priority": "upper",
      "tileMeta": {
        "role": "prop",
        "label": "과일박스 좌",
        "source": "bundled-default",
        "passage": "solid",
        "confidence": "high",
        "terrainTag": 0,
        "description": "",
        "defaultLayer": "upper",
        "repeatability": "fixed"
      }
    },
    {
      "dx": 1,
      "dy": 0,
      "sourceTile": 203,
      "sourceX": 23,
      "sourceY": 6,
      "pixelX": 368,
      "pixelY": 96,
      "targetTile": 203,
      "targetX": 23,
      "targetY": 6,
      "passability": {
        "up": false,
        "down": false,
        "left": false,
        "right": false
      },
      "priority": "upper",
      "tileMeta": {
        "role": "prop",
        "label": "과일박스 우",
        "source": "bundled-default",
        "passage": "solid",
        "confidence": "high",
        "terrainTag": 0,
        "description": "",
        "defaultLayer": "upper",
        "repeatability": "fixed"
      }
    }
  ]
}
```

## 나무 상자
```json
{
  "name": "나무 상자",
  "tilesetId": "forest_harmony",
  "imageId": "tex_forest_harmony",
  "tileSize": 16,
  "tilesPerRow": 30,
  "width": 1,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      237
    ]
  ],
  "targetUpper": [
    [
      237
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 237,
      "sourceX": 27,
      "sourceY": 7,
      "pixelX": 432,
      "pixelY": 112,
      "targetTile": 237,
      "targetX": 27,
      "targetY": 7,
      "passability": {
        "up": false,
        "down": false,
        "left": false,
        "right": false
      },
      "priority": "upper",
      "tileMeta": {
        "role": "prop",
        "label": "나무 상자",
        "source": "bundled-default",
        "passage": "solid",
        "confidence": "high",
        "terrainTag": 0,
        "description": "",
        "defaultLayer": "upper",
        "repeatability": "fixed"
      }
    }
  ]
}
```

## 항아리
```json
{
  "name": "항아리",
  "tilesetId": "forest_harmony",
  "imageId": "tex_forest_harmony",
  "tileSize": 16,
  "tilesPerRow": 30,
  "width": 1,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      352
    ]
  ],
  "targetUpper": [
    [
      352
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 352,
      "sourceX": 22,
      "sourceY": 11,
      "pixelX": 352,
      "pixelY": 176,
      "targetTile": 352,
      "targetX": 22,
      "targetY": 11,
      "passability": {
        "up": false,
        "down": false,
        "left": false,
        "right": false
      },
      "priority": "upper",
      "tileMeta": {
        "role": "prop",
        "label": "항아리",
        "source": "bundled-default",
        "passage": "solid",
        "confidence": "high",
        "terrainTag": 0,
        "description": "",
        "defaultLayer": "upper",
        "repeatability": "fixed"
      }
    }
  ]
}
```
