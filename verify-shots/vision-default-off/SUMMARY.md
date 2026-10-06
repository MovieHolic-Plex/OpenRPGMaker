# 선택 기능인 시야 차단의 기본 OFF

- 공통 기본값과 에디터 미리보기는 이미 false였다. 기존 영상은 기능 검수를 위해 ON으로 만든 별도 시연이었다.
- createBlankMap은 각 지도에 독립적인 DEFAULT_TERRAIN_GAMEPLAY 사본을 명시적으로 저장한다. 새 맵의 visionBlocking은 false다.
- 게임 시야 패널에 「선택 기능이며 기본은 꺼짐」과 직접 켜는 조작을 안내한다.
- 실제 새 맵 생성 값 OFF와 지도 간 옵션 독립성 확인: defaults.json.
- 정본 SQLite 읽기: project id c779e278-8cec-4da4-9c2f-df423460b60d, 121개 지도 중 시야 차단 ON 0개, AI 기록 0개. 정본 콘텐츠에 쓰지 않았다.
- 기존에 직접 ON을 저장한 지도의 선택은 유지한다. 규칙 없는 이전 맵의 해석도 OFF다.
- scripts/capture/capture-vision-default-off.mjs는 실행 중인 에디터의 격리 새 프로젝트에서 게임 시야/미리보기/고지 확대 체크가 모두 해제되어 있는지 확인한다.
- AGENTS 제한에 따라 gates/vitest/전체 typecheck는 실행하지 않는다.
