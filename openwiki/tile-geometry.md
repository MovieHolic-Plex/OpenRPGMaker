> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# 맵별 타일 크기 (16×16 / 32×32 / 48×48)

## 좌표 계약

`src/project/tileGeometry.ts`의 `mapTileSize(map, tileset?)`가 월드 좌표의 단위다.
전역 `TILE_SIZE`는 기존 16px 번들 포맷의 기본값으로 남는다. 활성 맵 크기를 전역 변수로
바꾸지 않는다: 편집기와 플레이 씬, 서로 다른 맵의 미리보기가 동시에 존재할 수 있다.

- 맵 생성과 타일셋 교체는 `tileset.tileSize`를 `map.tileSize`에 복사한다.
- `set_tileset_properties`에서 크기를 변경하거나 그래픽 피커에서 다른 소스를 선택하면
  그 타일셋을 쓰는 맵도 같은 크기로 갱신한다. 격자 인덱스와 타일 배열은 유지한다.
- 편집기의 페인트 좌표, 선택/붙여넣기, 이벤트/통행 표시, 카메라, 스크롤바, AI 영역
  오버레이는 현재 맵의 크기를 쓴다.
- 런타임의 타일/캐릭터/NPC/동료 좌표, 이동 보간, 전이, 카메라, 컬링, 조명, 전투
  셀 표시와 사거리, 농지/설치물은 씬의 맵 크기를 쓴다.
- 캐릭터 발밑은 `(x + 0.5) * size, (y + 1) * size`. 다중 칸 몸체는
  `footprintSpriteX(x, footprint, size)`로 중앙을 구한다. 충돌 판정은 여전히 칸 좌표다.
- 캐릭터 원본 픽셀 크기와 저작된 배율, px 단위 점프 연출은 별개다. 32px 맵이라고
  모든 캐릭터와 이펙트를 무조건 두 배 확대하지 않는다.

## 캐릭터 자동 배율 (2026-09-21)

`src/project/characterScale.ts`가 보행 캐릭터의 자동 기준을 소유한다:
`max(1, floor(맵 타일 크기 / 원본 프레임 폭))` (최대 8). 원본을 축소하거나 다시 저장하지
않고 정수 배율로 표시한다. 기본 24×32 프레임은 16/32px 맵에서 1배, 48px 맵에서
2배(48×64)다. 원본 폭 16은 48px 맵에서 3배, 원본 폭 48은 1배다.

- 플레이어 생성·맵 전이·그래픽 변경은 `syncPlayerCharacterScale`로 갱신한다. 같은 배율을
  매 프레임 재설정하지 않아 점프/스윙 트윈을 보존한다. 스윙도 자동 기준 배율로 복원한다.
- NPC·동료·이동 경로의 그림 교체는 `eventSpriteScale`을 공유한다. 일반 소품과 자동
  맞춤된 몬스터 배틀러 그림은 기존 배율을 유지한다.
- 이벤트의 `graphic.scaleMode`는 선택 필드 `auto | manual`이다. 생략하고 `scale`도 없으면
  자동, 기존 명시 `scale`이 있으면 절대 수동 값으로 보존한다(1배 포함).
  명시 `auto`에서 `scale`은 몸 크기 배수이며 자동 기준에 곱한다. 최종 상한은 8이다.
- 이벤트 편집기의 「배율 직접 지정」을 끄면 자동, 켜면 절대 배율이다. 입력에는 실제
  표시 배율을 보여주고, 저장/재로드 후에도 수동 1배와 자동 2배를 구분한다.
  맵의 캐릭터 마커와 몸 미리보기는 현재 맵 크기 및 같은 발밑·배율을 사용한다.
  충돌 몸 크기는 그림 배율과 별개로 유지한다.

재현: `node scripts/qa/character-auto-scale.mjs` (전용 player.html),
`TILE_EDITOR_URL=http://127.0.0.1:<port> node scripts/qa/character-auto-scale-editor.mjs`.
근거는 `verify-shots/character-auto-scale/SUMMARY.md` 및 `editor-checks.json`.
최소 엔진 계약 fixture만 사용하며 게임 콘텐츠를 저작하지 않는다.

## 원본 아틀라스와 표시 크기의 구분

`TilesetDef.tileSize`, `tilesPerRow`, `count`가 원본 이미지 슬라이싱을 정한다.
업로드 텍스처 키에는 세 값이 포함된다. 자료 보관함에서 칩셋을 가져올 때 16/32/48px를
선택하며, 이미지 양 변이 해당 크기의 배수인지 확인한다. 새 업로드/기하 변경 뒤에는
`ensureUploadedTilesetTextures`가 프로젝트 변경 시 한 번 로드·등록하고 다시 그린다.
칸마다 로드를 예약하거나 전역 로드 완료 이벤트를 발행하지 않는다.

번들 기하는 `src/assets/bundledChipsetGeometry.ts`의 `bundledChipsetTileSize`/`bundledChipsetTilesPerRow`에서 읽는다.
Castle/참고 이미지의 기하와 Slates 기하를 같은 경로로 유지한다. 액션 스킬의 지면 표시도 맵 크기로 좌표를 계산한다.
Slates는 32px·56열·1232칸이다. 기존 RPG2K 쿼터 오토타일은 그 포맷에서만 동작하며,
Slates에 기존 물/길 타일 번호나 애니메이션을 적용하지 않는다.

