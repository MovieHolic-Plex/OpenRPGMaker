# RM2003 전투 몬스터 도트 하네스

일반 JRPG 적의 **native64/96 원본과 3×3의 9개 자세**를 제작한다. 입구는
`src/harnesses/battle-monster/`, 실행기는 `node/pipeline.py`다. Python 3와 Pillow,
실제 모델 저작/검수에는 로그인된 `codex` CLI가 필요하다.

몬스터 수집 앞·뒷모습은 `monster-collect-species`, 필드에서 걷는 RM2000 칩은
`charset-actor`가 담당한다. 에디터 공방/AI 도구 연결은 아직 없으며 manifest는 false다.

## 시범 입력과 검토

```bash
npm run harness -- battle-monster pilot
npm run harness -- battle-monster review
npm run harness -- battle-monster status
```

조선 시범 입력 5종: 멧돼지·독두꺼비·방아토끼·장승귀·옹기귀. 커밋된
`content-packs/joseon-folklore/monsters/source/refined-grids/`를 `baseline` 후보로 복사한다.
이미 있으면 덮어쓰지 않는다. 기존 게임 설치/옛 PASS/선택을 이관하지 않으며 모두 pending이다.

`review`는 외부 호출 없는 자체 포함 HTML fragment와 `.standalone.html`을 만든다.
원본 도트 3배·세 배경·개별 자세·공격/대기 순서·검사·검수·사람 선택·현재 해시를 보여 준다.
화면은 읽기 전용이다. 채팅에서 사용자의 선택을 받은 뒤 CLI로 기록한다.
`--out /absolute/path.html`로 thread visualization 폴더에 출력한 후 OpenCodex의
`visualize-opencodex/scripts/publish.py`로 게시할 수 있다.

## 새 후보 저작

시드 `harness-data/battle-monster/seed.json`은 사람이 쓴다. 다른 분위기는 같은 형식의
`--seed /absolute/seed.json`을 쓴다. 종 ID/resourceId, cell(64/96), grounded, motion,
idleFrameMs, 실루엣, 공격 자세, 스킬 역할을 적는다. motion은 `pixelEnemySheets.ts`의 7종이다.

```bash
npm run harness -- battle-monster init --monster wild-boar --candidate revision-b
npm run harness -- battle-monster author --monster wild-boar --candidate revision-b --phase idle --note '주둥이를 길게, 네 다리를 분리'
npm run harness -- battle-monster check --monster wild-boar --candidate revision-b --phase idle
npm run harness -- battle-monster critique --monster wild-boar --candidate revision-b --phase idle
npm run harness -- battle-monster review
```

`author`/`critique`는 **GPT 6.1 sol high**를 각각 별도 `codex exec --ephemeral` 세션으로
실행한다. `--prepare-only`는 호출 없이 지시·명령·이미지 해시를 준비한다. 각 작업의
모델·effort·툴/지시/첨부 해시·종료 상태는 `jobs/<uuid>/`에 보존한다.
`author idle`은 기본 자세만 만든다. `author poses`는 현재 기본 자세의 사용자 keep가
필요하고, 선택한 palette/idle_a를 바꿀 수 없다. 나머지 8자세를 직접 찍는다.

후보마다 별도의 아트 작업 폴더를 사용하며 같은 후보 작업은 파일 잠금으로 겹치지 않는다.
게임 정본·에디터 코드·다른 후보를 쓰지 않는다. 여러 코딩 에이전트의 체크아웃은 기존 격리
워크트리 규칙을 따른다. 모델 작업을 관리하는 백그라운드 데몬은 추가하지 않는다.

## 사용자 선택과 수정

**에이전트가 keep를 대신 고르지 않는다.** 실제 사용자 선택만 `--by`/`--note`로 기록한다.
`--binding`은 검토 화면의 현재 phase 해시다. 최신 기록만 유효하다.

```bash
npm run harness -- battle-monster decide --monster wild-boar --candidate revision-b --phase idle --choice keep --binding HASH_FROM_REVIEW --by USER --note '사용자가 기본 자세를 남긴 원문'
npm run harness -- battle-monster author --monster wild-boar --candidate revision-b --phase poses
npm run harness -- battle-monster critique --monster wild-boar --candidate revision-b --phase poses
npm run harness -- battle-monster review
npm run harness -- battle-monster decide --monster wild-boar --candidate revision-b --phase poses --choice rework --binding HASH_FROM_REVIEW --by USER --note '공격 때 앞다리를 더 접어라'
```

