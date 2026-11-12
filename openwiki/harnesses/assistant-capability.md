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

**무료 oc.hyeon.space 고정:** `MATRIX_NATIVE_PROVIDER=openai-compat:oc MATRIX_NATIVE_MODEL=deepseek-v4.1-flash-free` 는
같은 경로로 주소 `https://oc.hyeon.space/v1`, 허용 모델 `deepseek-v4.1-flash-free` 엔드포인트(저장 이름 `oc` → id
`openai-compat:oc`)를 쓴다. 키는 환경 변수 `OC_API_KEY` 에서만 읽는다(없으면 실패, 값은 찍지 않는다). 무료라 청구는 0이지만
업스트림이 가끔 429 를 돌려주므로 그 명령은 모델 실수가 아니라 재시도 대상으로 본다. pi-catalog 가 이 id 에도 `low, high, max`
사다리를 주므로 `MATRIX_NATIVE_EFFORT=high|max` 는 통과하고 `off` 는 위와 같이 거절한다. 두 고정의 허용 목록은
`matrixNative.ts` 의 `COMPAT_PINS` 표 하나다 — 표에 없는 제공자·모델은 실행 전에 실패한다.

**유료 deploy 고정:** `MATRIX_NATIVE_PROVIDER=openai-compat:deploy MATRIX_NATIVE_MODEL=deepseek-ai/deepseek-v4.1-flash-1017
MATRIX_NATIVE_EFFORT=high` 는 주소 `https://api-cdn.deploy.com/api/v1`(저장 이름 `deploy` → id `openai-compat:deploy`)를 쓰고
키는 `DEPLOY_API_KEY` 에서만 읽는다(입력 $0.1 · 출력 $0.35 / 100만 토큰). 모델 id 는 업스트림 이름 그대로다 — omo 별칭
`deepseek-v4.1-flash-1017` 은 이 게이트웨이가 400 「Invalid Model Name」 으로 거절한다(2026-11-02 실측). 인증은 보통의
`Authorization: Bearer` 라 엔드포인트 모양은 그대로다(omo 의 `authHeader: true` 도 같은 헤더를 뜻한다). pi-catalog 가 이 id 를
DeepSeek 추론 계열로 읽어 `low, high, max` 사다리와 `reasoning_content` 재전송(모든 assistant 차례)을 켜므로 따로 손댈 것이 없다.
이 고정만 `contextWindow: 600000` 을 선언한다(다른 고정은 저장소 기본 128,000). 이 값은 pi-ai 모델의 창(출력 상한 맞춤·
오버플로 판정)으로 간다. 에디터의 자동 압축 지점은 모델 id 접두사로 창을 고르는 `resolveContextWindow` 를 따르므로 이 id 는
여전히 128,000 창 · 문턱 111,616 토큰이다(`openwiki/ai-context-compaction.md`).

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

## 작은 일 30가지 — 값싼 모델 + v2 를 일 단위로 재기 (2026-11-11)

목적: 조수 v2 가 **게임에 필요한 작은 일**을 값싼 모델(GPT 6.1 Terra high)로 해내는지를 일 단위로 잰다. 게임 통판(턴마다 30~45분, 한 번도
«완료» 없음)으로는 도구 수정 하나가 좋아졌는지 알 수 없다. 이 묶음은 **일마다 통과/까닭(기계 판정) · 도구 호출 · 시간 · 토큰 · 지시문 글자 수 ·
처음 실린 도구 수 · 턴이 «완료»로 끝났는지**를 표로 낸다. 500 가족 행렬(`matrix-native`)과 다른 점: v2 스위치를 켜고, 모델을
`ai-configs/<이름>.json` 으로 고정하고, 시작 상태에 **조수가 실제로 만든 게임**이 있다.

- 묶음(데이터): `harness-data/assistant-capability/small-jobs.json` — 일마다 `id · family · fixture · request(비개발자가 치는 한국어) ·
  check(판정 종류 + 인자) · allow(요청이 요구하는 이동·이름 변경) · reference(손 정답 = 실제 도구 호출 순서) · wrong(그럴듯한 오답)`.
- 코드: `src/harnesses/assistant-capability/node/smallJobs/` — `fixtures.ts`(시작 상태 셋) · `checks.ts`(첫 묶음의 판정 + damage + `runCheck`) ·
  `checkSupport.ts`(문서 읽기·말 걸기 따라가기 `interact`·자리 판정) · `checksData.ts`/`checksPlay.ts`(둘째 묶음의 판정) · `checksGenre.ts`/`checksGenrePlay.ts`(셋째 묶음의 판정) · `suite.ts`(읽기·정답 적용) ·
  `selfcheck.ts` · `run.ts`(실행기) · `report.ts`(HTML) · `freezeFixture.ts`(픽스처 얼리기). 입구 `smallJobsEntry.ts`(bun).
- **묶음은 셋이다.** `--set 1`(생략과 같다) = 이 절의 30가지(`small-jobs.json`), `--set 2` = 아래 「둘째 묶음」(`small-jobs-2.json`, 새 가족 35가지),
  `--set 3` = 「셋째 묶음」(`small-jobs-3.json`, JRPG 가 아닌 게임의 장치 36가지).
  첫 묶음의 id·순서·판정은 기준선 비교의 기준이라 바꾸지 않는다. 실행 요약(`summary.json`)이 묶음 파일을 적어 두므로 보고서·재판정은 `--set` 없이 그 묶음을 읽는다.
- 모델 고정: `--model terra-high` = `harness-data/assistant-capability/ai-configs/terra-high.json`(모든 역할을 `openai-compat:opencodex` 의
  `gpt-6.1-terra` high 로). 엔드포인트 주소·키는 저장소 밖 `OPRN_OPENAI_COMPAT_PATH`(없으면 `~/.oprn-suite/openai-compat-endpoints.json`)에서만
  읽는다. 다른 모델은 `ai-configs/` 에 파일을 더하고 그 이름을 준다.

```bash
npm run -s build:fast && node scripts/build-electron.mjs                  # 편집기·호스트 빌드(워크트리면 VITE_CACHE_DIR 를 준다)
npm run harness -- assistant-capability small-jobs-selfcheck [--set 2|3] [--out <폴더>] [--only id,가족]   # 모델 없음, 1~2분
npm run harness -- assistant-capability small-jobs [--set 2|3] --model terra-high --v2 --out <새 폴더> [--only id,가족] [--skip-completed] [--timeout-min 10]
npm run harness -- assistant-capability small-jobs-report --run <그 폴더> [--html <출력.html>]
npm run harness -- assistant-capability small-jobs-rescore --run <그 폴더>   # 판정기만 고쳤을 때: 모델 없이 저장된 전/후 문서로 다시 판정
```

### 시작 상태(픽스처) — 일마다 새로 만든다

| id | 무엇 |
|---|---|
| `blank` | `createBlankProject()` 그대로 — 빈 맵 한 장 |
| `starter` | 거의 빈 프로젝트 「잿불 마을 이야기」: 풀밭 마을(24×18)에 주민 셋(꼬마 미루·여관 주인 마사·파수꾼 데릭) + 이어지지 않은 「동쪽 들판」 |
| `built` | **조수 v2 + Terra 가 실제로 만든 게임** 《얼음 아래의 노래》(설원, 맵 6장 · 이벤트 38개 · 청사진 · 할 일 장부 · 퀘스트 포함)를 얼린 것. `small-jobs/built-game.json.gz`(345KB) |

`built` 는 2026-11-10 게임 통판의 저장 문서를 `freezeFixture.ts` 로 얼렸다: 빈 프로젝트와 같은 칸·타일셋 본문은 빼고(번들에서 다시 얻는다),
그 게임만의 생성 그림 6장(타이틀·엔딩·얼굴 2·아이콘 2, 수 MB)과 그것을 가리키는 칸 6개를 뺐다. 공용 라이브러리 그림 목록과 설치 도장도 비워
두어 첫 부팅에서 빈 프로젝트처럼 다시 설치된다(목록만 있고 파일이 없으면 편집기가 다시 받지 않는다 — 2026-11-11 실측). 얼려 두는 까닭은 도구·빌더를
고치는 동안에도 모든 기준선이 같은 시작 상태에서 재야 비교가 되기 때문이다. 다시 얼리면 판정의 좌표·이벤트 id 를 함께 고쳐야 한다.

### 판정 — 저장 문서 전/후만 본다

`checks.ts` 의 `runCheck(check, allow, before, after)`. 모델 판정자가 없고 도구 이름도 보지 않는다. **전** = 편집기 첫 부팅·저장 뒤의 저장 문서,
**후** = 턴 뒤 저장 → 새 브라우저 컨텍스트 재로드 → 종료한 뒤 `project.sqlite` 를 다시 읽은 문서.

- **outcome** — 요청이 말한 결과. 종류 15가지(`eventMoved` `newNpc` `shop` `giveOnce` `textSpot` `transferLink` `lineChanged` `innPrice`
  `gameTitle` `mapRenamed` `eventRenamed` `mapBgm` `battleEvent` `itemGatedText` `dressed`).
- **말 걸기를 따라가 본다.** 「처음 말을 걸면 그 대사」「두 번째에도 상점이 열린다」「한 번만 준다」「열쇠가 있을 때만 다른 글」은 명령이 있다는
  것만으로는 알 수 없다. 엔진의 `resolveEventPage`·`evalCondition` 으로 페이지를 고르고 상태를 바꾸는 명령(스위치·셀프 스위치·변수·아이템·돈·분기)만
  흉내 내 한두 번 말을 걸어 본다. 선택지는 모든 갈래를 합친다.
- **damage** — 시키지 않은 파괴는 요청한 결과가 있어도 불합격: 맵·이벤트 삭제, 다른 이벤트 이동, 맵·게임 이름 바뀜, 시작 위치 바뀜, 허락 없는 새 맵.
  (끝맺음 단계가 작은 일 뒤에 사람을 옮기거나 맵을 더 짓는지 잡으려는 것이다.)
- **sideEdits** — 불합격은 아니지만 적는다: 다른 이벤트의 내용 변경, 새 이벤트가 둘 이상, 맵 밖에서 바뀐 칸(`system.*` 타이틀·오프닝, `endings`, `quests`,
  `gameBlueprint`, 자료집 표, 새 그림·소리). 요청이 스스로 건드리는 칸(제목 바꾸기의 타이틀 화면, 전투의 부대·스위치, 새 사람의 외형·얼굴 그림, 주는 아이템, 이동 이벤트 한 쌍, 요청이 가리킨 이벤트 자신)은 종류별로 뺀다.
  공용 라이브러리 그림(`shared_*`)은 편집기가 첫 저장 뒤에 설치하므로 세지 않는다. 합계의 「요청 밖 변경이 있었던 일」이 이것이다.
- 자리 판정은 뜻으로: 「두 칸 왼쪽」= 정확히 (−2,0), 「문 앞」= 문 칸 아래 두 줄, 「바로 옆」= 둘레 8칸, 「옆」= 2칸 안. 선 칸은 걸을 수 있고 다른 이벤트와 겹치지 않아야 한다.

| # | id | 가족 | 픽스처 | 요청 | 판정(저장 문서) |
|---|---|---|---|---|---|
| 1 | `move-npc-left2` | move | built | 겨울 시장의 모피 상인을 두 칸 왼쪽으로 옮겨 줘 | 그 이벤트가 정확히 (-2,0)칸 옮겨지고 걸을 수 있는 빈 칸, 내용 그대로 |
| 2 | `move-npc-door-front` | move | built | 떠돌이 상인을 족장의 긴 집 문 앞으로 옮겨 줘 | 그 이벤트가 문 앞 자리 x21~26, y17~18 안의 걸을 수 있는 빈 칸 |
| 3 | `move-npc-next-to` | move | starter | 꼬마 미루를 여관 주인 마사 바로 옆으로 옮겨 줘 | 그 이벤트가 기준 이벤트에서 1칸 안(같은 칸 아님)의 걸을 수 있는 빈 칸 |
| 4 | `add-npc-line-starter` | person | starter | 마을에 대장장이 한 명 세워 줘. 말을 걸면 "좋은 쇠는 거짓말을 안 하지."라고 말하게 해 줘 | 잿불 마을에 새 사람(그림 있음·말 걸기) — 처음 말을 걸면 「좋은 쇠는 거짓말을 안 하지」 |
| 5 | `add-npc-near-built` | person | built | 떠돌이 상인 옆에 할머니 한 명 세워 줘. 말을 걸면 "오늘은 눈이 그칠 것 같구나."라고 말하게 해 줘 | 눈보라 마을에 새 사람(그림 있음·말 걸기) — 처음 말을 걸면 「오늘은 눈이 그칠 것 같구나」, 기준 이벤트에서 2칸 안 |
| 6 | `add-npc-blank` | person | blank | 이 맵에 주민 한 명 세워 줘. 말을 걸면 "어서 와!" 하고 인사하게 해 줘 | 빈 맵/동쪽 들판에 새 사람(그림 있음·말 걸기) — 처음 말을 걸면 「어서 와」 |
| 7 | `shopkeeper-blank` | shop | blank | 이 맵에 상점 주인 한 명 세워 줘. | 빈 맵/동쪽 들판의 새 사람에게 말을 걸면(두 번째에도) 상점이 열리고 자료집에 있는 물건을 1개 이상 판다 |
| 8 | `shopkeeper-items-starter` | shop | starter | 잡화점 주인 한 명 세워 줘. 말을 걸면 회복약이랑 해독초를 살 수 있게 해 줘 | 잿불 마을의 새 사람에게 말을 걸면(두 번째에도) 상점이 열리고 회복약·해독초 를 판다 |
| 9 | `shop-existing-npc-built` | shop | built | 겨울 시장의 모피 상인한테 말을 걸면 물건을 살 수 있게 해 줘. 회복약이랑 상급 회복약을 팔게 해 줘 | 있던 그 사람에게 말을 걸면(두 번째에도) 상점이 열리고 회복약·상급 회복약 를 판다 |
| 10 | `chest-potion3-starter` | chest | starter | 마을에 보물상자 하나 놓고 회복약 3개 넣어 줘 | 잿불 마을의 새(보이는) 이벤트가 처음에 정확히 회복약 3개를 주고, 다시 걸면 더 주지 않는다 |
| 11 | `chest-gold-built` | chest | built | 눈보라 마을에 보물상자 하나 놓아 줘. 열면 100골드를 얻게 해 줘 | 눈보라 마을의 새(보이는) 이벤트가 처음에 정확히 100골드를 주고, 다시 걸면 더 주지 않는다 |
| 12 | `pickup-key-built` | chest | built | 족장의 긴 집 바닥에 낡은 열쇠가 떨어져 있게 해 줘. 조사하면 주워 가게 해 줘 | 족장의 긴 집의 새(보이는) 이벤트가 처음에 정확히 낡은 열쇠 1개를 주고, 다시 걸면 더 주지 않는다 |
| 13 | `sign-starter` | sign | starter | 마을 입구에 표지판 하나 세워 줘. 읽으면 "잿불 마을에 오신 것을 환영합니다"라고 나오게 해 줘 | 잿불 마을에 새 조사 이벤트 — 조사하면 「잿불 마을에 오신 것을 환영합니다」, 그 칸에 보이는 것이 있다 |
| 14 | `sign-ending-built` | sign | built | 엔딩까지 가는 길에 표지판 하나 세워 줘. "동굴은 북쪽"이라고 적어 줘 | 어느 맵이든 새 조사 이벤트 — 조사하면 「동굴은 북쪽」, 그 칸에 보이는 것이 있다 |
| 15 | `examine-fireplace-built` | sign | built | 족장의 긴 집 벽난로를 조사하면 "장작이 따뜻하게 타오르고 있다."라고 나오게 해 줘 | 족장의 긴 집에 새 조사 이벤트 — 조사하면 「장작이 따뜻하게 타오르고 있다」, 벽난로 칸·바로 앞 칸 |
| 16 | `door-roundtrip-starter` | door | starter | 잿불 마을 동쪽 끝에서 동쪽 들판으로 넘어갈 수 있게 해 줘. 들판에서 마을로 돌아오는 길도 만들어 줘 | 잿불 마을에서 걸어서 닿는 새 이동이 빈 맵/동쪽 들판의 걸을 수 있는 칸으로 보낸다 + 돌아오는 이동 |
| 17 | `door-backdoor-built` | door | built | 족장의 긴 집에 뒷문을 하나 만들어 줘. 그 문으로 나가면 겨울 시장으로 가게 해 줘 | 족장의 긴 집에서 걸어서 닿는 새 이동이 겨울 시장의 걸을 수 있는 칸으로 보낸다 |
| 18 | `edit-line-built` | dialogue | built | 겨울 시장 모피 상인의 첫 대사를 "어서 오게, 모피라면 여기가 제일이지."로 바꿔 줘 | 그 사람 첫 페이지 대사에 「어서 오게, 모피라면 여기가 제일이지」, 옛 대사 없음, 다른 페이지·자리 그대로 |
| 19 | `edit-inn-price-starter` | dialogue | starter | 여관 주인 마사의 숙박비를 30G로 올려 줘. 대사에서도 30G라고 말하게 해 줘 | 여관 요금 30 + 대사에 「30G」, 「15G」 없음 |
| 20 | `rename-title-built` | rename | built | 게임 제목을 '별의 노래'로 바꿔 줘 | meta.title = 「별의 노래」, 타이틀 화면 글자도 같다 |
| 21 | `rename-map-starter` | rename | starter | 이 맵 이름을 '안개 마을'로 바꿔 줘 | 그 맵 이름 = 「안개 마을」 |
| 22 | `rename-npc-built` | rename | built | 겨울 시장에 있는 '시장 손님'의 이름을 '하린'으로 바꿔 줘 | 이벤트 이름 = 「하린」, 대사 화자 칸에 옛 이름 없음 |
| 23 | `bgm-same-as-built` | bgm | built | 겨울 시장 배경 음악을 눈보라 마을이랑 같은 곡으로 바꿔 줘 | 겨울 시장의 곡이 눈보라 마을의 곡과 같다 |
| 24 | `bgm-add-starter` | bgm | starter | 이 마을에 잔잔한 배경 음악 깔아 줘 | 잿불 마을의 곡이 곡 목록에 있는 곡으로 새로 걸린다 |
| 25 | `encounter-foe-built` | encounter | built | 얼어붙은 호수에 돌아다니는 적을 하나 놓아 줘. 부딪히면 전투가 시작되게 해 줘 | 얼어붙은 호수에 새(보이는) 이벤트 — 닿으면 전투, 부대가 자료집에 있다 |
| 26 | `encounter-slimes-starter` | encounter | starter | 마을 밖으로 나가는 길목에 슬라임 세 마리와 싸우는 전투를 하나 넣어 줘 | 잿불 마을에 새 이벤트(보이지 않는 길목 전투도 된다) — 닿으면 전투, 부대가 자료집에 있다, 적 3마리 모두 「슬라임」 |
| 27 | `give-key-once-starter` | quest | starter | 꼬마 미루한테 말을 걸면 낡은 열쇠를 하나 받게 해 줘. 한 번만 주게 해 줘 | 있던 그 사람이 처음에 정확히 낡은 열쇠 1개를 주고, 다시 걸면 더 주지 않는다 |
| 28 | `key-gated-door-built` | quest | built | 눈보라 마을의 굳게 닫힌 집 문 하나를, 낡은 열쇠를 갖고 있으면 "문이 열렸다."라고 나오게 바꿔 줘. 열쇠가 없으면 지금처럼 잠겨 있게 해 줘 | 잠긴 문 넷 중 하나: 낡은 열쇠가 있으면 「문이 열렸다」, 없으면 옛 글 |
| 29 | `dress-trees-starter` | fill | starter | 마을 빈 곳에 나무를 몇 그루 심어 줘 | 잿불 마을에서 타일·소품이 3칸 이상 바뀜, 200칸 이하, 사람·시작 칸을 막지 않음 |
| 30 | `dress-snowfield-built` | fill | built | 눈보라 마을 왼쪽 아래 빈 눈밭에 나무랑 바위를 좀 놓아 줘 | 눈보라 마을에서 타일·소품이 3칸 이상 바뀜(8할 이상이 맵 왼쪽 아래 4분면 x0~22, y18~35 안), 150칸 이하, 사람·시작 칸을 막지 않음 |

