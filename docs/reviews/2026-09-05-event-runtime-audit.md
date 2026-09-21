# 이벤트 명령의 런타임 실행 검토 — 2026-09-05

회상 중 NPC의 강제 방향 전환이 멈추는 문제를 일반 키보드 플레이로 재현했다. 저장·명령 등록·인터프리터의 정상 종료는 실제 화면 효과가 실행됐다는 증거가 아니었다.

## 범위와 한계

- 카탈로그 125개 전체의 맵 실행 분류와 네이티브 변환 경로를 확인했다. 피커 기준 `runtime-full` 60개, `runtime-partial` 64개, `editor-only` 1개(주석)다. **64개가 모두 버그라는 뜻도, 60개가 모두 정상이라는 뜻도 아니다.**
- 의심되는 M2 명령 9종을 실제 인터프리터에 넣고 다음 명령까지의 결과를 기록했다. 화면 소비자가 있는지도 별도로 검색했다.
- 「철수의 기억」은 DB에서 다시 받은 데이터로 출하 플레이어에서 재현했다. 방향키와 Enter만 사용하고, 조작 훅·텔레포트·강제 이동 주입을 사용하지 않았다. 디버그 상태는 관찰에만 썼다.
- 125개 전부를 화면·소리까지 실행한 전수 플레이 검증은 아니다. 이번 수정은 아래에서 확인한 결함에 한정한다. 나머지 명령의 완전 구현을 보장하지 않는다.

## 확인된 결함

| 우선순위 | 명령/경로 | 실제 실행 결과 | 상태 |
|---|---|---|---|
| P1 | NPC 이동 루트 + 완료 대기 / 모든 이동 완료 대기 | `scene.running=true`이면 NPC 업데이트가 통째로 차단된다. `father`는 step=0, remainingMoveCount=1인 채 입력이 잠기고, 30초 대기 제한이 끝나야 다음 명령으로 넘어간다. | **엔진 수정 및 회귀 검증**. 강제 명령 루트만 진행하고 배경 자율 이동과 병렬 이벤트의 정지는 유지한다. DB 프로젝트에는 기존 실행기에서도 동작하도록 해당 구간의 이동 허용 설정도 저장했다. |
| P2 | 저장된 `m2-002-display-text-settings` | 작성한 투명/상단/이벤트 이동 허용 값이 무시되고 normal/bottom/false로 초기화된다. 네이티브 `displayTextSettings`와 결과가 다르다. | **수정 및 회귀 검증**. 지정 필드를 읽고, 누락·잘못된 값에만 기본값을 적용한다. |
| P1 | `m2-206-wait-until` | 조건을 한 번 평가하고 실패하면 `wait(timeoutMs)` 한 번만 반환한다. timeout=0에서는 스위치가 여전히 false인데 바로 다음 대사로 진행한다. 조건이 바뀌었는지 재검사하지 않는다. | **수정**. 50ms 이하로 다시 검사하며 0은 무기한, 양수는 제한 시간이다. 스위치·변수·지역·이벤트 이동 완료를 판정한다. 조건 생산자가 멈추지 않도록 전경 조건 대기 중 병렬 이벤트를 허용한다. |
| P1 | `m2-205-pathfind-move` | 이동 루트나 탐색 작업을 반환하지 않고 `session.x/y` 또는 `eventLocations`를 목적지로 바로 바꾼다. `wait=true`여도 다음 대사로 진행한다. 충돌·경로·보행 완료를 검증하지 않는다. | **수정**. A*로 지형·몸 크기·고정 장애물·현재 NPC 점유를 검사하고 실제 플레이어/NPC 보행 루트로 실행한다. 대기·비대기와 속도를 지원하며 도중 장애물에는 정지한다. 도착 여부는 `session.flags.pathfindSucceeded`에 남긴다. |
| P2 | `m2-078-open-menu-screen`, `m2-093-open-load-menu` | 두 명령 모두 `openSaveMenu` 단계로 변환되고, 실행기는 저장 메뉴 콜백을 호출한다. | **수정**. 상태 메뉴와 불러오기 패널을 별도로 열고 닫힐 때까지 다음 명령을 차단한다. 저장 슬롯을 불러오면 이전 이벤트 실행을 폐기하고 새 세션을 보존한다. 병렬 프로세스의 사용자 입력 메뉴는 경고 후 건너뛴다. |
| P2 | `m2-042-get-terrain-id`, `m2-043-get-event-id` | 좌표의 맵·이벤트를 조회하지 않고 목적 변수에 항상 0을 쓴다. 이벤트가 있는 (2,2)에서도 같은 결과다. | **수정**. 맵·좌표의 실제 지형 태그(런타임 타일 변경 포함)와 현재 이벤트 위치를 읽는다. 지워진/제거된 이벤트는 제외한다. 숫자 변수의 이벤트 값은 1부터 시작하는 맵 이벤트 순번이며, 런타임 제거는 번호를 당기지 않는다. |
| P2 | 저장된 `m2-066-play-movie` | `m2Runtime.system.movie`에 문자열만 기록하고 다음 대사로 진행한다. 이 슬롯을 영상 재생기로 전달하는 소비자는 없다. | **수정**. 저장된 M2도 네이티브 `playMovie` 단계를 반환하여 실제 HTML video로 재생하고 종료까지 기다린다. `resourceId` 우선, 옛 `value` 필드는 호환 입력으로 지원한다. |

