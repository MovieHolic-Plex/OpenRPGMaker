> 2026-10-05 사용자 검수: form-wing(ㄱ자집), form-inn(여관), form-smithy(대장간), form-warehouse(창고)는 반려됐다. 아래 조립/마을은 과거 기록이며 이 네 키트를 새로 배치하지 않는다. 새 후보는 beodeul-building-review에서 사람이 선택한다.

# 버들항 건축 구조 여섯 계열

사용자 요청: 다른 2D 게임처럼 집의 폭·높이·용마루 방향·별채·현관을 구분한다. 기존 버들항 시트의 지붕/윤곽을 덮어 바꾸지 않고 별도 source beodeul_forms에서 원본 도트를 1:1 조립했다. 새 고정 건물 6종: long, narrow, wing, inn, smithy, warehouse. 공용 beodeul_city는 bd-house-form-* 본체와 bd-form-shadow/foundation-*를 함께 갖는다. source tex_beodeul_forms, 16px/16열/544칸. source n의 원점 (n%16*16,floor(n/16)*16). 원본 게임 스크린샷은 참고만 했으며 픽셀 소재로 포함하지 않았다.

## 조립 순서와 층

1. 이 용도의 모든 MD와 실제 이미지를 읽는다. 현재 프로젝트의 공용 키트 배열을 사용하며 아래 source 번호를 city 번호로 추측하지 않는다. 코드 이식은 translateTiles(createBeodeulFormsTileset(),target,전체 배열)로 한다.
2. 본체 width×height와 남쪽 접근칸을 평지에 예약한다. 최소 크기는 고정 키트 크기. 지붕을 잘라 크기를 줄이거나 좌우 마감 칸을 반복하지 않는다. long/warehouse는 넓고 낮고, narrow는 좁고 높으며, wing의 뒤채와 앞채 처마 높이는 다르다. 같은 실루엣 3개를 나란히 놓지 않는다.
3. 바닥 1층에는 밝은 잔디737와 연결 mask 흙/포석을 놓는다. 각 건물과 같은 원점에 bd-form-shadow-<concept>를 2층, 본체 bd-house-form-<concept>를 3층, bd-form-foundation-<concept>를 4층으로 놓는다. 그림자/기초는 통행 true이며 본체 X를 덮어 열지 않도록 ★다. 투명 배경과 통행/우선순위는 별개의 정보다.
4. parts.entrance는 그림이 들어 있는 한 출입구 영역이다. 문 앞은 (dx,dy+h). warehouse는 넓은 문 한 개(w=2), 다른 집은 w=1. inn은 현관 기둥을 피해 x=7의 남쪽 접근로를 잇는다. 지붕 ★와 벽/문 X는 아래의 실제 passability를 따른다. 소품은 입구를 막지 않는다.
5. 땅/물 예약 → 건물 → 흙 골목과 포석 큰길·공동마당 연결 → named water와 완전한 다리 → 황록 나무/작업 소품 → 실제 벽 하단 기초와 짧은 오른쪽 아래 그림자. ㄱ자 기초는 뒤채와 앞채 각각을 따른다. 강 4칸은 두 아치 다리의 실제 4×2 갑판으로만 건넌다.
6. 시작에서 모든 문 앞까지 도로 칸만으로 canMove 경로를 계산한다. 그림 검수 → SQLite 저장 API → 별도 프로세스로 같은 대상 재로드 → 출하 player.html에서 걷는다. 이 용도는 외장 마을이며 판매/실내/문 전이 이벤트를 자동 구현하지 않는다.

## 정확한 예제

scripts/content/lib/beodeul-forms-village.mts buildBeodeulFormsVillage(project,newMapId)와 author-beodeul-forms.mts. 50×50, 16동, 구조 6계열+작은 기존 집/찻집/성당, 다리 두 개. 기존 맵은 보존한다. 모든 레이어 정답과 graft 출처/통행은 뒤 문서. 시작 (32,16). 각 건물 전체 source 배열/문 앞/그림자·기초는 아래 사전. 모든 구조는 fixed이며 독립 반복 부품으로 잘라 쓰지 않는다.

## 정상/오류

blocked-form-entrance: 여관 문앞 (35,13)에 실제 anvil 칸을 3층에 넣는다. 정상 canMove(35,14→35,13)=true, 변조=false. 동일 좌표를 실제 mapTileDraw로 렌더한다. 구조 검사는 원본 픽셀 보존·시트 재조립·입구·범위·통행을 확인하며 미적 품질을 대신 판정하지 않는다.

## 시각 참고

CrossCode 개발사 https://www.radicalfishgames.com/?p=3598 (동일 재료 안에서 용마루 방향/돌출부 변화).
Stardew Valley https://stardewvalleywiki.com/Blacksmith · https://stardewvalleywiki.com/Museum · https://stardewvalleywiki.com/The_Stardrop_Saloon (폭/높이/포치 차이).
Sea of Stars Brisk https://www.neoseeker.com/sea-of-stars/walkthrough/Port_Town_of_Brisk (낮은 부속 지붕과 높이가 다른 건물 덩어리).
관찰에 근거한 구성 원리이며 이 게임들의 에셋이나 정확한 시점을 복제한 것은 아니다. 버들항의 3/4 탑뷰·기와 도트와 선택된 황록 팔레트를 따른다.