오분류 실측 문장 넷이 들어 있다: `rename-title-built`(「노래」 → 음악 전용), `sign-ending-built`(「엔딩까지」 → 게임 하나 만들기),
`move-npc-left2`(작은 이동에 큰 지시문), `shopkeeper-blank`(상점 주인 한 명), 그리고 `dress-snowfield-built`(세계 맵에서 빈 터 찾기).
「이 NPC」처럼 **선택한 이벤트**를 가리키는 문장은 넣지 않았다 — 이 실행기는 이벤트를 고르는 사람 손(선택 상태)을 만들지 않으므로 이름으로 부른다.
편집기가 보고 있는 맵은 시작 맵이다(다른 맵의 일은 문장에 맵 이름을 적었다).

### 자기검사 (`small-jobs-selfcheck`) — 판정을 먼저 증명한다

일마다 모델·브라우저 없이: ① 손대지 않은 픽스처는 **불합격** ② `reference` 를 실제 편집기 도구(`runTool`)로 적용한 문서는 **합격**
③ `wrong` 의 오답은 모두 **불합격** ④ 정답 + 시키지 않은 파괴(다른 이벤트 삭제, 이벤트가 없으면 맵 이름 바꾸기)는 **불합격**.
넷 중 하나라도 어긋나면 그 일은 unsound 이고 묶음에 둘 수 없다. 새 일을 더하면 이 단계를 먼저 통과시킨다. 2026-11-11: 30/30 sound.
`accept`(정답의 다른 모양 — 실모델이 실제로 낸 올바른 구현을 도구 호출로 옮긴 것)가 있으면 그것도 **합격**해야 한다. 실모델 결과를 보고 판정을 고칠 때는
그 구현을 `accept` 로, 고친 판정이 여전히 걸러야 할 것을 `wrong` 으로 함께 넣는다(예: 공통 이벤트로 뺀 열쇠 주기, 보이지 않는 길목 전투).
대화 시뮬레이터는 분기·선택지(모든 가지)·`callCommonEvent` 를 따라간다.
정답은 도구가 받아야 한다 — 도구가 고쳐 버리는 오답(없는 아이템 id, 막힌 도착 칸)은 오답으로 쓸 수 없다.

### 실행기 (`small-jobs`)

일마다: 픽스처를 새 SQLite 프로젝트로 저장 → `wholeGameSession.mjs`(실제 편집기 · `ai-input` · `--v2` · `--ai-config`)를 자기 프로세스 그룹으로 띄움
→ 요청 전 문서 읽기 → 요청 한 턴 → 조수가 되물으면 「좋아, 네가 판단해서 진행해 줘.」를 **한 번만** 답함 → 저장·새 컨텍스트 재로드·종료 → 판정.

- 동시 실행은 **최대 2**(코드 상한 — 값싼 엔드포인트의 속도 제한). 일당 상한 10분(`--timeout-min`, 요청을 보낸 순간부터, 되물음에 답한 턴 포함).
  상한은 세션의 `<out>/deadline` 파일로 전달한다.
- 공용 라이브러리는 실행 폴더에 한 번 고정(`shared-content.sqlite`)해 모든 일이 같은 판본을 설치한다.
- 결과 `jobs/<id>/result.json`: `status`(pass·fail·timeout·infra) · `reason` · `check`(outcome·damage·sideEdits) · `toolCalls`(이름 순서, 거절 표시) ·
  `wallMs`(보낸 뒤 가라앉기까지) · `runMs` · `modelCalls` · `tokens`(input·output·cacheRead·검토자) · `systemPromptChars` · `toolsOffered`(+이름) ·
  `complete`(v2 의 `v2.todo.final`) · `persistence` · `trace`(호출 인자·모델이 받은 글 발췌) · `answer`. `before.json.gz`/`after.json.gz` 는 타일셋 본문을 뺀 저장 문서다.
  Claude Code 고리(`local-cli`, Haiku 측정)는 `prompt_inspection` 사건이 없다 — `systemPromptChars` · `toolsOffered`(+이름) · `toolSchemaChars` 는 턴 끝 `stats.exposure` 의
  **첫 목록**(`firstList` — 대사 다듬기 패스가 목록을 갈아 끼우기 전의 것)에서 읽는다. `costUsd`(CLI 가 보고한 환산값, 구독 한도 사용 — Pi 고리는 null) · `totalTokens`(캐시 읽기 · 쓰기 포함)도 일마다 적고 `summary.totals` 에 합친다.
  두 고리는 풀과 첫 목록이 같은 함수(`toolExposure.ts`)지만 늦게 싣는 길이 다르다(CLI 는 목록을 얼리고 `load_tools` → `call_tool{name,args}`) — 통과 · 까닭의 갈래는 견줄 수 있고 **호출 수 · 토큰은 고리 사이에 견주지 않는다**.
- **통과 = 판정 합격 + 저장·재로드 확인 + 시간 안**. 저장·재로드 확인 = 저장 성공 + 새 컨텍스트가 읽은 맵·자료집이 저장한 것과 같다(`rendererEqual`).
  새 컨텍스트는 부팅하며 한 번 더 저장해 저장 문서의 sha 가 달라질 수 있다(내용 변화 0 — 2026-11-11 실측). 그것은 유실이 아니고, 판정은 그 뒤의 저장 문서를 읽는다. `timeout` 은 그때까지의 저장 결과에 판정을 돌려 까닭에 적되 통과로 세지 않는다.
  `infra` 는 도구 호출 0 + 오류로 턴이 시작하지 못한 경우(모델·호스트 쪽)이고 조수의 불합격과 따로 센다. 어느 것도 다시 돌려 초록으로 바꾸지 않는다 —
  이미 결과가 있는 일은 덮어쓰지 않고 실패한다(`--skip-completed` 는 남은 일만).
- `summary.json`/`SUMMARY.md`: 합계 · 가족별 · 픽스처별 · 중앙값(호출·시간·모델 호출·토큰·지시문 글자·도구 수) · 일마다. 종료 코드는 실행기가 끝까지 돌았는지만 말한다.
- 요청 크기 영수증: `editorDriver.mjs` 가 `prompt_inspection` 스냅숏에서 **글자 수와 도구 이름만** 남긴다(`sizes`: 절마다 글자 수 · 지시문 글자 수 · 실린 도구).
  지시문 본문은 저장하지 않는다. 턴 기록(`turns/NNN.json`)의 `prompts`(모델 호출마다) · `v2Final` · `turnMs` 가 여기서 나온다.
- 재판정(`small-jobs-rescore`): 판정기를 고쳤으면 모델을 다시 부르지 않는다. `before/after.json.gz` 에 번들 타일셋을 되붙여 지금의 판정을 돌리고,
  상태·까닭이 달라진 일은 처음 판정을 `liveVerdict` 로 남긴다. 실행기와 같은 상태 규칙(`decide`)을 쓴다.
- 보고서(`small-jobs-report`): 자체완결 HTML. 실행 폴더에 `causes.json`(`[{title, why, jobs:[id…]}]` — 결과를 읽은 사람이 쓴다)이 있으면 원인별로 묶고,
  없으면 통과하지 못한 일을 판정 글 그대로 싣는다. `disclosures.json`(문자열 배열)은 「판정에 대해 알아 둘 것」에 싣고, 재판정으로 상태가 바뀐 일은
  `liveVerdict` 에서 계산해 표로 보인다(실행 때 판정 → 지금). 픽스처별 표(통과·«완료»·호출·시간·토큰 중앙값)도 함께 낸다.
  `--before <앞 실행 폴더>` 를 주면 맨 위에 전/후 표를 싣는다: 통과·중앙값·`generate_art`/`define_ending`/`edit_place` 거절 수, 가족·픽스처별,
  앞에서 통과했다가 지금 통과하지 못한 일(회귀)과 앞에서 통과하지 못한 일을 일마다(앞 까닭 → 지금 까닭).

### 기준선 — 2026-11-11, main `46274bc35f`, Terra high + v2

한 번 돌렸다(04:23~05:39 KST, 76분, 동시 2). 결과 원본은 저장소 밖 `~/z-project/assistant-fable-runs/smalljobs/baseline-46274bc35f/`,
보고서 http://mdc-server:18301/assistant-small-jobs.html. 실패한 일을 다시 돌리지 않았다.

**통과 23/30** · 불합격 7 · 시간 초과 0 · 기반 오류 0 · 턴이 «완료»로 끝난 것 21 · 요청 밖 변경이 있었던 일 16(만든 게임 픽스처의 16개 전부 — 다른 픽스처는 0).
중앙값: 도구 호출 18 · 3.5분 · 모델 호출 20 · 입력 599k 토큰(캐시 읽기 포함) · 출력 1.9k · 지시문 32,371자 · 처음 실린 도구 39개(도구 설명 126,795자).
합계: 도구 호출 530 · 111.9분 · 입력 18.9M · 출력 55k.

| 가족 | 통과 | | 픽스처 | 통과 | 호출 중앙값 | 분 중앙값 | 입력 토큰 중앙값 |
|---|---|---|---|---|---|---|---|
| move | 2/3 | | blank | 1/2 | 4.5 | 1.2 | 175k |
| person | 3/3 | | starter | 11/12 | 11 | 1.7 | 256k |
| shop | 2/3 | | built | 11/16 | 23 | 5.3 | 762k |
| chest | 2/3 | | | | | | |
| sign | 3/3 | | | | | | |
| door | 1/2 | | | | | | |
| dialogue | 2/2 | | | | | | |
| rename | 2/3 | | | | | | |
| bgm | 2/2 | | | | | | |
| encounter | 2/2 | | | | | | |
| quest | 2/2 | | | | | | |
| fill | 0/2 | | | | | | |

불합격 7건의 원인(호출 기록으로 확인한 것):

- **코드 마무리 단계가 사람을 옮긴다** (2) — `move-npc-door-front`: 모델은 상인을 문 앞 (21,17)에 놓았고 턴 끝의 `clear_transfer_lanes` 뒤 저장본은 (20,17), 조수는 «완료».
  `door-backdoor-built`: 뒷문은 생겼지만 토르가 (23,12)→(24,12). 이 단계가 돈 일은 이 둘뿐이다(편집 기록 `output/edit-activity/index.json`).
- **눈 칩셋에서 `find_empty_ground` 가 「맨땅 0%」** (2) — `chest-gold-built` 는 자리를 못 정해 `place_chest` 를 부르지 않았고,
  `dress-snowfield-built` 는 맵 왼쪽 끝 (0,14)~(1,18)에 놓아 구역 안 2칸.
- **요청 낱말로 고른 도구 묶음에 그 도구가 없다** (2) — `rename-title-built`(「노래」 → 음악 묶음, 도구 9개, 제목 도구·`load_tools` 없음),
  `dress-trees-starter`(장소 묶음 15개, `edit_place` 5번 거절, 물건 놓기 도구를 불러올 수 없음).
- **할 일의 기계 확인이 요청보다 좁다** (1) — `shopkeeper-blank`: 확인 종류 person 이 통과해 «완료», 상점은 없다.

통과한 일에도 드는 값: 만든 게임 픽스처 16개 중 14개에서 요청 뒤에 완료 관문이 타이틀·엔딩을 할 일로 넣어
`generate_art(title)` → `generate_art(ending)` 거절 → `define_ending` 을 돈다(`generate_art` 41회 중 27회 거절, 일마다 그림 3장·타이틀·엔딩·오프닝 변경).
16개 모두에서 `blueprint_assembly` 가 돌았다. 그래서 같은 종류의 일이 만든 게임에서는 23회·5.3분, 시작 마을에서는 11회·1.7분이다.

