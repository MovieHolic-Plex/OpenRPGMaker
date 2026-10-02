# 공용 전투 동작과 턴 전투 기믹 (2026-10-02)

캐릭터별 실행 차이(공용 136종, 11계열, 현재 장비/직업, 접촉점 실측)는
[캐릭터 전투 동작](character-battle-motion.md)을 함께 읽는다.

## 진입점

- `src/assets/battleMotionCatalog.ts`: 공용 연출 32개와 기본 스킬 32개. 새 프로젝트 기본 DB, 기존 프로젝트 `ensureRetroRosterRecords`, 공용 연출 목록이 함께 읽는다. 기존 같은 id의 저작 레코드는 덮지 않는다.
- `src/battle/battleMotionProgram.ts`: 저장 형식, 정규화, 가속·중력 곡선, 배우별 경로, 순수 좌표 평가. 기본 공격도 이 곡선으로 샘플링하며 잔상은 실제 이동 위치를 복사한다.
- `src/battle/retroChoreographyHandles.ts`: 기존 timeline에 이동 설계를 얹고 타격 시각·프로젝트 연출 속도 배율을 공유한다. 필드 생략 시 기존 객체와 박자를 유지한다.
- `src/player/retroSkillChoreography.ts`: 같은 평가기로 WAAPI 위치를 샘플링한다. 사용자·대상·동료·분신·소환을 구분한다. 히트스톱 시 포즈·이동·투사체·소리·제거 시계를 함께 멈춘다.
- `src/editor/panels/databaseSkillRetroStage.ts`, `databaseMonsterSkillStage.ts`: 사람/몬스터 미리보기. 기존 도트 연출 탭을 사용한다.
- `src/battle/battleGimmickRules.ts`, `src/battle/runtime.ts`: 전투별 유한 장부와 판정. 연출에서 피해를 계산하거나 HP를 수정하지 않는다.
- `src/editor/panels/databaseBattleMotionFields.ts`: 기존 도트 연출의 이동 편집, 스킬 전투 규칙의 기믹 편집.
- `src/editor/tools/retroChoreographyTools.ts`, `dbTools.ts`: 조수의 이동/규칙 저작. 지침은 `retroSkillMechanics.ts`의 공용 문자열.

## 저장과 호환

`SkillChoreographyRecord.movement`에는 pattern, 준비/이동/회수 ms, 높이 px, 정점 ms, 가속 강도를 저장한다.
선택적인 `tracks`는 최대 6배우, 배우별 48지점이다. role은 user/target/ally/cloneA/cloneB/summon,
지점은 `{at,anchor,x?,y?,curve?,pose?,alpha?,flip?}`. 시간 0~10000ms, 오프셋 ±1000px.
자리 home/front/target/target2/target3/ally/left/right/top은 실제 무대에서 측정한 좌표다.
flow는 단조 Hermite 접선으로 접촉을 통과할 때의 속도를 연결한다. 방향 전환 시 접선을 0으로 낮춘다.
준비·공격·회수 자세는 타격 시각에 잘라 바꾸고, 자세 사이를 보간하지 않는다.

`SkillRecord.battleGimmick`은 규칙 필드다. `pattern` 외의 선택 값:
`durationTurns`, `markKey`, `maxStacks`, `consumeMarks`, `requiredMark`, `followOnHit`,
`allyActorId`, `elementId`, `resourceId`, `radius`, `triggerChance`, `powerMultiplier`, `killRefundPercent`.
기존 hitSequence/HP 대가/상태/차지/콤보/범위 인프라를 함께 사용한다.
미지 pattern은 정규화에서 제거하고 숫자를 제한한다. 저장·불러오기·복제·내보내기·조수 도구가 같은 정규화를 쓴다.
공용 연출을 빌리는 것만으로 규칙이 변경되지는 않는다.

## 동작 목록

| 계열 | pattern |
|---|---|
| 기본 | stationary, walk, dash, jump, blink, fire |
| 특수 이동 | sky, through, clones, pull, freeze, counter |
| 기믹 | air-chase, throw, return-weapon, bounce, orbit, trap, mark, absorb, cover, swap, relay, summon, transform, charge, zone, sacrifice |
| 조합 | sky-crush, marked-spear, mirror-counter, blood-summon |

