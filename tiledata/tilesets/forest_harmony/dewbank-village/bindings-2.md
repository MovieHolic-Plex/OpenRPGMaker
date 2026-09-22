# 전체 사용 타일 225개 · 원본 결합과 레이어

폭·높이는 각 16×16. target 시트 30열. 원본은 tex_shared_forest_village_objects만 6열, 나머지 이 표의 원본들은 30열이다. 원본 칸=(sourceTile%열수,floor(sourceTile/열수)), 픽셀=칸×16. 아래 좌표는 그림의 원본 좌상단이다. 실제 어느 레이어에 놓이는지는 전체 배열이 정답이며, tileMeta.defaultLayer는 기본 추천이다.
```json
[
  {
    "tile": 386,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 386,
    "targetX": 26,
    "targetY": 12,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "roof",
      "label": "사선 지붕 캡",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "upper",
      "repeatability": "fixed"
    },
    "sourceX": 26,
    "sourceY": 12,
    "pixelX": 416,
    "pixelY": 192,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 387,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 387,
    "targetX": 27,
    "targetY": 12,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "roof",
      "label": "사선 지붕 캡",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "upper",
      "repeatability": "fixed"
    },
    "sourceX": 27,
    "sourceY": 12,
    "pixelX": 432,
    "pixelY": 192,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 388,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 388,
    "targetX": 28,
    "targetY": 12,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "세로 의자 하",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "upper",
      "repeatability": "fixed"
    },
    "sourceX": 28,
    "sourceY": 12,
    "pixelX": 448,
    "pixelY": 192,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 393,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 393,
    "targetX": 3,
    "targetY": 13,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "terrain",
      "label": "Desert edge",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 2,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "auto"
    },
    "sourceX": 3,
    "sourceY": 13,
    "pixelX": 48,
    "pixelY": 208,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 394,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 394,
    "targetX": 4,
    "targetY": 13,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "terrain",
      "label": "Desert edge",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 2,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "auto"
    },
    "sourceX": 4,
    "sourceY": 13,
    "pixelX": 64,
    "pixelY": 208,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 395,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 395,
    "targetX": 5,
    "targetY": 13,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "terrain",
      "label": "Desert edge",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 2,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "auto"
    },
    "sourceX": 5,
    "sourceY": 13,
    "pixelX": 80,
    "pixelY": 208,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 404,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 404,
    "targetX": 14,
    "targetY": 13,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "building",
      "label": "지붕-벽 경계",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "fixed"
    },
    "sourceX": 14,
    "sourceY": 13,
    "pixelX": 224,
    "pixelY": 208,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 405,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 405,
    "targetX": 15,
    "targetY": 13,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "building",
      "label": "지붕-벽 경계",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "fixed"
    },
    "sourceX": 15,
    "sourceY": 13,
    "pixelX": 240,
    "pixelY": 208,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 406,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 406,
    "targetX": 16,
    "targetY": 13,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "building",
      "label": "지붕-벽 경계",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "fixed"
    },
    "sourceX": 16,
    "sourceY": 13,
    "pixelX": 256,
    "pixelY": 208,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 407,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 407,
    "targetX": 17,
    "targetY": 13,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "building",
      "label": "지붕-벽 경계",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "fixed"
    },
    "sourceX": 17,
    "sourceY": 13,
    "pixelX": 272,
    "pixelY": 208,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 423,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 423,
    "targetX": 3,
    "targetY": 14,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "terrain",
      "label": "Desert edge",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 2,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "auto"
    },
    "sourceX": 3,
    "sourceY": 14,
    "pixelX": 48,
    "pixelY": 224,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 424,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 424,
    "targetX": 4,
    "targetY": 14,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "terrain",
      "label": "Desert sand",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 2,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "auto"
    },
    "sourceX": 4,
    "sourceY": 14,
    "pixelX": 64,
    "pixelY": 224,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 425,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 425,
    "targetX": 5,
    "targetY": 14,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "terrain",
      "label": "Desert edge",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 2,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "auto"
    },
    "sourceX": 5,
    "sourceY": 14,
    "pixelX": 80,
    "pixelY": 224,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 436,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 436,
    "targetX": 16,
    "targetY": 14,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "building",
      "label": "지붕-벽 경계",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "fixed"
    },
    "sourceX": 16,
    "sourceY": 14,
    "pixelX": 256,
    "pixelY": 224,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 437,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 437,
    "targetX": 17,
    "targetY": 14,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "building",
      "label": "지붕-벽 경계",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "fixed"
    },
    "sourceX": 17,
    "sourceY": 14,
    "pixelX": 272,
    "pixelY": 224,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 440,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 440,
    "targetX": 20,
    "targetY": 14,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "팻말",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "upper",
      "repeatability": "fixed"
    },
    "sourceX": 20,
    "sourceY": 14,
    "pixelX": 320,
    "pixelY": 224,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 443,
    "sourceChipset": "tex_easyrpg_chipset_retro_house",
    "sourceTile": 443,
    "targetX": 23,
    "targetY": 14,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "",
      "description": ""
    },
    "sourceX": 23,
    "sourceY": 14,
    "pixelX": 368,
    "pixelY": 224,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 453,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 453,
    "targetX": 3,
    "targetY": 15,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "terrain",
      "label": "Desert edge",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 2,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "auto"
    },
    "sourceX": 3,
    "sourceY": 15,
    "pixelX": 48,
    "pixelY": 240,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 454,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 454,
    "targetX": 4,
    "targetY": 15,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "terrain",
      "label": "Desert edge",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 2,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "auto"
    },
    "sourceX": 4,
    "sourceY": 15,
    "pixelX": 64,
    "pixelY": 240,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 455,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 455,
    "targetX": 5,
    "targetY": 15,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "terrain",
      "label": "Desert edge",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 2,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "auto"
    },
    "sourceX": 5,
    "sourceY": 15,
    "pixelX": 80,
    "pixelY": 240,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 467,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 467,
    "targetX": 17,
    "targetY": 15,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "building",
      "label": "지붕-벽 경계",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "fixed"
    },
    "sourceX": 17,
    "sourceY": 15,
    "pixelX": 272,
    "pixelY": 240,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 472,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 472,
    "targetX": 22,
    "targetY": 15,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "",
      "description": ""
    },
    "sourceX": 22,
    "sourceY": 15,
    "pixelX": 352,
    "pixelY": 240,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 473,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 473,
    "targetX": 23,
    "targetY": 15,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "",
      "description": ""
    },
    "sourceX": 23,
    "sourceY": 15,
    "pixelX": 368,
    "pixelY": 240,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 978,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 978,
    "targetX": 18,
    "targetY": 32,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "투명",
        "수관"
      ],
      "label": "Tibo tree 1,1",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "star",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (1,1). 수관은 상위 레이어(★)로 사람 위에 그려지고 지나갈 수 있다.",
      "defaultLayer": "upper",
      "layerBacking": "none",
      "repeatability": "fixed"
    },
    "sourceX": 18,
    "sourceY": 32,
    "pixelX": 288,
    "pixelY": 512,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 979,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 979,
    "targetX": 19,
    "targetY": 32,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "투명",
        "수관"
      ],
      "label": "Tibo tree 2,1",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "star",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (2,1). 수관은 상위 레이어(★)로 사람 위에 그려지고 지나갈 수 있다.",
      "defaultLayer": "upper",
      "layerBacking": "none",
      "repeatability": "fixed"
    },
    "sourceX": 19,
    "sourceY": 32,
    "pixelX": 304,
    "pixelY": 512,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 980,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 980,
    "targetX": 20,
    "targetY": 32,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "투명",
        "수관"
      ],
      "label": "Tibo tree 3,1",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "star",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (3,1). 수관은 상위 레이어(★)로 사람 위에 그려지고 지나갈 수 있다.",
      "defaultLayer": "upper",
      "layerBacking": "none",
      "repeatability": "fixed"
    },
    "sourceX": 20,
    "sourceY": 32,
    "pixelX": 320,
    "pixelY": 512,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 983,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 983,
    "targetX": 23,
    "targetY": 32,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "둥근 덤불",
        "밑동"
      ],
      "label": "Tibo round-bush 1,1",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 둥근 덤불 3×3 칸의 (1,1). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 23,
    "sourceY": 32,
    "pixelX": 368,
    "pixelY": 512,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 984,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 984,
    "targetX": 24,
    "targetY": 32,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "둥근 덤불",
        "밑동"
      ],
      "label": "Tibo round-bush 2,1",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 둥근 덤불 3×3 칸의 (2,1). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 24,
    "sourceY": 32,
    "pixelX": 384,
    "pixelY": 512,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 985,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 985,
    "targetX": 25,
    "targetY": 32,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "둥근 덤불",
        "밑동"
      ],
      "label": "Tibo round-bush 3,1",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 둥근 덤불 3×3 칸의 (3,1). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 25,
    "sourceY": 32,
    "pixelX": 400,
    "pixelY": 512,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1008,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1008,
    "targetX": 18,
    "targetY": 33,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "투명",
        "수관"
      ],
      "label": "Tibo tree 1,2",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "star",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (1,2). 수관은 상위 레이어(★)로 사람 위에 그려지고 지나갈 수 있다.",
      "defaultLayer": "upper",
      "layerBacking": "none",
      "repeatability": "fixed"
    },
    "sourceX": 18,
    "sourceY": 33,
    "pixelX": 288,
    "pixelY": 528,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 1009,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1009,
    "targetX": 19,
    "targetY": 33,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "투명",
        "수관"
      ],
      "label": "Tibo tree 2,2",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "star",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (2,2). 수관은 상위 레이어(★)로 사람 위에 그려지고 지나갈 수 있다.",
      "defaultLayer": "upper",
      "layerBacking": "none",
      "repeatability": "fixed"
    },
    "sourceX": 19,
    "sourceY": 33,
    "pixelX": 304,
    "pixelY": 528,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 1010,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1010,
    "targetX": 20,
    "targetY": 33,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "투명",
        "수관"
      ],
      "label": "Tibo tree 3,2",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "star",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (3,2). 수관은 상위 레이어(★)로 사람 위에 그려지고 지나갈 수 있다.",
      "defaultLayer": "upper",
      "layerBacking": "none",
      "repeatability": "fixed"
    },
    "sourceX": 20,
    "sourceY": 33,
    "pixelX": 320,
    "pixelY": 528,
    "usedLayers": [
      "upper"
    ]
  },
  {
    "tile": 1013,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1013,
    "targetX": 23,
    "targetY": 33,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "둥근 덤불",
        "밑동"
      ],
      "label": "Tibo round-bush 1,2",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 둥근 덤불 3×3 칸의 (1,2). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 23,
    "sourceY": 33,
    "pixelX": 368,
    "pixelY": 528,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1014,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1014,
    "targetX": 24,
    "targetY": 33,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "둥근 덤불",
        "밑동"
      ],
      "label": "Tibo round-bush 2,2",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 둥근 덤불 3×3 칸의 (2,2). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 24,
    "sourceY": 33,
    "pixelX": 384,
    "pixelY": 528,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1015,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1015,
    "targetX": 25,
    "targetY": 33,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "둥근 덤불",
        "밑동"
      ],
      "label": "Tibo round-bush 3,2",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 둥근 덤불 3×3 칸의 (3,2). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 25,
    "sourceY": 33,
    "pixelX": 400,
    "pixelY": 528,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1038,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1038,
    "targetX": 18,
    "targetY": 34,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "투명",
        "가장자리"
      ],
      "label": "Tibo tree 1,3",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (1,3). 가장자리 조각은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 있다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 18,
    "sourceY": 34,
    "pixelX": 288,
    "pixelY": 544,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1039,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1039,
    "targetX": 19,
    "targetY": 34,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "밑동"
      ],
      "label": "Tibo tree 2,3",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (2,3). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 19,
    "sourceY": 34,
    "pixelX": 304,
    "pixelY": 544,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1040,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1040,
    "targetX": 20,
    "targetY": 34,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "투명",
        "가장자리"
      ],
      "label": "Tibo tree 3,3",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (3,3). 가장자리 조각은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 있다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 20,
    "sourceY": 34,
    "pixelX": 320,
    "pixelY": 544,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1043,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1043,
    "targetX": 23,
    "targetY": 34,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "둥근 덤불",
        "밑동"
      ],
      "label": "Tibo round-bush 1,3",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 둥근 덤불 3×3 칸의 (1,3). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 23,
    "sourceY": 34,
    "pixelX": 368,
    "pixelY": 544,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1044,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1044,
    "targetX": 24,
    "targetY": 34,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "둥근 덤불",
        "밑동"
      ],
      "label": "Tibo round-bush 2,3",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 둥근 덤불 3×3 칸의 (2,3). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 24,
    "sourceY": 34,
    "pixelX": 384,
    "pixelY": 544,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1045,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1045,
    "targetX": 25,
    "targetY": 34,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "둥근 덤불",
        "밑동"
      ],
      "label": "Tibo round-bush 3,3",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 둥근 덤불 3×3 칸의 (3,3). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 25,
    "sourceY": 34,
    "pixelX": 400,
    "pixelY": 544,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1068,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1068,
    "targetX": 18,
    "targetY": 35,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "투명",
        "가장자리"
      ],
      "label": "Tibo tree 1,4",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (1,4). 가장자리 조각은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 있다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 18,
    "sourceY": 35,
    "pixelX": 288,
    "pixelY": 560,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1069,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1069,
    "targetX": 19,
    "targetY": 35,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "밑동"
      ],
      "label": "Tibo tree 2,4",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (2,4). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 19,
    "sourceY": 35,
    "pixelX": 304,
    "pixelY": 560,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1070,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1070,
    "targetX": 20,
    "targetY": 35,
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "활엽수",
        "투명",
        "가장자리"
      ],
      "label": "Tibo tree 3,4",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 활엽수 3×4 칸의 (3,4). 가장자리 조각은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 있다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    },
    "sourceX": 20,
    "sourceY": 35,
    "pixelX": 320,
    "pixelY": 560,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1350,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1350,
    "targetX": 0,
    "targetY": 45,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "연속 숲 30",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1141,
      "description": ""
    },
    "sourceX": 0,
    "sourceY": 45,
    "pixelX": 0,
    "pixelY": 720,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1422,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1422,
    "targetX": 12,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 12,
    "sourceY": 47,
    "pixelX": 192,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1423,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1423,
    "targetX": 13,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 13,
    "sourceY": 47,
    "pixelX": 208,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1424,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1424,
    "targetX": 14,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 14,
    "sourceY": 47,
    "pixelX": 224,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1425,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1425,
    "targetX": 15,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 15,
    "sourceY": 47,
    "pixelX": 240,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1426,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1426,
    "targetX": 16,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 16,
    "sourceY": 47,
    "pixelX": 256,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1427,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1427,
    "targetX": 17,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 17,
    "sourceY": 47,
    "pixelX": 272,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1428,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1428,
    "targetX": 18,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 18,
    "sourceY": 47,
    "pixelX": 288,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1429,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1429,
    "targetX": 19,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 19,
    "sourceY": 47,
    "pixelX": 304,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1430,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1430,
    "targetX": 20,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 20,
    "sourceY": 47,
    "pixelX": 320,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1431,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1431,
    "targetX": 21,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 21,
    "sourceY": 47,
    "pixelX": 336,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1432,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1432,
    "targetX": 22,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 22,
    "sourceY": 47,
    "pixelX": 352,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1433,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1433,
    "targetX": 23,
    "targetY": 47,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 23,
    "sourceY": 47,
    "pixelX": 368,
    "pixelY": 752,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1453,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1453,
    "targetX": 13,
    "targetY": 48,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 13,
    "sourceY": 48,
    "pixelX": 208,
    "pixelY": 768,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1454,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1454,
    "targetX": 14,
    "targetY": 48,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 14,
    "sourceY": 48,
    "pixelX": 224,
    "pixelY": 768,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1455,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1455,
    "targetX": 15,
    "targetY": 48,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 15,
    "sourceY": 48,
    "pixelX": 240,
    "pixelY": 768,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1457,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1457,
    "targetX": 17,
    "targetY": 48,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 17,
    "sourceY": 48,
    "pixelX": 272,
    "pixelY": 768,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1458,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1458,
    "targetX": 18,
    "targetY": 48,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 18,
    "sourceY": 48,
    "pixelX": 288,
    "pixelY": 768,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1459,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1459,
    "targetX": 19,
    "targetY": 48,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 19,
    "sourceY": 48,
    "pixelX": 304,
    "pixelY": 768,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1461,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1461,
    "targetX": 21,
    "targetY": 48,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 21,
    "sourceY": 48,
    "pixelX": 336,
    "pixelY": 768,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1462,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1462,
    "targetX": 22,
    "targetY": 48,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 22,
    "sourceY": 48,
    "pixelX": 352,
    "pixelY": 768,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1463,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1463,
    "targetX": 23,
    "targetY": 48,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 23,
    "sourceY": 48,
    "pixelX": 368,
    "pixelY": 768,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1533,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1533,
    "targetX": 3,
    "targetY": 51,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1533",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 3,
    "sourceY": 51,
    "pixelX": 48,
    "pixelY": 816,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1537,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1537,
    "targetX": 7,
    "targetY": 51,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1537",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 7,
    "sourceY": 51,
    "pixelX": 112,
    "pixelY": 816,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1541,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1541,
    "targetX": 11,
    "targetY": 51,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1541",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 11,
    "sourceY": 51,
    "pixelX": 176,
    "pixelY": 816,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1543,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1543,
    "targetX": 13,
    "targetY": 51,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1543",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 13,
    "sourceY": 51,
    "pixelX": 208,
    "pixelY": 816,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1548,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1548,
    "targetX": 18,
    "targetY": 51,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1548",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 18,
    "sourceY": 51,
    "pixelX": 288,
    "pixelY": 816,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1550,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1550,
    "targetX": 20,
    "targetY": 51,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1550",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 20,
    "sourceY": 51,
    "pixelX": 320,
    "pixelY": 816,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1551,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1551,
    "targetX": 21,
    "targetY": 51,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1551",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 21,
    "sourceY": 51,
    "pixelX": 336,
    "pixelY": 816,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1555,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1555,
    "targetX": 25,
    "targetY": 51,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1555",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 25,
    "sourceY": 51,
    "pixelX": 400,
    "pixelY": 816,
    "usedLayers": [
      "lower"
    ]
  },
  {
    "tile": 1558,
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1558,
    "targetX": 28,
    "targetY": 51,
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "lake 연결 1558",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    },
    "sourceX": 28,
    "sourceY": 51,
    "pixelX": 448,
    "pixelY": 816,
    "usedLayers": [
      "lower"
    ]
  }
]
```
