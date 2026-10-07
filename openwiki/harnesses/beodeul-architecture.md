# 버들항 건물 — 원본 보존 보정 하네스

## 2026-10-05 사용자 반려와 새 후보 경로

아래 여섯 구조 중 form-wing/inn/smithy/warehouse는 사용자가 반려했다. 검사 통과와 이전 완료 기록을 인간 승인으로 해석하지 않는다. 이 네 구조는 공용 스탬프에서 제외하고 픽셀은 저장 지도 호환을 위해 남긴다. 사용자가 새 지붕·창문·벽 재질과 10종 후보를 허용했으므로 새 저작/허용·거절 경로는 [beodeul-building-review](beodeul-building-review.md)이다. 새 후보는 직접 선택 전까지 설치하지 않는다.

## 여섯 건축 구조 추가 (2026-10-05)

사용자가 다른 2D 게임의 건물 형태 연구를 모두 반영하라고 요청했다. 기존 `beodeul_architecture` 여섯 집과 city 시트는 유지하며, 같은 하네스의 `forms.py`가 별도 `beodeul_forms` 시트를 만든다. seed.structuralFamilies = long/narrow/wing/inn/smithy/warehouse. 원본 도트를 1:1 조립하고 창문 일부/기초/짧은 그림자만 직접 저작한다. 폭/높이/용마루 방향/별채 처마/현관/작업장/하역 차양을 구분한다.

build는 기존 하네스 빌드 다음에 새 구조를 패킹한다. validate는 source 시트 해시, 여섯 구조 전체 픽셀/시트 재조립/단일 entrance 메타를 검사한다. review는 `qa-runs/harnesses/beodeul-architecture/structural-families-review.png`를 원본의 정확한 3배로 만든다. 실제 도안과 마을 그림을 열어 입구·지붕 조립 접점·벽 콘셉트를 확인해야 한다. 단일 entrance 메타 자체는 눈으로 보이는 중복 문 제거의 근거가 아니다.

source 16px/16열/544칸, `src/assets/beodeulFormsCatalog.json`, `public/assets/beodeul-forms/chipset.png`. `createBeodeulFormsTileset`은 본체6/그림자6/기초6 키트를 만든다. `ensureBeodeulForms`는 새/기존 city에 이식과 번들 참고문서를 추가한다. `scripts/content/lib/beodeul-forms-village.mts` + `author-beodeul-forms.mts`가 새 50×50 지도 16동/다리2/모든 문앞 도로 경로를 만든다. 외장 마을이며 시설 기능/실내/문 전이는 별도다. 자료 원본 `tiledata/beodeul-forms`, 준비 스크립트 `prepare-beodeul-forms-references.mts`, 저장/재로드 근거 `verify-shots/beodeul-forms`.

사용자 정정(2026-10-04): 측면은 필수가 아니며 원래 집을 너무 바꾸지 않는다.
기존 지붕 면·집 윤곽을 유지하고 중복 문과 창문 일부·벽색·기초를 보정한다. 후속 사용자 정정: 기와는 원본으로 복원/고정하고 stone 지붕 아래 박공 벽만 정리한다.
교회는 원본 bd-house-cathedral의 푸른 지붕 면/석벽을 유지하고 기와 픽셀을 유지하며 위층의 중복 문을 원본 창문으로 바꾼다. 이전 투영 면 전체 재저작 시안은 폐기한다.

`npm run harness -- beodeul-architecture build` → `validate` → `review`.
소유 `src/harnesses/beodeul-architecture/node/`; 시드 `harness-data/beodeul-architecture/seed.json`.
Python은 원본 그림을 조립한 뒤 허용된 작은 영역만 편집하며 source 칸 번호를 유지한다. 필요한 칸만 추가한다.

validate는 원본 알파 윤곽, 원본 지붕 픽셀 일치·박공 벽 마스크, 그 밖의 수정 영역 제한, 벽 픽셀 보존율, 한 입구 메타, 시트 배열 일치를 확인한다.
review는 원본/보정본/변경 픽셀 세 그림을 보여 준다. 실제로 열어 중복 문 제거와 지붕 면/실루엣 보존을 확인한다. 기계 통과는 시각 합격이 아니다.
`qa-runs/harnesses/beodeul-architecture/*-review.png`는 실행 산출물이다. inspection.json은 해시에 묶인 기계 근거이며 인간 승인 기록이 아니다.
기초는 sourceKit 대응 공용 ground 레시피를 모든 집에 적용한다. 원본 맵 이벤트와 출입 시험은 유지한다.

