# 전투 기능 적대적 리뷰 — 30인 합동 리포트 (2026-09-19)

> **이 문서는 2026-09-19 워크트리 기준 독립 리뷰 30건을 교차 검증해 합리적인 항목만 남긴 것이다.**
> 결함 수정은 포함되지 않는다. 각 항목의 근거는 리뷰어가 그 세션에서 실제로 연 file:line 이며,
> ✅ 표시는 오케스트레이터가 별도로 코드를 열어 재확인한 항목이다.

---

## 1. 방법론

- **리뷰어**: 30개 서브에이전트를 렌즈 하나씩 부여해 동시 팬아웃. 렌즈 구성 — UI/UX 13(AUTO·입력·피드백·경계상태·접근성·CJK·스킨·결과·연속성 등), DX 9(아키텍처·저작·관측·테스트·스키마·용어·성능·위키·온보딩), AX 8(AI 저작·발견성·결정론·오류피드백·검증표면·QA루프·병렬위험·편집지뢰). 서브에이전트는 세션 기본 워커(GLM 계열)로 스폰됐다. `[INFERENCE: 하네스가 렌즈별 특수 모델을 지정하지 않아 세션 모델 상속]`
- **규칙**: 읽기 전용(파일 수정·gates·vitest·stash 전면 금지), `openwiki/runtime-battle.md` 2026-09-14/15 절이 "수정 완료 계약"으로 선언한 항목의 무정의 재보고 금지, 인용은 실독 file:line 만. 각 리뷰어는 최소 2개의 반박된 가설(refuted)을 보고.
- **검증**: 오케스트레이터가 30건 전체 산출물(원시 finding 171건 + refuted 90여 건)을 수집 후, (1) 동일 근거를 친 리뷰어끼리 교차 확인, (2) 최고 심각도 주장은 직접 코드를 열어 재확인(§2 표의 ✅), (3) 위키가 이미 인지한 항목·저신뢰·추론 의존 항목은 폐기/보류로 분리.

## 2. 종합 판정

| 분류 | 건수 | 의미 |
|---|---|---|
| **채택** | 87 (병합 후 78개 항목) | §3. 근거 성립 + 재보고 아님 |
| **보류** | 6 | 근거는 있으나 도달성 낮음/추론 포함 — §4 |
| **폐기** | 78 | 중복·기존 인지 계약 재확인·저신뢰 — §5 |

**최우선 12 (P1 중 즉시 착수 권고)**

| # | 항목 | 도메인 | 검증 |
|---|---|---|---|
| 1 | 동시전멸이 「전멸 파티 승리」로 커밋되고 battleVictory 자동저장까지 굽는다 | 규칙 | ✅ |
| 2 | m2 전투 커맨드 타깃 미매칭 시 firstAlive 폴백이 임의의 적(예: 보스 자신)에게 changeEnemyHp — 즉사·즉시승리 | 규칙·저작 | ✅ |
| 3 | upsert_troop 으로 기존 트룹의 enemyIds 만 고치면 members 우선 정규화가 조용히 삼키고 「수정 성공」을 보고 | 저작·AX | ✅ |
| 4 | 배틀 이벤트 내부 로그 문자열이 플레이어 메시지 창을 덮어쓰고 명령 프롬프트를 억제 | UX | ✅ |
| 5 | AUTO(F)·배속(Shift) 토글이 안내·상태 표시 0, F에는 key-repeat 가드 부재 | UX | ✅ |
| 6 | 게이지 흐름에서 적 ATB는 모든 출하 스킨에서 숨겨 있고 「턴이 가까운」안내는 적을 계산에서 뺀다(+민첩 무시 오답) | UX | |
| 7 | 공식 프리셋 해상도(640×360 등)에서 전투 UI가 스테이지 절반만 덮고 생맵이 테두리로 남는다 | UX | ✅ |
| 8 | 배율 ~131%↑ 적은 진형 엇갈림·간격이 소멸(발 한 줄 고정), `--battle-depth`는 핏 이전 기하로 찍힌다 | UX | |
| 9 | 200ms 틱마다 풀 스냅샷 3회 + 전면 DOM 재동기화, 무한 성장 timeline 복사 O(T²) | 성능 | |
| 10 | 턴제 전투에는 실행 증명(receipt)·브라우저리스 검증 채널이 전무하고, 유일한 UI 게이트(qa:runtime)는 CI에서 안 돈다 | AX | |
| 11 | 실전 전투의 포렌식 표면 없음 — timeline/roundLogs가 메모리에서만 소멸, `BATTLE_EVENT_INPUT_REQUIRED`는 컨텍스트·처방 누락 | AX·DX | |
| 12 | 위키 CSS 캐스케이드 정본이 존재하지 않는 `src/styles/runtime/battle.css`를 가리키고 코드 주석 6곳이 유령명을 반복 | 문서·AX | ✅ |

---

## 3. 채택 항목

형식: `[Pn][도메인] 제목` — 문제 요약 / 근거 / 제안 / (교차·검증). 도메인: UX=플레이어, DX=개발자, AX=AI 에이전트.

### 3.1 규칙 무결성 (게임 로직)

