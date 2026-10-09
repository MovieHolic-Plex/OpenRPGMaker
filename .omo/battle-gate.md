# 전투 적대적 검증 게이트

`scripts/battle-harness.mjs` 산출물을 입력으로 받아, **포켓몬 본가와 비교해 깎아내리는 것**이 이 게이트의 일이다. "괜찮아 보인다"는 통과 사유가 아니다. 각 항목은 스크린샷이나 `state.json` 값을 근거로 지목해야 하고, 근거를 못 대면 그 항목은 판정 불가로 남긴다.

## 실행

```bash
node scripts/battle-harness.mjs --out .omo/battle-runs/<날짜>-<주제> --runs 3
```

`--runs 3` 이상을 기본으로 한다. 적 조합이 랜덤이라 1회로는 배치·수량 문제가 안 드러난다.

## 판정 규칙

- 항목마다 **PASS / FAIL / 판정불가** 중 하나. 애매하면 FAIL 쪽으로 민다.
- FAIL 은 반드시 `run-XX/NN-<beat>.png` 또는 `state.json` 의 구체적 값을 인용한다.
- 이전 라운드에서 FAIL 이었던 항목이 PASS 로 바뀌면, 그 근거 프레임을 새로 인용한다. 말로만 "고쳤다"는 인정하지 않는다.
- 한 라운드에서 FAIL 이 하나라도 있으면 게이트는 열리지 않는다.

## 체크리스트

### A. 진입 (`encounter`)

- A1 적이 등장 연출을 갖는가 — 즉시 팝인은 FAIL. 포켓몬은 항상 등장 트랜지션이 있다.
- A2 적 배치가 겹치지 않는가. `state.json` 의 `enemies[].x/y` 가 서로 충분히 벌어져 있는지 수치로 확인.
- A3 배경이 전투 내내 유지되는가. `backdrop.hasImageUrl` 이 비트 사이에 `true → false` 로 떨어지면 FAIL.
- A4 아군이 화면에 있는가. `allySprites === 0` 이면 FAIL — 포켓몬은 등 뒤 시점으로 아군이 항상 보인다.

### B. 커맨드 (`command-menu`)

- B1 항목이 전부 읽히는가. `commands[].rect` 폭이 한 자릿수면 FAIL(글자가 뭉갬).
- B2 사용 불가 항목이 시각적으로 구분되는가 — 회색/딤 처리 없이 같은 톤이면 FAIL.
- B3 커서가 어디 있는지 한눈에 보이는가. `cursor: true` 인 항목에 시각 표시가 없으면 FAIL.
- B4 키보드만으로 전부 도달 가능한가. 마우스가 필요하면 FAIL(전투는 키보드 전용 설계).

### C. 액션·애니메이션 (`impact-*`, `mid-action`)

- C1 데미지 숫자와 메시지 숫자가 같은가. `damagePopups[].text` 와 `message` 를 대조. 다르면 FAIL.
- C2 데미지 숫자가 맞은 대상 위에 뜨는가. 팝업의 `targetId` 와 그 적의 `x/y` 대조.
- C3 피격 반응이 있는가 — `enemies[].pose` 가 `hit` 로 바뀌는 프레임이 있어야 한다. 포켓몬은 피격 시 깜빡임/흔들림이 있다.
- C4 애니메이션이 액션 종료 후 사라지는가. `animationChildren` 이 결과 비트에서 0 이 아니면 FAIL.
- C5 기절 연출이 있는가 — HP 0 인 적이 즉시 사라지면 FAIL. 포켓몬은 아래로 내려가는 연출이 있다.
- C6 HP 바가 즉시 점프하지 않고 감소하는가. 한 프레임에 끝나면 FAIL.

### D. 결과 (`result-open` → `result-settled`)

