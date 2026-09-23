# 소품 사전 1

하위 KEEP, 상위 아래 전체 배열. 각 셀은 16×16. sourceX/Y는 원본 시트 칸, pixelX/Y는 원본 픽셀 좌상단. targetX/Y는 이식된 30열 시트 칸. passability와 priority는 홈 레이어와 별도이다.

## 약초 화분
```json
{
  "name": "약초 화분",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 2,
  "height": 1,
  "layer": "upper",
  "sourceUpper": [
    [
      16,
      17
    ]
  ],
  "targetUpper": [
    [
      2623,
      2624
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 16,
      "sourceX": 4,
      "sourceY": 2,
      "pixelX": 64,
      "pixelY": 32,
      "targetTile": 2623,
      "targetX": 13,
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
        "label": "약초 화분 v2",
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
      "sourceTile": 17,
      "sourceX": 5,
      "sourceY": 2,
      "pixelX": 80,
      "pixelY": 32,
      "targetTile": 2624,
      "targetX": 14,
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
        "label": "약초 화분 v2",
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

## 꽃 화단
```json
{
  "name": "꽃 화단",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 2,
  "height": 2,
  "layer": "upper",
  "sourceUpper": [
    [
      2,
      3
    ],
    [
      8,
      9
    ]
  ],
  "targetUpper": [
    [
      2611,
      2612
    ],
    [
      2616,
      2617
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 2,
      "sourceX": 2,
      "sourceY": 0,
      "pixelX": 32,
      "pixelY": 0,
      "targetTile": 2611,
      "targetX": 1,
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
        "label": "꽃 화단",
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
      "sourceTile": 3,
      "sourceX": 3,
      "sourceY": 0,
      "pixelX": 48,
      "pixelY": 0,
      "targetTile": 2612,
      "targetX": 2,
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
        "label": "꽃 화단",
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
      "sourceTile": 8,
      "sourceX": 2,
      "sourceY": 1,
      "pixelX": 32,
      "pixelY": 16,
      "targetTile": 2616,
      "targetX": 6,
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
        "label": "꽃 화단",
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
      "sourceTile": 9,
      "sourceX": 3,
      "sourceY": 1,
      "pixelX": 48,
      "pixelY": 16,
      "targetTile": 2617,
      "targetX": 7,
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
        "label": "꽃 화단",
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

## 화분
```json
{
  "name": "화분",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 1,
  "height": 2,
  "layer": "upper",
  "sourceUpper": [
    [
      28
    ],
    [
      34
    ]
  ],
  "targetUpper": [
    [
      2632
    ],
    [
      2635
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 28,
      "sourceX": 4,
      "sourceY": 4,
      "pixelX": 64,
      "pixelY": 64,
      "targetTile": 2632,
      "targetX": 22,
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
        "label": "화분",
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
      "sourceTile": 34,
      "sourceX": 4,
      "sourceY": 5,
      "pixelX": 64,
      "pixelY": 80,
      "targetTile": 2635,
      "targetX": 25,
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
        "label": "화분",
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

## 새집
```json
{
  "name": "새집",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 1,
  "height": 2,
  "layer": "upper",
  "sourceUpper": [
    [
      14
    ],
    [
      20
    ]
  ],
  "targetUpper": [
    [
      2622
    ],
    [
      2627
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 14,
      "sourceX": 2,
      "sourceY": 2,
      "pixelX": 32,
      "pixelY": 32,
      "targetTile": 2622,
      "targetX": 12,
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
        "label": "새집",
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
      "sourceTile": 20,
      "sourceX": 2,
      "sourceY": 3,
      "pixelX": 32,
      "pixelY": 48,
      "targetTile": 2627,
      "targetX": 17,
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
        "label": "새집",
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

## 덩굴 아치
```json
{
  "name": "덩굴 아치",
  "tilesetId": "shared_forest_village_objects",
  "imageId": "tex_shared_forest_village_objects",
  "tileSize": 16,
  "tilesPerRow": 6,
  "width": 2,
  "height": 2,
  "layer": "upper",
  "sourceUpper": [
    [
      48,
      49
    ],
    [
      54,
      55
    ]
  ],
  "targetUpper": [
    [
      2643,
      2644
    ],
    [
      2647,
      2648
    ]
  ],
  "lower": "KEEP",
  "cells": [
    {
      "dx": 0,
      "dy": 0,
      "sourceTile": 48,
      "sourceX": 0,
      "sourceY": 8,
      "pixelX": 0,
      "pixelY": 128,
      "targetTile": 2643,
      "targetX": 3,
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
        "label": "덩굴 아치",
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
      "sourceTile": 49,
      "sourceX": 1,
      "sourceY": 8,
      "pixelX": 16,
      "pixelY": 128,
      "targetTile": 2644,
      "targetX": 4,
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
        "label": "덩굴 아치",
        "source": "user",
        "userLocked": true,
        "defaultLayer": "upper",
        "passage": "passable",
        "description": "Tibo 원본 → unfake.js 개별 보정, 16px 칩",
        "layerBacking": "none"
      }
    },
    {
      "dx": 0,
      "dy": 1,
      "sourceTile": 54,
      "sourceX": 0,
      "sourceY": 9,
      "pixelX": 0,
      "pixelY": 144,
      "targetTile": 2647,
      "targetX": 7,
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
        "label": "덩굴 아치",
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
      "dy": 1,
      "sourceTile": 55,
      "sourceX": 1,
      "sourceY": 9,
      "pixelX": 16,
      "pixelY": 144,
      "targetTile": 2648,
      "targetX": 8,
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
        "label": "덩굴 아치",
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
