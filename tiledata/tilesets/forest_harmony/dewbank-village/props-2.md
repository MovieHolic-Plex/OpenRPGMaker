# 소품 사전 2

하위 KEEP, 상위 아래 전체 배열. 각 셀은 16×16. sourceX/Y는 원본 시트 칸, pixelX/Y는 원본 픽셀 좌상단. targetX/Y는 이식된 30열 시트 칸. passability와 priority는 홈 레이어와 별도이다.

## 징검돌
```json
{
  "name": "징검돌",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 2,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      60,
      61
    ]
  ],
  "targetUpper": [
    [
      2649,
      2650
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 60,
      "sourceX": 0,
      "sourceY": 10,
      "pixelX": 0,
      "pixelY": 160,
      "targetTile": 2649,
      "targetX": 9,
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
        "label": "징검돌",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "passable",
        "description": "Tibo 원본 → unfake.js 개별 보정, 16px 칩",
        "layerBacking": "none"
      }
    },
    {
      "dx": 1,
      "dy": 0,
      "sourceTile": 61,
      "sourceX": 1,
      "sourceY": 10,
      "pixelX": 16,
      "pixelY": 160,
      "targetTile": 2650,
      "targetX": 10,
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
        "label": "징검돌",
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

## 나무통
```json
{
  "name": "나무통",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 1,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      38
    ]
  ],
  "targetUpper": [
    [
      2638
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 38,
      "sourceX": 2,
      "sourceY": 6,
      "pixelX": 32,
      "pixelY": 96,
      "targetTile": 2638,
      "targetX": 28,
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
        "label": "나무통",
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

## 허수아비
```json
{
  "name": "허수아비",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 1,
  "height": 2,
  "layer": "upper",
  "sourceUpper": [
    [
      62
    ],
    [
      68
    ]
  ],
  "targetUpper": [
    [
      2651
    ],
    [
      2654
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 62,
      "sourceX": 2,
      "sourceY": 10,
      "pixelX": 32,
      "pixelY": 160,
      "targetTile": 2651,
      "targetX": 11,
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
        "label": "허수아비",
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
      "sourceTile": 68,
      "sourceX": 2,
      "sourceY": 11,
      "pixelX": 32,
      "pixelY": 176,
      "targetTile": 2654,
      "targetX": 14,
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
        "label": "허수아비",
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

## 씨앗 자루
```json
{
  "name": "씨앗 자루",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 2,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      64,
      65
    ]
  ],
  "targetUpper": [
    [
      2652,
      2653
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 64,
      "sourceX": 4,
      "sourceY": 10,
      "pixelX": 64,
      "pixelY": 160,
      "targetTile": 2652,
      "targetX": 12,
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
        "label": "씨앗 자루",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "solid",
        "description": "Tibo 원본 → unfake.js 개별 보정, 16px 칩",
        "layerBacking": "none"
      }
    },
    {
      "dx": 1,
      "dy": 0,
      "sourceTile": 65,
      "sourceX": 5,
      "sourceY": 10,
      "pixelX": 80,
      "pixelY": 160,
      "targetTile": 2653,
      "targetX": 13,
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
        "label": "씨앗 자루",
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

## 채소밭
```json
{
  "name": "채소밭",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 2,
  "height": 2,
  "layer": "upper",
  "sourceUpper": [
    [
      4,
      5
    ],
    [
      10,
      11
    ]
  ],
  "targetUpper": [
    [
      2613,
      2614
    ],
    [
      2618,
      2619
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 4,
      "sourceX": 4,
      "sourceY": 0,
      "pixelX": 64,
      "pixelY": 0,
      "targetTile": 2613,
      "targetX": 3,
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
        "label": "채소밭",
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
      "sourceTile": 5,
      "sourceX": 5,
      "sourceY": 0,
      "pixelX": 80,
      "pixelY": 0,
      "targetTile": 2614,
      "targetX": 4,
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
        "label": "채소밭",
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
      "sourceTile": 10,
      "sourceX": 4,
      "sourceY": 1,
      "pixelX": 64,
      "pixelY": 16,
      "targetTile": 2618,
      "targetX": 8,
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
        "label": "채소밭",
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
      "sourceTile": 11,
      "sourceX": 5,
      "sourceY": 1,
      "pixelX": 80,
      "pixelY": 16,
      "targetTile": 2619,
      "targetX": 9,
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
        "label": "채소밭",
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