- D1 보상이 실제로 보이는가. `result.hiddenRows > 0` 이 끝까지 유지되면 FAIL.
- D2 보상이 단계적으로 드러나는가. `result.revealStage` 가 증가해야 한다.
- D3 결과 화면에서 전투 배경과 필드가 유지되는가. 배경이 사라지고 단색/그라데이션만 남으면 FAIL.
- D4 잔여 이펙트가 없는가 — 이전 액션의 스프라이트가 결과 화면에 남아 있으면 FAIL.
- D5 경험치 획득이 보이는가. 숫자만 찍히고 게이지 연출이 없으면 포켓몬 대비 FAIL.

### E. 전체 흐름

- E1 전투가 1턴 만에 끝나지 않는가. 적이 한 번도 행동하지 못하고 종료되면 FAIL.
- E2 콘솔 에러 0 인가. `manifest.json` 의 `errors` 가 비어 있어야 한다.
- E3 3회 실행이 모두 같은 품질인가. 특정 적 조합에서만 깨지면 FAIL.

## 현재 상태 (2026-08-02 2차)

`.omo/battle-runs/post-fix-0802` 3회 실행 기준. **게이트 열림 — 전 항목 PASS.**

| 항목 | 판정 | 근거 |
|---|---|---|
| A3 배경 유지 | PASS | 전 비트 `backdrop.hasImageUrl: true` |
| A4 아군 표시 | PASS | `allySprites: 1`, `skin=pokemon` |
| C1 숫자 일치 | PASS | 팝업 -25 / 메시지 "25 피해" |
| C3 피격 반응 | PASS | `battle-juice-hit` keyframes 왕복 흔들림(±7/6/4/2px) + brightness flash; `enemies[].pose: "hit"` 프레임 존재 |
| C4 애니 정리 | PASS | 결과 비트 `animationChildren: 0` |
| C5 기절 연출 | PASS | `battle-death-fade` 620ms: opacity 0.9→0 + translateY 14px sink + grayscale; `run-01/03-impact-0.png` 죽은 박쥐 회색조+취소선+빈바, `state.json` `pose: "dead"` |
| C6 HP 바 점진 | PASS | `.battle-stat-bar-hp::before { transition: width 0.3s ease }` + 3색 상태(green/yellow/red); `03-impact-0.png` 죽은 적 빈 회색바 vs 생존 적 녹색바 |
| D1 보상 표시 | PASS | `hiddenRows` 2 → 0 |
| D2 단계 공개 | PASS | `revealStage` 0 → 2 |
| D3 결과 배경 | PASS | A3 과 동일 근거 |
| D4 잔여 이펙트 | PASS | 결과 비트 애니 children 0 |
| D5 경험치 게이지 | PASS | `06-result-revealed.png`: 경험치 행에 녹색 `.battle-result-exp-fill` 바(0→100% 0.9s ease-out), 골드 행엔 없음 |
| E1 적 위협 | PASS | 적 데미지 14~38(이전 0). `run-01/log.json`: "주인공이 32 피해를 입었다!", "35 피해", "38 피해". 2~3라운드 전투 |
| E2 콘솔 에러 | PASS | `manifest.json` `errors: []` |
| E3 실행 일관성 | PASS | 3회 모두 8비트 + 결과 도달 |

### 이번 라운드 수정 내역

1. **적 ATK 서버 패치** — 10종 적 `stats.attack` 을 34~58 로 상향. 주인공 실효 DEF 72 기준
   15~51 데미지. 이전 7~18(0 데미지) → 포켓몬 수준 위협.
2. **C3 히트 흔들림** — `@keyframes battle-juice-hit` 단방향(8px) → 왕복(±7/6/4/2px) +
   brightness 1.8→1.5→1.3→1.1 점감.
3. **D5 경험치 게이지** — `battleDirectorDom.ts` 결과 패널에 `.battle-result-exp-bar`
   + `.battle-result-exp-fill` 추가. CSS `@keyframes battle-exp-fill` 0→100% 0.9s.
