# 사선 잔디 경계와 바닥색

사용자 확정: 기본 바닥240의 그림/색을 유지하고 504·505와 498·499·528·529의 경계를 맞춘다. 원본 시트의 밝은 589로 바닥 전체를 바꾸지 않는다. 공용 tex_forest_harmony_grass_joins는 16px·9열·9칸의 별도 파생 시트다. 기존 forest_harmony 시트 바이트와 이슬여울은 그대로다.

![수정 전 · 경계 잔디색 불일치](images/grass-before.png)
![수정 후 · 바닥색 유지](images/terrace-cliff-village.png)

## 정확한 부품 사전
![공용 색 맞춤 시트 · 왼쪽부터 0..8](images/grass-joins-atlas.png)
```json
{
  "sourcePath": "public/assets/forest-harmony/chipset.png",
  "sourceSha256": "430f254fe1e0abb081defe98dc3d216d62c58ae59cf60755a0050515dff779bf",
  "floorTile": 240,
  "texture": "tex_forest_harmony_grass_joins",
  "tilesPerRow": 9,
  "count": 9,
  "rockPalette": {
    "108,72,53": [
      139,
      106,
      57
    ],
    "26,22,21": [
      67,
      44,
      30
    ],
    "78,51,36": [
      78,
      51,
      36
    ],
    "74,60,51": [
      107,
      78,
      42
    ],
    "55,38,36": [
      97,
      64,
      38
    ],
    "139,80,52": [
      139,
      80,
      52
    ],
    "36,25,36": [
      81,
      58,
      33
    ],
    "127,93,66": [
      127,
      93,
      66
    ],
    "177,139,87": [
      177,
      139,
      87
    ]
  },
  "tiles": [
    {
      "sourceTile": 504,
      "sourceX": 24,
      "sourceY": 16,
      "targetTile": 0,
      "width": 16,
      "height": 16,
      "alphaUnchanged": true,
      "grassPixels": 138,
      "opaquePixels": 138,
      "change": "grass pixels only"
    },
    {
      "sourceTile": 505,
      "sourceX": 25,
      "sourceY": 16,
      "targetTile": 1,
      "width": 16,
      "height": 16,
      "alphaUnchanged": true,
      "grassPixels": 134,
      "opaquePixels": 134,
      "change": "grass pixels only"
    },
    {
      "sourceTile": 240,
      "sourceX": 0,
      "sourceY": 8,
      "targetTile": 2,
      "width": 16,
      "height": 16,
      "alphaUnchanged": true,
      "grassPixels": 0,
      "opaquePixels": 256,
      "change": "identical floor copy"
    },
    {
      "sourceTile": 498,
      "sourceX": 18,
      "sourceY": 16,
      "targetTile": 3,
      "width": 16,
      "height": 16,
      "alphaUnchanged": true,
      "grassPixels": 122,
      "opaquePixels": 256,
      "change": "grass pixels only"
    },
    {
      "sourceTile": 499,
      "sourceX": 19,
      "sourceY": 16,
      "targetTile": 4,
      "width": 16,
      "height": 16,
      "alphaUnchanged": true,
      "grassPixels": 120,
      "opaquePixels": 256,
      "change": "grass pixels only"
    },
    {
      "sourceTile": 528,
      "sourceX": 18,
      "sourceY": 17,
      "targetTile": 5,
      "width": 16,
      "height": 16,
      "alphaUnchanged": true,
      "grassPixels": 112,
      "opaquePixels": 256,
      "change": "grass pixels only"
    },
    {
      "sourceTile": 529,
      "sourceX": 19,
      "sourceY": 17,
      "targetTile": 6,
      "width": 16,
      "height": 16,
      "alphaUnchanged": true,
      "grassPixels": 114,
      "opaquePixels": 256,
      "change": "grass pixels only"
    },
    {
      "sourceTile": 619,
      "sourceX": 19,
      "sourceY": 20,
      "targetTile": 7,
      "width": 16,
      "height": 16,
      "alphaUnchanged": true,
      "grassPixels": 217,
      "opaquePixels": 256,
      "change": "grass pixels only"
    },
    {
      "sourceTile": 712,
      "sourceX": 22,
      "sourceY": 23,
      "targetTile": 8,
      "width": 16,
      "height": 16,
      "alphaUnchanged": true,
      "grassPixels": 0,
      "opaquePixels": 256,
      "change": "rock palette only"
    }
  ]
}
```