검수자는 현재 1×/3×·밝은/어두운/체커 PNG를 별도 세션에서 보고 실루엣·해부·명암·결손·
동작·손/도구 연결에 자세/좌표별 의견을 낸다. `recommendation`은 참고 의견이다.
미감 점수/자동 선택 관문으로 쓰지 않는다. 현재 독립 검수와 기술 검사 이후 사람이 선택하며,
검수의 rework 의견도 읽고 남길 수 있다. 다음 `author`는 최근 사용자 rework 원문을
자동으로 전달하며 `--note`로 이번 교정 지시를 지정할 수 있다.

## 픽셀·해시 계약

```
source/palette.json            ASCII 1기호 → #RRGGBB, .은 투명이며 팔레트에 넣지 않음
source/poses/<pose>.pxgrid     native64/96의 정확한 리터럴 행 문자열
source/AUTHORING.md            직접 수정 기록과 남은 문제

idle_a  idle_b  idle_c
windup  move    attack
recover hit     dead
```

기본18색 상한, alpha0/255, 1px 투명 테두리, 최하단 y=cell−4, grounded idle 접지,
9개의 서로 다른 RGBA를 검사한다. 원본 픽셀 생성/수정 도구는 없다. 격자→native PNG→
시트 패킹→PNG 다시 디코드 대조만 한다. nearest 확대·체커·라벨은 검토 그림 전용이다.

직접 저작은 `pixel-dot-authoring` 계약을 따른다. 원/다각형/공식으로 몸통/명암 합성,
전체 프레임 이동/회전/보간으로 자세 생성은 금지다. **격자·색·중복 검사만으로 직접 저작,
좋은 그림, 자연스러운 동작을 증명하지 않는다.** 저작 지시·출처·기록과 시각 검수가 필요하다.

원본 격자·팔레트·종 제작 계약은 phase binding에 들어간다. 한 바이트 바뀌면 해당 선택은
stale이 된다. 검수는 binding과 첨부 PNG 해시까지 맞아야 유효하다. palette/idle_a가
바뀌면 기본 자세부터 다시 선택한다. 시드를 바꾼 경우 기존 brief를 고치지 않고 새 후보로 간다.

## 보존·패킹·설치

| 위치 | 역할 |
|---|---|
| `harness-data/battle-monster/seed.json` | 사람이 쓰는 시드 |
| `harness-data/battle-monster/ledger.json` | 사용자 선택, 최초 빈 목록 |
| `qa-runs/harnesses/battle-monster/<종>/<후보>/` | 원본/고정 brief/출처/작업/검사/검수, gitignored |
| `qa-runs/harnesses/battle-monster/packs/` | 선택 팩, gitignored |

`--root /absolute/path`는 실험 후보와 ledger까지 분리한다. 다른 seed/모델은 새 root를 쓴다.
기존 ASCII 원본은 `ingest --monster ID --candidate NEW --source /grid/folder --palette
/palette.json [--phase poses]`로 가져온다.

```bash
npm run harness -- battle-monster pack --monster wild-boar --candidate revision-b
```

기본 자세/9자세 **둘 다 현재 사용자 keep + 독립 검수 + 기술 검사**가 있어야 팩으로 나온다.
ZIP은 native 시트·idle_a 초상·sheets.json·원본·지시/작업 메타·검토 PNG·검수·선택을 담는다.
파일을 덮어쓰지 않으며 ZIP을 다시 읽는다. 원본 저작 코드/참고 라이선스가 별도로 있으면
`source/`에 함께 보존한다. 기존 시범 후보의 저작 기록은 provenance의 priorAuthorReview가
커밋된 원본 기록을 가리킨다.

설치는 별도다. 소유 공용 팩의 bundled/catalog에 등록하고 resourceId와 기존 저자 수정을
보존한다. 실제 enemy/action/skill 레코드, 돌격·접촉·발사체·HP/상태·보상은 player에서
별도 검증한다. **자세 순서 재생은 전투 영상이 아니다.** 정본 설치 후 SQLite 서비스 API
저장→같은 대상 재로드 의무가 유지된다.