- **[P1] 동시전멸 승리 커밋.** 적 전멸 승리 분기(`src/battle/runtime.ts:2467-2472`)가 같은 해소에서 참인 아군 전멸 패배 분기(:2474)를 return으로 차단 — Struggle 반동으로 마지막 적과 파티 전원이 동시에 죽으면 전멸 hp 스냅샷이 승리로 커밋되고, 생존 필터 없는 보상 적립(`src/battle/rewardPolicy.ts:3-11`)·`battleVictory` 자동저장(`src/player/playSceneBattle.ts:269`)까지 진행. 필드에 hp 0 파티가 남고 다음 전투 즉시 패배. → resolveOutcome에 동시전멸 분기 명시 + 커밋 계층에서 `victory && actors.every(hp<=0)` 재분류. (U06 ✅)
- **[P1] m2 타깃 firstAlive 폴백 오발동.** `resolveEnemyTargets`가 exact 매치 실패 시 첫 생존 적에게 적용(`src/battle/battleM2CommandExecutor.ts:94-100` ✅). 트룹 멤버 삭제·레코드 개명으로 `m2-098 changeEnemyHp target='enemy-3' set 0`이 **보스 자신을 즉사**시켜 즉시 승리. 로드 검증기·DB 삭제 가드·AI 툴 어디에도 m2 필드 검증이 없다(`src/project/io/commandReferenceValidation.ts:139-338`, `src/editor/databaseCommandReferences.ts:150-215`). → 폴백 제거+미매칭은 `handled:false` 로그, m2Command 참조 검증 3층 추가. (A05·A01-3·D02-6 교차 ✅)
- **[P1] m2 fields 누락 JSON → 전투 도중 TypeError.** `upsert_troop_battle_page` COMMAND_SCHEMA에 fields 요구·검증이 없고(`additionalProperties:true`), 예시가 전투에 없는 `m2-211-weighted-branch`(`src/editor/tools/schemaShapes.ts:77-81`) — 게이트를 모두 통과한 뒤 `battleM2Commands.ts:75`에서 `command.fields[key]` 크래시. 빈 target은 위 firstAlive 폴백으로 향한다. → 예시 교정, fields required, validateLowLevelCommandArray에 m2 케이스. (A01-3)
- **[P2] hidden 잔여 적에서 포획은 즉시승리, 킬은 스톨.** 승리 술어(`runtime.ts:2464-2467`)는 포획 시 hidden=true/hp=0으로 만든 뒤 빈 visible 목록을 승리로 승인하지만, 같은 상태를 공격으로 만들면 capturedMonsters=0이라 승리 없음 — 풀피 hidden 적이 남아 종결 불능(게이지 흐름엔 stalemate 밸브 없음). → 승리 술어를 `(visible 전멸) && (alive hidden === 0)`으로 강화. (U06-2, 구조 ✅)
- **[P2] canLose=true 전투의 gameOver/killPlayer 커맨드가 「패배 복귀」로 강등.** `battleEvents.ts:802-811`은 result=defeat만 세우고 `commandBattle.ts:32`는 defeat&&!canLose에만 게임오버 — 에디터 힌트 「게임 오버 화면을 엽니다」(`src/editor/eventCommands/schema/catalog.ts:734-738`)와 모순되고 죽은 파티가 세션에 write-back 된다. → 전투 이벤트 컨텍스트의 커맨드 힌트에 경고 또는 canLose 무관 종료 플래그. (U06-3)
- **[P2] 승리 레벨업이 전투불능(hp 0) 아군을 무단 소생.** `applyActorLevelUp`이 maxHp 증가분을 hp 0에 가산(`src/player/battleRewardsToSession.ts:237-244`) — 부활 표시 없이 필드에 살아있는 파티원. → hp 0이면 현재치 가산 생략. (U11-2)
- **[P2] 전투 이벤트 타이머가 필드 라이브 타이머와 미동기.** write-back은 세션 미러만 갱신(`battleRewardsToSession.ts:159-164`)하고 SSOT인 `scene.runtimeTimers`(`src/player/playSceneTimers.ts:31-37`)에는 반영 경로가 없어 set이 다음 프레임에 덮이거나(기존 엔트리), start가 영원히 카운트다운 안 하고(엔트리 부재), stop이 정지 불능. → `playSceneBattle.ts:267` 커밋 지점에 `syncRuntimeTimer` 훅 추가. (U11-1)
- **[P3] 포획 즉시 커밋 vs 구슬 write-back 비대칭.** onMonsterCaptured는 즉시 세션 커밋(`playSceneBattle.ts:138-151`), 구슬 소모는 결과 write-back 한 곳 — 동일 세션 abort 시 몬스터 유지+구슬 환불. 도달성이 좁아 P3. → capturedMonsters를 결과 경로에서 커밋하게 통일. (U06-4)

### 3.2 저작·데이터 파이프라인 (DX/AX)

- **[P1] upsert_troop enemyIds 침묵 무시 + 성공 요약 날조.** 병합은 얕은 spread(`src/editor/tools/dbTools.ts:694`), 정규화는 `members ?? enemyIds` 우선 후 enemyIds를 members에서 재파생(`src/project/databaseEnemyTroopRecordModel.ts:71,75` ✅). 구성 교체가 무시되고 「트룹 x(N마리) 수정」을 반환 — 갱신 케이스 테스트도 전무. → patch.enemyIds 존재 시 members 재구성 또는 불일치 거부 + 회귀 테스트 1건. (A01-1·D05-1 교차 ✅)
- **[P1] admission이 존재하지 않는 enemyId를 통과시키고 런타임은 raw Error로 크래시.** `battleTroopError`는 빈 트룹만 검사(`src/project/battleAdmission.ts:15-24`), enemy 존재 검사는 플레이 부팅에서 의도적 논블로킹(`src/project/playBootValidation.ts:5-9`) — `enemyBattlers`가 `Missing enemy:` raw Error(`src/battle/battleBattlers.ts:409-412`)를 던지고 플레이어 경로는 BattleAdmissionError만 친절 표시. → 존재 검사를 admission으로 승격. (A01-2)
- **[P1] m2-092(전투 명령 변경) 폼이 런타임과 다른 target 규약.** 리치 폼은 `{target:"actor", actorId}`를 커밋(`src/editor/panels/eventEditor/commandBodyM2Actor.ts:1126,1146`)하지만 런타임은 target 필드 하나만 읽는다(`src/player/interpreter/m2Runtime.ts:362,486-489`) — 팬텀 키 `actorBattleCommands["actor"]`에 기록되고 실제 액터는 무변화. 같은 파일의 다른 액터 폼은 반대 규약. → 규약 통일 + m2Catalog 필드 spec 단일 상수화. (D02-1)
- **[P1] 포획은 4-레코드 불변식인데 툴은 2개만 검증.** captureProfile+type:'special'+speciesId+monsterCollection 중 `upsert_item`은 type 무관 저장, speciesId 미설정 무경고, monsterCollection 오프면 메뉴에서 조용히 소멸(`src/battle/battleCommands.ts:52-54`) — 표시 계층 captureItems까지 런타임 조건과 불일치(`src/player/battleCommandDom.ts:464-469`). → 저작 시점 불변식 검증 + capture 필터 정합. (A01-4)
- **[P2] 파일 임포트 경로의 전투 조건 검증이 툴보다 느슨.** `enemyHp`는 DB 전체 적 집합으로 검사(`src/project/io/commandReferenceValidation.ts:399-407`)해 출전하지 않는 적 조건이 통과 후 영원히 false, unknown kind는 default 없이 통과. → 트룹 로스터 컨텍스트로 통일 + default 수집. (A01-5)
- **[P2] 레거시 트룹 합성 좌표가 3벌의 진형식과 충돌.** 로드 정규화(104+i*56)/런타임 classicEnemyFormation/에디터 미리보기 각각 다른 식(`src/project/databaseEnemyTroopRecordModel.ts:192-201` vs `battleBattlers.ts:394-406` vs `databaseUtilityRecordViews.ts:674-676`) — 저장값·미리보기·실전 배치가 셋 다 다르고, 합성 좌표가 다음 저장에 영구 박제. → classicEnemyFormation 단일 정의 수렴. (D05-2)
- **[P2] v4 정규화가 진단 없이 전투 데이터를 고쳐쓴다.** 스키마 훅은 v1/2/3에만 있고(`src/project/io/serialize.ts:45-63`) 그 사이 추가된 전투 데이터 전부가 무진단 정규화에 의존 — 미지 kind 프로필 통삭제(`src/project/actionCombat.ts:102,117`), SKY_PANORAMA 배틀백 강제 치환(`databaseEnemyTroopRecordModel.ts:61-68`), 클램프 침묵 절단. → 정규화 발생을 진단 채널에 기록. (D05-3)
- **[P1] M2 전투 커맨드 추가에 9~12개 파일의 수동 장부.** catalog/분류데이터/파서/실행기/contract/베이스라인이 수동 동기화이고 누락 3종(죽은 커맨드·빈 폼·거짓 배지)이 전부 무음(`src/project/eventCommands/m2Catalog.ts` ↔ `src/battle/battleM2Commands.ts` ↔ `m2RuntimeClassificationData.ts`). → 단일 진실원천 파생 또는 최소한 카탈로그↔파서 집합 대조 테스트. (D02-2)
- **[P2] m2-108 폼이 노출하는 operation을 파서가 버린다.** 폼은 set/add/remove/toggle 셀렉트를 렌더(`m2Catalog.ts:414-419`)하지만 파서는 target+amount만(`battleM2Commands.ts:63-68`), toggle은 set으로 침묵 강등(:87-91) — 「감소」를 골라도 추가가 실행. DB 퀵패널은 컨트롤 자체가 없어 두 저작면이 다른 컨트롤 집합. (D02-3)
- **[P2] m2 commandId가 title slug라 제목 수정이 저장 데이터를 단절.** `stableCommandId = m2-${index}-${slug(title)}`(`m2Catalog.ts:229-231`) — 카탈로그 오타 수정이 모든 저장 프로젝트의 commandId를 무효화하고 "unclassified" warn만 남음. 같은 구조로 4개 표면의 분기가 title 문자열에 의존. → 명시적 id 선언 + title 기반 분기 금지 검사. (D02-4)
- **[P2] 보상 흐름 템플릿이 런타임 소비자 없는 m2-109를 대량 삽입.** `withTemplateCommands`가 항상 넣는 m2-109-result-summary는 editor-only 합성 id(`m2RuntimeClassificationData.ts:139-141`) — 매 전투 실행마다 logUnsupported. → 런타임 연결/제거/인텐트 카드 경고 셋 중 택일. (D02-5)
- **[P2] m2-054 vs m2-103 vs 네이티브 showAnimation 라벨 3중 충돌.** 전투 이벤트 피커에서 같은 「애니메이션 표시」 행 3개, 지원 배지·로그·런타임 경로가 전부 다름(2026-08-27 m2-054/055 사고의 재발). → 피커 컨텍스트별 라벨 중복 테스트 + 054 deprecate. (D02-7)
- **[P2] 에디터 전투 테스트 3진입점의 실패 보고가 제각각.** 적 시험 전투·트룹 테스트·DB 퀵 전투의 준비 실패가 `if (!prepared) return;` 무반응(`src/editor/panels/testPlayModal.ts:204`, `quickBattleModal.ts:31-32`) — 같은 모듈의 presentOpenFailure 계약(기계 이유+복구 버튼)을 안 씀. → 세 진입점 통일 + toast. (D09-4)