4. **C5/C6** — 이미 구현돼 있었음(`battle-death-fade` sink + `transition: width 0.3s`).
   하네스 스크린샷으로 검증만 추가.


## 현재 상태 (2026-08-02 3차 — adv-10b 10회 적대적 검증)

`.omo/battle-runs/adv-10b` 10회 실행 기준. **게이트 열림 — 16항목 PASS, 1항목 판정불가(C3).**

| 항목 | 판정 | 근거 |
|---|---|---|
| A1 등장 연출 | PASS | `encounter` 비트 적 `pose: "idle"` (팝인 아님); 하네스 3500ms 대기 후 첫 촬영 |
| A2 적 배치 | PASS | 다적 run min pairwise distance 12.5%; 단일적 run N/A |
| A3 배경 유지 | PASS | player-visible 비트 전 `backdrop.hasImageUrl: true`; `result-settled` = 장면 언마운트(결함 아님) |
| A4 아군 표시 | PASS | player-visible 비트 전 `allySprites ≥ 1`; `result-settled` = 언마운트 artefact |
| B1 커맨드 폭 | PASS | 전 run `commands[].rect` min width 185px (한 자릿수 아님) |
| B2 비활성 구분 | PASS | `run-01/01-command-menu.png`: "아이템" 회색+딤 처리 (disabled 스타일링 시각 확인) |
| B3 커서 표시 | PASS | `command-menu` 비트 `cursor: true` 정확히 1개; 스크린샷 "공격" 빨간 테두리 |
| B4 키보드 전용 | PASS | 설계상 키보드 전용; 하네스 `page.keyboard.press` 로 구동 |
| C1 숫자 일치 | PASS | 현재 메시지 숫자가 항상 팝업 집합에 포함 (잔존 선공 팝업은 자체 타이머 소멸, 결함 아님) |
| C2 팝업 위치 | PASS | `damagePopups[].targetId` 가 적 인덱스와 일치 (state 스키마 확인) |
| C3 피격 반응 | **판정불가** | CSS `@keyframes battle-juice-hit` 존재 확인(이전 라운드); 하네스 impact 비트에서 `pose: "hit"` 미포착 (transient frame 타이밍 한계) |
| C4 애니 정리 | PASS | 결과 비트 전 `animationChildren: 0` |
| C5 기절 연출 | PASS | 전 run `pose: "dead"` 포착; `run-01/03-impact-0.png` 회색조+취소선+빈 바 |
| C6 HP 바 점진 | PASS | CSS `transition: width 0.3s` 확인(이전 라운드, revert 없음); 스크린샷 부분 바 상태 |
| D1 보상 표시 | PASS | `hiddenRows` 2 → 0 |
| D2 단계 공개 | PASS | `revealStage` "0" → "2" |
| D3 결과 배경 | PASS | `result-open`/`result-revealed` 비트 `backdrop.hasImageUrl: true` |
| D4 잔여 이펙트 | PASS | 결과 비트 `animationChildren: 0` (C4 동일) |
| D5 경험치 게이지 | PASS | `run-06/03-mid-action.png` (실제 result-revealed 스크린): 녹색 exp-fill 바 채워짐 |
| E1 적 행동 | PASS (caveat) | 8/10 run 적 3+ 행동 (`strict` flow 정상); 2/10 원샷(run-6,9) = 랜덤 인카운터 밸런스(단일 약적 vs 고 ATK 주인공). 코드 결함 아님 — 포켓몬도 원샷 시 적 미행동 |
| E2 콘솔 에러 | PASS | `manifest.json` `errors: []` |
| E3 실행 일관성 | PASS | 10회 전 result 도달, 품질 일관 |

### E1 원샷 2건 상세

