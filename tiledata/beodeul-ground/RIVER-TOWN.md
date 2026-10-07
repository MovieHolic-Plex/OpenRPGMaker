# 물굽이 마을 · 건물군/세 갈래 큰길/세 다리

사용자 제공 마을 구도 그림에서 길의 위계와 물길로 나뉜 구역 관계를 적용한 버들항 실제 맵이다. 원본 그림을 게임 소재로 잘라 쓰거나 건물 그림을 재저작하지 않는다.

76×70, 16px. 건물 41개(민가/회관/주막/대장간/교회), 다리 3개. 집을 떨어뜨린 잔디 필지가 아니라 2~4개 건물이 붙은 작은 건물군과 공유 흙마당으로 구성한다. 큰 포석 길은 서문-중앙 우물-동쪽 분기/남쪽 고리, 북쪽 큰길은 회관 곁으로 이어진다. 흙 골목은 좁게 만들며 모든 실제 문앞을 연결한다. 물굽이 서쪽 교회 구역과 주거 구역이 다리로 연결된다. 외곽 합성 숲/완전한 원본 줄기 나무는 길/물/건물의 실제 윗층을 덮지 않는다.

재현 입구: scripts/content/lib/beodeul-river-town.mts의 buildBeodeulRiverTown(project,newMapId). 반드시 새 맵으로 만든다. 기존 맵을 재시공하지 않는다. 기존 기와/stone 박공 정리/문 1개/3/4 탑뷰를 그대로 사용한다. 기존 source 조각은 현재 프로젝트 참고문서 beodeul-city-pieces와 beodeul-ground-dressing에서 MD 전체와 실제 그림을 먼저 읽는다.

시공: 물/큰길 예약 → 완전한 건물 → 길/사유 접근로/연속 마당 → 예약 물을 named material 버들항 강·운하 물로 fill_region → 아치 다리 완전체 → 식생/기물 → 공용 기초/짧은 일광 그림자. 오토타일의 자동 틈 메움 때문에 물 그림은 길 다음에 적용한다. 물을 거쳐 가는 문앞 접근로로 집 배치 오류를 숨기지 않는다.

아치 다리 bd-bridge-arch는 4×5이며 동서 갑판은 원점 y+1/y+2의 두 줄뿐이다. 세 원점: [{"x":24,"y":11},{"x":25,"y":24},{"x":37,"y":56}]. 이 강은 각 다리 자리에서 남북 4칸 폭이다. 굽이를 가로지르는 비스듬한 다리, 다리 없는 물 건너 길은 이 표본에 없다. 갑판/양쪽 둑 실제 canMove와 모든 문앞 착지 칸을 검사한다.

목표를 source 번호로 현재 map에 직접 칠하지 않는다. 아래 층별 target 배열은 이 정확한 예제 전용이며 사용한 모든 graft의 source 텍스처/칸/우선순위/통행을 별도 문서로 제공한다. 공용 조각은 translateTiles로 이식한다. 기와/건물은 3층, 기초/접점 풀은 4층, 낮은 그림자는 2층, 길/물/다리 갑판은 1층이다.

정상/오류: bridge-deck-missing, 첫 다리 target-local (24,12). 실제 맵의 4×2 갑판을 원래 물 칸으로 교체한 오류와 정상 다리를 같은 좌표로 렌더한다. 정상 canMove (23,12)→(24,12)는 true, 오류는 false다.

시작 (42,25). 외장/길 예제이며 새 실내/전이 이벤트는 별도로 만든다. 화면 검수 후 실제 프로젝트 SQLite 저장/재로드가 완료 조건이다.

## 모든 입구

| 건물 | 문앞 x | 문앞 y | 구역 |
|---|---|---|---|
| bd-house-village-cream | 4 | 10 | 서쪽 주거 |
| bd-house-village-sage | 13 | 12 | 서쪽 주거 |
| bd-house-village-brick | 4 | 23 | 서쪽 주거 |
| bd-house-village-stone | 14 | 22 | 서쪽 주거 |
| bd-house-village-ochre | 4 | 34 | 다리 골목 |
| bd-house-village-cream | 11 | 34 | 다리 골목 |
| bd-house-village-sage | 3 | 43 | 교회 골목 |
| bd-house-village-sage | 33 | 11 | 북쪽 주거 |
| bd-house-village-brick | 54 | 11 | 북쪽 주거 |
| bd-house-village-cream | 63 | 10 | 북쪽 주거 |
| bd-house-manor | 38 | 23 | 회관 |
| bd-house-village-stone | 53 | 21 | 동쪽 주거 |
| bd-house-village-ochre | 60 | 21 | 동쪽 주거 |
| bd-house-village-sage | 66 | 23 | 동쪽 주거 |
| bd-house-village-stone | 34 | 36 | 우물 골목 |
| bd-house-cafe | 41 | 37 | 주막 |
| bd-house-village-brick | 49 | 39 | 우물 골목 |
| bd-house-village-ochre | 68 | 35 | 공방 골목 |
| bd-house-smithy_town | 70 | 42 | 공방 |
| bd-house-village-stone | 26 | 41 | 물가 주거 |
| bd-house-village-cream | 32 | 45 | 물가 주거 |
| bd-house-village-church | 9 | 58 | 교회 |
| bd-house-village-brick | 22 | 62 | 남쪽 주거 |
| bd-house-village-stone | 31 | 60 | 남쪽 주거 |
| bd-house-village-sage | 44 | 51 | 동남 주거 |
| bd-house-village-stone | 64 | 49 | 동남 주거 |
| bd-house-village-cream | 70 | 49 | 동남 주거 |
| bd-house-village-ochre | 47 | 61 | 동남 주거 |
| bd-house-village-cream | 55 | 60 | 동남 주거 |
| bd-house-village-brick | 64 | 63 | 동남 주거 |
| bd-house-h101_2 | 10 | 11 | 서쪽 주거 |
| bd-house-h101_2 | 18 | 21 | 서쪽 주거 |
| bd-house-h117_1 | 44 | 11 | 북쪽 주거 |
| bd-house-h123_0 | 69 | 10 | 북쪽 주거 |
| bd-house-h141_0 | 30 | 21 | 회관 골목 |
| bd-house-h127_0 | 37 | 36 | 우물 골목 |
| bd-house-h123_0 | 63 | 34 | 공방 골목 |
| bd-house-h101_2 | 41 | 48 | 동남 주거 |
| bd-house-h141_0 | 51 | 62 | 동남 주거 |
| bd-house-h117_1 | 72 | 63 | 동남 주거 |
| bd-house-h113_1 | 17 | 57 | 교회 골목 |
