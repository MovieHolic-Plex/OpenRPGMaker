# Pixel Art World 연출 오브젝트 — 원본과 이벤트 프레임

MD항목26/27의 chara01/02와 연결 차량 페이지를 합친 다운로드 원본은50장이다.
`eventprops.json`에는 전체 출처 분류와48장의 기하가 있다. 범용39장/270변형,
RTP 제한 분석9장/59변형, 문 카탈로그에 이미 있는 Ev01/Ev02 2장(중복 집계 없음)이다.
카탈로그에서 원래 제외된 Funassi는 실제 다운로드50장에 포함되지 않는다.
PNG는 사용자 로컬에서만 읽으며 Git/public/배포용 픽셀 번들에 넣지 않는다.

## 제작자 근거와 권리

- [chara01](https://yms.main.jp/dotartworld/page3/chara01.html): 앉은/비행 부엉이,
  엘리베이터 문과 별도 층 표시기, 트리3행 장식 증가/4행 비애니메이션을 구분한다.
- [chara02](https://yms.main.jp/dotartworld/page3/chara02.html): 기본적으로 비애니메이션.
  자판기는 두 이벤트 조립, 폴사인만 애니메이션이라는 예외를 명시한다.
- [차량](https://yms.main.jp/dotartworld/page3/chara-cars.html): 3개 PNG 원본 페이지.
  측면01/03을 확대해 실제 바퀴 회전 프레임을 확인했다. 문 개방이 아니다.
- [규약](https://yms.main.jp/dotartworld/page1/rule.html): 원본/가공 소재 재배포 금지,
  공개 작품에 Pixel Art World 크레딧. 전용 표시 소재는 RPG Maker 시리즈를 이용한 게임 제작에 한정된다.

RTP 제한 구간은 Skeleton 표 **뒤**의 전용 아이콘과 XP 소유자 제한 문장에서 시작한다.
그 아래 SantaF01/F02, CTsunagi, yaranaika, SantaC01/C02, CFundosi, PikoC-Girl01/Teddy005
9개를 `rpg-maker-xp-owner-and-maker-project-only`로 기록한다. Piko 제공자도 크레딧에 남긴다.
Skeleton은 표시 앞의 별도 자료이며 이 제한을 근거 없이 거슬러 적용하지 않는다.
조건이 명확한 제한 자료를 권리 미상으로 부르지 않는다.

XP 소유 확인만으로 OPRN 엔진 게임 사용권이 생기지 않는다. 제한9개는 전체 sourceRect,
알파 범위, 프레임/변형을 분석 메타데이터에 남기지만 **OPRN 가져오기 API가 거절**하고
UI에는 파일 입력이 없다. 공용 새 프로젝트 자동 등록 대상도 아니다. 확인 체크박스로 이
제약을 우회하지 않는다. 조건을 충족하는 RPG Maker 프로젝트에서의 사용 판단은 별도다.

## 실제 그림 범위와 배열

| 원본 | 완전 그림/프레임 계약 |
|---|---|
| Nobori3장 | 행별 깃발 변형, 가로4프레임 흔들림 |
| 부엉이·잉어·거북·라마·산타 | 방향별 행/가로4프레임. generic sprite는 방향을 자동 전환하지 않음 |
| Owl02 | 첫8칸 앉기 정적 자세; 아래2행 제자리 비행 |
| Stone/Pointer/Candle | 색/형태별 가로4프레임; Pointer 반투명 보존 |
| Lamp | 위3행 발광; 맨 아래 유효3칸은 정적 |
| ChristmasTree | 위2행 점멸;3행 장식 단계와4행 무장식은 정적 |
| Skeleton | 열별 변형, 세로4프레임 표정 변화 |
| Cupboard | x32/96/192/256의64×96 전체 찬장/책장; 세로 개방4단계 |
| WallLion01/02 | 머리·물줄기·물보라 포함32×128 전체 열; 가로4프레임 |
| Evs01 | 층 표시등의 정적 상태; 문/엘리베이터 실행 기능 아님 |
| VdgMacine01 |32×96 두 조각을 같은y의x/x+1 이벤트로 조립;8종 자판기 |
| Polesign | 첫행만 회전4프레임; 다른 행 유효 소품은 정적 |
| Noren |96×32 전체 커튼 상태. chara02 비애니메이션 선언 유지 |
| Bd02/Bd03 |128px 전체 간판 폭, 각각32/64px 높이의4정적 상태 |
| Set-Schl01 |64×128 수도대/열린 교문 한 쌍을 각각 전체로 보존 |
| Set-Schl02 |각 행96×64 골대/수도대와32×64 타이어/심판대를 구분 |
| Labo03 |아래 오른쪽64×32 가열 실험 장치. 위 행 삼각대·온도계는 별도 |
| Car01/03 |160×96, 행별 차색/좌우 방향·열별 바퀴 회전 |
| Car02 |96×128, 앞/뒤2행·색4열, 나머지 행은 빈 칸 |
| 책·버섯·액자·Labo01/02 |32px 완전 그림/묶음의 정적 상태. 한 칸 내부의 여러 조각은 분리 안 함 |

`frames`는 원본 전체 사각형과 반열린 alphaBounds, sourceAnchor, atlasOffset, 픽셀 해시를
갖는다. 원본 셀 크기가 다른 시트는 같은 pack의 최대 프레임 크기로 투명 여백만 더해
바닥 중앙을 맞춘다. 비투명 픽셀을 확대/축소/재색칠하지 않는다. 원본 내부 여백은 보존하므로
실제 밑동이 이벤트 바닥과 다를 수 있다. 실제 지면/상판/벽 받침은 alphaBounds와 대조해
별도로 저작한다. 이 자료의 진단 격자를 완성 공간으로 부르지 않는다.

프레임 atlas는4열. 원본 width/height와 달라질 수 있다:
`width=4*frameWidth`, `height=ceil(frames.length/4)*frameHeight`, `meta.frames=frames.length`.
기존 generic sprite loader와 AI crop을 사용하며 charset의 방향/색키 처리로 보내지 않는다.
자산meta만으로 작동하므로 공용 스키마에 별도 SpriteDef가 없어도 된다.

## 이벤트와 AI 참고자료

`preparePixelArtWorldEventProp(file,pack,assetId)`는 SHA/치수/전체 알파 좌표를 검사하고
`{packId,sourceSha256,asset,references}`를 반환한다. `importPixelArtWorldEventProp`는
32px 사용자 타일셋의 표준 referenceDocuments에 한 용도를 추가한다. 예약 shared owner,
다른 원본을 참조하는 owner, 중복 용도,32용도 상한은 거절한다. 비동기 중 프로젝트/저장
대상/owner 변경도 거절하며 importer는 이벤트를 자동 배치하지 않는다.

범용39장의 자료는39용도/309MD/618PNG다. 원본·실제atlas·전체 crop/프레임/변형 사전,
각 변형의 전체 프레임 순서 그림,12×10 전체 lower/upper 배열과 모든 이벤트 좌표/페이지/
명령, 정상/첫 조각 누락 비교 그림과 오류 좌표를 갖는다. 소유 타일셋이 정해지면 기존
AI `list_tileset_references`/`read_tileset_reference`에서 검색된다. SpriteDef 임의필드가 아니다.

loop는 parallel 페이지가 명시된 `setEventGraphicPattern`/`wait` 목록을 반복한다.
sequence는 action 한 번(찬장 개방); static/assembly는 명령 없음이다.120ms는 편집 예시이고
제작자 FPS가 아니다. 걷기 동작 재생은 이동 AI를 구현하지 않는다. 차량 충돌/승차, 실제
판매/아이템/조명 효과, 분수 받침, 큰 오브젝트의 충돌 범위는 별도 저작이다.

`validateEventPropAssembly`는 치수·부분 수·부분 좌표·초기 프레임을 확인한다. 가져오기 때
모든 프레임의 실제 알파 범위를 원본 사전+atlasOffset과 대조해 잘림/오프셋 오류를 거절한다.
추출 생성기는 실제 원본의 모든 비투명 픽셀이 적어도 한 전체 사각형에 포함됨을 확인한다.
이 구조 검사는 상호작용 완성이나 미적 승인이 아니다.

## 재생성과 관찰

`python3 scripts/content/prepare-pixel-art-world-eventprops.py /사용자/다운로드경로`
(Pillow 필요). CSV에 고정된 SHA를 확인하고 metadata JSON 두 파일만 생성한다.

범용39장 실제 browser prepare 및 제한9장 거절, 전체원본50장 contact, 주요 복합 객체
정상/오류 PNG를 관찰했다. 전용 player.html의 asset-meta-only fixture에서 자판기2조각,
분수/폴사인/차량 가로4프레임 반복, 찬장0→4→8→12, Evs정적0, 실험장치14, 간판0을
확인했다. AI crop9이벤트는 원본alpha를 보존했다. UI48카드 중 가져오기39/제한9를 확인했다.
개인 증거는 `output/paw-eventprops/`에 있고 정본/공용 DB 쓰기나 전체테스트/게이트는 하지 않았다.

공용 게시자는 `rights.runtimeImportAllowed`와 `sharedProjectDefaultsAllowed`를 모두 확인하고
제한9개를 기본 라이브러리에 넣지 않는다. 범용39참고자료도 한 owner의32용도 상한을 넘기지
않도록 나눈다. 기존 맵/문 자산·문서와 별도로 보존해야 한다. user-local publication은 root가 맡는다.
