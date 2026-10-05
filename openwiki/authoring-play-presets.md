# 공용 플레이 프리셋 — AI 조수용 작성 매뉴얼

2026-10-05. 작은 플레이 구간을 실제 도구로 작성하기 위한 12개 분야·분야별 8종의 공용 매뉴얼 96종이다.
기존 24종에 72종을 더했다. 정본은 `src/project/authoringPresets.ts`이며 특정 프로젝트 행이나 사용자 프롬프트 저장소에 복제하지 않는다.
프리셋 조회는 읽기 작업이다. 이벤트 컴파일·플레이 검사·정본 저장을 수행했다고 보고하지 않는다.

## 목록

| 분류 ID | 프리셋 ID와 이름 |
|---|---|
| `exploration` 탐험·장치 | `keyed-route` 열쇠와 잠긴 통로 / `switch-order` 단서 순서 장치 / `pressure-plates` 발판과 봉인 해제 / `return-shortcut` 귀환 지름길 / `optional-cache` 샛길과 숨은 보상 / `checkpoint-hazard` 위험 구간과 체크포인트 / `day-night-route` 낮과 밤에 달라지는 길 / `loop-map-orientation` 순환 공간과 방향 단서 |
| `npc-life` NPC 생활 | `workday` 출근과 귀가 / `guard-patrol` 경비의 순찰과 교대 / `night-shop` 밤에 여는 상점 / `seasonal-visitor` 계절에 따라 찾아오는 손님 / `progress-reactions` 사건 뒤 달라지는 주민 반응 / `activity-dialogue` 활동에 맞는 대화 / `merchant-stock-progress` 사건에 따라 바뀌는 상점 / `rumor-chain` 주민을 따라 이어지는 소문 |
| `life-economy` 생활·경제 | `craft-and-sell` 재료를 만들어 판매하기 / `crop-shipping` 작물을 키워 출하하기 / `fish-museum` 낚시와 박물관 기증 / `season-forage` 계절 채집과 수집 기록 / `maker-processing` 가공 설비 운영 / `bundle-unlock` 꾸러미로 지역 해금 / `tool-upgrade-work` 도구 강화와 작업 범위 / `energy-rest-day` 작업과 휴식으로 보내는 하루 |
| `combat` 전투 구성 | `intro-duel` 첫 전투로 규칙 익히기 / `enemy-roles` 역할이 다른 적 조합 / `status-counter` 상태 이상에 대응하는 전투 / `resource-gauntlet` 자원을 관리하는 연전 / `boss-phases` 단계가 바뀌는 보스 / `optional-elite` 선택해서 도전하는 강적 / `element-scan` 약점 조사와 속성 공략 / `charged-strike-defense` 예고된 대기술에 대비하기 |
| `party` 동료·파티 | `recruit-condition` 조건을 충족하면 동료 합류 / `temporary-departure` 동료의 이탈과 재합류 / `split-party` 파티를 나눠 진행하고 재회 / `leader-ability` 리더 능력으로 장치 작동 / `companion-banter` 파티 구성에 따른 동료 대화 / `reserve-party` 거점에서 동료 교체 / `personal-awakening` 동료 개인 사건과 각성 / `rival-choice` 라이벌을 동료로 받아들이기 |
| `growth` 성장·기술 | `class-promotion` 조건을 갖춰 전직 / `level-skill-path` 레벨에 따라 배우는 기술 / `paid-training` 비용을 내고 기술 수련 / `dual-tech` 두 동료의 연계기 / `triple-tech` 세 동료의 조합 기술 / `enemy-skill-learning` 적에게서 기술 배우기 / `limit-break-training` 리미트 기술 익히기 / `resource-specialization` 자원 운용이 다른 기술 구성 |
| `dungeon` 던전 진행 | `timed-escape` 제한시간 안에 탈출 / `stealth-pursuit` 발각 뒤 추격과 안전지대 / `water-level-routes` 수위를 바꿔 길 열기 / `poison-zone` 위험 지형을 지나 정화 / `floor-elevator` 층을 연결하는 승강기 / `multi-key-seal` 여러 증표로 봉인 해제 / `ability-return-route` 새 능력으로 이전 장소 재탐험 / `dungeon-rest-point` 던전의 제한된 휴식 지점 |
| `world-story` 세계·사건 | `stronghold-liberation` 해방 뒤 이용하는 거점 / `ruin-restoration` 폐허를 단계별로 복구 / `transport-network` 배편과 이동망 개통 / `action-ledger-trial` 이전 행동을 판단하는 재판 / `reputation-services` 평판으로 이용하는 시설 / `festival-chapter` 사건 단계에 따라 바뀌는 축제 / `global-crisis-change` 큰 사건 뒤 달라지는 여러 장소 / `multi-route-resolution` 다른 방법으로 같은 사건 해결 |
| `time-causality` 시대·인과 | `era-gates` 같은 장소의 시대 이동 / `past-world-change` 과거 행동으로 미래 길 변경 / `future-hint` 미래의 단서로 과거 장치 해결 / `preserved-treasure` 미래까지 남겨 강화된 보물 / `ancestry-chain` 시대를 잇는 인물의 계승 / `era-item-exchange` 시대 사이의 물품 활용 / `disaster-prevention` 과거에서 막는 미래 재난 / `parallel-choice-world` 선택으로 갈라지는 두 세계 |
| `loot-equipment` 전리품·장비 | `targeted-hunt` 원하는 재료를 노리는 사냥 / `blueprint-unlock` 설계도로 제작법 해금 / `equipment-upgrade` 재료로 장착 장비 강화 / `scrap-recycling` 남는 물품을 재료로 재활용 / `selectable-reward` 보상 중 하나 선택 / `shop-tier-unlock` 진행에 맞춰 열리는 장비 판매 / `theft-loot` 전투 중 적의 물품 훔치기 / `costly-boon` 대가를 지불하는 보상 거래 |
| `repeat-challenge` 반복·도전 | `bounty-rotation` 완료하면 바뀌는 현상수배 / `material-boss-ritual` 재료를 바쳐 보스 소환 / `arena-waves` 웨이브를 넘기는 투기장 / `challenge-rank` 난도를 고르는 도전 / `tower-checkpoints` 최고 층을 기록하는 도전 탑 / `remix-dungeon` 구성이 다른 반복 던전 / `timed-rank-record` 제한시간 도전과 최고 등급 / `trophy-hunt` 강적별 증표와 수집 보상 |
| `endings` 엔딩·회차 | `choice-endings` 선택을 반영하는 엔딩 / `clear-timing-ending` 도전 시점에 따라 다른 결말 / `new-game-plus` 성장을 이월하는 새 회차 / `ending-collection` 여러 결말의 수집 기록 / `post-final-area` 최종전 이후의 후일담 지역 / `world-state-epilogue` 세계 상태를 반영하는 후일담 / `secret-ending-chain` 여러 조건으로 여는 숨은 결말 / `cycle-exclusive-route` 새 회차에서만 열리는 경로 |

