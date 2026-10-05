# 조수 기능별 수행 검증

목적은 자연어 요청의 실제 충족, 기존 콘텐츠 보존, 플레이 가능성, 저장 내구성과 완료 보고의 사실성을 기능별로 확인하는 것이다. 현재 core 묶음은 조회·계획·NPC 첫 대사·이동·삭제·아이템 가격·맵 이름·숙박 요금·선택지·일회성 보상 10개다. seed의 coverageGaps는 미측정 기능이며 통과로 집계하지 않는다.

## 실행 경로

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

공용 라이브러리 판본이 관측 중 바뀌어 `meta.bootNormalization.lib`만 달라졌다면 저장 게이트는 환경 차단으로 둔다. 전체 문서를 대조하여 그 스탬프 외의 게임 내용이 완전히 같을 때만 이 분류를 허용한다. 일반 필드·타일·에셋 차이를 예외로 숨기지 않는다. 원래 SHA와 새 판본을 함께 기록한다. 공용 라이브러리 판본을 실행 전체에 잠그는 기능은 후속 범위이며 현재 하네스는 판본 변경을 탐지한다.

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
