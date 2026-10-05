# RM2003 전투 몬스터 도트 하네스

일반 JRPG 적의 **native64/96 원본과 3×3의 9개 자세**를 제작한다. 입구는
`src/harnesses/battle-monster/`, 실행기는 `node/pipeline.py`다. Python 3와 Pillow,
실제 모델 저작/검수에는 로그인된 `codex` CLI가 필요하다.

## 사용자 결과 대시보드 (2026-10-05)

사용자는 **그림·움직임과 Allow / Modify / Deny**만 다룬다. 제작 단계·격자·픽셀 검사·검수
좌표·해시·CLI는 AI의 작업 정보다. 기존 `review` 정적 페이지는 AI/개발자 진단용으로 유지한다.
사용자에게 보내는 주소는 `serve`가 제공하는 실제 대시보드다.

```bash
npm run harness -- battle-monster serve --host 0.0.0.0 --port 18346
```

현재 작업 서버: `http://100.73.251.77:18346/`.
서비스 `oprn-battle-monster-dashboard.service`는 Python 서버와 AI 자식 프로세스를 같은
systemd 제어 그룹에서 관리한다. 서버/작업 파일은 `node/dashboard.py`, 화면은
`node/dashboard.html`·`dashboard.css`·`dashboard.js`다. 에디터 공방에 임베드한 화면은 아니다.

- **Allow:** 보이는 결과의 선택을 즉시 저장하고 다음 후보로 간다. 전체 9자세를 보고 Allow하면
  같은 그림의 기본 자세와 전체 자세를 함께 선택한다. AI는 필요한 독립 검수와 패킹을 뒤에서
  마무리하고, 완료 시 Allow 목록에 「선택한 결과 받기」를 제공한다.
- **Modify:** 수정 내용을 적으면 원본/이전 선택을 남기고 새 `rev-…` 후보에서 AI가 기본·스킬·상태이상의 **18자세 전체**를
  수정한다. 검사·독립 검수 후 새 후보를 검토 대기에 넣는다. 이전/새 그림을 나란히 본다.
  수정본은 다시 사람의 Allow가 필요하다. 수정 원본과 같은 픽셀이면 완료로 내놓지 않는다.
  모델 호출은 성공했지만 격자·접지 같은 형식 검사가 실패하면 원본을 보존하고 최대 두 번
  같은 모델에 기술 오류만 고치도록 요청한다. 미감 평가로 자동 재작업하거나 선택하지 않는다.
- **Deny:** 검토 목록에서 제외한다. 지난 결과에서 다시 보거나 선택을 바꿀 수 있다.

대기·공격·피격·쓰러짐·스킬·독·기절·수면 **8칸의 실제 GIF**를 동시에 보여 준다.
`node/motions.py`는 원본 도트 색을 그대로 GIF 팔레트에 넣고 노출 시간을 설정한다.
각 프레임을 다시 읽어 원본 RGBA와 일치하는지 확인한다. 확대·보간으로 동작을 생성하지 않는다.
전체 일시 정지는 정지 PNG로 바꾸고 재생은 GIF로 돌아간다. 수정본은 동작별 이전/수정 후를
나란히 보여 준다. 없는 동작은 명시하고 다른 공격이나 색 변환으로 대신하지 않는다.
A/M/D 단축키와 작은 화면의 두 열 배치를 유지한다.

### AI 제작 웨이브 · 인간형 적 (2026-10-05)

기본 RM2003 3×3의 9자세 계약은 유지한다. 별도 `source/actions/`에
`skill_a/b/c`, `poison_a/b`, `stun_a/b`, `sleep_a/b`의 **9개 직접 저작 자세**를 둔다.
`check/critique --phase suite`는 총 18자세를 검사·검수하며 `author --phase complete`는
모두 저작한다. `author --phase actions`는 기본 9자세/팔레트를 보존하고 추가 동작만 만든다.
새 인간형 6종은 산적 칼잡이·산채 창수·흑건 자객·방랑 검객·타락 도사·사교 술사다.

```bash
npm run harness -- battle-monster wave --work qa-runs/battle-monster-human-wave --workers 3 \
  mountain-bandit mountain-spearman black-cloth-assassin wandering-swordsman fallen-taoist cult-sorcerer
npm run harness -- battle-monster wave --work qa-runs/battle-monster-extra-motion-wave --workers 2 \
  --actions --candidate motions-v2 wild-boar venom-toad jangseung-spirit earthen-jar-fiend
```