```json
{
  "tilesetId": "forest_harmony",
  "grassBindings": {
    "504": 2692,
    "505": 2693
  },
  "grafts": [
    {
      "sourceChipset": "tex_forest_harmony_grass_joins",
      "sourceTile": 3,
      "targetTile": 2670
    },
    {
      "sourceChipset": "tex_forest_harmony_grass_joins",
      "sourceTile": 4,
      "targetTile": 2671
    },
    {
      "sourceChipset": "tex_forest_harmony_grass_joins",
      "sourceTile": 5,
      "targetTile": 2672
    },
    {
      "sourceChipset": "tex_forest_harmony_grass_joins",
      "sourceTile": 6,
      "targetTile": 2673
    },
    {
      "sourceChipset": "tex_forest_harmony_grass_joins",
      "sourceTile": 7,
      "targetTile": 2680
    },
    {
      "sourceChipset": "tex_forest_harmony_grass_joins",
      "sourceTile": 8,
      "targetTile": 2691
    },
    {
      "sourceChipset": "tex_forest_harmony_grass_joins",
      "sourceTile": 0,
      "targetTile": 2692
    },
    {
      "sourceChipset": "tex_forest_harmony_grass_joins",
      "sourceTile": 1,
      "targetTile": 2693
    }
  ]
}
```


새 공용 시트 0=504 북서 사선(잔디는 남동쪽), 1=505 북동 사선(잔디는 남서쪽), 2=기존 바닥240 픽셀 그대로. 3/4=498/499 윗 모서리, 5/6=528/529 밑 모서리, 7=619 정면 윗선. 사선 투명 알파는 원본과 동일하며 잔디 세 색 영역만 바닥240 텍스처와 원래 명암 위치로 교체했다. 8=712 오른쪽 암벽: 기존 시트에 남아 있던 어두운 원본 팔레트만 왼쪽711과 맞춘다. 픽셀 위치/형태를 반전하거나 늘이지 않는다. 암벽 모서리의 비잔디 픽셀은 현재 forest_harmony와 같다.

## 레이어 정정과 실행 순서
옛 tileMeta의 504/505 ‘녹색 삼각 지붕’ 설명을 이 용도에 사용하지 않는다. 여기서는 **잔디 경계**다. 새 시트 0/1은 lower, layerBacking=2. forest_harmony에 이식한 2692/2693은 lower, layerBacking=240. 상위 소품을 그대로 두고 바닥240 위에 사선만 합성한다. passage=passable, priority=lower. 암벽 3..8은 upper·solid이며 두 속성을 섞지 않는다.

1. 절벽 열·계단→집·길·숲·소품 배치를 끝낸다.
2. 절벽 첫 꼭짓점 (x0,y0)에서 북서 사선504를 (x0+k,y0-1-k), 마지막 꼭짓점 (x1,y1)에서 북동 사선505를 (x1-k,y1-1-k)에 놓는다. k=0..3.
3. lower가 정확히240이고 길이 아닌 칸만 교체한다. 길·건물 바닥·뿌리/줄기 칸은 건너뛴다. upper는 어떤 칸도 바꾸지 않는다. 바닥 받침은240을 지정한다.
4. 실제 적용 좌표는 아래 표를 정답으로 한다. 일부 칸이 길/건물이라 생략됐다고 빈칸에 임의 부품을 추가하지 않는다.
### 솔바람 흩어진 산촌
```json
[
  {
    "x": 8,
    "y": 16,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 9,
    "y": 15,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": 2622
  },
  {
    "x": 10,
    "y": 14,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 11,
    "y": 13,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 28,
    "y": 16,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 27,
    "y": 15,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 26,
    "y": 14,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 51,
    "y": 16,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 52,
    "y": 15,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 53,
    "y": 14,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 74,
    "y": 18,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 73,
    "y": 17,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  }
]
```