각 항목은 버전·태그·예시·선행 데이터·상태 변화·단계별 행동/산출물/작성 도구·확인 항목·주의사항을 가진다.
상태 설명은 설계 계약이며 새 엔진 필드가 아니다. 실제 스위치·조건·명령은 현재 도구 스키마에 따라 작성한다.

## 조수 연결

주 사용자는 AI 조수다. 사용자의 일반 제작·수정 요청에서 조수가 적합한 프리셋을 찾아 읽는다.
프리셋 이름을 직접 지정하거나 편집기 메뉴에서 선택하는 것을 선행 조건으로 삼지 않는다.
현재 Pi와 기존 AssistantSession에 같은 선택·적용 지침을 제공한다. 범주로 후보를 조회한 뒤
요청에 필요한 지침을 읽고, 복합 요청이면 공통 인물·아이템·스위치·맵을 공유해 조합한다.
설명·조회 요청에서는 읽기와 설명까지 수행한다. 실제 모델이 선택하고 시공한 증거는 별도다.

- `list_authoring_presets({category?,query?,offset?,limit?})`: 제목·설명·태그·ID 검색.
  제목·설명·태그·ID와 분류 이름에 대해 모든 검색어 포함 조건을 적용한다.
  최대 12종씩 반환하며 `total/nextOffset`을 따른다. 분류별 전체 개수도 반환한다.
