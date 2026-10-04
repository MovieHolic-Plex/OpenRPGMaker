# Pokemon character motion harness

몬스터 수집 장르의 주인공·NPC 걷기 및 오프닝 도트 클립을 반복해서 제작·검수하는 CLI 하네스다. 저장소 위치는 `src/harnesses/pokemon-character-motion/`, 선언은 `harness.ts`, 시드는 `harness-data/pokemon-character-motion/seed.json`이다. 에디터 화면과 AI 도구는 아직 없다. 자동 이미지 생성·그림 그리기도 하지 않는다. 생성기에서 얻은 실제 PNG와 정확한 프롬프트를 가져온다.

## 저장 경계

`POKEMON_MOTION_SANDBOX=/absolute/path` 또는 모든 명령의 `--sandbox /absolute/path`로 격리한다. 기본은 `harness-data/pokemon-character-motion`. 원본 PNG·프롬프트·가공 후 PNG·출처는 candidates/<role-timestamp-hash>/에 남으며 import는 기존 후보를 덮지 않는다. 큰 원본은 공유 검토 디렉터리에 보존하고 Git에는 최종 그림·출처 해시·판정·관문 및 필요한 작은 증거를 남긴다. CLI는 SQLite·원격·프로젝트 저장소·에셋 카탈로그에 쓰지 않는다. build의 기본 목적지는 sandbox/output/<role>다. 승인된 그림을 공용 팩에 등록하고 정본에 저장·재로드하는 작업은 감독자가 한다.

## 네이티브 계약

- 역할 16개: hero, rival, professor, nurse, merchant, mother, resident, gym_leader, company_agent, captain, worker, explorer, student, ranger, moon_leader, hiker.
- 한 역할은 72×128 PNG, 24×32 칸, 3열×4행이다.
- 행 순서 up/right/down/left, 열 순서 stepA/idle/stepB. 정지 포즈 1, 런타임 루프 [0,1,2,1], 기본 140ms.
- 기존 288×256 팩은 `--native --slot 0..7`로 역할 하나를 손상 없이 추출할 수 있다.
- 네이티브 import는 색을 줄이거나 흔들림을 정렬하지 않는다. 잘못된 기존 팩을 억지로 통과시키지 않는다.

## 실행

```bash
npm run harness -- pokemon-character-motion status --sandbox /path/review
npm run harness -- pokemon-character-motion import --sandbox /path/review \
  --role hero --source /path/hero.png --prompt-file /path/hero.prompt.txt --block 8
# --sampling raster: 원본 좌표에서 머리 중심을 맞춘 뒤 공통 배율/샘플 위치로 변환
npm run harness -- pokemon-character-motion import --sandbox /path/review \
  --role hero --source /path/hero.png --prompt-file /path/hero.prompt.txt --sampling raster
# --block 생략 시 12개 포즈의 추정값 중앙값을 COMMON grid로 다시 사용한다.
# 각 포즈를 서로 다른 블록으로 가져오지 않는다.
npm run harness -- pokemon-character-motion import --sandbox /path/review \
  --role merchant --source /path/cast-1.png --prompt-file /path/legacy-origin.txt --native --slot 4
npm run harness -- pokemon-character-motion check --candidate /path/review/candidates/hero-...
npm run harness -- pokemon-character-motion preview --candidate /path/review/candidates/hero-...
# preview.html을 브라우저에서 열어 원본/3배율 네 방향을 재생하고 증거를 캡처한다.
npm run harness -- pokemon-character-motion review --candidate /path/review/candidates/hero-... \
  --who supervisor --why '네 방향·발 교대·머리·소품·루프를 재생 검수함' \
  --verdict pass --evidence /path/walk.webm,/path/review.json
npm run harness -- pokemon-character-motion gate --candidate /path/review/candidates/hero-...
npm run harness -- pokemon-character-motion build --candidate /path/review/candidates/hero-... --out /path/review/output/hero
# 기존 시트 직접 검사. 실패는 exit 1. report는 source hash도 기록한다.
npm run harness -- pokemon-character-motion check --source /path/cast-1.png --slot 0 --report /path/baseline-hero.json
node src/harnesses/pokemon-character-motion/node/verify.mjs
```

`check`는 구조만 검사한다. `gate --structural-only`도 구조만 검사하며 check.json을 쓴다. 이것으로 build를 허용하지 않는다. 일반 gate는 현재 그림의 시각 판정도 요구한다. 구조 코드/픽셀 헬퍼 구현이 달라져도 새 관문·검수를 요구한다. 감독자의 그림 교체 권한이 있는 경우 감독자가 review를 기록한다. 몬스터 **종** 그림의 사람 후보 선택 규칙은 별도이며 이 하네스로 우회할 수 없다.

## 가져오기와 관문

생성 아틀라스는 투명/마젠타 배경과 3×4 포즈의 여백을 읽어 행·열을 나눈다. 행별 열 여백을 읽으므로 가로 배치가 조금 달라도 된다. 충분한 여백을 못 찾으면 실패한다. 공통 블록으로 기존 `monster-collect-species/pixel/grid`를 사용하고, **한 배율**로 모든 12포즈를 줄인다. 각 방향 상단 실루엣 중심을 네이티브 좌표에 정렬하는 것은 이동만이며 개별 포즈 크기를 바꾸지 않는다. 알파 형상에 도트를 추가하거나 윤곽을 다시 그리지 않는다. 한 역할 전체의 빈도/Lab 대표색을 <=24개로 합쳐 옷 색 깜빡임을 줄인다. `--sampling raster`는 프레임별 색 경계 재맞춤으로 같은 머리 모양이 변하는 원본에 쓴다. 원본 상단 실루엣 중심을 먼저 맞추고, 전체 12포즈에 하나의 배율·반 픽셀 샘플 위치·알파128 기준·공통 팔레트를 적용한다. 출력 바깥 샘플도 검사하여 잘림을 숨기지 않는다. 자동으로 관문이 통과하는 샘플 위치를 찾거나 실패를 완화하지 않는다. `--sampling grid`(기본)는 기존 격자 추출이다. 가공 정보, 12개 원본 crop, 추정 블록, 확정 블록, 공통 배율과 팔레트를 provenance에 남긴다.

