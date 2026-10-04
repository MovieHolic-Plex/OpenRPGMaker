# 태양과 지형 그림자 (2026-10-04)

## 저작과 저장

높이 막대의 태양 아이콘 → 맵 설정의 「태양과 그림자」. 선택 필드 `GameMap.sunlight`가 없는 옛 맵은 off다.
off/on은 수치를 보존한다. 완전 제거는 AI `set_map_properties.clearSunlight` 또는 `setMapSunlight(mapId,null)`.
`io/shape.ts`가 공통 `normalizeSunlight`로 읽기 값을 정규화한다. 스키마 버전을 올리지 않는다.
방향 `azimuth`는 **태양이 있는 방향**(0 북 / 90 동 / 180 남 / 270 서)이다.
고도 12~85°, 진하기 0~.65, 가장자리 0~4, 집/나무 높이 배율 .25~2.
구름 이동 `angleDeg`(0 동)와 방향 계약이 다르므로 UI/AI 설명에 방위를 함께 표시한다.
`setMapSunlight`는 map lock과 store 계측을 통과한다. AI 부분 패치는 생략한 설정을 유지한다.

## 공통 계산과 그리기

`project/sunlight.ts`가 editor/player/assistant image의 정본이다. 광선은 화면 y가 아닌
**월드 x/y/z(칸)**에서 태양 쪽으로 쏜다. 경사로는 연속 높이, 계단은 디딤판,
절벽은 `samplePixelHeight`의 native marching squares이며 다리 근처 네모 가장자리도 유지한다.
caster가 광선 높이보다 높으면 수신 지점에 그림자가 생긴다.

집은 placement+kit의 입구/집 이름, roof part 폭, 마지막 줄의 받침, 그림 높이로
footprint/eave/ridge를 추정한다. 지붕만 넓힌 조립 집도 roof 폭을 사용한다.
등록된 나무/숲 군집은 실제 남은 upper tile 칸의 원형 수관을 사용한다.
고지의 집/나무는 지면 높이에 구조물 높이를 더한다. 원본 타일의 실제 3D 부피를 복원하는 기능은 아니다.
relief/통행/충돌/visionBlocking/타일 층은 변경하지 않는다.

현재 수신 면은 땅·경사로·절벽이다. 집/나무의 그림은 수신에서 제외한다.
다른 집 지붕의 수신, 수작업 타일 집의 자동 인식, 움직이는 NPC의 긴 그림자,
동적 시간대 태양, 다리 아래 공간의 별도 높이 수신은 포함하지 않는다. 기존 타일의 고정 명암은 유지한다.
이 범위를 태양광 전체 3D 시뮬레이션으로 보고하지 않는다.

`player/sunlightLayer.ts`는 카메라 근처 16칸×1줄 마스크를 캐시한다. 프레임당 6ms 예산으로
작은 패치를 만들고, 입력이 바뀌면 낡은 작업을 버린다. 카메라 이동 시 월드 좌표를 유지한다.
무변화 프레임에는 광선을 다시 쏘지 않는다. native 높이 캐시는 최대 128개 16×16칸 청크,
공통 field 캐시는 2개로 제한한다(undo가 옛 맵을 붙잡아도 증가하지 않음).
높이/caster 없는 평지에는 투명 마스크를 만들지 않는다.
런타임 마스크는 수신 줄 `reliefRowDepth(...,-.275)`로 캐릭터 아래에 놓는다.
editor는 타일 위/편집 오버레이 아래의 별도 container(.5)에 같은 마스크를 올린다.
씬 shutdown/off 맵 이동은 텍스처를 지운다. runtime 타일 제자리 변경은 `invalidateSunlight`를 호출한다.

## 조수와 검수

`inspect_terrain`은 sunlight 설정, caster 수, 최대 24개의 caster 높이를 반환한다.
태양 요청에는 `set_map_properties`, `inspect_terrain`, `show_map_region`을 함께 노출한다.
browser/headless 이미지도 같은 field를 그린다. 영역 밖 caster를 잃지 않도록 원본 맵에서 광선을 계산한다.
근거: `verify-shots/sunlight/SUMMARY.md`, `scripts/qa/sunlight-audit.mts`,
`scripts/capture/capture-sunlight-editor.mjs`, `scripts/capture/capture-sunlight-player.mjs`.
editor 진단 `__oprnEditSunlightStats`; shipping QA 진단 `__oprnSunlight`(계측 부팅만).
전체 gates/Vitest/typecheck는 이 세션의 AGENTS 실행 제한에 따라 실행하지 않았다.
