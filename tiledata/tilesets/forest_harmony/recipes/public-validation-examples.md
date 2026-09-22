# 자동 검증과 오류 좌표

validate_tile_recipes는 recipeId와 원점을 기준으로 모든 칸을 비교한다. 자동으로 임의 맵에서 집/나무를 인식하는 비전 도구는 아니다.

|코드|검사|
|---|---|
|cut-root|뿌리 기대 칸이 바닥/빈칸으로 바뀜|
|missing-trunk|줄기 기대 칸이 바닥/빈칸으로 바뀜|
|wrong-edge-direction|정해진 외곽/모서리와 다른 조각|
|wrong-layer|기대 칩이 반대 레이어에 있음|
|broken-door / broken-cave-mouth|문짝/동굴 입구 배열 불일치|
|blocked-entrance|내장 접근칸 또는 제공된 출입구가 막힘|
|disconnected-entrance|방향별 통행 BFS에서 접근칸끼리 연결 안 됨|
|tile-mismatch|그 외 타일 불일치|

오류에는 x/y/layer/expected/actual/role이 들어간다. 통행 오류는 x/y를 반환한다. 전체 개수는 issueCount, 상세는 최대128개다. 정상 배치 6개와 오류 변조 8개 및 숲으로 경로를 막는 사례를 실제 조립기로 계산했다. 실패한 쓰기는 부분 변경을 남기지 않는다.