### 3.3 플레이어 UX — 입력·AUTO·턴 흐름

- **[P1] AUTO(F)·배속(Shift)이 안내·상태 표시 0.** 토글은 root data 속성만 기록(`src/player/battleDom.ts:180-198`)하고 `src/styles` 전역에 `[data-battle-auto]/[data-battle-speed]` 소비자 0건(✅ grep), 키 안내는 「Z 확인 · X 취소」뿐(`src/player/keyBindings.ts:220`) — 오눌러도 피드백 0, AUTO 켜지면 게임이 혼자 플레이. → data 속성을 읽는 스킨 공용 칩 CSS + keyPrompts에 「F 자동 · Shift 배속」 추가. (U01-1·U02-6·U05-1 3인 교차 ✅)
- **[P1] F 토글에 key-repeat 가드 없음.** repeat 가드는 confirm/cancel에만(`battleDom.ts:454`), F 분기(:477-481)는 무가드 ✅ — 0.5초 홀드로 AUTO가 수십 번 뒤집히고 최종 상태를 알 수 없음(F5 때문에 표시도 없음). 대상 선택 중 F는 즉시 첫 대상 공격 커밋(:908-911). → 454 가드에 자동전투 키 포함. (U03-1·U05-6 교차 ✅)
- **[P2] Shift 조합 판정이 F·스킵 경로에서 마킹 없이 return.** `shiftCombined` 마킹은 499행 한 곳인데 F(:477)와 sequenceBusy(:489-498)가 앞서 return — 연출 중 Shift+Z가 배속 토글을 발동(코드 주석이 명시한 계약 위반). → 마킹을 onKeydown 입구로. (U03-2 ✅)
- **[P2] AUTO 중 수동 개입 경로 부재.** checkAutoBattleStep이 syncView마다 즉시 발화(`battleDom.ts:903-911`) — 「1턴만 수동」이 없고 AUTO 중이라는 표시도 없어 커맨드 메뉴가 죽었다고 오해. → 확인키를 1턴 건너뛰기 플래그로 소비. (U05-5)
- **[P1] 게이지 흐름에서 적 ATB 숨김 + 예고문 오답.** 적 바는 deprecated vxace에서만 보이고(`03-vxace-status-nodes.css:3-10`) 활성 3종은 미노출, 충전 예고문은 `snapshot.actors`만 정렬(`battleDirectorDom.ts:96-98`) — 적이 99%여도 「주인공의 턴이 가까워지고 있다」. 또 raw gauge 정렬이라 민첩이 다르면 체계적 오답(정판정식 `msToReady`는 소비자 0). → 양측 nextReadyBattler 기반 예고 + glass 계열 ATB 복원. (U05-2·U05-3 교차)
- **[P2] 아군 대상 재선택 경로에서 표식·안내문·확정 대상 불일치.** 취소→재선택 시 키보드 커서는 savedId 복원, 런타임 선택은 targetIds[0] 리셋 — 화면 'selected' 표식을 믿으면 다른 아군에게 발사(`battleDom.ts:604-626` vs `runtime.ts:1472-1483`). → markMenuCursor 복원 시 setSelectedTarget 동행. (U05-4)
- **[P2] hover로 「뒤로」행에 오면 순환 경계 모델이 입력 경로에 따라 깨진다.** 마우스 hover 경로는 `enemyTargetCursorOnCancel` 플래그를 안 세워 ArrowRight가 1번을 스킵, 키보드 경로와 다른 다음 대상 — 위키 계약(뒤로=순환의 마지막 자리)의 마우스 경로 반박. → setMenuCursor에 플래그 세팅 또는 hover 커서 동기화 제거. (U03-3)
- **[P1] 적 대상 국면에서 Tab이 필드 버튼으로 새어들어 보이지 않는 포커스가 Enter로 즉시 공격 확정.** 필드 적은 네이티브 button(tabIndex 0)인데 `.battle-enemy:focus`는 outline:0(`06-damage-flash-targeting.css:184-188`) — 커서 모델과 네이티브 Tab 모델 병존. → 대상 국면 필드 버튼 tabIndex=-1 또는 커서 적 시각 규칙 추가. (U07-1)
- **[P2] Tab 내비게이션 진동.** 적 대상 rebuild 경로는 markMenuCursor 없이 네이티브 탭 가능 행을 재생성하고 focusin이 전면 rebuild→필드 강제 포커스로 되돌아가 Tab이 두 지점을 무한 왕복(`battleDom.ts:942-1002`). → 행 tabIndex를 커서 모델로 통일. (U03-4)
- **[P3] 명령 국면 200ms 틱이 포커스를 커서 버튼으로 재주장**(`battleDom.ts:884-887`) — Tab 이동이 무효화. → 재포커스를 국면 전환 1회로. (U03-5)
- **[P2] 필드 조준 상태의 AT 전달 계약이 깨졌다.** aria-selected는 role 없는 div에만 붙고(무효) 적 버튼에는 안 붙는다 — 06층 주석의 「보조기술에도 전달된다」는 코드로 반박됨. → 적 버튼 aria-pressed 갱신 + 주석 정정. (U07-4)
- **[P3] 대상 순환 홀드가 초당 수십 회 전면 rebuild+선택음 연타**(`battleDom.ts:926-951`) — 부분 갱신+스로틀로. (U03-6)

