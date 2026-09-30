# 전투 적대적 리뷰와 Visual QA — 2026-09-30

## 조사 범위와 결론

기준: `0e0db9b5818814e9f27400c8fb2b54b619d59e8d`, v0.41.0.
GPT 6.1 Sol / high 에이전트 3개가 **규칙·피해**, **화면·생명주기**, **데이터·연출·내보내기**를 각각 읽고 서로의 결과를 비판적으로 검토했다. 감독자는 별도로 실제 엔진 프로브와 출하 플레이어 브라우저 QA를 실행했다.

신규 프로젝트 기본값은 `retro2003` + `gauge`다([defaultDatabase.ts](/home/main/.codex/worktrees/3852/rpg-zzu/src/project/defaults/defaultDatabase.ts:181)). 스킨이 없는 기존 저장본의 rm2000 호환 동작은 의도된 계약이다. 새 기본 전투와 기존 strict/ATB 경로를 함께 조사했다.

**14건을 발견했고, 각 항목의 핵심 조건을 엔진·데이터·브라우저에서 재현했다.** 아래 표의 확인 수준을 반드시 함께 읽어야 한다. 숫자 재현은 특정 조건의 결함을 증명하며, 모든 전투에서 동일하게 발생한다는 뜻은 아니다. 실제 사용자의 프로젝트 데이터 손실은 관찰하지 않았다.

| ID | 우선순위 | 문제 | 확인 수준 |
|---|---|---|---|
| D5 | P1 | 로스터 자동 보충이 유효한 커스텀 DB에 없는 장비·상태 참조를 삽입 | 데이터 재현: 오류 0→1,106, 재로드 거부 |
| R2 | P1 | 생존자 전원이 스톱이면 ATB와 자연회복이 함께 정지 | 엔진 재현: 2,100,000ms 후에도 같은 턴 |
| R1 | P1 | strict 예약 행동이 실행 전에 받은 행동불가를 무시 | 엔진 재현: 스톱 부여 뒤 공격 피해 67 |
| F1 | P1 | 포획 소유권은 즉시 반영되지만 취소 시 볼 비용은 반영되지 않음 | 브라우저 재현: 소유 몬스터 1→2, 볼8 유지 |
| F3 | P2 | retro2003 승리 메시지 창이 보상 요약을 가림 | 화면·DOM 재현: 정상/감소 모션 모두 48px 겹침 |
| R3 | P2 | 광역 무작위 기술이 대상 수의 제곱만큼 타격 | 엔진 재현: 적 2명에 피해 기록 4개 |
| R4 | P2 | HP 비용·흡수 후 시전자 변화를 피해 예측이 누락 | 엔진 재현: 500↔250, 200↔250 |
| R5 | P2 | 상태 속성·계열 방어·감정을 피해 예측이 누락 | 속성 변경 재현: 예측 200, 실제 300; 나머지 소스 확인 |
| D4 | P2 | 삼연격·삼단 찌르기가 실제로는 단타 | 엔진 재현: 두 기술 모두 피해 기록 1개 |
| D1 | P2 | 웹 내보내기 자산 수집에서 마법 시전 보조 시트 누락 | 수집 재현: 기본 시트 포함, cast 시트 없음 |
| F2 | P2 | 입력 프롬프트 중 AUTO가 다른 행동을 실행할 수 있음 | 브라우저 재현: 프롬프트 유지 중 다른 기술 연출 시작 |
| F4 | P2 | Active ATB 기술 목록이 동료 준비 상태 변경을 반영하지 않음 | 브라우저 재현: ATB57→100 뒤도 비활성, 재개방하면 활성 |
| D2 | P2 | 배우가 몬스터 연출을 빌리면 런타임에서 선택 연출을 무시 | 브라우저 DOM 관찰: 빌린 계약 ID/FX 미재생 |
| D3 | P2 | 장비로 받은 동명 기술이 다른 직업의 연출을 재생 | 브라우저 DOM 관찰: 총사 선택→레인저 계약/FX |

P1은 진행 불가·저장/재로드·취소 트랜잭션·핵심 행동 규칙, P2는 조건부 피해/AI 오류와 표시·저작 계약 문제로 분류했다. 각 항목의 수정 제안은 아래와 독립 리뷰 원문에 있다.

## 먼저 처리할 P1

### D5 — 자동 로스터 보충 후 참조 무결성 파괴