각 작업자는 격리된 후보 폴더만 편집한다. 기존 선택과 정본 프로젝트를 건드리지 않는다.
웨이브의 durable task 기록과 후보 잠금을 쓰고, 형식 오류는 원본 보존 후 최대 두 번 기술 수정한다.
검사와 실제 독립 시각 검수, GIF 재읽기가 끝나면 같은 파일시스템에서 후보 폴더를 원자적으로
대시보드 root로 옮긴다. 제작 중인 절반 결과는 게시하지 않는다. AI 검수 추천은 사람 선택이 아니다.
기존 Allow 결과의 추가 동작은 새 `motions-v2` 후보로 돌아온다. Deny한 방아토끼는 이번 웨이브에 넣지 않는다.
완성 후보의 Allow는 suite·poses·idle을 모두 현재 원본에 묶고 팩도 모든 현재 선택/검수를 요구한다.
전체 suite의 실제 독립 검수가 현재 해시와 맞으면, 동일한 원본 파일 해시를 가지는 poses·idle도
그 검수로 포함할 수 있다. 검수 결과를 꾸며 복제하지 않는다. 팩의 `review-coverage.json`에 실제
검수 phase/jobId/binding과 포함한 원본 해시를 남긴다. 추가 동작이나 팔레트가 바뀌면 이 포함 관계도
무효다. 이미 검수한 전체 후보를 포장하기 위해 같은 그림을 세 차례 모델에 보내지 않는다.
팩에 원본·GIF·PNG·시간표와 검수 출처를 포함한다. 기본 `pilot`은 실제 시드 원본이 있는 종만 가져온다.
완성 격자·팔레트·시간표·독립 검수 출처는 `harness-data/battle-monster/authored/20261005/`에도 보존한다.
`ingest --phase suite --source .../source/poses --palette .../source/palette.json`은 같은 원본의 추가
`source/actions`도 함께 가져온다. 복원은 예전 사람 선택을 가져오지 않는다.
이 단계는 검토 후보를 제작한다. 선택·설치와 실제 전투 스킬/상태 적용은 별도다.

### 저장·작업 재개 계약

`qa-runs/harnesses/battle-monster/dashboard/requests/<uuid>.json`이 요청과 작업의 지속 기록이다.
요청을 먼저 `recording`으로 저장 → 같은 requestId의 ledger 행을 한 번만 추가 → queued/done.
서버 재시작 시 중단된 recording/running을 복원한다. 워커 하나가 순서대로 처리하고 모델 호출은
격리된 후보 폴더에서 수행한다. `--pause-worker`는 진단용으로 요청을 저장하고 실행을 보류한다.
서버/후보/ledger 잠금, 요청 중복 방지, 현재 그림 및 선택 버전 확인을 적용한다.

사용자의 Allow는 검수 모델의 추천보다 먼저 저장될 수 있다. AI 검수 결과로 사람 선택을
뒤집지 않는다. **팩 생성은 여전히 현재 픽셀 검사·현재 독립 검수·현재 사람 선택을 모두 확인**한다.
기술 실패/모델 호출 실패 시 선택은 남고, 화면은 작업 실패를 알려 다시 Modify할 수 있게 한다.
수정본을 AI가 스스로 Allow하지 않는다. 다운로드도 현재 Allow·현재 그림이 맞아야 한다.
선택과 파일 준비는 별도 상태다. Allow/Deny를 먼저 화면과 ledger에 반영하고, 포장 중에도
Modify/Deny로 바꿀 수 있다. 새 선택은 이전 요청을 superseded/cancelled로 기록하며, 워커가
이전 요청을 마쳐도 새 선택을 덮어쓰지 않는다. 재시작 때도 오래된 요청을 취소한다.
대시보드 Allow에는 실제 ledger 사건을 재생한 종별 현재 버전 하나를 표시한다.
현재 버전의 Deny/Modify가 이전 Allow를 자동 복귀시키지 않으며, 경쟁 후보를 Deny한 경우는
현재 선택을 보존한다. 과거 Allow 버전은
지난 결과에, Deny는 별도 제외 목록에 남는다. `/api/state.selection`은 현재 선택의 투영이며,
원본 선택 기록을 삭제하지 않는다. 파일 준비 실패가 선택을 철회하지 않는다.
idle Allow의 추가 동작은 별도 child 후보로 만들고, 선택된 palette/idle은 보존한다.
수정 중인 후보의 작업 잠금이 부모의 선택 입력을 막아서는 안 된다. 선택 시 현재 원본 해시는
읽기 전용으로 다시 확인한다. 브라우저의 목록 탭은 새로고침 후에도 유지되고 UI 버전이 바뀌면
수정 창이 닫힌 뒤 갱신한다.
같은 root로 서버 두 개를 띄우지 않으며, 기존 서비스의 실행 중 작업을 중단할 때는 해당
프로세스 그룹까지 함께 종료해야 중복 AI 실행을 피할 수 있다.

