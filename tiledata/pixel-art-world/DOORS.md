# Pixel Art World 문 시트 — 사용자 다운로드형 1차 묶음

원본 9개 / 열별 변형 34개. 학교 외관·내장·체육관·목조 학교 5개, 정면/측면 화장실 2개,
편의점 단폭/양폭 2개다. `doors.json`이 SHA, 원본 크기, 16개 crop 사각형, 알파 영역,
빈 프레임, 개방/닫힘 전체 배열의 정본이다. `prepare-pixel-art-world-doors.mjs`는 그림 없이
`src/assets/pixelArtWorldDoors.json`을 만든다. 원본 PNG나 가공 그림은 Git/public에 넣지 않는다.

## 출처와 권리

- [문1](https://yms.main.jp/dotartworld/page3/door01.html): 학교는 외관/내장/체육관 용도,
  Tolt02는 세로 방향, 편의점은 왼쪽 외관/오른쪽 내장이라는 제작자 설명을 실제 픽셀과 대조했다.
- [문2](https://yms.main.jp/dotartworld/page3/door02.html): 이번 묶음에는 포함하지 않는다.
  장애물·노렌 혼합, 제공자 별도 표기의 일본식 문 등은 별도 의미 검토가 필요하다.
- [이용 조건](https://yms.main.jp/dotartworld/page1/rule.html): 사용자 다운로드, 편집 가능,
  소재 재배포 불가, 공개 작품 크레딧 필요. 이 9개 위치에서 RPG Maker 전용 표시를 발견하지 않았다.
  자체 open-source 라이선스나 재배포 허가를 부여하는 메타데이터가 아니다.
- `SC-Door-Schl03`은 확보되지 않은 404 파일이다. `SchlG01`과 동일시하거나 지원으로 세지 않는다.

## 실제 프레임 계약

4열은 방향 행이 아니라 문 변형이고, 4행은 개방 단계다. 보통 열 c의 열림은
`[c,c+4,c+8,c+12]`, Tolt02만 `[c+12,c+8,c+4,c]`이다. 닫힘은 역순이다.
Convi02의 열2/3은 모두 투명하므로 유효 문으로 등록하지 않는다. 유효 변형은 4개 프레임이
모두 비어 있지 않고 서로 다른 픽셀임을 확인했다. 열을 가로로 재생하거나 16칸을 순환하지 않는다.
Arch01의 비애니메이션 열, 층 표시 Evs01, VX Gate는 이 규칙으로 자동 분류하지 않았다.

원본 프레임 사각형을 그대로 보존한다. 학교 96×64의 여백, 측면 화장실 32×96의 아래쪽 여백,
Convi02 128×64의 짝수 폭을 알파 bbox로 자르고 재중앙 정렬하면 배치가 바뀐다.
`graphic.scale=1, scaleMode=manual`, `animationType=fixedGraphic`을 사용한다.
`setEventGraphicPattern`과 `wait`는 단발 **그림 변경만** 한다. 100ms는 예시 속도이며 제작자 FPS가 아니다.

문 이벤트·충돌·조건/스위치·이동 목적지·열림 상태 유지·양방향 출입을 자동 생성하지 않는다.
참고문서의 페이지 부분 JSON을 해당 공간의 이벤트에 적용하고 별도로 저작한다. 기존 캐릭터
걷기 피커로 문 열/행을 고르지 않는다. AI/페이지 JSON 저작은 문서의 정확한 sprite ID와 pattern을 쓴다.
문턱 좌표와 통과 폭은 그림 폭으로 추정하지 말고 실제 벽/바닥에 맞춘다. 비교 PNG는 프레임
진단이며 완성 공간 배치의 증거가 아니다.

## 가져오기·AI 문서 소유

외부 타일셋 다운로드 → 문 카드 → **32px 사용자 타일셋** 선택 → 사용자 PNG 가져오기.
SHA/치수/빈 프레임 확인 뒤 일반 `sprite` asset과 SpriteDef를 등록한다. 그림은 저장소 adapter가
자산 파일 또는 인라인 데이터로 보관하며 한 snapshot/store.update로 편집 이력을 남긴다.
비동기 준비 중 프로젝트 lineage/저장 대상/참고문서 대상이 바뀌면 적용하지 않는다.
`shared_` 예약 ID, 참조 소유권이 다른 타일셋, 참고문서 32개 상한, 동일 문 중복은 거절한다.

각 문 원본은 선택한 타일셋의 `referenceDocuments` **한 용도**를 소유한다. 원본 MD/PNG와
유효 변형별 MD/PNG(전체 열림/닫힘 배열, crop, 페이지 부분 예제, 정상/오류 비교)를 넣는다.
따라서 기존 `list_tileset_references`/`read_tileset_reference`에서 실제 그림과 함께 발견된다.
SpriteDef에 임의 참고문서 필드를 추가하지 않는다. 9개 묶음은 총 9용도/43 MD/43 PNG다.

공용 로컬 등록자는 `preparePixelArtWorldDoor(file, pack, assetId)`의 `{asset,sprite,references}`를
사용한다. 공유 payload는 `assets[asset.id]`와 소유 타일셋 `referenceDocuments`가 필수다.
`asset.kind='sprite'`, `meta.width/height/frames/frameWidth/frameHeight`를 그대로 보존한다.
공유 스키마에 SpriteDef가 없어도 이 메타데이터로 플레이어/AI crop이 동작한다. 예약 ID로
직접 덮어쓰는 UI는 제공하지 않으며 공용 갱신은 호스트의 게시 경로가 담당한다.

## 관찰 범위

사용자 원본9개를 실제 browser prepare로 처리하고 생성 비교 그림을 직접 확인했다.
player.html/exportProjectStoreShim 최소 진단 fixture에서 실제 action 입력으로 학교
`0→4→8→12`, 측면 화장실 `12→8→4→0`, 양폭 편의점 `0→4→8→12`를 관찰했다.
9개 sprite의 AI 지도 crop과 alpha 보존, 전용 UI의9개 카드/입력/대상 표시도 확인했다.
이 관찰은 문 이벤트 완성·DB 정본 저장·전체49개 문 지원 완료의 증거가 아니다.
