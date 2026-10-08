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