`UI Command`는 비교 사례다. 인터프리터에서는 상태 기록 뒤 바로 다음 명령으로 진행하지만 `playSceneZoneFeedback.ts`가 `m2Runtime.ui`를 소비해 toast/banner 등을 그린다. 따라서 **블로킹 단계가 없다는 이유만으로 미작동 판정을 내리지 않았다.**

## 왜 이전 검증에서 놓쳤나

- 기존 회상 검증은 일부 입력을 `__oprnInput`과 `playerRoute`로 주입했고, 수십 초간 다음 대사를 기다려도 최종 상태만 맞으면 통과했다. 30초 타임아웃을 정상적인 장면 진행과 구별하지 못했다.
- 이동 루트 단위 테스트 상당수는 `updateAutonomousNPCs()`를 직접 호출했다. 실제 프레임 루프의 `scene.running` 게이트를 지나지 않으므로 이번 정지를 검출하지 못했다.
- 새 회귀 테스트는 `updatePlayScene()`에서 1초 동안 실행해 강제 방향 전환 완료, 배경 NPC 정지, 병렬 이벤트 정지를 함께 단언한다. 수정 전에는 강제 루트가 남아서 실패했다.
- 새 키보드 검증은 글자 출력 시간과 **대사 없는 정지**를 나눠 검사한다. 침묵 상태는 5.5초 상한이며, 별도로 글자 출력 완료를 기다린 후 Enter를 한 번 누른다.

## 검증과 재현

- 원본 프로젝트와 LegacyDb 저장 후 재로드한 최종 프로젝트 모두 수정된 엔진으로 일반 키보드 검증 통과: 17개 대사, 현재 귀환, 상자 재조사, 이동 복구. 요약에서 지정한 회상 후반/귀환 후 PNG도 확인했다.
- 후속 수정의 관련 테스트 9파일, 139개 통과. 프로젝트 v3 마이그레이션·저장·재로드, 조건 반복 검사, 시간 제한, 경로 실제 프레임 진행, 동적 장애물 정지, 메뉴 대기와 세션 교체, M2 영상 종료 대기를 검증했다.
- 첫 회상 수정 시 관련 테스트 6파일, 87개 통과. 강제 이동과 저장된 M2 대화 설정 회귀는 수정 전 실패를 확인했다.
- `npm run gates -- --only typecheck`: app 타입 오류 0, 기준선 대비 회귀 없음.
- 출하 플레이어 계약 QA 통과: 조건 생산자, 장애물 우회 보행·중간 좌표, 실제 메뉴와 불러오기 패널, video playing/ended, 저장 슬롯 불러오기 후 이전 이벤트 종료와 입력 복구. 화면 6장도 확인했다. 불러오기 패널의 게임 영역 밖 배치도 고쳤다(`src/styles/runtime/title.css`). Chromium의 GPU ReadPixels 성능 경고 4건은 앱 오류와 구분해 report.json에 보존했다.
- 후속 수정 뒤 「철수의 기억」 17개 대사·귀환·재조사·이동도 다시 통과했다.
- 최종 런타임 관련 11파일 / 222개 통과. 전체 게이트는 exit 1(12,929 통과 / 208 실패, 표면 실패)이며 마지막 선택 필드 보정 전 실행이다. 기준선 밖 실패 30파일을 base `2489cfef`와 대조해 경고 회귀 2파일을 수정했다. 동시성에 따라 달랐던 편집기 3파일은 `--maxWorkers=1` 재실행에서 base/head 모두 28개 통과했다. 표면 검사 6개 실패와 CSS live-class 실패는 base에서도 동일하다. 전체 통과를 주장하지 않으며, 상세 비교와 제한은 `.omo/evidence/event-runtime-audit/README.md` 및 `gate-comparison.json`에 기록했다.
- 원격 프로젝트: `rpg-zzu-cheolsu-memory-20260905-df12`. 기존 프로젝트의 `memory_summer/summer_scene`에 설정 명령 두 개만 추가하고 LegacyDb 저장 후 재로드 대조를 완료했다. 저장 결과 `saved`, 재로드 `true`, SHA-256 `32625f7b4d717e4f708e57b90861f1546ca1d1b43cd410badd2e86f6004ae2b8`.

