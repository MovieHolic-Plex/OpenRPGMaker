# 사용 타일 부품 사전

source는 원본 시트, target은 이 마을용 합성 시트다. 0기준. 폭/높이는 픽셀이다. 레이어와 통행은 별개.
```json
[
  {
    "tile": 2689,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony",
    "sourceTile": 854,
    "sourceX": 14,
    "sourceY": 28,
    "pixelX": 224,
    "pixelY": 448,
    "width": 16,
    "height": 16,
    "targetX": 19,
    "targetY": 89,
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
      "label": "돌계단",
      "description": "바닥240에 맞는 숲마을 색 보정판. 큰 폭포 원본의 밝은 잔디판과 구분한다.",
      "role": "floor",
      "defaultLayer": "lower",
      "source": "user",
      "userLocked": true,
      "passage": "passable"
    }
  },
  {
    "tile": 2690,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_easyrpg_chipset_retro_world",
    "sourceTile": 413,
    "sourceX": 23,
    "sourceY": 13,
    "pixelX": 368,
    "pixelY": 208,
    "width": 16,
    "height": 16,
    "targetX": 20,
    "targetY": 89,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "동굴 입구",
      "description": "바닥240에 맞는 숲마을 색 보정판. 큰 폭포 원본의 밝은 잔디판과 구분한다.",
      "role": "cliff",
      "defaultLayer": "upper",
      "source": "user",
      "userLocked": true,
      "passage": "solid",
      "layerBacking": 2683
    }
  },
  {
    "tile": 2691,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony_grass_joins",
    "sourceTile": 8,
    "sourceX": 8,
    "sourceY": 0,
    "pixelX": 128,
    "pixelY": 0,
    "width": 16,
    "height": 16,
    "targetX": 21,
    "targetY": 89,
    "layers": [
      "upper"
    ],
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "lower",
    "tileMeta": {
      "label": "절벽 · 숲마을 712",
      "description": "바닥240에 맞는 숲마을 색 보정판. 큰 폭포 원본의 밝은 잔디판과 구분한다.",
      "role": "cliff",
      "defaultLayer": "upper",
      "source": "user",
      "userLocked": true,
      "passage": "solid"
    }
  },
  {
    "tile": 2692,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony_grass_joins",
    "sourceTile": 0,
    "sourceX": 0,
    "sourceY": 0,
    "pixelX": 0,
    "pixelY": 0,
    "width": 16,
    "height": 16,
    "targetX": 22,
    "targetY": 89,
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
      "label": "잔디 사선 504 · 색 맞춤",
      "description": "바닥240 유지. 원본 경계의 알파 모양 보존. 지붕/암벽 면이 아닌 잔디 가장자리.",
      "role": "terrain",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "passage": "passable",
      "source": "user",
      "userLocked": true
    }
  },
  {
    "tile": 2693,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony_grass_joins",
    "sourceTile": 1,
    "sourceX": 1,
    "sourceY": 0,
    "pixelX": 16,
    "pixelY": 0,
    "width": 16,
    "height": 16,
    "targetX": 23,
    "targetY": 89,
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
      "label": "잔디 사선 505 · 색 맞춤",
      "description": "바닥240 유지. 원본 경계의 알파 모양 보존. 지붕/암벽 면이 아닌 잔디 가장자리.",
      "role": "terrain",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "passage": "passable",
      "source": "user",
      "userLocked": true
    }
  },
  {
    "tile": 2694,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_forest_harmony_grass_joins",
    "sourceTile": 9,
    "sourceX": 9,
    "sourceY": 0,
    "pixelX": 144,
    "pixelY": 0,
    "width": 16,
    "height": 16,
    "targetX": 24,
    "targetY": 89,
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
      "label": "잔디 수평 반복 559 · 색 맞춤",
      "description": "바닥240 유지. 원본 경계의 알파 모양 보존. 지붕/암벽 면이 아닌 잔디 가장자리.",
      "role": "terrain",
      "defaultLayer": "lower",
      "layerBacking": 240,
      "passage": "passable",
      "source": "user",
      "userLocked": true
    }
  }
]
```
