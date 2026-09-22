# 사용 타일 부품 사전

source는 원본 시트, target은 이 마을용 합성 시트다. 0기준. 폭/높이는 픽셀이다. 레이어와 통행은 별개.
```json
[
  {
    "tile": 236,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 236,
    "sourceX": 26,
    "sourceY": 7,
    "pixelX": 416,
    "pixelY": 112,
    "width": 16,
    "height": 16,
    "targetX": 26,
    "targetY": 7,
    "layers": [
      "upper"
    ],
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
  },
  {
    "tile": 237,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 237,
    "sourceX": 27,
    "sourceY": 7,
    "pixelX": 432,
    "pixelY": 112,
    "width": 16,
    "height": 16,
    "targetX": 27,
    "targetY": 7,
    "layers": [
      "upper"
    ],
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
  },
  {
    "tile": 240,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 240,
    "sourceX": 0,
    "sourceY": 8,
    "pixelX": 0,
    "pixelY": 128,
    "width": 16,
    "height": 16,
    "targetX": 0,
    "targetY": 8,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "lower",
    "tileMeta": {
      "role": "terrain",
      "label": "잔디",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "auto"
    }
  },
  {
    "tile": 248,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 248,
    "sourceX": 8,
    "sourceY": 8,
    "pixelX": 128,
    "pixelY": 128,
    "width": 16,
    "height": 16,
    "targetX": 8,
    "targetY": 8,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "성 안뜰 돌바닥 · 오목 모서리",
      "description": "안뜰이 꺾이는 안쪽 모서리.",
      "role": "wall",
      "defaultLayer": "lower",
      "passage": "solid"
    }
  },
  {
    "tile": 265,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 265,
    "sourceX": 25,
    "sourceY": 8,
    "pixelX": 400,
    "pixelY": 128,
    "width": 16,
    "height": 16,
    "targetX": 25,
    "targetY": 8,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "벽 덩굴 위",
      "description": "벽을 타고 오른 덩굴 윗칸. 아래 295·325. 손길이 끊긴 폐가 벽에 겹친다.",
      "role": "prop",
      "defaultLayer": "upper",
      "passage": "solid"
    }
  },
  {
    "tile": 266,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 266,
    "sourceX": 26,
    "sourceY": 8,
    "pixelX": 416,
    "pixelY": 128,
    "width": 16,
    "height": 16,
    "targetX": 26,
    "targetY": 8,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "석상 상단",
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
    "tile": 267,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 267,
    "sourceX": 27,
    "sourceY": 8,
    "pixelX": 432,
    "pixelY": 128,
    "width": 16,
    "height": 16,
    "targetX": 27,
    "targetY": 8,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "돌기둥 상단",
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
    "tile": 276,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 276,
    "sourceX": 6,
    "sourceY": 9,
    "pixelX": 96,
    "pixelY": 144,
    "width": 16,
    "height": 16,
    "targetX": 6,
    "targetY": 9,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "성 안뜰 돌바닥",
      "description": "성 안뜰 3×3 가장자리 조립(276~278 윗변, 306~308 가운데, 336~338 아랫변). 오목 모서리는 248.",
      "role": "wall",
      "defaultLayer": "lower",
      "passage": "solid"
    }
  },
  {
    "tile": 277,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 277,
    "sourceX": 7,
    "sourceY": 9,
    "pixelX": 112,
    "pixelY": 144,
    "width": 16,
    "height": 16,
    "targetX": 7,
    "targetY": 9,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "성 안뜰 돌바닥",
      "description": "성 안뜰 3×3 가장자리 조립(276~278 윗변, 306~308 가운데, 336~338 아랫변). 오목 모서리는 248.",
      "role": "wall",
      "defaultLayer": "lower",
      "passage": "solid"
    }
  },
  {
    "tile": 278,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 278,
    "sourceX": 8,
    "sourceY": 9,
    "pixelX": 128,
    "pixelY": 144,
    "width": 16,
    "height": 16,
    "targetX": 8,
    "targetY": 9,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "성 안뜰 돌바닥",
      "description": "성 안뜰 3×3 가장자리 조립(276~278 윗변, 306~308 가운데, 336~338 아랫변). 오목 모서리는 248.",
      "role": "wall",
      "defaultLayer": "lower",
      "passage": "solid"
    }
  },
  {
    "tile": 289,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 289,
    "sourceX": 19,
    "sourceY": 9,
    "pixelX": 304,
    "pixelY": 144,
    "width": 16,
    "height": 16,
    "targetX": 19,
    "targetY": 9,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "덤불",
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
    "tile": 295,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 295,
    "sourceX": 25,
    "sourceY": 9,
    "pixelX": 400,
    "pixelY": 144,
    "width": 16,
    "height": 16,
    "targetX": 25,
    "targetY": 9,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "벽 덩굴 가운데",
      "description": "벽 덩굴 가운데 칸.",
      "role": "prop",
      "defaultLayer": "upper",
      "passage": "solid"
    }
  },
  {
    "tile": 296,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 296,
    "sourceX": 26,
    "sourceY": 9,
    "pixelX": 416,
    "pixelY": 144,
    "width": 16,
    "height": 16,
    "targetX": 26,
    "targetY": 9,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "석상 하단",
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
    "tile": 297,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 297,
    "sourceX": 27,
    "sourceY": 9,
    "pixelX": 432,
    "pixelY": 144,
    "width": 16,
    "height": 16,
    "targetX": 27,
    "targetY": 9,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "돌기둥 하단",
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
    "tile": 306,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 306,
    "sourceX": 6,
    "sourceY": 10,
    "pixelX": 96,
    "pixelY": 160,
    "width": 16,
    "height": 16,
    "targetX": 6,
    "targetY": 10,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "성 안뜰 돌바닥",
      "description": "성 안뜰 3×3 가장자리 조립(276~278 윗변, 306~308 가운데, 336~338 아랫변). 오목 모서리는 248.",
      "role": "wall",
      "defaultLayer": "lower",
      "passage": "solid"
    }
  },
  {
    "tile": 307,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 307,
    "sourceX": 7,
    "sourceY": 10,
    "pixelX": 112,
    "pixelY": 160,
    "width": 16,
    "height": 16,
    "targetX": 7,
    "targetY": 10,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "성 안뜰 돌바닥",
      "description": "성 안뜰 3×3 가장자리 조립(276~278 윗변, 306~308 가운데, 336~338 아랫변). 오목 모서리는 248.",
      "role": "wall",
      "defaultLayer": "lower",
      "passage": "solid"
    }
  },
  {
    "tile": 308,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 308,
    "sourceX": 8,
    "sourceY": 10,
    "pixelX": 128,
    "pixelY": 160,
    "width": 16,
    "height": 16,
    "targetX": 8,
    "targetY": 10,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "성 안뜰 돌바닥",
      "description": "성 안뜰 3×3 가장자리 조립(276~278 윗변, 306~308 가운데, 336~338 아랫변). 오목 모서리는 248.",
      "role": "wall",
      "defaultLayer": "lower",
      "passage": "solid"
    }
  },
  {
    "tile": 323,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 323,
    "sourceX": 23,
    "sourceY": 10,
    "pixelX": 368,
    "pixelY": 160,
    "width": 16,
    "height": 16,
    "targetX": 23,
    "targetY": 10,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "묘지",
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
    "tile": 327,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 327,
    "sourceX": 27,
    "sourceY": 10,
    "pixelX": 432,
    "pixelY": 160,
    "width": 16,
    "height": 16,
    "targetX": 27,
    "targetY": 10,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "벤치 좌",
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
    "tile": 328,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 328,
    "sourceX": 28,
    "sourceY": 10,
    "pixelX": 448,
    "pixelY": 160,
    "width": 16,
    "height": 16,
    "targetX": 28,
    "targetY": 10,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "벤치 우",
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
    "tile": 329,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 329,
    "sourceX": 29,
    "sourceY": 10,
    "pixelX": 464,
    "pixelY": 160,
    "width": 16,
    "height": 16,
    "targetX": 29,
    "targetY": 10,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "building",
      "label": "문/입구",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "fixed"
    }
  },
  {
    "tile": 336,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 336,
    "sourceX": 6,
    "sourceY": 11,
    "pixelX": 96,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 6,
    "targetY": 11,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "성 안뜰 돌바닥",
      "description": "성 안뜰 3×3 가장자리 조립(276~278 윗변, 306~308 가운데, 336~338 아랫변). 오목 모서리는 248.",
      "role": "wall",
      "defaultLayer": "lower",
      "passage": "solid"
    }
  },
  {
    "tile": 337,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 337,
    "sourceX": 7,
    "sourceY": 11,
    "pixelX": 112,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 7,
    "targetY": 11,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "성 안뜰 돌바닥",
      "description": "성 안뜰 3×3 가장자리 조립(276~278 윗변, 306~308 가운데, 336~338 아랫변). 오목 모서리는 248.",
      "role": "wall",
      "defaultLayer": "lower",
      "passage": "solid"
    }
  },
  {
    "tile": 338,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 338,
    "sourceX": 8,
    "sourceY": 11,
    "pixelX": 128,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 8,
    "targetY": 11,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "성 안뜰 돌바닥",
      "description": "성 안뜰 3×3 가장자리 조립(276~278 윗변, 306~308 가운데, 336~338 아랫변). 오목 모서리는 248.",
      "role": "wall",
      "defaultLayer": "lower",
      "passage": "solid"
    }
  },
  {
    "tile": 348,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 348,
    "sourceX": 18,
    "sourceY": 11,
    "pixelX": 288,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 18,
    "targetY": 11,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "Flowers",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "upper",
      "repeatability": "fixed"
    }
  },
  {
    "tile": 349,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 349,
    "sourceX": 19,
    "sourceY": 11,
    "pixelX": 304,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 19,
    "targetY": 11,
    "layers": [
      "upper"
    ],
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
  },
  {
    "tile": 350,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 350,
    "sourceX": 20,
    "sourceY": 11,
    "pixelX": 320,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 20,
    "targetY": 11,
    "layers": [
      "upper"
    ],
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
  },
  {
    "tile": 351,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 351,
    "sourceX": 21,
    "sourceY": 11,
    "pixelX": 336,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 21,
    "targetY": 11,
    "layers": [
      "upper"
    ],
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
    "tile": 352,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 352,
    "sourceX": 22,
    "sourceY": 11,
    "pixelX": 352,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 22,
    "targetY": 11,
    "layers": [
      "upper"
    ],
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
  },
  {
    "tile": 353,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 353,
    "sourceX": 23,
    "sourceY": 11,
    "pixelX": 368,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 23,
    "targetY": 11,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "묘비",
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
    "tile": 354,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 354,
    "sourceX": 24,
    "sourceY": 11,
    "pixelX": 384,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 24,
    "targetY": 11,
    "layers": [
      "upper"
    ],
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
    }
  },
  {
    "tile": 355,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 355,
    "sourceX": 25,
    "sourceY": 11,
    "pixelX": 400,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 25,
    "targetY": 11,
    "layers": [
      "upper"
    ],
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
    }
  },
  {
    "tile": 356,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 356,
    "sourceX": 26,
    "sourceY": 11,
    "pixelX": 416,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 26,
    "targetY": 11,
    "layers": [
      "upper"
    ],
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
    }
  },
  {
    "tile": 357,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 357,
    "sourceX": 27,
    "sourceY": 11,
    "pixelX": 432,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 27,
    "targetY": 11,
    "layers": [
      "upper"
    ],
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
    }
  },
  {
    "tile": 359,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 359,
    "sourceX": 29,
    "sourceY": 11,
    "pixelX": 464,
    "pixelY": 176,
    "width": 16,
    "height": 16,
    "targetX": 29,
    "targetY": 11,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "building",
      "label": "문/입구",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "fixed"
    }
  },
  {
    "tile": 374,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 374,
    "sourceX": 14,
    "sourceY": 12,
    "pixelX": 224,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 14,
    "targetY": 12,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "roof",
      "label": "사선 지붕",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "repeat"
    }
  },
  {
    "tile": 375,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 375,
    "sourceX": 15,
    "sourceY": 12,
    "pixelX": 240,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 15,
    "targetY": 12,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "roof",
      "label": "사선 지붕",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "repeat"
    }
  },
  {
    "tile": 376,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 376,
    "sourceX": 16,
    "sourceY": 12,
    "pixelX": 256,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 16,
    "targetY": 12,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "roof",
      "label": "사선 지붕",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "repeat"
    }
  },
  {
    "tile": 377,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 377,
    "sourceX": 17,
    "sourceY": 12,
    "pixelX": 272,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 17,
    "targetY": 12,
    "layers": [
      "lower"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "role": "roof",
      "label": "사선 지붕",
      "source": "bundled-default",
      "passage": "solid",
      "confidence": "high",
      "terrainTag": 0,
      "description": "",
      "defaultLayer": "lower",
      "repeatability": "repeat"
    }
  },
  {
    "tile": 378,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 378,
    "sourceX": 18,
    "sourceY": 12,
    "pixelX": 288,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 18,
    "targetY": 12,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "fence",
      "label": "울타리",
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
    "tile": 379,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 379,
    "sourceX": 19,
    "sourceY": 12,
    "pixelX": 304,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 19,
    "targetY": 12,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "fence",
      "label": "울타리",
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
    "tile": 380,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 380,
    "sourceX": 20,
    "sourceY": 12,
    "pixelX": 320,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 20,
    "targetY": 12,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "fence",
      "label": "울타리",
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
    "tile": 381,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 381,
    "sourceX": 21,
    "sourceY": 12,
    "pixelX": 336,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 21,
    "targetY": 12,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "모닥불",
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
    "tile": 383,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 383,
    "sourceX": 23,
    "sourceY": 12,
    "pixelX": 368,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 23,
    "targetY": 12,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "prop",
      "label": "해골",
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
    "tile": 384,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 384,
    "sourceX": 24,
    "sourceY": 12,
    "pixelX": 384,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 24,
    "targetY": 12,
    "layers": [
      "upper"
    ],
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
    }
  },
  {
    "tile": 385,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 385,
    "sourceX": 25,
    "sourceY": 12,
    "pixelX": 400,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 25,
    "targetY": 12,
    "layers": [
      "upper"
    ],
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
    }
  },
  {
    "tile": 386,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 386,
    "sourceX": 26,
    "sourceY": 12,
    "pixelX": 416,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 26,
    "targetY": 12,
    "layers": [
      "upper"
    ],
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
    }
  },
  {
    "tile": 387,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 387,
    "sourceX": 27,
    "sourceY": 12,
    "pixelX": 432,
    "pixelY": 192,
    "width": 16,
    "height": 16,
    "targetX": 27,
    "targetY": 12,
    "layers": [
      "upper"
    ],
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
    }
  },
  {
    "tile": 404,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 404,
    "sourceX": 14,
    "sourceY": 13,
    "pixelX": 224,
    "pixelY": 208,
    "width": 16,
    "height": 16,
    "targetX": 14,
    "targetY": 13,
    "layers": [
      "lower"
    ],
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
    }
  },
  {
    "tile": 405,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 405,
    "sourceX": 15,
    "sourceY": 13,
    "pixelX": 240,
    "pixelY": 208,
    "width": 16,
    "height": 16,
    "targetX": 15,
    "targetY": 13,
    "layers": [
      "lower"
    ],
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
    }
  },
  {
    "tile": 406,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 406,
    "sourceX": 16,
    "sourceY": 13,
    "pixelX": 256,
    "pixelY": 208,
    "width": 16,
    "height": 16,
    "targetX": 16,
    "targetY": 13,
    "layers": [
      "lower"
    ],
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
    }
  },
  {
    "tile": 407,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 407,
    "sourceX": 17,
    "sourceY": 13,
    "pixelX": 272,
    "pixelY": 208,
    "width": 16,
    "height": 16,
    "targetX": 17,
    "targetY": 13,
    "layers": [
      "lower"
    ],
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
    }
  },
  {
    "tile": 408,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 408,
    "sourceX": 18,
    "sourceY": 13,
    "pixelX": 288,
    "pixelY": 208,
    "width": 16,
    "height": 16,
    "targetX": 18,
    "targetY": 13,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "fence",
      "label": "울타리",
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
    "tile": 409,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 409,
    "sourceX": 19,
    "sourceY": 13,
    "pixelX": 304,
    "pixelY": 208,
    "width": 16,
    "height": 16,
    "targetX": 19,
    "targetY": 13,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "fence",
      "label": "울타리",
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
    "tile": 410,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 410,
    "sourceX": 20,
    "sourceY": 13,
    "pixelX": 320,
    "pixelY": 208,
    "width": 16,
    "height": 16,
    "targetX": 20,
    "targetY": 13,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "fence",
      "label": "울타리",
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
    "tile": 412,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 412,
    "sourceX": 22,
    "sourceY": 13,
    "pixelX": 352,
    "pixelY": 208,
    "width": 16,
    "height": 16,
    "targetX": 22,
    "targetY": 13,
    "layers": [
      "lower",
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "label": "성벽 위 보행로",
      "description": "두 겹 성벽 사이의 밝은 돌 보행로. 양옆 테두리78/80.",
      "role": "wall",
      "defaultLayer": "lower",
      "passage": "solid"
    }
  },
  {
    "tile": 436,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 436,
    "sourceX": 16,
    "sourceY": 14,
    "pixelX": 256,
    "pixelY": 224,
    "width": 16,
    "height": 16,
    "targetX": 16,
    "targetY": 14,
    "layers": [
      "lower"
    ],
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
    }
  },
  {
    "tile": 437,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 437,
    "sourceX": 17,
    "sourceY": 14,
    "pixelX": 272,
    "pixelY": 224,
    "width": 16,
    "height": 16,
    "targetX": 17,
    "targetY": 14,
    "layers": [
      "lower"
    ],
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
    }
  },
  {
    "tile": 438,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 438,
    "sourceX": 18,
    "sourceY": 14,
    "pixelX": 288,
    "pixelY": 224,
    "width": 16,
    "height": 16,
    "targetX": 18,
    "targetY": 14,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "fence",
      "label": "울타리",
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
    "tile": 439,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 439,
    "sourceX": 19,
    "sourceY": 14,
    "pixelX": 304,
    "pixelY": 224,
    "width": 16,
    "height": 16,
    "targetX": 19,
    "targetY": 14,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "tileMeta": {
      "role": "fence",
      "label": "울타리",
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
```
