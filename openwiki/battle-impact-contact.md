# 측면 전투의 충돌·정지·반동 (2026-10-02)

사용자 피드백: 「타격감이 없다. 다른 게임을 공부해서 수정」, 이어서 「아직 RM2000 식의 전투 스킬 아니냐」.
대상 위 효과만 잘라 비교하면 측면 전투의 캐릭터 동작을 평가할 수 없다. 이번 증거는 **실제 player.html의 전체 전투**다.
스킨은 `retro2003`, 배우가 걸어가서 베고 돌아온다. 게임 규칙·피해량·저장 스키마는 바꾸지 않는다.

## 참고한 개발자의 설명

- [Aztez — Anatomy Of A Successful Attack](https://aztez.com/blog/2014/01/06/anatomy-of-a-successful-attack/):
  준비와 후속 동작, 빠른 공격, 과장된 피격, 충돌 효과, 양쪽 애니메이션의 짧은 정지, 저음이 있는 소리를 함께 다듬는다.
- [Skullgirls — Mariel Cartwright / Lab Zero Games 강연](https://www.gdcvault.com/play/1021657/Powerful-and-Effective-Animation-for):
  핵심 포즈·예비동작·잔상·타이밍을 게임플레이 제약 안에서 설계한다. 열람한 공개 세션 설명을 근거로 했으며,
  유료 강연 전체를 시청했다고 주장하지 않는다.

외부 게임의 그림·소리를 복사하지 않는다. 새 충돌 그림은 `battleImpactDom.drawContact`의 직접 작성한 픽셀 드로잉이다.

## 실측과 원인

- 기존 `battle-hit-stop`은 CSS `animation-play-state`만 바꿨다. 도트 계약의 포즈·효과 칸·소리·정리 타이머는
  `setTimeout`으로 계속 진행했고 `Element.animate` 이동도 멈추지 않았다.
- `27-retro-motion.css`의 높은 특정도와 animation 단축 선언이 `22-hit-feel.css`의 정지 선언을 덮었다.
- 대상 레이어의 소리가 조용한 시작 칸에서 울고 실제 hit는 레이어 길이의 25% 뒤에 왔다(8~10칸 ×60ms →120~150ms).
- dash-strike의 공격 포즈는 260/310ms, 십자베기의 첫 hit는 425ms였다. 검을 내린 뒤 피해가 뜨는 간격이었다.
- 비교 GIF에서 화면 자체의 두 CSS 애니메이션을 배우 이동으로 잘못 집계한 QA 오류도 수정했다.
  화면 흔들림은 계속 움직여야 한다. 검수 선택자는 `.battle-actor/.battle-enemy[data-retro-class-skill]`로 한정한다.

## 구현 소유와 계약

| 소유 | 파일 / 동작 |
|---|---|
| 멈추는 표시 시계 | `src/player/battlePlaybackClock.ts`: 남은 지연을 보존해 pause/resume, dispose 후 발화 없음. 게임 시간과 별개 |
| 전투 타이머 취소 | `battleTimerScope.cancelBattleTimer`: 타임아웃과 씬의 소유 목록을 함께 정리 |
| 도트 스킬 재생 | `retroSkillChoreography.ts`: 포즈·FX 칸·소환·소리·제거를 같은 시계에 묶고 WAAPI/CSS 전환도 멈춤 |
| 시퀀서와 시간 맞춤 | `battleSequencer.ts`: 실제 행동 weight를 시간 훅에 전달. recover에서 정지 시간을 빼지 않음 |
| 충돌 순간 | `battleImpactDom.ts`: 64px binary-alpha Canvas를 128px(정수 2배)로 표시, 순간 다이아몬드/파편과 안쪽 스프라이트 반동 |
| 정지와 숫자 | `styles/runtime/battle/29-impact-contact.css`: 도트/오라 뒤에 로드. 정지 중 CSS animation/transition 중단, 피해 숫자는 즉시 찍고 정착 |
| 캐릭터와 효과음 | `battle/retroSkillTimeline.ts`: dash-strike 검 포즈를 첫 hit에 맞춤. 대상 피해 소리는 hit 시각, 회복 소리는 레이어 시작. 일반 cast 준비 680→480ms |

- 정지 길이는 기존 시퀀서 110ms × weight ÷ 배속이다. 급소 heavy는 209ms, 1.8배속 급소는 약116ms다.
- 표시 시계와 시퀀서가 시작하는 수 ms 차이 때문에 정지 진입 시 16ms 안쪽의 예정된 접촉 콜백을 먼저 전달한다.
  따라서 충돌 소리를 110ms 뒤 정지 해제까지 밀지 않는다. 그 뒤 포즈·효과 칸·예약 콜백은 멈춘다.
- `onDamageFeedback`은 실제 양수 피해에만 새 충돌/화면 피드백을 건다. 회복·빗나감·막힌 0 피해는 대상의 기존 동작을 사용한다.
  계약의 `playHit`도 해당 대상의 실제 damage 결과를 확인해 빗나간 몸을 흰색으로 칠하지 않는다.
- 무대의 흔들림·카메라 반응과 피해 숫자는 계속 움직인다. 스킬 본체와 맞은 몸이 멈춘다는 계약이다.
- `calm`과 reduced-motion에서는 새 충돌 그림/반동을 생성하지 않는다. `calm`은 WAAPI로 만든 스킬 shake/flash도 막는다.
  `light`에는 새 픽셀 충돌을 덧붙이지 않는다. 타이머 정지의 오류 수정은 도트 스킨 공통이다.
- `destroy()`는 스킬 시계·WAAPI·접촉 시계·Canvas를 정리한다. 픽셀 상대 방향(기존 transform)을 덮지 않도록
  반동은 안쪽 sprite의 독립 translate/scale에 건다.

## 검증·재현

`verify-shots/battle-impact/README.md`와 각 녹화의 `SUMMARY.md`를 먼저 읽는다.
화면은 편집기 play가 아닌 `player.html + exportProjectStoreShim`. 녹화 fixture만 변경하며 SQLite/원격 프로젝트에 쓰지 않는다.

```sh
node scripts/qa/runtime/retro2003-skills-gif.mjs --set class --skills hero_cross_slash,mage_fireball,mage_chain_lightning,cleric_heal_light --fps 30 --impact-audit --out output/battle-impact/verified
node scripts/qa/runtime/retro2003-skills-gif.mjs --set class --skills hero_cross_slash --variant critical --speed 1.8 --fps 30 --impact-audit --out output/battle-impact/critical-fast
node scripts/qa/runtime/retro2003-skills-gif.mjs --set class --skills hero_cross_slash --variant miss --feel calm --fps 30 --impact-audit --out output/battle-impact/miss-calm
```

`--impact-audit`는 rAF로 정지 중 FX 칸·시전자 포즈·WAAPI/CSS 상태, 실제 AudioBufferSource 시작,
픽셀 접촉 그림, 행동 뒤 잔여 FX를 관측한다. 같은 정지 안에서 FX/포즈가 변하거나 몸의 애니메이션이 running이면 실패다.
1.8배속은 실제 Shift 입력으로 설정한다. critical/miss는 녹화 사본의 해당 스킬 확률만 바꾼다.
GIF는 무음이다. 효과음의 실제 발화 시각은 report의 `audioStarts`에 남지만 청취 품질을 대신하지 않는다.

회귀 계약: `test/battlePlaybackClock.test.ts`, `test/battleImpactTimeline.test.ts`.
세션 AGENTS 규칙에 따라 로컬 vitest·전체 typecheck·gates는 실행하지 않았다.