- `read_authoring_preset({presetId})`: 선택한 매뉴얼 전체, 공통 규칙, 실제 도구별
  `find_tools` 검색 입력, `verificationStatus:"not-run"`을 반환한다.
  presetId 스키마는 문자열이며 실제 ID 여부는 실행 시 검증한다. 96개 ID enum을
  초기 스키마에 주입하지 않아 목록·상세의 필요 시 조회를 유지한다.
  해당 분야의 현재 `system` 블록을 전체 목록으로 복사하고 빠진 필드를 별도로 알린다.
  배열 교체 전 원본 병합과 변경 후 최신 재조회에 사용한다. `startSession`은 저작 시작 상태이며
  현재 실행 중인 플레이 세션의 소지품·골드로 설명하지 않는다.
  모든 분야에 실제 스위치·변수·서사 슬롯 정의와 맵 ID/이름을 함께 반환한다.
  성장·인물·세계·엔딩 분야는 해당 프로젝트 원본과 빠진 필드를 별도로 반환한다.
  생활·경제에서는 현재 어종·작물·생활 스킬 원본도 복사한다. 일반 DB 조회가 어종 컬렉션을
  노출하지 않는 경로에서도 이 원본을 읽어 기존 어종을 보존한다.
- 구현은 `src/editor/tools/authoringPresetTools.ts`, 등록은 `toolRegistry.ts`.
  순수 읽기 도구이며 사용자 프로젝트를 수정하지 않는다.
  추가 매뉴얼은 `src/project/authoringPresets/`의 분야별 모듈에서 공통 생성자를 통해 만든다.
  타입 참조만 사용하며 공통 규칙 초기화 뒤 생성자를 넘겨 런타임 순환 참조를 피한다.
- 두 조회 도구는 `sessionToolExposure.ts`의 초기 제어 목록에도 포함된다.
  기존 AssistantSession의 `buildTaskRecipes`와 현재 Pi `buildPiAgentSystemPrompt`에
  짧은 발견 지침만 주입한다. 96종 전문을 매 턴 모두 보내지 않는다.
- 첫 플레이 실행의 허용 목록에는 이 두 읽기 도구만 추가한다.
  기존 첫 플레이 쓰기 범위나 하네스 제한을 넓히지 않는다.

진행: 목록 검색 → 선택한 매뉴얼 읽기 → 현재 데이터 읽기 → `find_tools`로 실제 작성 도구
스키마 확인 → 사용자 범위에 맞는 단계 작성 → 정상/실패/취소/재방문 검사 → 정본 저장·재로드.
원래 장르 제작 매뉴얼과 퀘스트 구조를 대체하지 않는다. 요청하지 않은 퀘스트를 붙이지 않는다.

## 편집기 표면

조수 작업 메뉴 → **플레이 프리셋**, 또는 AI 저작 도구의 **플레이 프리셋** 탭.
사용자가 목록을 살펴보거나 특정 패턴을 지정할 때 쓰는 보조 진입점이다.
`src/editor/panels/aiAuthoring/presets.ts`는 같은 공용 목록을 분류·검색하고,
유형별 요청 초안·작성 흐름·확인할 결과를 표시한다.
요청 확인은 최신 선택 맵을 읽어 조수 입력창에 붙이며 자동 전송하거나 콘텐츠를 저장하지 않는다.
현재 프로젝트가 바뀌면 기존 모달 소유 규칙에 따라 닫고 구독을 해제한다.

## 실제 기능과 한계

- 시간표는 시간 조건에 따른 위치 갱신이다. 연속 보행과 맵 간 보행을 보장하지 않는다.
- 발판 컴파일러는 임의 무게·상자 물리를 제공하는 것으로 설명하지 않는다.
- 생활 설정만 만들고 실제 제작·낚시·기부·출하 이벤트를 생략하면 플레이 구간이 아니다.
- 배열 설정은 기존 전체 목록을 읽어 병합한다. 실패·취소·수령 반복에서 소비/보상을 검사한다.
- 전투는 현재 프로젝트의 전투 방식을 유지한다. 보스 단계는 실제 `author_boss_phases`를 쓴다.
  `simulate_battle`만으로 실제 화면·복귀·정본 저장을 검증했다고 보고하지 않는다.

2026-10-05 확장에서는 12개 분야·96종의 페이지네이션, 모든 도구 참조의 실제 활성 여부와
작성 도구의 write 모드, 분야 필터와 요청문 전달을 확인한다. `catalog-96.json`은 공용
카탈로그 모듈을 직접 읽어 추출한 목록이며 실제 게임 저작·완주 근거가 아니다.

이 작업은 코드·공용 매뉴얼 등록이다. 사용자 게임 콘텐츠의 SQLite 변경은 없다.
화면과 도구 조회 근거는 `verify-shots/authoring-play-presets/`에 남긴다.
96종 게임 구간의 LLM 작성·실제 완주를 모두 실행한 증거와 구분한다.
