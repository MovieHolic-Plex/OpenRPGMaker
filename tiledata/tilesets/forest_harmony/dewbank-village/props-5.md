# 소품 사전 5

하위 KEEP, 상위 아래 전체 배열. 각 셀은 16×16. sourceX/Y는 원본 시트 칸, pixelX/Y는 원본 픽셀 좌상단. targetX/Y는 이식된 30열 시트 칸. passability와 priority는 홈 레이어와 별도이다.

## 빨랫줄
```json
{
  "name": "빨랫줄",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 2,
  "height": 2,
  "layer": "upper",
  "sourceUpper": [
    [
      12,
      13
    ],
    [
      18,
      19
    ]
  ],
  "targetUpper": [
    [
      2620,
      2621
    ],
    [
      2625,
      2626
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 12,
      "sourceX": 0,
      "sourceY": 2,
      "pixelX": 0,
      "pixelY": 32,
      "targetTile": 2620,
      "targetX": 10,
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
        "label": "빨랫줄",
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
      "sourceTile": 13,
      "sourceX": 1,
      "sourceY": 2,
      "pixelX": 16,
      "pixelY": 32,
      "targetTile": 2621,
      "targetX": 11,
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
        "label": "빨랫줄",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "description": "기존 승인 소품의 16px 원본 칩 복사",
        "layerBacking": "none"
      }
    },
    {
      "dx": 0,
      "dy": 1,
      "sourceTile": 18,
      "sourceX": 0,
      "sourceY": 3,
      "pixelX": 0,
      "pixelY": 48,
      "targetTile": 2625,
      "targetX": 15,
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
        "label": "빨랫줄",
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
      "dy": 1,
      "sourceTile": 19,
      "sourceX": 1,
      "sourceY": 3,
      "pixelX": 16,
      "pixelY": 48,
      "targetTile": 2626,
      "targetX": 16,
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
        "label": "빨랫줄",
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

## 우편함
```json
{
  "name": "우편함",
  "tilesetId": "forest_harmony",
  "imageId": "tex_forest_harmony",
  "tileSize": 16,
  "tilesPerRow": 30,
  "width": 1,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      350
    ]
  ],
  "targetUpper": [
    [
      350
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 350,
      "sourceX": 20,
      "sourceY": 11,
      "pixelX": 320,
      "pixelY": 176,
      "targetTile": 350,
      "targetX": 20,
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
        "label": "우편함",
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

## 장작
```json
{
  "name": "장작",
  "tilesetId": "forest_harmony",
  "imageId": "tex_forest_harmony",
  "tileSize": 16,
  "tilesPerRow": 30,
  "width": 1,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      349
    ]
  ],
  "targetUpper": [
    [
      349
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 349,
      "sourceX": 19,
      "sourceY": 11,
      "pixelX": 304,
      "pixelY": 176,
      "targetTile": 349,
      "targetX": 19,
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
        "label": "장작 더미",
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

## 낚시 바구니
```json
{
  "name": "낚시 바구니",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 1,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      52
    ]
  ],
  "targetUpper": [
    [
      2646
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 52,
      "sourceX": 4,
      "sourceY": 8,
      "pixelX": 64,
      "pixelY": 128,
      "targetTile": 2646,
      "targetX": 6,
      "targetY": 88,
      "passability": {
        "up": false,
        "down": false,
        "left": false,
        "right": false
      },
      "priority": "upper",
      "tileMeta": {
        "role": "prop",
        "label": "낚시 바구니",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "description": "Tibo 원본 → unfake.js 개별 보정, 16px 칩",
        "layerBacking": "none"
      }
    }
  ]
}
```

## 벽걸이 등불
```json
{
  "name": "벽걸이 등불",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 1,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      50
    ]
  ],
  "targetUpper": [
    [
      2645
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 50,
      "sourceX": 2,
      "sourceY": 8,
      "pixelX": 32,
      "pixelY": 128,
      "targetTile": 2645,
      "targetX": 5,
      "targetY": 88,
      "passability": {
        "up": true,
        "down": true,
        "left": true,
        "right": true
      },
      "priority": "upper",
      "tileMeta": {
        "role": "prop",
        "label": "벽걸이 등불",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "passable",
        "description": "Tibo 원본 → unfake.js 개별 보정, 16px 칩",
        "layerBacking": "none"
      }
    }
  ]
}
```
