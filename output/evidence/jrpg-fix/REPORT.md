# 모험 JRPG 적대적 리뷰 — 수정 후 재검증

**합격 — 수정·보정 후 검증한 프로젝트**

대상 프로젝트: `oprn-399e312698`. 최초 불합격 보고서(로컬 보관): `../jrpg-adversarial-review/REPORT.html`.

이 판정은 아래 체크리스트와 실제 플레이 가능한 초안에 대한 판정이다. 최초 프롬프트 한 번으로 무보정 완성됐다는 뜻이 아니다. 여러 실제 AI 실행, 에디터·런타임 코드 수정, 감독자의 실제 편집 도구 보정이 포함된다. 상용 게임 수준의 재미·전투 밸런스는 이번 합격 범위에 포함하지 않았다.

## 실제 AI 실행

원문을 에디터 입력창에 그대로 입력했다. 기본 모델 `gemini-3.7-flash`, 최신 원문 재실행 약 172초, 도구 58회 중 실패 12회, 최종 계획 4/4 완료. 실행 한도에 따른 자동 계속 2회가 포함된다. 제공자 사용량이 없어서 토큰 수나 비용이 0이었다고 판정하지 않는다.

입력 원문은 `review/original-prompt.txt`, 툴 이름·인자·성공 여부·시간은 `review/ai-tool-audit.json`에 보존했다. AI는 이후 시각 검사에서 물 위 상자, 문 모양 안내판, 빠진 아이템 그림, 몬스터 그림을 배경으로 사용한 미리보기 문제를 남겼다. 이 부분은 감독자가 조회 후 실제 편집 도구로 보정했다.

## 체크리스트 판정 근거

| 항목 | 확인 내용 |
|---|---|
| 1. 현재 프로젝트 이어 작업 | oprn-399e312698의 맵 4개 목록, 수정할 마을·던전의 타일·이벤트와 DB를 조회. 원문 재실행 전후 기존 맵 ID와 모든 타일 배열 보존. |
| 2. 장르 무대 | 푸른나무 마을 30×25, 어두운 숲 던전 24×20, 연결된 민가 20×20 두 곳. 숲·연못·갈림길과 마을 북쪽 던전 동선 확인. |
| 3. 시작 위치 | 마을 (14,18). 길드 안내원 앞에서 3인 파티, 200G, 회복약 3개와 에테르 2개로 시작. |
| 4. 핵심 NPC/이벤트 | 길드 안내·접수원, 상인, 던전 경비, 조사원, 보물상자 2개, 저장 지점, 늑대 우두머리. 이벤트 페이지와 실제 상호작용 확인. |
| 5. 적·트룹 DB | 숲 관련 적 6종과 트룹 6종 조회. 필드 슬라임, 늑대·고블린 전투 연결. 새 독거미·말벌은 DB 시드이며 전부를 랜덤 조우에 넣었다고 주장하지 않음. |
| 6. 아이템 DB | 모험 관련 아이템 5종. 회복 수치·가격·소모 조건·그림 확인. 상점 구매와 상자 지급을 실제 인벤토리로 검증. |
| 7. 실존 ID 확인 | 원문 실행에서 get_database_records로 반환받은 ID를 참조. 같은 응답 안에서 생성→조회→즉시 참조한 호출은 조회 결과를 소비할 때까지 차단하고 다음 응답에서 복구. |
| 8. 계획 순차 완료 | 계획 4개 모두 done. get_database_records/upsert_item, upsert_enemy/upsert_troop, set_start_position/place_npc, place_chest/upsert_event 각각의 성공 후 완료. |

최신 원문 재실행에서는 아이템·적·트룹을 각각 2개 추가했다. 기존 DB 레코드 수정·삭제는 0건이며, 기존 4개 맵의 타일 배열도 일치한다(`review/ai-content-delta.json`).

## 수정한 동작