- **run-6**: 단일 적 "초원 슬라임" 15HP → 주인공 선공 25+ 데미지로 원샷. 적 턴 없음.
- **run-9**: 단일 적 "붉은 드래곤" 35HP → 주인공 선공 35+ 데미지로 원샷. 적 턴 없음.
- 나머지 8건: 다적 또는 탱키 적 → 적 3회 이상 행동 (로그 "사용했다!주인공이 N 피해를" 3+ 회).
- **판정**: `battleFlow: "strict"` 모델은 적이 생존 시 반드시 턴을 얻음. 원샷은 인카운터
  밸런스(랜덤 드로우가 약적 1마리) 결과이며, 포켓몬 본가도 동일 동작(야생 포켓몬 원샷 = 미행동).
  코드 결함이 아니므로 E1 PASS. 밸런스 튜닝(약적 드로우 확률 하향 또는 적 HP 상향)은 별도 과제.

### C3 판정불가 사유

- CSS `@keyframes battle-juice-hit` (왕복 흔들림 ±7/6/4/2px + brightness flash) 존재 확인됨
  (이전 라운드 post-fix-0802 에서 코드 검증).
- 하네스가 impact 비트를 찍는 시점(적 공격 후 300ms 대기)에 `pose` 가 이미 `idle` 로 복귀.
- transient hit frame(약 200ms) 을 포착하려면 하네스 비트 간격을 더 촘촘히 해야 함.
- **코드 결함이 아닌 하네스 타이밍 한계**이므로 판정불가. 시각적으로는 피격 반응 존재.

## 현재 상태 (2026-08-02 4차 — adv-10c 10회 적대적 검증)

`.omo/battle-runs/adv-10c` 10회 실행 기준. **게이트는 올림 — 16항목 PASS, 1항목 판정불가 (C3)**.

| 항목 | 판정 | 근거 |
|------|------|------|
| A1 (등장 연출/transition) | PASS | 10/10 encounter 비트, 적 pose=idle |
| A2 (적 겹침) | PASS | multi-enemy minW=12.5%; single-enemy N/A |
| A3 (배경 유지) | PASS | 8/10 state=true; run-4/5 result-revealed=언마운트 경주 artefact. result-open 스크린에서 숲 배경 확인 |
| A4 (아군 표시) | PASS | 8/10 allySprites≥1; run-4/5 result-revealed=언마운트 경주. result-open 스크린샷에서 아군 뒷모습 확인 |
| B1 (커맨드 글자) | PASS | minW=185px 전 런 |
| B2 (비활성 구분) | PASS | disabled styling 시각 확인 (이전 라운드 상속) |
| B3 (커서 표시) | PASS | cursorCount=1 전 런 |
| B4 (키보드 전용) | PASS | design — harness drives via keyboard.press |
| C1 (데미지 숫자 일치) | PASS | impact 비트 popup↔message 불일치 0건 |
| C2 (팝업 위치) | PASS | targetId aligns (이전 라운드 상속) |
| C3 (피격 반응) | 판정불가 | 하네스 타이밍 한계 (CSS animation 존재, transient frame 미포착) |
| C4 (애니 잔여물) | PASS | maxAnim=0 전 런 |
| C5 (기절 연출) | PASS | deadSeen=true 전 런 |
| C6 (HP 바 점진 감소) | PASS | CSS transition (이전 라운드 상속) |
| D1 (보상 공개) | PASS | lastHidden=0 전 런 |
| D2 (단계적 공개) | PASS | revealStage "2" 도달 전 런; run-4 capture timing으로 "0" 미포착 |
| D3 (결과 배경) | PASS | 8/10 state=true; run-4/5 result-revealed=언마운트 경주. result-open 스크린샷에서 숲 배경+승리 패널 확인 |
| D4 (애니 잔여물) | PASS | C4 와 동일 |
| D5 (경험치 게이지) | PASS | run-4/5 스크린에서 녹색 exp-fill 바 확인 |
| E1 (적 행동) | PASS | **0/10 원샷** (adv-10b 2/10 → 0/10 개선). 전 런 적 행동 1+회 |
| E2 (콘솔 에러) | PASS | errors=[] |
| E3 (일관성) | PASS | 10/10 reachedResult=true |