### 3.4 플레이어 UX — 피드백·메시지·정보

- **[P1] 배틀 이벤트 내부 로그가 메시지 창을 덮어쓴다.** `wait 300ms`/`flag a=true` 같은 내부 계측 문자열도 `kind:"message"`로 쌓이고(`src/battle/battleEvents.ts:428,676,765` ✅), `battleEventDirectorState`가 마지막 message를 골라 step을 acting으로 강제(`src/player/battleDirectorDom.ts:237-246` ✅) — 명령 프롬프트가 로그 문자열로 대체되고 복귀하지 않음. → 표시 소스를 저작 text 커맨드로 한정. (U02-1 ✅)
- **[P1] 상태 메시지에 주어가 없다.** stateAdded/Removed/incapacitated가 「독이 걸렸다!」로만 렌더(`battleSequencer.ts:508-520`) — targetId는 엔트리에 있는데 화면 변환 부재, 7인 전투에서 「누가?」를 알 수 없음. → disambiguatedBattlerName 합성. (U02-2)
- **[P2] 상태 피드백 채널 자체가 없다.** stateAdded/Removed는 visual 목록 밖이라 소리·팝업·모션 0, 유일한 시각 단서인 상태 아이콘은 4개에서 무표 절단+stateTurns 미표시+glass chrome 안 가림(`battleFieldDom.ts:1169-1187`, `_rm2000.css:202-208`). (U04-4·U02-3 교차)
- **[P1] 세기 기반 화면 흔들림이 애니메이션 경로에 1프레임 만에 강제 종료.** `applyTimingEffects`가 매 틱 `battle-screen-shake`를 toggle(`battleAnimationDom.ts:564`)해 flashBattleField의 heavy/critical 흔들림이 소멸 — 세기 차등이 애니메이션 있는 타격에서만 무효. → 소유권 분리 또는 조건부 toggle. (U04-1)
- **[P2] 「사건 1개 = 소리 1개」 계약이 2경로에서 파괴.** 저작 착탄음+고정 피해 SE 동시 발화(`battleJuice.ts:55-62` 계약 자인), 커맨드 클릭도 confirm+swing 중복(`battleDom.ts:847,1071`). (U04-2)
- **[P2] 속성 상성이 전투 피드백 어디에도 없다.** 약점 2×/내성 0.5×가 같은 SE·플래시·팝업 — 예측 패널만 weak/resistant를 안다. → timeline에 effectiveness 실어 팝업 등급+메시지 한 줄. (U04-3)
- **[P2] 방어 완전 블록이 팝업은 뮤트, 소리·화면은 풀 피해 재생**(`battleDom.ts:341-360`) — 채널 간 반박. → blocked 분기에 defend 큐. (U04-5)
- **[P2] 저작 착탄이 approach 비트보다 늦으면 팝업·소리가 시각 접촉보다 먼저 터진다**(clamp 없는 `max(0,…)`, `battleSequencer.ts:447-456`). (U04-6)
- **[P2] 3배속에서 메시지 체류가 읽기 하한 250ms를 깬다.** RM 접힘 하한(`REDUCED_MOTION_MAX_MS`)은 감소 모션에만 적용되고 배속 경로에는 정책 자체가 없음(`battleSequencer.ts:144-147`). → 텍스트 노출 지연에 minRead 바닥. (U02-4)
- **[P2] 전체 대상 스킬이 대상 수만큼 동일 선언·애니·비트를 완전 재생** — 5마리 기준 한 행동 5초, 진행 표시도 없음. → 시퀀서에서 연속 동일 엔트리 그룹핑. (U02-5)
- **[P2] 이벤트 wait는 배속·스킵·RM 전부 무시하는 벽시계**인데 배속 적용용 wait 재생 경로(`battleSequencer.ts:389-394`)는 생산자가 없는 죽은 코드(`types.ts:299-300` 주석 반박). → 수렴 또는 제거. (U12-4)
- **[P2] 스킵 중 Shift 탭이 data-battle-speed를 덮어 이펙트 프레임과 비트 배속이 갈라진다**(`battleDom.ts:194-198` vs `battleAnimationDom.ts:310-313`) — beginSkip 주석이 명시한 과거 결함의 재발 경로, 회귀 테스트도 0. (U12-5)
- **[P2] RM에서는 배속 토글이 시퀀서 리듬에 무효**인데 dataset만 바뀌어 한 화면에 두 시간이 흐르고, RM 접힘이 「착탄=임팩트 비트」 계약도 깬다(플래시가 팝업 뒤에 도착). (U12-6·U12-7)
- **[P2] AUTO 품질 삼중 결함.** 회복 판정이 회복량·과치료·적 의도를 무시하고 40% 이하에서만 반응+동점 무작위(`battleAuto.ts:78-86`), 기본 공격을 스킬과 경쟁시키지 않아 MP 낭비+광역 킬 가점 부재, fallback은 학습 스킬 전체 균등 랜덤(버프 중복·자해 상태·무작위 타깃 가능). + 강제 교체 첫 예비 맹목 선택, auto OFF 시 1.8 복원 없음. (U12-1·2·3·8)
- **[P3] stalemate 강제 종료가 「행동을 실행했다.」로 렌더**(`timelineDirectorState`에 kind 분기 누락) — 한 줄 수정. (U02-8)

### 3.5 플레이어 UX — 접근성·텍스트·스킨·배치