## 판정 계약

- 첫 명중이 필요한 후속 공격은 실제 결과가 실패하면 끊긴다. orbit은 같은 markKey의 표식이 있어야 한다.
- 표식은 명중에만 증가한다. 마지막 소비 타격은 기존 중첩에 비례해 증폭하고, 명중했을 때 표식을 지운다. 빗나가면 중첩을 보존한다.
- 설치는 즉시 피해를 주지 않는다. 대상의 다음 차례에 한 번 기폭/회피 판정하고 제거한다.
- 장판은 설치 좌표를 기억하고 대상의 자기 차례마다 반경 안에 있을 때만 피해를 준다.
- 지속 소환은 시전자의 다음 자기 차례마다 지원하고 기간 만료·주인 전투 불능·주인 피해에 제거된다.
- 반격 준비는 다음 물리 명중에 한 번 발동한다. 준비된 엄호는 다음 단일 물리 공격을 동료 대신 맞으며 한 번 반격한다. 기존 state_cover의 빈사 조건은 그대로다.
- 흡수는 마법 피해와 지정 속성이 맞을 때만 HP/MP 손실을 취소하고 저장한다. 저장 상한은 최대 HP의 2배. 다음 사용에 저장량을 방출한다. 재반사/재반격 루프를 만들지 않는다.
- swap은 예비 배우를 기존 `switchActiveActor` 경로로 실제 교대한다. relay는 동료 준비·행동 가능·MP를 확인하며 동료 차례/자원을 소비한다. 이미 native combo를 쓰면 중복 지불하지 않는다.
- HP 대가는 기존 비용 경로에서 한 번 낸다. 실제 처치에만 환급하며 빗나감에는 환급하지 않는다.
- 차지는 기존 자기 차례 지연을 사용한다. 준비 중 피해 1.25배. 변신은 전투 장부의 그림/공격 배율이며 종료 후 원본으로 돌아온다.
- 장부는 전투당 128개로 제한한다. periodic 피해는 별도 actionId와 실제 timeline facts를 기록한다. 캔슬 시 장부, 재생 타이머, WAAPI와 임시 노드를 정리한다.

## 편집

「도트 연출」에서 공용 `chor_builtin_*` 선택 → 복제해서 고치기 → 「이동·가속도·배우」.
배우별 경로 편집 버튼은 현재 기본 경로를 지점 목록으로 펼친다. UI 수정은 이력 스냅숏/스토어 경로를 거친다.
스킬의 「전투 규칙」에서 실제 기믹을 고르고, 연출 선택으로 해당 안무를 붙인다.
미리보기의 명중/빗나감/조건 불충족 선택은 표시만 바꾸고 프로젝트 규칙을 실행하지 않는다.

## 확인 근거

- `verify-shots/battle-motion/rules-audit.json`: 브라우저에서 실제 엔진 32종 × 명중/빗나감, 저장 재로드, 반격·흡수 속성 일치/불일치·3갈래 방출·표식 요구·기폭/회피·지원 지속/해제·처치 환급·엄호 분기.
- `verify-shots/battle-motion/multihit/SUMMARY.md`: 다단 접촉 수 보정 뒤 10종 재녹화. 기본 timeline의 `hitCount`를 이동 손잡이가 읽어 반복 FX의 접촉을 별도 시각으로 만든다.
- `verify-shots/battle-motion/player-final/SUMMARY.md`: `player.html` 출하 shim 경로 32종 녹화. 조건에 따라 준비/취소 장면도 포함한다.
- `verify-shots/battle-motion/swap/SUMMARY.md`: 활성 2자리+예비 배우가 있는 실제 교대 녹화.
- `verify-shots/battle-motion/editor-audit.json`: 실제 편집기 공용 복제, 숫자/직접 경로 편집, JSON 정규화 재로드, AI 도구 수정.
- `verify-shots/battle-motion/SUMMARY.md`: 전체 확인 범위·결과와 한계, 실제 플레이어 GIF 축소 사본.
- 이 작업은 엔진/편집기/공용 번들 코드다. QA 사본과 freshProject는 정본 저장 근거가 아니다. 사용자 SQLite 프로젝트를 수정하지 않았다.
- gates/vitest/전체 typecheck는 세션 hard rule에 따라 실행하지 않았다. 해당 변경 진입점의 번들 컴파일과 브라우저 확인만 했다.

