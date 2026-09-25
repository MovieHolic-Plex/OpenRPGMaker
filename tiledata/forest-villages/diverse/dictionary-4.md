# 사용 타일 부품 사전

source는 원본 시트, target은 이 마을용 합성 시트다. 0기준. 폭/높이는 픽셀이다. 레이어와 통행은 별개.
```json
[
  {
    "tile": 1074,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1074,
    "sourceX": 24,
    "sourceY": 35,
    "pixelX": 384,
    "pixelY": 560,
    "width": 16,
    "height": 16,
    "targetX": 24,
    "targetY": 35,
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
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "작은 덤불",
        "밑동"
      ],
      "label": "Tibo small-bush 2,1",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 작은 덤불 2×2 칸의 (2,1). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    }
  },
  {
    "tile": 1103,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1103,
    "sourceX": 23,
    "sourceY": 36,
    "pixelX": 368,
    "pixelY": 576,
    "width": 16,
    "height": 16,
    "targetX": 23,
    "targetY": 36,
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
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "작은 덤불",
        "밑동"
      ],
      "label": "Tibo small-bush 1,2",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 작은 덤불 2×2 칸의 (1,2). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    }
  },
  {
    "tile": 1104,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1104,
    "sourceX": 24,
    "sourceY": 36,
    "pixelX": 384,
    "pixelY": 576,
    "width": 16,
    "height": 16,
    "targetX": 24,
    "targetY": 36,
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
      "role": "prop",
      "tags": [
        "숲",
        "나무",
        "작은 덤불",
        "밑동"
      ],
      "label": "Tibo small-bush 2,2",
      "locked": true,
      "origin": "user",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "description": "숲 나무 확장 띠 — 작은 덤불 2×2 칸의 (2,2). 밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "repeatability": "fixed"
    }
  },
  {
    "tile": 1124,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1124,
    "sourceX": 14,
    "sourceY": 37,
    "pixelX": 224,
    "pixelY": 592,
    "width": 16,
    "height": 16,
    "targetX": 14,
    "targetY": 37,
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
      "label": "키큰 풀 · 밝음 · 북서 모서리",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 밝음(트인 풀밭)의 북서 모서리 칸. 숲·집·길에서 떨어진 트인 풀밭 덩이. 오토타일 builtin_tall_grass_light 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1125,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1125,
    "sourceX": 15,
    "sourceY": 37,
    "pixelX": 240,
    "pixelY": 592,
    "width": 16,
    "height": 16,
    "targetX": 15,
    "targetY": 37,
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
      "label": "키큰 풀 · 밝음 · 북쪽 변",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 밝음(트인 풀밭)의 북쪽 변 칸. 숲·집·길에서 떨어진 트인 풀밭 덩이. 오토타일 builtin_tall_grass_light 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1126,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1126,
    "sourceX": 16,
    "sourceY": 37,
    "pixelX": 256,
    "pixelY": 592,
    "width": 16,
    "height": 16,
    "targetX": 16,
    "targetY": 37,
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
      "label": "키큰 풀 · 밝음 · 북동 모서리",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 밝음(트인 풀밭)의 북동 모서리 칸. 숲·집·길에서 떨어진 트인 풀밭 덩이. 오토타일 builtin_tall_grass_light 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1128,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1128,
    "sourceX": 18,
    "sourceY": 37,
    "pixelX": 288,
    "pixelY": 592,
    "width": 16,
    "height": 16,
    "targetX": 18,
    "targetY": 37,
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
      "label": "키큰 풀 · 짧음 · 북서 모서리",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 짧음(집·길 곁)의 북서 모서리 칸. 집·길 곁 덩이. 오토타일 builtin_tall_grass_short 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1129,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1129,
    "sourceX": 19,
    "sourceY": 37,
    "pixelX": 304,
    "pixelY": 592,
    "width": 16,
    "height": 16,
    "targetX": 19,
    "targetY": 37,
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
      "label": "키큰 풀 · 짧음 · 북쪽 변",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 짧음(집·길 곁)의 북쪽 변 칸. 집·길 곁 덩이. 오토타일 builtin_tall_grass_short 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1130,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1130,
    "sourceX": 20,
    "sourceY": 37,
    "pixelX": 320,
    "pixelY": 592,
    "width": 16,
    "height": 16,
    "targetX": 20,
    "targetY": 37,
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
      "label": "키큰 풀 · 짧음 · 북동 모서리",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 짧음(집·길 곁)의 북동 모서리 칸. 집·길 곁 덩이. 오토타일 builtin_tall_grass_short 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1154,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1154,
    "sourceX": 14,
    "sourceY": 38,
    "pixelX": 224,
    "pixelY": 608,
    "width": 16,
    "height": 16,
    "targetX": 14,
    "targetY": 38,
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
      "label": "키큰 풀 · 밝음 · 서쪽 변",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 밝음(트인 풀밭)의 서쪽 변 칸. 숲·집·길에서 떨어진 트인 풀밭 덩이. 오토타일 builtin_tall_grass_light 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1155,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1155,
    "sourceX": 15,
    "sourceY": 38,
    "pixelX": 240,
    "pixelY": 608,
    "width": 16,
    "height": 16,
    "targetX": 15,
    "targetY": 38,
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
      "label": "키큰 풀 · 밝음 · 몸통",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 밝음(트인 풀밭)의 몸통 칸. 숲·집·길에서 떨어진 트인 풀밭 덩이. 오토타일 builtin_tall_grass_light 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1156,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1156,
    "sourceX": 16,
    "sourceY": 38,
    "pixelX": 256,
    "pixelY": 608,
    "width": 16,
    "height": 16,
    "targetX": 16,
    "targetY": 38,
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
      "label": "키큰 풀 · 밝음 · 동쪽 변",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 밝음(트인 풀밭)의 동쪽 변 칸. 숲·집·길에서 떨어진 트인 풀밭 덩이. 오토타일 builtin_tall_grass_light 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1157,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1157,
    "sourceX": 17,
    "sourceY": 38,
    "pixelX": 272,
    "pixelY": 608,
    "width": 16,
    "height": 16,
    "targetX": 17,
    "targetY": 38,
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
      "label": "키큰 풀 · 밝음 · 오목 모서리",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 밝음(트인 풀밭)의 오목 모서리 칸. 숲·집·길에서 떨어진 트인 풀밭 덩이. 오토타일 builtin_tall_grass_light 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1158,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1158,
    "sourceX": 18,
    "sourceY": 38,
    "pixelX": 288,
    "pixelY": 608,
    "width": 16,
    "height": 16,
    "targetX": 18,
    "targetY": 38,
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
      "label": "키큰 풀 · 짧음 · 서쪽 변",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 짧음(집·길 곁)의 서쪽 변 칸. 집·길 곁 덩이. 오토타일 builtin_tall_grass_short 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1159,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1159,
    "sourceX": 19,
    "sourceY": 38,
    "pixelX": 304,
    "pixelY": 608,
    "width": 16,
    "height": 16,
    "targetX": 19,
    "targetY": 38,
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
      "label": "키큰 풀 · 짧음 · 몸통",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 짧음(집·길 곁)의 몸통 칸. 집·길 곁 덩이. 오토타일 builtin_tall_grass_short 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1160,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1160,
    "sourceX": 20,
    "sourceY": 38,
    "pixelX": 320,
    "pixelY": 608,
    "width": 16,
    "height": 16,
    "targetX": 20,
    "targetY": 38,
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
      "label": "키큰 풀 · 짧음 · 동쪽 변",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 짧음(집·길 곁)의 동쪽 변 칸. 집·길 곁 덩이. 오토타일 builtin_tall_grass_short 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1161,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1161,
    "sourceX": 21,
    "sourceY": 38,
    "pixelX": 336,
    "pixelY": 608,
    "width": 16,
    "height": 16,
    "targetX": 21,
    "targetY": 38,
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
      "label": "키큰 풀 · 짧음 · 오목 모서리",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 짧음(집·길 곁)의 오목 모서리 칸. 집·길 곁 덩이. 오토타일 builtin_tall_grass_short 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1184,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1184,
    "sourceX": 14,
    "sourceY": 39,
    "pixelX": 224,
    "pixelY": 624,
    "width": 16,
    "height": 16,
    "targetX": 14,
    "targetY": 39,
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
      "label": "키큰 풀 · 밝음 · 남서 모서리",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 밝음(트인 풀밭)의 남서 모서리 칸. 숲·집·길에서 떨어진 트인 풀밭 덩이. 오토타일 builtin_tall_grass_light 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1185,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1185,
    "sourceX": 15,
    "sourceY": 39,
    "pixelX": 240,
    "pixelY": 624,
    "width": 16,
    "height": 16,
    "targetX": 15,
    "targetY": 39,
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
      "label": "키큰 풀 · 밝음 · 남쪽 변",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 밝음(트인 풀밭)의 남쪽 변 칸. 숲·집·길에서 떨어진 트인 풀밭 덩이. 오토타일 builtin_tall_grass_light 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1186,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1186,
    "sourceX": 16,
    "sourceY": 39,
    "pixelX": 256,
    "pixelY": 624,
    "width": 16,
    "height": 16,
    "targetX": 16,
    "targetY": 39,
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
      "label": "키큰 풀 · 밝음 · 남동 모서리",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 밝음(트인 풀밭)의 남동 모서리 칸. 숲·집·길에서 떨어진 트인 풀밭 덩이. 오토타일 builtin_tall_grass_light 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1188,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1188,
    "sourceX": 18,
    "sourceY": 39,
    "pixelX": 288,
    "pixelY": 624,
    "width": 16,
    "height": 16,
    "targetX": 18,
    "targetY": 39,
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
      "label": "키큰 풀 · 짧음 · 남서 모서리",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 짧음(집·길 곁)의 남서 모서리 칸. 집·길 곁 덩이. 오토타일 builtin_tall_grass_short 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1189,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1189,
    "sourceX": 19,
    "sourceY": 39,
    "pixelX": 304,
    "pixelY": 624,
    "width": 16,
    "height": 16,
    "targetX": 19,
    "targetY": 39,
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
      "label": "키큰 풀 · 짧음 · 남쪽 변",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 짧음(집·길 곁)의 남쪽 변 칸. 집·길 곁 덩이. 오토타일 builtin_tall_grass_short 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1190,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1190,
    "sourceX": 20,
    "sourceY": 39,
    "pixelX": 320,
    "pixelY": 624,
    "width": 16,
    "height": 16,
    "targetX": 20,
    "targetY": 39,
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
      "label": "키큰 풀 · 짧음 · 남동 모서리",
      "source": "bundled-default",
      "passage": "passable",
      "confidence": "high",
      "terrainTag": 0,
      "defaultLayer": "lower",
      "repeatability": "auto",
      "description": "키큰 풀 · 짧음(집·길 곁)의 남동 모서리 칸. 집·길 곁 덩이. 오토타일 builtin_tall_grass_short 이 이웃에 맞춰 고른다."
    }
  },
  {
    "tile": 1350,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1350,
    "sourceX": 0,
    "sourceY": 45,
    "pixelX": 0,
    "pixelY": 720,
    "width": 16,
    "height": 16,
    "targetX": 0,
    "targetY": 45,
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
      "label": "연속 숲 30",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1141,
      "description": ""
    }
  },
  {
    "tile": 1422,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1422,
    "sourceX": 12,
    "sourceY": 47,
    "pixelX": 192,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 12,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1423,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1423,
    "sourceX": 13,
    "sourceY": 47,
    "pixelX": 208,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 13,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1424,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1424,
    "sourceX": 14,
    "sourceY": 47,
    "pixelX": 224,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 14,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1425,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1425,
    "sourceX": 15,
    "sourceY": 47,
    "pixelX": 240,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 15,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1426,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1426,
    "sourceX": 16,
    "sourceY": 47,
    "pixelX": 256,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 16,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1427,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1427,
    "sourceX": 17,
    "sourceY": 47,
    "pixelX": 272,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 17,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1428,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1428,
    "sourceX": 18,
    "sourceY": 47,
    "pixelX": 288,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 18,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1429,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1429,
    "sourceX": 19,
    "sourceY": 47,
    "pixelX": 304,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 19,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1430,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1430,
    "sourceX": 20,
    "sourceY": 47,
    "pixelX": 320,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 20,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1431,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1431,
    "sourceX": 21,
    "sourceY": 47,
    "pixelX": 336,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 21,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1432,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1432,
    "sourceX": 22,
    "sourceY": 47,
    "pixelX": 352,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 22,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1433,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1433,
    "sourceX": 23,
    "sourceY": 47,
    "pixelX": 368,
    "pixelY": 752,
    "width": 16,
    "height": 16,
    "targetX": 23,
    "targetY": 47,
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
      "label": "Tibo 왼쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1453,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1453,
    "sourceX": 13,
    "sourceY": 48,
    "pixelX": 208,
    "pixelY": 768,
    "width": 16,
    "height": 16,
    "targetX": 13,
    "targetY": 48,
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
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1454,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1454,
    "sourceX": 14,
    "sourceY": 48,
    "pixelX": 224,
    "pixelY": 768,
    "width": 16,
    "height": 16,
    "targetX": 14,
    "targetY": 48,
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
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1455,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1455,
    "sourceX": 15,
    "sourceY": 48,
    "pixelX": 240,
    "pixelY": 768,
    "width": 16,
    "height": 16,
    "targetX": 15,
    "targetY": 48,
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
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1457,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1457,
    "sourceX": 17,
    "sourceY": 48,
    "pixelX": 272,
    "pixelY": 768,
    "width": 16,
    "height": 16,
    "targetX": 17,
    "targetY": 48,
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
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1458,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1458,
    "sourceX": 18,
    "sourceY": 48,
    "pixelX": 288,
    "pixelY": 768,
    "width": 16,
    "height": 16,
    "targetX": 18,
    "targetY": 48,
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
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1459,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1459,
    "sourceX": 19,
    "sourceY": 48,
    "pixelX": 304,
    "pixelY": 768,
    "width": 16,
    "height": 16,
    "targetX": 19,
    "targetY": 48,
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
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1461,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1461,
    "sourceX": 21,
    "sourceY": 48,
    "pixelX": 336,
    "pixelY": 768,
    "width": 16,
    "height": 16,
    "targetX": 21,
    "targetY": 48,
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
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1462,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1462,
    "sourceX": 22,
    "sourceY": 48,
    "pixelX": 352,
    "pixelY": 768,
    "width": 16,
    "height": 16,
    "targetX": 22,
    "targetY": 48,
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
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1463,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1463,
    "sourceX": 23,
    "sourceY": 48,
    "pixelX": 368,
    "pixelY": 768,
    "width": 16,
    "height": 16,
    "targetX": 23,
    "targetY": 48,
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
      "label": "Tibo 오른쪽 숲 마감",
      "source": "user",
      "passage": "solid",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1471,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1471,
    "sourceX": 1,
    "sourceY": 49,
    "pixelX": 16,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 1,
    "targetY": 49,
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
      "label": "road 연결 1471",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1472,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1472,
    "sourceX": 2,
    "sourceY": 49,
    "pixelX": 32,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 2,
    "targetY": 49,
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
      "label": "road 연결 1472",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1474,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1474,
    "sourceX": 4,
    "sourceY": 49,
    "pixelX": 64,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 4,
    "targetY": 49,
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
      "label": "road 연결 1474",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1475,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1475,
    "sourceX": 5,
    "sourceY": 49,
    "pixelX": 80,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 5,
    "targetY": 49,
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
      "label": "road 연결 1475",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1476,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1476,
    "sourceX": 6,
    "sourceY": 49,
    "pixelX": 96,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 6,
    "targetY": 49,
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
      "label": "road 연결 1476",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1478,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1478,
    "sourceX": 8,
    "sourceY": 49,
    "pixelX": 128,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 8,
    "targetY": 49,
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
      "label": "road 연결 1478",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1479,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1479,
    "sourceX": 9,
    "sourceY": 49,
    "pixelX": 144,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 9,
    "targetY": 49,
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
      "label": "road 연결 1479",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1480,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1480,
    "sourceX": 10,
    "sourceY": 49,
    "pixelX": 160,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 10,
    "targetY": 49,
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
      "label": "road 연결 1480",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1486,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1486,
    "sourceX": 16,
    "sourceY": 49,
    "pixelX": 256,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 16,
    "targetY": 49,
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
      "label": "road 연결 1486",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1487,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1487,
    "sourceX": 17,
    "sourceY": 49,
    "pixelX": 272,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 17,
    "targetY": 49,
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
      "label": "road 연결 1487",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1488,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1488,
    "sourceX": 18,
    "sourceY": 49,
    "pixelX": 288,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 18,
    "targetY": 49,
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
      "label": "road 연결 1488",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1490,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1490,
    "sourceX": 20,
    "sourceY": 49,
    "pixelX": 320,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 20,
    "targetY": 49,
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
      "label": "road 연결 1490",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1491,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1491,
    "sourceX": 21,
    "sourceY": 49,
    "pixelX": 336,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 21,
    "targetY": 49,
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
      "label": "road 연결 1491",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1492,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1492,
    "sourceX": 22,
    "sourceY": 49,
    "pixelX": 352,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 22,
    "targetY": 49,
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
      "label": "road 연결 1492",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  },
  {
    "tile": 1494,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 1494,
    "sourceX": 24,
    "sourceY": 49,
    "pixelX": 384,
    "pixelY": 784,
    "width": 16,
    "height": 16,
    "targetX": 24,
    "targetY": 49,
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
      "label": "road 연결 1494",
      "source": "user",
      "passage": "passable",
      "userLocked": true,
      "defaultLayer": "lower",
      "layerBacking": 1145,
      "description": ""
    }
  }
]
```
