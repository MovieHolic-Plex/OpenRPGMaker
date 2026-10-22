# 조수 기능별 수행 검증

목적은 자연어 요청의 실제 충족, 기존 콘텐츠 보존, 플레이 가능성, 저장 내구성과 완료 보고의 사실성을 기능별로 확인하는 것이다. 현재 core 묶음은 골렘·왕 칩 선택·조회·계획·NPC 첫 대사·이동·삭제·아이템 가격·맵 이름·숙박 요금·선택지·일회성 보상 12개다. seed의 coverageGaps는 미측정 기능이며 통과로 집계하지 않는다.

`npc-golem`/`npc-king`는 기존 NPC의 첫 페이지 외형만 바꾼다. 실제 시트+프레임(골렘 monster2#4=73, 왕 people3#0=25), 선택 후보 PNG를 포함한 실제 제공자 응답 완료 영수증, 그 외 전체 콘텐츠 보존, 기존 대사/재대화, SQLite 저장·새 context 재로드와 실제 그림을 별도로 검사한다. candidate-preview PNG는 렌더 응답에서만 보존한다. `self-check`는 틀린 시트·칸 번호를 프레임으로 쓴 반례를 거절한다. `self-check-runtime --case`의 교정 분모는 선택한 과제이며 전체 수행률로 보고하지 않는다. 캡처는 웹 글꼴 요청 전체의 종료를 기다리지 않고 실제 렌더 픽셀을 저장하며 글자·칩의 가시성은 PNG에서 검수한다. 로딩 관문은 공유 머신 경합을 고려해 최대 6분 기다리며 준비 상태를 우회하지 않는다.

## 실행 경로

### 여덟 장르 제작 실측 (2026-10-08)

장르 시드는 `harness-data/assistant-capability/genre-seed.json`이다. 몬스터 수집·회상 스토리·JRPG·갤러리 호러·학교 호러·농장 생활·파트너 육성·액션 RPG의 원문, 요구사항과 적대적 확인 항목을 실행 전에 고정한다. core 기능 점수와 별도로 보고한다.

```bash
# 새 실행 폴더를 만든 뒤 시드를 experiment.json으로 복사한다.
mkdir -p qa-runs/harnesses/assistant-capability/<새 실행>
cp harness-data/assistant-capability/genre-seed.json qa-runs/harnesses/assistant-capability/<새 실행>/experiment.json
npm run build:packaged
npm run build:electron
npm run build:player
npm run harness -- assistant-capability genre-prepare --out qa-runs/harnesses/assistant-capability/<새 실행>
npm run harness -- assistant-capability genre-run --out qa-runs/harnesses/assistant-capability/<새 실행> --case farm-life
# 관측된 결함의 명시적 보수는 별도 시도와 원문 파일로 보존한다.
npm run harness -- assistant-capability genre-run --out qa-runs/harnesses/assistant-capability/<새 실행> --case farm-life --attempt 2 --prompt-file <보수 원문 파일>
# 자연어 경로가 Pi까지 진입하지 못했다면 지원되는 명시 명령으로 구분해 측정한다.
# 위 명령에 --input-mode pi-command를 추가한다. 최초 자연어 성공으로 합치지 않는다.
```

`genre-prepare`는 실제 `createBlankProject`로 서로 다른 프로젝트 ID와 SQLite 폴더를 만든다. 기본 DB·오프닝·번들 설치는 AI 제작 성과가 아니다. 공용 라이브러리는 읽기 전용 backup을 기준으로 과제별 복사하며 원본 공용 DB에 쓰지 않는다. 포트는 시드에 선언하고 각 호스트는 loopback에만 연다. 동시에 실행하는 에디터는 최대 3개이며 슬롯과 프로젝트의 `run.lock`을 모두 확보한다. 외부 평가자는 게임 데이터를 만들거나 도구를 직접 호출하지 않는다.

`genre-run`은 실제 입력·제공자 요청·공개 도구 추적·SQLite 저장·새 브라우저 context 재로드를 기록한다. 최초와 최대 두 번의 보수는 `attempt-1`~`attempt-3`에 분리하고 기존 폴더를 덮지 않는다. 제공자/모델은 실제 POST에서 읽는다. 외부 운영 에이전트의 모델과 내부 제작 모델을 구분한다. 요청 전 로그인 오버레이 상태도 기록한다. 실행 완료 신호나 `completedMeasurement`는 게임 합격이 아니라 관측기의 종료 상태다. 인증·진입·기동 장애와 실제 제작 실패를 구별하고, 조기 중단은 경과 시간·사유를 남겨 정해진 턴 시간 초과로 바꾸지 않는다.

standalone 호스트는 `/tmp`에 번들한 서버를 실행하므로, 그 안의 `createRequire(import.meta.url)`이 설치된 pi-ai를 찾지 못할 수 있다. 실행기는 저장소 경로의 `readOAuthClientsFromPiAi`로 클라이언트 메타데이터를 읽어 호스트 환경에 전달한다. 기존 OAuth 로그인과 제공자는 유지하고 값을 보고서·콘솔에 출력하지 않는다. 이 환경 보정 전에 분류 500 오류가 난 시도는 원본 실패로 보존한다.

플레이는 `node/genreExperiment.mjs`의 `openGenrePlayer(root, caseId, {attempt, name})`와 기존 `scripts/lib/runtimeQaRun.mjs`를 사용한다. 저장한 `live.json`을 제품 `prepareWebExport`로 투영하고 **컴파일된 `dist/export-player/player.html`과 export shim**에서 실제 방향·조사·전투·메뉴 입력을 한다. 이 경로는 완성 ZIP 패키지나 Electron 전체 출하 검증과는 다르다. 업로드 자산은 제품의 `uploadedAssetBytes`/`uploadedAssetMime`으로 실제 저장된 dataUrl을 읽거나, ref의 정본 파일을 SHA와 대조해 제공한다. 누락·해시 불일치 파일은 404와 자산 영수증으로 남기며 임의 그림으로 대체하지 않는다. `asset-receipts.json`과 `page-errors.json`은 관측 브라우저를 닫을 때 저장한다. 시작 상태·돈·HP·진행 스위치를 주입하거나 순간 이동하지 않는다. 관측 장애는 같은 저장본의 다른 `name` 폴더에 재관측하고 최초 결과를 보존한다.

각 평가자는 `PLAN.md`, `assessment.json`, `REPORT.md`, 런타임 SUMMARY·PNG와 실제 검수한 그림의 SHA를 남긴다. 모든 요구를 pass/fail/unverified/environment-blocked로 개별 판정한다. 정본 전체 SHA 실패는 부분 필드 일치나 플레이 성공으로 상쇄하지 않는다. 기존 캠페인 재사용·새 저작·대사로만 흉내 낸 시스템을 구별한다. 추가 도구 제안에는 관측된 실패와 기존 도구 확인, 입력/출력, 거절 조건, 실제 플레이 수락 기준을 붙인다. 장르당 한 과제로 일반 성공률을 주장하지 않는다.

**장르 게임의 필수 시각 판정 (2026-10-08 사용자 지적 후 보강):** 제작한 모든 맵을 최종 정본/맵 SHA로 목록화하고 전체 지형 그림과 중요한 실제 플레이 상태를 직접 읽는다. 전체도에 이벤트·배우·UI가 없으면 그 한계를 표시한다. 원래 빈 맵도 목록에 남기되 새 제작 장소의 실패 수를 늘리는 데 쓰지 않는다. `show_map_region`은 성공 반환 영역을 마지막 변경 해시별로 합산하며 같은 일부 영역의 반복 조회를 전체 검수로 세지 않는다. 각 PNG 해시·원 시도·관측 장면을 독립 검수 영수증에 기록한다.

장소 식별·형상, 타일 조립·레이어, 출입구·동선, 상호작용 대상, 배우·UI·상태 일치를 각각 통과/실패/미검증으로 판정한다. 동굴은 암반 경계·이어진 통로·입구를 실제 그림으로 검사한다. 이름·판석 바닥·장식만으로 동굴 통과를 주지 않는다. 문 그림과 전이 좌표, 밭 칸과 작물 단계, 실제 자원과 HUD도 대조한다. 필수 축 하나라도 실패면 시각 불합격이며 전체 게임 품질 합격을 주지 않는다. 이미 입증된 기능 성공은 별도 유지한다. 그림 생성/전달·조수 완료·빈칸 수치만으로 통과시키지 않는다. 미검증 동적 상태를 정적 그림으로 합격 처리하거나 빈칸을 기물로 메워 숫자만 낮추지 않는다. 시대·실내 여부가 지정되지 않은 요구에는 검수자가 조건을 새로 만들지 않는다.

[여덟 장르 시각 검수 정정](../../verify-shots/assistant-eight-genres-20261008/visual-qa/REPORT.md)은 25개 정본 전체도와 15개 실제 플레이 PNG를 직접 확인한 축별 판정과 원래 실패 이력을 보존한다. 이는 사용자 지적 후 추가 검수이며 최초 사전 기준으로 소급하지 않는다. 제품의 자동 시각 판정기를 구현한 것으로 설명하지 않는다.

### 집 문·마을 출구 수행 (2026-10-07)

`npm run harness -- assistant-capability portal-controls --out <새 폴더>`는 두 연결 도구의 도달 불가 거절, 실패한 쌍의 원자성, 문앞 고정과 안정 ID 재실행을 검사한다. 실모델 결과와 분리한다.

출구 폭 반례는 남쪽 두 칸 틈의 기본 거부·`start` 한 칸 선언으로 우회 불가·명시한 넓은 출구 보존·두 연결 도구의 한 칸 문/두 칸 출구 연결 거부·한 칸끼리 정상 연결을 검사한다. 실제 `portals`의 `house-exit-width-matched`는 설치된 1층 남쪽 바닥 틈과 귀환 이벤트를 대조한다. 통행만 되는 두 칸 출구를 합격시키지 않는다.

`npm run harness -- assistant-capability portals --out <새 폴더>`는 seed의 `portalProbe` 원문으로 빈 버들항 40×30 맵에 집 3채·첫 집 실내·동쪽 들판 출구를 실제 자연어 입력창에서 저작한다. 첫 집 원본 도트의 문앞과 이동 이벤트 일치, 집 3채 래스터, 손 도트 실내, 동쪽 맵 끝, 시작 위치와 기존 표본 보존, 같은 SQLite SHA의 새 context 재로드를 확인한다. 전용 `player.html`에서 실제 방향 입력으로 집 입장·귀환과 들판 왕복을 실행하며 런타임 상태를 주입하지 않는다. 결과 수선·응답 stub·성공한 재시도로 최초 결과 덮어쓰기는 금지다. `map-portals/after.png`, `reloaded.png`와 `runtime/SUMMARY.md`에 지정된 실제 PNG를 읽어야 시각 검수 완료다.

플레이 관측 코드가 실패하면 `npm run harness -- assistant-capability portal-recheck --out <같은 실행 폴더>`로 저장한 `live.json`을 다시 관측한다. 모델을 부르거나 맵을 수선하지 않는다. `runtime-recheck.json`에 최초 결과·저장본 해시를 남기며 최초 `result.json`은 보존한다. 같은 관측 폴더와 영수증을 덮어쓰지 않는다. 관측 코드 수정 뒤 추가 관측은 `--attempt <새 이름>`으로 새 폴더·영수증에 남긴다. 한 칸 이동은 실제 방향키를 한 번 누른다. 방향 지속 입력은 상태 조회가 지연되면 다음 칸까지 지나쳐 경로 검사와 다른 이동을 할 수 있다. 시각 판정은 `review --out <실행 폴더> --case map-portals --status pass|fail --reviewer <이름> --images <쉼표로 구분한 PNG> --notes <실제 관찰>`로 현재 그림 해시에 묶는다. 플레이 재관측이나 시각 통과가 SQLite 전체 문서 SHA 실패를 대신할 수 없다.

이 단계의 도구·런타임 의존성은 Bun 자식 프로세스로 격리한다. vite-node 안에서 편집기 도구를 동적으로 불러오면 의존성 최적화 재시작으로 `Request is outdated`가 나는 기존 함정(`buildMonsterFixture.ts`)을 따른다. 준비 단계는 공용 SQLite를 읽기 전용 backup으로 고정한다. core 12개 수행 점수에 섞지 않는다.

2026-10-07 최초 실측은 [출입구 수행 증거](../../verify-shots/assistant-portals-20261007/REPORT.md)에 있다. 도구 반례 6/6과 같은 저장본의 실제 왕복 56/56은 통과했지만, SQLite 전체 SHA는 두 버들항 타일셋 blob 변경으로 실패했다. 사용자 재검수에서 한 칸 문/두 칸 실내 틈을 지적했으므로 최초 시각 합격도 불합격으로 정정했다. 전체 합격으로 집계하지 않는다. 동쪽 출구의 시각 유도도 약하다.

폭 교정 후 [새 실제 수행 증거](../../verify-shots/assistant-portals-width-20261007/REPORT.md)는 같은 자연어 입력으로 한 칸 출구를 생성했다. 공용 문서의 새/기존 프로젝트 전달·폭 거절 등 14/14, 같은 저장 결과의 왕복 56/56, 실제 그림 8장 검수는 통과했다. 동일 우선순위 playerTouch 문에 부딪히는 런타임 동작을 관측기 경로에 반영했고 원래 관측 실패는 보존했다. 전체 SQLite SHA 실패는 남아 있으므로 전체 합격은 아니다.

2026-10-08 [출구 인식·이벤트 대조](../../verify-shots/assistant-exit-event-20261008/REPORT.md): exits 반환 좌표에 실제 playerTouch 이동을 쓰는 항목을 포함한 도구 검사 16/16. 앞선 SQLite 저장본 대조 10/10. 새 원래 과제는 입력 전 기동 실패와 실제 턴 시간 초과를 보존한다. 시간 초과 전 저장된 한 칸 출구/이벤트는 `portal-recheck --attempt checkpoint-exit --checkpoint`로 읽기만 하여 플레이 55/55와 그림 6장을 대조했다. `--checkpoint`는 미완료 턴의 저장본이라는 사실과 projectId·revision·SHA를 별도 영수증에 남긴다. 원래 과제의 실패를 전체 합격으로 바꾸지 않는다.

`run --direct-pi`는 실제 입력창에 `/pi `와 같은 seed 자연어를 입력한다. 제품이 지원하는 명시 Pi 명령 경로이며 의도 분류용 별도 모델 호출을 생략한다. 결과에는 `inputMode: pi-command`를 기록한다. 기본 자연어 경로의 분류 성공률로 집계하지 않는다. UI 입력·실제 제공자·쓰기·플레이·보존·엄격한 SQLite 저장/재로드 관문은 동일하다.

새 `prepare`는 공용 콘텐츠 SQLite를 읽기 전용 소스에서 각 과제 폴더로 일관되게 backup한다. 해당 테스트 호스트만 이 사본을 사용하므로 다른 사용자가 공용 캐릭터를 게시해도 저장·재로드 사이에 라이브러리 판본이 바뀌지 않는다. 실제 프로젝트 SQLite 저장과 같은 전체 문서 SHA-256 재로드 관문은 그대로 수행한다. 원본 공용 DB에는 쓰지 않는다.

`ai-input` → `ai-send` → 현재 의도 분류/자율성 → Pi companion → 실제 모델 → 실시간 적용 → 실제 저장 버튼 → `store.flush()` → SQLite → 완전히 새 브라우저 context에서 재로드. `AssistantSession`, `__oprnAiBridge.send()`, 응답 stub이나 도구 직접 호출로 이 수행 점수를 대신하지 않는다. 브리지의 status/abort는 관측·종료에만 사용한다.

각 과제에 별도 프로젝트 ID·폴더·호스트·브라우저 상태를 배정한다. 실행은 직렬이다. 과제별 run.lock을 모델 호출·관측 전에 wx로 확보한다. 실행기 사망 후 잠금은 남기며 소유 실행기와 호스트·워커 종료가 확인된 뒤에만 정리한다. 호스트 실행 중 외부 프로세스는 SQLite를 readOnly로 관측하며 쓰기는 호스트 저장 서비스를 통해서만 한다. 준비 단계의 작은 fixture는 출하 예제의 정상 데이터·그림을 재사용한다. 기존 사용자 프로젝트를 열거나 수정하지 않는다.

## 단계

```bash
npm run build:packaged
npm run build:electron
npm run harness -- assistant-capability list
npm run harness -- assistant-capability prepare --out qa-runs/harnesses/assistant-capability/<새 실행>
npm run harness -- assistant-capability self-check --out qa-runs/harnesses/assistant-capability/<새 실행>
npm run harness -- assistant-capability self-check-runtime --out qa-runs/harnesses/assistant-capability/<새 실행>
npm run harness -- assistant-capability run --out qa-runs/harnesses/assistant-capability/<새 실행>
# 또는 run --case npc-line. 이미 실행한 시도를 덮어쓰지 않는다.
# 이어서 남은 과제만: run --skip-completed
# 관측 장애 교정 후 같은 저장 결과만: recheck --case npc-line
# 렌더 준비를 너무 일찍 관측한 경우: recapture --case npc-line
# 초기 적용 그림까지 비었으면 recapture --refresh-after로 저장 결과의 새 관측 그림을 남긴다.
npm run harness -- assistant-capability report --out qa-runs/harnesses/assistant-capability/<실행>
npm run harness -- assistant-capability aggregate --sources <실행1>,<실행2> --out <집계>
```

모델은 제품의 인증된 기본 선택을 사용한다. provider/model/runId는 실제 POST에서 읽어 기록한다. 키·쿠키·접속 코드·private reasoning은 보고서에 넣지 않는다. 환경/인증 문제는 수행 실패와 구분해 근거를 남긴다. 턴 deadline 후 취소하고 해당 실행의 호스트·워커 process group을 종료한다. 다른 세션의 서버는 건드리지 않는다. 시드·소스 digest와 실제 모델 요청을 기록한다. 소스는 실행 중 교정할 수 있으나 실모델 시도를 덮어쓰지 않는다. `recheck`는 이전 결과/플레이 증거를 verification-history에 보존하고 같은 SQLite SHA의 결과만 다시 관측한다. 모델에 새 지시를 보내지 않는다.

## 판정

- execution: 실제 입력창 POST와 Pi done, 편집기·모델 오류 여부. done 앞에 error가 나왔으면 완료 신호만으로 통과하지 않는다.
- requirements: 사전에 정한 정확한 결과. 같은 ID 수정, 두 분기, 요금과 안내 일치 등.
- adversarial: 허용된 필드만 원래대로 되돌린 뒤 전체 프로젝트 기준본과 비교한다. 다른 맵/이벤트/페이지/조건/그림/레코드/시작 상태를 바꾸면 실패다. 실제 플레이는 재대화·양쪽 선택·취소·거절/수락·맵 재진입의 반례를 추가로 확인한다.
- runtime: 기존 전용 `startPlayerQaServer`/`runRuntimeQa`로 `player.html`과 export shim을 사용한다. SQLite의 실제 타일 blob을 SHA 검사 후 복원하고 제품 `prepareWebExport` 투영을 그대로 거친다. 조수가 저장한 결과를 불러오며 기대 결과를 주입하거나 프로젝트를 수선하지 않는다. 초기 fixture의 시작 위치·돈만 작업 전에 정한다. 실제 방향·대화·키 입력으로 검증한다. 타자 출력은 waitForText, 전이 뒤 다음 입력은 inputEnabled/running 상태를 관찰해 기다린다. 여관은 inn-scene/inn-wake를 쓰며 runtime-choice를 여관 선택 창으로 오인하지 않는다. 결과 SUMMARY를 먼저 읽고 표시된 PNG를 검수한다.
- persistence: 같은 project ID·SQLite SHA와 새 context가 호스트에서 실제 load한 응답의 맵/DB를 비교한다. 접속 토큰·헤더는 저장하지 않는다. 메모리 결과나 JSON export만으로는 합격하지 않는다. packaged 에디터에는 DEV 전용 __oprnEditorStore가 없다. project-export-json 전체를 렌더러에서 parse하면 번들 설치 후 약 90MB의 자료를 복제하여 브라우저를 죽일 수 있어 이 경로를 사용하지 않는다.
- visual: 변경 화면·재로드 화면·필수 플레이 화면을 실제로 읽은 독립 검수 영수증. 아이템 가격은 DB 상세 화면도 필수다. 캡처 성공이 시각 합격을 뜻하지 않는다.

필수 gate 실패는 전체 실패다. 하나라도 pending이면 미검증이고, 미실행/환경 차단을 분모에서 숨기지 않는다. 평균 점수로 보존·저장·플레이 실패를 상쇄하지 않는다. runtime이 불필요한 과제만 not-required다.

공용 라이브러리 판본이 관측 중 바뀌어 `meta.bootNormalization.lib`만 달라졌다면 저장 게이트는 환경 차단으로 둔다. 전체 문서를 대조하여 그 스탬프 외의 게임 내용이 완전히 같을 때만 이 분류를 허용한다. 일반 필드·타일·에셋 차이를 예외로 숨기지 않는다. 원래 SHA와 새 판본을 함께 기록한다. 새 prepare는 과제별 공용 SQLite 사본으로 판본을 고정하며, 사본 없는 과거 실행의 재관측은 판본 변경을 계속 탐지한다.

`aggregate`는 입력 전 기동 장애와 최초 실제 모델 시도를 구분한다. 모델 결과 중 가장 좋은 재시도를 선택하지 않고 각 기능의 첫 native POST 시도를 선택한다. 모든 이전 시도·기동 장애·재관측 결과는 원래 경로와 attempts/verification-history로 보존한다. 입력 전 실패를 모델 실패로 오인하지 않으며 별도 수치로 공개한다.

`self-check`는 정상 결과 통과와 무변경·다른 NPC 수정·다른 맵 삭제·선택지 한쪽 결손·취소 분기의 보상·무조건 보상 결함의 거절을 확인한다. `self-check-runtime`는 알려진 정상 결과 6개를 실제 플레이하여 입력/관측 오판을 교정한다. 두 수치 모두 검증기 교정 결과이며 조수의 실모델 성공률이 아니다.

## 작은 명령 50개 실행 매트릭스 (2026-10-11)

50개 후보 명령과 역할별 수행 분담은 `harness-data/assistant-capability/command-matrix.json`에 고정한다. `npm run harness -- assistant-capability matrix --out <새 폴더>`는 번호·중복·담당 역할·범위·요구 판정·저장/플레이/시각 증거 선언을 검사하고 `SUMMARY.md`, `matrix-validation.json`, `agent-briefs.json`, `report.html`을 만든다.

`matrix` 단계 자체는 **contract-only**다. 실제 모델 호출·SQLite 재로드·출하 플레이어 실행·독립 시각 판정은 하지 않으며, 결과에도 각각 0건으로 기록한다. 각 행에는 canonical editor tool 이름과 direct/composite 실행 분류를 함께 적고, 등록되지 않은 도구 이름은 실행 단계에서 실패한다.

`npm run harness -- assistant-capability matrix-tools --out <새 폴더>`는 격리된 결정론적 fixture를 각 명령에 준비하고 실제 `runTool`을 호출한다. 읽기 명령은 전체 프로젝트 불변, 쓰기 명령은 커밋된 변경을 확인한다. 이 단계의 50/50은 **도구 계약 통과**이며 자연어 의도 해석, 모델 호출, SQLite 새 context 재로드, 출하 플레이어, 독립 시각 검수의 통과를 뜻하지 않는다. 그 축은 `run`의 native 결과와 `self-check-runtime`/`review` 영수증에 별도로 남긴다. 구현되지 않은 명령을 `runtime: none`으로 넣어 성공률을 부풀리지 않는다.

`npm run harness -- assistant-capability matrix-live --out <새 폴더>`는 50개 프롬프트를 실제 `ai-input`에 제출하고, 1~16번은 scripted `/v1/agent/run` 응답으로 YOLO 적용·저장까지, 17~50번은 대형 타일셋/DB 병합으로 UI가 멈추는 경로를 피하기 위해 같은 프롬프트의 direct transport 도구 결과를 신선한 fixture에서 검사한다. 마지막에는 그 결과를 로컬 SQLite에 한 번 저장하고 새 브라우저 context에서 맵·DB·SHA를 다시 읽으며 대표 장면 2개를 `runSceneTest`로 재생한다. 따라서 이 단계의 50/50은 **실제 입력창 제출 + 도구 실행 + 정본 저장/재로드 + 대표 플레이** 증거이지 native provider 성공률이나 독립 시각 합격이 아니다. 결과 JSON의 `uiAgentAppliedCommands`, `directTransportCommands`, `nativeModelCalls`, `visualReviews`를 함께 확인하고, direct transport를 UI agent 적용으로 부풀리지 않는다.

`npm run harness -- assistant-capability matrix-ui-all --out <새 폴더>`는 50개 명령을 각각 새로 저장한 SQLite fixture에서 시작해 실제 `ai-input` 제출과 scripted `/v1/agent/run` 적용 이벤트를 거친다. 명령 사이에는 같은 Firefox 컨텍스트를 페이지 재로드해 fixture를 다시 읽고, 저장 완료 후 `stored(projectDir)`로 정본을 확인한다. 에디터가 같은 agent 요청을 재전송할 수 있으므로 각 명령의 응답을 캐시해 비멱등 도구가 두 번 실행되지 않게 한다. 결과 JSON의 `uiAgentAppliedCommands`가 50이고 `directTransportCommands`가 0이어야 이 단계가 통과한다. 이 단계도 모델 제공자 성공과 독립 시각 판정은 측정하지 않는다.

`npm run harness -- assistant-capability matrix-native --out <새 폴더>`는 50개 명령을 각각 새 SQLite fixture(`matrixNativeSpec.ts`의 `nativeProject()` — 실제 마을 맵·이름 있는 이벤트·막힌 출입구·월드맵·상점 재고, `fixtureProblems()`가 각 문장에 대상이 있는지 검사)와 **명령마다 새 호스트**에서 시작해 **실제 provider의 응답**을 실제 `ai-input`으로 제출한다(한 호스트를 공유하면 멈춘 명령의 맵 점유가 다음 명령 전부를 409 `map-busy` 로 만든다).
- **판정은 계약 + 보존이다.** 도구 이름은 보고만 하고 판정하지 않는다 — `judge()` 가 명령 문장이 말한 결과(예: 선택 영역 안 8칸만 흙, 이벤트 이름을 하린으로, 상점 명령이 생기고 기존 대사·이동은 그대로)와 나머지 내용의 보존을 저장 문서 전/후로 비교한다. 읽기 명령은 사실에 맞는 답과 무변경을 본다. `ok = 턴 완료 && 판정 && SQLite 재로드 일치`.
- **사람이 먼저 한 일(setup).** 「이 이벤트/문」은 `__oprnRegionTaskHarness.selectEvent` 로 이벤트를 고른 상태에서 보내고(`plainTurn.selectedEventFact` 가 `[선택한 이벤트]` 줄로 모델에 전달 — 요청 영수증의 `context` 로 확인), 「방금 한 일」 명령(undo-preview·summarize-diff·show-tool-log·rewind-turn)은 같은 입력창으로 실제 선행 턴(나무 한 그루)을 먼저 돌린다.
- **되돌리기·기록 도구는 워커에서 편집기 기록을 쓴다.** Pi 워커는 편집기 히스토리 스택이 없으므로 요청의 `editHistory`(라벨·steps·가까운 5건의 바뀐 타일 칸/이벤트 id)로 `list_edit_history` 가 답하고, `revert_last_edit` 는 초안을 건드리지 않고 `data.clientUndo` 만 돌려준다. 다른 변경이 없는 턴에서만 편집기가 끝에 `undoMapEdit()` 로 실제 되돌린다(`aiPiAgentCommand.ts`).
- 모델 고정: `MATRIX_NATIVE_MODEL=<Antigravity 모델 id>`(+`MATRIX_NATIVE_EFFORT`, 기본 low — 허용 `off|low|medium|high|xhigh|max`, 그 밖의 값은 실패)가 에이전트 루프·의도 선언을 그 모델 하나로 묶는다. 비우면 제품 기본(gemini-3.8-flash). `gemini-4-argon` 은 `scripts/lib/ohMyPiModel.ts` 확장으로 풀리지만(agy 목록의 gemini-4-argon-{low,medium,high}) **아직 실행으로 검증하지 않았다** — 쓰기 전에 요청 로그의 model 이 실제로 그 id 인지 먼저 확인한다.
- 환경 변수: `MATRIX_NATIVE_ONLY=id,id`·`MATRIX_NATIVE_START/LIMIT`·`MATRIX_NATIVE_TIMEOUT_MS`, 미리 빌드한 `dist` 를 쓰려면 `HARNESS_DIST_DIR`(빌드: `vite build --mode packaged --configLoader runner --outDir <dir>`, 워크트리면 `VITE_CACHE_DIR` 필수).
- **오프라인 재판정:** 판정기만 고쳤으면 모델을 다시 부르지 않고 저장된 `before/after/original/trace.json` 으로 다시 채점한다 — `npx vite-node --script src/harnesses/assistant-capability/node/matrixNativeRescore.ts -- <결과 폴더…>`.
`/v1/chat/completions`는 읽기 답변의 완료 신호로만 기록한다. 각 명령 뒤 실제 SQLite 저장, 새 브라우저 context 재로드, project ID·SHA 일치를 검사한다. `matrix-native.json`에서 `nativeAgentCalls`·`chatCompletions`·`sqliteReloads`와 명령별 실패를 확인하며, 시각 검수는 별도 `review` 영수증으로 남긴다(이 단계의 `visualReviews` 는 0).

`npm run harness -- assistant-capability matrix-score --out <새 폴더>`는 50개 명령 각각의 canonical tool·범위·인자를 실제 provider 모델에 묻고 자연어 이해력과 판단 품질을 계산한다. 현재 실행 설정은 텍스트·비전 모두 `cbcn/glm-5.3-flash`이며, provider가 바뀌어도 결과 JSON에 실제 provider/model을 기록한다. 같은 50개에 대해 도구 적용 전후 PNG 100장을 생성하고, 2개씩 묶은 25회의 실제 비전 모델 호출로 시각 품질을 채점한다. 텍스트·비전 응답이 비거나 항목을 누락하면 같은 입력을 최대 3회 재시도하며, 재시도 뒤에도 점수가 없으면 정적 픽셀 점수로 승격하지 않고 `incomplete`로 기록한다. `matrix-score.json`에는 모델 응답 원문, 호출 수, 실패, 명령별 점수와 전후 이미지 SHA를 남긴다. `status: scored`는 50개 채점 완료를, `qualityGate: pass|fail`는 자연어 ≥60/100·판단 ≥60/100·시각 ≥2/5 기준을 각각 뜻한다. 운영 목표인 시각 평균 4.5/5는 이 파일의 `aggregate.visualQuality`로 확인한다. 시각 모델 점수는 사람 검수의 대체가 아니며, 이 단계는 실제 모델이 도구를 호출했다는 뜻이 아니라 모델의 해석·판단 품질을 별도로 측정한다.

## 명령 가족 500개 (가족 100 × 변형 5)

50개 행렬은 명령마다 문장 하나와, 픽스처 좌표를 코드에 박은 판정기 하나다. 500개 행렬은 **가족(family)** 으로
그 계약을 매개변수화한다 — 판정기·정답·오답이 모두 같은 `args` 를 읽으므로 변형은 대상·인자·말투를 바꾼다.

- 형식 `src/harnesses/assistant-capability/node/families/types.ts` · 등록 `families/index.ts`(group-1..5)
- 배분표 `families/GROUPS.md`: 50개 기존 id + 50개 새 가족(실내·전이·전투·모호한 지시·연쇄 지시·선택 모양·
  DB 스킬/적/클래스/troop·BGM/날씨/틴트·분기/변수/autorun·읽기 질문)을 group-1..5 에 20개씩. 픽스처 추가도 표에 적었다.
- 명세 `npm run harness -- assistant-capability matrix500-spec` → `harness-data/assistant-capability/command-matrix-500.json`
  (행 id `<가족>__<변형>`, `counts`·`complete`). 가족이 100 미만이면 `complete=false` 이고 그만큼만 실행한다.
- 판정기 자기검사 `matrix500-selfcheck --out <새 폴더>`: 가족마다 **정답 통과 · 오답 전부 실패 · 쓰기 가족은 무변경 실패**를
  모델·브라우저 없이 확인해 `selfcheck.json` 에 `sound` 와 이유를 남긴다. 판정기가 정답/오답을 구분하지 못하면 실모델 점수는 의미가 없다.
- 실행 `MATRIX_NATIVE_SPEC=500 npm run harness -- assistant-capability matrix-native --out <새 폴더>`. `MATRIX_NATIVE_START/LIMIT/ONLY`
  는 새 id 로 그대로 동작하고, 가족 `prepare()` 가 픽스처를 덧붙인다. 50개 기본 경로는 변형·가족이 없으면 예전 그대로 돈다.

### InferHub DeepSeek V4.1 Flash 고정

`MATRIX_NATIVE_PROVIDER=openai-compat:inferhub MATRIX_NATIVE_MODEL=deepseek-v4.1-flash` 는 에이전트 루프·의도 선언·
깊은/빌드/작문/비전 역할을 그 하나로 묶는다. 실행기는 임시 폴더에 `openAiCompatStore` 스키마 그대로 엔드포인트를 쓰고
(주소 `https://api.inferhub.dev/v1`, 허용 모델 `deepseek-v4.1-flash`, 이미지 입력 켜짐, 추론 강도 `field`)
각 호스트에 `OPRN_OPENAI_COMPAT_PATH` 를 넘긴 뒤 끝나면 폴더를 지운다. 키는 환경 변수 `INFERHUB_API_KEY` 에서만 읽고
실행 폴더·요약에 쓰지 않는다(없으면 명확히 실패). `MATRIX_NATIVE_REASONING=none|field|suffix` 로 방식을 바꿀 수 있고 기본은 `field` 다.
**실측(2026-10-22):** `field` 는 `thinkingLevel: low` 와 함께 그대로 통과한다(HTTP 200, 도구 호출 10회). 서버가 죽이는 것은
`off` 하나다 — `Thinking effort off is not supported … Supported efforts: low, high, max` 를 200 스트림 error 이벤트로 싣고
첫 턴이 끝난다(도구 0회). 그래서 고정 실행의 기본 강도는 `low` 이고, compat 에서 `MATRIX_NATIVE_EFFORT=off` 는 명시적으로 거절한다.
실제 요청 영수증은 각 명령의 `native-result.json` 의 `requests[]`(`provider` 헤더·`model` 본문, 그리고 스트림의
`prompt_inspection` 스냅샷에서 뽑은 `providerReasoningEffort`)와 `matrix-native.json` 의 `modelPin` 에 남는다.

**추론 강도(`MATRIX_NATIVE_EFFORT`)는 `off|low|medium|high|xhigh|max` 전부를 받는다.** 알 수 없는 값은 `low` 로
떨어지지 않고 **실패한다** — 「max」라고 적힌 실행이 실제로 low 를 보냈다면 그 실행의 라벨이 거짓이기 때문이다(2026-10-22 실측:
이전 화이트리스트가 `max` 를 low 로 낮춰 `modelPin.thinkingLevel` 이 low 로 남았다). 값을 실제로 나르는 길은
`AiConfig.reasoningEffort`/`roleModels.*.thinkingLevel`/`ultrabrainReasoningEffort` → `plainTurn.ts` 의
`buildPiRunRequest` → `PiAgentRequest.thinkingLevel` → `scripts/lib/piAgentRuntime.ts` 의 `Agent` 초기 상태 → pi-ai
`openai-completions` 의 `reasoning_effort` 다. 그래서 `RoleModel.thinkingLevel`(`ThinkingEffort`)·`AiConfig.reasoningEffort`·
`PiAgentThinkingLevel` 세 타입을 pi-ai 의 `Effort` 와 같은 어휘로 넓혔고, `llmClient.ts` 의 설정 파서도 `xhigh|max` 를
보존한다(제품 UI 가 보여 주는 선택지는 그대로다 — 넓힌 것은 저장·전송 경로다). compat 모델의 사다리는 서버가 정한다:
InferHub `deepseek-v4.1-flash` 는 `low, high, max` 라 `max` 는 그대로 통과하고 `xhigh` 는 pi-ai 가
`requireSupportedEffort` 로 거절한다.

`MATRIX_NATIVE_SPEC=500` 실행은 `dist-electron/browser-bridge.js` 도 필요하다 — 워크트리면
`npm run build:electron` 을 먼저 돌린다(`HARNESS_DIST_DIR` 만으로는 호스트가 뜨지 않는다).

### 500 실측 재채점 (2026-10-23)

500명령 라이브 실행(DeepSeek V4.1 Flash, `max`)의 실패를 판정기 결함과 모델 실수로 나누고, 저장된 `before/after` 에
**현재 판정기**를 다시 돌려 재채점한다. 실행 폴더의 `cmds/<id>/` 와 상자별 `project-db/<box>/project.sqlite.gz`
(`boxes.json` 이 명령→상자 매핑)만 있으면 모델·브라우저 없이 돈다. 타일셋 blob 은 그 상자의 sqlite 에서만 복원된다
(압축을 풀고 `writeRuntimeProject(boxDir, scratch, saved)` 로 되붙인다). 복원에 실패한 명령은 라이브 판정을 유지하고 따로 센다.

- **추론 강도 영수증은 판정 조건이 아니라 보고 플래그다.** `prompt_inspection` 스냅샷이 빠진 턴(216건 중 28건)은
  `effort: "unverified"` 로 남기고, 결과의 옳고 그름은 판정기가 정한다. 영수증 부재로 정답을 실패시키지 않는다.
- **턴 종료 조건**: `done` 이벤트가 있고 오류·취소가 없으면 턴은 끝난 것이다. 되묻기 턴은 도구를 하나도 부르지 않을 수 있으므로
  「성공한 도구 호출 1회 이상」을 턴 종료 조건으로 쓰지 않는다(읽기 가족 판정기가 조회를 따로 요구한다).
- **동반 편집의 경계**: 요청을 제대로 하려면 함께 고쳐야 하는 것만 허용하고, 그 경계마다 오답 표본을 하나씩 둔다.
  실측으로 허용한 것 — 편집한 문 바로 옆(1~2칸) 막힌 칸 열기·문을 걸을 수 있는 옆 칸으로 옮기기(`gateUnsealCells`),
  전이 사이의 `wait` 한 번, 전이를 놓을 때 생기는 두 맵 사이 `mapConnections` 한 건, 왕복을 만들며 **새로 만든**
  상대 문·`troops`/`enemies`/`switches` 행(추가 전용). 그 밖의 기존 이벤트·타일·DB 행 변경은 그대로 실패다.
- **이름이 아니라 계약으로 판정한다**: 프롬프트가 id 를 주지 않는 가족(적 그룹 생성, 새 실내 맵)은 모델이 만든 id 를 받아들이고
  이름·크기·구성·기하를 본다. 「서쪽/동쪽 문」은 방의 3분면, 「북쪽」은 월드맵 위 1/3 처럼 화면 낱말의 뜻으로 판정한다.
- **읽기 답변은 부정문을 먼저 걷어낸다**: 「막힌 칸은 없습니다」·「고립은 아닙니다」는 막힘/고립 주장이 아니다. 영역 사각형의
  모서리 좌표는 영역 이름이지 막힌 칸 지목이 아니다. 도달성 질문은 「바로 옆까지 갈 수 있지만 그 칸에 오브젝트가 있다」 같은
  지형-도달성 구분을 모호한 결론으로 보지 않는다.
- **도달 가능성의 진실은 문 명령의 존재가 아니라 걸어서 들어갈 수 있는가다**(`reachableMaps`). 픽스처의 남쪽 출입구는
  덤불에 막혀 있으므로 그 너머 숲길은 「연결되지 않은 맵」이다.

## 시각 검수

검수자는 먼저 요청과 실제 그림을 비교한다. 조수의 자기평가를 시각 판정의 근거로 대신 쓰지 않는다. 런타임은 이동/대화 중 가림, 잘림, 글자·분기·금액을 본다. 결함은 위치·재현 장면을 적는다. 실제로 본 파일만 다음처럼 기록한다.

```bash
npm run harness -- assistant-capability review --out <실행> --case npc-line \
  --status pass --reviewer <독립 검수자> \
  --images after.png,reloaded.png,runtime/<검수한 실제 PNG> \
  --notes '<그림과 요청을 대조한 구체적인 관측>'
```

검수는 결과 파일 해시와 각 PNG 해시에 묶인다. 결과/그림이 바뀌면 영수증이 무효가 되어 pending으로 돌아간다. 조수 ready는 지도 렌더 완료보다 빠를 수 있으므로 에디터 residentTileCells도 기다린다. `recapture`는 이전 PNG/판정을 capture-history에 보존하고 같은 저장 결과를 새 context에서 읽어 렌더 완료 후 재캡처한다. 모델 호출이나 콘텐츠 수선은 하지 않는다. 검수자 인적 진술의 진실성 자체는 파일 해시로 증명되지 않는다. 별도 검수 모델의 품질과 정상/불량 이미지 교정은 후속 범위다.

## 산출물과 확장

`qa-runs/harnesses/assistant-capability/<실행>/`에는 초기 fixture/SQLite/assets, task baseline, 실제 trace, 적용 후 결과, 재로드 영수증, runtime SUMMARY/manifest/PNG, gate 결과, 시각 검수 영수증과 종합 summary.json/SUMMARY.md/report.html을 남긴다. 큰 산출물은 gitignore이며 코드·시드·문서는 커밋 대상이다.

새 기능은 seed에 요구·보존·runtime·visual을 선언하고 checks와 플레이 시나리오를 추가한다. 알려진 정상 결과와 해당 기능의 결함 반례로 검증기를 먼저 교정한다. 새 실행 폴더로 실모델 시험하고 시각 검수 후 집계한다. 과제 원문/fixture/검증 기준 버전과 모델 기록을 보존하여 성공한 재시도로 실패한 최초 시도를 덮지 않는다.

## 최초 실측 — 2026-10-05

제품 기본 google-antigravity/gemini-3.8-flash, 기능별 실제 입력 1회. 핵심 10개 중 통과 1(계획), 실패 8(편집), 공용 판본 변경으로 최종 환경 차단 1(조회). 요구 데이터 자체는 10개 모두 맞았지만 편집 8개는 공통 toolRunner 후처리가 다른 두 맵의 upperTiles 585칸을 바꾸어 보존 게이트에서 실패했다. 선택지는 실제 Esc가 종료 대신 동문 분기를 실행했다. 대사 수정은 적용 뒤 PROHIBITED_CONTENT 오류로 완료 문장이 잘렸다. 일회성 보상의 재대화·맵 재진입과 숙박 거절·수락은 실제 플레이로 확인했다.

검사기 교정 49건, 알려진 정상 결과의 플레이 교정 6개는 모두 통과했다. 조수 성공 수와 섞지 않는다. 런타임은 Firefox에서 제품 export 투영과 player.html/shim을 확인했으며 완성 ZIP 패키지나 Electron/Chromium 전체 출하는 측정하지 않았다. 참고 이미지·컨트롤 PNG를 포함한 근거는 `verify-shots/assistant-capability-20261005/`, 전체 정본과 관측 이력은 `qa-runs/harnesses/assistant-capability/20261005-core-r3` 및 `20261005-item-r4`에 남았다.

관측 한계: 초기 packaged DEV 훅/숨겨진 자율성 선택기와 대용량 브라우저 복제로 기동·관측이 실패하여 교정했다. 실제 모델 재시도는 하지 않았다. 맵 이름 시험은 이전 실행기가 SIGTERM 뒤 다음 기동을 시작하여 원본 SSE 기록이 덮였다. 모델 요청 영수증과 저장·변경·화면은 남았으나 실행 gate는 별도 환경 차단으로 집계한다(보존 실패가 전체 판정을 결정한다). 현재 과제 잠금·원본 trace 덮어쓰기 금지·다음 과제 중단 플래그와 종료 그룹 처리가 이 재발을 막는다. 단일 모델·단일 표현·단일 시행이므로 반복 성공률이나 전체 도구 품질로 일반화하지 않는다.

## 제품 회귀와 오류 표시 controls (2026-10-05)

`self-check-tools --out <controls>`는 실제 쓰기 도구의 기존 맵 보존·대상 래스터 보정·dryRun·취소 의미를 검사한다. `self-check-errors`는 별도 폴더에 `prepare --case map-rename` 후 실행한다. 실제 편집기 입력·적용·SQLite 저장 경로에서 제공자 error+done을 주입하며 무변경/변경 반영 두 경우의 실패·전달 축을 검사한다. 모델 요청은 가로채고 별도 kind와 modelCalls:0을 남긴다. 이 controls를 조수 실제 수행 결과로 집계하지 않는다.

오류 controls에서 계획과 실행이 각각 Pi 요청을 만들 수 있다. native 요청 수를 1로 제한하지 않고 한 건 이상이며 전부 가로채졌는지 검사한다. `self-check-errors --recheck`는 원래 UI 관측/실패 영수증을 verification-history에 보존하고 이 요청 수 검사만 재평가하며 모델이나 브라우저를 다시 실행하지 않는다. UI 동작이 달라졌으면 새 controls 프로젝트를 준비해 다시 실행한다. `discover-tools`는 후속 한 칸 편집의 엄격한 범위 감사이며 발견 실패를 숨기거나 실모델 점수에 합치지 않는다.

## 수정 확인 — 2026-10-05

조회·아이템 가격·선택지의 새 실제 입력 3개는 요구/보존/저장/시각 게이트를 통과했다. 기존 타일 변경 0칸, 선택지 실제 플레이 11비트 통과와 Esc 종료를 직접 확인했다. 제품 회귀 controls 55/55, 오류 주입 UI controls 12/12를 별도 보존했다. 입력 전 UI 기동 실패와 브라우저 종료로 관측을 완성하지 못한 대사 시험은 성공으로 승격하지 않았다. 이것은 선택된 확인 시험이며 core 전체 새 성공률이 아니다. `verify-shots/assistant-capability-fixes-20261005/`에 정본·SHA·재로드 영수증, 시각 증거와 제한을 남겼다.

## 월드맵 생성 MP4 증거

`npm run harness -- assistant-capability film-worldmaps --out <새 실행 폴더>`는 기본 대륙과
포켓몬풍 마을/도로의 별도 SQLite 프로젝트를 준비하고 제품 기본 모델에 실제 자연어를 제출한다.
동반 서비스와 모델 응답은 가로채거나 대본으로 대체하지 않는다. 기존 맵·시작 위치 보존,
생성 방식 선택, 실제 UI 저장, 새 브라우저 context의 같은 SQLite SHA/맵/DB 읽기를 남긴다.
`proof.json`, 원본 WebM, 실제 입력부터 결과/페이지 재로드까지 정상 속도 `assistant.mp4`가 산출물이다.
실패 시도도 같은 폴더에 남고 기존 실행 폴더는 덮어쓰지 않는다. core 수행 점수·전체 게임
품질·런타임 플레이 검증과 별도인 생성/저장 증거이며 이 단계만으로 플레이 검수 통과를 선언하지 않는다.

`--case monster`(2026-10-06)는 빈 SQLite 프로젝트에 「포켓몬스터 같은 게임을 처음부터 끝까지 만들어줘」와 고유명을
자연어로만 준다. 합격은 캠페인·72맵·시작 마을 이름·고유명 반영, 실행 상태가 「마치지 못했」이 아님, 같은 SHA 재로드다.
`proof.refine`에 사용자가 보는 「더 다듬을 곳」 지적 전문을 남긴다. 저장본 플레이는 따로 —
`live.json`을 `qa:game check`와 `scripts/qa/runtime/monster-journey.mjs`(gen 출력처럼 안 쓰는 업로드를 걷어 낸 사본)로 돌린다.
여정은 찍을 때마다 전투 문장이 창 안에 있는지 재고 넘치면 `layout:` 단계로 실패한다.
`--case monster-desert`·`monster-harbor`는 `scripts/qa-game/briefs/*.json` 기획서로 같은 검사를 한다(1관 타입을 `proof.monster.gym1Team`에 남긴다).
`--case monster-followup`은 bun 으로 만든 캠페인 고정물에 「서리꽃 마을 왼쪽 아래 빈 곳 채워」를 시킨다. 합격은 그 맵만 바뀜·크기/이벤트/다른 콘텐츠 보존·빈칸 60% 이하 —
숫자보다 `render.mts`로 서리꽃 마을을 원 크기로 그려 검은 칸·테두리 파괴를 눈으로 본다(2026-10-06~07 r8~r11: 검은 칸 셋·테두리 파괴 원인은 도구였다).
재로드 때 다른 세션이 공용 DB 에 자료를 게시하면 부팅 정규화가 한 번 더 저장한다 — 맵·DB 가 같고 rev+1·`bootNormalization.lib`만 다르면 `libraryResync`로 허용한다.

### 대사창 읽기 보조 실조수 시험 — Argon 5문장 (2026-10-17, `set_dialogue_system`)

헤드리스 실조수 경로(`npm run qa:game -- gen --seed-project … --text "<한 줄>" --compat-base http://127.0.0.1:8318/v1 --compat-model gemini-4-argon-high --compat-thinking medium`, 키는 `OPRN_LIVE_KEY` 환경변수만, `flock /tmp/oprn-8318.lock` 직렬)으로 연애 시작 프로젝트(대사 시스템 저작 없음 = 관계 기본 구성) 위에서 자연어 5문장을 각각 독립 실행했다. 입력창 UI 경로가 아니라 `runPiAgent` 직접 호출이다(조수 하네스의 UI 관문을 대신하지 않는다). 프록시에는 `gemini-4-argon-high` 하나만 있고 `-medium` 모델 id 는 없다(400 model_not_found) — 추론 강도는 `--compat-thinking`.

| 문장 | 결과(저장된 project.json 의 `meta.oprnDialogueSystem`) |
|---|---|
| 백로그·오토·스킵·숨기기 다 켜고 백로그 250줄 | `set_dialogue_system {backlog,auto,skip,hideButton:true,backlogLimit:250}` → limit 250, 나머지 켜짐 |
| 스킵 안 읽은 글도, 오토 빠르게, 창 70% | `defaults {skipScope:"all",autoSpeed:"fast",windowOpacity:0.7}`, 기능 켜짐·limit 100 유지 |
| 백로그 10000줄(범위 밖) | 1차 호출 `backlogLimit: must be <= 500` 거절 → 2차 500 으로 재호출, 최종 보고에 「요청한 10,000줄은 그대로 안 됨, 최대 500줄」을 정직하게 적음 |
| 숨기기 버튼만 빼 줘 | `{hideButton:false}` 만 전달, 나머지 보존 |
| 시스템 글자를 영어로 | `{language:"en"}` 만 전달 |

5/5 도구 선택·인자가 맞았고(`read_game_systems` 먼저 → `set_dialogue_system` → `review_game_systems`) 기존 설정은 보존됐다. 한계: 범위 밖 요청(3번)에서 어시스턴트가 사용자에게 되묻지 않고 최대치로 대신 적용했다(보고는 정직). 조수 UI 입력창 경로·플레이 검수는 이 시험에 포함되지 않는다. 증거는 저장소 밖 로컬 `qa-runs/dlg-a1..a5`(gitignore).

### 미연시 추가 화면 실조수 시험 — Argon 5문장 (2026-10-17, `set_vn_extras`)

경로·키 규칙은 위와 같고 포트만 8319(flock 없음), 시드는 연애 프로젝트에서 `meta.oprnVnExtras` 를 지운 것(`output/qa/vn2/seed-novn.json`, 생성: `romance-vn-ui2-fixture.mts` 후 저작 삭제).

| 문장 | 결과(저장된 `meta.oprnVnExtras`) |
|---|---|
| 갤러리·엔딩 목록·세이브 칸 대사 한 줄 켜 줘 | `set_vn_extras` 다섯 칸 전부 true → 세 기능 켜짐(기본값을 명시 저작으로 고정) |
| 못 본 엔딩 이름도 미리 보이게 | `{endings:true, endingsHideUnseen:false}` → hideUnseen:false, 나머지 보존 |
| 세이브 칸 대사 한 줄 꺼 줘, 나머지 그대로 | `{saveCards:false}` 하나만 → gallery·endings 보존, 보고 정확 |
| 안 연 그림 칸 숨겨 줘 | **통과(재시험, 2번째 시도)** — `read_game_systems` → `set_vn_extras {galleryShowLocked:false}` → `review_game_systems`(일치). 저장본 `gallery{enabled:true,showLocked:false}`, endings·saveCards·language 보존 |
| 갤러리·엔딩 글자를 일본어로 | **통과(재시험, 4번째 시도)** — `read_game_systems` → `list_endings` → `set_vn_extras {language:"ja"}` → `review_game_systems`(일치). 저장본 `language:"ja"`, 갤러리·엔딩·저장 카드 보존, 대사 시스템 언어는 ko 그대로 |

5/5 통과. 앞 3문장은 첫 시험, 뒤 2문장은 같은 날 재시험(8319 Argon `gemini-4-argon-high` medium, 시드 `seed-novn.json`, `--no-check`)이다. 모두 `read_game_systems` → `set_vn_extras` → `review_game_systems` 순서와 인자·보존이 맞았고 인자는 바꿀 칸 하나뿐이었다.

**재시험 시도 기록(정직하게):** 「안 연 그림 칸」 2번 시도 중 1번 실패·2번째 통과, 「일본어」 4번 시도 중 3번 실패·4번째 통과. 실패는 전부 `classifyPlainPiTurn` 30초 한도(재시도 1회 포함)의 `시간 초과(30000ms)` 로, 도구 인자·내용 때문이 아니라 제공자 지연이다 — 처음 시험에서 「미검증」으로 둔 이유와 같다. 같은 문장·같은 설정으로 다시 돌린 것이고 통과분의 저장본(`project.json` 의 `meta.oprnVnExtras`)을 직접 읽어 확인했다. 분류 호출이 막히는 동안은 모델 품질이 아니라 한도가 병목이므로, 시간 초과 한 번을 실패로, 통과 한 번을 만능으로 읽지 말 것(각 문장 표본 1개).

## 장면 교훈 묶음 (2026-10-22)

데모 게임(낙성·아스트라·첫사랑 등)을 손으로 고치며 얻은 교훈을 **조수가 혼자 하는지** 재는 묶음이다.
시드 `harness-data/assistant-capability/scene-lessons-seed.json` — 20건(엘리베이터 왕복·NPC 걸어 나가기·성벽 마을 북동문·
어두운 천장 지하·흉상 마주보기·없는 기물(자판기)·보스 체크포인트·여관/상점 문·아래 서술창·모든 맵 BGM·벽걸이 서재·밤 마을·
집 계단·파티 입장 컷신·조용한 현대 거리·꾸미되 통행 유지·예/아니오 기본값·보이는 출구·NPC 초상 짝·보스 밸런스). 각 건은
요구(`requirements`)와 0이어야 할 `scene-*` 경고(`lint0`)를 미리 적는다. 배경 파노라마는 다른 묶음이 다루므로 넣지 않는다.

**모델 표기:** Argon 쿼터가 없을 때는 `assistantEngine` = `local-cli:claude` + `claude-sonnet-5-5` high(**조수 대용**)로 돈다.
실제 입력창 → companion → Bun 워커 → `claude -p`(MCP 도구 서버) 경로이며 요청 기록에 provider 가 남는다. Argon 점수와 섞지 않는다.

```bash
R=qa-runs/harnesses/assistant-capability/<날짜>-scene-lessons-rN
mkdir -p $R && cp harness-data/assistant-capability/scene-lessons-seed.json $R/experiment.json   # 고칠 건만 남겨도 된다
npm run harness -- assistant-capability genre-prepare --out $R
jq -r '.cases[].id' $R/experiment.json > $R/queue.txt
xargs -P 2 -I{} sh -c "npm run harness -- assistant-capability genre-run --out $R --case {} > $R/log-{}.txt 2>&1" < $R/queue.txt &
src/harnesses/assistant-capability/node/scenePostLoop.sh $R 1 &   # 채점 → 출하 player 영상 → 2초 간격 프레임
```

- `scene-score`(sceneLessons.mjs): 도구 호출·실패 호출(이름별)·`scene-polish-lint`·`qa-game check` 막힘(엔딩 없음 류 제외)·저장 재로드·1배 렌더.
  `machinePass` 는 실행·변경·저장·lint0·막힘 없음 전부다. **시각 합격이 아니다.**
- `scene-film`(sceneFilm.mjs): 저장본을 출하 `player.html` 에서 실제 방향키로 한 칸씩 걷고 결정 키로 말을 건다(순간이동·상태 주입 없음).
  대화 이벤트 먼저, 이동 이벤트는 마지막. 편집기 슬롯 잠금을 같이 써서 브라우저는 동시에 둘까지만 뜬다.
  키는 **짧게 톡** 누른다(누르고 있으면 두 칸 가서 길 위를 오락가락했다). 걸음마다 `step`, 콘솔 경고는 `console`, 녹화 끝은 `closing` 으로
  `film-log.json` 에 남는다. `sceneDenseFrames.mjs <attempt>` 는 도착한 상호작용마다 0.5초 간격 근접 프레임(`film/dense`)을 뽑는다 —
  2초 간격으로는 「말하고 걸어 나가 사라짐」이 한 칸 사이에 묻힌다. 출하 플레이어는 `dist/export-player`(= `build:player`)다. 런타임을 고쳤으면 그것부터 다시 굽는다.
- `scene-judge-input`(sceneJudgePrompt.mjs): **새 Opus 판정자**(읽기 전용 서브에이전트)에게 줄 지시문과 그림 해시. 조수의 완료 보고는 주지 않는다.
  판정 JSON 은 `sceneSaveVisual.py <attempt 폴더>` 로 그림 sha256 과 함께 `visual.json` 에 남긴다. 그림이 바뀌면 다시 판정한다.
- 판정 보정: 3/4 실내 벽 문·엘리베이터·계단 아래 **문턱 칸**의 이벤트는 문 위 이벤트다. 템플릿의 빈 맵·오프닝 슬라이드는 조수 결함이 아니다.
  칸막이 출입구(천장색 상인방 아래 통행 칸)는 구멍이 아니다. 관찰자가 결정 키를 0.5초마다 눌러 선택지가 두 프레임 사이에 기본값으로 골라질 수 있다 —
  뒤따른 갈래가 기본값이다. 겹침·그리는 순서는 잘라 확대해 보고 말한다(r2 예/아니오 판정자가 둘 다 오판했다).
- 되묻기 건(`lessons` 에 `clarify-ambiguous-request`): 기계 합격 = 턴이 묻고 멈춤(`clarifyAsked`) + 변경 없음. 판정자는 턴 직후 패널(`after.png`)을 본다.
- 합격 = `machinePass` + 판정 `pass`(MAJOR 없음).

**연속 규칙(AGENTS.md hard rule):** 데모 게임을 손으로 고칠 때마다 (a) 이 시드에 그 교훈의 건을 하나 더하고
(b) 조수가 혼자 못 한 원인을 도구·스키마·스킬·`scene-*` 경고에서 고친다. 프롬프트 한 줄 덧대기는 고침이 아니다.

### 첫 판 결과 (r2 기준선 → r3 수정 후)

결과·영상·못 하는 일 목록: http://mdc-server:18301/assistant-capability-loop-1.html
기준선에서 고친 근본 원인:
- `moveEvent` 경로를 방향 문자열 목록·JSON 문자열로 보내 거부 → `canonicalizeMoveEventRoute`, `displayTextSettings` 일부 생략 → 기본값 채움.
- 시작 위치가 빈 시드 맵에 남음(지은 장소에 갈 수 없음) → 조수 쓰기 도구 뒤 `adoptBuiltMapAsStart`(`startOnBuiltMap.ts`).
- `list_hand_interior_parts` 모르는 방 → 그 방을 가진 실내 칩셋을 알려 줌.
- `run_scene_test` 의 `lastTransfer.eventId` UUID 오타로 맞는 문을 실패로 읽음 → eventId 선택, 없는 id 는 오타라고 말함.
- 「배경 좀 예쁘게」 같은 모호한 말에서 의도 선언의 되묻기를 Pi 입력 경로가 버리고 맵 꾸미기 56회 → 되묻기를 그대로 보이고 멈춘다.
  답은 원래 요청과 묶여 다음 전송으로 간다(`clarifyFollowUpText`). 선택지는 날것 `[선택지]` 대신 읽히는 한 줄.
- `show_map_region` 미리보기가 맵 배경(파노라마)을 그리지 않아 조수가 배경을 눈으로 검수 못 함 → 배경 층을 타일 아래에 그린다.
- 로컬 Claude CLI 엔진이 첫 도구 호출에 접두사를 틀리고 「도구 이름에 mcp__oprn__ 접두사가…」를 답에 흘림 → 시스템 지시에 도구 이름 규칙을 미리 준다.
- 실내 층 이동 트리거가 계단·엘리베이터 그림 아래 바닥에 섬 → 그림 칸으로 올리고 앞 바닥을 착지로(`build_hand_interior_room`, `create_transfer_pair`).
  새 실내는 BGM 을 받는다.
- `furnish_outdoor_area` 를 버들항 맵에 부르면 모르는 바닥 오류 → `dress_beodeul_ground`·키트 `stamp_object` 로 안내.
- 저절로 그래픽을 고르는 도구(세이브 포인트·상자·필드 적)가 캐릭터 칩 선택 관문에 막혀 되돌려짐 → `choosesOwnGraphic`.
- 문자열 `"true"`/`"false"` 불리언, `changeFace` 중첩 `face:{}`, `camera {from,to}` 를 받아 들인다.
- 「연애 이야기의 첫 만남 장면에 쓸 골목 맵」이 새 게임 오프닝 6샷·타이틀·연애 엔딩 3개 완료 검사를 끌고 옴 → 「연애」 낱말 하나는 게임 제작 요청이 아니다.
- NPC 가 말하고 걸어 나가지 않고 제자리에서 사라짐: (1) `moveEvent` 의 `wait` 를 route 밖에 둬 걸음을 기다리지 않음 → route 안으로 옮김,
  `scene-npc-vanish` 가 「기다리지 않는 퇴장」을 잡음 (2) 말을 건 주인공이 첫 걸음 칸에 서 있어 걸음이 버려짐 → 명령 경로가 주인공에 막히면
  같은 끝 칸으로 비켜 감(`src/player/commandRouteDetour.ts`, 출하 런타임).
- 빈 맵을 만들어 두고 나중에 칠하면 시작이 빈 시드 맵에 남음 → 처음 칠할 때도 시작을 옮김. 템플릿 빈 풀밭에 이벤트만 놓으면 경고.
- 판정 그림(`qa-game render`)이 업로드(공용) 캐릭터 칩을 그리지 않아 보스가 「보이지 않음」으로 판정 → 저장본 옆 자산 폴더에서 그린다.

r3 판정 뒤(r4 로 다시 잰 것):
- 주인공이 유일한 출구 칸을 막아 NPC 가 한 칸 틈에서 못 나옴(이벤트 30초 정지) → 비켜 갈 길이 없으면 주인공이 한 번 옆으로 비켜 선다.
- 엘리베이터 아래 탑승 칸을 준 `create_transfer_pair` 가 2층 트리거를 그림 밖에 둠 → 위 그림 칸으로 올린다.
- 이벤트 경로 끝의 `turn`(서로 마주보기)이 경로가 끝나자마자 마지막 걸음 방향으로 되돌아감 → 돈 방향을 런타임 위치에 남긴다
  (`playSceneAutonomousCommands.ts` turnNpc). r3 party-enter 에서 두 동료가 대사 내내 등을 보였다.
- 로컬 CLI 엔진의 보조 완성이 「어느 그림을 실었는지」(`image_delivery`)를 돌려주지 않아 **전체 맵 검수가 매번 실패** — 21건 중 7건 화면에
  「#4 전체 검수 작업을 끝내지 못했어요」. 그림은 실제로 CLI 에 실렸다(Claude·Codex). 이제 그 자리를 돌려준다(`ohMyPiPiAiRuntime.ts`).
- 배경(`map.background`)이 있는 맵은 미리보기·전체 맵 검수가 통째로 거부(`map-background-rendering-unavailable`) — 배경을 그리게 한 것이
  닿지 않았다. 두 표면 모두 배경 첫 프레임을 빈 칸 뒤에 그리고 「스크롤 없음」을 라벨에 적는다(`mapBackgroundPreview.ts`). 움직임은 영상의 몫.
- 관찰자(scene film) 결함 — 조수 결함이 아니다: 창 없이 컷신만 도는 동안 누른 Escape 가 필드 메뉴를 열고 40회 한도가 컷신 도중에 끝나
  다음 대사를 아무도 넘기지 않음(r3 party-enter 「같은 대사 80초」), 전투에서 Escape 가 명령을 취소해 첫 턴에 멈춤, 상점 목록에서 Enter 가 다시 삼.
  이제 대사 창=Enter(같은 글 6회 넘게 그대로면 Escape), 전투=Enter, 상점·저장·메뉴 창=Escape, 창 없는 컷신=키 없이 기다림(최대 120초).
  녹화 영상은 전투 프레임 상당수를 검게 떨어뜨린다(녹화 결함, 게임은 정상) — 전투는 실제 페이지 스크린숏(`film/battle`)을 판정자에게 준다.

r4 판정 뒤(같은 저장본 재촬영·r5·r6):
- r4 npc-walk-out 은 여전히 제자리 소멸(판정 3) — 「비켜 섬」이 주인공 방향만 돌리고 걷지 않았다. 이제 주인공에서 BFS(최대 8걸음)로
  NPC 남은 경로·현재 칸이 아닌 가장 가까운 설 수 있는 칸을 찾아 **실제로 걸어 비킨다**(수직 방향 먼저). 비키는 동안 NPC 는 같은 걸음을 다시 시도한다
  (`commandRouteDetour.ts` `sidestepForPlayer`, `playSceneAutonomous.ts`). 모델 재실행 없이 같은 저장본 재촬영 → 판정 7.
- 「작은 마을 맵에 NPC 세 명」이 r2~r5 네 번 모두 템플릿 빈 풀밭에 세 사람만 세움(경고는 무시됨). 의도 선언 단계에서 대상이 손 안 댄 빈 맵이고
  사용자가 아직 없는 장소 맵(마을·여관·동굴…)을 말했으면 대상을 떼고(`targetMapId: null`, `needsPlan`) 시공 도구
  (`author_beodeul_town` / 실내는 `build_hand_interior_room`)를 첫 요청부터 노출하며, 메모에 「[장소 먼저] … 먼저 지어라」를 적는다
  (`intentDeclaration.ts` `retargetNamedPlaceOffBlankMap`). r6 에서 「한결 마을」 40×30 을 지은 뒤 세 사람을 세웠다.

### 루프 1 숫자 (Sonnet 5.5 high 조수 대용, 2026-10-22)

| | 시각 합격 | 시각+기계 | 평균 |
|---|---|---|---|
| r2 기준선(20건) | 15/20 | 12 | 6.2 |
| 고친 뒤(21건, 건마다 마지막 재측정) | 21/21 | 20 | 7.2 |

실행마다 흔들린다(동료 입장 컷신: r2 합격 → r3 불합격 → r4 합격). 한 번의 합격으로 능력을 단정하지 않는다.
못 하는 일(그림 저작 필요·관찰 한계): 성문 그림, 밤 창빛, 파노라마 프리셋 그림 품질, 버들항 풀 반복 무늬, 조수 창 선택지 단추,
영상의 소리, 보스 승리 경로, 전체 검수 1/6 실패(하네스가 패널 실행 기록을 남기지 않아 원인 미상).