판정 정정(모델 재실행 없음, `small-jobs-rescore`): 실행 직후 요약은 통과 9/30 이었다(`summary.live.json`). 차이 14건은 판정기 결함이다 —
저장·재로드 기준(파일 해시 → 새 컨텍스트가 읽은 내용) 12건, 공통 이벤트 호출을 따라가지 않던 시뮬레이터 1건(`give-key-once-starter`),
요청에 없는 「보이는 적」 조건 1건(`encounter-slimes-starter`). `dress-snowfield-built` 의 구역은 실행 뒤 넓혔고 넓힌 뒤에도 불합격이다.
고친 판정은 자기검사 30/30 을 다시 통과했다.

### 다시 재기 — 2026-11-11, main `84a7fa331a` (B1~B5a · 예산 · 끝맺음 수정 뒤)

같은 묶음·같은 판정·같은 모델 고정으로 한 번 돌렸다(07:58~08:39 KST, 41분). 판정은 고치지 않았고 재판정도 없다. 실행 전 자기검사 30/30.
원본 `~/z-project/assistant-fable-runs/smalljobs/after-84a7fa331a/`, 보고서 http://mdc-server:18301/assistant-small-jobs-after.html (맨 위가 전/후 표).

| | 기준선 `46274bc35f` | 지금 `84a7fa331a` |
|---|---|---|
| 통과 | 23/30 | **28/30** |
| 턴이 «완료»로 끝남 | 21 | 25 |
| 요청 밖 변경이 있었던 일 | 16 | 0 |
| 도구 호출 중앙값 (합계) | 18 (530) | 9 (325) |
| 걸린 시간 중앙값 (합계) | 3.5분 (111.9분) | 1.3분 (51.0분) |
| 모델 호출 중앙값 | 20 | 8 |
| 입력 토큰 중앙값 (합계) | 599k (18.9M) | 144k (6.8M) |
| 지시문 글자 중앙값 | 32,371 | 15,080 |
| 처음 실린 도구 수 중앙값 | 39 | 19 |
| `generate_art` 거절 / 호출 | 27 / 41 | 0 / 0 |
| 픽스처 blank · starter · built | 1/2 · 11/12 · 11/16 | 2/2 · 12/12 · 14/16 |

시간은 기계 부하가 달라(기준선 때 부하 평균 22~26, 이번 5~9) 일부는 부하 차이일 수 있다. 호출 수·토큰은 부하와 무관하다.

- 기준선 불합격 7건 중 6건 통과: `move-npc-door-front` · `shopkeeper-blank` · `chest-gold-built` · `rename-title-built` · `dress-trees-starter` · `dress-snowfield-built`.
- **아직 불합격** `door-backdoor-built` — 원인이 바뀌었다. 사람을 옮기던 마무리 단계는 없어졌고(맵 밖·다른 이벤트 변경 0), 지금은 `place_door` 가
  「타일셋 참고문서 선행 읽기 필요 (30건)」으로 3번 거절한다. 모델이 `read_tileset_reference` 를 「이 용도 전부」까지 읽은 뒤에도 같다. `create_transfer_pair` 는 부르지 않았다.
- **회귀** `pickup-key-built`(통과 → 불합격) — 두 실행 모두 낱개 열쇠 그림이 없어 `draw_object` 로 공방 카드를 올렸다(한 턴 안에는 놓이지 않는다).
  기준선은 그 뒤 끝맺음 관문의 할 일에서 다른 칩셋 키트의 열쇠 꾸러미를 `stamp_object` 로 찍어 「보이는 것」이 생겼고, 지금은 투명한 줍기 이벤트로 두고
  「그림 대기 중」이라고 정직하게 미완료로 보고했다. 요청이 「바닥에 떨어져 있게」이므로 판정은 그대로 불합격이다.
- 통과했지만 턴이 미완료인 것 3: `sign-starter` · `examine-fireplace-built`(조사 이벤트를 연출 비평이 인물 컷신으로 보고 「컷신 고치기」를 넣는다),
  `dress-trees-starter`(나무는 심었는데 그 전에 막힘 처리된 할 일이 남는다).
- 예산 밖 1: `door-roundtrip-starter` 만 처음 실린 도구 48개 · 지시문 34,755자(나머지는 9~21개).

### 둘째 묶음 — 새 가족 35가지 (`--set 2`, 2026-11-11)

첫 30가지에 없는 일을 잰다: 게임을 만들다 보면 늘 나오는 자료집 수정·세이브 지점·파티·조건·선택지·맵 속성·한 번만 나오는 장면·의뢰·상점 물건.
묶음 `harness-data/assistant-capability/small-jobs-2.json`(같은 모양 + `title`), 픽스처는 첫 묶음과 같은 셋(blank 4 · starter 15 · built 16).
실모델 실행은 아직 없다(2026-11-11 — 묶음과 판정만 넣었다).

```bash
npm run harness -- assistant-capability small-jobs-selfcheck --set 2 --out <폴더>              # 35/35 sound 여야 한다(약 2분)
npm run harness -- assistant-capability small-jobs --set 2 --model terra-high --v2 --out <새 폴더> [--only id,가족]
npm run harness -- assistant-capability small-jobs-report --run <그 폴더> --html <출력.html>    # 묶음은 summary.json 에서 읽는다
```

| 가족 | 무엇 | 일 | 판정 종류 |
|---|---|---|---|
| save | 세이브·회복 지점 | 2 | `serviceSpot` |
| itemdata | 아이템·장비 자료 | 3 | `recordFields` |
| enemy | 적 자료·보스전 | 3 | `recordFields` · `bossFight` |
| party | 주인공·파티 | 3 | `recordFields` · `startState` · `joinsParty` |
| gate | 누구와 얘기한 뒤에만 | 2 | `talkGated` |
| choice | 선택지 | 2 | `paidHeal` · `choiceBranches` |
| behave | NPC 움직임 | 2 | `npcMovement` |
| start | 시작 위치 | 2 | `startAt`(`allow.startPos`) |
| screens | 타이틀·게임 오버 글자 | 2 | `projectField` |
| mapprop | 맵 속성(날씨·어둠·저장·조우) | 4 | `mapWeather` · `mapDark` · `mapField` · `randomEncounter` |
| tidy | 지우기·복제·일괄 바꾸기 | 3 | `eventRemoved` · `giveOnce`(첫 묶음의 것) · `textReplaced` |
| sound | 타이틀·보스전 음악 | 2 | `projectField`(validMusic) · `battleMusic` |
| cutscene | 들어서면 한 번 나오는 장면 | 2 | `onEnterOnce` |
| questlog | 의뢰(퀘스트 목록) | 1 | `questFlow` |
| stock | 상점 물건 넣고 빼기 | 2 | `shopStock` |

판정은 첫 묶음과 같은 두 겹(outcome + damage)이고 도구 이름을 보지 않는다. 새로 생긴 것:

- **갈림을 길마다 따라간다**(`playPaths`). 첫 묶음의 `interact` 는 선택지의 모든 갈래를 합쳤다(그대로다 — `picks` 를 주지 않으면 같은 동작).
  「'예'를 고르면 10G 를 내고 회복, '아니오'면 그냥 끝」은 합치면 알 수 없어서, 선택지와 여관 질문(`inn` — 스스로 묻고 요금을 받고 회복한다)을
  갈림으로 보고 모든 길을 한 번씩 밟는다. `paidHeal` 은 「정확히 그 값을 내고 회복되는 길 + 아무 일 없는 길」이 있고 「공짜 회복·돈만 받는 길」이 없는지,
  `choiceBranches` 는 고른 글마다 그 대답만 나오는지 본다(「안 본다」는 「본다」가 아니다 — 고른 글에 든 가장 긴 이름표로 가른다).
- **맵에 들어서 본다**(`entryRuns`). 자동·병렬 이벤트는 엔진에서 맵에 들어올 때마다 한 번 돈다(`fireAutoTriggers` — 같은 페이지는 그 방문에서 한 번).
  그래서 「한 번만」은 셀프 스위치 같은 장치가 있어야 하고, 판정은 두 번 들어가 본다(`onEnterOnce` · `startState`). 날씨·어둠은 맵 속성(`climate` · `defaultLighting`)이든
  들어설 때 켜는 명령(`setWeather` · `setLighting`)이든 받는다.
- **자료집 기록은 이름으로 찾고 칸으로 본다**(`recordFields`). `expect`(값) · `scale`(전 값의 배수) · `keep`(그대로여야 하는 칸). 새 기록(`isNew`)은 전에 없던 id 여야 한다 —
  있던 아이템의 이름을 바꾼 것은 새 아이템이 아니다. 쓰면 회복되는 약은 `type:"medicine"` + `hpRecovery`(엔진의 `itemUsage` 가 약에만 회복량을 준다).
- **대화 순서**(`talkGated` · `questFlow`). 같은 상태로 사람들에게 차례로 말을 건다: 먼저 가면 옛 반응, 그 사람과 얘기한 뒤에 가면 새 반응. 의뢰는 퀘스트 목록(`project.quests`)에
  새 제목이 있고 의뢰인 → 단계 대상 → 의뢰인 순서에서 보상이 정확히 한 번 나와야 한다.
- **damage 의 예외 하나**: 시작 위치를 옮기는 일만 `allow.startPos`. 글 일괄 바꾸기(`anyEvent`)는 모든 이벤트가 대상이라 「다른 이벤트 내용 바뀜」을 세지 않는다.
- 넣지 않은 것과 까닭: 「문을 열 때 효과음」(문 소리의 표현이 셋 — 이동 명령 앞 효과음, `transfer.door` 연출, 맵의 문 기록 `set_map_door` — 이라 결과 하나로 판정하기 어렵다),
  「밤에는 집에 들어가 있게」(시간 시스템을 켜야 하는 `set_npc_schedule` — 한 문장 일이 아니다), 「왼쪽을 보고 서 있게」(걷기 칩은 프레임 `pattern` 과 `direction` 두 칸이 방향에 함께 관여해 저장 문서만으로 어느 쪽을 보는지 정하기 어렵다),
  `script` 명령으로 쓴 논리(시뮬레이터가 따라가지 않는다 — 첫 묶음과 같은 한계).