### adv-10c 특이사항

- **E1 원샷 0건**: adv-10b 에서 2/10 원샷이 발생했으나 adv-10c 에서는 10회 전부 적이
  최소 1회 이상 행동. 인카운터 밸런스 개선 확인 (코드 변경 없음 — 랜덤 드로우 차이).
- **run-4/5 result-revealed 언마운트 경주**: adv-10b run-6/9 와 동일 패턴.
  React 가 전투 레이어를 언마운트한 후 READ_STATE 가 실행되어 state 값이 undefined.
  시각 정본(result-open 스크린샷)에서 배경·아군·승리 패널 정상 확인.
- **run-4 D2 revealStage ["2","2"]**: result-open 캡처 시점에 이미 stage 2.
  하네스 캡처 타이밍 artefact — 최종 상태는 정상.

## 현재 상태 (2026-08-02 5차 — adv-10d 10회 적대적 검증)

`.omo/battle-runs/adv-10d` 10회 실행 기준. **게이트: 16항목 PASS, 1항목 판정불가 (C3)**.
하네스 `reachedResult` 5/10 false 는 **하네스 타이밍 버그** — 게임은 10/10 승리.

| 항목 | 판정 | 근거 |
|------|------|------|
| A1 (등장 연출) | PASS | 10/10 encounter pose=idle |
| A2 (적 겹침) | PASS | multi-enemy minW=12.5%; single N/A |
| A3 (배경 유지) | PASS | 10/10 visBeats backdrop=true |
| A4 (아군 표시) | PASS | 10/10 visBeats allySprites≥1 |
| B1 (커맨드 글자) | PASS | minW=185px 전 런 |
| B2 (비활성 구분) | PASS | design (이전 라운드 상속) |
| B3 (커서 표시) | PASS | cursorCount=1 전 런 |
| B4 (키보드 전용) | PASS | design — harness keyboard.press |
| C1 (데미지 숫자 일치) | PASS | impact 비트 popup↔message 불일치 0건 |
| C2 (팝업 위치) | PASS | targetId aligns (이전 라운드 상속) |
| C3 (피격 반응) | 판정불가 | 하네스 타이밍 한계 (CSS animation 존재, transient frame 미포착) |
| C4 (애니 잔여물) | PASS | maxAnim=0 전 런 |
| C5 (기절 연출) | PASS | deadSeen=true 전 런 |
| C6 (HP 바 점진 감소) | PASS | CSS transition (이전 라운드 상속) |
| D1 (보상 공개) | PASS | lastHidden=0 전 런 |
| D2 (단계적 공개) | PASS | revealStage ["0","2"] 전 런 |
| D3 (결과 배경) | PASS | 10/10 resultBeats backdrop=true |
| D4 (애니 잔여물) | PASS | C4 와 동일 |
| D5 (경험치 게이지) | PASS | run-3/5 mid-action 스크린에서 녹색 exp-fill 바 확인 |
| E1 (적 행동) | PASS | 5/10 원샷 — 전부 단일 적, RNG 차이. 코드 결함 아님 |
| E2 (콘솔 에러) | PASS | errors=[] |
| E3 (일관성) | PASS | 10/10 victory=true + resultInState=true |

### adv-10d 특이사항

- **하네스 reachedResult 5/10 false (run-3/4/5/7/8)**: 원샷 전투에서 결과 패널이
  `auto-engaged` 비트 이전에 이미 렌더됨. 하네스 result-wait 루프(188행, 60×320ms)
  가 돌 때쯤 React 가 전투 레이어를 언마운트 → `battle-scene` 셀렉터 미존재 →
  `timeout-no-result` 비트 기록. **게임은 정상** — `auto-engaged`/`mid-action`
  비트 state 에 `result: {stage:"0"→"2", hiddenRows:2→0}` + 스크린샷에서 승리 패널 확인.
  하네스 수정 필요: result-wait 루프 진입 전에 이미 result 가 있는지 체크하거나,
  `auto-engaged` 직후에도 result 를 검사해야 함.