[defaultDatabase.ts:91](/home/main/.codex/worktrees/3852/rpg-zzu/src/project/defaults/defaultDatabase.ts:91)의 `ensureRetroRosterRecords`는 배우·직업·기술·일부 상태를 추가한다. 새 레코드가 참조하는 기본 장비와 나머지 상태를 함께 보충하지 않는다. 이 함수는 [store.ts:1643](/home/main/.codex/worktrees/3852/rpg-zzu/src/project/store.ts:1643), headless 초기화에도 연결되어 있다.

최소 커스텀 배우·직업만 있는, 자체 참조가 모두 유효한 임시 프로젝트로 확인했다. 보충 전 참조 검사 **0건**, `deserialize(serialize(project))` 성공. 보충 후 **1,106건**, `ProjectFormatError`로 재로드 거부. 첫 실패는 추가된 배우의 `equip_iron_sword`, `equip_leather_armor`, `equip_traveler_hat`, `equip_focus_charm` 누락이다. 실제 SQLite에 쓰지는 않았다. 자동 저장 후 다음 로드/내보내기를 막을 위험은 호출 경로에서 추론한 영향이다.

**수정 방향:** 추가 레코드의 전체 의존성을 수집해 없는 ID만 보충하거나 로스터를 별도 선택형 카탈로그로 둔다. 기존 저작 레코드를 덮어쓰지 않으면서 보충 결과의 참조 무결성을 저장 전에 확인해야 한다.

### R2 — 전원 스톱의 영구 charging

[runtime.ts:943](/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/runtime.ts:943)는 게이지 충전이 멈춘 배틀러를 다음 행동 후보에서 제외한다. 상태 회복은 [runtime.ts:840](/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/runtime.ts:840)의 행동 사이클 upkeep에 의존한다. 전원이 스톱이면 아무도 행동 사이클을 진행하지 못한다.

배우가 이미 스톱인 상태에서 마지막 자유로운 적이 자기 스톱을 사용하게 했다. 상태는 **2턴부터 100% 자연회복**으로 저작했다. 첫 사이클 후 양쪽 턴/상태 턴이 1, 게이지 0이었다. 이후 누적 **2,100,000ms**를 진행해도 `charging`, turn1, stateTurns1, 양쪽 스톱이 그대로였다. 기본 스톱도 마지막 자유 배틀러가 멈추는 조건에서 같은 정지 구조에 들어갈 수 있다.

**수정 방향:** 아무도 행동할 수 없는 gauge 구간에서도 유한 상태의 회복 시계를 진행하는 계약이 필요하다. 매 tick에 턴을 올리면 프레임 속도에 따라 회복이 달라지므로 정해진 시간/사이클 기준을 사용한다.

### R1 — strict 실행 직전 행동불가 재검사 누락

[runtime.ts:1631](/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/runtime.ts:1631)의 strict 실행 가드는 생존 여부를 확인하지만 RM 계열 행동불가를 다시 확인하지 않는다. Gen1 전용 사전 행동 검사도 RM 규칙에서는 그대로 통과한다.

민첩999인 적이 민첩10인 배우에게 스톱을 먼저 부여했다. 그 뒤 배우의 예약 공격이 실행되어 **피해 67**을 줬다. 해당 배우에게 스톱이 있는 것도 스냅샷으로 확인했다. 적 방향도 소스상 같은 문제가 있지만 직접 프로브는 배우 방향만 실행했다.

**수정 방향:** 양쪽의 실제 실행 직전에 RM 행동 가능 여부를 검사하고 자원 소비 없이 건너뛴다. Gen1 major-status 경로와 강제 행동 계약은 별도로 유지한다.

### F1 — 포획의 저장 시점이 볼 소비와 다름

[playSceneBattle.ts:175](/home/main/.codex/worktrees/3852/rpg-zzu/src/player/playSceneBattle.ts:175)의 포획 콜백은 바로 `giveMonster`를 호출해 live session의 소유권을 바꾼다. 볼 비용은 전투-local eventState에 남고 결과/퇴장 연출 뒤 커밋된다. 중간 취소는 일반 writeback을 하지 않으므로 두 변화의 원자성이 깨진다.

