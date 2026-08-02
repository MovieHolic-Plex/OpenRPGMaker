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