| # | id | 가족 | 픽스처 | 요청 | 판정(저장 문서) |
|---|---|---|---|---|---|
| 1 | `savepoint-blank` | save | blank | 이 맵에 세이브 포인트 하나 놓아 줘 | `serviceSpot` — 빈 맵/동쪽 들판의 새(보이는) 이벤트를 조사하면 저장 메뉴·체크포인트 — 두 번째에도 |
| 2 | `heal-spring-built` | save | built | 겨울 시장에 회복의 샘을 하나 놓아 줘. 조사하면 파티 전원의 HP와 MP가 다 차게 해 줘 | `serviceSpot` — 겨울 시장의 새(보이는) 이벤트를 조사하면 파티 전원 회복 — 두 번째에도 |
| 3 | `item-price-starter` | itemdata | starter | 회복약 가격을 80G로 바꿔 줘 | `recordFields` — 자료집 items 의 「회복약」: price=80 · 그대로: name, type, hpRecovery |
| 4 | `item-new-built` | itemdata | built | '눈꽃 차'라는 새 아이템을 만들어 줘. 쓰면 HP를 50 회복하는 약이고, 가격은 30G로 해 줘 | `recordFields` — 자료집 items 의 새 「눈꽃 차」: price=30, type="medicine", hpRecovery.flat=50 |
| 5 | `equip-attack-blank` | itemdata | blank | 철 검의 공격력을 12로 낮춰 줘 | `recordFields` — 자료집 equipment 의 「철 검」: statBonuses.attack=12 · 그대로: name, price, statBonuses.defense, statBonuses.agility |
| 6 | `enemy-gold-starter` | enemy | starter | 슬라임을 쓰러뜨리면 15G를 얻게 해 줘 | `recordFields` — 자료집 enemies 의 「슬라임」: rewards.gold=15 · 그대로: name, stats, rewards.exp |
| 7 | `enemy-hp-double-built` | enemy | built | 얼음의 파수꾼의 HP를 지금의 두 배로 늘려 줘 | `recordFields` — 자료집 enemies 의 「얼음의 파수꾼」: stats.maxHp = 전 값×2 · 그대로: name, stats.attack, stats.defense, rewards |
| 8 | `boss-line-starter` | enemy | starter | 동쪽 들판에 보스로 돌 골렘을 세워 줘. 말을 걸면 "여기는 지나갈 수 없다."라고 말한 뒤에 전투가 시작되게 해 줘 | `bossFight` — 빈 맵/동쪽 들판의 새(보이는) 이벤트에 말을 걸면 「여기는 지나갈 수 없다」 뒤에 전투, 부대에 「돌 골렘」 |
| 9 | `hero-rename-blank` | party | blank | 주인공 이름을 '리아'로 바꿔 줘 | `recordFields` — 자료집 actors 의 시작 파티 첫 배우: name="리아" · 그대로: classId, initialLevel |
| 10 | `start-items-starter` | party | starter | 게임을 시작할 때 회복약 3개를 갖고 시작하게 해 줘 | `startState` — 새 게임의 시작 상태(또는 시작 맵의 자동 이벤트 한 번)로 회복약 정확히 3개 |
| 11 | `join-party-starter` | party | starter | 파수꾼 데릭한테 말을 걸면 동료가 되어 파티에 들어오게 해 줘 | `joinsParty` — 그 사람에게 처음 말을 걸면 자료집에 있는(시작 파티가 아닌) 배우 하나가 파티에 더해진다(changeParty add) |
| 12 | `gate-after-talk-starter` | gate | starter | 꼬마 미루와 먼저 얘기한 뒤에만 파수꾼 데릭이 "미루가 보냈구나. 지나가도 좋다."라고 말하게 해 줘. 그 전에는 지금 대사 그대로 둬 | `talkGated` — 먼저 말을 걸면 옛 대사 → 미루와 얘기한 뒤에는 「미루가 보냈구나. 지나가도 좋다」(미루의 원래 대사도 그대로) |
| 13 | `shop-after-talk-built` | gate | built | 족장 이르마와 얘기하기 전에는 떠돌이 상인이 물건을 팔지 않게 해 줘. 그 전에 말을 걸면 "족장님부터 뵙고 오게."라고만 하게 해 줘 | `talkGated` — 먼저 말을 걸면 「족장님부터 뵙고 오게」만 나오고 상점이 안 열린다 → 이르마와 얘기한 뒤에는 상점이 열린다 |
| 14 | `choice-pay-heal-starter` | choice | starter | 마을에 치유사 한 명 세워 줘. 말을 걸면 "10G에 치료해 줄까?" 하고 묻고, '예'를 고르면 10G를 내고 파티가 회복되게, '아니오'를 고르면 그냥 끝나게 해 줘 | `paidHeal` — 잿불 마을의 새 사람: 갈림(선택지·여관 질문)의 한 길은 정확히 10G 를 내고 전원 회복, 다른 길은 아무 일 없음. 공짜 회복·돈만 받는 길 없음 |
| 15 | `choice-branches-built` | choice | built | 겨울 시장의 장터 주민한테 말을 걸면 "모피 좀 볼래요?"라고 묻고 '본다'와 '안 본다' 중에 고르게 해 줘. '본다'를 고르면 "잘 골랐어요!", '안 본다'를 고르면 "다음에 또 와요."라고 답하게 해 줘 | `choiceBranches` — 말을 걸면 「모피 좀 볼래요」를 묻고 '본다' → 「잘 골랐어요」 · '안 본다' → 「다음에 또 와요」(다른 갈래의 대답은 안 나온다) |
| 16 | `npc-wander-starter` | behave | starter | 파수꾼 데릭이 가만히 서 있지 말고 주변을 돌아다니게 해 줘 | `npcMovement` — 처음 상태의 페이지가 제자리(fixed)가 아니다, 대사 그대로 |
| 17 | `npc-still-starter` | behave | starter | 꼬마 미루가 돌아다니지 않고 제자리에 서 있게 해 줘 | `npcMovement` — 모든 페이지의 움직임이 제자리(fixed), 대사 그대로 |
| 18 | `start-in-house-built` | start | built | 게임을 족장의 긴 집 안에서 시작하게 해 줘 | `startAt` — 시작 맵 = 족장의 긴 집, 걸을 수 있는 빈 칸 |
| 19 | `start-near-npc-starter` | start | starter | 시작 위치를 여관 주인 마사 바로 앞으로 옮겨 줘 | `startAt` — 시작 맵 = 잿불 마을, 걸을 수 있는 빈 칸 · 마사에게서 1칸 안 |
| 20 | `title-subtitle-built` | screens | built | 타이틀 화면의 부제를 '눈보라 속의 첫걸음'으로 바꿔 줘 | `projectField` — system.titleScreen.logoSubtitle = 「눈보라 속의 첫걸음」 |
| 21 | `gameover-text-starter` | screens | starter | 게임 오버 화면에 "여기서 끝낼 수는 없다."라는 문구가 나오게 해 줘 | `projectField` — system.gameOver.message, system.gameOver.title 에 「여기서 끝낼 수는 없다」 |
| 22 | `weather-rain-blank` | mapprop | blank | 이 맵에 비가 내리게 해 줘 | `mapWeather` — 빈 맵/동쪽 들판: 맵 기후가 rain 로 고정됐거나, 들어서면 저절로 도는 이벤트가 rain 를 켠다 |
| 23 | `dark-cave-built` | mapprop | built | 얼음 동굴을 어둡게 해 줘 | `mapDark` — 얼음 동굴: 기본 조명(또는 들어설 때 켜는 조명)의 어둠 ≥ 0.3 |
| 24 | `no-save-built` | mapprop | built | 서리 절벽에서는 저장을 못 하게 해 줘 | `mapField` — 서리 절벽.disableSave = true |
| 25 | `random-encounter-starter` | mapprop | starter | 동쪽 들판을 걸어 다니면 가끔 슬라임이 튀어나와 전투가 벌어지게 해 줘 | `randomEncounter` — 빈 맵/동쪽 들판: 조우율 > 0, 나올 부대가 자료집에 있고 모든 적 이름에 「슬라임」 |
| 26 | `remove-npc-built` | tidy | built | 겨울 시장의 시장 손님을 지워 줘 | `eventRemoved` — 그 이벤트가 없다(다른 삭제는 damage) |
| 27 | `copy-chest-built` | tidy | built | 서리 절벽에 있는 보물상자와 똑같은 상자를 그 옆에 하나 더 놓아 줘 | `giveOnce` — 서리 절벽의 새(보이는) 이벤트가 처음에 정확히 500골드, 다시 열면 0 — 원래 상자에서 2칸 안 |
| 28 | `replace-name-built` | tidy | built | 게임에 나오는 '이르마'라는 이름을 전부 '이르나'로 바꿔 줘 | `textReplaced` — 눈에 보이는 글(이벤트 이름·대사·선택지·안내·퀘스트)에 「이르마」가 없고 「이르나」가 그만큼 늘었다 |
| 29 | `title-bgm-starter` | sound | starter | 타이틀 화면에 음악이 나오게 해 줘 | `projectField` — system.titleScreen.musicResourceId = 곡 목록에 있는 곡 |
| 30 | `boss-bgm-built` | sound | built | 얼음 동굴에서 얼음의 파수꾼과 싸울 때는 보통 전투와 다른 음악이 나오게 해 줘 | `battleMusic` — 그 이벤트의 전투 바로 앞에서 전투 곡을 곡 목록의 다른 곡으로 바꾼다. 전투 상대·이긴 뒤 진행 그대로 |
| 31 | `enter-once-text-built` | cutscene | built | 얼어붙은 호수에 처음 들어가면 "발밑의 얼음이 낮게 운다."라는 글이 나오게 해 줘. 한 번만 나오게 해 줘 | `onEnterOnce` — 얼어붙은 호수의 자동·병렬 이벤트가 처음에 「발밑의 얼음이 낮게 운다」, 다시 들어오면 안 나온다 |
| 32 | `walk-up-greet-starter` | cutscene | starter | 게임을 시작하면 꼬마 미루가 주인공한테 걸어와서 "어서 와, 기다렸어!"라고 말하게 해 줘. 한 번만 나오게 해 줘 | `onEnterOnce` — 잿불 마을의 자동·병렬 이벤트가 처음에 「어서 와, 기다렸어」(미루를 움직인 뒤), 다시 들어오면 안 나온다 |
| 33 | `quest-errand-starter` | questlog | starter | 꼬마 미루가 주는 의뢰를 하나 만들어 줘. 이름은 '약초 배달'이고, 여관 주인 마사에게 말을 걸면 할 일이 끝나. 그다음 미루에게 돌아가면 보상으로 50G를 받게 해 줘. 퀘스트 목록에도 뜨게 해 줘 | `questFlow` — 퀘스트 목록에 「약초 배달」 + 미루 → 마사 → 미루 순서로 말을 걸면 정확히 50G, 한 번만 |
| 34 | `stock-add-built` | stock | built | 눈보라 마을의 떠돌이 상인이 '기록용 깃펜'도 팔게 해 줘. 지금 파는 물건은 그대로 두고 | `shopStock` — 파는 물건 = 전에 팔던 것 + 기록용 깃펜 |
| 35 | `stock-remove-built` | stock | built | 눈보라 마을의 떠돌이 상인이 해독초는 더 이상 팔지 않게 해 줘 | `shopStock` — 파는 물건 = 전에 팔던 것 − 해독초 |

자기검사 2026-11-11: 둘째 묶음 **35/35 sound**, 첫 묶음 30/30 sound. 첫 묶음의 판정이 그대로인 근거 — 같은 기준 커밋(`d4a4ae29f4`)의 자기검사 결과와
일마다 판정 글(손대지 않음·손 정답·오답·파괴)이 30행 모두 같고, 실모델 실행 `after-84a7fa331a` 의 전/후 문서를 지금 코드로 재판정해 상태가 바뀐 일 0건(28/30 그대로).
판정 부품을 `checkSupport.ts` 로 옮기면서 자기검사의 문서 사본이 타일셋 본문을 나눠 쓰게 했다(`cloneDoc` — 복제 1.4초 중 1.3초가 타일셋이었다. 도구 실행기는 원본 타일셋을
제자리에서 고치지 않는다): 첫 묶음 자기검사 약 2분 → 1분. CI 는 `test/smallJobsSecondSet.test.ts` 가 같은 것(손대지 않으면 불합격 · 손 정답 합격 · 오답 불합격)을 일마다 본다.

### 셋째 묶음 — JRPG 가 아닌 게임의 장치 36가지 (`--set 3`, 2026-11-11)

오너 2026-11-11 「JRPG 만 만들게 아니잖아」. 추리·연애·공포·농장·몬스터 수집·퍼즐·액션·경제·여러 엔딩·생존 게임이 쓰는 **장치 하나**를 일 하나로 잰다.
어느 장치에 도구가 없고 어느 도구가 v2 에 안 실리는지는 `openwiki/assistant-v2-genre-tools.md` 의 재고 표가 적는다 — 이 묶음은 그 표의 줄을 재는 자다.
묶음 `harness-data/assistant-capability/small-jobs-3.json`(같은 모양), 픽스처는 같은 셋(blank 3 · starter 28 · built 5), 오답 135개 · 다른 모양의 정답 21개.

**Terra 기준선(수리 전, main `03a604e917`, 2026-11-11)** — `~/z-project/assistant-fable-runs/smalljobs/set3-base-03a604e917/`, 쪽 `~/claude-viz/assistant-small-jobs-set3.html`:
**통과 25/36** · 불합격 10 · 시간 초과 1 · 턴이 «완료»로 끝난 것 22 · 도구 호출 741(오류 52) · 중앙값 16호출 · 2.8분 · 입력 385k 토큰.
통과하지 못한 11건은 두 원인이다(`causes.json`): 그 장치의 도구가 v2 에 없다 8(액션 전투 맵 · 보관 상자 · 작물 · 낚시 · 기한 엔딩 · 함정 체크포인트 · 잠긴 문 · 포획) · 장치 요청이 장소 짓기/게임 하나로 읽혔다 3(밭 · 액션 슬라임 · 꽃잎 체력 — 68호출 뒤 시간 초과, 맵 하나 삭제).
통과한 일도 싸지 않다 — 얘기한 사람 수 엔딩 42호출 · 선물 36 · 고백 32 · 증거 내밀기 27 · 제한 시간 25(이벤트 명령 손 조립). 가족별: 추리 3/3 · 연애 4/4 · 달력 3/4 · 공포 3/5 · 농장 1/5 · 경제 2/2 · 몬스터 2/3 · 퍼즐 3/4 · 액션 0/2 · 엔딩 3/3 · 생존 1/1.
알아 둘 것(`disclosures.json`): `accuse-ending-starter` 첫 시도는 편집기 기동에서 죽어(SQLite «database is locked», 모델 호출 0) 그 일만 한 번 다시 돌렸다 · 기계를 다른 측정과 같이 써서 시간은 길 수 있다 · 화면은 보지 않았다(화면 미검증).
**실행하는 체크아웃의 소스를 실행 중에 고치지 않는다** — 조수 일꾼은 빌드가 아니라 소스(`scripts/oh-my-pi-worker.ts`)에서 돈다. 첫 실행은 그렇게 오염돼 버렸다(`set3-contaminated-03a604e917/NOT-A-BASELINE.md`).
수리(`openwiki/assistant-v2-genre-tools.md` 「첫 수리」) 뒤의 같은 실행은 아직 없다.

```bash
npm run harness -- assistant-capability small-jobs-selfcheck --set 3 --out <폴더>              # 36/36 sound 여야 한다
npm run harness -- assistant-capability small-jobs --set 3 --model terra-high --v2 --out <새 폴더> [--only id,가족]
npm run harness -- assistant-capability small-jobs-report --run <그 폴더> --html <출력.html>
```

| 가족 | 무엇 | 일 | 판정 종류 |
|---|---|---|---|
| mystery | 추리 — 증거·지목 | 3 | `presentReacts` · `choiceEndings` · `itemsGatedText` |
| romance | 연애 — 호감·선물·고백 | 4 | `affectionLine` · `giftReacts` · `affectionEnding` |
| calendar | 달력 — 기한·시간표·잠 | 4 | `timePhaseLine` · `deadlineEnding` · `npcSchedule` · `sleepNextDay` |
| horror | 공포 — 숨기·추격·함정·체력 | 5 | `hidingSpot` · `chaser` · `deathTrap` · `lifeGauge` |
| farm | 농장·생활 — 밭·작물·낚시·제작·보관 | 5 | `farmPlot` · `cropDefined` · `fishingSpot` · `craftStation` · `storageChest` |
| economy | 경제 — 판매가·통행료 | 2 | `sellPrice` · `paidGate` |
| monster | 몬스터 수집 — 포획·첫 몬스터·트레이너 | 3 | `projectField` · `starterPick` · `sightBattle` |
| puzzle | 퍼즐·탈출 — 암호·밀기·잠긴 문·제한 시간 | 4 | `passwordLock` · `pushable` · `lockedTransfer` · `timeLimit` |
| action | 액션 전투 | 2 | `actionMap` · `actionSpawn` |
| endings | 여러 엔딩·읽는 게임 | 3 | `choiceEndings` · `flagsEnding` · `projectField` |
| survival | 생존 — 수치 게이지 | 1 | `hudGauge` |

판정은 앞 묶음과 같은 두 겹(outcome + damage)이고 도구 이름을 보지 않는다. 판정 코드는 `checksGenre.ts`(놓인 것·자료 — 15종)와 `checksGenrePlay.ts`(따라가 보는 것 — 16종)이고
`checks.ts` 가 다섯 표를 합친다(이름이 겹치면 로드에서 던진다). 새로 생긴 것:

- **따라가기가 장르 명령을 안다**(`checkSupport.ts interact`). `presentItem`(가진 후보마다 한 갈래 + 닫기, `consume` 이면 하나 준다) · `changeFriendship` · `giveMonster` · `inputNumber`(`enter` 가 준 값) ·
  `timer`(남은 시간·도는지) · `triggerEnding`(엔딩의 조건이 참일 때만) · `gameOver`/`killPlayer` · `gotoLabel`(「아니오」면 처음부터 — 두 번까지 되돌아간다).
  **앞 묶음의 판정은 그대로다**: 내밀기·되돌아가기는 `picks` 를 줄 때만(길마다 따라갈 때만) 갈리고, 엔딩에서 멈추는 것은 `halt` 를 줄 때만이다.
- **호감도는 엔진과 같은 키에 쌓인다.** `changeFriendship`·`friendshipAtLeast` 의 키는 적은 `npcKey`, 없으면 그 이벤트의 `characterId` 다(이벤트 id 로 떨어지지 않는다 — 둘 다 없으면 조용히 0).
  판정(`affectionLine`·`giftReacts`·`affectionEnding`)은 변수로 쌓든 호감도로 쌓든 받는다 — 「말을 걸 때마다 값 하나가 오르고, 문턱 전에는 옛 말·문턱 뒤에는 새 말」만 본다.
- **엔딩까지 가 본다**(`choiceEndings`·`affectionEnding`·`deadlineEnding`·`flagsEnding`). 엔딩 이름이 자료(`project.endings`)에 있고, 그 길의 끝이 그 엔딩이며 다른 길은 그 엔딩이 아니다.
  기한 엔딩은 `timeSystem.onDayEnd` 의 날짜·조건을, 조건으로 갈리는 엔딩은 두 상태(다 얘기함 / 하나 빠짐)를 넣어 본다.
- **놓인 장치는 엔진이 읽는 칸으로 본다.** 은신처·밀 수 있는 것 = 페이지의 `interaction.kind` + 그 칸에 보이는 그림 + 닿는 자리, 추격자 = `movement.type:"chase"` + 닿으면 끝나는 명령(+ `armedBy`: 그 물건을 얻기 전에는 꺼져 있다),
  함정 = 밟으면 `killPlayer`/`gameOver` + 그 맵의 체크포인트, 밭 = `map.farmableArea`(걸을 수 있는 칸), 낚시 = `system.fishing` 의 그 맵 낚시터와 어종, 액션 = `map.actionCombat` · `map.fieldSpawns`, 시야 전투 = `detectionEncounter.sight`.
- **암호는 틀린 값으로도 눌러 본다**(`passwordLock`). 숫자 입력(`inputNumber`)이면 맞는 값과 틀린 값을 넣고, 숫자 선택지면 모든 길을 밟아 여는 길이 정확히 하나인지 본다.
  (`compile_puzzle` 이 짓는 선택지는 맞는 숫자가 늘 첫 칸이다 — 판정은 통과시키되 재고 표에 계약 결함으로 적었다.)
- **제한 시간**(`timeLimit`)은 타이머를 시작하는 것(들어설 때 저절로)과 0 이 되면 끝나는 것(타이머 조건의 자동·병렬 페이지)을 따로 찾고, 들어서자마자 끝나면 불합격이다.
- 넣지 않은 것과 까닭: 「시간이 지나면 배고픔이 준다」(병렬 이벤트 + `wait` — 시뮬레이터가 시간을 흘리지 않는다), 「먹으면 배고픔이 찬다」(아이템 사용이 변수를 못 바꾼다 — 엔진에 없다),
  「재고가 3개뿐인 물건」(`ShopStockEntry` 에 수량이 없다), 사건 통째·캠페인 통째(작은 일이 아니다 — 게임 하나 경로).

