## 전체 배치 예제와 실제 결손 오류

```json
{"iconId": "desert-east/3\uce35 \uc804\ud0d1", "at": {"x": 4, "y": 4}, "lower": [[-1], [-1]], "upper": [[480], [510]], "error": {"code": "MISSING_CELL", "mapCell": {"x": 4, "y": 5}, "sourceTile": 510}}
```

![왼쪽 정상·오른쪽 밑줄 왼쪽 한 칸 결손](image:wmi-missing-cell)

왼쪽 배열을 그대로 찍으면 정상이다. 오른쪽은 upper[height-1][0]=-1로 변조한 오류다. lower의 -1은 기존 지형을 보존한다는 뜻이다.