## 동작의 적대적 검토 (2026-10-02)

기존 녹화의 FX 존재/유한 좌표/피해 판정 통과는 동작 품질의 근거가 아니었다. 검토에서 다음 결함을 수정했다.

- 정면(`front`) 칸으로 돌진하고, 공격 칸을 유지한 채 뒤로 미끄러져 돌아갔다. 접근은 이동 칸, 접촉은 windup→strike→follow, 복귀는 짧은 후방 도약→착지→대기로 나눈다. 보행은 경로 시계에서 85ms 간격으로 walk_a/b/c/b를 고르며, 복귀할 때 진행 방향으로 돌아선다.
- 점프 정점에 이미 목표 X에 도착해 수직 낙하했다. `midpoint`를 경유하며 rise/fall은 높이에만 중력 곡선을 적용하고 가로 속도는 이어 간다. 기본 도약 420ms, 화면 밖 강하 640ms, 보행 520ms. `apexMs`를 명시한 저작 경로는 정점 정지를 유지하며 공용 기본은 0이다.
- 공중 추격의 공격자/대상 높이와 접촉 시각을 맞춘다. 압살의 부수 피해가 주 대상의 착지를 늦추지 않도록 `MotionContext.primaryContacts`를 전달한다. 던지기는 첫 명중 전 대상이 움직이지 않는다. 분신은 실제 홀수/짝수 타격을 나눠 맡는다.
- 대상 FX가 옛 지면 자리에 남았다. 플레이어는 몸 위치를 같은 pauseable clock으로 16ms마다 따라가며, 사람/몬스터 편집기 미리보기도 이동 대상 좌표를 쓴다. 피격 포즈는 데이터 속성만 쓰지 않고 실제 paint를 호출한다.
- 반복 FX가 옛 flurry의 90ms 간격에 남아 몸동작을 가렸다. 연출 손잡이가 각 접촉에 FX를 붙이고 재생 길이를 줄여 연타를 구분한다.
- 프로그램 시작 때 앵커를 한 번 측정한다. 이동 중 투사체가 출발해도 앵커를 다시 측정하지 않는다. 주 대상을 제외한 적을 target2/target3로 선택한다.
- 파생 자리 `midpoint/aboveHome/behind/exit/caught/knockback/throwMidpoint`는 실제 홈·대상의 방향으로 계산한다. 뒤잡기, 관통, 귀환 투사체, 던지기에 고정 왼쪽 좌표를 쓰지 않는다. 경로 펼치기/정규화/UI/AI 도구가 같은 자리 이름을 지원한다.
- 최대 16회 연타를 펼쳐도 48지점 제한 안에서 복귀를 유지한다. 중간 연타는 strike→windup, 마지막 타격에 follow를 둔다.

전용 검토: `node scripts/qa/runtime/battle-motion-adversarial.mjs`. 32종 × 명중/빗나감 × 1/3/16 접촉에서 좌우 반전, 접촉 전 대상 정지, 접촉 높이, 종료 위치, 정규화 후 경로 보존을 확인한다. 결과는 `verify-shots/battle-motion/adversarial/trajectory-review.json`. 샘플 수는 시각적 완성도 점수가 아니다.
실제 플레이어의 고속 연속 캡처는 `retro2003-skills-gif.mjs --set motion --fps 20 --impact-audit`를 사용한다.
공용 스킬은 스킬 id와 연출 id가 다르므로 히트스톱 관측은 `retroChoreographyId`도 대조한다.

### 히트스톱 뒤 위치/자세 시계가 벌어지는 결함