- 필수 조회가 실패하거나 원본 DB를 충분히 읽지 않았으면 후속 쓰기를 막는다. 새로 만든 ID도 조회 결과를 실제로 받은 다음 참조한다.
- 각 계획 항목의 필수 도구를 전부 성공시켜야 완료한다. 미등록 도구 이름을 지워 조건을 낮추거나 이전 항목의 성공을 재사용하지 않는다.
- 실행 한도·계속 과정에서 실제 적용한 쓰기와 원래 목표를 유지한다. 중단을 완료처럼 표시하거나 적용한 작업을 “변경 없음”으로 보고하지 않는다.
- 검사 도구 실행 성공과 품질 통과를 구분한다. 명시 검사의 오래된 성공은 쓰기 후 무효화하고, 통과한 자동 자문 검사가 불필요한 재검증 의무를 만들지 않게 했다.
- 잘못된 `trigger.commands` 입력을 명확히 거절해 기존 전이 명령이 사라지는 것을 막는다. 전체 맵 요청에 부분 뷰포트 범위를 섞지 않는다.
- 생성 몬스터 필드 외형, 집 입구 문 애니메이션, 실제 저장 슬롯 직접 진입을 검증했다. 최신 main의 이벤트 메뉴 대기 및 키보드 UI 변경도 통합했다.
- `place_chest`는 노출된 수면에 상자를 놓지 못한다. 벽감과 통행 가능한 다리의 기존 규칙은 유지한다.

## DB 설정

현재 DB 전체는 아이템 232개, 적 113종, 트룹 13개다. 아래는 이 모험과 관련된 레코드이며 기존 DB를 초기화하지 않았다.


### 전체 DB 컬렉션

| 컬렉션 | 현재 레코드 수 |
|---|---:|
| `crops` | 0 |
| `items` | 232 |
| `actors` | 6 |
| `skills` | 33 |
| `states` | 12 |
| `troops` | 13 |
| `classes` | 6 |
| `enemies` | 113 |
| `elements` | 17 |
| `terrains` | 3 |
| `equipment` | 86 |
| `lifeSkills` | 0 |
| `battleCommands` | 4 |
| `monsterSpecies` | 10 |
| `battleAnimations` | 43 |

### 아이템

| ID | 이름 | HP / MP 회복 | 가격 | 그림 |
|---|---|---|---|---|
| `item_adventurer_potion` | 모험가 회복약 | 150 / 0 | 80G | `cc0-jetrel-hi-potion` |
| `item_adventurer_elixir` | 모험가의 영약 | 150 / 30 | 150G | `cc0-jetrel-ether-blue` |
| `item_adventurer_ration` | 모험가의 비상식량 | 150 / 0 | 60G | `cc0-jetrel-bread` |
| `item_forest_herb` | 숲의 약초 | 60 / 0 | 30G | `cc0-jetrel-herb-green` |
| `item_forest_dew` | 숲의 이슬 | 0 / 30 | 50G | `cc0-jetrel-gen2-life-dew` |

### 적

| ID | 이름 | HP / 공격 / 방어 | 행동 | 보상 EXP / G |
|---|---|---|---|---|
| `enemy_forest_slime` | 숲길 슬라임 | 45 / 15 / 10 | 0개 (없으면 일반 공격) | 5 / 8 |
| `enemy_forest_wolf` | 숲 늑대 | 120 / 28 / 15 | 0개 (없으면 일반 공격) | 12 / 15 |
| `enemy_forest_goblin` | 숲 고블린 | 120 / 24 / 18 | 2개 (없으면 일반 공격) | 12 / 10 |
| `enemy_forest_goblin_shaman` | 숲 고블린 주술사 | 90 / 18 / 14 | 3개 (없으면 일반 공격) | 18 / 15 |
| `enemy_forest_spider` | 숲 독거미 | 85 / 22 / 16 | 0개 (없으면 일반 공격) | 15 / 12 |
| `enemy_forest_hornet` | 숲 말벌 | 70 / 25 / 14 | 0개 (없으면 일반 공격) | 18 / 15 |

### 트룹

| ID | 이름 | 실제 구성 적 ID |
|---|---|---|
| `troop_forest_hornets` | 숲 슬라임·박쥐 무리 | enemy_meadow_slime, enemy_cave_bat, enemy_meadow_slime |
| `troop_forest_slimes` | 초록 슬라임 무리 | enemy_forest_slime, enemy_forest_slime |
| `troop_forest_wolves` | 숲 늑대 무리 | enemy_forest_wolf, enemy_forest_wolf |
| `troop_forest_goblin_patrol` | 숲 고블린 순찰대 | enemy_forest_goblin, enemy_forest_goblin |
| `troop_forest_spiders` | 숲 독거미 무리 | enemy_forest_spider, enemy_forest_spider |
| `troop_forest_hornets_duo` | 숲 말벌 편대 | enemy_forest_hornet, enemy_forest_hornet |