- **[P2] 포켓몬 스킨에서 적 HP가 색 바 하나뿐** — 수치 채널 display:none, 바 span에 role/aria-valuenow 0 → 보조기술에 HP 정보 0. → role="meter" 또는 행 aria-label. (U07-2)
- **[P2] 방어(stance) 상태가 표면에서 소실** — 적 방어는 CSS 규칙 자체가 없고 아군은 8px 밀림뿐, 파티 행·aria 0. (U07-3)
- **[P1] 활성 유리 스킨만 전투 내러이션을 한 줄 강제+절단.** 공용층은 줄바꿈 완화로 통일됐는데 `_rm2000.css:1126-1132`만 nowrap+ellipsis 유지 — 긴 이름+스킬명이 「…」로 절단(pokemon 등 10종은 전부 줄바꿈 해결). → keep-all 줄바꿈 교체. (U08-1)
- **[P2] glass 필드 이름표가 max-width·ellipsis 없는 nowrap** — 긴 이름이 씬 밖으로 깎이고 이웃과 겹침. → max-width+순번 별도 노드 계약 확장. (U08-2)
- **[P2] 포켓몬 적 목록이 inline-flex에 overflow:hidden** — CSS 명세상 text-overflow 무효, 긴 이름 뒤 Lv 배지가 생략부호 없이 통째로 삭제. → Lv 전용 grid 열. (U08-3)
- **[P3] josa 폴백이 괄호로 끝나는 이름을 전부 받침 있음으로 판정**(「슬라임(붉은)을」), targetPrompt가 조사 「을」 하드코딩(`battleCommandDom.ts:735` — terms 오버라이드에서 비문), 비유리 deprecated 스킨 이름표 세로 겹쌓임. (U08-4·5·6, U01-6 교차)
- **[P2] 도주 불가 전투에서 사유가 「현재 사용할 수 없습니다.」뿐**(`battleCommandDom.ts:296-299` — gen1 공격 차단은 구체 사유 선례). → canEscape 읽어 명시 사유. (U01-4)
- **[P2] 기술·아이템 설명이 aria-label에만 존재** — .battle-command-help는 CSS만 남고 렌더 코드 0건(죽은 CSS). (U01-3)
- **[P3] 게이지 대기·연출 국면에서 명령 영역 통째로 비고 키 안내 소멸**, 상태 배지 9px(같은 표면의 타입 배지는 12px 근거로 올렸는데 상태 배지는 방치), role 없는 요소에 aria-label 3곳, rm2000이 strict 대기열 표시를 대체 없이 display:none. (U01-5, U07-5·6, U02-7)
- **[P1] 공식 프리셋 해상도(640×360·426×240)에서 전투 UI가 스테이지 절반만 덮는다.** 논리 무대 고정 640×480(`battleStageScale.ts:28-29`·`01-scene-base.css:63-64` ✅)+0.5 양자화(:48 ✅) → 640×360 host에서 0.75→0.5, 시각 320×240 — 좌우·상하에 라이브 맵이 테두리로 남음. e2e는 underfill을 못 잡음. → cover 배율/동적 논리 무대/프리셋 경고. (U09-1 ✅)
- **[P2] 배율 양자화가 자기 transform만 보고 조상 --play-scale과의 합성을 무시** — fit 모드·소형 뷰포트에서 최종 배율이 임의 소수가 되어 주석의 보장이 어느 실전 경로에서도 성립하지 않음. (U09-3)
- **[P2] 375×667 급 폰에서 커맨드 탭 타깃 12~13px·본문 8px 붕괴** — 팀이 타입 배지만 12px로 소급 수정한 실측이 0.5 배율 폰이 실전 표면임을 증명. (U09-4)
- **[P2] themeVars 13변수 계약이 3곳에서만 살아 있다** — 4개 변수는 소비자 0, 9개 스킨 팔레트는 CSS 하드코딩과 이중 관리(CSS 재선언 블록은 inline에 지는 죽은 값). (U09-2)
- **[P3] pokemon 스킨이 MP·ATB를 무조건 숨겨 gauge 플로우에서 대기 정보가 보이는 스킨이 0**, inset-top 주석 「rm2000=8px」 vs 실제 48px(두 곳 ✅ 교차), `showAllySprites`·`data-battle-layout`은 소비자 0. (U09-5·6, U13 교차)
- **[P1] 배율 ~131%↑ 적은 진형이 소멸한다.** fit이 발을 한 줄(y=336)로 고정하고 x를 하나의 창으로 조여 엇갈림·간격 삭제, `--battle-depth`는 핏 이전 y로 한 번만 찍혀(`battleFieldDom.ts:646`) 사라진 기하로 z를 정함 — 위키 2026-09-06 절은 단독 골렘만 검증했다. → y 순서 보존+depth 재심. (U13-1)
- **[P2] frontview·firstperson 수동 배치엔 충돌 회피 패스가 없다** — 2026-09-14에 측면 분기만 고쳐 정면 6종에 같은 결함 잔존, 측면 패스도 24px 임계가 배율을 모름. (U13-2)
- **[P2] 트룹 편집기 미리보기가 「실제 표시 위치」라고 보증**하지만 런타임 fit(발 고정·x 클램프·배율)을 하나도 재현하지 않음. (U13-3)
- **[P2] 파티 카드 「행 중심」앵커는 기하학적으로 도달 불가** — [0,100]% 클램프가 2026-09-14 위키 계약을 반박(행 중심은 항상 >100%). (U13-4)
- **[P2] 폴백 스킨 8종의 결과 박스(340×192)가 보상 행 증가 시 확인 버튼·프롬프트·레벨업을 폴드 아래로 가리고 키보드 스크롤 수단 0** — 활성 3종은 이미 고쳐졌는데 폴백만 방치. (U10-1)
- **[P2] 결과 카드 경험치가 원본 합계, 실제 지급은 레벨차 보정치** — 숫자와 게이지가 모순. (U10-2)
- **[P2] 액터 레벨업은 습득 스킬을 표시하지 않는데 몬스터는 표시**(데이터는 levelUps에 이미 존재) + EXP 게이지가 선두 1인 전용 백분율 + 계산 불가(몬스터 파티·만렙) 시 빈 0% 트랙 렌더. (U10-3·4·5)
- **[P3] 결과 도달 즉시 메시지 창이 보상 전체 요약을 흘려 450ms 스테이지 공개 위계를 무효**, 결과 화면 퀘스트·세계상태 메타 섹션은 렌더 코드 없는 CSS ~110줄+아이콘 에셋만 잔존, 같은 트랙 연속 전투의 BGM이 결과에서 끊겨 0:00 재시작(enter 측 「같은 곡이면 건드리지 않는다」 계약이 결과·퇴장 체인에서 파괴). (U10-6·7, U11-3)

### 3.6 성능 (DX)

- **[P1] 200ms 틱마다 풀 스냅샷 3회 + 무조건 전면 재동기화.** 게이지 충전 대기(최빈 상태)에서도 before/tick/after snapshot+syncView(내부에서 snapshot 1회 더) — snapshot은 전원 battlerSnapshot+배열 복사+structuredClone 3회. → signature 게이트 + eventState 지연. (D07-1)
- **[P1] 무한 성장 timeline·actionLog를 스냅샷이 통째로 복사 — 장기전 O(T²).** advance 루프가 결과 확인 스칼라 질의 하나에 snapshot 1회, 시퀀서 finish는 단일 표현식에 3회(`battleSequencer.ts:598`). → 스칼라 질의 API+지역변수+tail slice+actionLog 상한. (D07-2)
- **[P2] 틱마다 전 배틀러×전 상태 states DB 선형 스캔(캐시 없는 배율 계산)**, **상태 아이콘·이름 행 매 동기화 노드 재생성(churn)**, **배틀러당 4단 querySelector 폴백+루트 전체 sweep** — rowsKey 패턴(`battleDirectorDom.ts:328`) 전례를 전파하라. (D07-3·4·5)
- **[P3] 적 AI·AUTO 유틸리티가 후보당 풀 battlerSnapshot/DB 스캔**(gen1·6체에서 배증). (D07-6)

