# 내부 AI 게임 제작 실측 보고서

2026-10-08 · 8개 장르 제작·적대적 플레이 검수 완료

## 결론

내부 조수는 **연결된 맵, 실제 전투·포획·돌봄·추격·숨기, 조건 분기와 엔딩을 조립해 작은 게임을 만들 수 있었다.** 회상 스토리는 두 엔딩을 각각 새 게임에서 확인했고, 수집 RPG와 JRPG는 실제 전투를 거쳐 목표와 엔딩에 도달했다. 학교 호러의 방을 넘는 추격과 옷장 수색도 실제 런타임이었다.

완성도를 떨어뜨린 공통 문제는 **실패·취소 분기, 진행 조건의 연결, 저장 시점, 실제 상태와 화면의 불일치**였다. 농장은 같은 날 잘못된 작물을 수확했고, 액션의 첫 결과는 적을 잡았다고 말하기만 해도 길과 보상이 열렸다. 조수가 완료했다고 답하거나 내부 시뮬레이터가 성공해도 이런 결함이 남았다.

첫 개선 순서는 **기존 저장·검증 경로 수정 → 실제 출하 플레이 검수 → 명령·시스템 조립 계약 강화**다. 포획, 농사, 꽃잎 HUD, 숫자 퍼즐, 처치 스위치의 기본 도구는 이미 있다. 이번 결과에는 그 도구를 찾지 못하거나 올바르게 연결하지 못한 사례가 포함된다.

## 무엇을 측정했나

- **외부 운영·평가자 8개:** 각각 `gpt-6.1-sol`, reasoning effort `high`로 독립 CLI 프로세스를 실행했다. 실행 인자와 여덟 최종 턴 종료 영수증을 확인했다. 원래 실행기의 종료 코드는 회수되지 않아 추정하지 않았다.
- **게임 제작자:** 에디터의 인증된 기본 내부 AI. 실제 요청 모델은 `gemini-3.8-flash`였다. `google-antigravity`는 직접 수집된 요청·인증된 start 영수증에서 확인했다. 일부 초기 Pi 요청에는 provider 필드가 없었으며 분류 요청으로 대신 증명하지 않았다.
- 시작 화면의 **8개 장르를 대표하는 작은 원문 과제 1개씩**을 실행 전에 고정했다. 빈 `createBlankProject`에서 시작했다. 시작 카드의 모든 변형이나 완성 템플릿을 전수 검사한 실험은 아니다.
- 프로젝트 ID·SQLite 폴더·공용 라이브러리 사본을 분리하고 포트 **19401–19408**을 배정했다. 운영자는 8개였고, 동시에 저작하는 에디터는 **최대 3개**였다. 공용 정본에는 쓰지 않았다.
- 저작은 실제 **입력창 → Send → Pi → 내부 모델 → 편집 도구 → 적용** 경로였다. 외부 평가자는 맵·이벤트·DB를 직접 만들거나 고치지 않았다. 최초 시도와 최대 두 번의 수선을 별도로 보존했다.
- 실제 편집기 Save와 **새 브라우저 context 재로드**를 대조했다. 플레이는 제품 `prepareWebExport`와 **컴파일된 player.html/export shim**에서 원래 키·선택·거래·전투·메뉴로 수행했다.
- 플레이 진행·돈·HP·아이템·좌표를 만들어 넣지 않았다. 재개 검수에는 실제 플레이가 만든 저장 프로필을 그대로 사용했다. 같은 context의 새 페이지 또는 수정하지 않은 실제 storageState를 보존한 새 context를 사용했다.
- 각 평가자의 REPORT·요구사항별 판정과 SUMMARY를 읽고, 감독자가 실제 PNG·상태 영수증·소스 계약을 대조했다. 마지막에는 **8개 정본의 전체 SHA, 맵 행, 타일 blob, 업로드 ref의 실제 파일 해시**를 독립적으로 검사했다.

판정은 **통과 / 실패 / 미검증 / 환경 차단**이다. 하나의 사례로 장르나 모델의 일반 성공률을 계산하지 않는다. 편집기 문서 저장과 게임 플레이 저장도 각각 판정한다.

## 장르별 결과

