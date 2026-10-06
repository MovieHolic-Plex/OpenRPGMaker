# RM2003 전투 몬스터 도트 하네스

일반 JRPG 적의 **native64/96/128 원본과 3×3의 9개 자세**를 제작한다. 입구는
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

### 바람·무협 인간형 확장 (2026-10-05)

새 검객 eyes-right-v4의 얼굴/눈·성인3등신·옷 주름을 시각 기준으로 인간형을 확장한다.
기존 인간형5종은 빈 source의 새 baram-wuxia-v1 후보로 다시 저작하며 기존 선택/원본은 유지한다.
여성 청운 검희·비연 자객·홍련 무녀·백발 여도사와 상급 금갑무장·여성 백의검선을 추가한다.
검객을 포함한12종이고, 각 신규 후보는18자세/8GIF를 독립적으로 검사·검수한 뒤 게시한다.
공식 바람의나라:연 직업 그림은 복식/무기 어휘를 관찰한 연구 자료다. 참고 이미지 픽셀을
추출하지 않고 source에는 직접 고른 리터럴 격자만 둔다. 참고 이미지 바이트는 커밋/팩에 넣지 않는다.

`wave --note '...'` 또는 `--note-file <UTF-8 파일>`은 웨이브 공통 아트 지시를 전달한다.
두 옵션은 함께 사용할 수 없다. 기술 재수정 때도 원래 지시를 함께 유지하며 미감 재작업을
자동으로 하지 않는다. seed의 기존 종/전역 style은 수정하지 않고 새 종만 덧붙여 기존 binding을 보존한다.
각 작가의 palette/idle_a 체크포인트는 저작 중 전후 PNG로 보여줄 수 있으나 실제 사용자 선택/게시와
구별한다. 새 후보의 Allow를 만드는 근거는 사용자 대시보드 선택뿐이다.
첫 묶음3종의 baram-wuxia-v2는 실제 그림에서 확인한 복식/도구/자세의 한정 보완판이다.
원안과 검수 의견을 보존하고 별도 아트 지시로 저작·검수한다. 검수 추천에 따른 자동 반복이나
사람의 Modify로 기록하지 않는다. 검희는 발도/수면3자세 외15자세와 팔레트를 그대로 유지한다.
백의 검선 v2는 쓰러짐 목/옷깃의 투명2픽셀만 보완하고 다른17자세·팔레트를 보존한다.
대시보드의 작업 수에는 `battle-monster-baram-quality-wave/tasks`의 대기/진행도 포함한다.
흑건 자객 v2는 실제 떠 있는 공격 손/팔 연결과 기절 때 사라진 복면, 대기 단검/결인 손을
7자세에서 보완하며 다른11자세·팔레트는 보존한다. 검수 의견 전체를 자동 재시도하지 않는다.
사교 술사 v2는 준비 기술의 옷2픽셀과 쓰러짐 목2픽셀만 보완하고 다른16자세·팔레트를 보존한다.
`bounded-quality-repair`가 실제 현재 독립 검수까지 끝나면 미선택 부모 원안은 검토 대기에서
지난 결과로 옮겨 표시한다. 원본/판정은 유지하며 새 Allow/Modify/Deny를 기록하지 않는다.
실제 선택된 부모는 Allow에 그대로 남는다. 원안 딥 링크와 전후8동작 비교도 유지한다.
스냅샷 캐시는 source/brief뿐 아니라 provenance/critique 변경도 반영한다.

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

### 화려한 요괴·대형 보스 (2026-10-06)

별도 `ornate-boss-v1`의 홍련 구미호·뇌운 해태·연화 화귀는 native96,
금갑 도깨비왕·청린 이무기·산군 백호는 native128을 쓴다. 방향은
`harness-data/battle-monster/ORNATE-BOSSES-DIRECTION.md`에 보존한다.
기존 종/전역 style/선택은 유지한다. 별도 폴더에서 원본 몸체를 크게 직접 찍고
각18자세/8GIF를 만든다. 대표 구미호를 먼저 실제로 본 뒤 나머지를 제작한다.
그림 확대·자동 꼬리/비늘/줄무늬·미감 점수 재시도로 저작을 대신하지 않는다.

크기 허용값에128을 추가한다. 테두리/접지/PNG·GIF 재읽기는 기존 `cell`을
따르며 기술 오류 재수정 지시의 바닥도 `cell-4`다. 원본/시간표/실제 모델 및
독립 검수 출처를 저장하고 동일 binding으로 다시 읽는다. 실제 사용자의
Allow/Modify/Deny를 AI가 만들거나 기존 인간형 선택에서 이관하지 않는다.
대시보드의 제작 수에는 `battle-monster-ornate-boss-wave/tasks`를 포함한다.

