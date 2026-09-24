# 사용자 제공 목조학교 외관 / 하수도 native32

`tiledata/pixel-art-world/SCHOOL-SEWER.md`가 원본·지원/보류·실행 명령의 계약이다.
`prepare-pixel-art-world-school-sewer.mjs`는 2개 원본의 픽셀 없는 메타데이터만 생성한다.
기존 `externalTilesetCatalog.ts` 목록과 PNG 가져오기 후 `attachPixelArtWorldSchoolSewer`
호출로 사용자 로컬의 실제 그림/전체 배열/정상·오류를 생성한다. 원본 번호400/376칸은 그대로다.
타일 자료와 10개 structureKit 소유 자료 모두 같은 전체 배열/실제이미지를 갖는다.

`prepare-pixel-art-world-school-sewer-library.mjs`는 읽은 호스트 portable+receipt와 사용자 PNG를 받아
실제 browser importer로 준비하고, 엔진 canMove 동선 및 타일 스키마를 관찰한 뒤 private output에
2 tilesets/assets, 3 places의 library를 만든다. DB 모듈·쓰기 경로는 없다.
공용과 정본 게시/재로드는 감독자 단계다. source/derived artwork Git/public 배포는 하지 않는다.

물 SC-Water01/02는 현재 eventprops에 없으며 별도 의존성으로만 적는다.
`sewer-water-dependencies.json`은 후속 연출 작업용 기하 근거이고 런타임 지원 선언이 아니다.
특히 작은 물줄기 행1에는 배수구 아래가 있어 반복할 수 없고, 큰 물줄기 아래3개 charset행은 비어 있다.

## 별도 로컬 게시 경계 (2026-09-25)

`publish-pixel-art-world-school-sewer-library.mjs`는 준비 영수증·portable 파일·metadata·32artifacts·
다운로드 원본 SHA와 구조/AI 배열을 재검사한다. `--prepare`는 파일만 만들고,
`--publish-local`만 공식 sharedContentSqlite API로 `pixel-art-world-school-sewer-local`을 CAS 게시한다.
다른 라이브러리의 타일/자산/장소 ID 충돌과 변경을 거부한다. 압축은 그림의 RGBA를 보존한다.
2타일/2자산,7구조객체+3장소 래스터,3장소를 구분한다. mixed layer kit의 AI 홈은 perCell이다.
감독자 재준비에서 실제canMove 고립 통과칸0, 정본revision52 저장/바이트 재로드/12맵 보존,
AI27MD/33페이지/48그림을 확인했다. `output/paw-school-sewer-install/` 참조.