## 시각 QA와 플레이 QA

편집기 DB는 검색으로 실제 레코드를 열고 이미지 로딩 완료 후 캡처했다. 맵 전체 이미지와 실제 플레이 화면을 별도로 보았다. 전체 맵 이미지의 노란 점은 편집기 이벤트 표식이며, 실제 캐릭터·상자 외형은 플레이 화면으로 확인한다. 게임 QA는 `player.html` + 내보내기 store 경로를 사용했다. 전투에는 실제 키보드 입력, 보행에는 키보드와 같은 Input 처리 경로의 방향 입력 훅을 사용했다. 좌표·스위치·인벤토리를 강제로 바꾸지 않았고, 세이브는 동일 브라우저 저장소를 쓰는 새 플레이어 페이지에서 불러온다.

보행은 실제 스프라이트의 이동 완료와 움직이는 NPC 위치를 읽어 경로를 재계산한다. 전투가 시작되면 승리·보상·전환 종료 후 다시 걷는다. 초기 자동화가 고정 경로·고정 대기 시간을 사용해 실패했던 실행은 통과 증거에서 제외했다. 최종 결과와 상태는 `review/runtime-journey.json`, 검증 경로는 `runtime-journey.mjs`에 있다.

최종 플레이 기록: 37개 확인 지점, 브라우저 오류 0개.

- start: map_blank_start (14,18), 200G
- guide: map_blank_start (14,18), 200G
- shop: map_blank_start (16,16), 200G
- purchase: map_blank_start (16,16), 150G
- house-1-entry: map_house_interior_1_map_blank_start_1 (10,15), 150G
- house-1-return: map_blank_start (15,6), 150G
- house-2-entry: map_house_interior_1_map_blank_start_2 (10,15), 150G
- house-2-return: map_blank_start (3,6), 150G
- dungeon-entry: map_forest_dungeon (12,17), 150G
- battle-9: map_forest_dungeon (7,17), 150G
- victory-10: map_forest_dungeon (7,17), 180G
- battle-11: map_forest_dungeon (6,7), 180G
- victory-12: map_forest_dungeon (6,7), 210G
- chest-open: map_forest_dungeon (6,6), 310G
- chest-repeat: map_forest_dungeon (6,6), 310G
- battle-15: map_forest_dungeon (9,6), 310G
- victory-16: map_forest_dungeon (9,6), 330G
- battle-17: map_forest_dungeon (15,10), 330G
- victory-18: map_forest_dungeon (15,10), 350G
- east-chest-open: map_forest_dungeon (20,7), 450G
- east-chest-repeat: map_forest_dungeon (20,7), 450G
- battle-21: map_forest_dungeon (19,9), 450G
- victory-22: map_forest_dungeon (19,9), 470G
- battle-23: map_forest_dungeon (12,9), 470G
- victory-24: map_forest_dungeon (12,9), 500G
- boss-introduction: map_forest_dungeon (12,9), 500G
- battle-26: map_forest_dungeon (12,9), 500G
- victory-27: map_forest_dungeon (12,9), 530G
- boss-cleared: map_forest_dungeon (12,9), 530G
- battle-29: map_forest_dungeon (10,10), 530G
- victory-30: map_forest_dungeon (10,10), 560G
- battle-31: map_forest_dungeon (10,17), 560G
- victory-32: map_forest_dungeon (10,17), 590G
- save-menu: map_forest_dungeon (10,17), 590G
- saved: map_forest_dungeon (10,17), 590G
- loaded: map_forest_dungeon (10,17), 590G
- returned: map_blank_start (20,6), 590G

## 저장과 검증 한계