```json
[
  {
    "recipeId": "forest-strip",
    "fault": "cut-root",
    "placement": {
      "recipeId": "forest-strip",
      "x": 2,
      "y": 2
    },
    "expectedFault": {
      "x": 10,
      "y": 7
    },
    "report": {
      "valid": false,
      "issueCount": 1,
      "issues": [
        {
          "code": "cut-root",
          "x": 10,
          "y": 7,
          "layer": "lower",
          "expected": 1363,
          "actual": 1141,
          "role": "root"
        }
      ],
      "access": {
        "anchors": [],
        "checked": false,
        "externalEntriesProvided": false
      },
      "scope": "registered-recipe footprints; tile passability, not runtime event execution"
    }
  },
  {
    "recipeId": "forest-strip",
    "fault": "missing-trunk",
    "placement": {
      "recipeId": "forest-strip",
      "x": 2,
      "y": 2
    },
    "expectedFault": {
      "x": 10,
      "y": 6
    },
    "report": {
      "valid": false,
      "issueCount": 1,
      "issues": [
        {
          "code": "missing-trunk",
          "x": 10,
          "y": 6,
          "layer": "lower",
          "expected": 1357,
          "actual": 1141,
          "role": "trunk"
        }
      ],
      "access": {
        "anchors": [],
        "checked": false,
        "externalEntriesProvided": false
      },
      "scope": "registered-recipe footprints; tile passability, not runtime event execution"
    }
  },
  {
    "recipeId": "forest-strip",
    "fault": "wrong-edge-direction",
    "placement": {
      "recipeId": "forest-strip",
      "x": 2,
      "y": 2
    },
    "expectedFault": {
      "x": 2,
      "y": 2
    },
    "report": {
      "valid": false,
      "issueCount": 1,
      "issues": [
        {
          "code": "wrong-edge-direction",
          "x": 2,
          "y": 2,
          "layer": "upper",
          "expected": 1410,
          "actual": 1443,
          "role": "edge-west"
        }
      ],
      "access": {
        "anchors": [],
        "checked": false,
        "externalEntriesProvided": false
      },
      "scope": "registered-recipe footprints; tile passability, not runtime event execution"
    }
  },
  {
    "recipeId": "forest-tree",
    "fault": "missing-piece",
    "placement": {
      "recipeId": "forest-tree",
      "x": 2,
      "y": 2
    },
    "expectedFault": {
      "x": 2,
      "y": 4
    },
    "report": {
      "valid": false,
      "issueCount": 1,
      "issues": [
        {
          "code": "missing-trunk",
          "x": 2,
          "y": 4,
          "layer": "lower",
          "expected": 1038,
          "actual": 1141,
          "role": "trunk"
        }
      ],
      "access": {
        "anchors": [],
        "checked": false,
        "externalEntriesProvided": false
      },
      "scope": "registered-recipe footprints; tile passability, not runtime event execution"
    }
  },
  {
    "recipeId": "house-wood",
    "fault": "blocked-entrance",
    "placement": {
      "recipeId": "house-wood",
      "x": 2,
      "y": 2
    },
    "expectedFault": {
      "x": 6,
      "y": 9
    },
    "report": {
      "valid": false,
      "issueCount": 2,
      "issues": [
        {
          "code": "tile-mismatch",
          "x": 6,
          "y": 9,
          "layer": "upper",
          "expected": -1,
          "actual": 379,
          "role": "ground"
        },
        {
          "code": "blocked-entrance",
          "x": 6,
          "y": 9
        }
      ],
      "access": {
        "anchors": [
          {
            "x": 6,
            "y": 9
          },
          {
            "x": 6,
            "y": 10
          }
        ],
        "checked": true,
        "externalEntriesProvided": false
      },
      "scope": "registered-recipe footprints; tile passability, not runtime event execution"
    }
  },
  {
    "recipeId": "furniture-table",
    "fault": "wrong-layer",
    "placement": {
      "recipeId": "furniture-table",
      "x": 2,
      "y": 2
    },
    "expectedFault": {
      "x": 2,
      "y": 2
    },
    "report": {
      "valid": false,
      "issueCount": 2,
      "issues": [
        {
          "code": "wrong-edge-direction",
          "x": 2,
          "y": 2,
          "layer": "lower",
          "expected": 1141,
          "actual": 234,
          "role": "edge-west"
        },
        {
          "code": "wrong-layer",
          "x": 2,
          "y": 2,
          "layer": "upper",
          "expected": 234,
          "actual": -1,
          "role": "edge-west"
        }
      ],
      "access": {
        "anchors": [
          {
            "x": 3,
            "y": 3
          }
        ],
        "checked": true,
        "externalEntriesProvided": false
      },
      "scope": "registered-recipe footprints; tile passability, not runtime event execution"
    }
  },
  {
    "recipeId": "fence-gate",
    "fault": "blocked-entrance",
    "placement": {
      "recipeId": "fence-gate",
      "x": 2,
      "y": 2
    },
    "expectedFault": {
      "x": 5,
      "y": 6
    },
    "report": {
      "valid": false,
      "issueCount": 3,
      "issues": [
        {
          "code": "tile-mismatch",
          "x": 5,
          "y": 6,
          "layer": "upper",
          "expected": -1,
          "actual": 379,
          "role": "ground"
        },
        {
          "code": "blocked-entrance",
          "x": 5,
          "y": 6
        },
        {
          "code": "disconnected-entrance",
          "x": 5,
          "y": 7
        }
      ],
      "access": {
        "anchors": [
          {
            "x": 5,
            "y": 5
          },
          {
            "x": 5,
            "y": 6
          },
          {
            "x": 5,
            "y": 7
          }
        ],
        "checked": true,
        "externalEntriesProvided": false
      },
      "scope": "registered-recipe footprints; tile passability, not runtime event execution"
    }
  },
  {
    "recipeId": "cave-cliff",
    "fault": "blocked-entrance",
    "placement": {
      "recipeId": "cave-cliff",
      "x": 2,
      "y": 2
    },
    "expectedFault": {
      "x": 5,
      "y": 6
    },
    "report": {
      "valid": false,
      "issueCount": 2,
      "issues": [
        {
          "code": "tile-mismatch",
          "x": 5,
          "y": 6,
          "layer": "upper",
          "expected": -1,
          "actual": 379,
          "role": "ground"
        },
        {
          "code": "blocked-entrance",
          "x": 5,
          "y": 6
        }
      ],
      "access": {
        "anchors": [
          {
            "x": 5,
            "y": 6
          },
          {
            "x": 5,
            "y": 7
          }
        ],
        "checked": true,
        "externalEntriesProvided": false
      },
      "scope": "registered-recipe footprints; tile passability, not runtime event execution"
    }
  },
  {
    "case": "disconnected-entrance",
    "rejected": true,
    "mapUnchanged": true
  }
]
```

