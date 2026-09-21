# 현재 브라우저와 원격 읽기 증거

실측일: 2026-09-05. 제품 코드 기준은 `32ef1bcd66476d09486a8a09893da02184d2ebd5`.
이 기록은 감독자가 직접 실행한 결과다.

## 원격 저장본을 읽었으며 수정하지 않았다

기존 프로젝트 `rpg-zzu-stardew-demo`를 편집기 `/legacyDb/rest/v1/projects` 프록시에서
`Accept-Profile: rpg_zzu`와 설정된 인증으로 GET했다. 최초 무인증 요청은 401,
설정된 인증을 사용한 요청은 **HTTP 200, 1행**이었다.

- 제목: 별빛 농장 마을.
- 맵 2개, 작물 8종, 생활 기술 5종, 시작 동물 2마리, 어종 2종.
- 박물관 활성화.
- 저장본 `current_sha256`:
  `bd9b8c08c077808ff3de43cde16939d2354c1f7445ec5eecb572e47d1cde2641`.

프로젝트 행에 쓰기·저장·업서트를 하지 않았다. 과거 저장본이 현재 조회된다는 증거이지,
이번 작업에서 새 콘텐츠를 저장한 영수증이 아니다.

## 편집기: 빈 상태와 기존 저장본을 구분한다

편집기 서버는 전용 워크트리의 `http://127.0.0.1:40059/`다.
기존 `?blankProject=1` 경로의 빈 탭을 먼저 캡처했다. 이어 읽은 원격 저장본을
기존 `__RPG_ZZU_E2E_PROJECT__` 훅에 주입한 격리 브라우저 세션으로 로드했다.
편집기 자체에서 데이터베이스를 열고 생활 그룹의 7개 탭을 클릭했다.
화면은 1440×1000이며 별빛 농장 마을의 제목과 데이터가 표시되었다.

| 탭 | 빈 상태 | 기존 저장본 표시 |
|---|---|---|
| 농사·작물 | [화면](images/editor-crops.png) | [화면](images/project-crops.png) |
| 주민 관계 | [화면](images/editor-characters.png) | [화면](images/project-characters.png) |
| 생활 기술·제작 | [화면](images/editor-life-crafting.png) | [화면](images/project-life-crafting.png) |
| 계절·날씨 | [화면](images/editor-daily-weather.png) | [화면](images/project-daily-weather.png) |
| 동물·축사 | [화면](images/editor-farm-animals.png) | [화면](images/project-farm-animals.png) |
| 농장 건물·집 꾸미기 | [화면](images/editor-farm-spatial.png) | [화면](images/project-farm-spatial.png) |
| 낚시·채집·박물관 | [화면](images/editor-life-collections.png) | [화면](images/project-life-collections.png) |

이 화면들은 레코드 표시와 탭 이동의 증거다. 폼 변경·저장·재로드를 검증한 것은 아니다.
중간에 로컬 모듈 요청의 `ERR_NETWORK_CHANGED`로 빈 화면이 발생했고 재로드 후
같은 서버에서 정상 표시됐다. 이를 생활 기능 결함으로 분류하지 않는다.

## 출하 플레이어: 편집기 플레이를 사용하지 않았다

저장소의 `scripts/lib/runtimeQaRun.mjs`에 있는 `startPlayerQaServer()`를
전용 워크트리 프로세스에서 실행했다. 주소는 `http://127.0.0.1:44685/player.html`.
`__OPENRPG_BOOT__`의 프로젝트 URL 요청에 읽은 원격 JSON을 그대로 공급했다.
별도 저장 네임스페이스 `life-audit-readonly-20260905`와 QA 계측을 사용했다.
이미 설치된 Playwright Chromium, 1280×960 화면으로 실행했다.

처음 커널에서 서버를 시작한 시도는 워커의 cwd 때문에 Vite 허용 경로 403이 났다.
위 별도 프로세스는 올바른 cwd를 사용하며 그 오류를 해결했다. 이 403은 제품 결함이 아니다.

`Enter`로 새 게임을 시작해 `map_farming_demo`, 플레이어 `(4,4)`, 봄 1일의 시계와
날씨/예보/다가오는 생일 HUD를 확인했다. [필드 화면](images/runtime-field.png).
이후 메뉴는 `Escape → ArrowDown 4회 → ArrowRight → ArrowDown 2회 → Enter`로
기록 그룹의 생활 장부에 진입했다. 장부 행동은 DOM의 `data-action-index`를 읽고
현재 선택 커서에서 방향키로 이동한 다음 `Enter`로 실행했다.
버튼 함수를 직접 호출하거나 포인터 차단을 해제하지 않았다.

### 실제 성공과 실패를 실행한 항목

