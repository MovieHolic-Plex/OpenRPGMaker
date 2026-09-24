# Pixel Art World 문 가져오기와 일반 이벤트 스프라이트

사용자 다운로드형 문 계약은 [DOORS.md](../tiledata/pixel-art-world/DOORS.md),
메타데이터 정본은 `tiledata/pixel-art-world/doors.json`이다. 9원본/34변형만 검토했다.

- `pixelArtWorldDoorCatalog.ts`: 외부 다운로드 모달의 문 카드·참고자료 소유 타일셋 선택.
- `pixelArtWorldDoorImport.ts`: SHA/치수 확인 → 프레임 자료 생성 → 저장 adapter → snapshot/store.update.
  순수 `preparePixelArtWorldDoor`는 DB 쓰기 없이 `{asset,sprite,references}`를 반환한다.
- `pixelArtWorldDoorReferences.ts`: 사용자 원본/열림 순서/오류 비교 PNG와 전체 crop·프레임·명령 배열.
  소유권은 표준 타일셋 `referenceDocuments`이며 기존 AI 읽기 도구로 검색 가능하다.
- `uploadedSpriteGeometry.ts`: kind=sprite 자산의 정수 양수 width/height/frameWidth/frameHeight/frames,
  행 정렬과 범위를 검사한다. row-major 프레임 번호를 계산한다. charset 규칙으로 해석하지 않는다.
- `uploadedEventSprites.ts`: 명시된 그림과 숫자 프레임 등록. `bundled.ts`의 preload/register,
  `EditScene`의 자산 변경 이후 로딩에 연결된다. 픽셀 번들 추가는 없다.
- `toolImageEventSprites.ts`: 같은 geometry의 프레임을 읽고 원본 PNG alpha를 유지한다.
  일반 sprite에 charset 색키를 제거하거나 RM2K 24×32 crop을 적용하지 않는다.

`SpriteDef`만 선언하고 이미지 로더를 배선하지 않으면 이벤트가 렌더되지 않는다. 반대로 공용
라이브러리에는 SpriteDef가 없어도 자산의 명시된 sprite meta로 등록된다. 문 importer는
asset ID와 SpriteDef ID를 동일하게 사용한다. 임의 크기 sprite를 charset 피커에 섞지 않는다.
현재 걷기 피커는 그대로이며 문 프레임 선택은 참고문서의 ID/페이지 JSON/AI 저작 경로다.

`setEventGraphicPattern`은 렌더 프레임만 바꾼다. 충돌/스위치/transfer/열림 페이지의 통행은
별도 이벤트 저작이다. 자동 반복이나 출입 기능을 가져오기 완료와 동일시하지 않는다.
런타임 관찰은 편집기 play가 아닌 전용 player.html에서 수행한다. 자세한 범위는 DOORS.md 참조.

공용 게시 시 문서만 복사하면 sprite가 빠진다. `read-pixel-art-world-host.mjs`는 확인된9개의
`shared_paw_door_*` 자산도 호스트 API로 해석한다. `publish-pixel-art-world-local-library.mjs`는
paw-* 타일셋의 문 카테고리와 동일 ID 자산을 함께 요구하고, 프레임 규격·실제 PNG 치수·JSON
안의 uploaded 참조를 검증한 뒤 공용 assets에 보존한다. 이전 공용 문을 오래된 source로
지우려는 게시도 중단한다. 정본과 공용 문서가 같은 예약 sprite ID를 써 재치환이 필요 없다.

로컬 설치 관찰: 원본9파일 SHA와 가져온 PNG의 보이는 RGBA가 일치했다. 정본revision33에
9sprite/6소유자/9용도43MD43PNG를 저장·재로드, 공용 게시 후revision34에21공용 타일셋을
재투영했다. 기존12맵은 보존됐다. AI 문서 전페이지와43그림, 새 프로젝트 메모리 투영의
sprite 의존성도 확인했다. 실제 SQLite 새 프로젝트 생성 관찰은 앞선27타일셋 시점의 별도 근거다.