| 장르 | 실제 확인한 제작 범위 | 남은 게임 결함 | 시각 | 편집기 저장·재로드 | 플레이어 저장·재개 |
|---|---|---|---|---|---|
| 몬스터 수집 | 세 스타터, 야생 포획, 구매, 관장 승리·배지·엔딩 | 판매 없음; 엔딩 후 완료 롤백과 상금 누적 | 상점·체육관도 잔디, 포털 표시 약함 | 작성 후 통과 | 일반 수동·자동 통과; 완료 상태 실패 |
| 회상 스토리 | 세 기억, 중복 방지, 취소, 두 엔딩, 이동·카메라·페이드 | 실제 수와 다른 고정 진도 문구 | 문은 사람, 화분 위치 불명확, 기본 전쟁 도입 | 통과 | 중간 자동 저장 통과; 수동 실패 |
| 모험 JRPG | 두 역할·실제 기술, ATB 전투, 상점·여관·왕복·보스·약초·엔딩 | 패배 회복 누락; 완료 후 재입장 보상 검수 미완료 | 넓은 반복 판석 동굴, 부적합한 보스 필드 외형 | 첫 저장 full SHA 실패 | 중간 자동 저장 통과; 수동 실패; 완료 이전 checkpoint로 복귀 |
| 갤러리 호러 | 세 전시실, 실제 피해·회복·0장 실패, 열쇠·탈출 엔딩 | 꽃잎 HUD, 직접 암호 입력, 암호 취소 실패 | 꽃잎1인데 하트5·514/514 | 첫 저장 실패; 후속 안정 | 부분 체력 자동 저장 통과; 수동 실패 |
| 학교 호러 | 실제 연결 추격·숨기·수색·포착·탈출 | Continue 후 체크포인트 재시도 소실 | 문 안내 약함, 기본 판타지 도입 잔존 | 통과 | 열쇠·추격 자동 재개 통과; 재시도 실패 |
| 농장 생활 | 집·가게 연결, 실제 씨앗 소모·수면·구매·판매 일부 | 밭 상태 공유, 같은 날 오수확, 무급수 성장 | 일부 밭이 안 보이고 성장 그림 부적합 | 완료본·중단 부분본 모두 통과 | 이동 checkpoint 재개 통과; 성장 중 저장 미검증 |
| 파트너 육성 | 소모품 돌봄·친밀도·전투 성장·진화 조건·외형·엔딩 | 승급 실패를 성공으로 안내, 수동 저장 실패 | 킹슬라임 대사인데 푸른 용 | 통과 | 수동 실패; 자동·진화 후 재개 미검증 |
| 2D 액션 RPG | 실제 근접·투사체·피격·처치, 기력·회피 일부 | 대화 해금·생존 보스 보상; 수선 뒤 영구 잠금 | 희박한 전장, 적 겹침, 문 상태 불명확 | 첫 저장 실패; 수선 후 통과 | 수동 실패; 진행 재개 미검증 |

요구사항 전체의 판정과 관측 범위는 [비교 데이터](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/comparison-data.json)와 아래 개별 보고서에 있다.

