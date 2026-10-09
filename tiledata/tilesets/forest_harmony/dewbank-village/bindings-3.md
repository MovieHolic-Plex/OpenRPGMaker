# 전체 사용 타일 225개 · 원본 결합과 레이어

폭·높이는 각 16×16. target 시트 30열. 원본은 tex_shared_forest_village_objects만 6열, 나머지 이 표의 원본들은 30열이다. 원본 칸=(sourceTile%열수,floor(sourceTile/열수)), 픽셀=칸×16. 아래 좌표는 그림의 원본 좌상단이다. 실제 어느 레이어에 놓이는지는 전체 배열이 정답이며, tileMeta.defaultLayer는 기본 추천이다.
```json
[
  {
    "tile": 1559,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1559,
    "targetX": 29,
    "targetY": 51,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1559",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 29,
    "sourceY": 51,
    "pixelX": 464,
    "pixelY": 816,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1561,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1561,
    "targetX": 1,
    "targetY": 52,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1561",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 1,
    "sourceY": 52,
    "pixelX": 16,
    "pixelY": 832,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1562,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1562,
    "targetX": 2,
    "targetY": 52,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1562",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 2,
    "sourceY": 52,
    "pixelX": 32,
    "pixelY": 832,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1563,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1563,
    "targetX": 3,
    "targetY": 52,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1563",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 3,
    "sourceY": 52,
    "pixelX": 48,
    "pixelY": 832,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 2552,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 1566,
    "targetX": 2,
    "targetY": 85,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 6,
    "sourceY": 52,
    "pixelX": 96,
    "pixelY": 832,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2553,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 1568,
    "targetX": 3,
    "targetY": 85,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 8,
    "sourceY": 52,
    "pixelX": 128,
    "pixelY": 832,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2554,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 1569,
    "targetX": 4,
    "targetY": 85,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 9,
    "sourceY": 52,
    "pixelX": 144,
    "pixelY": 832,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2555,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 1572,
    "targetX": 5,
    "targetY": 85,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 12,
    "sourceY": 52,
    "pixelX": 192,
    "pixelY": 832,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2556,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 1574,
    "targetX": 6,
    "targetY": 85,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 14,
    "sourceY": 52,
    "pixelX": 224,
    "pixelY": 832,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2563,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 1585,
    "targetX": 13,
    "targetY": 85,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 25,
    "sourceY": 52,
    "pixelX": 400,
    "pixelY": 832,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2567,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 1591,
    "targetX": 17,
    "targetY": 85,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 1,
    "sourceY": 53,
    "pixelX": 16,
    "pixelY": 848,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2568,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 1617,
    "targetX": 18,
    "targetY": 85,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 27,
    "sourceY": 53,
    "pixelX": 432,
    "pixelY": 848,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2577,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2558,
    "targetX": 27,
    "targetY": 85,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 8,
    "sourceY": 85,
    "pixelX": 128,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2580,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2561,
    "targetX": 0,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 11,
    "sourceY": 85,
    "pixelX": 176,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2581,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2562,
    "targetX": 1,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 12,
    "sourceY": 85,
    "pixelX": 192,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2582,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2563,
    "targetX": 2,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 13,
    "sourceY": 85,
    "pixelX": 208,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2583,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2564,
    "targetX": 3,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 14,
    "sourceY": 85,
    "pixelX": 224,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2584,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2565,
    "targetX": 4,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 15,
    "sourceY": 85,
    "pixelX": 240,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2586,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2567,
    "targetX": 6,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 17,
    "sourceY": 85,
    "pixelX": 272,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2587,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2568,
    "targetX": 7,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 18,
    "sourceY": 85,
    "pixelX": 288,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2588,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2569,
    "targetX": 8,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 19,
    "sourceY": 85,
    "pixelX": 304,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2589,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2570,
    "targetX": 9,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 20,
    "sourceY": 85,
    "pixelX": 320,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2590,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2571,
    "targetX": 10,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 21,
    "sourceY": 85,
    "pixelX": 336,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2592,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2573,
    "targetX": 12,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 23,
    "sourceY": 85,
    "pixelX": 368,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2593,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2574,
    "targetX": 13,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 24,
    "sourceY": 85,
    "pixelX": 384,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2594,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2575,
    "targetX": 14,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 25,
    "sourceY": 85,
    "pixelX": 400,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2595,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2576,
    "targetX": 15,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 26,
    "sourceY": 85,
    "pixelX": 416,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2596,
    "sourceChipset": "tex_forest_cliff_reference",
    "sourceTile": 2577,
    "targetX": 16,
    "targetY": 86,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "굽이숲 수관",
      "description": "굽이숲 수관 이식 칸. 상위·통행 불가.",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "upper",
      "layerBacking": "none"
    },
    "sourceX": 27,
    "sourceY": 85,
    "pixelX": 432,
    "pixelY": 1360,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2610,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 0,
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
    },
    "sourceX": 0,
    "sourceY": 0,
    "pixelX": 0,
    "pixelY": 0,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2611,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 2,
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
    },
    "sourceX": 2,
    "sourceY": 0,
    "pixelX": 32,
    "pixelY": 0,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2612,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 3,
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
    },
    "sourceX": 3,
    "sourceY": 0,
    "pixelX": 48,
    "pixelY": 0,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2613,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 4,
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
    },
    "sourceX": 4,
    "sourceY": 0,
    "pixelX": 64,
    "pixelY": 0,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2614,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 5,
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
    },
    "sourceX": 5,
    "sourceY": 0,
    "pixelX": 80,
    "pixelY": 0,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2615,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 6,
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
    },
    "sourceX": 0,
    "sourceY": 1,
    "pixelX": 0,
    "pixelY": 16,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2616,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 8,
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
    },
    "sourceX": 2,
    "sourceY": 1,
    "pixelX": 32,
    "pixelY": 16,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2617,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 9,
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
    },
    "sourceX": 3,
    "sourceY": 1,
    "pixelX": 48,
    "pixelY": 16,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2618,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 10,
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
    },
    "sourceX": 4,
    "sourceY": 1,
    "pixelX": 64,
    "pixelY": 16,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2619,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 11,
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
    },
    "sourceX": 5,
    "sourceY": 1,
    "pixelX": 80,
    "pixelY": 16,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2620,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 12,
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
    },
    "sourceX": 0,
    "sourceY": 2,
    "pixelX": 0,
    "pixelY": 32,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2621,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 13,
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
    },
    "sourceX": 1,
    "sourceY": 2,
    "pixelX": 16,
    "pixelY": 32,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2622,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 14,
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
    },
    "sourceX": 2,
    "sourceY": 2,
    "pixelX": 32,
    "pixelY": 32,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2623,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 16,
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
    },
    "sourceX": 4,
    "sourceY": 2,
    "pixelX": 64,
    "pixelY": 32,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2624,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 17,
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
    },
    "sourceX": 5,
    "sourceY": 2,
    "pixelX": 80,
    "pixelY": 32,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2625,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 18,
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
    },
    "sourceX": 0,
    "sourceY": 3,
    "pixelX": 0,
    "pixelY": 48,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2626,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 19,
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
    },
    "sourceX": 1,
    "sourceY": 3,
    "pixelX": 16,
    "pixelY": 48,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2627,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 20,
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
    },
    "sourceX": 2,
    "sourceY": 3,
    "pixelX": 32,
    "pixelY": 48,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2628,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 24,
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
    },
    "sourceX": 0,
    "sourceY": 4,
    "pixelX": 0,
    "pixelY": 64,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2629,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 25,
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
    },
    "sourceX": 1,
    "sourceY": 4,
    "pixelX": 16,
    "pixelY": 64,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2630,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 26,
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
    },
    "sourceX": 2,
    "sourceY": 4,
    "pixelX": 32,
    "pixelY": 64,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2631,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 27,
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
    },
    "sourceX": 3,
    "sourceY": 4,
    "pixelX": 48,
    "pixelY": 64,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2632,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 28,
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
    },
    "sourceX": 4,
    "sourceY": 4,
    "pixelX": 64,
    "pixelY": 64,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2633,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 32,
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
    },
    "sourceX": 2,
    "sourceY": 5,
    "pixelX": 32,
    "pixelY": 80,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2634,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 33,
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
    },
    "sourceX": 3,
    "sourceY": 5,
    "pixelX": 48,
    "pixelY": 80,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2635,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 34,
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
    },
    "sourceX": 4,
    "sourceY": 5,
    "pixelX": 64,
    "pixelY": 80,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2636,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 36,
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
    },
    "sourceX": 0,
    "sourceY": 6,
    "pixelX": 0,
    "pixelY": 96,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2637,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 37,
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
    },
    "sourceX": 1,
    "sourceY": 6,
    "pixelX": 16,
    "pixelY": 96,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2638,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 38,
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
    },
    "sourceX": 2,
    "sourceY": 6,
    "pixelX": 32,
    "pixelY": 96,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2639,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 40,
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
    },
    "sourceX": 4,
    "sourceY": 6,
    "pixelX": 64,
    "pixelY": 96,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2640,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 41,
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
    },
    "sourceX": 5,
    "sourceY": 6,
    "pixelX": 80,
    "pixelY": 96,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2641,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 46,
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
    },
    "sourceX": 4,
    "sourceY": 7,
    "pixelX": 64,
    "pixelY": 112,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2642,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 47,
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
    },
    "sourceX": 5,
    "sourceY": 7,
    "pixelX": 80,
    "pixelY": 112,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2643,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 48,
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
    },
    "sourceX": 0,
    "sourceY": 8,
    "pixelX": 0,
    "pixelY": 128,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2644,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 49,
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
    },
    "sourceX": 1,
    "sourceY": 8,
    "pixelX": 16,
    "pixelY": 128,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2645,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 50,
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
    },
    "sourceX": 2,
    "sourceY": 8,
    "pixelX": 32,
    "pixelY": 128,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2646,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 52,
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
    },
    "sourceX": 4,
    "sourceY": 8,
    "pixelX": 64,
    "pixelY": 128,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2647,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 54,
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
    },
    "sourceX": 0,
    "sourceY": 9,
    "pixelX": 0,
    "pixelY": 144,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2648,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 55,
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
    },
    "sourceX": 1,
    "sourceY": 9,
    "pixelX": 16,
    "pixelY": 144,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2649,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 60,
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
    },
    "sourceX": 0,
    "sourceY": 10,
    "pixelX": 0,
    "pixelY": 160,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2650,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 61,
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
    },
    "sourceX": 1,
    "sourceY": 10,
    "pixelX": 16,
    "pixelY": 160,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2651,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 62,
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
    },
    "sourceX": 2,
    "sourceY": 10,
    "pixelX": 32,
    "pixelY": 160,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2652,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 64,
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
    },
    "sourceX": 4,
    "sourceY": 10,
    "pixelX": 64,
    "pixelY": 160,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2653,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 65,
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
    },
    "sourceX": 5,
    "sourceY": 10,
    "pixelX": 80,
    "pixelY": 160,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2654,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 68,
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
    },
    "sourceX": 2,
    "sourceY": 11,
    "pixelX": 32,
    "pixelY": 176,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2655,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 72,
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
    },
    "sourceX": 0,
    "sourceY": 12,
    "pixelX": 0,
    "pixelY": 192,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 2656,
    "sourceChipset": "tex_shared_forest_village_objects",
    "sourceTile": 78,
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
    },
    "sourceX": 0,
    "sourceY": 13,
    "pixelX": 0,
    "pixelY": 208,
    "usedLayers": [
      "upper"
    ]
  }
]
```
