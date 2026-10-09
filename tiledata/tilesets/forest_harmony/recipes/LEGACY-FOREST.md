# 공용 숲 실행 조립법

대상은 forest_harmony, 16×16px, 30열입니다. 다른 칩셋이나 파생판에는 실행하지 마세요.

## 실행 순서
1. 이 카테고리의 문서와 이미지를 읽습니다.
2. inspect_forest_recipe로 필요한 영역과 부품 좌표를 확인합니다.
3. stamp_forest_recipe를 호출합니다. 타일 번호를 직접 재생성하지 않습니다.
4. 같은 인수로 inspect_forest_recipe에 checkPlaced:true를 주어 valid:true, mismatchCount:0인지 확인합니다.

예시(실제 mapId로 교체):

```json
{"mapId":"대상맵","recipeId":"strip","x":2,"y":2,"repeats":2,"referencePurpose":"forest-executable-v1"}
```

referencePurpose는 쓰기 도구에 지정합니다. inspect에는 넣지 않습니다. 출입구/집 앞 실제 좌표 2~16개를 accessPoints:[{x:0,y:0},{x:1,y:0}] 형태로 지정하면 배치 후 타일 통행 연결을 확인합니다. 위 좌표는 형식 예시이며 실제 맵 출입구를 조회해 교체해야 합니다. 생략하면 연결을 검증하지 않습니다.

## 정확한 조립 규칙
- strip: repeats=N(1~16), 전체 폭=6N+2, 높이=6. 본체는 (x+1+6i,y), i=0..N-1에 먼저 배치합니다. 그 다음 왼쪽 4×6 마감을 (x,y), 오른쪽 4×6 마감을 (x+6N-2,y)에 덮습니다. 각 마감은 본체와 3열 겹칩니다.
- tree, small-bush, northwest, northeast, east, southeast, southwest: parts.json에 해당하는 온전한 패턴을 배치합니다. repeats는 주지 않습니다.
- lowerTiles와 upperTiles는 행 우선 배열입니다. index=localY*width+localX. -1은 비우기이며 생략이 아닙니다. 줄기·뿌리를 자르거나 수관 방향을 추측하지 않습니다.
- 기존 이벤트는 항상 보존합니다. 기존 길/오브젝트가 있으면 거부합니다. overwrite:true는 확인한 사각형 전체를 지우고 덮으므로 사용자 배치와 겹치지 않는 위치를 우선 선택합니다.
- 오류가 나면 해당 좌표와 code를 읽고 위치/입력만 수정합니다. 실패한 배치는 일부만 남기지 않습니다.

## 검증과 한계
checkPlaced는 원본 조립 결과와 두 레이어 모든 칸을 비교해 틀린 좌표·기대값·실제값을 반환합니다(최대64개 상세, 총개수 별도). 이는 조립 규칙 일치 검사이며 미적 품질 보증이 아닙니다. accessPoints 검사는 타일 통행만 다루며 NPC·이벤트 조건은 별도 플레이 검수가 필요합니다. 지원되지 않는 임의 곡선, 대각 숲, 새 마을 전체를 자동으로 설계하는 도구가 아닙니다. 저가 모델 자체의 성공률은 아직 측정하지 않았습니다.

## 원본 해상도 조립 예시
![strip.png](image:recipe-strip)

![northwest.png](image:recipe-northwest)

![tree.png](image:recipe-tree)
