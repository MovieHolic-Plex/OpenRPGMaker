# 정상·오류와 자동 좌표 검사

```bash
node scripts/content/validate-diverse-villages.mjs project.json terrace-cliff-village
```

4개 동결 표본과 같은 번호/배치를 비교하고, 잔디 사선의 방향·색 판본·바닥 받침을 검사하며 절벽 열 문법으로 사선 몸통·밑단·계단 끝을 별도 검사하는 읽기 전용 도구다. 임의 마을을 잘못된 마을이라고 판정하지 않는다. 성공 exit0, 오류 exit1. 최대128개와 전체 수를 반환한다. 엔진 타일 통행만 검사하며 NPC/실내/이벤트/미적 품질은 판정하지 않는다.
```json
[
  {
    "valid": true,
    "mapId": "pine-hamlets",
    "totalErrors": 0,
    "errors": [],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  },
  {
    "valid": true,
    "mapId": "terrace-cliff-village",
    "totalErrors": 0,
    "errors": [],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  },
  {
    "valid": true,
    "mapId": "twin-falls-river-village",
    "totalErrors": 0,
    "errors": [],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  },
  {
    "valid": true,
    "mapId": "reed-bay-village",
    "totalErrors": 0,
    "errors": [],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
]
```

## cut-root
```json
{
  "input": {
    "code": "cut-root",
    "mapId": "terrace-cliff-village",
    "x": 62,
    "y": 12,
    "layer": "lower",
    "tile": 1430,
    "replacement": 240
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 1,
    "errors": [
      {
        "code": "cut-root",
        "x": 62,
        "y": 12,
        "layer": "lower",
        "expected": 1430,
        "actual": 240
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/cut-root.png)

## missing-trunk
```json
{
  "input": {
    "code": "missing-trunk",
    "mapId": "terrace-cliff-village",
    "x": 62,
    "y": 11,
    "layer": "lower",
    "tile": 1426,
    "replacement": 240
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 1,
    "errors": [
      {
        "code": "missing-trunk",
        "x": 62,
        "y": 11,
        "layer": "lower",
        "expected": 1426,
        "actual": 240
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/missing-trunk.png)

## wrong-edge-direction
```json
{
  "input": {
    "code": "wrong-edge-direction",
    "mapId": "terrace-cliff-village",
    "x": 62,
    "y": 10,
    "layer": "upper",
    "tile": 2577,
    "replacement": 2589
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 1,
    "errors": [
      {
        "code": "wrong-edge-direction",
        "x": 62,
        "y": 10,
        "layer": "upper",
        "expected": 2577,
        "actual": 2589
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/wrong-edge-direction.png)

## wrong-layer
```json
{
  "input": {
    "code": "wrong-layer",
    "mapId": "terrace-cliff-village",
    "x": 34,
    "y": 15,
    "layer": "upper",
    "tile": 2620,
    "replacement": -1,
    "move": true
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 3,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 34,
        "y": 15,
        "layer": "lower",
        "expected": 240,
        "actual": 2620
      },
      {
        "code": "wrong-layer",
        "x": 34,
        "y": 15,
        "layer": "upper",
        "expected": 2620,
        "actual": -1
      },
      {
        "code": "prop-purpose-anchor-missing",
        "x": 37,
        "y": 16
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/wrong-layer.png)

## blocked-entrance
```json
{
  "input": {
    "code": "blocked-entrance",
    "mapId": "terrace-cliff-village",
    "x": 29,
    "y": 17,
    "layer": "upper",
    "tile": -1,
    "replacement": 237
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 3,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 29,
        "y": 17,
        "layer": "upper",
        "expected": -1,
        "actual": 237
      },
      {
        "code": "unowned-prop",
        "x": 29,
        "y": 17
      },
      {
        "code": "blocked-entrance",
        "x": 29,
        "y": 17,
        "role": "door-front"
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/blocked-entrance.png)

## cliff-face-direction
```json
{
  "input": {
    "code": "cliff-face-direction",
    "mapId": "terrace-cliff-village",
    "x": 83,
    "y": 47,
    "layer": "upper",
    "tile": 2691,
    "replacement": 2688
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 2,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 83,
        "y": 47,
        "layer": "upper",
        "expected": 2691,
        "actual": 2688
      },
      {
        "code": "cliff-face-direction",
        "x": 83,
        "y": 47,
        "expectedUpper": 2691,
        "actualUpper": 2688
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/cliff-face-direction.png)

## cliff-toe-gap
```json
{
  "input": {
    "code": "cliff-toe-gap",
    "mapId": "terrace-cliff-village",
    "x": 40,
    "y": 53,
    "layer": "upper",
    "tile": 2686,
    "replacement": -1
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 2,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 40,
        "y": 53,
        "layer": "upper",
        "expected": 2686,
        "actual": -1
      },
      {
        "code": "cliff-toe-gap",
        "x": 40,
        "y": 53,
        "expectedUpper": 2686,
        "actualUpper": -1
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/cliff-toe-gap.png)

## cliff-stair-gap
```json
{
  "input": {
    "code": "cliff-stair-gap",
    "mapId": "terrace-cliff-village",
    "x": 62,
    "y": 27,
    "layer": "lower",
    "tile": 2689,
    "replacement": 240
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 2,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 62,
        "y": 27,
        "layer": "lower",
        "expected": 2689,
        "actual": 240
      },
      {
        "code": "cliff-stair-gap",
        "x": 62,
        "y": 27,
        "expectedUpper": -1,
        "actualUpper": -1,
        "expectedLower": 2689,
        "actualLower": 240
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/cliff-stair-gap.png)

## terrace-without-stairs
```json
{
  "input": {
    "code": "terrace-without-stairs",
    "mapId": "pine-hamlets",
    "x": 2,
    "y": 18,
    "layer": "lower",
    "tile": 240,
    "replacement": 240,
    "rects": [
      {
        "x": 2,
        "y": 18,
        "w": 9,
        "h": 3
      },
      {
        "x": 2,
        "y": 21,
        "w": 4,
        "h": 6
      },
      {
        "x": 2,
        "y": 27,
        "w": 6,
        "h": 2
      }
    ],
    "errorX": 6,
    "errorY": 21
  },
  "result": {
    "valid": false,
    "mapId": "pine-hamlets",
    "totalErrors": 78,
    "errors": [
      {
        "code": "wrong-edge-direction",
        "x": 2,
        "y": 18,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 3,
        "y": 18,
        "layer": "lower",
        "expected": 1422,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 3,
        "y": 18,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 4,
        "y": 18,
        "layer": "lower",
        "expected": 1423,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 4,
        "y": 18,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 5,
        "y": 18,
        "layer": "lower",
        "expected": 1424,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 5,
        "y": 18,
        "layer": "upper",
        "expected": 2595,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 6,
        "y": 18,
        "layer": "lower",
        "expected": 1425,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 6,
        "y": 18,
        "layer": "upper",
        "expected": 2592,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 7,
        "y": 18,
        "layer": "lower",
        "expected": 1350,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 7,
        "y": 18,
        "layer": "upper",
        "expected": 2592,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 8,
        "y": 18,
        "layer": "lower",
        "expected": 1453,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 8,
        "y": 18,
        "layer": "upper",
        "expected": 2592,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 9,
        "y": 18,
        "layer": "lower",
        "expected": 1454,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 9,
        "y": 18,
        "layer": "upper",
        "expected": 2590,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 10,
        "y": 18,
        "layer": "lower",
        "expected": 1455,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 10,
        "y": 18,
        "layer": "upper",
        "expected": 2555,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 2,
        "y": 19,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 3,
        "y": 19,
        "layer": "lower",
        "expected": 1426,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 3,
        "y": 19,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 4,
        "y": 19,
        "layer": "lower",
        "expected": 1427,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 4,
        "y": 19,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 5,
        "y": 19,
        "layer": "lower",
        "expected": 1428,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 5,
        "y": 19,
        "layer": "upper",
        "expected": 2594,
        "actual": -1
      },
      {
        "code": "missing-trunk",
        "x": 6,
        "y": 19,
        "layer": "lower",
        "expected": 1429,
        "actual": 240
      },
      {
        "code": "missing-trunk",
        "x": 7,
        "y": 19,
        "layer": "lower",
        "expected": 1428,
        "actual": 240
      },
      {
        "code": "missing-trunk",
        "x": 8,
        "y": 19,
        "layer": "lower",
        "expected": 1457,
        "actual": 240
      },
      {
        "code": "missing-trunk",
        "x": 9,
        "y": 19,
        "layer": "lower",
        "expected": 1458,
        "actual": 240
      },
      {
        "code": "missing-trunk",
        "x": 10,
        "y": 19,
        "layer": "lower",
        "expected": 1459,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 2,
        "y": 20,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "cut-root",
        "x": 3,
        "y": 20,
        "layer": "lower",
        "expected": 1430,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 3,
        "y": 20,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "cut-root",
        "x": 4,
        "y": 20,
        "layer": "lower",
        "expected": 1431,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 4,
        "y": 20,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "cut-root",
        "x": 5,
        "y": 20,
        "layer": "lower",
        "expected": 1432,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 5,
        "y": 20,
        "layer": "upper",
        "expected": 2594,
        "actual": -1
      },
      {
        "code": "cut-root",
        "x": 6,
        "y": 20,
        "layer": "lower",
        "expected": 1433,
        "actual": 240
      },
      {
        "code": "cut-root",
        "x": 7,
        "y": 20,
        "layer": "lower",
        "expected": 1432,
        "actual": 240
      },
      {
        "code": "cut-root",
        "x": 8,
        "y": 20,
        "layer": "lower",
        "expected": 1461,
        "actual": 240
      },
      {
        "code": "cut-root",
        "x": 9,
        "y": 20,
        "layer": "lower",
        "expected": 1462,
        "actual": 240
      },
      {
        "code": "cut-root",
        "x": 10,
        "y": 20,
        "layer": "lower",
        "expected": 1463,
        "actual": 240
      },
      {
        "code": "wrong-edge-direction",
        "x": 2,
        "y": 21,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 3,
        "y": 21,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 4,
        "y": 21,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 5,
        "y": 21,
        "layer": "upper",
        "expected": 2594,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 2,
        "y": 22,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 3,
        "y": 22,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 4,
        "y": 22,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 5,
        "y": 22,
        "layer": "upper",
        "expected": 2594,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 2,
        "y": 23,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 3,
        "y": 23,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 4,
        "y": 23,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 5,
        "y": 23,
        "layer": "upper",
        "expected": 2594,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 2,
        "y": 24,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 3,
        "y": 24,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 4,
        "y": 24,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 5,
        "y": 24,
        "layer": "upper",
        "expected": 2594,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 2,
        "y": 25,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 3,
        "y": 25,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 4,
        "y": 25,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 5,
        "y": 25,
        "layer": "upper",
        "expected": 2594,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 2,
        "y": 26,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 3,
        "y": 26,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 4,
        "y": 26,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 5,
        "y": 26,
        "layer": "upper",
        "expected": 2594,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 2,
        "y": 27,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 3,
        "y": 27,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 4,
        "y": 27,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 5,
        "y": 27,
        "layer": "upper",
        "expected": 2596,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 6,
        "y": 27,
        "layer": "upper",
        "expected": 2587,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 7,
        "y": 27,
        "layer": "upper",
        "expected": 2584,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 2,
        "y": 28,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 3,
        "y": 28,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 4,
        "y": 28,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 5,
        "y": 28,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 6,
        "y": 28,
        "layer": "upper",
        "expected": 2568,
        "actual": -1
      },
      {
        "code": "wrong-edge-direction",
        "x": 7,
        "y": 28,
        "layer": "upper",
        "expected": 2594,
        "actual": -1
      },
      {
        "code": "terrace-without-stairs",
        "x": 6,
        "y": 21,
        "reached": {
          "x": 6,
          "y": 20
        }
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/terrace-without-stairs.png)

## waterfall-gap
```json
{
  "input": {
    "code": "waterfall-gap",
    "mapId": "twin-falls-river-village",
    "x": 41,
    "y": 22,
    "layer": "lower",
    "tile": 2700,
    "replacement": 240
  },
  "result": {
    "valid": false,
    "mapId": "twin-falls-river-village",
    "totalErrors": 2,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 41,
        "y": 22,
        "layer": "lower",
        "expected": 2700,
        "actual": 240
      },
      {
        "code": "waterfall-gap",
        "x": 41,
        "y": 22,
        "expectedLower": 2700,
        "actualLower": 240,
        "actualUpper": -1
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/waterfall-gap.png)

## grass-edge-direction
```json
{
  "input": {
    "code": "grass-edge-direction",
    "mapId": "terrace-cliff-village",
    "x": 26,
    "y": 7,
    "layer": "lower",
    "tile": 2692,
    "replacement": 2693
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 3,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 26,
        "y": 7,
        "layer": "lower",
        "expected": 2692,
        "actual": 2693
      },
      {
        "code": "grass-edge-direction",
        "x": 26,
        "y": 7,
        "expected": 2692,
        "actual": 2693
      },
      {
        "code": "grass-crest-gap",
        "x": 26,
        "y": 7,
        "sourceTile": 504
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/grass-edge-direction.png)

## grass-color-mismatch
```json
{
  "input": {
    "code": "grass-color-mismatch",
    "mapId": "terrace-cliff-village",
    "x": 26,
    "y": 7,
    "layer": "lower",
    "tile": 2692,
    "replacement": 504
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 3,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 26,
        "y": 7,
        "layer": "lower",
        "expected": 2692,
        "actual": 504
      },
      {
        "code": "grass-color-mismatch",
        "x": 26,
        "y": 7,
        "expected": 2692,
        "actual": 504
      },
      {
        "code": "grass-crest-gap",
        "x": 26,
        "y": 7,
        "sourceTile": 504
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/grass-color-mismatch.png)

## grass-crest-gap
```json
{
  "input": {
    "code": "grass-crest-gap",
    "mapId": "terrace-cliff-village",
    "x": 30,
    "y": 4,
    "layer": "lower",
    "tile": 2694,
    "replacement": 240
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 3,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 30,
        "y": 4,
        "layer": "lower",
        "expected": 2694,
        "actual": 240
      },
      {
        "code": "grass-edge-direction",
        "x": 30,
        "y": 4,
        "expected": 2694,
        "actual": 240
      },
      {
        "code": "grass-crest-gap",
        "x": 30,
        "y": 4,
        "sourceTile": 559
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/grass-crest-gap.png)

## map-entrance-blocked
```json
{
  "input": {
    "code": "map-entrance-blocked",
    "mapId": "terrace-cliff-village",
    "x": 42,
    "y": 71,
    "layer": "upper",
    "tile": -1,
    "replacement": 237
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 4,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 42,
        "y": 71,
        "layer": "upper",
        "expected": -1,
        "actual": 237
      },
      {
        "code": "unowned-prop",
        "x": 42,
        "y": 71
      },
      {
        "code": "map-entrance-blocked",
        "x": 42,
        "y": 71
      },
      {
        "code": "blocked-entrance",
        "x": 42,
        "y": 71,
        "role": "map-entrance"
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/map-entrance-blocked.png)

## unowned-prop
```json
{
  "input": {
    "code": "unowned-prop",
    "mapId": "terrace-cliff-village",
    "x": 23,
    "y": 31,
    "layer": "upper",
    "tile": -1,
    "replacement": 2638
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 2,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 23,
        "y": 31,
        "layer": "upper",
        "expected": -1,
        "actual": 2638
      },
      {
        "code": "unowned-prop",
        "x": 23,
        "y": 31
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/unowned-prop.png)

## scarecrow-without-garden
```json
{
  "input": {
    "code": "scarecrow-without-garden",
    "mapId": "terrace-cliff-village",
    "x": 70,
    "y": 41,
    "layer": "upper",
    "tile": 2613,
    "replacement": -1,
    "errorX": 70,
    "errorY": 39
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 3,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 70,
        "y": 41,
        "layer": "upper",
        "expected": 2613,
        "actual": -1
      },
      {
        "code": "scarecrow-without-garden",
        "x": 70,
        "y": 39
      },
      {
        "code": "prop-purpose-anchor-missing",
        "x": 73,
        "y": 42
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/scarecrow-without-garden.png)

## prop-purpose-anchor-missing
```json
{
  "input": {
    "code": "prop-purpose-anchor-missing",
    "mapId": "terrace-cliff-village",
    "x": 46,
    "y": 38,
    "layer": "upper",
    "tile": 234,
    "replacement": -1,
    "errorX": 46,
    "errorY": 36
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 3,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 46,
        "y": 38,
        "layer": "upper",
        "expected": 234,
        "actual": -1
      },
      {
        "code": "prop-purpose-anchor-missing",
        "x": 46,
        "y": 36
      },
      {
        "code": "prop-purpose-anchor-missing",
        "x": 48,
        "y": 36
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/prop-purpose-anchor-missing.png)

## civic-anchor-missing
```json
{
  "input": {
    "code": "civic-anchor-missing",
    "mapId": "reed-bay-village",
    "x": 52,
    "y": 24,
    "layer": "upper",
    "tile": 2639,
    "replacement": -1,
    "errorX": 54,
    "errorY": 26
  },
  "result": {
    "valid": false,
    "mapId": "reed-bay-village",
    "totalErrors": 4,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 52,
        "y": 24,
        "layer": "upper",
        "expected": 2639,
        "actual": -1
      },
      {
        "code": "civic-part-missing",
        "x": 52,
        "y": 24
      },
      {
        "code": "civic-anchor-missing",
        "x": 54,
        "y": 26
      },
      {
        "code": "civic-anchor-missing",
        "x": 52,
        "y": 26
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/civic-anchor-missing.png)

## civic-use-blocked
```json
{
  "input": {
    "code": "civic-use-blocked",
    "mapId": "reed-bay-village",
    "x": 51,
    "y": 24,
    "layer": "upper",
    "tile": -1,
    "replacement": 237
  },
  "result": {
    "valid": false,
    "mapId": "reed-bay-village",
    "totalErrors": 4,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 51,
        "y": 24,
        "layer": "upper",
        "expected": -1,
        "actual": 237
      },
      {
        "code": "unowned-prop",
        "x": 51,
        "y": 24
      },
      {
        "code": "blocked-entrance",
        "x": 51,
        "y": 24,
        "role": "civic-use"
      },
      {
        "code": "civic-use-blocked",
        "x": 51,
        "y": 24,
        "name": "낮은 돌 우물"
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/civic-use-blocked.png)

## wall-light-backing
```json
{
  "input": {
    "code": "wall-light-backing",
    "mapId": "reed-bay-village",
    "x": 36,
    "y": 9,
    "layer": "lower",
    "tile": 46,
    "replacement": 240
  },
  "result": {
    "valid": false,
    "mapId": "reed-bay-village",
    "totalErrors": 10,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 36,
        "y": 9,
        "layer": "lower",
        "expected": 46,
        "actual": 240
      },
      {
        "code": "civic-anchor-missing",
        "x": 38,
        "y": 12
      },
      {
        "code": "civic-anchor-missing",
        "x": 36,
        "y": 11
      },
      {
        "code": "civic-anchor-missing",
        "x": 40,
        "y": 11
      },
      {
        "code": "civic-anchor-missing",
        "x": 38,
        "y": 14
      },
      {
        "code": "civic-anchor-missing",
        "x": 40,
        "y": 9
      },
      {
        "code": "civic-anchor-missing",
        "x": 36,
        "y": 14
      },
      {
        "code": "civic-anchor-missing",
        "x": 40,
        "y": 14
      },
      {
        "code": "civic-anchor-missing",
        "x": 36,
        "y": 9
      },
      {
        "code": "wall-light-backing",
        "x": 36,
        "y": 9
      }
    ],
    "truncated": false,
    "scope": "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring."
  }
}
```

![왼쪽 정상, 오른쪽 오류](images/wall-light-backing.png)
