# 버들항 공용 일광·접지 보정

원본 버들항 집·지붕·윤곽·나무 도트와 밝은 잔디를 유지한다. 빛은 왼쪽 위, 그늘은 짧게 오른쪽 아래. 측면 벽을 새로 그리지 않는다.
`harmonize_beodeul_daylight({mapId})`는 기존 마을에 적용한다. author_beodeul_town의 houseCount 모드에서는 마지막에 자동 적용한다. 맵을 새로 만들거나 소품을 움직이지 않는다.

## 실행 순서

현재 맵/이벤트 → 이 용도의 모든 MD/이미지 읽기 → 집·나무/길 연결/기초/꾸밈 → 일광 보정 → 실제 화면·문 앞 이동 → SQLite 저장·재로드.
자동 타일 번호를 추측하지 않는다. source beodeul_ground(16px/8열/304칸)를 translateTiles로 현재 city에 이식한다. source 번호와 map 번호는 다르다.

## 정확한 층·배치

- 그림자 layer 2: bdg-light-house-{cream,brick,stone,sage,ochre,church}, bdg-light-tree-{03a8f7,3e8732,1a786c}. 원본 또는 보정 키트의 전체 배열을 대조한 원점에 recipe.dx/dy를 더한다. 배열·anchor·dx/dy는 같은 용도의 전체 source 사전 CATALOG.md에 있다. ㄱ자 집은 뒤채와 앞채의 서로 다른 벽 하단을 따른다.
- 투사 그림자는 최대 51/255 알파, 접촉 그림자는 94/255(겹침 최대 124/255). 소실과 높이가 낮은 정적인 짧은 그림자이며 실시간 광원/3D 높이 시뮬레이션이 아니다. 모든 신규 그림자 칸은 lower 우선순위와 네 방향 통행 true다.
- 원래 layer 2의 흙·낙엽·그림자는 덮지 않고, 높이가 있는 칸은 건너뛴다. 지붕/벽/수관은 layer 3이므로 바닥 그림자 위에 그대로 그려진다. 기초와 작은 소품 layer 4도 보존한다.
- 연석 layer 1: 원본 길 오토타일 16종 각각의 두 가지 보정. recipe.baseTile/variant와 rows[0][0]은 CATALOG에 있다. 녹색 잔디 픽셀과 가장자리 연결 형태를 유지하고 밝은 연석의 대비를 낮춘다. 통행/우선순위는 원본과 같으며 새 road graft를 원래 길 그룹 connectTileIds에 연결한다. 길 오토타일 memberTileIds는 바꾸지 않는다.
- 잔디 변화 layer 2: bdg-light-meadow-0/1/2, 4×3칸. 원본 풀 737 위, 집/나무 곁에 낮은 대비의 큰 변화를 넣는다. 기존 layer 2와 높이가 있는 곳은 건너뛴다. 추가 물리 소품이나 꽃은 배치하지 않는다.

공용 source 0..111의 이전 그림은 불변이며 일광 레시피만 뒤에 추가한다. 반복 적용은 완성된 보정을 중복하지 않는다. 수동으로 일광 칸 일부를 지운 맵을 자동 복원하는 기능은 없다.

## 검수

harness는 이전 112칸 해시, 시트/각 레시피 전체 배열 일치, 그림자 알파 상한을 확인한다. lighting-preview.png는 실제 원본 집/나무+공용 그림자를 같은 층 순서로 합성한 그림이다.
실제 마을은 집·나무·기초/소품 배열과 이벤트가 그대로인지, 모든 칸의 네 방향 통행이 같고 모든 문 앞까지 갈 수 있는지 저장·재로드와 플레이어에서 확인한다. 실제 보정 전후와 그림자만 적용한 비교는 verify-shots/beodeul-light-ground에 남긴다.

정상/오류 그림 lighting-normal-error.png는 왼쪽 정상, 오른쪽 source 그림자 칸(0,1)을 지운 실제 변조다. 예제 집 원점(0,0), 그림자 원점(0,5)이므로 맵(0,6)의 그늘이 끊긴다. 검출 코드 missing-cast-shadow, mutation과 좌표는 lighting-errors.json에 저장한다.