HTTP는 결과/선택/다운로드만 노출한다. 작업 디렉터리를 정적 파일 서버로 공개하지 않는다.
POST는 세션 토큰과 같은 출처를 확인하고 입력 크기를 제한한다. `--root`는 대시보드 요청,
ledger, 후보, 팩까지 격리하므로 브라우저 QA는 별도 root에서 한다.

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
이 정적 진단 화면은 읽기 전용이다. 사용자는 위 `serve` 대시보드에서 직접 선택한다.
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
참고가 필요하면 후보의 `reference.png`와 `references/*.png`를 실제로 보고 저작하도록 첨부한다.
idle에도 첨부할 수 있다. `references/`는 연구용이며 팩에 포함하지 않는다. 원저자 URL·관찰 내용·
이미지 해시는 별도 `reference-study.json`에 남기고, 참고 이미지를 추출/트레이싱하지 않는다.
후보 `provenance.displayName`은 선택 화면에서 아트 방향 이름을 표시하며 child 수정/동작 확장에도
이어진다. 제작 brief/resourceId나 이미 저장된 그림 선택의 binding을 바꾸지 않는 표시 정보다.
기본 자세(phase idle)는 대기 그림만 보여 주고, Allow를 「이 그림으로 동작 만들기」로 안내한다.
아직 저작하지 않은 공격/스킬 GIF를 빈 칸 일곱 개로 늘어놓지 않는다.
기본 자세의64px 그림은 데스크톱에서256px로 확대해 얼굴을 검토하게 한다. 작은 화면에서는
컨테이너 폭 안으로 줄어들며 원본 자산의 셀 크기와 픽셀은 바뀌지 않는다.

64×64라는 캔버스 계약만으로 사람 체형이 좋아지지 않는다. 인간형 새 스타일은 대표 한 명의
실제 얼굴·어깨·팔꿈치·손·무기·접지를 확인한 뒤 확장한다. 기존 Allow/Deny를 새 후보에 이관하지 않는다.
사용자의 검객 전면 폐기 요청으로 이전 7후보(motions-v1/reference-v3/silhouette-*/eyes-*)는
활성 root와 커밋된 저작 후보에서 제거했다. 당시 선택 원문/판정은 ledger에 남기고 다른 종의
선택은 보존했다. 새 fresh-gat-v1은 빈 source에서 시작한 별도 기본 자세이며 parent가 없다.
검객 seed의 외형도 갓·회청 도포·검푸른 쾌자·붉은 띠·넓은 3/4 얼굴로 새로 잡았다.
폐기한 원본을 새 작가의 참고·뼈대나 승인된 기준작으로 재사용하지 않는다.
이 새 원안의 palette/idle_a를 그대로 고정한 fresh-gat-complete-v1은 직접 저작한18자세를
8개 GIF로 한 번에 제시한다. 빈 원안부터 완성 후보를 제작하는 경로이며 기본 자세에 사용자
keep를 만들어 넣지 않는다. 기본 자세가 아직 검토 대기이면 완성 후보 하나로 대체하고
저작 원본/실제 검수 기록은 보존한다. 기본 자세에 들어온 실제 Deny/Modify는 이어서 반영한다.
완성 후보도 검토 대기에 남고, 기존 다른 종의 선택은 이관하거나 초기화하지 않는다.
이어진 눈 위치 수정 요청은 현재 새 검객에 실제 rework로 기록하고 fresh-eyes-v2에서
눈·눈썹 띠만 교정한다. 띠 밖 픽셀/팔레트/alpha footprint는 부모와 동일하며18자세의
표정·닫힌 눈을 보존한다. 대시보드8칸에서 이전/수정 후16GIF를 비교하고 사람이 다시 선택한다.
삭제된 eyes-v4를 복구하거나 옛 Allow를 새 눈 수정에 이관하지 않는다.
「좀 더 눈을 오른쪽으로 옮겨라」 요청의 eyes-right-v3은 fresh-eyes-v2의 두 눈을
화면 오른쪽으로 native1픽셀 옮긴다. 자세별 명시 좌표/문자열은 chosen-eye-runs.json에
남기며 닫힌 눈·시선·크기를 유지한다. 현재 검수/원본을 새 binding에 묶고 같은8GIF의
전후 비교를 보여 준다. 기존 선택8종과 부모의 실제 Modify 원문을 보존한다.
연속 요청 「1px 더 이동해봐」의 eyes-right-v4는 화면의 eyes-right-v3을 부모로
18자세를1픽셀 더 옮긴 별도 검토 후보다. 각 수정의 실제 원문과 원본/검수를 보존하며
가장 최근 후보의8GIF를 직전 부모와 비교한다. 사람의 Allow는 새 후보에 이관하지 않는다.
`author idle`은 기본 자세만 만든다. `author poses`는 현재 기본 자세의 사용자 keep가
필요하고, 선택한 palette/idle_a를 바꿀 수 없다. 나머지 8자세를 직접 찍는다.

후보마다 별도의 아트 작업 폴더를 사용하며 같은 후보 작업은 파일 잠금으로 겹치지 않는다.
게임 정본·에디터 코드·다른 후보를 쓰지 않는다. 여러 코딩 에이전트의 체크아웃은 기존 격리
워크트리 규칙을 따른다. `serve`는 대시보드에서 받은 작업을 백그라운드 워커로 처리한다.
`author --phase full`은 사람에게 한 번에 제시할 완성 9자세를 만든다. 아래 idle/poses CLI
선택 흐름은 AI가 단계별 작업을 하는 경우에만 사용한다.

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
모델 CLI의 sandbox는 `workspace-write`로 명시한다. Git 밖의 후보/검수 폴더에서도
저작자는 해당 후보의 source만, 검수자는 자기 job의 result.json만 쓰도록 지시한다.
검수 CLI가 exit 0이어도 실제 result.json이 없으면 유효한 검수로 기록하지 않는다.
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