### 3.7 아키텍처·용어 (DX)

- **[P1] createBattleRuntime 하나(~2,389줄)가 8+ 책임을 섞는 god closure** — 절단선 5개(gen1 어댑터·적 AI·아이템/포획·스냅샷 빌더·연출 리졸버) 제시. 역방향 import는 깨끗함(반박 확인). (D01-1)
- **[P1] 런타임 API가 void를 반환해 표시 계층이 스냅샷 diff로 역추적** — commandProgressed/timeline 문자열 키/타임라인 재훑음/concreteTargetCommand 재조립 4종 세트(self/all 경로는 주석이 스스로 인정). 대상 confirm 직전 사망 시 연출·현실 갈라짐. → API가 {applied, concrete, consumedFrom/To} 반환. (D01-2·D06-6 교차)
- **[P1] 행동 주체 이름 4개(userId·userRecordId·activeActorId·activeActorRecordId)와 recordId가 든 activeActorId** — `.id`와 비교하면 몬스터·적에서 조용히 undefined(현행 코드가 OR 검사·주석으로 비용 지불 중). → activeActorRecordId 개명+규약 주석 타입 헤더 이식. (D06-1)
- **[P1] selectTarget은 「선택」이 아니라 「커밋」** — setSelectedTarget이 미리보기, 한 단어 차이가 정반대 결과 + 대상 스냅샷 3벌 별칭. → confirmTarget/previewTarget 개명+별칭 제거(clean cutover). (D06-2)
- **[P2] 규칙 코어가 스킨 id로 게임 정책 결정**(skinHasteMultiplier·autoConfirmSingleTarget 캐스트+try/catch 2벌) → registry 필드로. / **스냅샷 battleX/battleY는 소비자 0인 사본**(표시는 authored 재계산) → 삭제. / **연출 결정·hitFeel·배경이 rules core**에 있고 battleDom.ts:319는 스냅샷을 위조 — presentationResolver 주입으로. / **포획 시네마틱이 필드 렌더러에 하드코딩 타이밍**(스킵·배속 계약 밖) → planCaptureBeats로. / **표시 2대 파일이 스킨 해석·targetId 도메인·시뮬 펌프 케이던스를 중복 보유**. (D01-3·4·5·6·7)
- **[P2] 「impact」가 7가지 뜻**(비트 종류/감독 스텝/길이는 hitStopMs/이름은 recover 길이/착탄 오프셋/메시지 빌더) — impactMs를 올리면 recover가 길어진다. → recoverMs 개명+옵션 객체 시그니처. (D06-3)
- **[P2] 국면 어휘 삼중 분열(phase/step/beat)·recover 비트의 directorStep="impact"**, **회복·빗나감의 kind+부호 이중 인코딩**(위키 「부호가 아니라 kind로」계약문이 코드 생산·소비 양쪽의 부호 분기로 반박됨 — 위키-코드 반박 항목), **command 타입 6종·battleCommandKind 인라인 재철자·enemy 접두 비대칭**, **「Action」접두가 턴제 비트와 실시간 모드를 겹쳐 씀**. (D06-4·5·7·8)

### 3.8 관측·QA·AI 경험 (AX/DX)

- **[P1] 실전 전투의 포렌식 표면이 없다.** timeline/roundLogs/eventLogs는 항상 만들어지지만 세이브는 결과 문자열+RNG 상태만 저장, 표시 계층은 소비 즉시 폐기, `__oprn*` 훅에 턴제 접근자 0, QA는 DOM 스크레이핑 전부. → `window.__oprnBattle()` 훅(최근 timeline+result+RNG 카운터) + 전투 종료 요약 transcript. 데이터는 이미 존재. (D03-1)
- **[P1] `BATTLE_EVENT_INPUT_REQUIRED`가 컨텍스트·처방을 전부 생략** — prompt·options·variableId·round는 에러 객체가 이미 들고 있으나 모든 소비자가 .message만 문자열화. 시뮬 툴은 catch 없이 `tool-exception` 원문 전달. → describeBattleInputRequired 헬퍼 + ToolError 승격. (A04-1)
- **[P1] 랜덤 인카운터·필드 스폰의 non-admission 실패는 무음 누출** — 인터프리터 경로만 전체 catch+오버레이, 랜덤은 `void`+재던져 unhandled rejection. → catch 통일+최소 `.catch`. (A04-2)
- **[P2] admission notice에 「어느 커맨드·페이지」컨텍스트가 없고 인카운터 표면의 처방은 실행 불가능** + 오버레이가 트룹·페이즈·라운드 컨텍스트 폐기 + `BATTLE_VARIABLE_INVALID`가 수용 형식 미고지. → origin 필드+헬퍼 조립. (A04-3·4·5)
- **[P2] simulateBattle의 seed가 판을 식별하지 못한다**(n판 RNG 스트림 공유 ✅, 로그는 첫 판만 — 베이스라인 스크립트가 우회법까지 문서화). → deterministicRng(seed, troopId, i) 파생. (D03-2 ✅)
- **[P1] simulateBattle이 세션 조건 상태(gameTime/switches/variables/gold)를 전달하지 않아** 시간·스위치 게이트 페이지의 승률·페이즈 커버리지가 실런타임과 어긋남(sceneTestRunner는 같은 계약을 지킴 — 이중 기준). → SimulateBattleInput 확장+BATTLE_CONDITION_SESSION_STATE_FIELDS 일치 회귀. (A03)
- **[P2] battlePredict의 적 의도·도주율·약점 헬퍼는 소비자 없는 죽은 코드+「런타임 AI와 동일」주장은 chooseEnemyAction으로 반박** — 표면을 붙이면 오탐 양산. → 스코어링 공유 또는 삭제. (D03-3, U12 AUTO 분석과 상호 참조)
- **[P2] unsupported 배틀 이벤트의 신호가 로그에서 끊긴다** — 플레이어 화면·에디터 밸런스 패널 둘 다 못 봄(데이터는 simulate 반환값에 존재). → 밸런스 카드에 phaseCoverage 렌더. (D03-4)
- **[P2] 에디터 「난이도 추정」은 rm2k3에서 기본 공격만 두르는 AI로 측정하고 전제를 고지하지 않음.** (D03-5)
- **[P3] rng 폴백 주석이 자기반박이고 유일한 신호(console.warn)는 QA 수집 대상 아님.** (D03-6)
- **[P1] 턴제 전투에는 실행 증명 수령제가 없다** — 액션 전투의 ActionCombatProofReceipt(WeakMap 아이덴티티) 대응물 부재, play_walkthrough/run_scene_test는 규칙 코어만 돌리고 UI 미실행, verify 화이트리스트에 턴제 UI 검증 툴 0. → runTurnBattleTest+receipt+툴 등록. (A06-1)
- **[P1] 브라우저 없는 에이전트가 전투 UI 변경을 검증할 수단이 전무하고 qa:runtime은 CI에서 안 돈다**(ci-full/어느 워크플로에도 스텝 없음). → CI에 qa:runtime:gate(nightly) + 리포트 diff 판정 계약 문서화. (A06-2)
- **[P2] QA 기대 축이 전투 내부 상태를 battleResult 한 스칼라로만 관측** — HP·턴·페이즈·게이지 축 부재(농사는 receipt 축이 있는데 전투에는 없음), 쓰기 훅은 있는데 읽기 축 없음. → readState에 battle 스냅샷 투영+battleState/battleAttrs 축. (A06-3)
- **[P2] 전투 증명 계측이 시나리오 파일마다 애드혹**(u14 원숭이패치·teardown 타이머 래퍼) — 공통 하니스로 승격. / **[P3] 액션 receipt의 전제가 좁아**(스폰·스테이징 셀 필수) 턴제 복제 시 증명 불가 지대 재현 위험 / **[P3] runtimeQa.mjs 헤더가 없는 소비자 파일을 가리킴**. (A06-4·5·6)
- **[P2] 시나리오별 probe-gated 변수 카탈로그가 존재**(A06가 __oprn* 전수 목록을 실측 남김) — 문서화 가치 있음.