몬스터 파티/Pokemon 플레이어에서 임시로 볼을 master 판정으로 설정해 포획 성공을 고정했다. 포획 콜백 직후 **같은 세션의 실제 battleAbortController**를 abort하고 전투 DOM 제거까지 기다렸다. 소유 몬스터는 전투 전1, 포획 직후2, 취소 후2였다. 볼은 세 시점 모두8, battleResult는 미커밋 상태였다. 사용자가 매 전투에서 자연스럽게 취소할 수 있다는 의미는 아니며, 동일 세션 teardown의 계약 위반을 재현한 것이다.

**수정 방향:** 포획 획득도 전투-local 상태에 보관한 뒤 비용과 같은 성공 커밋 블록에서 한 번만 반영한다. 화면 알림이 필요하면 저장 변경과 분리한다. 정상 승리에서 포획이 중복된다는 주장은 이번 조사에 없다.

## 피해·예측·기본 기술

### R3 — randomSkillFrom 광역 중복

[runtime.ts:2639](/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/runtime.ts:2639)의 무작위 기술 해결이 이미 순회 중인 대상 loop 안에서 다시 전체 대상을 순회한다. wrapper와 후보를 모두 `allEnemies`로, 후보 공식은 `10`으로 설정했다. 적2명 각각 HP20 감소, damage4개. 기대는 각각10과 damage2개다. 후보가 여러 개면 같은 시전에서 대상마다 다시 뽑힐 수도 있다.

**수정:** 시전 단계에서 기술을 한 번 뽑고 그 기술의 범위를 한 번 해결한다.

### R4 / R5 — 실제 피해와 AUTO 점수 불일치

[battlePredict.ts:296](/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/battlePredict.ts:296)와 실제 hit 경로가 새로운 수치 변화를 공유하지 않는다. 분산·치명타를 제거하고 다음을 확인했다.

| 조건 | 예측 | 실제 |
|---|---:|---:|
| HP500, `a.hp`, HP 비용50%, 1타 | 500 | 250 |
| HP100, `a.hp`, 2타, 피해50% 흡수 | 200 | 250 (100+150) |
| 공식100, 2타, 첫 타에 속성 등급 C100%→A200% 상태 부여 | 200 | 300 (100+200) |

계열별 상태 방어 배율과 감정도 예측 경로에서 빠진 것은 소스로 확인했다. 이 두 가지는 별도 숫자 프로브를 실행하지 않았다. 예측을 사용하는 AUTO/적 AI 선택에도 영향을 준다. 실제 AUTO가 특정 잘못된 선택을 하는 장면까지 재현한 것은 아니다.

**수정:** 시전 비용, hit 이후 흡수, 상태 속성/방어/감정 계산을 순수 transition으로 공유하고 예측에서는 복제 상태에 적용한다.

### D4 — 설명과 다른 두 삼연타

[a3.ts:49](/home/main/.codex/worktrees/3852/rpg-zzu/src/assets/retroRosterSkills/a3.ts:49)의 `skill_squire_triple_cut`(삼연격)과 [p2.ts:63](/home/main/.codex/worktrees/3852/rpg-zzu/src/assets/retroRosterSkills/p2.ts:63)의 `skill_noble_triple_thrust`(삼단 찌르기)는 세 번 공격한다고 설명하지만 mechanic의 hit 배열이 없다. 정규화 결과는 `[1]`이고 실제 피해 기록도 각각 **1개**(94,84)였다. 다회 타격처럼 보이는 그림만으로 규칙이 구현됐다고 판단할 수 없다.

**수정:** 횟수가 명시된 기술에 명시적 hitSequence/배율을 저작한다. 이번에 직접 확인한 것은 위 두 기술이며 모든 로스터 기술이 단타라는 주장은 하지 않는다.

## 표시·입력·연출·배포

### F3 — 승리 요약 상단 가림 (시각 확정)

[retro2003 CSS:177](/home/main/.codex/worktrees/3852/rpg-zzu/src/styles/runtime/battle-skins/_retro2003.css:177)의 message `display:grid` 규칙이 result의 숨김 규칙보다 구체적이다. 전투가 끝나고 `busy=false`, 1.8초 추가 대기 뒤에도 남는다.

1024×768에서 기존 메시지 창은 `(44,36,936,60)`, 새 요약 창은 `(56,48,912,96)`이었다. 세로 **48px**가 겹쳐 승리 제목과 EXP/G 표시를 가린다. 정상·감소 모션 모두 같고, 동일 크기의 rm2000에서는 메시지가 `display:none`이라 겹침이 없다.

