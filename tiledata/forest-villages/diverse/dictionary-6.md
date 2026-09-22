# 사용 타일 부품 사전

source는 원본 시트, target은 이 마을용 합성 시트다. 0기준. 폭/높이는 픽셀이다. 레이어와 통행은 별개.
```json
[
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
  },
  {
    "tile": 2700,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_easyrpg_chipset_world",
    "sourceTile": 123,
    "sourceX": 3,
    "sourceY": 4,
    "pixelX": 48,
    "pixelY": 64,
    "width": 16,
    "height": 16,
    "targetX": 0,
    "targetY": 90,
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
      "label": "폭포 · World 123",
      "description": "절벽 면을 대신하는 폭포. 윗선 칸은 물, 면·밑단 칸이 폭포다. 번들 칩셋이라 정지 그림(첫 프레임).",
      "role": "water",
      "defaultLayer": "lower",
      "source": "user",
      "userLocked": true,
      "passage": "solid"
    }
  },
  {
    "tile": 2701,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_easyrpg_chipset_world",
    "sourceTile": 102,
    "sourceX": 12,
    "sourceY": 3,
    "pixelX": 192,
    "pixelY": 48,
    "width": 16,
    "height": 16,
    "targetX": 1,
    "targetY": 90,
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
      "label": "나무다리 윗줄 · World 102",
      "description": "강을 가로지르는 2행 다리. 윗줄102·아랫줄103을 강폭만큼 반복한다.",
      "role": "bridge",
      "defaultLayer": "lower",
      "source": "user",
      "userLocked": true,
      "passage": "passable"
    }
  },
  {
    "tile": 2702,
    "tilesetId": "forest_harmony",
    "sourceChipset": "tex_easyrpg_chipset_world",
    "sourceTile": 103,
    "sourceX": 13,
    "sourceY": 3,
    "pixelX": 208,
    "pixelY": 48,
    "width": 16,
    "height": 16,
    "targetX": 2,
    "targetY": 90,
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
      "label": "나무다리 아랫줄 · World 103",
      "description": "강을 가로지르는 2행 다리. 윗줄102·아랫줄103을 강폭만큼 반복한다.",
      "role": "bridge",
      "defaultLayer": "lower",
      "source": "user",
      "userLocked": true,
      "passage": "passable"
    }
  }
]
```
