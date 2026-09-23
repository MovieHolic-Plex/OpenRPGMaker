# Pixel Art World — 사용자 다운로드형 타일 지원

2026-09-24: 도서관 / 사무실 각 5개 가구에 [도시](URBAN.md) 2팩·12부품,
[학교](SCHOOL.md) 2팩·20부품, [XP 오토타일](autotiles.md) 6종을 추가했다.
도시 사거리와 교실은 실제 타일 전체 배열 예제를 포함한다. 아래 최초 시범 설명은 도서관/사무실 기준이다.
사용자 요청은 소재 배포가 아니라 직접 다운로드한 원본을 에디터와 AI가 이해하게 하는 것이다.
`catalog.json`은 우리 에디터용으로 작성한 좌표·해시·가구 조립 메타데이터다.
원본 PNG·샘플 이미지·ZIP·이미지 dataURL은 이 디렉토리나 앱 번들에 넣지 않는다.

## 출처와 판본

- 제작자: Pixel Art World / ドット絵世界 (yms)
- 도서관: https://yms.main.jp/dotartworld/page2/tile-library01.html
- 사무실: https://yms.main.jp/dotartworld/page2/tile-office01.html
- 이용 조건: https://yms.main.jp/dotartworld/page1/rule.html
- 실제 PNG 치수·바이트 SHA-256·원본 32px 셀을 확인했다. 확인 날짜와 해시는 catalog에 있다.
- 샘플 게임, RPG Maker RTP, 별도 문/오토타일/유리 테이블은 가져오지 않는다.
- 그림의 저작권은 제작자에게 있다. 일반 소재의 게임 사용·편집 허용, 소재 재배포 금지,
  공개 작품 크레딧 의무가 안내되어 있다. 링크형 지원에 대한 제작자의 별도 승인을 받았다고 주장하지 않는다.

## 사용과 공용 제공

자료집 → 맵 → 타일 → 외부 타일셋 다운로드 → 제작자 페이지 → 원본 저장 → 받은 PNG 가져오기.
다운로드 버튼은 제작자 설명 페이지를 연다. 에디터 서버에서 대리 다운로드하거나 CORS를 우회하지 않는다.
사용자가 고른 원본의 바이트 해시와 디코딩 치수가 모두 일치한 때만 32px 타일셋을 새로 만든다.
파일 이름을 바꾸는 것은 가능하지만 리사이즈/재인코딩/다른 판본은 이 사전으로 지원하지 않는다.
실패하면 타일셋·프로필·프로젝트 변경이 없다. 기존 타일셋에 덮어쓰지 않는다.

`node scripts/content/prepare-pixel-art-world-references.mjs`로
`src/assets/pixelArtWorldCatalog.json`을 생성한다. 생성기는 네트워크나 그림 파일에 접근하지 않는다.
이 메타데이터는 모든 신규·기존 프로젝트에서 다운로드 목록을 통해 사용할 수 있다.
기본 프로젝트에 그림/타일셋 행을 심는 `ensureBundledTilesets` 대상이 아니다.

## 조립 데이터

- 모든 sourceRect는 **0기준 타일 칸**. 픽셀 사각형은 각 수치 ×32.
- 원본 타일 번호 = y×8+x. generator가 가구별 전체 2차원 배열을 만든다.
- `externalRecipeExample`은 가구 원점 (1,1), 사방 1칸 바닥, lower/upper 전체 배열,
  앞쪽 접근칸을 정의한다. 가구 고정 조각을 반복·뒤집지 않는다.
- 가져오기 시 `tileGroups`, `tileMeta`, `priority`, `passability`를 함께 만든다.
  바닥은 lower·통과, 가구는 upper·사각 영역 전체 차단이다. upper와 ★를 혼동하지 않는다.
- **미검토 칸은 unknown/차단**이다. 전체 시트를 검토한 것처럼 라벨을 만들지 않는다.
- 사무용 책상 위의 컴퓨터는 두 상위 슬롯에 겹쳐 놓을 수 없다. 이번 예제는 책상만 다룬다.
  컴퓨터를 더할 때에는 사용자 로컬 합성 또는 별도 이벤트 그래픽 작업이 필요하다.
- 문/벽/자동 연결/완성 방/이벤트 작동은 지원 범위 밖이다. 문 그림을 출입구 이벤트로 취급하지 않는다.

## 참고문서와 그림

사용자가 가져온 PNG에서 원본 해상도로 조립 그림을 생성하고 프로젝트의
`referenceDocuments`에 **6 MD / 6 PNG**를 저장한다(각 타일셋 기준).
원본 시트 1장과 각 가구의 정상/오류 나란한 그림 5장이다.
잘린 하단 조각·막힌 접근칸은 실제 타일 배열을 변조해 만든다. 모델 생성 이미지를 사용하지 않는다.
그림은 사용자 프로젝트 소유 저장물이며 공용 번들로 되돌려 넣지 않는다.
AI `list_tileset_references` / `read_tileset_reference`의 기존 선행 읽기 경로로 제공한다.
용도 ID는 `paw-furniture-pilot`. 출처·해시·크레딧·범위 제한이 MD에도 들어간다.

`validateExternalRecipeExample`은 고정 예제의 배열·하위 바닥·접근칸을 확인한다.
DIMENSIONS / FLOOR_REPLACED / OBJECT_CELL / APPROACH_BLOCKED를 좌표와 반환한다.
이 검사는 임의의 완성 맵 경로 탐색, 이벤트 작동, 미학, AI 성공률 측정을 대신하지 않는다.

## 연구 및 검증 경계

원본은 `/tmp/paw-study/`에 내려 받아 연구했다. 사용자 PNG로 생성한 브라우저 관찰 그림은
`output/paw-pilot/`에만 둔다(둘 다 커밋 대상 아님). 공유 가능한 증거는 이미지 없는
관찰 요약만 남긴다. 실제 사용자 프로젝트는 지정되지 않았으며 수정하지 않았다.
이 변경은 에디터 코드와 공용 메타데이터 지원이다. 브라우저 임시 fixture의 가져오기/JSON 왕복을
SQLite 정본 저장 완료로 보고하지 않는다. tests/gates/vitest/typecheck는 사용자 요청 없이 실행하지 않는다.