![정착된 retro2003 결과 화면](/home/main/.codex/worktrees/3852/rpg-zzu/verify-shots/battle-audit-2026-09-30/retro-1024-settled/result-settled.png)

**수정:** retro2003 message 표시 규칙을 result에서 제외하거나 충분히 구체적인 result 숨김 규칙을 추가한다.

### F2 — 입력 프롬프트의 행동 소유권 없음

[battleDom.ts:1127](/home/main/.codex/worktrees/3852/rpg-zzu/src/player/battleDom.ts:1127)의 AUTO 실행 가드에 inputPrompt가 없다. self/all-target 기술은 프롬프트를 먼저 열어 runtime이 actorCommand에 남고, F 처리도 프롬프트 키 처리보다 먼저 실행된다. 옛 프롬프트 완료 콜백에는 배우/턴 identity 검사가 없다.

strict 2인 전투에서 self 입력 기술을 선택했다. 프롬프트가 떠 있고 `busy=false`일 때 F를 눌렀더니 프롬프트를 유지한 채 `busy=true`, 다른 기술 “회전베기” 연출과 MP 소비가 시작됐다. 원래 선택한 입력 행동이 완료되기 전에 AUTO가 진행하는 부분을 실제 확인했다. 다음 배우에게 옛 명령이 실행되는 타이밍 의존 분기는 별도로 재현하지 않았다.

**수정:** 프롬프트가 행동과 입력을 소유하는 동안 AUTO 실행을 미루고, 완료 제출은 처음 선택한 배우/턴에만 적용한다. 다른 배우에게 잘못 실행되는 후속 증상은 타이밍 의존적이며 따로 확정하지 않는다.

### F4 — Active ATB 기술 목록의 오래된 사용 가능 상태

[battleDom.ts:1150](/home/main/.codex/worktrees/3852/rpg-zzu/src/player/battleDom.ts:1150)의 패널 캐시 키는 동료 게이지와 상태 등 기술 적법성 입력을 포함하지 않는다. 동료가 아직 준비되지 않아 비활성인 연계기를 열어 둔 채 그 동료가100에 도달하면 기존 버튼 상태가 남을 수 있다. 창을 닫았다가 다시 열면 현재 상태로 계산한다.

실제 Active ATB에서 수호자 게이지57%일 때 연계기 목록을 열었다. 100%가 되어도 버튼의 `inert=true`와 “연계 동료가 아직 준비되지 않았습니다”가 유지됐다. X로 닫고 같은 창을 열자 비활성과 사유가 사라졌다. 세 시점 모두 `busy=false`, 배우 HP/MP가 같아 다른 행동이나 자원 변화로 캐시가 바뀐 경우를 제외했다.

**수정:** 매 스냅샷에서 버튼 적법성/이유를 갱신하거나 적법성의 변화 경계를 캐시 키에 포함한다. 엔진의 연계기 적법성 자체를 잘못 계산한다는 주장은 아니다.

### D1 — export의 cast 시트 누락

[webExportAssets.ts:56](/home/main/.codex/worktrees/3852/rpg-zzu/src/project/webExportAssets.ts:56) 자산 수집을 실제 호출했다. mage 기본 시트는 포함됐지만 대응 cast 시트와 모든 `charset-battlers/cast/` 경로가 빠졌다. resolver도 `-cast`를 등록하지 않아 [battleFieldDom.ts:1801](/home/main/.codex/worktrees/3852/rpg-zzu/src/player/battleFieldDom.ts:1801)에서 원점 기준 `/assets/...` fallback을 사용한다. player의 publicDir도 false다.

**수정:** cast 동반 자산을 resource resolver/수집에 배선하고 게임 폴더 기준 URL을 사용한다. 실제 ZIP을 풀어 하위 경로에 배포하는 검사는 이번에는 하지 않았다. 예상 증상은 마법 전용 포즈 대신 기본 시트 포즈로 대체되는 것이며 배우 전체가 사라지는 것은 아니다. pixel-fx는 Vite URL 그래프에 들어가므로 같은 누락 문제로 분류하지 않았다.

### D2 / D3 — 기술 ID 대신 이름으로 연출을 복원

