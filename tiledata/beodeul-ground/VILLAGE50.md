# 황록 마을 50×50 · 공유 마당/두 다리/황록 숲

사용자 제공 마을 구도 그림에서 길의 위계와 물길로 나뉜 구역 관계를 적용한 버들항 실제 맵이다. 원본 그림을 게임 소재로 잘라 쓰거나 건물 그림을 재저작하지 않는다.

50×50, 16px. 건물 18개(민가/회관/주막/대장간/교회), 다리 2개. 집을 떨어뜨린 잔디 필지가 아니라 2~4개 건물이 붙은 작은 건물군과 공유 흙마당으로 구성한다. 포석 큰길은 서쪽 입구-우물-동쪽 골목, 남쪽 길은 교회 앞에서 굽어 둘째 다리로 이어진다. 북쪽 길은 회관 곁으로 들어온다. 흙 골목은 좁게 만들며 모든 실제 문앞을 연결한다. 서쪽 교회/주거와 동쪽 회관/장터/공방이 두 다리로 연결된다. warm 색만 적용한 공용 나무/합성 숲은 건물을 덮지 않는다. 수관은 길 위로 드리울 수 있지만 blockingCells 밑동과 문 앞 여유는 길을 막지 않는다.

재현 입구: scripts/content/lib/beodeul-village50.mts의 buildBeodeulVillage50(project,newMapId). 반드시 새 맵으로 만든다. 기존 맵을 재시공하지 않는다. 기존 기와/stone 박공 정리/문 1개/3/4 탑뷰를 그대로 사용한다. 기존 source 조각은 현재 프로젝트 참고문서 beodeul-city-pieces와 beodeul-ground-dressing의 warm 색 기준에서 MD 전체와 실제 그림을 먼저 읽는다.

시공: 물/큰길 예약 → 완전한 건물 → 길/사유 접근로/연속 마당 → 예약 물을 named material 버들항 강·운하 물로 fill_region → 아치 다리 완전체 → 식생/기물 → 공용 기초/짧은 일광 그림자. 오토타일의 자동 틈 메움 때문에 물 그림은 길 다음에 적용한다. 물을 거쳐 가는 문앞 접근로로 집 배치 오류를 숨기지 않는다.

아치 다리 bd-bridge-arch는 4×5이며 동서 갑판은 원점 y+1/y+2의 두 줄뿐이다. 두 원점: [{"x":23,"y":15},{"x":23,"y":36}]. 강은 남북으로 흐르는 4칸 폭이다. 굽이를 가로지르는 비스듬한 다리, 다리 없는 물 건너 길은 이 표본에 없다. 갑판/양쪽 둑 실제 canMove와 모든 문앞 착지 칸을 검사한다.

목표를 source 번호로 현재 map에 직접 칠하지 않는다. 아래 층별 target 배열은 이 정확한 예제 전용이며 사용한 모든 graft의 source 텍스처/칸/우선순위/통행을 별도 문서로 제공한다. 공용 조각은 translateTiles로 이식한다. 기와/건물은 3층, 기초/접점 풀은 4층, 낮은 그림자는 2층, 길/물/다리 갑판은 1층이다.

정상/오류: bridge-deck-missing, 첫 다리 target-local (23,16). 실제 맵의 4×2 갑판을 원래 물 칸으로 교체한 오류와 정상 다리를 같은 좌표로 렌더한다. 정상 canMove (22,16)→(23,16)는 true, 오류는 false다.

시작 (32,16). 외장/길 예제이며 새 실내/전이 이벤트는 별도로 만든다. 화면 검수 후 실제 프로젝트 SQLite 저장/재로드가 완료 조건이다.

## 모든 입구

| 건물 | 문앞 x | 문앞 y | 구역 |
|---|---|---|---|
| bd-house-village-cream | 5 | 12 | 서쪽 주거 |
| bd-house-village-ochre | 16 | 12 | 서쪽 주거 |
| bd-house-h141_0 | 20 | 12 | 서쪽 주거 |
| bd-house-village-brick | 4 | 26 | 서쪽 주거 |
| bd-house-village-stone | 14 | 26 | 서쪽 주거 |
| bd-house-village-ochre | 20 | 26 | 서쪽 주거 |
| bd-house-village-church | 9 | 44 | 교회 골목 |
| bd-house-village-sage | 15 | 38 | 교회 골목 |
| bd-house-village-cream | 17 | 47 | 교회 골목 |
| bd-house-manor | 33 | 15 | 회관 |
| bd-house-village-stone | 44 | 13 | 북쪽 주거 |
| bd-house-cafe | 30 | 26 | 장터 |
| bd-house-village-brick | 41 | 27 | 장터 |
| bd-house-village-ochre | 31 | 35 | 공방 골목 |
| bd-house-village-stone | 38 | 36 | 공방 골목 |
| bd-house-smithy_town | 45 | 36 | 공방 |
| bd-house-village-sage | 29 | 47 | 남쪽 주거 |
| bd-house-village-cream | 41 | 46 | 남쪽 주거 |


# 포석길 연속성 · 재료 접점 정정

건물과 겹친 포석길을 지운 뒤 임의의 흙길 우회가 있다는 이유로 포석길을 합격 처리하지 않는다. repairBeodeulVillage50Roads는 교회 문앞 (9,44)에서 남쪽 다리 서쪽 둑 (22,37)까지 건물 전체 영역을 피하고 실제 canMove가 허용하는 짧은 자유 지면 경로를 찾고 그 경로를 포석으로 잇는다. y>=37 안에서 포석만 사용하는 연결을 별도로 확인하므로 북쪽 길로 우회해 결손을 숨길 수 없다. 건물·나무·그림자·소품·이벤트는 그대로 두고 1층 길만 바꾼다.

흙길/포석/다리 갑판은 road union으로 N/E/S/W mask를 계산한다. 서로 다른 길 재료가 만나는 내부 접점에는 잔디 경계를 넣지 않는다. 원본 bdg-hamlet-soil/stone-0..15를 사용하며 새 그림을 만들지 않는다. 전체 source와 target 칸/좌표·우선순위·통행은 동일 용도 사전과 graft 문서에 있다.

```json
{"changed":161,"promoted":[{"x":22,"y":37},{"x":21,"y":38},{"x":20,"y":38},{"x":19,"y":38},{"x":18,"y":38},{"x":17,"y":38},{"x":16,"y":38},{"x":15,"y":38},{"x":14,"y":38},{"x":14,"y":39},{"x":14,"y":40},{"x":14,"y":41},{"x":14,"y":42}],"churchToSouthBridgePaved":true,"mixedRoadEdgesJoined":true}
```