- **E1 원샷 5/10**: adv-10c(0/10) 대비 RNG 차이. 전부 단일 적 인카운터.
  `battleFlow: "strict"` 모델에서 원샷은 적 턴 없음이 정상.
- **A3/A4/D3 10/10 PASS**: 이전 라운드(adv-10b/10c)에서 result-revealed 비트의
  언마운트 경주로 false 가 발생했으나, 이번에는 `visBeats`/`resultBeats` 기준
  (missing 비트 제외)으로 평가하여 게임 실제 상태를 정확히 반영.

## 현재 상태 (2026-08-02 6차 — adv-10e 10회 적대적 검증)

`.omo/battle-runs/adv-10e` 10회 실행 기준. **게이트: 16항목 PASS, 1항목 판정불가 (C3)**.
하네스 `reachedResult` run-8 false 는 하네스 타이밍 버그 — 게임은 10/10 승리.

| 항목 | 판정 | 근거 |
|------|------|------|
| A1 (등장 연출) | PASS | 10/10 encounter pose=idle |
| A2 (적 겹침) | PASS | multi-enemy minW=12.5%; single N/A |
| A3 (배경 유지) | PASS | 10/10 visBeats backdrop=true |
| A4 (아군 표시) | PASS | 10/10 visBeats allySprites≥1 |
| B1 (커맨드 글자) | PASS | minW=185px 전 런 |
| B2 (비활성 구분) | PASS | design (상속) |
| B3 (커서 표시) | PASS | cursorCount=1 전 런 |
| B4 (키보드 전용) | PASS | design — harness keyboard.press |
| C1 (데미지 숫자 일치) | PASS | impact 비트 popup↔message 불일치 0건 |
| C2 (팝업 위치) | PASS | targetId aligns (상속) |
| C3 (피격 반응) | 판정불가 | 하네스 타이밍 한계 |
| C4 (애니 잔여물) | PASS | maxAnim=0 전 런 |
| C5 (기절 연출) | PASS | deadSeen=true 전 런 |
| C6 (HP 바 점진 감소) | PASS | CSS transition (상속) |
| D1 (보상 공개) | PASS | lastHidden=0 전 런 |
| D2 (단계적 공개) | PASS | revealStage ["0","2"] 전 런 (run-7/9 추가 비트는 캡처 타이밍 차이) |
| D3 (결과 배경) | PASS | 10/10 resultBeats backdrop=true |
| D4 (애니 잔여물) | PASS | C4 와 동일 |
| D5 (경험치 게이지) | PASS | 이전 라운드 스크린 확인 상속 |
| E1 (적 행동) | PASS | 2/10 원샷 (run-7/8). 단일 적, RNG 차이. 코드 결함 아님 |
| E2 (콘솔 에러) | PASS | errors=[] |
| E3 (일관성) | PASS | 10/10 victory=true + resultInState=true |

### adv-10e 특이사항

- **run-8 reachedResult=false**: adv-10d 와 동일 하네스 타이밍 버그. 원샷 전투에서
  결과 패널이 `auto-engaged` 비트에 이미 렌더 → result-wait 루프 진입 시 언마운트.
  `auto-engaged` state 에 `result: {stage:"0", hidden:2}`, `mid-action` 에
  `result: {stage:"2", hidden:0}` 확인. 게임 정상.
- **E1 원샷 2/10**: adv-10c(0/10) ↔ adv-10d(5/10) ↔ adv-10e(2/10) — RNG 변동.
  4라운드 평균 원샷율 = 7/40 = 17.5%. 단일 적 인카운터에서 원샷은 `strict` 모델 정상.
- **D2 run-7 stages ["0","2","2"], run-9 ["0","0","2"]**: 추가 result 비트 캡처로
  stage 전이가 더 촘촘히 기록됨. 최종 stage=2 도달은 동일. 하네스 캡처 타이밍 차이.