### 3.9 문서·위키·편집 지뢰 (DX/AX)

- **[P1] CSS 캐스케이드 정본이 없는 `src/styles/runtime/battle.css`를 가리킨다.** `runtime-battle.md:432-433`(21파일 표)·:541 — 실물은 `runtime/index.css`의 18개 battle 리프이고 `test/playerRuntimeCss.test.ts:45-46`이 코드로 위키를 반박. 스킨 주석 6파일 11곳이 유령명 반복(_battlers:2 「언레이어드」거짓, _vxace:27 「!important 강제」거짓 — battle/ 전체 !important 0건). → 위키·주석 정정 + 「battle.css」 문자열 금지 감사 테스트. (D08-5·A02-1·A08-1 3인 교차 ✅)
- **[P1] 위키가 존재하지 않는 맵 id `map_action_demo`을 출하 데모로 기술**(`runtime-action-combat.md:31` — src grep 0건 ✅, 실제는 map_mine_1f, 같은 문서 :259와 내부 모순). (D08-1 ✅)
- **[P1] 스킨 계약 절(2026-08-27)이 코드와 정반대** — 「등록 11종·저작 2종·rm2003→rm2000 별칭」 vs 실제 12종·활성 3종·별칭은 classic뿐(`registry.ts:291,312-324`). 같은 위키 신절(:360)과 절끼리 모순. (D08-2)
- **[P2] 위키 수치·경로 스탈 5건** — 스태미나 재생 25→실제 20, 커맨드 행 높이 23px→실제 26px, `battle/18-pokemon-layout-redesign.css` 유령(실제 20층), rm2000 뒷모습 partyFacing 현재형 스탈(신절은 정확), 「정수 배율 정책 미결」 표기(이미 integer/fit 구현됨 — 남는 논점만 재기술), disambiguatedBattlerName 정의 위치 3곳 오기. (D08-3·4·6·7·8)
- **[P1] 필수 사전읽기 페이지가 쿼런틴으로 바뀐 테스트 2개를 살아있는 계약으로 인용** — `runtime-pre-edit-routing.md:40,77`은 `playerInputCss.test.ts`·`runtimeQaInstrumentationBoundary.test.ts`를 현재형 인용, 실물은 .quarantine(정상 스위트 제외=가드 미가동) — 이 사실을 페이지가 숨김. (A02-2)
- **[P2] 액션 전투가 quickstart 기능→파일 표에 없고 「편집기 play 모드 검증 무효」계약은 액션 위키에만 존재** + export-player는 리포 파일이 아닌 dev 가상 경로. (A02-3)
- **[P2] 「battle command」 검색이 4개 레이어 8개 동계열 모듈을 뱉고 브레드크럼 0** — commandBattle.ts vs battleCommandDom.ts는 어순까지 뒤집힘. → quickstart 행+파일 선두 역할 주석. (A02-4)
- **[P1] 「전투에 상태이상 추가」가 quickstart 라우팅 어디로도 연결되지 않는다** — 소유 파일 `src/battle/battleStates.ts`는 위키 전체 0회 언급, 정답 페이지 state-system.md는 quickstart에 0회 등장. → quickstart 행+routing 행+Files to inspect 명기. (D09-1)
- **[P2] INDEX.md 절 좌표 5줄 드리프트+모지바케 레지스트리 낡음** — `--check` 게이트화가 근본 수정. / **quickstart §0·PROJECT_WIKI가 위키 규모를 3배 낮게 기술**(41쪽/27만 토큰 vs 실제 70쪽/82만 토큰). / **라우팅 페이지에 동일 절 통중복(emotes 2회)+전투 페이지에 비전투 절 매립**. (D09-2·3, A02-6)
- **[P2] 포켓몬 층 통합(2026-09-17)이 현재형 소유자 표식 4곳을 죽은 파일로 남김**(`_pokemon.css:12,17`, `20:190,478` — 18층·20-pokemon-reference-restyle 유령). (A08-2)
- **[P2] 03-vxace-status-nodes 선두 주석 「display 되돌림은 _vxace.css 만」이 거짓** — 기본 스킨 rm2000이 `.battle-actor-face`를 되돌림(`_rm2000.css:791-806`). (A08-3)
- **[P2] 20층 헤더의 「남은 pokemon 스코프」목록이 `_pokemon.css`(로드 순서상 가장 뒤에서 이김)·`_battlers.css`를 빠뜨림** — `_pokemon.css`의 「팔레트만 갖는다」자기 서술도 거짓(메시지 타이포 규칙 보유). (A08-4)
- **[P3] 비활성 계약 이중 표준 무표기** — 커맨드 행 aria-disabled 트릭(주석·테스트 완비) vs 필드 적 버튼 네이티브 disabled(무표기) — 텍스트 치환 「일관성」편집이 (a)를 깨면 잡는 테스트가 없다. (A08-5)

### 3.10 병렬 에이전트·운용 (AX)

