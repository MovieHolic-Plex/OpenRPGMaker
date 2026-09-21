# 저비용 AI용 실행형 타일 지침

공용 성채·숲 칩셋의 AI 참고문서 → **실행형 부품·조립·검증**에 제공한다.
문서 21개(안내·조립·입출력·검증 4개 + 부품 17개), 완성 이미지 1개.

- `parts.json`: 타일셋 ID, 셀 크기와 열 수, 각 부품 크기, 원본 좌표, lower/upper 행렬.
- `input.json` → `plan.json` → `output.json`: 20×12 맵의 (3,2,14,6) 숲 조립 예제.
- `forest-output.png`: 결과 배열의 실제 타일 렌더. AI 생성 그림이 아니다.
- `validation-examples.json`: 정상 결과 및 뿌리(3,7), 줄기(7,5), 반대쪽 마감(3,2), 막힌 출입구(10,9)의 실제 오류 반환.
- `*.md`: DB에 넣는 문서 원문. 자료만으로 미술적 완성도를 보장한다고 하지 않는다.

에디터 읽기 도구: get_tile_assembly_part / preview_forest_strip / validate_tile_assembly.
CLI: `node scripts/content/tile-assembly.mjs <preview|validate> <project.json> <mapId> <input-or-plan.json> <output.json>`.
검증 실패 시 CLI 종료 코드는 2다. 미리보기는 프로젝트를 저장하지 않는다.

검사 범위는 선언된 부품 및 지정 입구 접근 한 칸이다. 선언하지 않은 물체를 자동 인식하거나
임의 외곽·지도 전체 통행·전송 이벤트까지 검증하지 않는다. 숲 레시피는 남향, 높이6,
폭6*N+2(N>=2)이며 잘라 맞추지 않는다. NPC 페이지 조건은 보수적으로 처리한다.
