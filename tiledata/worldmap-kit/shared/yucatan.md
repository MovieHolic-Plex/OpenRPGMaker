# 실제 지형 · 유카탄 반도

실제 유카탄 지형에 판타지 그림체를 쓴 사례. 마야 건축 고증과 완성 게임을 뜻하지 않는다.

## 실제 저장된 지형 설정

```json
{
  "theme": "fantasy",
  "ops": [
    {
      "style": "real",
      "box": [
        -93,
        14,
        -86,
        22
      ],
      "home": [
        -89,
        20.8
      ],
      "op": "continents"
    },
    {
      "style": "real",
      "box": [
        -93,
        14,
        -86,
        22
      ],
      "op": "continents",
      "home": [
        -89,
        20.8
      ]
    },
    {
      "kind": "broad",
      "density": 0.65,
      "poly": [
        [
          44,
          4
        ],
        [
          54,
          4
        ],
        [
          54,
          8
        ],
        [
          44,
          8
        ]
      ],
      "op": "forest"
    },
    {
      "kind": "broad",
      "poly": [
        [
          58,
          11
        ],
        [
          64,
          11
        ],
        [
          64,
          18
        ],
        [
          58,
          18
        ]
      ],
      "density": 0.6,
      "op": "forest"
    },
    {
      "ground": "grass",
      "op": "biome",
      "poly": [
        [
          44,
          3
        ],
        [
          55,
          3
        ],
        [
          55,
          9
        ],
        [
          44,
          9
        ]
      ]
    }
  ],
  "terrainId": "edit",
  "palette": "original",
  "base": "generate",
  "fitSalt": 0
}
```

- read_region_reference에서 자료를 찾고 import_region_reference로 새 맵에 가져온다.
- worldmapSource의 실제 지리 범위·home·ops와 characterScale을 보존한다.
- 선택 아이콘은 list_worldmap_icons에서 고른 뒤 참고문서 전 페이지와 그림을 읽고 stamp_worldmap_icon으로 전체 배치한다.
- 지형 편집 후 inspect_worldmap_icon과 check_reachability로 배열·입구 접근을 확인한다.

이동 이벤트는 새 목적지 맵과 연결해야 한다. includeEvents 기본값은 false다.