[retroSkillChoreography.ts:306](/home/main/.codex/worktrees/3852/rpg-zzu/src/player/retroSkillChoreography.ts:306)는 배우/적 편에 따라 후보 종류를 제한한다. 저작 picker는 몬스터·직업 계약을 모두 허용하므로 배우 기술이 `skill_mon_acid_spit`을 빌릴 수 있지만 배우 재생 경로에서 그 후보를 제외한다. 편집기 미리보기와 player 계약이 다르다.

또한 [ownedSkillIds:286](/home/main/.codex/worktrees/3852/rpg-zzu/src/player/retroSkillChoreography.ts:286)는 원래 배우·직업의 기술만 읽고 장비 지급/세션 학습/직업 변경을 빠뜨린다. 레인저에게 장비로 `skill_gunner_snipe`를 주면 둘 다 이름이 “저격”이다. 총사 기술을 선택해도 원래 직업의 `skill_ranger_snipe` 연출이 후보를 선점한다.

브라우저 MutationObserver로 명령 확정 전부터 6.5초 동안 계약/FX 속성을 관찰했다. 배우의 `skill_mon_acid_spit` 빌리기는 계약 ID와 `mon_acid_blob`/`mon_acid_splash`가 모두 나타나지 않았다. 대조적으로 같은 이름의 총사 기술 선택에서는 `skill_ranger_snipe`와 `ranger_scope`, `ranger_arrow`, `ranger_power_hit`가 관찰됐다. 원래 총사 계약과 `gunner_scope`는 나타나지 않았다. 적→직업 역방향은 소스로만 확인했다.

**수정:** 실행 시 실제 skillId를 timeline에 실어 끝까지 사용한다. 빌린 계약은 시전자 편에 맞춰 재생하거나 저작 단계에서 지원 범위를 명확히 제한해야 한다. 피해 자체가 다른 기술로 바뀐다고 주장하지 않는다.

## Visual QA 결과와 검사 도구의 오류

편집기 play 셸을 사용하지 않았다. `player.html` + `exportProjectStoreShim`의 출하 경로, Chromium/소프트웨어 WebGL, 임시 fixture로 실행했다.

| 케이스 | 확인 | 결과 |
|---|---|---|
| retro2003,1024×768,wait | 진입/명령/공격/결과 | 명령 합격, 결과 가림 |
| retro2003,1280×800,wait | 기술/대상 이동/취소 | 합격 |
| retro2003,1440×900,wait | 명령/배치 | 합격 |
| retro2003,1024×768,active | 명령/배치 | 정지 화면 합격; 시간 로직은 별도 |
| retro2003,1024×768,strict | 기술/대상 이동/취소 | 합격 |
| retro2003,1024×768,감소 모션 | 명령/결과 | 명령 합격, 결과 가림 |
| rm2000,1024×768 | 비교군 명령/결과 | 합격, 가림 없음 |
| Pokemon,1024×768 | 몬스터 파티/가방/포획·취소 | 확인한 root/가방 표시는 읽기 가능; 포획 취소 상태 오류 |

기본 retro2003 시나리오는 **7/7, 오류0**인데 결과창 결함이 있었다. DOM 존재만 확인하는 자동 검사는 텍스트가 다른 창에 가려지는지 증명하지 않는다. 최종 추가 matrix도 모든 beat 실패0/오류0이다. 처음 추가 대상 캡처가 숨겨진 prompt의 visibility를 기다린 문제는 QA 스크립트에서 attached 대기로 고친 뒤 재실행했다. 최종 기술/대상 화면은 pixel 배경 전체 로드를 기다렸다.

실시간 프로브는 아군 공격·적 공격·승리 각16장, 총48장을 촬영했다. contact sheet를 직접 보고 공격 접근/착탄/복귀와 승리 두 포즈를 확인했다. 검사12개 중10개 통과,2개 실패였지만 두 실패는 **예전 검사 기준**이다.

- `party-left`: 현재 계약은 적 왼쪽/아군 오른쪽인데 반대로 검사한다.
- `extended-attack-frames`: 항상 walk_a/b/c를 모두 요구하지만 flash/dash/jump 접근은 일부만 사용한다. 실제 windup/strike/follow와 victory/victory_b는 관찰됐다. 100ms 샘플링은 모든 짧은 프레임 관찰을 보장하지 않는다.

이 두 실패를 제품 버그 수에 더하지 않았다. `result-revealed.png`는 Z로 결과를 닫은 **필드 화면**이므로 결과 증거로 사용하지 않는다.