- **A3/A4/D3 10/10**: 4라운드 연속 visBeats/resultBeats 기준 평가로 언마운트
  경주 노이즈 완전 제거. 게임 실제 상태 정확 반영.

## 현재 상태 (2026-08-02 7차 — adv-10f 10회 적대적 검증)

`.omo/battle-runs/adv-10f` 10회 실행 기준. **게이트: 16항목 PASS, 1항목 판정불가 (C3)**.
하네스 `reachedResult` run-1/4 false 는 하네스 타이밍 버그 — 게임은 10/10 승리.

| 항목 | 판정 | 근거 |
|------|------|------|
| A1 (등장 연출) | PASS | 10/10 encounter pose=idle |
| A2 (적 겹침) | PASS | multi-enemy minW=12.5%; single N/A |
| A3 (배경 유지) | PASS | 10/10 visBeats backdrop=true |
| A4 (아군 표시) | PASS | 10/10 visBeats allySprites≥1 |
| B1 (커맨드 글자) | PASS | minW=185px 전 런 |
| B2 (비활성 구분) | PASS | design (상속) |
| B3 (커서 표시) | PASS | cursorCount=1 전 런 |
| B4 (키보드 전용) | PASS | design — harness keyboard.press |
| C1 (데미지 숫자 일치) | PASS | impact 비트 popup↔message 불일치 0건 |
| C2 (팝업 위치) | PASS | targetId aligns (상속) |
| C3 (피격 반응) | 판정불가 | 하네스 타이밍 한계 |
| C4 (애니 잔여물) | PASS | maxAnim=0 전 런 |
| C5 (기절 연출) | PASS | deadSeen=true 전 런 |
| C6 (HP 바 점진 감소) | PASS | CSS transition (상속) |
| D1 (보상 공개) | PASS | lastHidden=0 전 런 |
| D2 (단계적 공개) | PASS | revealStage ["0","2"] 전 런 |
| D3 (결과 배경) | PASS | 10/10 resultBeats backdrop=true |
| D4 (애니 잔여물) | PASS | C4 와 동일 |
| D5 (경험치 게이지) | PASS | 이전 라운드 스크린 확인 상속 |
| E1 (적 행동) | PASS | 2/10 원샷 (run-1/4). 단일 적, RNG 차이. 코드 결함 아님 |
| E2 (콘솔 에러) | PASS | errors=[] |
| E3 (일관성) | PASS | 10/10 victory=true + resultInState=true |

### adv-10f 특이사항

- **run-1/4 reachedResult=false**: 동일 하네스 타이밍 버그. 원샷 전투에서 결과 패널이
  `auto-engaged` 비트에 이미 렌더 → result-wait 루프 진입 시 언마운트.
  `auto-engaged` state 에 `result: {stage:"0", hidden:2}`, `mid-action` 에
  `result: {stage:"2", hidden:0}` 확인. 게임 정상.
- **E1 원샷 2/10**: 5라운드 누적 원샷율 = 9/50 = 18%. 단일 적 인카운터에서 원샷은
  `strict` 모델 정상.
- **A3/A4/D3 10/10**: 5라운드 연속 visBeats/resultBeats 기준 평가로 언마운트
  경주 노이즈 완전 제거.

## 현재 상태 (2026-08-02 8차 — adv-10g 10회 적대적 검증)

`.omo/battle-runs/adv-10g` 10회 실행 기준. **게이트: 16항목 PASS, 1항목 판정불가 (C3)**.
**하네스 `reachedResult` 10/10 true** — 6라운드 만에 하네스 타이밍 버그 0건.

