# Pixel Art World 문 시트 — 사용자 다운로드형 카탈로그

직접 링크 50건(실제 원본49장·404 1건)을 끝까지 분류했다. 활성43원본 / 157변형
(개방144·정적13), 제공자 권리 보류5원본, 문이 아닌 층 표시기1원본이다. 기존9원본/34변형의
ID·SHA·crop·개방 배열은 그대로 유지한다. `doors.json`은 활성 프레임 계약, `doors-audit.json`은
보류/제외/404를 포함한 전체 분류다. 그림은 사용자 로컬에만 있고 Git/public에 배포하지 않는다.

## 출처와 권리

- [문1](https://yms.main.jp/dotartworld/page3/door01.html): 학교는 외관/내장/체육관 용도,
  Tolt02는 세로 방향, 편의점은 왼쪽 외관/오른쪽 내장이라는 제작자 설명을 실제 픽셀과 대조했다.
- [문2](https://yms.main.jp/dotartworld/page3/door02.html): JP01/JP02의 복고 외관문, U01의 목욕탕 문,
  Ruins01의 석문을 원본과 대조했다. WF01/WF02/WS01/WS02/WS03은 アトリエ・ヤオヨロヅ 제공으로
  명시된다. 연결된 [제공자](http://atelieryaoyorozu.web.fc2.com/)는 2026-09-24 접근 시503였고
  별도 이용 조건을 확인하지 못했다. yms 일반 약관의 저작권 표기를 외부 제공자 동의로 확대
  해석하지 않고 이5장은 권리 확인 보류로 분리한다. 픽셀은 세로 개방4단계지만 가져오기에는 노출하지 않는다.
- [캐릭터1](https://yms.main.jp/dotartworld/page3/chara01.html): Ev01/Ev02는 외부/내부 엘리베이터 문,
  Evs01은 층 표시기라고 명시하므로 문 전용 범위에서 제외한다.
- [첫 페이지 2017-01-13](https://yms.main.jp/dotartworld/): Gate-Euro03 원본 링크와 장식 문 추가
  설명을 확인했다. 해당 위치에 RPG Maker 전용 표시는 없으며 파일 경로가 vx라는 이유로
  별도 권리 제한이나 XP 4열 규격을 추측하지 않는다.
- [이용 조건](https://yms.main.jp/dotartworld/page1/rule.html): 사용자 다운로드, 편집 가능,
  소재 재배포 불가, 공개 작품 크레딧 필요. 활성43개 원본의 제공 위치에서 RPG Maker 전용 표시를 발견하지 않았다.
  자체 open-source 라이선스나 재배포 허가를 부여하는 메타데이터가 아니다.
- `SC-Door-Schl03`은 확보되지 않은 404 파일이다. `SchlG01`과 동일시하거나 지원으로 세지 않는다.

## 실제 프레임 계약

애니메이션 변형은 열이 변형이고, 행이 개방 단계다. 보통 4열 시트의 열 c의 열림은
`[c,c+4,c+8,c+12]`, Tolt02만 `[c+12,c+8,c+4,c]`이다. 닫힘은 역순이다.
Convi02의 열2/3은 모두 투명하므로 유효 문으로 등록하지 않는다. 개방 변형은 4개 프레임이
모두 비어 있지 않고 서로 다른 픽셀임을 확인했다. 열을 가로로 재생하거나 16칸을 순환하지 않는다.
예외를 메타데이터로 명시한다:

| 원본 | 실제 처리 |
|---|---|
| Arch01 | 제작자가 비애니메이션이라고 명시한 왼쪽2열은 정적8상태; 오른쪽2열만 개방 |
| U01 | 0·1열 문 개방, 2열의 ゆ/男/女 노렌은 정적3상태; 빈 프레임 제외 |
| Ruins01 | 0·1열 문 개방, 2열 봉인문은 정적2상태(중복 제외), 3열 조각상/받침 제외 |
| Gate-Euro03 | 80×64의3열×4행, 12프레임 보존; 문은 `[0,3,6,9]`, 나머지 열은 투명 |

정적 variant의 `kind=static`, `openingFrames`/`closingFrames`는 길이1이다.
`pixelArtWorldDoorCommands`는 정적 그림에 빈 명령 배열을 반환한다. 열림 기능이나 대기 명령을
꾸며내지 않는다. 기존9의 `kind` 생략은 기존 개방 변형으로 호환된다. 전체 프레임 수는
**`pack.frames.length === pack.columns * pack.rows`**이며 16으로 고정하지 않는다.

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
SpriteDef에 임의 참고문서 필드를 추가하지 않는다. 전체 활성 묶음은 43용도/200 MD/200 PNG다. 추가34개만 설치하면 34용도/157 MD/157 PNG다.

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


## 2026-09-24 확장 재생성과 관찰

`python3 scripts/content/expand-pixel-art-world-doors.py /사용자/다운로드경로`는 CSV의 SHA를
검사하고 실제 PNG의 전체 crop·알파 범위·픽셀 해시를 다시 추출한다(Pillow 필요). 기존9는
그대로 보존한다. 이어 `node scripts/content/prepare-pixel-art-world-doors.mjs`로 메타데이터
번들을 만든다. 이 단계는 PNG를 복사하거나 공용 DB에 쓰지 않는다.

활성43종 전체를 브라우저의 실제 prepare 함수로 읽어 참고문서와 PNG를 생성했다.
전용 player.html에서 JP01, Ruins01, U01, AutoAW의 `0→4→8→12`, Gate-Euro03의
`0→3→6→9`, 정적 Arch01의 pattern0 유지(빈 명령)를 실제 action 입력으로 관찰했다.
SpriteDef가 없는 shared 형태(asset meta만 있음)에서도 로드했다. 원본 geometry를 쓰는 AI
지도 crop6종과 정적/개방 구분 카드43개를 확인했다. 이 증거는 문 충돌·전이 이벤트 완성이나
정본 설치 증거가 아니다. 재생 속도100ms는 예시다. 개인 관찰 자료는 gitignored
`output/paw-doors-expanded/`에 보관한다.