큰 결과의 크기 비교는 현재 검토 가능한64px 인간형 또는 실제 활성 Allow
인간형의 실제 시트 첫 칸을 사용한다. 몸과 발의 상대 비율을 하나의 canvas에
동일2배/하단으로 정렬하므로 좁은 화면에서 canvas 전체가 줄어도 상대 크기는 같다.
원본 시트/기존 선택을 고치지 않으며 인간형 참고가 없으면 비교칸을 숨긴다.
선택이 비동기 이미지 로딩 중 바뀌면 이전 비교가 새 결과를 덮어쓰지 않는다.
8동작 GIF는 별도 타일로 모두 보이고 일시 정지/재생 계약을 유지한다.

백호의 최신 검토 후보는 `ornate-boss-stripes-v2`다. 짧은 반점 대신 굽은 털 줄무늬를
직접 고른2179픽셀에만 저작한 별도 AI 교정이며 사용자 Modify를 만들지 않았다.
팔레트·18자세 alpha 윤곽·생산 시간표는 원본과 같고 원본 v1도 출처에 보존한다.
대기 중인 부모는 기존 `reviewSupersededBy` 계약으로 이전 결과에 남으며 자식만 새로 검토한다.
실제 사용자 Allow/Deny는 그대로 유지한다. 상세 근거는
`verify-shots/battle-monster-ornate-bosses/stripe-scope-proof.json`에 있다.

## 새 후보 저작

### 사용자가 명시한 일괄 통과 (2026-10-06)

사용자 목표 「그래 한 50개 만들고 전부 통과시켜」의 신규50종은
`harness-data/battle-monster/fifty-monsters-plan.json`과 `FIFTY-MONSTERS-DIRECTION.md`에 고정한다.
짐승10·요괴16·인간형12·대형 보스12이며 기존23종/판정은 보존한다.
원본64/96/128, 각18자세·8GIF로 전체900자세·400GIF를 목표로 한다.

기본 `wave`의 미감 재작업 금지는 그대로다. 이번처럼 사용자가 모든 결과의 통과를 명시했을 때만
`--visual-repairs 4 --visual-repair-authorization <사용자 원문 파일>`을 쓴다.
실제 현재 독립 검수의 rework 좌표를 작가에게 전달하며 원본/검수 PNG/결과/교정 지시를
`visual-repairs/<회차>/`에 보존한다. 실제 새 원본으로 별도 검수를 받아 keep일 때만 게시한다.
원본이 그대로이거나, 검수가 stale이거나, 교정 제한을 넘으면 실패로 남긴다.
판정 파일을 바꾸거나 검수 결과를 keep로 해석해서 통과시키지 않는다.
금각사슴·청동종귀·일금봉황의 실제 원본을 기준으로 이어간다. 먼저 keep/Allow까지 확인된64/96
규격으로 사마귀·초롱도깨비2종을 빈 작가 자리에 먼저 투입했다. 추가128 보스는 봉황 검토 뒤 시작한다.
세 대표 확인 뒤45종을 이어가며, 초기 추가2종과 겹치는 동안 후속 작가1명/이후3명으로 동시 최대3명을 유지한다.

`accept-batch`는 일반 화면의 자동 선택 기능이 아니다. 현재 사용자 목표의 명시적 위임과
종 목록/원문 파일을 받고, 현재 원본의 픽셀 PASS/실제 시각 keep/대시보드 binding을 읽기 전용으로
확인한 뒤 표준 `/api/decision`에 Allow를 요청한다. notes에 사용자 원문과 위임을 남긴다.
서버도 고정된 현재50종 계획/원문/계획 해시와 현재 실제 keep를 검증한다.
요청과 ledger의 `by: user-delegated-goal`/`delegatedGoal`로 직접 클릭과 위임을 구별한다.
실제 사용자가 마우스로50번 눌렀다고 주장하지 않는다. 기존 다른 종이나 이후 사용자
Deny/Modify는 변경하지 않는다. UUID는 plan/key/binding으로 고정해 재시도 시 중복 판정을 막는다.
대시보드가 기존 요청 journal/ledger를 저장하고 선택 팩을 만든다.
Allow/Deny의 원문/위임 정보는 journal/ledger에 보관한다. 결과 화면의 수정 요청 칸은
현재 Modify와 수정 후보의 교정 지시를 표시하고, Allow/Deny 결과에서는 숨긴다.