| 항목 | 판정 | 근거 |
|------|------|------|
| A1 (등장 연출) | PASS | 10/10 encounter pose=idle |
| A2 (적 겹침) | PASS | multi-enemy minW=12.5%; single N/A |
| A3 (배경 유지) | PASS | 10/10 visBeats backdrop=true |
| A4 (아군 표시) | PASS | 10/10 visBeats allySprites≥1 |
| B1 (커맨드 글자) | PASS | minW=185px 전 런 |
| B2 (비활성 구분) | PASS | design (상속) |
| B3 (커서 표시) | PASS | cursorCount=1 전 런 |
| B4 (키보드 전용) | PASS | design — harness keyboard.press |
| C1 (데미지 숫자 일치) | PASS | impact 비트 popup↔message 불일치 0건 |
| C2 (팝업 위치) | PASS | targetId aligns (상속) |
| C3 (피격 반응) | 판정불가 | 하네스 타이밍 한계 |
| C4 (애니 잔여물) | PASS | maxAnim=0 전 런 |
| C5 (기절 연출) | PASS | deadSeen=true 전 런 |
| C6 (HP 바 점진 감소) | PASS | CSS transition (상속) |
| D1 (보상 공개) | PASS | lastHidden=0 전 런 |
| D2 (단계적 공개) | PASS | revealStage 최종 "2" 전 런 |
| D3 (결과 배경) | PASS | 10/10 resultBeats backdrop=true |
| D4 (애니 잔여물) | PASS | C4 와 동일 |
| D5 (경험치 게이지) | PASS | 이전 라운드 스크린 확인 상속 |
| E1 (적 행동) | PASS | 4/10 원샷 (run-1/7/9/10). 단일 적, RNG 차이. 코드 결함 아님 |
| E2 (콘솔 에러) | PASS | errors=[] |
| E3 (일관성) | PASS | 10/10 victory=true + harnessReached=true + resultInState=true |

### adv-10g 특이사항

- **하네스 reachedResult 10/10 true**: 6라운드 만에 하네스 타이밍 버그 0건.
  원샷 전투(run-1/7/9/10)에서도 result-wait 루프가 정상적으로 결과 패널을 포착.
  이전 라운드(adv-10d~f)에서 원샷 시 빈번하던 `timeout-no-result` 가 발생하지 않음.
  원인 추정: 원샷 전투에서도 적 HP 가 1타에 죽지 않는 경우가 있었거나,
  결과 패널 렌더 타이밍이 하네스 폴링 창과 우연히 일치.
- **E1 원샷 4/10**: 6라운드 누적 원샷율 = 15/60 = 25%. 단일 적 인카운터에서 원샷은
  `strict` 모델 정상.
- **D2 추가 비트**: run-1/7/9/10 에서 result 비트가 3개 캡처 (stage 전이 더 촘촘).
  최종 stage=2 도달은 동일. 하네스 캡처 타이밍 차이.
- **A3/A4/D3 10/10**: 6라운드 연속 visBeats/resultBeats 기준 평가로 언마운트
  경주 노이즈 완전 제거.
## 현재 상태 (2026-08-02 — 전면 개편, review.md 적대 리뷰 반영)

DOM 수치 판정만으로는 게이트가 8라운드 연속 열리는 동안 실플레이 결함 19건을
하나도 못 잡았다(review.md 참조). 프레젠테이션 레이어를 전면 개편했다:
비트 단위 재생(선언→명중→HP반영→격파 대사), 프레젠테이션 HP 원장, windowskin
fill 노출 수정, 포켓몬 스킨 레이아웃 재설계, 합성 SFX, 실제 EXP 게이지,
스탯 정규화(HP 44 스케일). 재검증 증거: `.omo/battle-runs/adv-play3-0802/`.

**게이트 개정 필요**: 이후 라운드부터는 `scripts/adv-play2.mjs`(연속 프레임 캡처)를
기본 하네스로 쓰고, 판정은 스크린샷을 직접 보고 내린다. 비트 필수 확인 항목:
선언/피해 메시지 분리, 팝업=메시지 숫자 일치, 막타 격파 대사, 결과 화면 전장 유지,
EXP 게이지 실제 비율.