팔레트와 공간 미리보기의 **표시 칸**은 고정 크기여도 된다. 하지만 `drawImage`의 원본
사각형은 반드시 `tileset.tileSize`를 쓴다 (`harnessSuggestion/kitRender.ts` 포함).
기존 `map.tileSize`/`tileset.tileSize` 필드를 사용하므로 문서 버전 변경은 없다.

## 48px 일반 칩셋 가져오기 (2026-09-21)

`resourceManager.ts`의 크기 선택은 16·32·48 중 이미지 **양 변이 나누어떨어지는**
크기만 제공한다. 이미지 폭으로 크기를 자동 추정하지 않는다. 선택한 값은 업로드 메타데이터,
리소스 프로필, 타일셋에 기록되고, 「현재 맵에 적용」은 맵의 `tileSize`도 갱신한다.
48px는 일반 격자 아틀라스 지원이며 RPG Maker MV/MZ의 A1–E 오토타일 포맷 해석을 뜻하지 않는다.

첫 리소스 가져오기에서 크기 선택 창이 DB의 lazy CSS에 의존하면 리소스 창 뒤에 깔려
클릭할 수 없다. `src/styles/resources/chipset-import.css`가 해당 창만 대상으로 고정 배치,
겹침 순서, 크기와 버튼 스타일을 소유한다. DB를 먼저 열거나 강제 클릭하는 QA로 우회하지 않는다.

재현: 보정된 워크트리에서 독립 `VITE_CACHE_DIR`로 `npm run dev:worktree`를 실행한 뒤
`TILE_EDITOR_URL=http://127.0.0.1:<port> node scripts/qa/tile-size-support.mjs`.
실제 PNG 가져오기·맵 적용·원본 프레임·포인터 칠하기·undo/redo·직렬화 왕복과
전용 `player.html`의 이동·충돌·32→48→16→32 이벤트 전이를 assertion으로 검사한다.
최신 결과와 한계는 `verify-shots/tile-size-support/SUMMARY.md`, 원시 관측은 `checks.json`.
이 하네스는 엔진 계약용 최소 fixture이며 게임 콘텐츠 저작이나 원격 저장 증거가 아니다.

## 브라우저 근거

`verify-shots/tile-geometry/SUMMARY.md`에 편집기 포인터와 전용 `player.html` 경로의
이동/충돌/32→16→32 전이 실측을 기록했다. `scripts/qa/tile-geometry-capture.mjs`와
`tile-geometry-runtime-capture.mjs`는 최소 기하 픽스처용 캡처 스크립트다. 맵 전이는
실제 action 이벤트로 실행한다 (`__oprnDebug.teleport`는 스프라이트 재배치를 하지 않음).
전체 테스트/전체 타입 검사는 세션 규칙에 따라 실행하지 않았다.

Slates 원본·변경·라이선스는 `public/assets/ATTRIBUTION.md`. 데모는 별도 LegacyDb
프로젝트 `rpg-zzu-slates32-38e6`에 저장하며, 원격 재로드 영수증은
`verify-shots/slates32/persistence.json`에 둔다. 현재 웹 저장소는 메모리 어댑터이므로
브라우저 저장 버튼을 LegacyDb 저장 근거로 삼지 않는다.

## Slates 참고 맵 3종

`rpg-zzu-slates32-38e6`에는 기존 `slates_grove`와 별도로 `slates_harbor`,
`slates_town`, `slates_castle`을 저장했다. 각 맵은 17×15칸, 32px이며 원본 작가의
항구/도시/성 예시 배치를 참고했다. `slates_reference_32`는 원본 v2 1232칸과
v1/v2 조각을 합친 조합 타일을 가진 업로드 칩셋이다. 반 칸 장식은 16px 원본 조각을
32px 칸 안에 합성하며, 맵 자체의 격자·이동·충돌은 32px이다. 참조 PNG를 배경이나
타일로 잘라 넣지 않는다. 하위 바닥과 상위 장식은 별도 타일 배열로 저장한다.

- 원본 사각형/합성 순서: `public/assets/slates/slates-reference-recipes.json`.
- 조합 타일별 출처: `slates-reference-tile-provenance.json`.
- 재생성: `node scripts/content/build-slates-reference.mjs <source-project.json>`.
  이 명령은 로컬 프로젝트 JSON과 조합 아틀라스만 만든다.
- 원격 저장: `scripts/content/save-slates-reference.mjs`가 읽기 시점의 root SHA를
  조건으로 PATCH하고 맵/타일셋 미러를 저장한 뒤 전체 문서와 미러를 재로드 비교한다.
  `output/slates-reference/source-row.json`은 자격 증명 없는 작업 시작 스냅샷이다.
  다른 세션이 수정한 SHA이면 덮어쓰지 않고 중단한다.
- 근거: `verify-shots/slates-reference/SUMMARY.md`, `persistence.json`.
  로컬 데스크톱 프로젝트 사본은 `output/slates32-project`에 import한다.
- 세 맵은 독립적인 장면이다. NPC, 퀘스트, 맵 간 전이는 저작하지 않았다.

원본 의미·연결 규칙과 학습 범위는 [slates-study.md](slates-study.md)에 기록했다.
사람용 이미지 도감은 `reports/slates-study/index.html`, 추가 연구실은 `slates_study`다.