| # | id | 가족 | 픽스처 | 요청 | 판정 종류 — 손 정답에 나온 판정 글 |
|---|---|---|---|---|---|
| 1 | `evidence-present-starter` | mystery | starter | 파수꾼 데릭에게 말을 걸면 가진 물건 중에 하나를 골라 내밀 수 있게 해 줘. '낡은 열쇠'를 내밀면 "그 열쇠… 내가 숨긴 게 맞다."라고 자백하고, 다른 물건을 내밀면 "그건 나와 상관없는 물건이야."라고 하게 해 줘. 지금 하던 말은 그대로 두고 | `presentReacts` — 파수꾼 데릭: 「낡은 열쇠」→「내가 숨긴 게 맞다」 · 「회복약」→「나와 상관없는 물건」 |
| 2 | `accuse-ending-starter` | mystery | starter | 꼬마 미루에게 말을 걸면 "범인이 누구라고 생각해?"라고 묻고 '마사', '데릭', '모르겠다' 중에 고르게 해 줘. '데릭'을 고르면 '사건 해결'이라는 엔딩이 나오고, 나머지를 고르면 "음… 좀 더 알아보자."라고만 하게 해 줘 | `choiceEndings` — 꼬마 미루: 「데릭」→엔딩 「사건 해결」 · 「마사」→「좀 더 알아보자」 · 「모르겠다」→「좀 더 알아보자」 |
| 3 | `clues-all-gate-starter` | mystery | starter | '피 묻은 편지', '깨진 안경', '젖은 장화'라는 증거 아이템 세 개를 만들어 줘. 세 개를 전부 갖고 있을 때만 파수꾼 데릭이 "전부 알아냈군. 내가 졌다."라고 말하게 하고, 하나라도 없으면 지금 대사 그대로 둬 | `itemsGatedText` — 파수꾼 데릭: 피 묻은 편지·깨진 안경·젖은 장화 를 다 가지면 「내가 졌다」 |
| 4 | `affection-grows-starter` | romance | starter | 여관 주인 마사에게 말을 걸 때마다 호감도가 1씩 오르게 해 줘. 호감도가 3 이상이 되면 "오늘은 특별히 따뜻한 차를 내올게요."라는 말도 하게 해 줘. 지금 하던 말과 숙박은 그대로 두고 | `affectionLine` — 여관 주인 마사: 말을 걸 때마다 friend:masa +1 · 3 이상이면 「따뜻한 차를 내올게요」 |
| 5 | `gift-affection-starter` | romance | starter | 여관 주인 마사에게 '회복약'을 선물할 수 있게 해 줘. 말을 걸면 선물할지 고르게 하고, 선물하면 회복약이 하나 줄고 호감도가 2 오르면서 "어머, 고마워요! 잘 쓸게요."라고 말하게 해 줘. 회복약이 없으면 선물 얘기는 나오지 않게 하고, 지금 하던 말과 숙박은 그대로 둬 | `giftReacts` — 여관 주인 마사: 「회복약」을 건네면 −1 · 호감 +2 · 「잘 쓸게요」 |
| 6 | `confess-ending-starter` | romance | starter | 여관 주인 마사와 친해지는 이야기를 만들어 줘. 마사에게 말을 걸면 '이야기를 나눈다'와 '고백한다' 중에 고르게 하고, 이야기를 나눌 때마다 호감도가 1씩 오르게 해 줘. 호감도가 3 이상일 때 '고백한다'를 고르면 '함께 여는 여관'이라는 엔딩이 나오고, 모자라면 "아직은 마음의 준비가 안 됐어요."라고 거절하게 해 줘 | `affectionEnding` — 여관 주인 마사: 일찍 고백하면 「마음의 준비가 안 됐어요」, 3번 얘기한 뒤에는 엔딩 「함께 여는 여관」 |
| 7 | `affection-two-pages-built` | romance | built | 겨울 시장의 모피 상인에게 말을 걸 때마다 호감도가 1씩 오르게 해 줘. 호감도가 3 이상이 되면 "자네에게는 이 목도리를 그냥 주고 싶군."이라는 말도 하게 해 줘. 지금 하는 말들은 그대로 두고 | `affectionLine` — 모피 상인: 말을 걸 때마다 friend:furrier +1 · 3 이상이면 「이 목도리를 그냥 주고 싶군」 |
| 8 | `night-line-starter` | calendar | starter | 게임에 시간이 흐르게 하고, 밤에는 파수꾼 데릭이 "밤에는 문을 열 수 없다. 해가 뜨면 다시 와라."라고 말하게 해 줘. 낮에는 지금 대사 그대로 두고 | `timePhaseLine` — 파수꾼 데릭: night 에만 「밤에는 문을 열 수 없다」 |
| 9 | `deadline-ending-starter` | calendar | starter | 게임에 날짜가 흐르게 하고, 3일째 하루가 끝나면 '늦어 버린 약속'이라는 배드 엔딩이 나오게 해 줘 | `deadlineEnding` — 3일째 하루가 끝나면 엔딩 「늦어 버린 약속」 |
| 10 | `npc-night-schedule-starter` | calendar | starter | 게임에 시간이 흐르게 하고, 파수꾼 데릭이 밤에는 여관 주인 마사 옆에 가 있게 해 줘. 낮에는 지금 자리에 그대로 있게 하고 | `npcSchedule` — 파수꾼 데릭: night → (7,10), 여관 주인 마사 곁 |
| 11 | `sleep-next-day-starter` | calendar | starter | 게임에 시간이 흐르게 하고, 여관 주인 마사에게 묵으면 다음 날 아침이 되게 해 줘 | `sleepNextDay` — 여관 주인 마사: 묵으면 다음 날 아침 |
| 12 | `hiding-spot-starter` | horror | starter | 마을에 숨을 수 있는 큰 나무통을 하나 놓아 줘. 괴물한테 쫓길 때 그 안에 들어가 숨을 수 있게 해 줘 | `hidingSpot` — 큰 나무통 @ 잿불 마을 (9,12) |
| 13 | `chaser-starter` | horror | starter | 동쪽 들판에 주인공을 쫓아오는 괴물을 하나 놓아 줘. 붙잡히면 게임 오버가 되게 해 줘 | `chaser` — ev_chaser_134971f4-c765-408c-9151-90f9a1c2821f @ 동쪽 들판 (14,7) — 쫓아와 닿으면 게임 오버 |
| 14 | `chase-after-key-starter` | horror | starter | 동쪽 들판에 '낡은 열쇠'를 놓아 줘. 열쇠를 주우면 그때부터 괴물이 쫓아오게 하고, 붙잡히면 게임 오버가 되게 해 줘. 열쇠를 줍기 전에는 괴물이 쫓아오면 안 돼 | `chaser` — ev_chaser_a903fb23-44c0-4e11-a4c6-b8b64bb80032 @ 동쪽 들판 (14,7) — 낡은 열쇠에서 「낡은 열쇠」을 주운 뒤부터 쫓아온다 |
| 15 | `trap-checkpoint-starter` | horror | starter | 동쪽 들판 한가운데에 밟으면 죽는 함정을 놓아 줘. 죽으면 동쪽 들판에 들어온 곳에서 다시 시작하게 해 줘 | `deathTrap` — ev_trap_d3f25e96-b06d-41de-a0c3-bda25ee60f0f @ 동쪽 들판 (10,7) · 들어설 때 체크포인트 |
| 16 | `life-petals-starter` | horror | starter | 꽃잎 5장을 체력으로 쓰는 게임으로 만들어 줘. 화면에 꽃잎이 보이게 하고, 마을에 가시덤불을 하나 놓아서 조사할 때마다 꽃잎이 1장씩 줄게 해 줘. 0장이 되면 게임 오버가 되게 해 줘 | `lifeGauge` — 가시덤불 @ 잿불 마을 (9,12) — var_life_petals 5→0, 0 이면 게임 오버 |
| 17 | `farm-plot-starter` | farm | starter | 마을 빈 땅에 밭을 6칸 만들어 줘. 괭이로 갈아서 씨앗을 심을 수 있게 해 줘 | `farmPlot` — 잿불 마을 밭 6칸 |
| 18 | `crop-turnip-starter` | farm | starter | '순무'라는 작물을 만들어 줘. '순무 씨앗'을 심으면 3일 뒤에 '순무'를 수확할 수 있게 해 줘 | `cropDefined` — 작물 「순무」: 순무 씨앗 → 3일 → 순무 |
| 19 | `fishing-built` | farm | built | 얼어붙은 호수에서 낚시를 할 수 있게 해 줘. '빙어'가 낚이게 해 줘 | `fishingSpot` — 낚시터 spot_ref_lake (18,5 8×4) — 빙어 |
| 20 | `craft-station-starter` | farm | starter | 마을에 연금술사를 한 명 세워 줘. 말을 걸면 회복약 2개로 상급 회복약 1개를 만들 수 있게 해 줘 | `craftStation` — 연금술사 @ 잿불 마을 (10,12) — 제작법 recipe_ref_hi_potion |
| 21 | `storage-chest-starter` | farm | starter | 마을에 보관 상자를 하나 놓아 줘. 가진 물건을 넣어 두었다가 나중에 다시 꺼낼 수 있게 해 줘 | `storageChest` — ev_storage_chest_e7583bc3-5796-4264-a3c4-1a8bffe6f4a1 @ 잿불 마을 (9,12) |
| 22 | `sell-price-built` | economy | built | 회복약을 상점에 팔 때 30G를 받게 해 줘 | `sellPrice` — 「회복약」 판매가 30G |
| 23 | `toll-gate-starter` | economy | starter | 파수꾼 데릭에게 말을 걸면 "통행료는 50G다. 내겠나?" 하고 묻게 해 줘. '낸다'를 고르면 50G를 내고 "좋다, 지나가라."라고 하고, 돈이 모자라면 "돈이 모자라군."이라고 하게 해 줘. 한 번 낸 뒤에는 다시 받지 않게 해 줘 | `paidGate` — 파수꾼 데릭: 50G 를 내면 「지나가라」, 모자라면 「돈이 모자라군」, 한 번만 받는다 |
| 24 | `capture-on-blank` | monster | blank | 야생 몬스터와 싸울 때 몬스터를 잡을 수 있게 해 줘 | `projectField` — system.monsterCollection = true |
| 25 | `starter-pick-blank` | monster | blank | 이 맵에 박사를 한 명 세워 줘. 말을 걸면 몬스터 세 마리 중에 한 마리를 골라서 받게 해 줘. 한 번만 받을 수 있게 해 줘 | `starterPick` — ev_starter_monsters @ 빈 맵 (8,6) — 3종 가운데 하나, 한 번만 |
| 26 | `trainer-sight-blank` | monster | blank | 이 맵에 트레이너를 한 명 세워 줘. 눈이 마주치면 다가와서 몬스터 배틀을 걸게 해 줘 | `sightBattle` — 트레이너 @ 빈 맵 (15,7) |
| 27 | `password-safe-starter` | puzzle | starter | 마을에 금고를 하나 놓아 줘. 조사하면 비밀번호를 묻고, '0427'을 맞게 넣으면 '낡은 열쇠'를 얻게 해 줘. 틀리면 "틀렸다."라고만 나오게 해 줘 | `passwordLock` — 금고 @ 잿불 마을 (9,12) — 「0427」로 「낡은 열쇠」, 한 번만 |
| 28 | `push-rock-starter` | puzzle | starter | 동쪽 들판에 밀 수 있는 바위를 하나 놓아 줘 | `pushable` — 바위 @ 동쪽 들판 (10,7) |
| 29 | `lock-door-key-built` | puzzle | built | 눈보라 마을에서 족장의 긴 집으로 들어가는 문을 잠가 줘. '낡은 열쇠'를 갖고 있을 때만 들어갈 수 있게 하고, 없으면 "문이 잠겨 있다."라고 나오게 해 줘 | `lockedTransfer` — 문 4칸: 「낡은 열쇠」이 있어야 들어간다, 없으면 「문이 잠겨 있다」 |
| 30 | `time-limit-starter` | puzzle | starter | 동쪽 들판에 들어가면 30초 제한 시간이 시작되게 해 줘. 시간이 다 되면 게임 오버가 되게 해 줘 | `timeLimit` — 들어서면 timer1 30초 · 다 되면 게임 오버 |
| 31 | `action-map-starter` | action | starter | 동쪽 들판에서는 실시간으로 칼을 휘둘러 싸우는 액션 전투가 되게 해 줘 | `actionMap` — 동쪽 들판: 액션 전투 |
| 32 | `action-slimes-starter` | action | starter | 동쪽 들판을 실시간 액션 전투 맵으로 만들고, 덤벼드는 슬라임을 두 마리 풀어 줘 | `actionSpawn` — 동쪽 들판: 「슬라임」 스폰 1곳 · 동시에 2마리 |
| 33 | `two-endings-starter` | endings | starter | 여관 주인 마사에게 말을 걸면 "이제 어떻게 할 거예요?"라고 묻고 '떠난다'와 '남는다' 중에 고르게 해 줘. '떠난다'를 고르면 '먼 길'이라는 엔딩이, '남는다'를 고르면 '마을의 불빛'이라는 엔딩이 나오게 해 줘 | `choiceEndings` — 여관 주인 마사: 「떠난다」→엔딩 「먼 길」 · 「남는다」→엔딩 「마을의 불빛」 |
| 34 | `ending-by-talks-starter` | endings | starter | 마을에 '떠나는 길'이라는 표지판을 세워 줘. 조사했을 때 꼬마 미루, 여관 주인 마사, 파수꾼 데릭 세 사람 모두와 얘기한 뒤라면 '모두의 배웅'이라는 엔딩이, 한 명이라도 얘기하지 않았다면 '쓸쓸한 출발'이라는 엔딩이 나오게 해 줘 | `flagsEnding` — 떠나는 길 @ 잿불 마을 (12,12) — 모두와 얘기하면 「모두의 배웅」, 아니면 「쓸쓸한 출발」 |
| 35 | `backlog-on-built` | endings | built | 지난 대사를 다시 볼 수 있게 대화 기록(백로그)을 켜 줘 | `projectField` — meta.oprnDialogueSystem.backlog.enabled = true |
| 36 | `hunger-hud-starter` | survival | starter | '배고픔' 수치를 만들어서 화면에 게이지로 보이게 해 줘. 게임을 시작할 때 100으로 시작하게 해 줘 | `hudGauge` — HUD gauge 「배고픔」 = 100 |

자기검사 2026-11-11: 셋째 묶음 **36/36 sound**. 앞 묶음의 판정이 그대로인 근거 — 따라가기를 고치기 전(`7c5f3b7b62`)과 뒤의 자기검사가 첫 묶음 30/30 · 둘째 35/35 로 같고
일마다 판정 글이 같다(다른 것은 새로 만든 이벤트 id 의 난수뿐 — 10행). 실모델 실행 셋(`baseline-46274bc35f` 23 · `after2-d4a4ae29f4` 29 · `set2-base-e298f686e5` 28)의 전/후 문서를
지금 코드로 재판정해 상태가 바뀐 일 0건 · 까닭 글이 바뀐 일 0건. CI 는 `test/smallJobsThirdSet.test.ts` 가 같은 것을 일마다 보고, 따라가기의 새 명령 다섯을 따로 본다.

## 조수가 깐 맵의 적대적 그림 검수 (`map-vqa`, 2026-11-11)

목적: 조수가 **맵을 잘 깔게** 고치는 것이 핵심이라는 오너 판단(2026-11-11)에 따라, 조수가 깐 맵을 그림으로 보고 «플레이어가 엉성하게 깔린 맵이라고 할 까닭»을
종류·심각도·칸 영역으로 적어 **순위가 매겨진 결함 목록**을 낸다. 그 목록이 빌더·도구를 고칠 차례이고, 고친 뒤 같은 말뭉치를 다시 돌려 전/후를 본다.
작은 일 묶음·게임 통판의 «완료»는 저장 문서의 기계 판정이라 그림을 보지 않는다 — 이것은 그림을 보는 독립 측정이다.

