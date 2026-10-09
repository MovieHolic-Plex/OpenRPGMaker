# 태양과 지형 그림자 (2026-10-04)

## 저작과 저장

높이 막대의 태양 아이콘 → 맵 설정의 「태양과 그림자」. 선택 필드 `GameMap.sunlight`가 없는 옛 맵은 off다.
off/on은 수치를 보존한다. 완전 제거는 AI `set_map_properties.clearSunlight` 또는 `setMapSunlight(mapId,null)`.
`io/shape.ts`가 공통 `normalizeSunlight`로 읽기 값을 정규화한다. 스키마 버전을 올리지 않는다.
방향 `azimuth`는 **태양이 있는 방향**(0 북 / 90 동 / 180 남 / 270 서)이다.
고도 12~85°, 진하기 0~.65, 가장자리 0~4, 집/나무 높이 배율 .25~2.
고도를 생략한 새 설정의 기본값은 65°다(기존 40°는 보통 집에도 긴 그림자를 만들었다). 기본 enabled는 계속 false이고, 저자가 명시한 24°/35° 같은 고도는 그대로 보존한다. 낮은 태양은 긴 그림자가 필요할 때 선택한다. 박공/고도 비교의 실제 editor/player 근거는 `verify-shots/gabled-roof/SUMMARY.md`.
구름 이동 `angleDeg`(0 동)와 방향 계약이 다르므로 UI/AI 설명에 방위를 함께 표시한다.
`setMapSunlight`는 map lock과 store 계측을 통과한다. AI 부분 패치는 생략한 설정을 유지한다.

## 공통 계산과 그리기

`project/sunlight.ts`가 editor/player/assistant image의 정본이다. 광선은 화면 y가 아닌
**월드 x/y/z(칸)**에서 태양 쪽으로 쏜다. 경사로는 연속 높이, 계단은 디딤판,
절벽은 `samplePixelHeight`의 native marching squares이며 다리 근처 네모 가장자리도 유지한다.
caster가 광선 높이보다 높으면 수신 지점에 그림자가 생긴다.

집은 placement+kit의 입구/집 이름으로 인식하고 `sunlightArt.ts`가 **현재 남은 upper tile의
실제 알파 실루엣**을 칸당 4×4 표본으로 읽는다. 열별 윗선/아랫선을 높이 구간으로 만들므로
탑·박공·굴뚝의 높이가 다르며, 지붕만 넓힌 처마 아래를 벽으로 채우지 않는다.
떨어진 소품과 본채 아래 얇은 픽셀로 닿은 소품은 별도 받침/깊이를 사용한다(버들항 저택의 석상 두 개).
덧칠되거나 지워진 kit 칸은 caster에서 제외한다. 스탬프 바깥 네모를 통째로 비우던 처리는 제거했다.
그림의 보호 영역도 실제 알파 표본과 해당 칸의 화면 들림이다. 빈 처마 옆 잔디를 보호 영역으로 삼지 않는다.
browser/player는 `sunlightArtCanvas.ts`의 타일별 작은 캔버스 캐시, headless는 같은 `rasterSunlightArt`를 쓴다.
atlas 전체/맵 전체 픽셀 복사는 하지 않는다. 이미지 없는 scalar inspection은 남은 upper 칸 점유로 근사하며,
field 캐시 키에 art source를 넣어 실제 이미지가 준비된 뒤의 결과를 근사 field로 대체하지 않는다.
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
마스크는 nearest 필터를 쓴다. Canvas `batchSprite`는 rounded camera에서 원본 크기를 .5px
늘리므로 저해상도 마스크의 땅 부분이 2px 밀려 줄 사이가 비었다. 마스크의 Canvas 그리기 동안만
roundPixels를 끄고 finally에서 복구한다. 다른 타일/캐릭터의 카메라 설정은 유지한다.
씬 shutdown/off 맵 이동은 텍스처를 지운다. runtime 타일 제자리 변경은 `invalidateSunlight`를 호출한다.

### 높이 붓과 도로의 수신 면 (2026-10-04)

높이 지형의 수신 면은 `renderRelief`의 native `src/kind/mpy/height`에서 읽는다.
화면 16×16칸 창과 둘레 여백만 굽고 4×4 표본의 주인 줄·월드 y/z를 보관한다(최대 128창).
가려진 바닥과 앞쪽 고지·절벽을 같은 화면 좌표에 함께 그리지 않는다. 경사로 둘레의
네모 가장자리도 광선 높이와 native 렌더에 공통 적용한다. 평지 도로 타일은 caster가 아니다.
높이 붓·조수·제자리 relief 편집은 레이어의 입력 키에 `reliefReadSignature`를 넣어 갱신한다.
기본 off에서는 높이 서명·수신 창을 계산하지 않는다. 진단에 `maxTerrain`을 함께 표시한다.
근거: `verify-shots/terrain-shadows/SUMMARY.md`. 두 재현 맵에서 이전 그림자의 보이지 않는
수신 표본 115개/10개를 확인했고 수정 후 0개다. 이 수치는 전체 맵의 미술 품질 점수가 아니다.

## 조수와 검수

`inspect_terrain`은 sunlight 설정, caster 수, 최대 24개의 caster 높이를 반환한다.
태양 요청에는 `set_map_properties`, `inspect_terrain`, `show_map_region`을 함께 노출한다.
browser/headless 이미지도 같은 field를 그린다. 영역 밖 caster를 잃지 않도록 원본 맵에서 광선을 계산한다.
근거: `verify-shots/sunlight/SUMMARY.md`, `scripts/qa/sunlight-audit.mts`,
`scripts/capture/capture-sunlight-editor.mjs`, `scripts/capture/capture-sunlight-player.mjs`.
건물 모양 수정 근거: `verify-shots/building-shadow-shapes/SUMMARY.md`, `scripts/qa/building-shadow-audit.mts`.
capture 스크립트는 `OPRN_SUNLIGHT_QA_OUT`으로 출력 폴더를 나눌 수 있다.
editor 진단 `__oprnEditSunlightStats`; shipping QA 진단 `__oprnSunlight`(계측 부팅만).
전체 gates/Vitest/typecheck는 이 세션의 AGENTS 실행 제한에 따라 실행하지 않았다.
