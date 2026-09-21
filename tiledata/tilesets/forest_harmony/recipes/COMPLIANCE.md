# 사용자 요구사항별 근거

대상은 공용 forest_harmony와 해당 공용 AI 문서다. 다른 타일셋의 번호를 섞지 않는다.

|요구|구현 및 근거|
|---|---|
|타일셋 ID, 원본 좌표, 폭·높이, 레이어, 배열|parts.json의 부품10개 및 catalog.json의 조립6개; sourceTiles / tileCoordinates; 0기준 칸/픽셀 좌표|
|그대로 실행할 순서와 조건|public-assembly-guide.md; 각 recipe-*.md의 steps; inspect_tile_recipe / stamp_tile_recipe|
|숲 영역 입력→정답 배열→완성 그림|recipe-forest-strip.md; 14×6 영역과 원점, 두 레이어 전체 행 표, forest-strip-normal.png|
|뿌리/줄기/외곽/출입구 자동검증|validate_tile_recipes; validation-examples.json의 실제 변조 결과와 오류 좌표|
|정확한 번호와 하위/상위 전체 배치표|각 recipe 문서에 행별 표와 기계 판독 JSON을 함께 수록|
|건물·가구·숲·울타리·동굴 순서와 모서리 방향|house-wood / furniture-table / forest-strip·tree / fence-gate / cave-cliff|
|반복 조각·문·접근칸·정상/오류 비교|roles, steps, doors, access; 정상6장, 비교8장; 내장 접근칸 자동 조회와 외부 entryPoints|
|기존 레이어 설명 정정|layer-corrections.json 99항목; VILLAGE.md의 줄기 시작 행 정정; 사용자 override/priority 보존|
|모든 프로젝트에서 접근|공용 번들 referenceDocuments; createBlankProject; ensureForestHarmonyReferences의 기존 프로젝트 보충; 공용 다운로드 맵|
|저장 후 실제 확인|verify-shots/public-tile-recipes/의 SQLite 영수증, factory 검증, 브라우저 조회 증거|

검증은 명시된 조립법의 구조 및 타일 통행 범위다. 임의 맵 자동인식, 이벤트 전이 실행,
미적 품질, 저가 모델 자체의 성공률을 검증했다고 주장하지 않는다.