- 코드: `src/harnesses/assistant-capability/node/mapVqa/` — `lay.ts`(맵 깔기 묶음 실행기) · `corpus.ts`(말뭉치 읽기) · `facts.ts`(맵의 사실) · `pictures.ts`(그림) ·
  `review.ts`(검수) · `verdict.ts`(답 읽기·집계 — 모델 없음) · `patterns.ts`(종류 안의 되풀이) · `artGaps.ts`(없는 그림 장부) · `decoys.ts`(심은 결함) · `calibrate.ts`(보정) · `page.ts`(한 장) · `hud.ts`/`hudVerdict.ts`/`hudShots.mjs`(HUD 화면 검수). 검수자 호출 `visualJudge.ts`. 입구 `mapVqaEntry.ts`(bun).
- 데이터: `harness-data/assistant-capability/map-vqa/` — `requests.json`(맵 깔기 24가지) · `reviewer.json`(검수자 지시문과 종류 목록, 판 이름) · `calibration.json`(보정 씨앗) ·
  `positives/*.json.gz`(실제로 확인된 조수 결함 맵을 얼린 것) · `calibration/<판>.json`(보정 기록) · `tally/<이름>.json`(집계 사본).

```bash
# 말뭉치 B: 맵 깔기 24가지를 실제 입력창으로(빌드된 편집기가 다른 체크아웃에 있으면 --editor-root)
npm run harness -- assistant-capability map-vqa-lay --out <새 폴더> --model terra-high --v2 [--timeout-min 20] [--only id,종류] [--skip-completed] [--editor-root <체크아웃>]
# 검수: 말뭉치 = 게임 통판 실행 폴더 · 맵 깔기 실행 폴더 · 프로젝트 JSON 을 쉼표로, 또는 whole-games:<상위 폴더>(그 밑의 v2 통판 전부)
npm run harness -- assistant-capability map-vqa --corpus <폴더[,폴더…]> --out <결과 폴더> [--only 글자] [--no-review] [--no-art] [--html <출력.html>] [--before <앞 tally.json>] [--before-lay <앞 맵 깔기 tally.json>]
# 검수자 보정(지시문을 고치면 판 이름을 올리고 다시 잰다)
npm run harness -- assistant-capability map-vqa-calibrate --out <결과 폴더> [--only good|decoy|positive]
```

### 말뭉치

- **A — 이미 있는 것(모델 비용 0)**: 저장소 밖 `~/z-project/assistant-fable-runs/` 의 Terra + v2 게임 통판 실행(`project/project.sqlite` 가 있는 폴더, `RUN.txt` 의 `ver=v1` 은 뺀다)의 모든 맵.
- **B — 맵 깔기 24가지**(`requests.json`): 빈 프로젝트에서 자연어 한 문장으로 맵을 깔게 한다. 좌표·크기·칩셋 이름을 주지 않는다. 한 장 21가지(마을 · 시장 마을 · 왕궁 · 야영지 · 유적 바깥 ·
  동굴 · 지하 감옥 · 무기 가게 · 여관 · 가정집 · 항구 · 들판 길 + 그림이 없을 법한 곳 9가지: 편의점 · 광산 · 늪 · 신전 · 알현실 · 교실 · 선술집 · 대장간 · 농장) + 두 장이 이어져야 하는 3가지
  (마을→들판 · 마을→촌장 집 · 숲→동굴 — 출구·길 어긋남을 잡는다).
  실행기는 작은 일 실행기와 같은 길(`wholeGameSession.mjs`, `--v2`, `--ai-config`, 동시 최대 2, 되물으면 한 번만 답함, 결과를 덮어쓰지 않음)이고 **기계 합격이 없다**: 요청마다
  `laid`(맵이 바뀜) · `nothing`(아무것도 안 깔림) · `timeout` · `infra` 와 바뀐 맵 목록만 적는다. 검수 대상은 턴 전 문서와 다른 맵이다. id·문장은 전/후 비교의 기준이라 바꾸지 않는다(새 요청은 뒤에 덧붙인다).
  `space-craft` 실행기는 v2 스위치가 없어 쓰지 않았다.
- 빈 프로젝트의 시작 맵(«빈 맵» 20×15)을 조수가 칠하지 않고 남기는 일이 있다. 그 맵이 시작 맵이거나 다른 맵과 이어져 있으면 **플레이어가 보는 맵이므로 검수한다**(없는 그림은 묻지 않는다).
  시작 맵도 아니고 어디와도 이어지지 않았으면 뺀다. «바뀐 맵» 비교는 열쇠 순서를 무시한다(저장소에서 다시 읽으면 순서가 바뀐다).
- **그림은 저장 정본(`project.sqlite`)에서 그린다.** 실행기가 남기는 `after.json.gz` 는 타일셋 본문을 뺀 사본이라, 조수가 턴 중에 타일셋에 붙인 칸(나무 수관·천막·키트 조각)이 빠져 그림에 구멍이 난다.
  2026-11-11 첫 판에서 야영지·들판·숲의 풀밭이 통째로 «안 칠한 칸»으로 그려져 가짜 blocker 가 7개 붙었고, 편집기 캡처와 대조해 잡았다 — 그 판의 B 숫자는 버렸다.

### 검수자에게 주는 것 — 그림 넷과 사실 글

1. **깨끗한 1배 그림** — 플레이어가 보는 모습. 타일은 편집기 캔버스와 같은 함수로, 이벤트는 새 게임 상태에서 엔진이 고르는 페이지의 그림만 그린다. 그림이 없거나 투명한 이벤트는 안 그린다
   (편집기 표식·시작 위치 표시·이름으로 그려 주는 표지판 아이콘 없음). 판정은 이 그림의 화소 해시에 묶인다.
2. **확대 그림** — 작은 맵은 통째로 3~4배, 큰 맵은 2칸 겹친 4분면을 각각 2~4배(정수 배, 최근접).
3. **사실 표시 그림** — 깨끗한 그림 위에 문서에서 읽은 사실만: 막힌 칸(붉은 막 + 빗금), 출구 `E#` · 사람 `P#` · 보이는 물건 `O#` · 적 `F#` · **안 보이는 글 이벤트 `V#`** · 시작 칸 `S`, 5칸마다 눈금과 칸 번호.
4. **사실 글** — 크기 · 칩셋 · 이어진 맵인지 한 장짜리인지 · 걷는 칸의 몫과 끊긴 섬 · 가장자리의 열린 구간마다 출구가 있는지 · 출구의 도착 맵 · 사람 · 안 보이는 이벤트의 글과 그 칸이 걷는 칸인지 · 빌더가 적은 장소 이름표(주장).

검수자 = Claude Opus 5.5 medium, 로컬 CLI(`claude -p --model claude-opus-5-5 --effort medium`, 도구·MCP·설정 없음 — object-gate 최종 판정과 같은 길). 응답의 `modelUsage` 가 Opus 가 아니면 답으로 쓰지 않는다.
맵 한 장에 한 번 부른다. 답은 `<결과 폴더>/judge-cache/` 에 지시문 판 + 글 + 그림 화소 해시로 묶여 남고, 그림이 한 화소라도 바뀌면 다시 묻는다.
**검수자가 답하지 못한 맵(호출 실패·형식 어긋남)은 «미검증»**이고 깨끗한 맵으로 세지 않는다. 판정 파일을 손으로 쓰지 않는다.

답의 모양: `purpose` · `checked`(출구 / 울타리와 통로 / 건물과 사람 / 공간을 봤다는 한 줄씩) · `defects[]`(`class` · `severity` · `region{x,y,w,h}` 칸 · `evidence` 한국어 한 줄). 한 맵에 12개까지.

| 종류 id | 뜻 |
|---|---|
| `exit-off-road` | 출구가 맨땅·지붕 같은 칸에 있고 보이는 길·문은 다른 곳으로 난다 |
| `road-to-nowhere` | 길이 벽·물·맨땅에서 끊기거나(이어진 맵에서는) 출구 없는 가장자리로 빠진다 |
| `enclosure-unreadable` | 방·성벽·울타리에 들어가고 나올 곳이 읽히지 않는다 |
| `passage-mismatch` | 길·문처럼 보이는데 막혔거나, 벽·지붕·물처럼 보이는데 걸어진다 |
| `invisible-event-misplaced` | 안 보이는 글 이벤트가 엉뚱한 칸에(열린 성문의 «잠긴 집 문» 등) |
| `empty-expanse` | 텅 빈 넓은 곳 · 내용보다 큰 맵 · 가구 없는 방 |
| `wrong-surface` | 물건이 엉뚱한 바닥 위에(물 위의 집, 잔디 위의 가구) |
| `cut-off-piece` | 잘린 건물·나무, 반쪽 조각 |
| `repeated-stamp` | 같은 건물·소품을 줄지어 반복 |
| `doorless-building` | 문이 없거나 문 앞이 막힌 건물 |
| `people-placement` | 벽·지붕 위의 사람, 길목을 막은 사람, 겹친 사람 |
| `unpainted-or-seam` | 안 칠한 칸 · 깨진 이음매 |
| `style-mix` · `other` | 화풍 섞임 · 그 밖 |

심각도: **blocker** = 맵이 가리키는 곳으로 들어가거나 나가거나 지나갈 수 없다(또는 그림이 크게 깨졌다) · **major** = 보자마자 깨졌거나 싸 보인다 · **polish** = 찾아봐야 보인다.
그려진 문·성문을 지나갈 수 없는 것, 드나들 곳이 전혀 없는 방·성곽은 한 장짜리 맵에서도 major 이상이다. 한 장짜리 맵에서는 출구 없음·가장자리로 빠지는 길·사람 없음을 결함으로 적지 않는다.

### 종류 안의 되풀이 (`tally.json` 의 `patterns`) — 순위표의 한 줄을 «무엇을 고치면 되는가»로

종류 하나(예: `passage-mismatch`)에는 원인이 여럿 섞여 있다(막힌 집 문 · 걸어지는 못 · 성벽 위 걷기). 큰 결함 이상이 8건 넘는 종류마다 근거 줄을 검수자 모델에게 글로만 한 번 주어
**같은 원인끼리** 묶게 한다(`patterns.ts`, 판 `map-vqa-patterns-v1`, `other` 는 뺀다). 묶음마다 «되풀이되는 모습»과 «고칠 곳(모델의 짐작)»이 붙는다.
모든 줄이 정확히 한 묶음에 들어야 답이고(빠지거나 두 번 들면 다시 묻는다), 건수·맵 수는 그 배정에서 코드가 센다. **이 묶음은 보정하지 않았다** — 고칠 거리의 실마리이고, «고칠 곳»은 코드를 본 판단이 아니다.

### 없는 그림 장부 (`art-gaps.json`) — 깔기 결함과 따로 센다

오너의 물음(2026-11-11 «물건·타일셋이 없을 때는 어떻게 하나»)에 대한 측정이다. 맵마다 세 갈래를 모아 **칩셋 × 없는 것 × 그것을 바란 맵·실행 수 × 대신 쓰인 것**을 많이 바란 순으로 낸다 — 그림 하네스의 그릴 차례다.

- **(a) 이름은 있는데 그림에 없는 것** — 검수자에게 둘째 물음(`art-gaps-v1`, 깨끗한 그림 + 확대 그림 + 사실 글)을 한다: 요청 문장·이벤트 이름과 글·빌더 이름표가 가리키는데 맵에 그려지지 않은 것
  (노점 없는 시장, 배 없는 항구, 맨바닥의 «책장» 조사 이벤트). 그릴 수 있는 것만(물건·가구·건물·탈것·동물·지형) — 사람·추상적인 것은 뺀다. 그 자리에 대신 그려진 것도 적는다. 확신이 없으면 `unsure`.
- **(b) 빌더·도구가 스스로 적은 것** — 먼저 **없는 그림 기록**(`src/project/artGap.ts`, 문서 `openwiki/assistant-v2.md` 「없는 그림 기록은 하나」): 턴 기록(`session/turns/*.json`)의 `artGaps`(턴 끝 요약이 실은 기록 — 바란 것·칩셋·테마·대역·어디)를 그대로 읽는다(`reportOfArtGap`, 종류 `art-gap`). 그 칸이 없던 옛 실행은 결과 글 `missingArt` 목록의 `[art-gap]` 줄을 같은 기록으로 읽는다. 그다음 도구 결과 글에서: 기록 모양이 아닌 `missingArt` 글 · «「…」 그리기 카드를 대기열에 올렸다» · «이름이 맞는 기물이 이 칩셋에 이미 있다 → 이것을 써라: …»(대역 제안) ·
  «…쪽을 보는 그림이 없다» · «특징 … 은 놓을 빈 바닥·그림이 없어 빠졌다» · 그림·공방을 까닭으로 막힌 할 일(`✗blocked`). 엔딩·타이틀 그림 이야기는 맵 그림이 아니라 뺀다.
- **(c) 다른 주제의 대역** — 문서의 사실(맵의 전투 배경 id, 그 맵에서 싸우는 적 이름)을 같은 물음에 주고 검수자가 고른다: 사막 맵의 `battle-scenery-forest`, 피라미드의 «광산 해골 궁수»·«초원 슬라임». 장부 줄의 이름은 «그 맵에 맞는 것»이고 대신 쓰인 것이 대역이다.
- 여러 검수가 다르게 적은 이름(좌판·가판대·노점)은 검수자 모델 한 번으로 같은 것끼리 묶는다(`clustered`). 그 호출이 실패하면 적힌 이름 그대로 센다.
- 이 물음은 **따로 보정하지 않았다.** 합격 판정이 아니라 그릴 후보 목록이다 — 장부 줄을 그리기 전에 그 맵 그림을 한 번 본다. `--no-art` 로 끌 수 있다.

### HUD 화면 검수 (`map-vqa-hud`) — 맵 렌더에는 HUD 가 없다

오너(2026-11-11): «HUD 를 조수가 제대로 설정을 못하는거같다 — HUD 위주로 검토». 플레이어 화면에서만 보이는 것이라 게임을 **출하 플레이어**로 켜서 찍는다.

```bash
npm run harness -- assistant-capability map-vqa-hud --corpus <폴더[,폴더…] | whole-games:<상위 폴더>> --out <map-vqa 와 같은 결과 폴더> --player-root <dist/export-player 가 있는 체크아웃> [--only 글자] [--no-review] [--html <출력.html>]
```

- **화면**(`hudShots.mjs`, node + Firefox): `wholeGamePlayer.mjs --serve` 로 그 프로젝트를 띄우고 타이틀 → 새 게임 → 오프닝(그림 연속은 Esc, 대사는 확인 키) → **첫 필드**를 960×720 으로 찍는다. 나머지 맵은 같은 세션에서 계측 훅
  `__oprnDebug.teleport` 로 그 맵에 들어오는 이동의 도착 칸에 세워 찍는다(맵마다 한 장). 계측 표식은 가리고 찍는다. 그래서 시작 맵이 아닌 화면의 목표 줄은 «처음 세운 목표» 그대로다 — 그 화면에서는 목표 글이 자리에 맞는지 판정하지 않는다(검수자에게도 그렇게 알린다).
  플레이어 빌드는 `--player-root` 의 것이다(다시 빌드하지 않는다) — 그 빌드보다 뒤에 고친 HUD 동작은 화면에 없다.
  사실 글은 지금 체크아웃의 `fieldHud.ts` 로 셈하므로, 플레이어 빌드가 그보다 옛것이면 «설정이 띄우는 것»과 화면이 어긋날 수 있다 — 전/후를 잴 때는 플레이어를 같은 커밋에서 빌드한 체크아웃을 준다.