관문은 정확한 캔버스/12포즈, 이진 알파, 투명 1px 경계(잘림), 전체 12포즈 팔레트 합집합 <=24, 방향별 상단 9행 실루엣 중심과 꼭대기 흔들림 <=1px, 머리 폭·전체 높이 비 <=1.25/머리 및 몸통 중심 면적비 <=1.30, stepA/B 하체 변경 >=4px, [0,1,2,1] 모든 인접 포즈의 상체 영역 변경률 <=0.36을 검사한다. 변경률은 투명/불투명 변화와 Lab 거리 >=0.12인 색 차이를 센다. 사소한 대표색 차이를 모든 픽셀이 바뀐 것으로 세지 않는다. 상체 변경률은 상단 9행 머리와 머리 중심 ±3px의 몸통(높이 65%까지)에서만 측정한다. 정상적인 팔/다리 동작을 제외한다. 전체 프레임의 정확한 RGBA 변경률은 경고/진단에만 남긴다. 몸통 연속폭도 진단에 남기며 정상 팔 움직임만으로 불합격시키지 않는다. 몸통 중심부는 상단 실루엣 중심을 기준으로 어깨 아래~몸 높이 65%에서 측정하며 팔과 다리의 정상 움직임으로 늘어나는 전체 bbox 폭은 크기 관문의 근거로 쓰지 않는다. 생성 importer의 머리 정렬은 수치 문제만 해결한다. 머리 그림 자체가 달라지거나 옷/소품/방향 의미가 달라진 것은 재생 시각 검수가 판단한다. 팔레트가 124~189개이고 머리가 3~7px 흔들리는 옛 캠페인 시트는 관문에서 거부되어야 한다.

**픽셀 수치가 방향이나 발 교대를 증명하지 않는다.** 완전히 일관되게 up/down을 바꾼 시트, 단순 팔만 움직이는 포즈도 숫자는 통과할 수 있다. 원본과 3배율 재생에서 방향·교대 다리·머리/몸 정체성·소품·루프 경계를 확인하고 who/why/evidence를 기록한다. 자동 의미 판정이나 자동 pass는 없다. preview는 단순 검토 파일이며 버튼으로 프로젝트에 적용하지 않는다.

## 오프닝 클립

import에 `--clip-source /path/strip-source.png --clip-metadata /path/clip.json`을 함께 줄 수 있다. 별도 생성 원본에서 명시한 crop을 그대로 잘라 strip을 만든다. 메타는 다음처럼 저작한다.

```json
{"id":"hero-wave","frameWidth":24,"frameHeight":32,"fps":6,"frameOrder":[0,1,2,1],"sourceRects":[{"x":0,"y":0,"width":24,"height":32},{"x":24,"y":0,"width":24,"height":32},{"x":48,"y":0,"width":24,"height":32}],"kind":"drawn","durationsMs":[160,160,160,160]}
```

크기·fps(0~60 초과 금지)·2~64프레임·명시 crop 경계·순서의 모든 프레임 포함·순서별 양수 지속시간(16~10000ms)·빈 프레임·최소 4px 변경을 검사한다. `kind: drawn`은 잉크 상자로 정규화한 모양이 전부 같으면 거부한다. 단순 평행 이동은 `kind: translation`이라고 정직하게 표기해야 한다. 실제 손/옷/표정이 변하는 그림인지도 감독자가 재생 검수한다. 이 메타를 엔진에 등록하는 것은 콘텐츠/런타임 소유자의 작업이며 CLI가 엔진을 고치지 않는다.

## 해시와 실패 제어

provenance는 source/prompt/final SHA-256과 계약/가공 정보를 고정한다. 검사는 이 값이 실제 파일과 같아야 실행된다. check/gate는 원본·프롬프트·최종·클립·출처 JSON·관문 버전·실제 구현 파일 SHA-256·임계값을 기록한다. review는 같은 값과 증거 사본 해시, preview 해시, who/why/verdict를 기록한다. gate는 review.json 해시를 기록한다. build는 관문이 pass이고 현재 출처/최종/임계/검수/증거 해시가 일치해야만 복사한다. 파일이 바뀌면 새 import/검수/관문이 필요하다. 잘못된 파일·검수 누락·실패·낡은 해시는 exit 1이고 자동 복구/우회하지 않는다.

## 집중 실행 검증

verify.mjs는 esbuild로 작은 노드 검사기를 묶고 실행한다. 서버·Vitest·전체 tsc·전체 gates를 돌리지 않는다. 실제 배포 그림이 아닌 최소 도형 fixture로 정상 12포즈와 잘린 시트·4px 팔 움직임을 가진 정상 보행, 프레임 뒤섞인 뿌리·중복 하체·머리 이동·팔레트 초과·반투명·불연속 경계, clip bounds/duration/translation-only를 검사한다. 실제 CLI의 import/check/preview/review/gate/build 흐름도 실행해 누락/실패/낡은 gate/최종 변조/증거 변조가 차단되는지 본다. fixture review 증거는 ledger 작동만 확인하는 stub이며 실제 캐릭터 의미 검수와 다르다. 감독자는 실제 원본을 가져와 자체 관문과 재생 증거를 다시 확인한다.