원격 저장 활성 상태의 store.flush 이후 Supabase HTTP 200으로 해당 프로젝트를 다시 조회하고 store.reloadFromRemote를 실행했다. 첫 비교에서 레거시 대사 lines→body와 빈 상점 분기의 로드 정규화 차이가 있었으며, 로드한 정규 데이터를 저장한 뒤 세 값을 다시 비교했다.

최종 비교 일치: `True`. 브라우저 저장 전 / 원격 / 브라우저 재로드 SHA-256: `ed254ee162e783808c4a3baef103e8dac7372e8ae3c2b68a4343dcc57c5111d2`. 전체 근거는 `review/persistence.json`.

원격 재확인에서도 출하 로드·직렬화 정규화를 거친 해시가 동일했다(`review/remote-recheck.json`, HTTP 200). 원시 행의 차이는 에디터 재로드 시 추가된 빈 상점 분기 기본값이었다.

Lint는 오류 0, 경고 33, 안내 52건이다. 경고에는 문 이벤트의 직접 밟기 불가(실제 진입 패드가 문 이벤트를 호출), 전이 재발동 가능성, 명령 부분 지원 분류, 비활성 시간 시스템의 잔여 일정이 포함된다. 경고 0 또는 프로젝트 전체 기능 완전 검증으로 과장하지 않는다. 문·전이·상자·저장·전투는 별도 실제 플레이로 확인한다.

## 코드 검증

최종 소스 `c5f48f0b`의 깨끗한 독립 워크트리에서 감독자가 직접 `npm run gates -- --json`을 실행했다. 저장소 전체에는 기존 실패가 있으므로 같은 main `6950be5d`의 동일 실패 파일을 재실행하고 테스트 이름·중복 횟수와 실패 진단 내용을 비교했다. 같은 실패 테스트 안에 추가됐던 물 타일 역할 비교 2곳도 공통 능력 함수로 고쳤다. 중간 진단 실행과 타이밍이 잘못된 캡처를 최종 게이트로 대체하지 않는다.

최종 게이트 결과: 직접 종료 코드 1. 앱 타입 검사 0오류와 CSS는 통과했다. Vitest 13,266건 중 13,082건 통과, 169건 실패, 15건 건너뜀이다. 변경한 17개 테스트 파일의 280개 검증은 모두 통과했다. main `6950be5d`의 관련 92파일 실행에서 166개 동일 실패가 있었고, 최종에만 보인 DB 개요 3개 실패는 main·최종 양쪽의 개별 실행에서 모두 통과했다. 따라서 전체 실행의 시간 의존 실패 3건은 원본에 남겨 두며, 전체 게이트가 초록이라고 주장하지 않는다. 실패 이름뿐 아니라 진단·expected/received를 비교하고, 불명확한 오류는 별도 실행으로 보완했다. 상세 비교와 한계는 `review/baseline-comparison.md`에 있다.

## 재현용 증거

- `review/ai-tool-audit.json`: 원문 실행의 실제 도구 호출과 계획.
- `review/stage-authoring-audits.json`: 무대·보급·주민을 보완한 별도 AI 실행의 도구 기록.
- `review/ai-content-delta.json`, `review/content-records.json`: AI 실행 전후 변화와 최종 아이템·적·트룹·이벤트 설정.
- `review/maintenance-tools.json`: 직접 보정에 사용한 실제 조회·편집 도구와 성공 결과.
- `review/db-visual-checks.json`: DB 20개 화면의 이미지 로딩 확인.
- `review/persistence.json`: 원격 프로젝트 ID, 저장·재로드, 비교 해시.
- `review/runtime-journey.json`, `review/runtime-SUMMARY.md`: 출하 플레이어 입력 및 결과.
- `review/gates.json`, `review/baseline-comparison.json`: 전체 게이트와 main 비교.
- `screens/`: 실제 AI 패널, 맵, DB, 플레이 화면.

감독자의 직접 보정은 `maintain-final-content.mjs`, `maintain-final-graphics.mjs`, `maintain-final-backdrops.mjs`, `maintain-final-naming.mjs`, `maintain-final-roster.mjs`에 기록했다. 이 스크립트는 프로젝트를 조회하고 편집기의 applyToolToStore를 호출한 뒤 실제 원격 저장을 수행한다. 원시 프로젝트 전체와 인증정보는 PR 증거에 포함하지 않는다.
