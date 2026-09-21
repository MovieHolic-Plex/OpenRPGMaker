# 맵별 타일 크기 (16×16 / 32×32)

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

## 원본 아틀라스와 표시 크기의 구분

`TilesetDef.tileSize`, `tilesPerRow`, `count`가 원본 이미지 슬라이싱을 정한다.
업로드 텍스처 키에는 세 값이 포함된다. 자료 보관함에서 칩셋을 가져올 때 16/32px를
선택하며, 이미지 양 변이 해당 크기의 배수인지 확인한다. 새 업로드/기하 변경 뒤에는
`ensureUploadedTilesetTextures`가 프로젝트 변경 시 한 번 로드·등록하고 다시 그린다.
칸마다 로드를 예약하거나 전역 로드 완료 이벤트를 발행하지 않는다.

번들 기하는 `bundledChipsetTileSize`/`bundledChipsetTilesPerRow`에서 읽는다.
Slates는 32px·56열·1232칸이다. 기존 RPG2K 쿼터 오토타일은 그 포맷에서만 동작하며,
Slates에 기존 물/길 타일 번호나 애니메이션을 적용하지 않는다.

팔레트와 공간 미리보기의 **표시 칸**은 고정 크기여도 된다. 하지만 `drawImage`의 원본
사각형은 반드시 `tileset.tileSize`를 쓴다 (`harnessSuggestion/kitRender.ts` 포함).
기존 `map.tileSize`/`tileset.tileSize` 필드를 사용하므로 문서 버전 변경은 없다.

## 브라우저 근거

`verify-shots/tile-geometry/SUMMARY.md`에 편집기 포인터와 전용 `player.html` 경로의
이동/충돌/32→16→32 전이 실측을 기록했다. `scripts/qa/tile-geometry-capture.mjs`와
`tile-geometry-runtime-capture.mjs`는 최소 기하 픽스처용 캡처 스크립트다. 맵 전이는
실제 action 이벤트로 실행한다 (`__oprnDebug.teleport`는 스프라이트 재배치를 하지 않음).
전체 테스트/전체 타입 검사는 세션 규칙에 따라 실행하지 않았다.

Slates 원본·변경·라이선스는 `public/assets/ATTRIBUTION.md`. 데모는 별도 Supabase
프로젝트 `rpg-zzu-slates32-38e6`에 저장하며, 원격 재로드 영수증은
`verify-shots/slates32/persistence.json`에 둔다. 현재 웹 저장소는 메모리 어댑터이므로
브라우저 저장 버튼을 Supabase 저장 근거로 삼지 않는다.

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
