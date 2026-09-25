# 사용 타일 사전

이 분류의 맵이 쓰는 번호·라벨·통행(타일셋별). graft가 있으면 그 칸은 다른 시트에서 이식한 그림이다.
```json
[
  {
    "tileset": "oprn_dungeon_sea",
    "tile": 841,
    "label": "감긴 밧줄 더미 · 조각 841",
    "passability": {
      "up": true,
      "down": true,
      "left": true,
      "right": true
    },
    "priority": "upper",
    "graft": {
      "sourceChipset": "tex_oprn_dungeon_parts",
      "sourceTile": 331,
      "targetTile": 841
    }
  },
  {
    "tileset": "oprn_dungeon_sea",
    "tile": 846,
    "label": "해골과 뼈 더미 · 조각 846",
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "graft": {
      "sourceChipset": "tex_oprn_dungeon_parts",
      "sourceTile": 336,
      "targetTile": 846
    }
  },
  {
    "tileset": "oprn_dungeon_sea",
    "tile": 847,
    "label": "엇갈린 은색 검 · 조각 847",
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "graft": {
      "sourceChipset": "tex_oprn_dungeon_parts",
      "sourceTile": 337,
      "targetTile": 847
    }
  },
  {
    "tileset": "oprn_dungeon_sea",
    "tile": 848,
    "label": "붉은 삼각 깃발 · 조각 848",
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "graft": {
      "sourceChipset": "tex_oprn_dungeon_parts",
      "sourceTile": 338,
      "targetTile": 848
    }
  },
  {
    "tileset": "oprn_dungeon_sea",
    "tile": 1050,
    "label": "보물상자(나무·금테) · 조각 1050",
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "graft": {
      "sourceChipset": "tex_oprn_dungeon_parts",
      "sourceTile": 540,
      "targetTile": 1050
    }
  },
  {
    "tileset": "oprn_dungeon_sea",
    "tile": 1054,
    "label": "붉은 금장 보물상자(보스 보상) · 조각 1054",
    "passability": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "priority": "upper",
    "graft": {
      "sourceChipset": "tex_oprn_dungeon_parts",
      "sourceTile": 544,
      "targetTile": 1054
    }
  }
]
```