```bash
npm run harness -- battle-monster accept-batch \
  --plan harness-data/battle-monster/fifty-monsters-plan.json \
  --authorization qa-runs/battle-monster-fifty-wave/authorization.txt \
  --out qa-runs/battle-monster-fifty-wave/delegated-allow.json
```

실제 제작 수에는 `battle-monster-fifty-wave/tasks`를 포함한다. 원본/독립 검수/현재 선택/팩 재읽기로
전체50종을 확인하기 전까지 목표 완료로 보고하지 않는다.

50종 중간 지시를 받는 동안 `wave --note-file`은 새 종의 작가와 기술/시각 교정 호출을
시작할 때마다 최신 파일을 읽는다. 이미 실행한 호출/그림은 보존하고 실제 다음 job prompt에
새 방향이 남는다. 독립 검수의 판정은 이 방향 갱신으로 바꾸지 않는다.

빈 세 번째 자리에 여성 검객 홍영검희를 별도 `battle-monster-fifty-human-wave`에서 먼저
제작한다. 기존 안개삵 wave는 그대로 실행하고, 이전 배차 parent만 다음 호출 경계에서 기다린다.
기존 wave의 실제 PID/시작 식별자가 종료된 뒤 같은 후속 서비스의 배차기를 바꾼다. 후속은
초기/여성 작업의 실제 producer MainPID·진행 상태와 live model PID를 함께 세어 남는1/2/3개
자리만 쓴다. 외부 작업이 끝나면 나머지를3명 풀로 이어간다.50종/합격 기준은 동일하다.
후속의 실제 지적 교정은 최대8번이며 초기4번 제한에 닿은 후보도 같은 보존 원본/count에서
이어간다. 매번 새 검수 keep가 필요하고8번 후에도 rework이면 미게시 실패로 남는다.

현재50종 작업의 임시 `oprn-battle-fifty-observer-20261006` 실행기는 게시된 현재 keep를 읽고
기존 `accept-batch`/`audit-batch` 단계와 실제 브라우저 캡처·출처 재로드를 이어간다. 원본을 그리거나
검수를 만들지 않으며, API의 기존 Deny/Modify 보호를 그대로 사용한다. 부분 audit exit1은 전체
미완료이고 팩이 준비되면 다시 읽는다. 생산 서비스의 실제 MainPID가 끝나면 부족한 종을 남겨
수리 대기로 종료한다.50종 감사/출처/실제 화면 확인이 모여도 최종 그림·저작 코드 감독 검토를
기다리는 상태로 끝나며 목표 완료를 선언하지 않는다. 반복 예약/새 사용자 UI 기능이 아니다.


`audit-batch --plan <계획 JSON> --out <근거 JSON>`은 게시된 각 종의18격자를 읽고 현재 실제 keep,
3단계의 현재 Allow, native 3×6 PNG 각 칸,8GIF의 프레임 픽셀/노출 시간, 현재 요청이 만든
선택 ZIP과 포함된 PNG/GIF를 다시 읽는다. 소스/검수/ledger를 쓰거나 모델을 호출하지 않는다.
정확한 계획 수만큼 모두 통과하고 idle 이미지 중복이 없을 때만 exit0/`passed:true`다.
미게시/미선택/검수 불일치/팩 작업 중이면 그 종의 부족한 근거를 기록하고 전체 exit1이다.
이 확인이 직접 저작/미감/실전 전투를 대신하지는 않는다. 실제 그림과 저작 코드는 감독이 별도로 본다.

현재50종의 감독용 검사 보조 원본은 `verify-shots/battle-monster-fifty/controllers/`에 보존한다.
`capture-fifty-native-contact.py <종 ID...>`는 게시된 실제18개 PNG와 ASCII/팔레트의 RGBA를
대조한 뒤1배/최근접2배를6열3행으로 배치한다.96/128px도 긴 변2048px 안에 들어가
이미지 도구의 긴 시트 축소를 피한다. 원본을 고치거나 통과 판정을 만들지 않는다.
`verify-fifty-current-progress.py --out <JSON>`는 현재 감사·저장 출처 해시·실제 감독 기록·
현재 선택 binding·8GIF/정지/재생/375/320px 브라우저 근거와 기존 판정/선택 보존을 다시 읽는다.
부분 합격 수는 전체50 완료와 구별하며 원본 그림과 쓰기 함수의 실제 감독 열람은 여전히 필요하다.

시드 `harness-data/battle-monster/seed.json`은 사람이 쓴다. 다른 분위기는 같은 형식의
`--seed /absolute/seed.json`을 쓴다. 종 ID/resourceId, cell(64/96/128), grounded, motion,
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
source/poses/<pose>.pxgrid     native64/96/128의 정확한 리터럴 행 문자열
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