- **[P1] wt create/dev:worktree가 VITE_CACHE_DIR를 세팅하지 않는다** — vite.config 주석이 실측 피해(액션 QA 3회 사망)까지 기록했는데 provision/ensureWorktreeDevPort/dev-server 어디에도 캐시 격리 없음, 완화법은 quickstart에만. → 포트 배정과 같은 자동 처리로 주입+가이드 정합화. (A07-1)
- **[P1] 전투 코드 검증 흐름이 공유 Supabase 행에 자동저장을 쏠 수 있다** — 워크트리 .env 복사(실키 포함)→store.load() 자동→원격 저장 기본 켜짐 4초 디바운스. 가이드는 저작 콘텐츠만 금지. → blankProject 강제/원격 저장 비활성 env/가이드 1행. (A07-2)
- **[P2] CSS 매니페스트(index.css)가 단일 병합 앵커+rm2000/rm2003이 _rm2000.css 한 파일 공유** — 상대 순서 뒤바뀜을 잡는 게이트 없음. → 삽입 앵커+순서 게이트 테스트+glass 베이스/오버라이드 분리. (A07-3)
- **[P2] test/fixtures/projects/battle-v3.json이 50+ 테스트·QA 시나리오가 당기는 전역 레지스트리** — 내용 의존 심어둔 곳이 조용히 흔들림. → 동결 선언+sha256 핀 테스트. (A07-4)
- **[P2] 스킨 추가 1건이 열거 계약 5곳 동시 충돌**(리터럴·활성 하드코딩·toHaveLength(12)·브랜드 테스트·CSS 매니페스트) — 파생값 전환으로 충돌면 제거. (A07-5)
- **[P2] 전투 시각 증거가 .gitignore 화이트리스트+git add -f 관행으로 조용히 유실** — 화이트리스트 추가 자체가 공유 .gitignore 충돌+순서 함정 실측 기록. (A07-6)
- **[P3] 래칫 기준선 JSON이 last-writer 병합으로 합친 직후 게이트가 깨진다** — 병합 후 단일 갱신 절차 명시. (A07-7)

### 3.11 테스트 전략 (DX)

- **[P2] 세션 write-back 16키 중 switches·variables·partyActorIds·messageWindowSettings는 경계 테스트 0** — 타이머 사건(2026-09-15) 유형의 결함이 setSwitch/setVariable에서 무감독. → 키 매트릭스 파라미터라이즈 계약 테스트. (D04-1)
- **[P2] battleOverhaulContracts.cases.ts(745줄)가 vitest include에 안 걸려** 유일 importer 소멸 시 계약 경고 없이 소멸 — @vitest-environment 헤더도 죽은 설정. (D04-2)
- **[P2] hitRate=0 계약이 공허 테스트**(존재 단언만, 본문이 스스로 「구조 검증으로 대체」자인) — hitRate 성공률 회귀가 나도 스위트 초록. (D04-3)
- **[P2] battleProject()/untilActorCommand()가 16+·6개 파일 복붙, 이미 40/200 두 변형으로 드리프트** — test/helpers/battleHarness.ts 추출. (D04-4)
- **[P2] 스킨×기능 커버리지가 사건 누적으로 편향** — 공용 DOM 기능은 스킨 1~2종, 일부 계약은 deprecated 스킨(ff·chrono)에 고정, 매트릭스 문서 부재. (D04-5)
- **[P2] 커맨드 패널 기하 계약이 `_접두` 진단 e2e에만 살아 기본 실행 제외**(runtime-battle.md:429가 이 파일을 정본으로 지명). (D04-6)
- **[P3] 활성 3종·12종 계약이 두 테스트에 중복 단언+deprecated 9종 3벌 하드코딩.** (D04-7)

---

## 4. 보류 (근거 있으나 도달성·확신 조건부)

| 항목 | 사유 |
|---|---|
| 포획 몬스터 즉시 커밋 vs 구슬 write-back 비대칭 (U06-4) | 도달 경로가 좁음(포그라운드 점유 조건) — conf 0.6 |
| 전투 중 이벤트 예외 시 sequenceBusy 래치로 틱 영구 정지 (U06-5) | 구조적 구멍은 확실하나 실저작 트리거 미확인 — conf 0.7 |
| glass 이름표 줄바꿈 메커니즘 일부(U08-6)·비유리 이름표 음절 개행(U08-4) | CSS 명세 판독 기반 [INFERENCE] 포함 — 브라우저 실측 후 확정 권고 |
| AUTO allEnemies 광역 가점·RM wait 접힘 수치론 (U12 일부) | 코드 도출은 정확하나 재현 시나리오 미작성 |
| D05-3 정규화 치환 중 SKY_PANORAMA 강제 교체 | 의도적 디자인일 가능성 — 소유자 확인 후 채택 여부 결정 |

## 5. 폐기 사례 (대표)

폐기 대부분은 **중복 병합**(§3에 흡수) 또는 **위키가 이미 계약으로 선언한 항목의 재확인**이다. 리뷰어들의 반박(refuted) 중 가치 있는 것:

- **코드가 위키를 지지하는 케이스 다수 확인** — 회복은 kind 판정 소비자 존재, 상태 도트 비치명 캡(`battleStates.ts:195-197`), cancel 잔여물 없음, canLose 커버 유지, rescheduleForSpeed 유효, AUTO 상성 반영, SE 디코드 캐시·AudioContext 단일화, target ordinal 별도 노드, revealAllResultRows 2단계, blocked 팝업 뮤트, miss 4채널 피드백, JS 시계가 CSS를 이기는 배속 계약 등. 이번 리뷰는 위 2026-09-14/15 계약의 **회귀를 발견하지 못했다** (이는 계약 품질의 긍정 신호).
- **의도된 계약으로 판명돼 폐기** — 09층 pointer-events swallow(pokemon만 재개, e2e 고정), `_battlers.css` :where 특정도 보존, qa:runtime 전용 캐시 분리(runtimeQaRun이 이미 빈 포트 스캔+전용 cacheDir), BATTLE_SKINS 레지스트리 불변성, vitest 파일 격리, wt create 포트 락.
- **렌즈 프리미스 교정** — `battleElementAdversarialFixes.test.ts`의 Element는 속성(원소)이지 DOM이 아님, 편집기 play 모드는 턴제 정규 검증면(무효는 액션만).

## 6. 권고 실행 순서

1. **규칙 무결성 3건**(동시전멸 승리 / m2 firstAlive / upsert_troop) — 데이터 오염·오발동이므로 최우선. 각각 회귀 테스트 선잠금.
2. **저작 파이프라인**(admission 존재 검사·m2-092 규약·m2 fields 스키마·포획 불변식) — AI 저작 품질의 상한을 결정.
3. **UX P1 4건**(AUTO 표시+repeat 가드 묶음 / 이벤트 로그 덮어쓰기 / 게이지 예고 / glass 배너 절단) — 수정량 대비 체감 최대.
4. **underfill+진형 소멸**(640×360·배율 fit) — 저작 프리셋이 공식 기능인 이상 정책 결정 필요(감독 판단 사항 포함).
5. **관측·AX**(포렌식 훅+receipt+CI qa:runtime:gate) — 이후 모든 전투 작업의 검증 비용을 낮추는 투자.
6. **성능 P1 2건** — 틱 스냅샷 게이트+스칼라 질의 API(3.7 void API 반환 설계와 같은 변경으로 처리 권장).
7. **문서 정정 일괄**(§3.9 전체) — 위키·주석 정정+감사 테스트 2종(battle.css 금지·경로 토큰 존재 검사).

---

*작성: 오케스트레이터(세션 모델 GLM 계열) · 리뷰어 30(U×13, D×9, A×8) · 검증 방법: 산출 전수 수집 후 교차 확인 + P1급 직접 코드 재확인(✅ 표기 12건)*
