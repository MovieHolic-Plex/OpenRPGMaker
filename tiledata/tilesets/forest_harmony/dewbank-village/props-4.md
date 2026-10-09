# 소품 사전 4

하위 KEEP, 상위 아래 전체 배열. 각 셀은 16×16. sourceX/Y는 원본 시트 칸, pixelX/Y는 원본 픽셀 좌상단. targetX/Y는 이식된 30열 시트 칸. passability와 priority는 홈 레이어와 별도이다.

## 표지판
```json
{
  "name": "표지판",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 1,
  "height": 2,
  "layer": "upper",
  "sourceUpper": [
    [
      0
    ],
    [
      6
    ]
  ],
  "targetUpper": [
    [
      2610
    ],
    [
      2615
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 0,
      "sourceX": 0,
      "sourceY": 0,
      "pixelX": 0,
      "pixelY": 0,
      "targetTile": 2610,
      "targetX": 0,
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
        "label": "표지판",
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
      "sourceTile": 6,
      "sourceX": 0,
      "sourceY": 1,
      "pixelX": 0,
      "pixelY": 16,
      "targetTile": 2615,
      "targetX": 5,
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
        "label": "표지판",
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

## 낮은 돌 우물
```json
{
  "name": "낮은 돌 우물",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 2,
  "height": 2,
  "layer": "upper",
  "sourceUpper": [
    [
      40,
      41
    ],
    [
      46,
      47
    ]
  ],
  "targetUpper": [
    [
      2639,
      2640
    ],
    [
      2641,
      2642
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 40,
      "sourceX": 4,
      "sourceY": 6,
      "pixelX": 64,
      "pixelY": 96,
      "targetTile": 2639,
      "targetX": 29,
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
        "label": "낮은 돌 우물",
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
      "sourceTile": 41,
      "sourceX": 5,
      "sourceY": 6,
      "pixelX": 80,
      "pixelY": 96,
      "targetTile": 2640,
      "targetX": 0,
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
        "label": "낮은 돌 우물",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "layerBacking": "none"
      }
    },
    {
      "dx": 0,
      "dy": 1,
      "sourceTile": 46,
      "sourceX": 4,
      "sourceY": 7,
      "pixelX": 64,
      "pixelY": 112,
      "targetTile": 2641,
      "targetX": 1,
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
        "label": "낮은 돌 우물",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "layerBacking": "none"
      }
    },
    {
      "dx": 1,
      "dy": 1,
      "sourceTile": 47,
      "sourceX": 5,
      "sourceY": 7,
      "pixelX": 80,
      "pixelY": 112,
      "targetTile": 2642,
      "targetX": 2,
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
        "label": "낮은 돌 우물",
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

## 게시판
```json
{
  "name": "게시판",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 2,
  "height": 2,
  "layer": "upper",
  "sourceUpper": [
    [
      26,
      27
    ],
    [
      32,
      33
    ]
  ],
  "targetUpper": [
    [
      2630,
      2631
    ],
    [
      2633,
      2634
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 26,
      "sourceX": 2,
      "sourceY": 4,
      "pixelX": 32,
      "pixelY": 64,
      "targetTile": 2630,
      "targetX": 20,
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
        "label": "게시판",
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
      "sourceTile": 27,
      "sourceX": 3,
      "sourceY": 4,
      "pixelX": 48,
      "pixelY": 64,
      "targetTile": 2631,
      "targetX": 21,
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
        "label": "게시판",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "layerBacking": "none"
      }
    },
    {
      "dx": 0,
      "dy": 1,
      "sourceTile": 32,
      "sourceX": 2,
      "sourceY": 5,
      "pixelX": 32,
      "pixelY": 80,
      "targetTile": 2633,
      "targetX": 23,
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
        "label": "게시판",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "layerBacking": "none"
      }
    },
    {
      "dx": 1,
      "dy": 1,
      "sourceTile": 33,
      "sourceX": 3,
      "sourceY": 5,
      "pixelX": 48,
      "pixelY": 80,
      "targetTile": 2634,
      "targetX": 24,
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
        "label": "게시판",
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

## 돌등
```json
{
  "name": "돌등",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 1,
  "height": 2,
  "layer": "upper",
  "sourceUpper": [
    [
      72
    ],
    [
      78
    ]
  ],
  "targetUpper": [
    [
      2655
    ],
    [
      2656
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 72,
      "sourceX": 0,
      "sourceY": 12,
      "pixelX": 0,
      "pixelY": 192,
      "targetTile": 2655,
      "targetX": 15,
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
        "label": "돌등",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "description": "Tibo 원본 → unfake.js 개별 보정, 16px 칩",
        "layerBacking": "none"
      }
    },
    {
      "dx": 0,
      "dy": 1,
      "sourceTile": 78,
      "sourceX": 0,
      "sourceY": 13,
      "pixelX": 0,
      "pixelY": 208,
      "targetTile": 2656,
      "targetX": 16,
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
        "label": "돌등",
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

## 가로 탁자
```json
{
  "name": "가로 탁자",
  "tilesetId": "forest_harmony",
  "imageId": "tex_forest_harmony",
  "tileSize": 16,
  "tilesPerRow": 30,
  "width": 3,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      234,
      235,
      236
    ]
  ],
  "targetUpper": [
    [
      234,
      235,
      236
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 234,
      "sourceX": 24,
      "sourceY": 7,
      "pixelX": 384,
      "pixelY": 112,
      "targetTile": 234,
      "targetX": 24,
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
        "label": "가로 탁자 좌",
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
      "sourceTile": 235,
      "sourceX": 25,
      "sourceY": 7,
      "pixelX": 400,
      "pixelY": 112,
      "targetTile": 235,
      "targetX": 25,
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
        "label": "가로 탁자 중",
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
      "dx": 2,
      "dy": 0,
      "sourceTile": 236,
      "sourceX": 26,
      "sourceY": 7,
      "pixelX": 416,
      "pixelY": 112,
      "targetTile": 236,
      "targetX": 26,
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
        "label": "가로 탁자 우",
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
