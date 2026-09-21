# 숲 tree

타일셋 forest_harmony; 원점 (x,y); 전체 폭 3, 높이 4.

## 입력
```json
{
  "mapId": "실제맵ID",
  "placement": {
    "recipeId": "forest-tree",
    "x": 2,
    "y": 2
  }
}
```
요청 영역은 원점 (2,2)에서 이 문서에 명시한 전체 폭·높이이다. mapId를 실제 값으로 바꾼다.

## 정답 전체 배치표
각 행은 좌→우, 행 순서는 위→아래. 맵 좌표는 원점+(열,행).

### lowerTiles

```text
 240  240  240
 240  240  240
1038 1039 1040
1068 1069 1070
```

### upperTiles

```text
 978  979  980
1008 1009 1010
  -1   -1   -1
  -1   -1   -1
```

## 부품 사전·원본 시트 좌표·결합·문/접근칸

```json
{
  "id": "forest-tree",
  "name": "숲 tree",
  "kind": "forest",
  "tilesetId": "forest_harmony",
  "width": 3,
  "height": 4,
  "lowerTiles": [
    240,
    240,
    240,
    240,
    240,
    240,
    1038,
    1039,
    1040,
    1068,
    1069,
    1070
  ],
  "upperTiles": [
    978,
    979,
    980,
    1008,
    1009,
    1010,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1
  ],
  "roles": [
    "edge-west",
    "canopy",
    "edge-east",
    "edge-west",
    "canopy",
    "edge-east",
    "trunk",
    "trunk",
    "trunk",
    "root",
    "root",
    "root"
  ],
  "access": [],
  "doors": [],
  "steps": [
    {
      "partId": "forest-trees:tree",
      "x": 0,
      "y": 0
    }
  ],
  "source": {
    "recipeId": "tree",
    "x": 0,
    "y": 0
  },
  "tileCoordinates": [
    {
      "id": 240,
      "col": 0,
      "row": 8,
      "pixelX": 0,
      "pixelY": 128,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    },
    {
      "id": 978,
      "col": 18,
      "row": 32,
      "pixelX": 288,
      "pixelY": 512,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": "none",
      "graft": null
    },
    {
      "id": 979,
      "col": 19,
      "row": 32,
      "pixelX": 304,
      "pixelY": 512,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": "none",
      "graft": null
    },
    {
      "id": 980,
      "col": 20,
      "row": 32,
      "pixelX": 320,
      "pixelY": 512,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": "none",
      "graft": null
    },
    {
      "id": 1008,
      "col": 18,
      "row": 33,
      "pixelX": 288,
      "pixelY": 528,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": "none",
      "graft": null
    },
    {
      "id": 1009,
      "col": 19,
      "row": 33,
      "pixelX": 304,
      "pixelY": 528,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": "none",
      "graft": null
    },
    {
      "id": 1010,
      "col": 20,
      "row": 33,
      "pixelX": 320,
      "pixelY": 528,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": "none",
      "graft": null
    },
    {
      "id": 1038,
      "col": 18,
      "row": 34,
      "pixelX": 288,
      "pixelY": 544,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": 240,
      "graft": null
    },
    {
      "id": 1039,
      "col": 19,
      "row": 34,
      "pixelX": 304,
      "pixelY": 544,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": 240,
      "graft": null
    },
    {
      "id": 1040,
      "col": 20,
      "row": 34,
      "pixelX": 320,
      "pixelY": 544,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": 240,
      "graft": null
    },
    {
      "id": 1068,
      "col": 18,
      "row": 35,
      "pixelX": 288,
      "pixelY": 560,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": 240,
      "graft": null
    },
    {
      "id": 1069,
      "col": 19,
      "row": 35,
      "pixelX": 304,
      "pixelY": 560,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": 240,
      "graft": null
    },
    {
      "id": 1070,
      "col": 20,
      "row": 35,
      "pixelX": 320,
      "pixelY": 560,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": 240,
      "graft": null
    }
  ]
}
```

정상: 원본 16px 칩 조립. 실제 플레이 화면이 아닌 정확한 배열 미리보기.

![forest-tree-normal.png](image:forest-tree-normal)

왼쪽 정상 / 오른쪽 오류(빨간 테두리). missing-piece, 실제 맵 (2,4).

![forest-tree-missing-piece.png](image:forest-tree-missing-piece)

