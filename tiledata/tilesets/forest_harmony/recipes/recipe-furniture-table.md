# 가로 탁자와 접근칸

타일셋 forest_harmony; 원점 (x,y); 전체 폭 3, 높이 2.

## 입력
```json
{
  "mapId": "실제맵ID",
  "placement": {
    "recipeId": "furniture-table",
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
1141 1141 1141
1141 1141 1141
```

### upperTiles

```text
 234  235  236
  -1   -1   -1
```

## 부품 사전·원본 시트 좌표·결합·문/접근칸

```json
{
  "id": "furniture-table",
  "name": "가로 탁자와 접근칸",
  "kind": "furniture",
  "tilesetId": "forest_harmony",
  "width": 3,
  "height": 2,
  "lowerTiles": [
    1141,
    1141,
    1141,
    1141,
    1141,
    1141
  ],
  "upperTiles": [
    234,
    235,
    236,
    -1,
    -1,
    -1
  ],
  "roles": [
    "edge-west",
    "furniture",
    "edge-east",
    "ground",
    "ground",
    "ground"
  ],
  "access": [
    {
      "x": 1,
      "y": 1,
      "role": "interaction"
    }
  ],
  "doors": [],
  "steps": [
    {
      "part": "ground",
      "rect": [
        0,
        0,
        3,
        2
      ]
    },
    {
      "part": "left",
      "tile": 234,
      "x": 0,
      "y": 0
    },
    {
      "part": "repeat",
      "tile": 235,
      "x": 1,
      "y": 0
    },
    {
      "part": "right",
      "tile": 236,
      "x": 2,
      "y": 0
    }
  ],
  "tileCoordinates": [
    {
      "id": 234,
      "col": 24,
      "row": 7,
      "pixelX": 384,
      "pixelY": 112,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 235,
      "col": 25,
      "row": 7,
      "pixelX": 400,
      "pixelY": 112,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 236,
      "col": 26,
      "row": 7,
      "pixelX": 416,
      "pixelY": 112,
      "width": 16,
      "height": 16,
      "home": "upper",
      "backing": null,
      "graft": null
    },
    {
      "id": 1141,
      "col": 1,
      "row": 38,
      "pixelX": 16,
      "pixelY": 608,
      "width": 16,
      "height": 16,
      "home": "lower",
      "backing": null,
      "graft": null
    }
  ]
}
```

정상: 원본 16px 칩 조립. 실제 플레이 화면이 아닌 정확한 배열 미리보기.

![furniture-table-normal.png](image:furniture-table-normal)

왼쪽 정상 / 오른쪽 오류(빨간 테두리). wrong-layer, 실제 맵 (2,2).

![furniture-table-wrong-layer.png](image:furniture-table-wrong-layer)

