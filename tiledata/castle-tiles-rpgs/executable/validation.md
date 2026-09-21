# 오류를 좌표로 돌려주는 자동 검증

validate_tile_assembly({mapId,plan})를 실제 편집 중 맵에 호출합니다.

- CUT_ROOT: 필수 마지막 뿌리 행의 불일치 또는 맵 밖 잘림.
- MISSING_TRUNK: 선언된 나무 중간 행 불일치(삭제·대체 포함).
- REVERSED_EDGE: 왼쪽 마감에 오른쪽 마감 타일을 사용하거나 그 반대.
- BLOCKED_ENTRANCE: 엔진 통행 또는 이벤트 점유가 지정 접근을 막음.
- PART_MISMATCH/OUT_OF_BOUNDS: 기타 부품 누락·잘못된 좌표.

expected/actual은 타일 번호, x/y는 실제 맵 좌표입니다. 출입구 오류는 그림 번호가 아닌 통행 판정이므로 expected/actual 대신 이유가 반환됩니다. valid는 이 계획의 검사 범위에만 적용됩니다.

## 정상 및 실제 오류 주입 결과
```json
{
  "valid": {
    "valid": true,
    "issues": [],
    "scope": "Declared parts and one-step entrance approaches only; no aesthetic approval or transfer-event validation"
  },
  "failures": [
    {
      "case": "root",
      "changed": {
        "layer": "lower",
        "x": 3,
        "y": 7,
        "tile": -1
      },
      "result": {
        "valid": false,
        "issues": [
          {
            "code": "CUT_ROOT",
            "x": 3,
            "y": 7,
            "layer": "lower",
            "partId": "forest:left",
            "expected": 1430,
            "actual": -1,
            "message": "Restore the expected cell from the declared assembly"
          }
        ],
        "scope": "Declared parts and one-step entrance approaches only; no aesthetic approval or transfer-event validation"
      }
    },
    {
      "case": "trunk",
      "changed": {
        "layer": "lower",
        "x": 7,
        "y": 5,
        "tile": -1
      },
      "result": {
        "valid": false,
        "issues": [
          {
            "code": "MISSING_TRUNK",
            "x": 7,
            "y": 5,
            "layer": "lower",
            "partId": "forest:body",
            "expected": 1353,
            "actual": -1,
            "message": "Restore the expected cell from the declared assembly"
          }
        ],
        "scope": "Declared parts and one-step entrance approaches only; no aesthetic approval or transfer-event validation"
      }
    },
    {
      "case": "edge",
      "changed": {
        "layer": "upper",
        "x": 3,
        "y": 2,
        "tile": 1440
      },
      "result": {
        "valid": false,
        "issues": [
          {
            "code": "REVERSED_EDGE",
            "x": 3,
            "y": 2,
            "layer": "upper",
            "partId": "forest:left",
            "expected": 1410,
            "actual": 1440,
            "message": "Restore the expected cell from the declared assembly"
          }
        ],
        "scope": "Declared parts and one-step entrance approaches only; no aesthetic approval or transfer-event validation"
      }
    },
    {
      "case": "entrance",
      "changed": {
        "layer": "lower",
        "x": 10,
        "y": 9,
        "tile": 1364
      },
      "result": {
        "valid": false,
        "issues": [
          {
            "code": "BLOCKED_ENTRANCE",
            "x": 10,
            "y": 9,
            "message": "Engine collision blocks the specified approach"
          }
        ],
        "scope": "Declared parts and one-step entrance approaches only; no aesthetic approval or transfer-event validation"
      }
    }
  ]
}
```