| 행동 | 입력·전제 | 실제 관측 | 증거 |
|---|---|---|---|
| 출하함 넣기 | 기존 야생 부추 1개, 출하 탭에서 선택 후 Enter | 보유 행이 `출하함 1 · 1개 꺼내기`로 바뀌고 `출하함에 넣었습니다` 표시 | [예치](images/runtime-shipping-deposited.png) |
| 출하함 회수 | 같은 품목의 꺼내기 선택 후 Enter | runtime-state의 야생 부추 인벤토리가 다시 1개 | 다음 박물관 기부 전 상태와 아래 기록 |
| 닭 먹이 | 보리 먹이 주기, 기존 건초 8개 | 건초 8→7, 당일 먹이 버튼 비활성 | [돌봄](images/runtime-animals-cared.png) |
| 닭 쓰다듬기 | 보리 쓰다듬기 | 친밀도 0→15/1000, 당일 쓰다듬기 버튼 비활성 | [돌봄](images/runtime-animals-cared.png) |
| 박물관 기부 | 회수한 야생 부추 1개 기부 | 부추 1→0, 골드 0→150, 기부 버튼 비활성 | [기부](images/runtime-museum-donated.png) |
| 도감 반영 | 기부 후 수집 도감 탭 | 야생 부추 `발견 / 기부 완료`, 보상 주화 발견 표시 | [도감](images/runtime-ledger-collections.png) |
| 재료 없는 가공 | 감자 재고 없이 절임통의 가공 시작 | `insufficient-input`, 골드 150 유지, 인벤토리 전후 동일 | [가공 거절](images/runtime-maker-rejected.png) |
| 장식 회전 | 기존 해님 러그의 회전 선택 | `아래 · 2×1`→`왼쪽 · 1×2`, 회전 완료 메시지 | [회전](images/runtime-decoration-rotated.png) |
| 농사 파종 | 기존 밭 `(4,5)` 앞 `(4,4)`에서 빈손 조사 입력 2회 | 첫 입력 뒤 씨앗 3개 유지, 둘째 입력 뒤 감자 씨앗 3→2 | [첫 입력](images/runtime-farm-tilled.png), [파종](images/runtime-farm-planted.png) |
| 취침·날짜·날씨 전환 | 기존 잠자리 `(3,3)` 앞 `(3,4)`에서 위쪽 조사 후 대화 확인 | 봄 1일 오전→봄 2일 아침, HUD는 비→맑음 | [다음날](images/runtime-next-morning.png) |
| 닭 생산과 회수 | 전날 먹이·쓰다듬기 완료한 보리를 다음날 장부에서 확인 후 생산물 받기 | 받을 물품 1, 달걀 인벤토리 0→1 | [회수](images/runtime-animal-egg-collected.png) |

파종 실측의 위치·방향 준비에는 하네스와 동일한 `__oprnDebug.teleport` 및
`__oprnInput.face`를 사용했다. 행동은 `__oprnInput.action()`으로 실제 프레임
조사 경로에 전달했다. 인벤토리를 주입하거나 수확 함수를 직접 호출하지 않았다.
세 번째 물주기 입력의 [화면](images/runtime-farm-watered-input.png)도 남겼으나
현재 공개 runtime-state에는 밭의 watered 값이 없으므로 물주기 성공을 별도 상태
검증으로 확정하지 않는다. 수확까지의 전체 작물 주기를 실측했다는 주장도 하지 않는다.

수면은 기존 `ev_bed`의 대화→`sleepUntilMorning` 이벤트로 실행했다. 대화 직후의
즉시 snapshot에는 아직 이전 날짜가 남았고, 이후 실제 상태 갱신에서 봄 2일을 확인했다.
준비된 생산물 1개와 달걀 회수는 그 다음날의 장부에서 별도로 검증했다.
수면 함수나 날짜를 직접 대입하지 않았으며 자동 세이브 성공은 검사하지 않았다.

### 표시만 확인한 장부 탭

- [꾸러미](images/runtime-ledger-bundles.png): 요구품과 진행 표시.
- [기술](images/runtime-ledger-skills.png): 5개 기술의 Lv.1 / 경험치 0.
- [가공 설비](images/runtime-ledger-makers.png): 두 설비 시작 항목.
- [건물·꾸미기](images/runtime-ledger-spaces.png): 기존 건물/장식과 배치·이동·회수·강화·회전 항목.
- [출하 초기 상태](images/runtime-ledger-shipping.png).

## 이 증거로 확대 주장하면 안 되는 것

낚시 성공, 새 계절 채집물 줍기, 가공 시간 경과 뒤 수령, 작물 수확 완주,
주민 선물·연애·일정 완주, 건물 배치·업그레이드 전체, 게임 세이브 후 재개,
원격 저장 성공은 위 결과에서 입증하지 않는다.

원격의 콘텐츠는 읽기만 했고, 장부/농사 행동은 분리된 브라우저의 플레이 세션 상태만 바꿨다.
현재 코드에는 QA 계측이 켜져 있어 일부 디버그 이벤트 라벨이 DOM에 존재한다.
스크린샷 캡션에는 이 실행 환경을 숨기지 않는다.