## 재현 자료와 다시 실행하는 방법

자료 폴더: [battle-audit-2026-09-30](/home/main/.codex/worktrees/3852/rpg-zzu/verify-shots/battle-audit-2026-09-30).

- [rules-probe.json](/home/main/.codex/worktrees/3852/rpg-zzu/verify-shots/battle-audit-2026-09-30/rules-probe.json): 결정적 엔진/데이터 수치.
- [MATRIX.md](/home/main/.codex/worktrees/3852/rpg-zzu/verify-shots/battle-audit-2026-09-30/MATRIX.md), `matrix.json`, 각 폴더 `extra.json`: 화면/설정/DOM 좌표.
- `motion/SUMMARY.md`, `pose-events.json`, 공격/승리 contact sheet: 연속 동작 증거.
- `reviews/`: 3개 독립 적대 리뷰와 독립 시각 검토의 전체 원문. 원문은 검토자가 직접 실행하지 않았다는 점을 명시한다. 최종 수치/확인 수준은 이 종합 보고서가 기준이다.
- `repro/`: 감독자 프로브 사본. 실행용 원본 위치는 `.omo/battle-audit-3852/`이며 상대 import를 유지해야 한다. 사본을 실행하려면 아래와 같이 그 위치로 복사한다.

```bash
mkdir -p .omo/battle-audit-3852
cp verify-shots/battle-audit-2026-09-30/repro/* .omo/battle-audit-3852/
npm run qa:runtime -- --scenario retro2003 --out verify-shots/battle-audit-2026-09-30/retro2003
node node_modules/vite-node/vite-node.mjs --script .omo/battle-audit-3852/rules-probe.mts
node .omo/battle-audit-3852/visual-matrix.mjs
node node_modules/vite-node/vite-node.mjs --script .omo/battle-audit-3852/interaction-fixtures.mts
node .omo/battle-audit-3852/interaction-probe.mjs
```

추가 브라우저 프로브는 `interactions/interactions.json`, `interactions/SUMMARY.md`에 성공/오류와 실제 관찰 값을 별도 기록한다. fixture 준비의 참조 오류/하네스 시간 초과는 제품 결함으로 세지 않는다.

최종 추가 5개 프로브는 모두 `reproduced=true`, errors0이다. 최초 fixture는 새 기술의 애니메이션 ID와 옛 fixture의 목록이 맞지 않아 로드 전 검증이 실패했고, 임시 fixture의 없는 일반 애니메이션 참조만 제거한 뒤 진행했다. 첫 combo 대기는 게이지 컨테이너의 비어 있는 style.width를 기다려 시간 초과했다. 실제 ATB 표시를 기다리도록 수정해 재실행했다. 최종 결과로 교체했으며 두 준비/관찰 오류를 제품 결함에 포함하지 않았다.

## 범위 밖과 권장 수정 순서

실제 정본 SQLite·에셋·콘텐츠, 전투 구현 소스는 수정하지 않았다. 제품 테스트/전체 typecheck/vitest/gates는 실행하지 않았다. 실제 사용자 저장 게임, 모든 스킨/전체 로스터/모든 기술, 청감, 실제 export ZIP 배포, 모든 level-up·전투 이벤트 분기를 보증하는 결과가 아니다. 루트의 AI 대화 저장소 읽기 조회는0건이었다.

수정 순서는 **D5 참조 무결성 → R2 전원 정지 → R1 실행 직전 상태 검사 → F1 포획 커밋 → F3 결과창 → R3 중복 타격 → R4/R5 예측 공유 → 나머지 입력·연출·기술 데이터**를 권장한다. 발견 즉시 고치는 대신 먼저 재현 자료를 남겼으므로, 수정 시 각각의 증거 조건을 회귀 확인에 사용할 수 있다.

## Sol 설정 작업

사용자 요청에 따라 OpenCodex의 subagent 목록에 `gpt-6.1-sol`을 추가하고 injection model/effort를 Sol/high로 설정했다. 두 CLI 변경은 성공했으며 실제 조사 에이전트 3개에 Sol/high를 명시해 실행했다. 설정 파일 전체나 자격 증명은 보고서에 복사하지 않았다. 이 내용은 OpenCodex 목록/injection 설정이며 모든 Codex 네이티브 기본 모델을 일괄 변경했다는 뜻은 아니다.