## 일광 바닥 보정 (2026-10-04)

같은 build는 기존 ground 빌더로 원래 112칸을 재현한 뒤 node/lightground.py로 304칸까지 그림자·연석·큰 저대비 잔디 레시피를 추가한다. 건물 그림은 바꾸지 않는다. validate/review는 이전 112칸 해시와 일광 source 시트 배열·알파를 함께 검사한다. 실제 normal/error 변조는 source-local(0,1) 그림자 삭제, 예제 맵(0,6), missing-cast-shadow다.
일광 배치는 harmonize_beodeul_daylight, source/배치 계약은 tiledata/beodeul-ground/DAYLIGHT.md, 정본·화면은 verify-shots/beodeul-light-ground.

## 소규모 마을 구도 (2026-10-04)

build는 hamletground.py를 이어 실행해 원래 304칸을 보존하고 총 368칸으로 만든다. 흙/테두리 없는 포석/잔디 덩어리의 4방향 연결 mask, 디딤돌, 작은 텃밭을 공용 source로 만든다. validate/review는 이전 304칸 해시와 새 배열/불투명 1층을 함께 검사한다. 정상/오류는 grass-transition-missing (0,0), mask6 대신15를 실제로 조립한 그림이다. 배치 도구 naturalize_beodeul_hamlet, 계약 HAMLET.md, 정본/플레이어 근거 verify-shots/beodeul-lived-village.


## 나무/풀 깊이·연결 울타리·돌벽 통일 (2026-10-04)

build는 woodland.py까지 실행한다. 기존368칸 픽셀/번호를 유지하며 원본 나무 3종의 지면 접점 y 순서 합성(north/north-open/west/east), 짧은 땅 그림자, 높이 있는 풀 군락, 연속 울타리/모서리를 공용 ground에 추가한다. 수관/풀은 ★, 줄기 접점/울타리는 X. validate는 368칸 해시와 모든 source 배열을 확인한다. woodland-normal-error.png는 동일 나무의 앞뒤 합성 순서를 실제로 뒤집은 오류. stone 박공의 회벽을 정면과 같은 돌 질감으로 통일한다. 0..47행 안에도 박공 벽이 있어 stone만 밝은 회벽 픽셀 마스크를 허용하고 나머지 모든 지붕 픽셀을 대조한다. 알파 윤곽/문/원형창/원본 지붕은 유지, stone 픽셀 보존 하한은 사용자 지적한 벽 통일 범위를 반영해 0.80이다. 출처 WOODLAND.md, 도구 refine_beodeul_courtyard_vegetation, 근거 verify-shots/beodeul-depth-fix.

## 박공 벽 정리와 기와 복원 (2026-10-04 사용자 정정)

사용자가 지적한 것은 stone 지붕 아래 삼각형 벽이었다. 기와를 바꾼 revision 16 시안은 오해였으며 철회했다. 모든 원본 기와를 픽셀 그대로 복원한다. gable.py의 삼각형 벽/원본 계단형 회벽 가장자리 마스크 안에서만 아래층 돌 질감을 연속으로 채우고, 남아 있던 나무 기둥과 사각창/오프센터 원형창 흔적을 함께 제거한다. 중앙 (31,53)에 원형창 하나를 둔다. 작은 벽의 돌 잡티 대비를 줄이고 지붕 바로 아래 접촉 음영을 넣는다. source 336칸/번호/통행/우선순위/모든 맵 배열은 그대로다. validate는 기와 영역 픽셀을 원본과 직접 대조하고 gable mask를 원본에서 재계산한다. revision 15 그림과 비교한 변경 픽셀은 stone의 gable mask 안에만 있다. 오류 gable-post-through-window는 원형창을 관통하는 나무 기둥을 실제로 복구한 그림이다. 공용 학습/새·기존 프로젝트/SQLite 저장·재로드/화면 근거 verify-shots/beodeul-gable-fix.
