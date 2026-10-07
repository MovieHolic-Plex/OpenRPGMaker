# 버들항 나무 다섯 픽셀 시안

원본 세 종류를 유지한 현재 비교 1개와 정수 픽셀로 저작한 다섯 후보를 같은 잔디/포석/배치에 비교한다. 한 그루/세 그루, 전체/밑동/수관 확대 선택이 가능하다. 후보는 비교용이며 기존 게임/SQLite/원본 아틀라스는 변경하지 않았다. 프로젝트 3dd2427f-38dc-46e5-925b-a717dbe5bb03, canonical revision18에서 참고문서 MD와 실제 그림을 추출해 읽었다. ai_conversations는 0행이고 브라우저 IndexedDB 기록은 연결된 편집기 세션이 없어 조회하지 못했다.

- contact-sheet.png: current/contact/roots, volume/squat/integrated. 각 칸 160×128, 전체 3배 nearest 픽셀.
- comparison-ui.png: 원본과 종합 보정, 전체 선택.
- root-detail-ui.png: 원본과 굵은 줄기/뿌리, 밑동 확대.
- mobile-ui.png: 320px 배치.
- ui-proof.json: 8개 canvas 실제 픽셀 렌더, 이름/범위/확대 상호작용, 320px 넘침 없음, 브라우저 JS 오류 없음.

명암 후보는 반짝임을 줄이며 단색 줄기를 방지하려 원본 나무껍질 픽셀을 새 줄기 마스크에 재사용한다. 그림자와 접촉/전경 풀은 별도 투명 픽셀이다. 숲은 실제 지면 접점의 y 순서로 겹친다. source와 전체 palette-index 픽셀은 tiledata/beodeul-ground/tree-studies, 제작기는 scripts/content/beodeul-tree-studies.mjs다. 어느 후보가 자연스러운지는 사람 선택이 필요하며 기계 검사는 시각 합격을 대신하지 않는다.

gates/vitest/전체 typecheck는 실행하지 않았다. 비교 화면의 실제 브라우저 렌더와 조작만 확인했다. 게임 설치 단계에서 선택한 후보를 공용 타일 번들/슬롯/레이어/통행과 정본 저장에 연결한다.

후속 비교: 다섯 후보와 원본 모두 같은 돌벽집 bd-house-village-stone(원본 64×96px)을 옆에 두었다. 집과 한 그루 나무의 바닥선 y=100, 원본 16px 축척, 동일한 기초/좌상단 광원/포석 접근로다. 그림 비교 후보만 갱신하며 원본 집/마을/SQLite는 변경하지 않았다. 밑동 확대에서도 집의 기초와 나무 뿌리가 함께 보인다.
