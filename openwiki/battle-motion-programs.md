# 공용 전투 동작과 턴 전투 기믹 (2026-10-02)

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