[장르 선택·실제 화면 비교](http://100.73.251.77:8811/2026/10/08/01a1192d-fe97-75a1-9d2e-4ea5e875c1c0/internal-ai-game-audit.view.html)에서 요구별 근거를 확인할 수 있다.

### 몬스터 수집

- **작동:** 세 종류를 각각 새 게임에서 선택해 한 마리 지급·취소 무지급·재방문 중복 방지를 확인했다. 실제 포획 성공은 파티 1→2, 포획구 3→2였다. 구매는 300→205→110→15G, 부족한 돈에서는 거절했다.
- **진행:** 물 스타터는 관장에게 패배했고 보상을 받지 않았다. 불 스타터는 실제 기술로 승리해 배지1·추가 보상·축하 엔딩에 도달했다. 시작 HP17–18에 야생 HP107/324를 재사용해 초반 균형 차이가 컸다. 모든 선택의 진행이 불가능하다고 단정하지 않는다.
- **중요한 반례:** 첫 엔딩의 1100G·배지1·완료=true가 Continue 후 **600G·배지0·false**로 돌아왔다. 재승리 뒤 1400G, 다음 Continue 뒤900G가 되어 전투 상금300G가 반복 누적됐다. 자동 저장이 배지·추가500G 지급 전에 발생했다.
- 판매 메뉴는 실제로 없었다. 큰 72맵 캠페인 builder를 쓰지 않고 네 playable 맵과 이벤트를 만들었다. 기존 종·그림·포획 시스템 재사용을 신규 엔진 저작으로 세지 않았다.

[몬스터 수집 개별 보고서](/home/main/.codex/worktrees/fbff/rpg-zzu/qa-runs/harnesses/assistant-capability/20261008-eight-genres-fbff/monster-collect/REPORT.md)

### 회상 스토리

- **작동:** 실제 기억 수0→1→2→3, 각 물건 재조사 무증가, 기억0·2에서 엔딩 차단, 선택 취소 후 상태 동일. 두 독립 새 게임에서 떠남·남음의 다른 대사와 종료 화면을 확인했다.
- **연출·재개:** 주인공 x1→5, 카메라8→0과 엔딩 페이드가 있었다. 기억2개를 이동 자동 저장에서 복원했고 도입을 중복 실행하지 않았다. 모든 페이드 프레임을 측정한 것은 아니다.
- **결함:** 화분을 처음 조사하면 실제 수1인데 **3/3**, 일기는 실제2인데 **1/3**이라고 표시했다. 문은 사람 그림이며 돌아갈 수 있지만 친구의 실제 조건이 조기 엔딩을 막았다. 무관한 왕국 전쟁 도입과 불분명한 화분 표시가 남았다. 적용 내용은 저장됐지만 결과 응답 전달 실패 카드도 있었다.

[회상 스토리 개별 보고서](/home/main/.codex/worktrees/fbff/rpg-zzu/qa-runs/harnesses/assistant-capability/20261008-eight-genres-fbff/story-cutscene/REPORT.md)

### 모험 JRPG

- **작동:** 마법 파이어볼 MP85→81, 검사 십자베기35→32를 실제로 사용했다. 80G 지팡이와30G 회복약 구매, 20G 여관·취소·잔고 부족을 확인했다. 마을과 동굴을 왕복하며 실제 무작위·골렘 보스 전투를 했다. 전투는 메뉴 대기형 **ATB**이며 순수 라운드제까지 증명하지 않는다.
- **진행:** 보스 전 약초 거절, 실제 승리 후 약초1개·재조사 무증가, 보고 때 약초 반납과 **556→856G**·공식 엔딩을 확인했다.
- **결함·한계:** 패배 분기에 `transfer → recoverAll`이 있지만 실제 여관 귀환 뒤 두 HP가0이었다. 유료 숙박으로 회복해 재도전·승리할 수 있었다. 종료 후 자동 슬롯은 보고 전556G·약초1·미완료를 복원했다. 다시 보고해도856G이며1156G로 누적되지 않았다. **완료 상태를 유지한 일반 맵 재입장의 일회 보상 검사는 미검증**이다. 상점 정면 카운터 대화는 안 됐고 옆 통로에서는 거래됐다.

[JRPG 개별 보고서](/home/main/.codex/worktrees/fbff/rpg-zzu/qa-runs/harnesses/assistant-capability/20261008-eight-genres-fbff/adventure-jrpg/REPORT.md)

### 갤러리 호러

- **작동:** 가구 있는 세 방, 네 단서7294, 실제 꽃 아이템·꽃잎 변수 피해5→4·회복4→5, 반복 피해0에서 실패 엔딩·종료·이동 차단을 확인했다. 열쇠가 없으면 탈출하지 못했고, 획득·재조사 뒤1개를 유지한 채 성공 엔딩에 도달했다.
- **결함:** 체력 변수1에서도 HUD는514/514였다. 금고는 직접 숫자 입력을 쓰지 않고 제한된 자리별 선택지를 만들었다. **전체 정답을 정답으로 표시한 메뉴는 없었다.** 첫 자리 취소가 둘째 자리로 진행한 것은 실제 실패다. 틀린 입력과 잠긴 출구의 안내 분기도 빠졌다.
- **저장:** 체력3·꽃1의 이동 자동 저장과 새 페이지 재개는 통과했다. 수동 저장 메뉴와 꽃병의 저장 이벤트는 Items를 열었다. `set_life_flower`, `compile_puzzle`은 기존에 있다.

[갤러리 호러 개별 보고서](/home/main/.codex/worktrees/fbff/rpg-zzu/qa-runs/harnesses/assistant-capability/20261008-eight-genres-fbff/horror-gallery/REPORT.md)

### 학교 호러

- **작동:** 한 번 받는 열쇠로 유령이 깨어났고 동일 추격자 ID가 다른 방으로 따라왔다. 옷장 숨기는 실제 주인공 숨김·보행 차단을 수행했다. 목격되지 않은 숨기에서 수색 후 포기했으며 각성 스위치는 계속 켜져 있었다. 나오면 다시 발견했고, 목격된 재숨기는 면역을 주지 않았다.
- **반례:** 새 게임과 여러 방 이동 후 포착에서는 체크포인트 재시도가 실제로 됐다. **Continue 후 포착에는 재시도 버튼이 없었다.** 자동 저장은 once 자기 스위치를 복원하지만 체크포인트는 세션 WeakMap에만 있는 소스와 부합한다. 소스 해석과 실제 전후 재현을 구분해 기록했다.
- 열쇠·각성·추격의 자동 재개와 열쇠 조건 탈출 엔딩은 확인했다. 수동 Save는 실패했다. 중간 수선의 삭제 확인 대기·운영자 중단도 완성 결과로 계산하지 않았다.

[학교 호러 개별 보고서](/home/main/.codex/worktrees/fbff/rpg-zzu/qa-runs/harnesses/assistant-capability/20261008-eight-genres-fbff/school-horror/REPORT.md)

### 농장 생활

- **작동:** 100G·두 씨앗·물뿌리개, 실제 씨앗 소모, 집·상점 왕복, 침대 취소와 날짜1→2→3→4, 자연 비, 구매와 돈 부족, 실제 순무 판매40G를 확인했다.
- **완료된 첫 저작의 반례:** 여섯 밭이 같은 상태 변수를 사용했다. 씨앗0에서도 일부 칸에 심었고, 물을 한 번 주면 당일 수확했다. 호박을 심어 순무를 받았다. 없는 호박을5번 팔아100→700G와 축하 장면을 만들 수 있었다.
- **마지막 부분 저장본:** 무재고 판매는 거절하도록 고쳐졌다. 첫 밭에는 날짜 단계가 생겼지만 다른 칸의 당일 오수확이 남았다. 첫 밭도 맑은3일째 물 없이 자랐다. 별도 비 변수가 상수 true여서 실제 날씨와 어긋났다. 이벤트 방식 자체를 실패로 판정한 것이 아니라 실제 규칙·칸 간 상태 충돌을 판정했다.
- 이동 자동 저장의11개 관측 필드 재개는 일치했다. 그 checkpoint는 마지막 파종 전이었다. **성장 중 작물 저장과 마지막의 실제5개 출하는 미검증**이다. 마지막 저작은 외부 SIGTERM으로 중단돼 완료한 모델 턴으로 계산하지 않았다.

[농장 생활 개별 보고서](/home/main/.codex/worktrees/fbff/rpg-zzu/qa-runs/harnesses/assistant-capability/20261008-eight-genres-fbff/farm-life/REPORT.md)

### 파트너 육성

- **작동:** 한 액터 파트너의 중복 지급 방지, 먹이·장난감 소모·빈 소지품 거절, 친밀도0→4, 실제 승리15EXP·40G·Lv1→2, 구매·잔고 부족을 확인했다. 레벨과 친밀도가 각각 부족한 경우 진화를 거절했고 조건을 충족하면 외형·플래그·엔딩이 바뀌었다.
- 같은 `actor_partner`의 Lv2·EXP30이 유지됐다. **액터 구현과 네이티브 몬스터 UID의 차이만으로 요청 실패라고 판정하지 않는다.** 플레이 중 정체성은 확인했다.
- **결함·범위:** `promoteActorSuccess=false`인데 승급 성공 대사와 엔딩을 진행했다. 킹슬라임이라고 말하면서 필드에는 푸른 용을 표시했다. 수동 Save 실패와 빈 수동 슬롯은 확인했다. **이 증거만으로 자동 Continue 전체 실패를 주장하지 않는다.** 자동 재개·진화 후 저장은 미검증이며 진화 이후 관측 브라우저가 닫혔다.

[파트너 육성 개별 보고서](/home/main/.codex/worktrees/fbff/rpg-zzu/qa-runs/harnesses/assistant-capability/20261008-eight-genres-fbff/partner-raise/REPORT.md)

### 2D 액션 RPG

- **작동:** 실제 필드 검 공격·처치·골드, 근접 피해와 원거리 투사체, 가드 기력 소진, 방향+Shift의 비용25·무적 시간, 실제 게임오버와 새 게임 재시작을 확인했다. **같은 공격의 회피·가드 전후 비교와 진행 체크포인트는 미검증**이다.
- **첫 저작 반례:** 적이 살아 있는데 “두 무리를 격파했다”는 선택으로 문이 열렸다. 보스HP730 상태에서 상자를 열어500G·회복약·엔딩을 받았다.
- **수선본:** 잘못된 키 안내와 자기 신고를 제거했다. 실제 최초 근접·투사체 무리를 처치해도 해금 스위치가 false였다. 저장 문서에 진행 스위치 생산자가 없어서 보스와 상자가 잠겼다.
- 내부 조수의 “처치 callback 도구가 없다”는 설명은 소스와 맞지 않는다. 기존 `make_hunting_ground`에 `persistKill`·`onKillSwitchId`가 있고 실제 액션 런타임이 호출한다. `make_action_enemy`의 좁은 spawn 입력에는 그 필드가 빠져 있다. 마지막 지시는 이 기존 기능을 쓰게 했으나 저작 전에 관측기가 SIGTERM으로 중단돼 효과는 미검증이다.

[액션 RPG 개별 보고서](/home/main/.codex/worktrees/fbff/rpg-zzu/qa-runs/harnesses/assistant-capability/20261008-eight-genres-fbff/action-rpg/REPORT.md)

## 저장을 세 층으로 나눈 결과

### 편집기 문서

마지막 독립 readback에서 여덟 프로젝트의 ID, 펼친 full SHA, 맵 행, 타일 blob, 업로드 ref 파일 해시는 모두 현재 정본과 맞았다. [감독자 정본 영수증](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/supervisor-final-readback.json)에 전체 SHA와 시도별 비교가 있다.

**최초 fresh reload 실패는 그대로 남는다.** JRPG는61→62, 갤러리는27→28, 액션은26→27로 바뀌었다. 생성된 BGM/SE 또는 오프닝 자산의 dataURL이 ref로 승격됐다. 맵·DB가 같고 확인한 자산 바이트도 같았지만 전체 문서 불변성은 실패였다. 갤러리의 후속 안정화와 액션 수선 후 통과가 최초 실패를 지우지 않는다. 빈 프로젝트의 준비→첫 부팅 변화도 각 시도 영수증에 따로 보존했다.

### 플레이어 저장 UI

일반 그룹 메뉴에서 **System→Save를 선택하면 Items로 돌아가는 동작**이 여러 사례와 기본 프로젝트에서 재현됐다. 몬스터 게임의 직접 Save 메뉴는 실제 슬롯 저장이 됐다. [메뉴 컨트롤러](/home/main/.codex/worktrees/fbff/rpg-zzu/src/player/playerStatusMenuController.ts:138)는 하위 `save`를 상위 rail 목록으로 검사한다. 이것은 관측과 부합하는 원인 설명이며 제품 수정을 수행한 것은 아니다. `openSaveMenu`도 같은 경로를 타므로 그 명령의 존재만으로 우회 성공을 주장하지 않는다.

### 자동 저장·완료·체크포인트

이동 자동 저장은 회상·갤러리·학교·농장·JRPG에서 실제 저장된 중간 상태를 복원했다. 몬스터의 일반 전투/수동 저장도 복원됐다. **완료 보상이 저장되기 전에 엔딩이 종료하거나, checkpoint가 메모리에만 있으면 별도 실패가 생긴다.** 몬스터의 누적 상금과 JRPG의 이전 checkpoint 재생은 결과가 달랐으므로 같은 exploit이라고 묶지 않았다.

## 더 필요한 도구와 수정 우선순위

### P0 — 기존 런타임과 검증 연결을 먼저 수정

| 대상 | 관측 근거 | 현재 대응 | 수정 수락 기준 |
|---|---|---|---|
| 그룹 메뉴 Save | Save→Items, 몬스터 직접 Save는 정상 | 일부 이동 자동 저장·직접 메뉴 | 원래 메뉴와 이벤트 Save가 슬롯을 열고 실제 저장·새 문서 불러오기 상태가 일치 |
| checkpoint 지속성 | 새 게임 재시도 통과, Continue 후 소실 | 새 게임 내 checkpoint 재시도 | 실제 저장 후 포착·재시도가 같은 안전 지점·상태를 복원하고 즉시 재포착하지 않음 |
| 완료 보상 저장 경계 | 몬스터 배지 소실·상금 누적, JRPG 완료 이전으로 복귀 | 종료 전 실제 저장 또는 종료를 별도 행동으로 분리 | 실제 완료 이후 저장 재개가 보상·완료를 유지하며 재호출 변화0 |
| 생성 자산의 저장 경계 | 첫 reload의 full SHA 변화 | 승격 후 문서가 안정되는 후속 관측 | 실제 Save가 승격까지 마친 문서를 저장하고 첫 fresh reload full SHA 동일 |
| Pi의 액션 검증 dispatch | 실제 호출이 `async-harness-required` 오류 | 외부 compiled-player 검수 | 실제 Pi가 기존 비동기 검증기를 기다리고 저장 SHA에 묶인 결과를 수집 |

액션 검증기는 이미 존재한다. [Pi toolAdapter](/home/main/.codex/worktrees/fbff/rpg-zzu/src/ai/piAgent/toolAdapter.ts:286)는 읽기 도구를 동기 `runTool`로 실행하며, [playTools](/home/main/.codex/worktrees/fbff/rpg-zzu/src/editor/tools/playTools.ts:274)의 동기 구현은 오류를 낸다. 별도 [AssistantSession 비동기 경로](/home/main/.codex/worktrees/fbff/rpg-zzu/src/ai/assistantSession.ts:1546)를 기본 Pi 경로에 연결해야 한다. 새 전투 검증기를 다시 만드는 문제가 아니다.

### P0 — 실제 출하 플레이 검수 모드

**제안:** 기존 `play_walkthrough`·검증 체계에 `shipping` 실행 모드를 추가한다.

- **근거·현재 대응:** 내부 장면·퀘스트 시뮬레이터가 Save UI, 실제 처치, 전송 후 회복, 완료 재개를 놓쳤다. 현재 대응은 이 실험의 외부 런타임 하네스다.
- **입력:** projectId·저장 full SHA·player 빌드 SHA, 소유할 맵 묶음, 실제 키/선택 시나리오, 요구와 부정 조건, 격리 저장 namespace·시간 예산.
- **출력:** 요구별 통과/실패/미검증/환경 차단, 원래 입력 기록, 상태 변화, SUMMARY·PNG 해시, 실제 슬롯 쓰기와 새 문서 재개 diff.
- **거절 조건:** 다른/오래된 SHA, 진행 상태 주입·순간 이동, 모델이 적은 성공 영수증, 브라우저 없는 결과의 대체, 겹치는 맵 소유권. 관측 실패를 보존하고 게임 콘텐츠를 고쳐 합격시키지 않는다.
- **수락 플레이:** 새 게임에서 실제 목표·엔딩까지, 조기 목표·취소·돈/씨앗 부족·패배·재입장·보상 중복, 실제 저장과 재개를 같은 저장본에 대해 검수한다. 액션의 기존 맵 단위 proof를 게임 전체 검수와 결합한다.

### P1 — 명령 종류별 입력·실행 분기 계약

**제안:** 기존 저작·lint에 엄격한 명령 형식 검사와 실행 분기 검사를 강화한다.

- **근거·현재 대응:** 갤러리의 조건문에 `otherwiseBranch`가 들어가고 lint가 통과했지만 런타임 `fork`는 `else`를 읽었다. 암호 취소는 빈 취소 분기 후 다음 명령으로 진행했다. JRPG의 전송 뒤 회복도 실제로 적용되지 않았다. 현재 대응은 정식 필드·컴파일러 사용과 개별 실제 분기 검사다.
- **입력:** 저장 SHA, event/page/command 경로, 명령 종류별 허용 필드, 취소·실패·전송의 기대 후조건.
- **출력:** 정확한 잘못된 필드 경로, 효과 없는 분기, 종료·전송 뒤 명령 실행의 위험, 미검증 경로. 쓰기 전 검사는 잘못된 입력 전체를 무변경 거절한다.
- **거절 조건:** 모든 명령에서 `otherwiseBranch`를 금지하면 안 된다. `presentItem`에는 유효하다. 오타를 조용히 고치거나 시뮬레이터 성공만으로 실제 분기를 통과시키지 않는다.
- **수락 플레이:** 틀린 암호·열쇠 없는 출구는 안내 후 무보상, 취소는 결과 없이 종료, 패배 귀환 뒤 약속한 회복·재시도가 실제로 동작한다.

[실제 fork 분기](/home/main/.codex/worktrees/fbff/rpg-zzu/src/player/interpreter/commandCatalog.ts:593)와 [공통 명령 스키마](/home/main/.codex/worktrees/fbff/rpg-zzu/src/editor/tools/schemaShapes.ts:131)를 함께 개선하는 제안이다.

### P1 — 진행 목표·농장·보상을 안전하게 조립

**제안:** 기존 native 기능 위에 원자적 조립 recipe와 읽기 전용 일관성 검사를 둔다. `review_game_systems`, authoring presets, quest 검증을 확장하는 방향이다.

- **근거·현재 대응:** 농장의 공유 밭 변수·상수 비·당일 오수확과 액션의 생산자 없는 해금 스위치. 현재는 native crop/farm/time/shop 도구 또는 각각의 지속 처치 스폰·AND 스위치를 직접 올바르게 연결해야 한다.
- **입력:** 여섯 칸·작물 ID·실제 성장/날씨/기력 규칙·시작 재고·가격·목표, 또는 무리/개체/처치 수·문·보스·보상 ID·지속 정책.
- **출력:** 기존 primitive의 원자적 배선·보존 diff·정확한 생산자/소비자·칸 상태 충돌·누락 조건·수락 시나리오. 완료 milestone을 지속 저장한 뒤 엔딩을 여는 런타임 명령도 필요하다.
- **거절 조건:** 칸 중첩·잘못된 참조·부분 처치 해금·무한 재생성과 목표 충돌·없는 재고 판매·취소 비용·반복 보상. 공용 날짜/날씨와 칸별 작물 상태를 구분한다. 그림 승인 규칙을 대신 승인하지 않는다.
- **수락 플레이:** 각 칸 독립 파종·무급수/비·날짜·올바른 수확·실제5개 출하·성장 저장 재개. 액션은 모든 최초 개체를 실제 처치해야 해금, 생존 보스는 보상 차단, 보스 처치 후1회 보상·지속 재개.

[make_hunting_ground의 처치 필드](/home/main/.codex/worktrees/fbff/rpg-zzu/src/editor/tools/mapTools.ts:2157)와 [액션의 실제 처치 기록](/home/main/.codex/worktrees/fbff/rpg-zzu/src/player/playSceneActionCombat.ts:459)이 있다. `make_action_enemy`의 spawn 입력에도 같은 필드를 노출하고 도구 발견 안내를 맞추는 확장은 구체적인 개선이다. 판매·농사·처치 기능이 없는 것으로 재분류하지 않는다.

### P2 — 상태·화면·외형·전투 수치의 일치 검사

**제안:** 기존 DB/자산 미리보기·전투 시뮬레이터에 수락 계약을 연결한다.

- **근거·현재 대응:** 기억1인데3/3, 꽃잎1인데514/514, 실패한 승급의 성공 안내, 킹슬라임과 용 그림, 시작 동료와 재사용 적의 큰 HP 차이. 현재는 실제 상태·DB·원본 그림·native 전투를 따로 대조한다.
- **입력:** 파트너 selector(액터/몬스터 모두 허용)·형태·레벨/친밀도 조건·표시 변수·필드/전투 자산·시작 동료와 조우·실제 전투 공식.
- **출력:** 실패를 무시하는 안내, 상수 진도·HUD 연결 누락, 형태별 그림과 해시, 유효 능력치·피해·포획 위험. 정적 추정과 실제 관측을 구분한다.
- **거절 조건:** 액터 구현만으로 개체성 실패 판정, 해시가 맞다는 이유로 외형 합격, 한 번 패배로 모든 진행 불가능 판정, 새 그림의 자동 인간 승인.
- **수락 플레이:** 실제 수와 HUD·문구가 같고, 실패한 승급은 성공을 말하지 않으며, 같은 개체 성장 유지와 적합한 외형을 확인한다. 각 시작 동료의 실제 초반 진행·회복·포획 경로도 확인한다.

### 운영 관측 개선

분류만 하고 Pi가 시작하지 않은 입력, 계획만 닫힌 실행, 소유 실행기의 중단과 고아 native run을 안전한 종료 영수증으로 보여줘야 한다. UI turnId·native runId·phase·실제 모델/제공자·소유자 생존·저장 SHA를 반환하고 비밀·추론·시스템 프롬프트를 노출하지 않는 `inspect_assistant_run` 확장이 적합하다. idle/stream closure를 완료라고 판정해서는 안 된다.

## 환경 장애와 관측 한계

- 최초 자연어6건은 평가용 standalone 호스트의 분류에서 **OAuth client metadata 누락 HTTP500**이 있었다. 감독자는 여섯 project activity 파일을 독립적으로 확인했다. 유효한 기존 로그인과 구분하고 호스트 메타데이터 전달을 보정했다. 일반 Electron에서도 항상 발생한다고 증명한 것은 아니다. 이후 자연어 첫 시도였던 JRPG·액션은 실제 저작에 들어갔다.
- 운영자가 첫 idle 브라우저를 약3–5분 후 종료한 기록은 **45분 제작 timeout이 아니다.** 몬스터의 마지막 수선은 worker 시작 timeout, 갤러리는 계획 단계 종료, 농장과 액션은 외부 SIGTERM이 있었다. 적용·완료와 환경 차단을 구분했다. 원인은 확인한 범위까지만 기록했다.
- 시도 사이에 평가 호스트 환경·요청 계측·실제 자산 제공을 개선했다. 제품 에디터/player 빌드는 고정했다. 원 관측 실패를 남기고 같은 저장본의 별도 폴더에서 다시 관측했다.
- 일부 PNG는 의도한 행동명과 실제 화면이 달랐다. 감독자는 검은 초기 엔딩 프레임, 상태 메뉴에 가려진 숨기 프레임, 이미 타이틀인 “포착” 프레임을 독립 증거로 인정하지 않았다. 실제 화면·상태·입력 영수증을 함께 사용했다.
- 빈 프로젝트 실험이므로 **기존 사용자 게임의 장기 보존·큰 프로젝트 완주**는 증명하지 않는다. 초기 SQLite 대화 기록은0건이었다. 최초 저작 context의 IndexedDB 원문 조회 영수증은 충분하지 않아 그 조회를 완수했다고 주장하지 않는다.
- Firefox의 compiled player 경로를 확인했다. 완성 ZIP, 전체 Electron 출하, 다른 브라우저·기기, 새 종/걷기 아트 품질, 청취 기반 음악 품질은 미검증이다. 기존 자산과 native 엔진 재사용을 별도로 적었다.
- 제품/게임 콘텐츠를 평가자가 수선하거나 사람의 자산 판정을 대신하지 않았다. 필요한 측정 하네스·문서·보고서만 추가했다. 패키지·Electron·player 빌드, 하네스 경로와 JS 파싱을 확인했으며 gates·Vitest·전체 typecheck·stash는 실행하지 않았다.

## 증거와 재현

전체 원문·최초 실패·수선·native 요청·공개 도구 추적·불변 스냅샷·프로젝트·player 관측은 다음 실행 폴더에 보존했다.

`/home/main/.codex/worktrees/fbff/rpg-zzu/qa-runs/harnesses/assistant-capability/20261008-eight-genres-fbff`

- [고정 과제와 부정 조건](/home/main/.codex/worktrees/fbff/rpg-zzu/harness-data/assistant-capability/genre-seed.json)
- [assistant-capability 재현 방법](/home/main/.codex/worktrees/fbff/rpg-zzu/openwiki/harnesses/assistant-capability.md:9)
- [독립 정본 readback](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/supervisor-final-readback.json)
- [여덟 외부 평가자 종료](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/supervisor-worker-completion.json)
- [기존 도구·실행 경로 소스 대조](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/supervisor-existing-tool-audit.json)
- [감독자 시각 검수와 제외한 프레임](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/supervisor-expanded-visual-review.json)
- [원본 그림·표시용 사본 해시](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/image-provenance.json)
- [보존한 평가·감독 영수증의 출처와 해시](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/evidence-manifest.json)
- [비교 화면의 여덟 선택·이미지·폭별 검수](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/comparison-view-receipt.json)

| 장르 | 감독자가 직접 확인한 대표 화면 |
|---|---|
| 몬스터 수집 | [실제 체육관 엔딩](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/monster-ending.png) |
| 회상 스토리 | [실제1·표시3/3](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/story-count.png) |
| JRPG | [실제 마법 사용](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/jrpg-magic.png), [동굴](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/jrpg-cave.png) |
| 갤러리 호러 | [꽃잎과 HUD](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/gallery-health.png), [실제 숫자 선택지](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/gallery-password.png) |
| 학교 호러 | [실제 숨기](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/school-hiding.png), [새 게임 재시도](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/school-retry-newgame.png), [Continue 후 소실](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/school-retry-continued.png) |
| 농장 생활 | [첫 저작의 무재고 판매 — 마지막에는 차단됨](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/farm-sale-first.png) |
| 파트너 육성 | [진화 안내와 다른 외형](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/partner-form.png) |
| 액션 RPG | [첫 저작에서 생존 적과 열린 문](/home/main/.codex/worktrees/fbff/rpg-zzu/verify-shots/assistant-eight-genres-20261008/images/action-gate-first.png) |

여덟 외부 평가자 모두 최종 턴을 종료했고 실험 에디터 포트도 닫혔다. 정본과 각 시도 증거를 보존했다.