```bash
npx tsx scripts/audit-event-runtime.mts
node scripts/qa-cheolsu-keyboard.mjs .omo/evidence/cheolsu-memory/remote-before-fix.json engine-fixed
node scripts/qa-cheolsu-memory.mjs
npx tsx scripts/prepare-event-runtime-qa.mts
node scripts/qa-event-runtime.mjs
```

근거 파일:

- `.omo/evidence/event-runtime-audit/catalog.json`: 125개 분류
- `.omo/evidence/event-runtime-audit/probes-before-fixes.json`, `probes.json`: 인터프리터 재현
- `.omo/evidence/event-runtime-audit/focused-tests.log`, `typecheck-gate.log`
- `verify-shots/runtime-qa/cheolsu-keyboard-before/SUMMARY.md`: 9번째 대사 뒤 정지 재현
- `verify-shots/runtime-qa/cheolsu-keyboard-candidate/SUMMARY.md`: 기존 엔진 + 프로젝트 설정 수정으로 17개 대사 진행
- `verify-shots/runtime-qa/cheolsu-keyboard-engine-fixed/SUMMARY.md`: 원래 프로젝트 + 엔진 수정 검증
- `verify-shots/runtime-qa/cheolsu-keyboard-fixed/SUMMARY.md`: 원격 재로드 프로젝트의 최종 17개 대사·귀환·재조사·이동 통과
- `.omo/evidence/cheolsu-memory/repair-persistence.json`: 원격 저장·재로드 증거

주요 실행 경로: `src/player/playSceneMovement.ts`, `playSceneAutonomous.ts`, `playSceneInterpreter.ts`, `interpreter/commandCatalog.ts`, `interpreter/m2Runtime.ts`, `interpreter/m2ModernRuntime.ts`.

## 후속 수정의 경계

- `Wait Until`의 `region`은 현재 맵 `layoutPlan.regions`의 ID와 직사각형을 사용한다. `eventIdle`의 `player`/`@player`는 플레이어 강제 루트와 보행·체공 종료를, `this-event`는 현재 이벤트를 가리킨다. 존재하지 않는 대상은 충족으로 오인하지 않는다.
- 경로 이동은 명령 시작 시 경로를 계산한다. 이후 장애물이 새로 생기면 남은 절대 방향을 소비하지 않고 정지하며 실패 상태를 남긴다. 실시간 장애물 재탐색은 이번 범위에 넣지 않았다. 경로 교체·Stop All Movement·맵/세션 교체·씬 종료·컷신 스킵 때 이전 작업이 새 루트를 지우지 않도록 소유권을 검사한다.
- 이벤트 ID는 숫자 변수 계약에 맞춰 현재 맵의 저작 배열 순번(1-based)을 쓴다. 다른 맵에서 옮겨온 이벤트와 동적 생성 이벤트는 현재 맵의 저작 슬롯 뒤에 별도 순번을 배정한다. 없음/범위 밖은 0이다. 문자열 이벤트 ID 자체를 변수에 넣지 않는다.
- 메뉴·영상·경로의 실동작 검증은 `player.html` 전용 브라우저 하네스가 맡는다. `run_scene_test`의 headless 실행기가 새 경로/메뉴 단계를 지원한 것처럼 넘기지 않도록 명시적인 검증 제한을 반환한다.
- `test/fixtures/eventRuntimeCommands.ts`는 저장·불러오기·실행 계약 검증만을 위한 최소 테스트 픽스처이며 앱에 싣는 데모나 LegacyDb 사용자 프로젝트가 아니다.

PR에 보존한 실행 근거: `.omo/evidence/event-runtime-audit/README.md`와 같은 폴더의 `player-report.json`, `player-SUMMARY.md`, `cheolsu-report.json`, 지정 PNG들.