- **사실**(모델 없음, `hudFacts`): 저장된 `project.system.fieldHud` · 그 설정이 필드에 띄우는 것 · 이 게임이 실제로 쓰는 몸 게이지(체력이 줄 수 있나 / MP 를 쓰는 기술이 있나 / 액션 전투인가) · 전투 방식(턴제·액션·없음) · 설정이 띄우는데 게임이 안 쓰는 게이지.
  `src/project/fieldHud.ts` 에 `hudOnScreen`·`projectHudUse` 가 있으면 그것을 쓰고(PR #4607), 없으면 같은 뜻의 작은 셈을 한다.
- **검수자**: 같은 Opus 5.5 medium 길, 지시문 `hud-vqa-v1`, 화면 한 장에 한 번. 종류 — `unused-gauge`(게임이 안 쓰는 수치의 게이지) · `wrong-genre-hud`(턴제 게임의 액션 HUD: 도구 슬롯·스태미나 고리·하트) ·
  `unreadable`(밝은 바닥 위라 안 읽히는 글) · `covers-play`(HUD·목표 줄이 주인공이나 봐야 할 것을 가림) · `objective-text`(어색한 줄바꿈·잘림 / 시작 화면에서 이미 와 있는 곳으로 가라고 함) · `other`. 심각도는 major · polish 둘.
- **산출물**: `<결과 폴더>/hud.json`(종류 × 심각도 × 화면 수 · 게임 수, 게임마다, 화면마다) · `hud/<게임>/*.png` · 한 장. `map-vqa` 를 같은 결과 폴더로 돌리면 `tally.json` 의 `hud` 와 맵 검수 한 장에 **따로 한 묶음**으로 실린다(맵 깔기 결함과 섞어 세지 않는다).
- **이 검수자는 보정하지 않았다(«보정 전»).** 확인용 양성 하나만 봤다: fun-x1 의 혼자 남은 «마력 43/43» 막대. 맵 깔기 묶음(B)은 맵만 시킨 요청이라 HUD 는 빈 프로젝트의 것이다 — 게임마다 표에서 A 와 따로 읽는다.

**결과 — 2026-11-11**(플레이어 빌드 = `…-av2-whole` 의 `6edf7c1a5b`, #4607 이전): 게임 31개 · 화면 98장(전부 검수) · 큰 결함이 있는 화면 30 · 큰 결함이 있는 게임 8 · 큰 결함 31 / 다듬기 84. 집계 사본 `tally/2026-11-11-A+B-main-hud.json`.

| HUD 결함 종류 | 큰 결함 | 다듬기 | 걸린 화면 | 걸린 게임 |
|---|---|---|---|---|
| `unreadable` 안 읽히는 글 | 14 | 27 | 40 | 8 |
| `unused-gauge` 게임이 안 쓰는 게이지 | 12 | 1 | 12 | 2 |
| `other` | 4 | 39 | 38 | 7 |
| `covers-play` 주인공·볼 것을 가림 | 1 | 16 | 15 | 10 |
| `objective-text` 목표 글 | 0 | 1 | 1 | 1 |

- **종류는 흩어졌지만 원인은 하나다: 혼자 남은 «마력 43/43» 막대.** 게임 통판 12개 중 7개(fun-v2 · fun-w1 · fun-w2 · fun-x1 과 그 사본 둘 · jrpg-w1)가 `theme:"adventure"` + `vitals:false` 이고, 그 43화면 전부에 왼쪽 위 «마력» 막대만 뜬다(체력 없음).
  전투가 없는 두 게임(fun-w1 · jrpg-w1)에서는 `unused-gauge` 12건, 턴제 전투가 있는 게임에서는 «체력은 숨기고 마력만 남았다»(`other`)와 «받침 판 없는 연한 글씨 ‹마력› 이 모래·눈 위라 안 읽힌다»(`unreadable`)로 적혔다.
  fun-w3(`vitals:true`)은 «체력»은 판 안, «마력»은 판 밖에 떠 서로 모양이 다르다. 원인 수리는 PR #4607.
- `theme:"classic"` 인 네 게임(jrpg-v2 · w2 · w3 · x1)은 필드에 목표 줄만 뜨고 큰 결함 0.
- 모델 없이 본 것: adventure 테마 8게임의 설정에는 기력(스태미나) 고리가 들어 있지만 액션 전투가 없어 화면에는 안 뜬다.
- 맵 깔기 묶음(B): 맵만 시킨 요청 23개 중 19개에서 조수가 `fieldHud` 를 `{theme:"minimal", clock:true, …}` 로 저장했다(시간 체계 없음 — 시계는 화면에 안 뜬다). 그 22화면은 HUD 가 전혀 없고 결함 0.
- 같은 화면에서 본 HUD 밖의 것: 맵 깔기 village 는 빈 프로젝트의 시작 칸 (10,8) 이 새 38×48 맵에 그대로 남아 **주인공이 집 지붕 위에서 시작한다**(맵 검수의 «시작 지점이 막힌 그림 위»와 같은 것).

### 보정 (`map-vqa-calibrate`) — 숫자를 인용하기 전에

- **좋은 맵 15장**: 사람이 만든 장소 견본(`public/assets/region-references/*.oprn.json` — 조선 마을·동굴·사냥터·실내 셋, 일본 상가 거리·편의점·주택·역, 마법 학교 도서관·온실·숲, 현대 도시). 여기에 blocker 가 붙으면 헛경보다.
- **심은 결함 30개**(`decoys.ts`, 결정론): 그 견본의 사본에 한 가지씩 —
  `wall-off`(문·열린 길목을 옆 벽 그림으로 막음) · `exit-on-bare-edge`(넓게 열린 맨땅·지붕 가장자리에 안 보이는 출구) · `strip-furniture`(물체 층을 지움) · `shift-objects`(물체 층을 오른쪽 3·아래 2칸 밂) ·
  `stamp-6x`(가장 빽빽한 조각을 한 줄에 6번) · `locked-text-on-way`(열린 길목에 안 보이는 «잠긴 집 문» 글 — `place/lockedDoors.ts` 가 성문에 깐 것과 같은 모양) · `person-on-roof`(사방이 막힌 칸에 사람 셋) · `unpainted-hole`(6×5칸을 모든 층에서 비움).
- **실제로 확인된 조수 결함 3장**(`positives/`, 맵 한 장씩 얼림): fun-x1 «초승달 궁전»(출구가 서·동 맨모래, 길은 남쪽 · 성문 기둥의 «굳게 닫힌 집 문» 글 8개) · fun-x1 «잠든 태양의 피라미드»(서쪽으로 들어오는데 참배 길은 남쪽 · 탑문의 잠긴 문 글) · fun-w3 «눈보라 마을»(목책 문의 잠긴 문 글).
- **잡았다 = major 이상 + 그 조리법이 받는 종류 + 심은 자리와 겹침**(2칸 여유). 종류가 다르면 「종류만 다름」으로 따로 세고 엄격한 기준에서는 놓친 것이다.
- **보정됨(calibrated) = 심은·확인된 결함을 하나도 놓치지 않았고 좋은 맵에 blocker 가 없다.** 놓치면 기준을 낮추지 않고 지시문을 고쳐 판을 올린다. 결과 한 장과 `tally.json` 은 그 판의 놓침·헛경보 비율을 함께 적고, 기록이 없는 판의 숫자에는 «보정 전»이라고 붙인다.

| 지시문 판 | 심은·확인된 결함 33개 중 놓침(엄격) | 종류만 달라도 잡은 것으로 치면 | 좋은 맵 15장 중 blocker 가 붙은 맵(헛경보) | 좋은 맵 중 major 가 붙은 맵 | 상태 |
|---|---|---|---|---|---|
| `map-vqa-v1` | 2 (6.1%) — `wall-off` 둘 | 1 (3.0%) | 0 | 8 (맵당 major 1.5개) | not-calibrated |
| `map-vqa-v2` | **0** | 0 | **0** | 7 (맵당 major 1.2개) | **calibrated** |

- v1 은 한 장짜리 견본에서 «문이 벽으로 막혔다»를 polish 로 적어 놓쳤다. 기준을 낮추지 않고 지시문을 고쳤다(v2): 방에는 그려진 나갈 곳이 있어야 한다 · 그려진 문·성문을 지나갈 수 없으면 polish 가 아니다 · 한 장짜리 맵에서 적지 않을 것의 목록.
  남은 한 건은 조리법이 문 그림을 남긴 채 통행만 막아 «막힌 문»이 그림에 안 보였던 것이라 조리법을 고쳤다(벽 그림을 안쪽 4줄까지 채움).
- 좋은 맵 15장 중 7장에 major 가 붙는다(견본의 걸어지는 지붕·못, 넓은 빈 바닥 등). 그래서 **«major 이상이 있는 맵» 수는 넉넉하게 잡힌 숫자다** — 전/후 비교에는 쓰되 «깨끗한 맵이 몇 %»라는 절대값으로 인용하지 않는다.
- 기록: `harness-data/assistant-capability/map-vqa/calibration/map-vqa-v1.json` · `map-vqa-v2.json`(결함마다 잡은 종류·자리).

### 결과 — 2026-11-11

말뭉치: **A** = `~/z-project/assistant-fable-runs/` 의 Terra + v2 게임 통판 12개 폴더(맵 76장 — `fun-x1` 은 `fun-x1-gatefix` · `fun-x1-gatefix-arrow` 사본까지 세 번 들어 있어 그 게임의 결함이 세 번 세어진다) ·
**B** = 맵 깔기 24가지를 origin/main `0636b72004`(#4603 · F3/F4 · #4594 · #4598 포함)에서 Terra high + v2 로 돌린 것(`mapvqa/lay-main-0636b72004`, 맵 27장). 지시문 `map-vqa-v2`(보정됨).
결과 폴더 `~/z-project/assistant-fable-runs/mapvqa/review-A-v2/`, 집계 사본 `harness-data/assistant-capability/map-vqa/tally/2026-11-11-A+B-main.json`(맵마다 목록 포함) · `…-art-gaps.json`.

| | 맵 | blocker 가 있는 맵 | major 이상이 있는 맵 | 큰 결함 없는 맵 | 결함 blocker / major / polish |
|---|---|---|---|---|---|
| A 게임 통판 | 76 | 2 | 70 | 6 | 4 / 273 / 194 |
| B 맵 깔기 24가지(현재 main) | 27 | 4 | 21 | 6 | 4 / 65 / 57 |
| 합 | 103 | 6 | 91 | 12 | 8 / 338 / 251 |

**종류 순위(점수 = blocker × 3 + major)**

| # | 종류 | 점수 | blocker | major | polish | 걸린 맵 |
|---|---|---|---|---|---|---|
| 1 | `passage-mismatch` 보이는 것과 통행이 다름 | 91 | 1 | 88 | 50 | 84 |
| 2 | `road-to-nowhere` 어디로도 안 가는 길 | 77 | 3 | 68 | 9 | 58 |
| 3 | `exit-off-road` 출구가 길·문과 어긋남 | 54 | 0 | 54 | 2 | 49 |
| 4 | `empty-expanse` 텅 빈 넓은 곳 | 42 | 3 | 33 | 64 | 84 |
| 5 | `other` 그 밖 | 26 | 1 | 23 | 27 | 45 |
| 6 | `invisible-event-misplaced` 안 보이는 이벤트가 엉뚱한 칸에 | 21 | 0 | 21 | 15 | 31 |
| 7 | `people-placement` 사람 배치 | 20 | 0 | 20 | 23 | 38 |
| 8 | `repeated-stamp` 같은 도장 반복 | 19 | 0 | 19 | 22 | 38 |
| 9 | `wrong-surface` 물건이 엉뚱한 바닥 위에 | 4 | 0 | 4 | 15 | 17 |
| 10 | `doorless-building` 문 없는 건물 | 4 | 0 | 4 | 1 | 3 |

**종류 안의 되풀이(큰 결함 이상, 건수 · 맵 수) — 빌더·도구를 고칠 차례**

1. **그려진 문·입구가 막혔고 이벤트가 없다 — 59건 · 48장**(`passage-mismatch`). 집·가게·천막·동굴·갱도 입구가 또렷이 그려지고 길도 그 앞까지 오는데 문 칸이 막힘이고 출구도 글도 없다(steampunk·prehistoric·snow 계열 집, 야영지 천막, 동굴 입구 소품).
2. **가장자리까지 깐 큰길 끝에 출구가 없다 — 39건 · 38장**(`road-to-nowhere`). 마을 정문길·큰길이 남쪽 가장자리에 닿는데 그 구간에 출구가 없다. 짝이 되는 것이 3번이다.
3. **출구가 길과 무관한 맨 가장자리 칸에 있다 — 29건 · 27장**, **길 끝에서 한두 칸 비켜난 맨땅에 있다 — 14건 · 14장**(`exit-off-road`). 세계로 나가는 출구가 서·동 맨모래/눈/풀 가장자리에 놓이고 그려진 길은 남쪽으로 간다(확인된 fun-x1 «초승달 궁전»·«잠든 태양의 피라미드»와 같은 모양).
4. **갈라진 흙길이 풀밭 한가운데서 끊긴다 — 18건 · 13장**(`road-to-nowhere`).
5. **야외 맵의 바깥 띠가 걸어지는 빈 바닥으로 남는다 — 15건 · 14장**, **던전·숲 캔버스가 내용보다 훨씬 크다 — 9건 · 9장**(`empty-expanse`).
6. **벽·성벽 윗면·지붕·기둥이 걸어진다 — 11건 · 9장**, **못·바다·용암이 걸어진다 — 6건 · 4장**(`passage-mismatch`).
7. **«굳게 닫힌 집 문» 글이 목책 문·성문 기둥·폐허 아치에 깔린다 — 8건 · 6장**, **글이 말하는 사물(게시판·쪽지·샘)이 그려지지 않았고 안 보이는 이벤트만 엉뚱한 칸에 있다 — 8건 · 8장**(`invisible-event-misplaced`). 앞의 것은 `place/lockedDoors.ts`(이 측정과 따로 수리 중).
8. **같은 집 도장을 한 줄에 반복 — 8건 · 8장**(`repeated-stamp`), **사람이 아예 없는 마을·시장 — 7건 · 7장**(`people-placement`).

blocker 8개: 가장자리까지 간 길 끝에 출구 없이 «길이 끊겼다» 글만(jrpg-w2 버들나루 ×2) · 남쪽 큰길 막다른 곳과 막힌 동굴 입구(fun-w2 연기 산기슭 ×2) · 조수가 칠하지 않은 빈 시작 맵에서 게임이 시작됨(맵 깔기 camp · throne-room) ·
동굴 계단이 숲이 아니라 빈 맵으로 이어짐(forest-to-cave) · 48×36 들판의 왼쪽 위 26×20 에만 소품이 있고 나머지는 맨 모래(village-to-field «동쪽 들판»).

**맵 깔기 24가지(현재 main)**: 맵을 깐 요청 23/24 · 조수 «완료» 8/24 · 요청당 2.1~12.6분(합 113분, 동시 2). `weapon-shop` 은 f978 과 같이 아무것도 못 깔았다.
`throne-room` 은 빈 시작 맵만 남겼다(알현실 없음). `village-chief-house` 는 마을만 깔고 촌장 집 실내는 없다. 한 장 요청인데 빈 시작 맵이 게임에 남아 이어진 것이 camp · forest-to-cave.
같은 14요청(맵 18장)의 앞 실행(`lay-base-f978629cfc`, 15요청) 대비: blocker 3 → 3 · major 44 → 51 · polish 39 → 38 — 요청마다 한 번씩만 돌린 것이라 이 차이는 잡음 안이다(같은 요청도 다시 깔면 맵이 달라진다).

**턴 기록에서 본 도구 결함**(제품 코드는 이 PR 에서 건드리지 않았다)
- `edit_place` 의 `layoutPatch` 거절이 24요청 중 13요청에서 25번: «…; `map_blank_start` was not» 또는 맵 이름이 빈 «…;  was not» + `create_transfer_pair{a:{mapId:""…`(`src/ai/v2/tools/placeMemory.ts` `layoutPatchRefusal`) — 방금 `make_place` 가 거절돼 장소가 없는데 빈 시작 맵을 고치려 들고, 거절 글은 빈 맵 id 를 그대로 넣은 다음 호출을 권한다.
- 그 뒤 «Not executed: call the `create_transfer_pair`/`add_people` tool to resolve the pending action before using other tools» 가 11번 — 거절 글이 이름 붙인 도구를 부르기 전에는 고친 `make_place` 가 실행되지 않아 고리에 갇힌다(weapon-shop 12호출 중 11거절).
- 실내 `make_place` 의 가구 밀도 거절(0.18/칸, «too sparse away from its walkways»)이 10번 — inn · house · blacksmith · weapon-shop · tavern.
- `todo` 의 «Not blocked yet» 거절 19번(막혔다고 적으려는 것을 되돌림).

**없는 그림 장부**: 101줄(검수자가 본 것 90건 · 도구가 적은 것 21건 · 다른 주제 대역 44건, 맵 101장에 물음). 같은 게임의 사본은 한 번만 센다. 위쪽:
- `desert_east` — 샘(파란 수정으로 대신) · 미라 궁수(«광산 해골 궁수») · 모래 슬라임(«초원 슬라임») · 묘실/피라미드 전투 배경(`battle-scenery-forest`) · 기록부·쪽지(물 구유·횃불 받침 칸의 안 보이는 이벤트) · 화단(확신 없음)
- `beodeul_city` — 샘 · 쓰러진 기둥 · 버섯 · 곡괭이 같은 채굴 도구(그리기 카드 대기 5건) · 배(카드 대기 + 나룻배뿐) · 동굴 입구 · 가축과 가축 우리 · 숲/신전 전투 배경(`battle-scenery-cave`)
- `snow_north` — 생선 건조대(확신 없음) · 눈 슬라임(«초원 슬라임») / `prehistoric` — 늪 슬라임 · 늪 전투 배경 / `atlas_biome_interior` — 감방 철창·감옥 소품(생활 가구로 대신)
- 장부의 «문»·«집» 줄(snow_north · desert_east)은 없는 그림이 아니라 `lockedDoors` 의 «굳게 닫힌 집 문» 글이 집 없는 곳에 깔린 것이다 — 그릴 거리가 아니다.

검수자 호출(Opus 5.5 medium, 이 측정 전체 약 470번 · 입력 약 310만 / 출력 약 20만 토큰): 보정 105(v1 48 + v2 57) · 맵 검수 약 110(첫 판의 버린 B 19 포함) · 없는 그림 물음과 이름 묶기 약 135 · 되풀이 묶기 16 · HUD 98. 캐시에 묶여 같은 그림은 다시 묻지 않는다(마지막 재실행은 호출 0 · 캐시 212).

### 깔기 기록 재생 (`scripts/qa/assistant-v2/layReplay.mts`) — 도구를 고친 뒤 모델 없이 다시 재기

깔기 판(`lay-…/jobs/<id>/session/turns/NNN.json` 의 `toolArgs`·`toolCalls`)의 호출을 같은 순서로 지금 도구 층(`createV2Tools` → `withTodoLoop`: 인자 검사·거절 글·다음 호출·할 일 자동 확인)에 넣는다.

```bash
bun scripts/qa/assistant-v2/layReplay.mts <깔기 판 폴더> <결과 폴더> [--only a,b] [--render] [--verbose]
bun scripts/qa/assistant-v2/refusalNextCalls.mts <깔기 판의 jobs/<id> 폴더> [--only 1,2,6]   # 거절 글이 이르는 다음 호출을 실제로 불러 본다
```

- 세는 것: 거절(기록 → 재생, 장소 호출만 / 전부) · 실행기의 «다음 호출 강제» 에 막힌 호출(흉내) · 처음 세 번의 장소 호출 안에 깔렸나(시작 맵이 빈 맵이 아니고 시작 칸에서 그 맵 걷는 칸의 절반 넘게 닿는다) · 빈 맵이 남았나. `--render` 는 끝난 맵을 1배 PNG 로 쓴다.
- 기록의 호출은 옛 응답에 대한 모델의 반응이다: 옛 강제 때문에 부른 호출은 건너뛰고, 새 맵의 id 는 같은 호출의 결과끼리 짝지어 옮긴다. 그래도 풀 칩셋·숲길 지시서처럼 판마다 다른 것은 맞지 않는다(village-to-field).
  고친 뒤의 «완료» 율은 이것이 아니라 Terra 재측정으로 잰다 — 이것은 «같은 호출에 도구가 무엇을 답하는가» 의 전/후다.
- 2026-11-11 수치와 규칙: `openwiki/assistant-v2.md` 「깔기 요청의 거절은 다음 호출 하나를 실제 값으로 이른다」.

### 알려 둘 것

- 그림은 헤드리스 맵 렌더다(출하 플레이어 화면이 아니다). 사람 칩은 16×21 로 그려 런타임(약 16×24)보다 조금 작고, 날씨·조명 구멍·걷는 움직임은 없다. 이벤트 그림은 새 게임 상태의 페이지만 본다(스위치가 켜진 뒤의 모습은 안 본다).
  `scripts/qa-game/render.mts` 가 아이템 아이콘 그림(`cc0-…` — 줍는 물건·세이브 수정)을 16px 상자에 맞춰 그리도록 고쳤다(전에는 칩 칸으로 잘라 안 보였다).
- 걷는 칸은 `get_map_region` 의 `#` 을 쓴다. 사람이 만든 견본에도 «지붕·물이 걸어진다»가 major 로 붙는다(조선 동굴·사냥터의 못, 일본 상가 거리의 옥상) — 견본의 통행 표가 실제로 그렇게 되어 있다. 그래서 좋은 맵의 헛경보는 blocker 만 세고, major 가 붙은 좋은 맵 수는 따로 적는다.
- 검수자는 한 맵에 한 번만 묻는다(표를 여러 번 모으지 않는다). 같은 맵을 다시 물으면 polish 목록은 달라질 수 있다 — 전/후 비교는 blocker·major 와 종류별 합계로 한다.
- CI: `test/mapVqa.test.ts` — 묶음·씨앗의 모양, 사실 읽기, 조리법, 검수자 답 읽기(형식이 어긋나면 답이 아니다), 집계(미검증은 깨끗한 맵이 아니다), 보정의 «잡았다» 판정, 되풀이 묶음 답 읽기, 없는 그림 장부(도구 신고 읽기·줄 묶기). 모델을 부르지 않는다.

## 명세 은행 (`scripts/qa/assistant-v2/specBank.mts`, 2026-11-11) — 모델 없이 빌더만 다시 돌린다

이 하네스가 남긴 판(`session/turns/*.json` · 저장본)에서 **모델이 보낸 도구 호출만** 뽑아 `harness-data/assistant-capability/spec-bank/<판>.json` 에 둔다(게임 하나 10판 · 장소 하나 39판 · 2.1MB).
빌더·끝맺음 단계를 고친 사람은 모델을 부르지 않고 그 명세 전부를 전/후 빌더로 다시 지어 수치와 1배 그림을 견준다.

```bash
bun scripts/qa/assistant-v2/specBank.mts ab --out /tmp/bank        # 기준(origin/main) 빌더 → a · 지금 작업 폴더 빌더 → b · 대조 표 (기본 한 번에 4개 — 모델 판이 도는 기계에서는 더 넓게 돌리지 않는다)
bun scripts/qa/assistant-v2/specBank.mts extract <판 폴더>…         # 새 판을 은행에 더한다 (게임 하나를 지은 판 폴더 · map-vqa 의 과제 폴더)
bun scripts/qa/assistant-v2/specBank.mts list                      # 은행에 든 것
```

- 재생은 실제 입력창 경로가 **아니다** — 편집기·브라우저 없이 워커 실행기(`runPiAgent` + v2 턴 갈고리)에 대본을 앉힌다. 그래서 이 하네스의 합격 판정(필수 검수·화면·SQLite 재로드)을 대신하지 않는다. 은행이 답하는 것은 «같은 명세에서 빌더가 무엇을 짓는가» 하나다.
- 표의 수는 그림을 보지 않은 것이다(화면 미검증). 그림은 `<결과>/<판>/maps/*.png` 에 남는다 — `map-vqa` 검수자에게 그 폴더를 주면 된다.
- 새 Terra 판·측정 묶음을 돌릴 때마다 `extract` 로 은행에 더한다. 명세는 낡는다 — 도구 이름·청사진 규칙이 바뀌면 옛 판은 뒤쪽 호출이 빗나간다(표의 «그때와 같은 결과의 쓰기 호출»).
- 뽑기는 열쇠·토큰 꼴과 이 기계의 절대 경로가 든 명세를 거절한다. 모델의 글·결과 본문·그림·지시문은 은행에 넣지 않는다.

구조·신뢰 수치·이력 증명·한계는 `openwiki/assistant-v2.md` 「명세 은행」.

## 시각 검수

검수 캡처와 matrix-score 그림은 편집기 전용 시작 위치 표시를 빼고 찍는다(`__oprnHideStartMarker`, `renderReviewMapPng`). 표시가 필요하면 `HARNESS_START_MARKER=1`.

검수자는 먼저 요청과 실제 그림을 비교한다. 조수의 자기평가를 시각 판정의 근거로 대신 쓰지 않는다. 런타임은 이동/대화 중 가림, 잘림, 글자·분기·금액을 본다. 결함은 위치·재현 장면을 적는다. 실제로 본 파일만 다음처럼 기록한다.

```bash
npm run harness -- assistant-capability review --out <실행> --case npc-line \
  --status pass --reviewer <독립 검수자> \
  --images after.png,reloaded.png,runtime/<검수한 실제 PNG> \
  --notes '<그림과 요청을 대조한 구체적인 관측>'
```

검수는 결과 파일 해시와 각 PNG 해시에 묶인다. 결과/그림이 바뀌면 영수증이 무효가 되어 pending으로 돌아간다. 조수 ready는 지도 렌더 완료보다 빠를 수 있으므로 에디터 residentTileCells도 기다린다. `recapture`는 이전 PNG/판정을 capture-history에 보존하고 같은 저장 결과를 새 context에서 읽어 렌더 완료 후 재캡처한다. 모델 호출이나 콘텐츠 수선은 하지 않는다. 검수자 인적 진술의 진실성 자체는 파일 해시로 증명되지 않는다. 별도 검수 모델의 품질과 정상/불량 이미지 교정은 후속 범위다.

## 실행 스트림과 연결 수 — 턴이 끝맺음에서 말없이 멈출 때 (2026-11-12)

**증상.** 조수의 마지막 보고와 끝맺음 마감이 나온 직후 이벤트가 끊기고, 턴 상한(45분)까지 아무 일도 없다. 워커·호스트·편집기 탭 모두 한가하다.
워커는 적용 응답을 30분 기다리다 «적용 응답을 전달하지 못했습니다(409)» 로 끝난다. 2026-11-11 이 상자의 사막 게임 네 판(`purpose-desert` 1~4)과
`r1check-fun` 의 턴 1 이 모두 이랬다.

**원인.** 구동기(`node/editorDriver.mjs`)는 `/v1/agent/run` 응답을 `response.clone()` 으로 같이 읽는다. 편집기는 워커가 30초 넘게 조용하면
제 리더를 끊고 GET `…&runId=…&after=…` 으로 이어 받는데(`src/ai/piAgent/client.ts`), **복제한 본문은 두 가지가 다 끊겨야 연결이 닫힌다.**
구동기의 가지가 계속 읽고 있어 이어 받기 한 번마다 연결 하나가 남았다. 브라우저는 호스트 하나에 연결을 6개까지만 연다 —
POST 1 + 이어 받기 4 + 프로젝트 이벤트(EventSource) 1 = 6 이 되면 커밋 기록·저장·적용 응답 요청이 **보내지지도 못한 채** 줄을 선다.
멈춘 순간의 측정(`purpose-desert4`): 마지막 체크포인트는 대기열에서 나와 적용에 들어갔고, 커밋 기록 요청이 160초째 답이 없고, 주 스레드는 한가했고
(5초에 300프레임), 탭 → 호스트 연결이 정확히 6개였다. 호스트 로그의 «event loop blocked» 30초 이상이 판마다 네 번(69·49·31·35초 등)이고 멈춤은 네 번째 뒤다.

**고친 것 (세 겹).**

| 겹 | 무엇 |
|---|---|
| 구동기 | 실행 번호마다 지금 읽는 복제 가지 하나만 둔다. 이어 받기 요청이 나가면 같은 실행의 앞 가지를 끊고 `stream_superseded` 로 적는다(`stream_closed` 가 아니다 — 그건 «턴이 끝났다» 로 읽힌다). 실행 번호가 다른 스트림은 서로 끊지 않는다 |
| 호스트 중계 | 편집기가 POST 와 이어 받기에 같은 읽는 이 번호(`?reader=`)를 싣고, 중계(`scripts/lib/piRunRelay.mjs`)가 같은 번호의 앞 스트림을 닫는다 — `openwiki/editor-ai-panel.md` 「실행 기록과 이어 받기」 |
| 워커 | 장소 짓기·출구 마감 사이에 루프에 차례를 줘 30초 넘는 침묵 자체를 없앤다 — `openwiki/assistant-v2.md` 「워커 루프에 차례 주기」 |

**턴 기록에서 읽는 법** (`session/turns/NNN.json`, 도는 동안은 `session/state.json`):

| 칸 | 뜻 |
|---|---|
| `streams.open` · `resumes` | 그 턴에 열린 실행 스트림 수(POST + 이어 받기)와 그중 이어 받기 |
| `streams.superseded` | 이어 받기에 밀려 끊긴 앞 가지. **`resumes` 와 같아야 한다** — 적으면 앞 스트림이 살아 연결을 쥐고 있다 |
| `streams.closed` · `errors` | 끝까지 읽고 닫힌 스트림 · 오류로 끊긴 스트림 |
| `streams.live` · `livePeak` | 아직 읽고 있는 실행 스트림(열림 − 밀려 끊김 − 닫힘 − 오류)과 턴 중 최대. 실행 하나에 1, 이어 받는 순간에만 2 다. **`livePeak` 가 이어 받기 수만큼 늘면 누수이고, 5 면 그 턴은 연결이 모자라 멈춘 것이다** |
| `sockets.peak` · `atSettle` | 탭 → 호스트의 열린 TCP 연결 수(리눅스 `ss`; 없으면 null) — 턴 중 최대와 가라앉은 순간 |

연결 수에는 쉬는 keep-alive 연결도 들어간다 — 페이지를 막 읽은 뒤나 저장이 몰린 직후에는 멀쩡한 턴에서도 6 이 흔하다(쉬는 연결은 2분쯤 뒤 닫힌다).
그래서 판정은 `streams` 로 하고, 연결 수는 **2분 넘게 조용한데 6** 일 때만 «여섯 개가 모두 쓰이는 중» 이라는 증거다(멈춘 판에서 본 것이 이것이다).

**모델 없는 재현.** `node scripts/qa/harness-stream-leak.mjs [구동기 경로] [이어 받기 수]` — 가짜 호스트가 끝나지 않는 실행 스트림을 주고, 페이지가 편집기처럼
제 리더를 끊고 이어 받는다. 고치기 전 구동기(`git show <옛 커밋>:src/harnesses/assistant-capability/node/editorDriver.mjs > 파일`)는 이어 받기 5번 뒤
평범한 요청이 5초 안에 답을 못 받고 서버 쪽 산 스트림이 6, 고친 뒤는 6~9ms · 산 스트림 1 · `superseded` 5.

**함정.** 가로채기에서 응답 본문을 복제해 읽는 다른 스크립트(`scripts/capture/capture-terrain-*.mjs`)도 같은 모양이다 — 이어 받기가 날 만큼 긴 실행에 쓰면 같은 일이 난다.
새로 가로채기를 쓸 때는 이어 받기 요청(`runId=` 가 붙은 GET)을 보면 앞 가지를 `cancel()` 한다.

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