### 층바위 절벽마을
```json
[
  {
    "x": 7,
    "y": 39,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 8,
    "y": 38,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 9,
    "y": 37,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 10,
    "y": 36,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 82,
    "y": 37,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 81,
    "y": 36,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 79,
    "y": 34,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": 1009
  },
  {
    "x": 20,
    "y": 16,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 21,
    "y": 15,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 22,
    "y": 14,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": 2632
  },
  {
    "x": 23,
    "y": 13,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": 2611
  },
  {
    "x": 72,
    "y": 18,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 71,
    "y": 17,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 69,
    "y": 15,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  }
]
```

### 갈대물굽이 포구
```json
[
  {
    "x": 7,
    "y": 15,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 8,
    "y": 14,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": 2626
  },
  {
    "x": 9,
    "y": 13,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 10,
    "y": 12,
    "sourceTile": 504,
    "tile": 2692,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 25,
    "y": 14,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 24,
    "y": 13,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  },
  {
    "x": 23,
    "y": 12,
    "sourceTile": 505,
    "tile": 2693,
    "layer": "lower",
    "backing": 240,
    "upper": -1
  }
]
```


## 입력 → 완전한 두 레이어 출력
층바위 절벽의 북서 마감과 북동 마감. 좌표는 맵 기준, 배열은 행 단위다.
```json
{
  "x": 18,
  "y": 13,
  "width": 8,
  "height": 8,
  "lowerTiles": [
    [
      1068,
      1069,
      1070,
      240,
      240,
      2692,
      240,
      240
    ],
    [
      240,
      240,
      240,
      240,
      2692,
      240,
      240,
      240
    ],
    [
      240,
      240,
      240,
      2692,
      240,
      240,
      240,
      240
    ],
    [
      240,
      240,
      2692,
      240,
      240,
      240,
      240,
      240
    ],
    [
      240,
      240,
      240,
      240,
      240,
      240,
      240,
      240
    ],
    [
      240,
      240,
      240,
      240,
      240,
      240,
      240,
      240
    ],
    [
      240,
      240,
      240,
      240,
      240,
      240,
      240,
      240
    ],
    [
      240,
      240,
      240,
      240,
      240,
      240,
      240,
      240
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      2611,
      2612,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      2632,
      2616,
      2617,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      2635,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      2670,
      -1,
      2611,
      2612,
      -1,
      -1
    ],
    [
      -1,
      -1,
      2688,
      2670,
      2616,
      2617,
      -1,
      -1
    ],
    [
      -1,
      -1,
      2688,
      2688,
      2670,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      2688,
      2688,
      2688,
      2670,
      -1,
      -1
    ]
  ]
}
```

```json
{
  "x": 68,
  "y": 13,
  "width": 8,
  "height": 10,
  "lowerTiles": [
    [
      240,
      1103,
      1104,
      240,
      240,
      240,
      240,
      240
    ],
    [
      240,
      240,
      240,
      240,
      240,
      240,
      240,
      240
    ],
    [
      240,
      2693,
      240,
      240,
      240,
      240,
      240,
      240
    ],
    [
      983,
      984,
      985,
      240,
      240,
      240,
      240,
      240
    ],
    [
      1013,
      1014,
      1015,
      2693,
      240,
      240,
      240,
      240
    ],
    [
      1043,
      1044,
      1045,
      240,
      2693,
      240,
      240,
      240
    ],
    [
      240,
      240,
      240,
      240,
      240,
      240,
      240,
      240
    ],
    [
      240,
      240,
      240,
      240,
      240,
      240,
      240,
      240
    ],
    [
      240,
      240,
      240,
      240,
      240,
      240,
      240,
      240
    ],
    [
      240,
      240,
      240,
      240,
      240,
      1073,
      1074,
      240
    ]
  ],
  "upperTiles": [
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      -1,
      2671,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      -1,
      2671,
      2691,
      -1,
      -1,
      -1
    ],
    [
      -1,
      -1,
      2671,
      2691,
      2691,
      -1,
      -1,
      -1
    ],
    [
      -1,
      2671,
      2691,
      2691,
      2691,
      -1,
      -1,
      -1
    ]
  ]
}
```


자동 검사 grass-edge-direction은 반대 사선, grass-color-mismatch는 밝은 원본504/505를 잘못 쓴 칸, grass-backing은 받침240 누락의 좌표를 반환한다. 정상/오류 그림은 검증 문서 참조. 위의 파생 시트는 모든 새/기존 프로젝트에서 번들 등록되며 문서는 forest_harmony를 공유한다.