12종 기능 녹화는 통과했지만 접촉 프레임을 열자 압살의 3번째 타격 자세가 나온 뒤에도 몸은 공중에 남았다.
타이머는 다음 접촉 260ms를 지켰지만 WAAPI의 자체 재개 시각이 반복 정지마다 늦어졌다(그 녹화에서 위치 시각 약 600→800→1017ms).
`BattlePlaybackClock.trackAnimation`은 WAAPI를 정지된 샘플러로 두고 위치 `currentTime`을 같은 `elapsedMs`로 구동한다.
히트스톱 진입과 자세 콜백 직전에 위치를 동기화하며, 재개는 별도 WAAPI play를 호출하지 않는다. 종료 시 rAF와 소유 애니메이션을 취소한다.
`battle-motion-clock-review.mjs`는 실제 브라우저에서 4회 정지/재개, 메인 스레드 지연, 양쪽 배우 시각, 자세 콜백, 종료 정리를 확인한다.
기존 자유 재생 CSS/통상 공격의 pause/play 경로는 유지한다. `trackAnimation`에 등록한 프로그램 배우/투사체만 공통 시계를 사용한다.
순간이동은 프로그램이 있을 때 기존 `measurePlaces(...behind)`를 끄며, 새 `behind` 앵커에서 한 번만 등 뒤를 계산한다.

몬스터 포즈 매핑도 함께 수정했다: hit/guard_hit→hit, attack_follow/evade→recover, dead/dying→dead. 타격받은 대상이 회수 칸으로 나오거나 후속 자세가 다시 공격 칸이 되는 결함을 막는다.

## 결과 선택은 재생 분기다 (2026-10-02 정정)

기존 미리보기의 `조건 불충족`은 `triggered:false`만 전달했다. 이 값은 부수 기믹의 발동 여부이고, 일반 점프/돌진을 취소하지 않는다. UI 선택을 이제 **명중 / 빗나감 / 발동불가**로 정의한다.

- `battleMotionPreview.ts`의 `buildBattleMotionPreview`를 사람/몬스터 편집기와 대화 미리보기가 함께 쓴다. 원본 스킬에 명중 후속 조건이 있으면 빗나감 때 기본 타임라인의 요청 타수부터 1로 줄인다.
- `MotionContext.actionBlocked`는 행동 자체가 시작하지 못한 경우다. 사용자 대기 경로만 남기고 이동·타격·이펙트·소리 사건을 모두 비운다. `triggered:false`(반격 대기 등)와 혼동하지 않는다.
- 빗나감은 공격 시도를 유지한다. 타격 시각 마커는 실제 플레이어의 순서 계산에 필요하므로 지우지 않고 `RetroTimelineEvent.hit.landed=false`를 붙인다. `retroTimelineStateAt`은 이 마커로 피격을 그리지 않는다. 대상 타격 시트, 명중용 흔들림/번쩍임은 제거하고 사용자 시전/투사체는 유지한다.
- 런타임은 `contactHits`로 실제 결과를 타격별로 전달한다. 명중→실패→명중을 첫 타격의 결과 하나로 덮지 않는다. 기본 flurry의 4타가 요청한 3타보다 많을 때도 접촉 수와 반복 시트를 줄여 가짜 4번째 명중을 막는다.
- 강화/준비 스킬의 미리보기에는 명중 대신 `발동`을 표시하고 의미 없는 `빗나감` 선택을 끈다. 준비 사건은 대상 피해 반응을 만들지 않는다.
- 결과를 고르면 재생을 멈추고 대표 순간을 즉시 표시한다. 이후 재생 버튼을 누르면 처음부터 재생한다.

확인: `scripts/qa/runtime/battle-motion-outcomes.mjs` (32종 × 사람/몬스터, 취소 전체 구간 제자리·미명중 FX 없음·후속 취소·혼합 결과), `battle-motion-outcomes-editor.mjs` (실제 자료집의 세 결과 화면), `verify-shots/battle-motion/outcomes/`. gates/vitest/전체 typecheck는 실행하지 않았다.
