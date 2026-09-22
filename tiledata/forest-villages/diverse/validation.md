# 정상·오류와 자동 좌표 검사

```bash
node scripts/content/validate-diverse-villages.mjs project.json terrace-cliff-village
```

3개 동결 표본과 같은 번호/배치를 비교하고, 절벽 열 문법으로 사선 몸통·밑단·계단 끝을 별도 검사하는 읽기 전용 도구다. 임의 마을을 잘못된 마을이라고 판정하지 않는다. 성공 exit0, 오류 exit1. 최대128개와 전체 수를 반환한다. 엔진 타일 통행만 검사하며 NPC/실내/이벤트/미적 품질은 판정하지 않는다.
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
    "x": 83,
    "y": 31,
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
        "x": 83,
        "y": 31,
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
    "x": 83,
    "y": 30,
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
        "x": 83,
        "y": 30,
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
    "x": 83,
    "y": 29,
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
        "x": 83,
        "y": 29,
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
    "x": 38,
    "y": 15,
    "layer": "upper",
    "tile": 2639,
    "replacement": -1,
    "move": true
  },
  "result": {
    "valid": false,
    "mapId": "terrace-cliff-village",
    "totalErrors": 2,
    "errors": [
      {
        "code": "tile-mismatch",
        "x": 38,
        "y": 15,
        "layer": "lower",
        "expected": 240,
        "actual": 2639
      },
      {
        "code": "wrong-layer",
        "x": 38,
        "y": 15,
        "layer": "upper",
        "expected": 2639,
        "actual": -1
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
    "totalErrors": 2,
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
    "x": 73,
    "y": 49,
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
        "x": 73,
        "y": 49,
        "layer": "upper",
        "expected": 2691,
        "actual": 2688
      },
      {
        "code": "cliff-face-direction",
        "x": 73,
        "y": 49,
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
    "y": 57,
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
        "y": 57,
        "layer": "upper",
        "expected": 2686,
        "actual": -1
      },
      {
        "code": "cliff-toe-gap",
        "x": 40,
        "y": 57,
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
    "x": 58,
    "y": 34,
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
        "x": 58,
        "y": 34,
        "layer": "lower",
        "expected": 2689,
        "actual": 240
      },
      {
        "code": "cliff-stair-gap",
        "x": 58,
        "y": 34,
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
