# 집 옆 나무 팔레트 비교

공통 기준: 원본 current 나무 세 종류, 돌벽집 64×96, 한 그루의 밑동과 집 기초 y=100, 16px 타일 축척, 기존 그림자/잔디/포석 고정.

contact-sheet.png는 current/muted/warm, cool/contrast/balanced 순서의 3배 정수 픽셀 비교다. comparison-ui.png는 현재 원본과 황록·목재 조화를 함께 보여준다. root-detail-ui.png는 밑동 비교, mobile-ui.png는 320px 배치다. ui-proof.json은 팔레트 선택/한 그루·세 그루/확대의 실제 렌더와 클릭, 픽셀이 비어 있지 않음, 좁은 화면 넘침 없음, JS 오류 없음의 근거다.

소유 source tiledata/beodeul-ground/tree-palette-studies, 제작기 scripts/content/beodeul-tree-palette-studies.mjs. 원본 RGB→후보 RGB 치환표를 모두 저장했다. 실루엣/알파/좌표는 같고 동일 원본 색은 좌표와 무관하게 동일 색으로 변한다. 새 집/나무 조립이나 땅 그림자 변경으로 결과를 숨기지 않는다. 후보와 원본의 집/길 영역은 픽셀 동일을 확인했다. 비교 시안이므로 게임 맵/정본 프로젝트/원본 공용 아틀라스를 변경하지 않았다. gates/vitest/전체 typecheck는 실행하지 않았다.
