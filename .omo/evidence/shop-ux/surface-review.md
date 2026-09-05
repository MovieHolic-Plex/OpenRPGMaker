# 상점 표면 하한선 검토

최소 상점 fixture의 `item1`은 captureProject에 없는 참조였다. 실제 존재하는 `item_potion`으로 바꾸고 정본 수확기(captureCommandSurface, captureInteractionSurface, captureCommitSurface)로 상점 항목만 갱신했다. 다른 명령의 JSON 값은 변경 전과 동일함을 비교했다.

새 화면은 활성 탭만 마운트한다. 첫 상품 탭은 form 27 testid / 17 controls, interaction 4 probes / 3 reactions, commit 4 probes / 2 commits다. 가격 기본값 radio를 해제하는 probe는 `radio-uncheck`, 기본 가격 모드의 숫자 입력은 `disabled`가 정상이다. 이전 검색·종류 필터와 분기 명령 선택은 추가창/다른 탭으로 이동했으므로 초기 표면의 no-commit 목록에서 제거했다. 변경된 반응 목록은 사계절, 직접 지정 가격 모드, 가격 입력이다.

CSS live 기준선에서는 새 초기 상품 표면에 대응하는 shop 클래스와 기존 상점의 `is-locked` 상태만 갱신했다. 옛 shop-goods/filter/rail 구조는 없어졌고, 규칙·분기·고급 설정 클래스는 해당 탭을 열 때 마운트된다. 따라서 초기 표면 클래스 보호 범위는 줄었으며, 이동한 입력의 접근·동작은 shopCommandFullscreenUi / shopCommandBodyUx / commandEditModalPreview / eventEditorStagedState와 실제 브라우저 탭 전환으로 확인했다. 관련 없는 클래스 속성은 그대로 두었으며 기존 `.selected`의 `bottom` 실패도 숨기지 않았다.

하한선 3개와 반응/no-commit 목록, CSS live 기준선 변경은 구현과 분리한 커밋에서 검토한다. 실제 화면 기하는 geometry.json과 세 크기의 PNG에서 확인할 수 있다.

최신 main의 성장 트리 시트와 합쳐지면서 CSS 파일 수가 기존 한도 266개에서 267개가 됐다. 새 상점 스타일을 197줄의 전용 시트로 유지하기 위해 CSS 파일 예산만 1개 늘리고 해당 경로를 기록했다. hex/important/undefined variable 등 다른 예산은 변경하지 않았다.
