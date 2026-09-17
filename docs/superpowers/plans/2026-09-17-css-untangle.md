# CSS 정리 실행 계획 — 중단된 수술을 마치고 게이트를 켠다

> **에이전트 작업자에게:** 이 계획은 `superpowers:subagent-driven-development` 또는
> `superpowers:executing-plans` 로 Task 단위로 실행한다. 체크박스(`- [ ]`)로 진행을 추적한다.

**목표:** 사용자 눈에 보이는 CSS 결함 7건을 먼저 지혈하고, 꺼져 있는 게이트를 집행 경로에
연결해 재발을 막은 뒤, 2026-09-11 표면 격리 수술의 남은 3·4단계를 마친다.

**아키텍처:** 세 층으로 나눈다. (1) **지혈** — 캐스케이드 구조를 안 건드리고 값·레이어 한 단어만
고쳐 실증 버그를 없앤다. (2) **집행** — 이미 존재하는 게이트를 `npm run gates` 에 연결하고,
노이즈 99%를 제거해 사람이 다시 돌리게 만든다. 없는 게이트(승자 판정)는 리포에 이미 있는
부품(`css-flatten.mjs` 의 특이도 계산기 + `seq`)으로 조립한다. (3) **수술 재개** — event 표면에서
검증된 16단계 레시피를 `editor/`·`database/` 에 적용한다.

**Tech Stack:** 순수 CSS + `@layer` · Node ESM 게이트 스크립트(외부 의존성 없음) · postcss(평탄화) ·
vitest(게이트 단위 테스트, 정본 축) · Playwright(`shots:css` 61장)

**스펙:** `docs/superpowers/specs/2026-09-11-css-surface-isolation-design.md`
(이 계획은 그 스펙의 3·4·5단계를 이어받고, 스펙이 예측하지 못한 게이트 집행 실패를 추가로 다룬다)

**근거 리뷰:** `.superpowers/css-review-2026-09-17/{A,B,C,D,E}-*.md` — 2026-09-17 적대적 리뷰
5축, 서브에이전트 5개가 각각 독립 파서를 작성해 교차 측정.

---

## Global Constraints

- **워크트리엔 `node_modules` 가 없다.** `npm`·`vitest`·`playwright` 실행 불가. 게이트
  `scripts/*.mjs` 는 `node` 로 직접 돌아간다(`postcss` 는 `/home/main/node_modules` 에서 해소됨).
  **기준선 갱신과 시각 검증은 본 체크아웃에서** 한다. 병합은 `gh pr` 로만.
  (`git push . HEAD:main` 은 거부된다.)
- **시각 결과를 바꾸지 않는다.** Phase 0 의 명시된 7건만 예외이고, 각각 "무엇이 어떻게
  달라지는지"를 커밋 메시지에 적는다. 나머지 모든 Task 는 픽셀 동일이 머지 조건이다.
- **`main` 이 빠르게 움직인다.** 최근 3개월 CSS 커밋 1,281개, 병합 테스트 중 19커밋 이동 관찰.
  Task 당 1~2일, PR 은 작게 자른다.
- **정본 축(fixture) 은 워크트리에서 갱신할 수 없다.** `check-css-live-classes.mjs` 의 6축은
  vitest 로만 갱신된다. 축 갱신이 필요한 Task 는 본 체크아웃 전용으로 표시했다.
- **`!important` 를 새로 추가하지 않는다.** 레이어 순서로 해결되지 않으면 `overrides.css` 로
  올리고 이유와 만기일을 주석에 적는다.
- **하드코딩 색을 새로 추가하지 않는다.** `tokens.css` 의 값과 같은 리터럴을 쓰지 않는다.

---

## 측정 기준선 (2026-09-17, HEAD `9e5c890c9`)

이 수치는 Phase 마다 다시 재서 진척을 증명한다. 전부 직접 센 값이다.

| 지표 | 현재 | 출처 |
|---|---:|---|
| CSS 파일 / 줄 | 289 / 101,823 | B §1 |
| 고아 시트 · 이중 @import | **0 · 0** | B §2·§4 (그래프 위생은 깨끗) |
| `!important` (실제 선언) | **675** (grep 718 − 주석 43) | E §3.0 |
| ㄴ 내전(리포 안 경쟁자 존재) | 500 (74.1%) | E §3.1 |
| ㄴ 블록 통째 무장에서 나온 것 | 408 (60.4%) | E §3.2 |
| 파일 **내** 중복 (같은 레이어·같은 at-문맥) | **880 그룹 / 932 잉여 블록** | E §1.2 |
| 파일 **간** 중복 선택자 | 718 (4.9%) | E §1.1 |
| 색 리터럴 | **2,653** (hex 1,589 + rgba 1,064) | C §4.1 |
| ㄴ 토큰에 같은 값이 있는 순수 중복 | 463 | C §4.2 |
| ㄴ 실제 렌더되는 폐기 크림 | ~146 | C §4.3 |
| 미정의 `var()` (런타임 주입 제외) | **199** (폴백 없음 95 / 있음 104) | C §1.1 |
| px 리터럴 / 토큰 채택률 | 20,194 / space 19.2%·radius 10.9%·stroke 2.5% | C §6 |
| `check-css-surfaces --enforce all` | **exit 1 / FAIL 710** | D §0 |
| ㄴ 그중 레지스트리 미갱신 노이즈 | **701 (98.7%)** | D §4.1 |
| `check-dead-css-classes` | **exit 1 / 신규 37** | D §0 |
| `npm run gates` 가 실제로 돌리는 CSS 게이트 | **4개 중 2개** (budget, graph) | D §0 |

**표면별 규모 / 수술 진도**

| 표면 | 파일 | 줄 | `!important` | 스펙 단계 |
|---|---:|---:|---:|---|
| event | 29 | 22,120 | **0** | ✅ 2단계 완료 |
| database | 114 | 44,501 | 283 | ❌ 4단계 미착수 |
| editor (소멸 예정) | 26 | 11,714 | 5 | ❌ 3단계 미착수 |
| runtime | 61 | 11,387 | 370 | 스펙상 비목표 |
| shell + map | 39 | 7,241 | 38 | ❌ 3단계 미착수 |

---

## 왜 이렇게 됐는가 — 계획이 전제하는 진단

CSS 는 방치돼서 꼬인 게 아니다. **수술이 44% 지점에서 멈췄고, 그동안 마취 모니터가 꺼져 있었다.**

1. **수술은 실제로 효과가 있었다.** 2026-09-11 표면 격리의 0~2단계가 PR #776 으로 착지했고,
   event 표면은 22,120줄을 `!important` **0** 으로 접었다. 레시피도 도구도 이미 리포에 있다.
2. **그런데 3·4단계에서 멈췄다.** `editor/` 11,714줄이 "사라져야 할 디렉터리"로 남아 남의 표면
   배럴(map 21장 · shell 5장)이 끌어가고, `database/` 44,501줄은 손도 대지 않았다.
3. **게이트가 집행 경로에 없다.** `verify-gates.mjs:199-213` 의 `cssGate()` 는 4개 중 budget·graph
   **2개만** 돌린다. 표면 규칙 전체(R1–R6)를 보는 `check-css-surfaces.mjs` 와
   `check-css-live-classes.mjs` 는 어떤 자동 경로에도 없고, GitHub Actions 는 리포 수준에서
   꺼져 있다(`parity.yml:98-100`, 마지막 실행 2026-08-04).
4. **그래서 규율이 샌다.** 게이트는 **2026-09-15 에 빨개졌고 이틀 동안 아무도 몰랐다.**
   9/12 이후 5일간 +4,588줄(하루 918줄)이 들어왔고, 그중 `spatial-composition.css` 는
   `layer(database)` 를 빠뜨린 채 3일을 살아남았다 — 같은 커밋에 들어온 형제 5장은 전부 붙어 있다.
5. **게이트가 빨간 이유의 98.7%는 노이즈다.** 710건 중 701건이 "새 클래스 계열을 레지스트리에
   등록 안 함"이다. 이런 형태로 빨간 채 방치되면 사람은 정확히 지금처럼 게이트를 안 돌리게 된다.

그래서 순서가 이렇다: **보이는 것 먼저 → 게이트를 믿을 수 있게 만들고 켠다 → 그 다음에 구조.**
게이트를 켜기 전에 구조를 건드리면 되돌아온다.

---

## 파일 구조

**새로 만드는 것**

| 경로 | 책임 |
|---|---|
| `scripts/check-css-winners.mjs` | (선택자, 속성) → 승자 시트 맵을 기준선으로 래칫. P0 공백(레이어 순서·값·세탁)을 한 번에 닫는다 |
| `scripts/css-winners.baseline.json` | 위 게이트의 기준선 |
| `scripts/lib/css-import-re.mjs` | `@import` 정규식 **단일 정의**. `check-css-graph.mjs`·`css-flatten.mjs`·`check-css-winners.mjs` 가 공유 |
| `src/styles/runtime/tokens.dark.css` | 플레이어 전용 다크 토큰 오버레이 (`layer(tokens)`) |
| `test/checkCssWinners.test.ts` | 승자 게이트 단위 테스트 |

**크게 고치는 것**

| 경로 | 무엇을 |
|---|---|
| `scripts/verify-gates.mjs:199-213` | `cssGate()` 에 surfaces·live-classes·winners 추가 |
| `scripts/css-surfaces.json` | `database.prefixes` 에 신규 7계열 등록 + `editor` 표면 제거(Phase 4 후) |
| `scripts/check-css-surfaces.mjs:126,150-151` | R1 에 레이어 **이름** 검사 추가, R4 의 리터럴 폴백 통과 규칙을 문서와 일치시킴 |
| `scripts/css-flatten.mjs:7,20` | `IMPORT_RE` 공유 모듈로 교체, 정규식 주석 제거 → 문자 스캐너 |
| `src/styles/database/index.css:116` | `layer(database)` 누락 수정 |
| `src/styles/TOKENS.md` | R4 실제 동작과 일치시키고 치수/브레이크포인트 절 교정 |

**삭제 대상 (Phase 4·5 완료 후)**

`src/styles/editor/` 디렉터리 전체 · `scripts/measure-css-deletable.mjs` ·
`scripts/check-dead-css-classes.mjs`(R5 로 대체 후) · `tokens.css` 의 `--bp-*` 4개

---

# Phase 0 — 지혈 (사용자에게 보이는 결함)

구조를 건드리지 않는다. 값과 레이어 한 단어만 고친다. 각 Task 는 독립 PR 이고 되돌리기 쉽다.

### Task 1: 다크 플레이어가 라이트 토큰을 먹는 문제

**근거:** C §5.2. 테마는 둘(에디터 라이트 / 플레이어 다크)인데 토큰 세트는 하나다.
작성자들은 다크 값을 `var(--token, DARK)` 형태로 성실히 적었지만, 그 토큰이 라이트로
**정의돼 있어서 폴백이 한 번도 실행되지 않는다.**

**Files:**
- Create: `src/styles/runtime/tokens.dark.css`
- Modify: `src/player/player.css:3`
- Modify: `src/styles/runtime/transitions.css:13`
- Modify: `src/styles/runtime/touchpad.css:62`
- Modify: `src/styles/runtime/pictures.css:21-23`

**Interfaces:**
- Produces: `--bg-canvas`·`--text-1`·`--bg-glass`·`--border-strong` 의 플레이어 전용 다크 값.
  Task 2 이후 어떤 런타임 시트도 `var(--token, DARK리터럴)` 패턴을 새로 쓰지 않는다.

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`test/playerDarkTokens.test.ts` 를 만든다. 런타임 시트에서 "라이트로 정의된 토큰에
다크 폴백을 단 선언"을 찾으면 실패한다.

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 상대 휘도. WCAG 정의.
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const TOKENS = readFileSync("src/styles/tokens.css", "utf8");
function tokenValue(name: string): string | null {
  const m = TOKENS.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

const RUNTIME_SHEETS = [
  "src/styles/runtime/transitions.css",
  "src/styles/runtime/touchpad.css",
  "src/styles/runtime/pictures.css",
];

describe("플레이어 런타임 토큰", () => {
  it("라이트 토큰에 다크 폴백을 달지 않는다 — 폴백은 실행되지 않는다", () => {
    const offenders: string[] = [];
    for (const path of RUNTIME_SHEETS) {
      const css = readFileSync(path, "utf8");
      const re = /var\(\s*--([a-z0-9-]+)\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/g;
      for (const m of css.matchAll(re)) {
        const defined = tokenValue(m[1]);
        if (!defined || !defined.startsWith("#")) continue;
        // 토큰은 밝은데 폴백은 어둡다 = 작성자 의도와 렌더가 반대다
        if (luminance(defined) > 0.5 && luminance(m[2]) < 0.2) {
          offenders.push(`${path}: --${m[1]} 정의=${defined} 폴백=${m[2]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run test/playerDarkTokens.test.ts
```
기대: FAIL. 최소 3건 —
`transitions.css: --bg-canvas 정의=#EEF1F4 폴백=#05070c`,
`touchpad.css: --text-1 정의=#0F172A 폴백=#f4f7ff`,
`pictures.css: --text-1 정의=#0F172A 폴백=#e9ecf3`.

- [ ] **Step 3: 플레이어 전용 다크 토큰 오버레이를 만든다**

`src/styles/runtime/tokens.dark.css`:

```css
/* 플레이어 런타임 전용 다크 토큰. 에디터는 이 시트를 읽지 않는다.
   왜 필요한가: tokens.css 는 에디터 라이트 팔레트 하나뿐이라, 다크 플레이어가
   같은 토큰을 읽으면 밝은 값이 나온다. 2026-09-17 리뷰 C §5.2 참조.
   layer(tokens) 로 들어가므로 표면 시트는 여전히 이 값을 덮을 수 있다. */
:root:has(body.player-root),
body.player-root {
  --bg-canvas: #05070c;
  --bg-glass: rgba(24, 28, 40, 0.88);
  --border-strong: rgba(255, 255, 255, 0.17);
  --text-1: #e9ecf3;
  --text-2: #b6bece;
}
```

`src/player/player.css:3` 바로 뒤에 추가:
```css
@import "../styles/runtime/tokens.dark.css" layer(tokens);
```

- [ ] **Step 4: 폴백을 제거해 토큰만 남긴다**

세 곳에서 죽은 폴백을 지운다. 값은 Step 3 의 토큰이 공급한다.

```css
/* src/styles/runtime/transitions.css:13 */
.runtime-transition-blind { background: var(--bg-canvas); }

/* src/styles/runtime/touchpad.css:62 */
color: var(--text-1);

/* src/styles/runtime/pictures.css:21-23 */
background: var(--bg-glass);
border: 1px solid var(--border-strong);
color: var(--text-1);
```

`src/player/exportEntry.ts` 가 `<body>` 에 `player-root` 클래스를 붙이는지 확인하고,
없으면 붙인다. 붙이는 위치는 `document.body.classList.add("player-root")` 한 줄이다.

- [ ] **Step 5: 통과를 확인한다**

```bash
npx vitest run test/playerDarkTokens.test.ts   # PASS
npx vitest run test/playerRuntimeCss.test.ts   # 기존 계약 유지 확인
```

- [ ] **Step 6: 실제로 눈으로 본다 (본 체크아웃)**

플레이어를 띄워 (a) 맵 전환 블라인드가 **검게** 닫히는지, (b) 모바일 터치 버튼 글자가
읽히는지, (c) 픽처 라벨이 다크 글래스인지 확인하고 스크린샷 3장을 PR 에 붙인다.
**이 Task 는 시각을 의도적으로 바꾸므로 픽셀 기준선 갱신이 필요하다.**

- [ ] **Step 7: 커밋**

```bash
git add src/styles/runtime/tokens.dark.css src/player/player.css \
        src/styles/runtime/transitions.css src/styles/runtime/touchpad.css \
        src/styles/runtime/pictures.css test/playerDarkTokens.test.ts
git commit -m "fix(player): 다크 런타임에 다크 토큰을 준다 — 맵 전환이 검게 닫히고 터치 버튼이 읽힌다

작성자들은 var(--token, 다크리터럴) 로 다크 값을 적었지만 그 토큰이 라이트로
정의돼 있어 폴백이 한 번도 실행되지 않았다. 맵 전환 블라인드는 연회색(#EEF1F4)으로
닫혔고 터치 버튼은 어두운 글자 on 어두운 버튼(대비 ~1.3:1)이었다.

2026-09-14 에 .battle-transition-overlay 에서 같은 버그를 진단·수정했으나
같은 파일 12줄 위의 .runtime-transition-blind 는 남아 있었다."
```

---

### Task 2: `spatial-composition.css` 언레이어 — 유일한 실증 승자 뒤집힘

**근거:** A §2(A1), B §7-5. 39개 블록이 언레이어라 `overrides` 를 포함한 모든 레이어를 이긴다.
같은 커밋(`cf0037e0e`, 2026-09-13)에 들어온 형제 5장은 전부 `layer(database)` 가 붙어 있다.
단순 누락이다.

**Files:**
- Modify: `src/styles/database/index.css:116`

- [ ] **Step 1: 고치기 전 승자를 기록한다**

```bash
node scripts/css-flatten.mjs --entry src/styles/database/index.css --json /tmp/before.json
node -e "const d=require('/tmp/before.json');const s=d.declarations.filter(x=>/spatial-mixed|asset-browser/.test(x.selector));console.log(JSON.stringify(s.map(x=>[x.selector,x.prop,x.layer]),null,1))" > /tmp/before-winners.txt
wc -l /tmp/before-winners.txt
```

- [ ] **Step 2: `layer(database)` 를 붙인다**

```css
/* src/styles/database/index.css:116 */
@import "./spatial-composition.css" layer(database);
```

- [ ] **Step 3: 승자 변화를 잰다**

```bash
node scripts/css-flatten.mjs --entry src/styles/database/index.css --json /tmp/after.json
node -e "const d=require('/tmp/after.json');const s=d.declarations.filter(x=>/spatial-mixed|asset-browser/.test(x.selector));console.log(JSON.stringify(s.map(x=>[x.selector,x.prop,x.layer]),null,1))" > /tmp/after-winners.txt
diff /tmp/before-winners.txt /tmp/after-winners.txt
```

기대: `layer` 필드만 `null → database` 로 바뀌고 **승자 시트는 그대로**.
`.spatial-mixed-*` 는 이 파일 전용 선택자라 경합 상대가 없다(B §7-5 확인).
`.asset-browser-*` 는 `database/asset-browser.css` 와 겹치므로 **거기만 집중 확인**한다.
승자가 바뀌는 항목이 나오면 멈추고 그 목록을 PR 에 적는다 — 그건 이 시트가 실제로
다른 규칙을 이기고 있었다는 뜻이므로 별도 판단이 필요하다.

- [ ] **Step 4: 표면 게이트로 확인**

```bash
node scripts/check-css-surfaces.mjs --enforce all 2>&1 | grep -o '"R1":[0-9]*'
```
기대: `"R1":37` → `"R1":0`.

- [ ] **Step 5: 시각 동일 (본 체크아웃)**

```bash
npm run shots:css
```
기대: exit 0. 공간 합성 워크스페이스 화면이 포함된 스냅샷이 없으면 이 Task 에서
`test/e2e/css-surface-shots.spec.ts` 에 한 장 추가한다.

- [ ] **Step 6: 커밋**

```bash
git add src/styles/database/index.css
git commit -m "fix(css): spatial-composition 시트에 빠진 layer(database) 를 붙인다

2026-09-13 cf0037e0e 에서 이 한 줄만 layer() 없이 들어왔다(형제 5장은 전부 붙어 있다).
언레이어 규칙은 모든 레이어를 이기므로 39개 블록이 overrides 까지 덮고 있었다.
표면 게이트 R1 37건 → 0건."
```

---

### Task 3: 미정의 `--oprn-*` 로 선언이 통째 폐기되는 곳

**근거:** C §1.2. `--oprn-*` 약 40건은 리포 전체(CSS·TS·HTML·테스트)에 정의가 **한 곳도 없다.**
유일한 등장처가 게이트 면제 목록 `css-surfaces.baseline.json` 이다. 폴백이 없어 선언이
통째로 버려지고, 의도된 3D 베벨이 사라져 테두리 네 변이 글자색 단색이 된다.

**Files:**
- Modify: `src/styles/database/states.css:129,130,162,202-212,215,225,226`
- Modify: `src/styles/database/enemies.part-1.css:37,190,250`
- Modify: `scripts/css-surfaces.baseline.json` (해당 면제 제거)

- [ ] **Step 1: 전체 목록을 뽑는다**

```bash
grep -rn -- '--oprn-' src --include='*.css' | grep -v '\-\-oprn-[a-z-]*\s*:' > /tmp/oprn-refs.txt
wc -l /tmp/oprn-refs.txt
# 정의가 정말 없는지 교차 확인
grep -rn -- '--oprn-[a-z-]*\s*:' src electron test scripts *.html 2>/dev/null | wc -l   # 기대: 0
```

- [ ] **Step 2: 각 참조를 정본 토큰으로 치환한다**

`enemies.part-1.css:87` 의 주석이 이 계열의 원래 의미를 증언한다
(*"background/border-color 는 예전에 var(--oprn-chrome)/var(--oprn-light) 였다"*).
베벨 의미에 맞춰 매핑한다:

| 옛 이름 | 의미 | 치환 |
|---|---|---|
| `--oprn-light` | 베벨 밝은 면 | `var(--bg-raised)` |
| `--oprn-mid` | 베벨 어두운 면 | `var(--border-strong)` |
| `--oprn-shadow` | 그림자 | `var(--border-strong)` |
| `--oprn-chrome` | 크롬 배경 | `var(--bg-surface)` |
| `--oprn-text` | 본문 글자 | `var(--text-1)` |
| `--oprn-field` | 입력 배경 | `var(--bg-raised)` |
| `--oprn-highlight` | 강조 | `var(--accent)` |

`--oprn-state-rate-a~e`, `--oprn-state-preview-a~c` 는 상태 미리보기 전용 색 슬롯이다.
`states.css` 안에서 실제로 무엇을 칠하는지 읽고, **`--db-*` 표면 사설 토큰으로 새로 정의**한다
(스펙 R4: 표면 사설 토큰은 표면 접두어를 쓰고 표면 루트 아래에서만 정의).

- [ ] **Step 3: 베이스라인 면제를 제거한다**

```bash
node -e "
const fs=require('fs');const p='scripts/css-surfaces.baseline.json';
const j=JSON.parse(fs.readFileSync(p,'utf8'));
const before=JSON.stringify(j).match(/--oprn-/g)?.length||0;
// R4 지문 중 --oprn- 을 언급하는 항목만 제거
for(const k of Object.keys(j)) if(Array.isArray(j[k])) j[k]=j[k].filter(e=>!JSON.stringify(e).includes('--oprn-'));
fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');
console.log('removed oprn fingerprints:', before);
"
```

- [ ] **Step 4: 게이트로 확인**

```bash
node scripts/check-css-surfaces.mjs --enforce all 2>&1 | grep -o '"R4":[0-9]*'
```
기대: R4 가 `--oprn-*` 만큼 줄어든다. 늘어나면 치환이 또 다른 미정의를 만든 것이다.

- [ ] **Step 5: 시각 확인 (본 체크아웃)** — DB 모달 → 상태 탭, 적 탭을 열어 테두리 베벨이
  살아났는지 스크린샷 2장. **이 Task 도 시각을 의도적으로 바꾼다.**

- [ ] **Step 6: 커밋**

```bash
git add src/styles/database/states.css src/styles/database/enemies.part-1.css \
        scripts/css-surfaces.baseline.json
git commit -m "fix(db): 정의가 사라진 --oprn-* 참조를 정본 토큰으로 되살린다

정의는 지워지고 참조만 남아 border-color 선언이 통째로 폐기됐다(invalid at
computed-value time). 의도된 3D 베벨 대신 네 변이 currentColor 단색이었다.
유일한 흔적이 게이트 면제 목록에 있었다 — 면제도 같이 지운다."
```

---

### Task 4: 살아 있는 크림 폴백 — `map-props.css` 와 DB 스크롤바

**근거:** C §1.3·§3.3. 크림 650건 중 **536건은 사문**(토큰이 정의돼 있어 폴백 미실행)이고,
**실제 렌더되는 건 ~146건**이다. 이 구분 없이 접근하면 양방향으로 틀린다.

두 개의 확정 사례만 다룬다. 나머지 크림 정리는 Phase 5 의 표면 접기에 맡긴다.

**Files:**
- Modify: `src/styles/editor/map-props.css` (17건)
- Modify: `src/styles/database/light-theme.css:59-60`

- [ ] **Step 1: 렌더되는 크림만 골라낸다**

```bash
node -e "
const fs=require('fs');
const TOKENS=fs.readFileSync('src/styles/tokens.css','utf8');
const defined=new Set([...TOKENS.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m=>m[1]));
const CREAM=/rgba\(\s*42\s*,\s*37\s*,\s*33|#fffdf8|#efe9dc|#e6e0cf|#d8cbb8|#2a2521|#5c5348|#6b5f52/i;
for(const f of process.argv.slice(1)){
  const css=fs.readFileSync(f,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  css.split('\n').forEach((line,i)=>{
    for(const m of line.matchAll(/var\(\s*--([a-z0-9-]+)\s*,([^)]*)\)/g)){
      if(CREAM.test(m[2]) && !defined.has(m[1])) console.log(f+':'+(i+1)+'  --'+m[1]+' 미정의 → 크림 렌더:'+m[2].trim());
    }
  });
}
" src/styles/editor/map-props.css src/styles/database/actors.css \
  src/styles/event/command-forms/forms-6.css src/styles/event/previews/command-preview-2.css
```

- [ ] **Step 2: 미정의 토큰을 정본으로 치환한다**

`map-props.css` 의 17건은 세 종류다:
```css
var(--border-color, rgba(42,37,33,0.12))  →  var(--border-subtle)
var(--border-color, rgba(42,37,33,0.20))  →  var(--border-default)
var(--surface-raised, #FFFDF8)            →  var(--bg-raised)
var(--hover-bg, rgba(42,37,33,0.06))      →  var(--bg-hover)
```
치환 전에 **정본에 그 토큰이 실제로 있는지** 확인한다:
```bash
grep -n -- '--border-subtle:\|--border-default:\|--bg-raised:\|--bg-hover:' src/styles/tokens.css
```
없으면 가장 가까운 정본 토큰을 쓰고 그 판단을 커밋 메시지에 적는다.

- [ ] **Step 3: DB 스크롤바를 슬레이트로 통일한다**

`light-theme.css:59-60` 의 두 줄을 지운다. `studio-theme.css` 가 이미 95개 토큰을
정의하지만 이 둘은 덮지 않아, **DB 모달 안 스크롤바만 크림-브라운**이고 밖은 슬레이트다.
DB 모달은 스크림 위에 뜨므로 두 색이 **동시에 화면에 보인다**(C §3.3).

```css
/* src/styles/database/light-theme.css:59-60 — 삭제
   --scrollbar-thumb: rgba(42, 37, 33, 0.20);
   --scrollbar-thumb-hover: rgba(42, 37, 33, 0.36);
   tokens.css 의 슬레이트 값(rgba(15,23,42,0.18) / 0.30)이 상속된다. */
```

같은 파일의 나머지 값-상이 4건(`--mix-base`, `--brand-blue`, `--empty-icon-bg/border`)도
정본과 대조해 **의도적 차이인지 드리프트인지** 판정하고, 드리프트면 지운다.
`--brand-blue` 는 `#2f67c9` vs 정본 `#4A57D6` 로 **두 개의 브랜드 파랑이 공존**한다.

- [ ] **Step 4: 시각 확인 (본 체크아웃)** — 맵 속성 패널과 DB 모달 스크롤바 스크린샷.
  `npm run shots:css` 로 나머지 60장이 안 움직였는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/styles/editor/map-props.css src/styles/database/light-theme.css
git commit -m "fix(css): 실제로 렌더되던 크림 잔재를 정본 토큰으로 바꾼다

맵 속성 패널은 한 장 안에서 흰 배경 + 슬레이트 글자 + 크림-브라운 테두리를
동시에 그리고 있었다(미정의 토큰의 크림 폴백 17건). DB 모달 스크롤바만
크림이고 바깥은 슬레이트라 두 색이 한 화면에 보였다.

크림 650건 중 536건은 토큰이 정의돼 있어 폴백이 실행되지 않는 사문이다.
이 커밋은 실제로 렌더되던 것만 건드린다."
```

---

# Phase 1 — 게이트를 믿을 수 있게 만들고 켠다

Phase 0 이 증상을 없앴다면, 여기서는 **재발을 막는다.** 순서가 중요하다:
노이즈를 먼저 없애야(Task 5) 게이트를 켤 수 있고(Task 7), 세탁 경로를 막아야(Task 6)
켠 게이트가 의미를 갖는다.

### Task 5: 레지스트리 미갱신 노이즈 701건 제거

**근거:** D §4.1. FAIL 710 중 701건(98.7%)이 "새 클래스 계열이 `css-surfaces.json` 에
등록 안 됨"이다. **고쳐야 할 것은 CSS 가 아니라 레지스트리 한 줄씩이다.**

**Files:**
- Modify: `scripts/css-surfaces.json` (`database.prefixes`)
- Modify: `scripts/css-surfaces.baseline.json` (해소된 지문 제거)

- [ ] **Step 1: 미등록 계열을 센다**

```bash
node scripts/check-css-surfaces.mjs --enforce all --json /tmp/r2.json 2>/dev/null
node -e "
const j=require('/tmp/r2.json');
const c={};
for(const v of (j.violations||[]).filter(v=>v.rule==='R2')){
  const m=String(v.detail||v.message||'').match(/\.([a-z0-9]+-[a-z0-9]+)-/);
  if(m) c[m[1]+'-']=(c[m[1]+'-']||0)+1;
}
console.log(Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,20));
"
```
기대 상위: `ai-team-`(264) `ai-lane-`(180) `ai-change-`(173) `ai-work-`(50) `ai-act-`(20)
`ai-run-`(8) `chat-dock-`(5).

- [ ] **Step 2: 레지스트리에 등록한다**

`scripts/css-surfaces.json` 의 `database.prefixes` 배열에 추가한다. 각 항목에
**어느 시트가 발행하는지 주석 대신 커밋 메시지로** 남긴다(JSON 은 주석 불가).

```json
"ai-team-", "ai-lane-", "ai-change-", "ai-work-", "ai-act-", "ai-run-", "chat-dock-"
```

- [ ] **Step 3: 남은 위반이 진짜인지 확인한다**

```bash
node scripts/check-css-surfaces.mjs --enforce all
```
기대: FAIL 710 → **10 미만**. 남는 것은 진짜 작업이다:
- R4 `--battle-text-muted` (`runtime/battle-skins/_rm2000.css:1202,1428,1583`) — 정의가
  어디에도 없다. 진짜 버그.
- R4 `--bg` (`resources/expression-manager.css:11`) — 정의가 database 스코프 안이라
  resources 모달에 상속 안 될 가능성이 높다. 브라우저로 확인 후 표면 사설 토큰으로 정의.
- R4 `--editor-panel-bg`/`--editor-line-strong`/`--editor-text` — **거짓 빨간불.**
  `shell/figma-editor/01-shell-topbar-team.css:6-9` 의 `:root` 블록에 정의돼 있다.
  게이트가 "tokens 표면이 아닌 곳에 정의됐다"는 이유로 "미정의 (폴백 없음)"이라는
  **사실과 다른 메시지**를 낸다 → Task 8 에서 메시지를 고친다.

- [ ] **Step 4: 해소된 베이스라인 지문을 지운다**

```bash
node scripts/check-css-surfaces.mjs --save-baseline
git diff --stat scripts/css-surfaces.baseline.json
```
기대: 3,367 → 대폭 감소. **죽은 유예 32건**(D §2)도 같이 사라진다.

- [ ] **Step 5: 커밋**

```bash
git add scripts/css-surfaces.json scripts/css-surfaces.baseline.json
git commit -m "chore(css): 조수 데크 신규 클래스 7계열을 표면 레지스트리에 등록한다

표면 게이트가 2026-09-15 부터 FAIL 710 이었는데 그중 701건(98.7%)이
'새 클래스 계열 미등록'이었다. CSS 가 아니라 레지스트리 문제다.
이 노이즈가 게이트를 못 켜게 만드는 원인이었다 — Task 7 의 선행 조건."
```

---

### Task 6: `@import` 세탁 경로를 닫는다

**근거:** D §3 시나리오 3. `@import "x.css"` → `@import url(x.css)` 한 줄이면 시트 하나가
R1–R6 검사에서 **통째로 면제**된다(위반 325건 증발). 둘 다 유효한 CSS 이고 브라우저 동작도
같아서 화면이 안 바뀐다 — 스크린샷 게이트도 못 잡는다. **1초짜리 세탁 프리미티브**다.

원인: `css-flatten.mjs:7` 의 `IMPORT_RE` 가 `check-css-graph.mjs:98-99` 와 다르다.
graph 는 `url()`·무따옴표·`i` 플래그를 처리하는데 flatten 은 안 한다.

**Files:**
- Create: `scripts/lib/css-import-re.mjs`
- Modify: `scripts/css-flatten.mjs:7,20`
- Modify: `scripts/check-css-graph.mjs:98-99`
- Test: `test/cssImportRe.test.ts`

**Interfaces:**
- Produces: `parseImports(css: string): Array<{ spec: string; layer: string | null; index: number }>`
  — 세 게이트가 공유하는 유일한 `@import` 파서.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// test/cssImportRe.test.ts
import { describe, expect, it } from "vitest";
import { parseImports } from "../scripts/lib/css-import-re.mjs";

describe("parseImports", () => {
  it("따옴표·url()·무따옴표를 모두 같게 읽는다", () => {
    const forms = [
      `@import "./a.css" layer(database);`,
      `@import './a.css' layer(database);`,
      `@import url(./a.css) layer(database);`,
      `@import url("./a.css") layer(database);`,
      `@IMPORT URL(./a.css) LAYER(database);`,
    ];
    for (const css of forms) {
      const [got] = parseImports(css);
      expect(got, css).toMatchObject({ spec: "./a.css", layer: "database" });
    }
  });

  it("layer 없는 import 의 layer 는 null 이다", () => {
    expect(parseImports(`@import "./a.css";`)[0]).toMatchObject({ spec: "./a.css", layer: null });
  });

  it("주석 안의 @import 를 세지 않는다", () => {
    expect(parseImports(`/* @import "./ghost.css"; */ @import "./real.css";`))
      .toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run test/cssImportRe.test.ts` → FAIL (모듈 없음).

- [ ] **Step 3: 공유 파서를 만든다**

`scripts/lib/css-import-re.mjs`. 주석 제거는 `check-css-budget.mjs:77-88` 의 **문자 단위
스캐너를 재사용**한다(정규식은 `content: "/*"` 에 속는다 — 그 파일이 리포에서 가장
튼튼한 파서다).

```js
// @import 의 단일 정의. graph·flatten·winners 게이트가 공유한다.
// 왜 공유해야 하나: 2026-09-17 리뷰 D §3 시나리오 3 — flatten 과 graph 의 정규식이
// 달라서, 따옴표를 url() 로 바꾸는 한 줄 편집이 시트를 게이트에서 숨기는
// 세탁 프리미티브가 됐다(위반 325건 증발, 화면 무변화).
export function stripComments(css) { /* check-css-budget.mjs:77-88 과 동일 구현 */ }

const IMPORT_RE =
  /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)|"([^"]*)"|'([^']*)')\s*([^;]*);/giu;

export function parseImports(rawCss) {
  const css = stripComments(rawCss);
  const out = [];
  for (const m of css.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5];
    if (!spec) continue;
    const layerMatch = /layer\(\s*([a-z0-9_-]+)\s*\)/i.exec(m[6] || "");
    out.push({ spec, layer: layerMatch ? layerMatch[1] : null, index: m.index });
  }
  return out;
}
```

- [ ] **Step 4: 두 게이트를 공유 파서로 교체한다**

`css-flatten.mjs` 와 `check-css-graph.mjs` 가 각자 갖고 있던 정규식과 주석 제거를 지우고
`parseImports` 를 import 한다. **`css-flatten.mjs:20` 의 정규식 주석 제거도 같이 교체한다.**

- [ ] **Step 5: 통과 확인 + 회귀 없음**

```bash
npx vitest run test/cssImportRe.test.ts     # PASS
node scripts/check-css-graph.mjs            # exit 0, reachable=289 orphan=0 유지
node scripts/check-css-surfaces.mjs --enforce all | grep -o '"R[0-9]":[0-9]*'
```
기대: Task 5 직후 수치와 **동일**. 달라지면 flatten 이 원래 놓치던 시트가 들어온 것이므로
그 목록을 PR 에 적는다(그것 자체가 세탁이 실재했다는 증거다).

- [ ] **Step 6: 세탁이 막혔는지 증명한다**

```bash
cp -r src scripts /tmp/launder/ && cd /tmp/launder
sed -i 's|@import "./tabs-b-assistant-panel/22-team-work.css" layer(database);|@import url(./tabs-b-assistant-panel/22-team-work.css) layer(database);|' src/styles/database/index.css
node scripts/check-css-surfaces.mjs --enforce all | grep -o '"R2":[0-9]*'
```
기대: 변경 **전후 동일**. (수정 전에는 `R2:10463 → 10138` 로 325건이 증발했다.)

- [ ] **Step 7: 커밋**

```bash
git add scripts/lib/css-import-re.mjs scripts/css-flatten.mjs scripts/check-css-graph.mjs \
        test/cssImportRe.test.ts
git commit -m "fix(gates): @import 파서를 하나로 합쳐 게이트 세탁 경로를 막는다

flatten 과 graph 의 정규식이 달라서, 따옴표를 url() 로 바꾸는 한 줄 편집이
시트 하나를 R1-R6 검사에서 통째로 면제시켰다(위반 325건 증발, 화면은 무변화라
스크린샷 게이트도 못 잡는다). 두 형태 모두 유효한 CSS 다.

주석 제거도 check-css-budget 의 문자 스캐너로 통일한다 — 정규식은
content: \"/*\" 에 속는다."
```

---

### Task 7: 게이트를 집행 경로에 연결한다

**근거:** D §0. `verify-gates.mjs:199-213` 의 `cssGate()` 가 4개 중 2개만 돌린다.
가장 강한 두 게이트가 유일하게 집행되지 않는 두 게이트다.

**이 Task 는 Task 5·6 이 끝난 뒤에만 한다.** 빨간 게이트를 켜면 즉시 꺼진다.

**Files:**
- Modify: `scripts/verify-gates.mjs:199-213`
- Modify: `.github/workflows/parity.yml:103-106`

- [ ] **Step 1: 지금 상태를 확인한다**

```bash
node scripts/check-css-budget.mjs        ; echo "budget=$?"
node scripts/check-css-graph.mjs         ; echo "graph=$?"
node scripts/check-css-live-classes.mjs  ; echo "live=$?"
node scripts/check-css-surfaces.mjs --enforce all ; echo "surfaces=$?"
```
**네 개가 전부 0 이어야 다음 단계로 간다.** 아니면 Task 5 로 돌아간다.

- [ ] **Step 2: `cssGate()` 를 확장한다**

```js
// scripts/verify-gates.mjs:199
function cssGate() {
  const budget   = run("node", ["scripts/check-css-budget.mjs"]);
  const graph    = run("node", ["scripts/check-css-graph.mjs"]);
  const live     = run("node", ["scripts/check-css-live-classes.mjs"]);
  const surfaces = run("node", ["scripts/check-css-surfaces.mjs", "--enforce", "all"]);
  // 왜 네 개 다 도는가: 2026-09-17 리뷰 D §0 — surfaces 와 live-classes 가
  // 어떤 자동 경로에도 없어서, 표면 게이트가 2026-09-15 에 빨개진 것을
  // 이틀 동안 아무도 몰랐다.
  return [budget, graph, live, surfaces];
}
```
반환값을 쓰는 쪽(`:205-213`)이 배열 길이를 가정하고 있으면 같이 고친다.

- [ ] **Step 3: Actions 워크플로에도 추가한다**

`.github/workflows/parity.yml:103-106` 에 두 줄을 더한다. **Actions 는 리포 수준에서
꺼져 있지만**(`:98-100`, 마지막 실행 2026-08-04), 다시 켤 때를 대비해 맞춰 둔다.
워크플로 주석에 "현재 리포 설정상 실행되지 않음"을 명시한다.

- [ ] **Step 4: 전체 게이트 통과 확인 (본 체크아웃)**

```bash
npm run gates
```
기대: exit 0. CSS 게이트 4개가 출력에 보인다.

- [ ] **Step 5: 커밋**

```bash
git add scripts/verify-gates.mjs .github/workflows/parity.yml
git commit -m "fix(gates): CSS 게이트 4개를 전부 집행 경로에 넣는다

npm run gates 는 budget·graph 두 개만 돌리고 있었다. 표면 규칙 전체(R1-R6)를
보는 check-css-surfaces 와 check-css-live-classes 는 어떤 자동 경로에도 없었고,
Actions 는 리포 수준에서 꺼져 있다(마지막 실행 2026-08-04).

그래서 표면 게이트가 2026-09-15 에 빨개진 것을 이틀 동안 아무도 몰랐다."
```

---

### Task 8: 게이트가 거짓말하는 두 곳

**근거:** C §2 (R4 계약 역전), D §4.2 (R4 거짓 빨간불), B §4 (스테일 주석).

- [ ] **Step 1: R4 계약 역전을 결정한다**

`src/styles/TOKENS.md:148` 은 *"리터럴 폴백(`var(--x, #fff)`) 금지(게이트 R4)"* 라고
계약하는데, `scripts/check-css-surfaces.mjs:150-151` 은 정반대다:

```js
const fallbackOk = u.fallback !== null && (!/var\(/.test(u.fallback) || ...);
//                                          ^^^^^^^^^^^^^^^^^^^^^^^ 리터럴이면 무조건 통과
if (fallbackOk) continue;
```
문서가 **금지**한 것이 게이트에서는 **유일한 무조건 통과 조건**이다. 이것이 크림이
3주 넘게 살아남은 메커니즘이다(C §1.3 의 104건).

**두 방향 중 하나를 고른다:**
- (A) 코드를 문서에 맞춘다 — 리터럴 폴백을 위반으로 승격. 즉시 104건 + α 가 빨개지므로
  베이스라인에 유예하고 Phase 5 에서 표면별로 갚는다.
- (B) 문서를 코드에 맞춘다 — "리터럴 폴백 허용"으로 문서를 고친다.

**(A)를 권한다.** 리터럴 폴백은 "토큰이 없어도 괜찮다"는 뜻인데, 실제로는 토큰이 없어서
폐기된 팔레트가 조용히 렌더되는 통로였다. 다만 (A)는 Phase 5 와 묶여야 하므로
**이 Task 에서는 경고 모드로만 켜고** 베이스라인을 저장한다.

- [ ] **Step 2: R4 위반 메시지를 사실에 맞게 고친다**

`check-css-surfaces.mjs:153` 은 `--editor-panel-bg` 처럼 **`:root` 에 정의된 토큰**에 대해서도
`미정의 변수 ${u.name} (폴백 없음)` 이라고 말한다. 실제 문제는 "tokens 표면 밖에 정의됨"이다.
두 경우를 구분해 메시지를 나눈다:

```js
if (!tokenDefs.has(u.name) && !rootDefs.has(u.name)) {
  report(`미정의 변수 --${u.name} (정의가 어디에도 없다)`);
} else if (!tokenDefs.has(u.name)) {
  report(`표면 밖 토큰 --${u.name} (${defLocation(u.name)} 에 정의됨 — tokens.css 로 옮겨야 한다)`);
}
```

- [ ] **Step 3: 스테일 주석 3종을 지운다**

| 파일 | 주석이 말하는 것 | 실제 |
|---|---|---|
| `scripts/check-css-graph.mjs:15,24-25,110` | "고아 1 · 이중 5 · 미등록 2 · 충돌 1그룹, **전부 ALLOWLIST 유예라 초록**" | 전부 0, ALLOWLIST 4개 다 **비어 있음**. 초록의 이유는 유예가 아니라 **빚 청산** |
| `src/styles/runtime/pictures.css:1-3` | "playerRuntime.css 안의 unlayered 선언이 @layer runtime 보다 우선" | `playerRuntime.css` 는 **1줄짜리 `@import` 뿐, 선언 0개**. 전제가 비어 있다 |
| `src/styles/database/tabs-b-status-menu-main.css:369-371,378-382` | "이 파일은 unlayered 라 레이어드 규칙을 전부 이긴다" | `runtime/index.css:48` 이 **`layer(runtime)`** 로 들여온다. 언레이어가 아니다 |

**주의 (A §5):** 뒤 두 주석의 *결론*("pictures.css 는 못 이긴다")은 **우연히 맞다** —
직속 `runtime` 이 `runtime.runtime` 서브레이어를 이기기 때문이다. 하지만 *이유*가 틀렸고,
그 틀린 이유를 믿고 `pictures.css:4` 의 `@layer runtime {` 를 "중복이니 정리"하면
**알려진 버그(픽처 컨테이너에 흰 상자 + 파란 테두리)가 되살아난다.**
주석을 고칠 때 **왜 지우면 안 되는지**를 정확한 이유로 다시 쓴다.

- [ ] **Step 4: 커밋**

```bash
git add scripts/check-css-surfaces.mjs scripts/check-css-graph.mjs \
        src/styles/runtime/pictures.css src/styles/database/tabs-b-status-menu-main.css \
        src/styles/TOKENS.md scripts/css-surfaces.baseline.json
git commit -m "docs(css): 메커니즘을 거꾸로 설명하는 주석 3종과 R4 계약 역전을 고친다

- check-css-graph 헤더는 '유예 덕에 초록'이라고 하지만 ALLOWLIST 4개가 전부
  비어 있다. 정반대 인상을 준다.
- pictures.css / tabs-b-status-menu-main.css 의 'unlayered 라서 이긴다'는 설명은
  전제가 틀렸다(playerRuntime.css 는 선언 0개, 해당 시트는 layer(runtime)).
  결론은 우연히 맞지만 이유를 믿고 @layer 래퍼를 지우면 버그가 되살아난다.
- R4 는 TOKENS.md 가 금지한 리터럴 폴백을 유일한 무조건 통과 조건으로 삼고 있다.
  경고 모드로 켜고 베이스라인에 기록한다(승격은 Phase 5)."
```

---

# Phase 2 — 없는 게이트를 만든다: 승자 판정

**근거:** D §5. 가장 큰 단일 공백은 **"어느 선언이 이기는가"를 판정하는 게이트가 하나도
없다**는 것이다. 실측 재현된 무음 시나리오 4개가 전부 이 공백으로 들어온다:

| 변경 | 결과 | 현재 게이트 |
|---|---|---|
| `index.css:3` 의 `@layer` 순서 역순 | 에디터 전체가 다른 앱 | **4개 전부 통과**, 지문 해시까지 동일 |
| `tokens.css` hex 27개 흑백 치환 | 팔레트 전멸 | **전부 통과** (hex 는 *개수*만 셈) |
| `layer(database)` → `layer(base)` 109줄 | database 표면 강등 | **전부 통과** |
| `overrides.css` 에 `display:none !important` 30개 | UI 3종 소멸 | **전부 통과** (overrides 는 R3 면제) |

**재료는 이미 있다.** `css-flatten.mjs:177-211` 에 정확한 Selectors-4 특이도 계산기가,
`indexDeclarations()` 에 평탄화 순서 `seq` 가, `css-prune-shadowed.mjs` 에 가림 판정 로직이
있다. `runSurfaceChecks` 가 `seq` 를 **한 번도 참조하지 않을 뿐**이다.

### Task 9: `check-css-winners.mjs`

**Files:**
- Create: `scripts/check-css-winners.mjs`
- Create: `scripts/css-winners.baseline.json`
- Create: `test/checkCssWinners.test.ts`
- Modify: `package.json` (`gates:css` 에 추가)
- Modify: `scripts/verify-gates.mjs` (`cssGate()` 에 추가)

**Interfaces:**
- Consumes: `scripts/lib/css-import-re.mjs` 의 `parseImports` (Task 6), `css-flatten.mjs` 의
  `specificity()` / `emitOrder()` / `declarationsOf()`, `scripts/lib/css-entries.mjs` 의 `discoverEntries()`
- Produces: 기준선 형식

> **구현 중 초안에서 두 군데를 바꿨다. 둘 다 실측 때문이고, 바꾸지 않았으면 게이트가 무용지물이 됐다.**
>
> **(a) 래칫 값에서 줄 번호를 뺐다.** 초안의 `"<sheet>:<line>"` 를 그대로 쓰면 줄이 밀리는
> 것만으로 대량 오보가 난다 — `database/states.css` 맨 위에 주석 **한 줄**을 넣었더니
> "승자 121건 변경"이 떴고 전부 줄 밀림, 픽셀 변화는 0이었다. 양치기 소년이 된 게이트는
> 꺼진 게이트와 같다. 래칫은 `파일 [레이어] 값`, 줄 번호는 **보고할 때만** 현재 값을 쓴다.
>
> **(b) 값을 래칫에 넣었다.** 초안대로 위치만 적으면 D 시나리오 2(tokens.css hex 27개를
> 전부 흑백으로)가 승자 **위치**를 안 바꾸므로 통째로 무음이 된다. 값을 넣으니 72건이 잡혔다.
>
> 그리고 크기: 전체 텍스트로 쓰면 10.9 MB 였다(현존 최대 기준선은 0.72 MB). CSS 를 건드릴
> 때마다 다시 써지는 파일이라 그대로 쌓으면 안 된다. 색인 테이블 + 키 해시로 **2.86 MB** 로
> 줄였다 — 값은 78,668건 중 고유 6,223개뿐이라 테이블이 거의 공짜다.

```json
{ "generatedAt": "2026-09-17T…", "note": "…",
  "files": ["src/styles/…", …], "layers": ["database", …], "values": ["var(--bg-raised)", …],
  "entries": { "src/styles/index.css": {
      "contested": { "<키 해시>": "<선택자>|<속성>  (경쟁 2)" },
      "winners":   { "<키 해시>": "<fileIdx> <layerIdx> <valueIdx>" } } } }
```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// test/checkCssWinners.test.ts
import { describe, expect, it } from "vitest";
import { computeWinners } from "../scripts/check-css-winners.mjs";

const sheet = (name: string, css: string) => ({ name, css });

describe("computeWinners", () => {
  it("레이어 순서가 특이도를 이긴다", () => {
    const w = computeWinners({
      layerOrder: ["base", "app"],
      sheets: [
        sheet("a.css", "@layer app { .x { color: red } }"),
        sheet("b.css", "@layer base { #id.x.y.z { color: blue } }"),
      ],
    });
    expect(w[".x|color"]).toBe("a.css:1");   // 높은 레이어가 이긴다
  });

  it("언레이어가 모든 레이어를 이긴다", () => {
    const w = computeWinners({
      layerOrder: ["app"],
      sheets: [
        sheet("a.css", "@layer app { .x { color: red } }"),
        sheet("b.css", ".x { color: blue }"),
      ],
    });
    expect(w[".x|color"]).toBe("b.css:1");
  });

  it("서브레이어는 부모 직속에게 진다", () => {
    const w = computeWinners({
      layerOrder: ["app"],
      sheets: [
        sheet("a.css", "@layer app { @layer app { .x { color: red } } }"),
        sheet("b.css", "@layer app { .x { color: blue } }"),
      ],
    });
    expect(w[".x|color"]).toBe("b.css:1");
  });

  it("!important 는 레이어 순서를 뒤집는다", () => {
    const w = computeWinners({
      layerOrder: ["base", "app"],
      sheets: [
        sheet("a.css", "@layer app { .x { color: red } }"),
        sheet("b.css", "@layer base { .x { color: blue !important } }"),
      ],
    });
    expect(w[".x|color"]).toBe("b.css:1");   // 낮은 레이어의 important 가 이긴다
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run test/checkCssWinners.test.ts` → FAIL.

- [ ] **Step 3: 구현한다**

캐스케이드 우선순위를 **정확한 순서로** 적용한다. 이 순서를 틀리면 게이트가 거짓말을 한다:

1. **`!important` 여부** — important 선언끼리는 **레이어 순서가 역전**된다(낮은 레이어가 이김).
   언레이어 important 는 **가장 약하다**.
2. **레이어** — 언레이어(normal)가 가장 강하다. 서브레이어(`app.sub`)는 부모 직속(`app`)에게 진다.
3. **특이도** — `css-flatten.mjs:177-211` 재사용.
4. **문서 순서** — `indexDeclarations().seq`.

`@media`/`@container` 안의 규칙은 **조건을 키에 포함**한다(조건이 다르면 경쟁이 아니다).
`check-css-live-classes.mjs:120-122` 가 미디어 컨텍스트를 의도적으로 빼는 것과 **반대로** 간다 —
승자 판정에서는 조건이 본질이다.

- [ ] **Step 4: 통과 확인** — `npx vitest run test/checkCssWinners.test.ts` → PASS.

- [ ] **Step 5: 기준선을 뜬다**

```bash
node scripts/check-css-winners.mjs --save-baseline
node -e "const j=require('./scripts/css-winners.baseline.json');
for(const [e,m] of Object.entries(j.entries)) console.log(e, Object.keys(m).length)"
```
4개 진입점(index / database / event / player)에 대해 각각 수천 건이 나온다.

- [ ] **Step 6: 무음 시나리오 4개를 전부 잡는지 증명한다**

`/tmp` 복제본에서 D §3 의 네 변경을 각각 적용하고 게이트를 돌린다.

```bash
cp -r src scripts /tmp/wintest/ && cd /tmp/wintest
# 시나리오 1: 레이어 순서 역순
sed -i '3s/.*/@layer overrides, runtime, resources, database, event, map, shell, components, base, tokens;/' src/styles/index.css
node scripts/check-css-winners.mjs; echo "exit=$?"   # 기대: exit 1, 승자 대량 변경 보고
```
**네 시나리오가 전부 exit 1 이어야 한다.** 하나라도 통과하면 구현이 덜 된 것이다.

**실측 결과 (2026-09-17, `/tmp/wintest` 복제본):**

| 시나리오 | exit | 보고된 승자 변경 |
|---|---|---|
| 1. `@layer` 우선순위 역순 | **1** | 2건 |
| 2. tokens.css hex 27개 흑백화 | **1** | 72건 |
| 3. `@import "x"` → `@import url(x)` | 0 | 0건 — **Task 6 이 이미 막았다** |
| 4. overrides 레이어 `!important` 3줄 | **1** | 3건 |

시나리오 3 만 exit 0 인데, 이건 미탐이 아니라 **세탁 경로가 닫혔다는 증거**다. 파서를 하나로
합친 뒤로 `url()` 형태도 정상 등록되므로 시트가 숨지 않는다(평탄화 111개 시트 그대로, 대상
시트 포함 `true`). 시트를 **진짜로** 지우면(`@import` 줄 삭제) 승자 300건 변경으로 잡힌다.

**시나리오 1 이 2건뿐인 것은 이 게이트의 한계를 보여준다.** 승자 판정 키가 정확-선택자
문자열이라, 경쟁은 **같은 선택자 문자열**이 두 번 나올 때만 성립한다(전체 78,668키 중 545키,
1%). `.a .b` 와 `.b` 처럼 **겹치지만 다른** 선택자끼리의 경쟁은 DOM 매칭이 필요해서 이
게이트가 못 본다 — 그건 브라우저 승자 하네스(`.playwright-mcp/winners.mjs`, 27,045건)의
몫이다. 래칫으로서는 exit 1 이면 충분하지만, "승자 N건" 숫자를 영향 범위로 읽으면 안 된다.

- [ ] **Step 7: 게이트에 배선하고 커밋**

`package.json` 의 `gates:css` 와 `verify-gates.mjs` 의 `cssGate()` 양쪽에 넣는다.

```bash
git add scripts/check-css-winners.mjs scripts/css-winners.baseline.json \
        test/checkCssWinners.test.ts package.json scripts/verify-gates.mjs
git commit -m "feat(gates): (선택자,속성) 승자 래칫 게이트를 만든다

지금까지 '어느 선언이 이기는가'를 보는 게이트가 하나도 없었다. 그래서
index.css 의 @layer 순서를 통째로 뒤집어도, tokens.css 의 색을 전부 흑백으로
바꿔도, database 109줄을 layer(base) 로 강등해도 4개 게이트가 전부 통과했다
(지문 해시까지 동일).

재료는 이미 있었다 — css-flatten 의 Selectors-4 특이도 계산기와 seq.
runSurfaceChecks 가 seq 를 한 번도 안 썼을 뿐이다."
```

---

### Task 10: 게이트 초록을 믿을 수 있게 만드는 잔돌

**근거:** D §1.5, §6.

- [ ] **Step 1: `check-dead-css-classes.mjs` 에 주석 제거를 넣는다**

`:75-79` 의 `cssClassSet` 이 주석 안의 클래스명을 실재로 센다. `check-css-budget.mjs:89` 의
문자 스캐너를 재사용한다. **즉시 11종이 새로 빨개진다** — 그게 정상이고, 그만큼 이 게이트의
초록이 허위였다는 뜻이다. 빨개진 11종은 이 Task 에서 같이 정리하거나 베이스라인에 기록한다.

- [ ] **Step 2: 지금 빨간 37건을 갚는다**

```bash
node scripts/check-dead-css-classes.mjs --report
```
표본(`.db-ws-btn-ghost`, 15개 파일에서 발행)은 대응 규칙이 실제로 없다 — **진짜다.**
각각 (a) CSS 를 추가할지 (b) TS 에서 클래스를 뺄지 판단한다.

- [ ] **Step 3: 베이스라인에 만료 경고를 넣는다**

`dead-css-baseline.json` 은 **2026-09-01** 갱신 후 관련 커밋이 1,130개 지나갔다.
모든 베이스라인에 `generatedAt` 을 넣고, 30일이 넘으면 게이트가 경고를 출력하게 한다
(실패는 아니다 — 실패로 만들면 또 꺼진다).

- [ ] **Step 4: 커밋**

```bash
git commit -am "fix(gates): dead-css 가 주석 안 클래스를 실재로 세던 문제 + 베이스라인 만료 경고"
```

---

# Phase 3 — 수술 재개: `editor/` 소멸 (스펙 3단계)

여기부터는 **스펙의 3·4단계**다. event 표면에서 검증된 레시피를 그대로 쓴다.

**검증된 레시피 (event 표면 16커밋에서 추출)**
1. 미정의 변수·죽은 시트 정리 → 2. 표면 넘는 `!important` 를 `overrides` 로
→ 3. 가려진 선언 제거(`css-prune-shadowed`) → 4. 남의 표면 규칙을 주인에게 이동
→ 5. 진입 시트 + 레이어 → 6. 죽은 규칙 제거(`css-drop-dead`) → 7. 물리 이동
→ 8. `!important` 를 레이어 순서로 대체 → 9. 세대 → 구성 요소 재편 → 10. 게이트 승격

### Task 11: `editor/` 26파일을 주인 표면으로 물리 이동

**근거:** B §6. `editor/` 는 표면 레지스트리에 **없는 유령 디렉터리**다(11,740줄, 전체의 13.1%).
26개 파일은 각각 정확히 한 번씩 import 되며 분포는 **map 21 · shell 5** 다
(브리핑의 "3개 표면"은 B 가 반증했다 — database 는 `editor/` 를 직접 읽지 않는다).

**Files:**
- Move: `src/styles/editor/{21개}` → `src/styles/map/`
- Move: `src/styles/editor/{cluster-ai-modal,audio-test-dialog,help-modal,ai-settings-modal,local-diagnostics}.css` → `src/styles/shell/dialogs/`
- Modify: `src/styles/map/index.css:2-38`, `src/styles/shell/index.css:23-27`
- Modify: `scripts/css-surfaces.json` (`editor` unassigned 제거)

- [ ] **Step 1: 이동 전 승자 기준선을 뜬다**

```bash
node scripts/check-css-winners.mjs --save-baseline --out /tmp/winners-before.json
```

- [ ] **Step 2: `git mv` 로 옮긴다 (내용 불변)**

`git mv` 를 쓴다 — 이력이 끊기면 다음 사람이 `git log --follow` 로 이유를 못 찾는다.
**배럴의 import 순서는 그대로 둔다.** 경로만 바뀐다.

- [ ] **Step 3: 승자가 안 바뀐 것을 증명한다**

```bash
node scripts/check-css-winners.mjs --compare /tmp/winners-before.json
```
기대: **차이 0.** 파일 위치는 캐스케이드에 영향이 없어야 한다(배럴 순서 보존).
차이가 나오면 배럴 순서를 잘못 옮긴 것이다.

- [ ] **Step 4: `from-editor-*` 39개 파일명이 무의미해지는 문제를 처리한다**

`from-editor-*.css` 는 "editor 표면에서 옮겨 왔다"는 뜻인데 editor 표면이 사라진다.
**파일명을 바꾸지 않는다** — 39개를 개명하면 diff 가 폭발하고 `[레이어 보존]` 마커 130개의
근거 주석이 전부 깨진다. 대신 각 파일 헤더에 한 줄 추가:

```
/* 주: 원본 표면 `editor/` 는 2026-09-XX 에 map/·shell/dialogs/ 로 해체됐다(계획 Task 11).
   파일명의 `from-editor-` 는 역사적 출처 표기이며 현재 디렉터리를 뜻하지 않는다. */
```

원본이 이미 사라진 3개(`components/from-map-resource-system-part-2.css`,
`database/from-editor-event-editor-legacy-part-{1,2}.css`, 합계 1,516줄)는 헤더가
**존재하지 않는 원본**을 가리키고 있다(B §3.4) — 같이 고친다.

- [ ] **Step 5: 레지스트리에서 unassigned 를 없앤다**

```bash
node scripts/check-css-surfaces.mjs --enforce all | grep unassigned
```
기대: `editor` 26개가 사라지고 남는 unassigned 는 `index.css`·`dialogue.css`·
`player.css`·`benchmark/ui/styles.css` 4개뿐.

- [ ] **Step 6: 시각 동일 (본 체크아웃)** — `npm run shots:css` exit 0.

- [ ] **Step 7: 커밋 + PR**

```bash
git commit -m "refactor(css): editor/ 유령 디렉터리를 해체한다 — 21장은 map, 5장은 shell/dialogs

스펙 3단계. editor/ 는 표면 레지스트리에 없는데 11,740줄(전체 13.1%)이 거기
남아 남의 표면 배럴이 끌어가고 있었다. 배럴 순서를 보존해 옮겼으므로
승자 변화 0건(check-css-winners --compare 로 증명)."
```

---

### Task 12: `map`·`shell` 표면 접기

**Files:** `src/styles/map/**`, `src/styles/shell/**`

- [ ] **Step 1: 가려진 선언을 지운다**

```bash
node scripts/css-prune-shadowed.mjs --surface map --dry-run
node scripts/css-prune-shadowed.mjs --surface shell --dry-run
```
**도구의 맹점을 먼저 안다 (E §2.2):** `--all` 은 event 28시트와 database 67시트를 못 본다
(178 vs 표면별 합계 409). 표면별로 돌린 값을 신뢰한다.

- [ ] **Step 2: 죽은 규칙을 지운다** — `node scripts/css-drop-dead.mjs --surface map --dry-run`
  (R5 오판으로 살아 있는 규칙을 지울 수 있으니 dry-run 결과를 눈으로 검토한다.)

- [ ] **Step 3: `!important` 를 해체한다 — 실측 결과 해체 가능한 건 2개뿐이었다**

> **이 단계의 전제가 틀렸다.** 계획은 38개를 (a) 같은 표면 안 경쟁 (b) 다른 표면을 이기려는 것
> (c) 레이어로 이미 이김 으로 분류해 대부분 제거할 수 있다고 봤다. 실측은 반대였다.
>
> **먼저 승자 게이트로 판정하려다 실패했다.** 42개를 전부 떼고 돌렸더니 "승자 66건 변경"이
> 떴는데, 전부 **같은 선언이 값 문자열에서 `!important` 접미사만 잃은 것**이었다(파일·줄 동일).
> 승자 게이트는 **정확-선택자** 키로 경쟁을 보는데 `!important` 는 **서로 다른 선택자**가 같은
> 요소의 같은 속성을 다툴 때만 의미가 있다. 도구를 잘못 고른 것이다.
>
> **그래서 브라우저에 물었다** — CDP `CSS.getMatchedStylesForNode` 로 UI 모드 3종
> (beginner/standard/expert) 전부에서 요소마다 같은 속성을 선언하는 규칙 수를 셌다(36개 측정):
>
> | 판정 | 수 | 뜻 |
> |---|---|---|
> | 경쟁 있음 (선언자 2~5) | 23 | 플래그가 실제로 이기고 있다 — 건드리면 레이아웃이 바뀐다 |
> | DOM 에 없음 | 9 | 내가 도달 못한 상태(팔레트 커스텀 모드 등) — 판정 불가 |
> | 유일 선언 | 4 | 이길 상대가 없어 보였다 |
>
> **그 4개 중 2개도 실제로는 load-bearing 이었다.** `phaser-container > canvas` 의
> `width/height: 100% !important` 는 매치된 **규칙**만 세면 경쟁자가 없지만, Phaser 가
> 캔버스에 **인라인 스타일**(`width: 1152px; height: 803px`)을 직접 박는다. 작성자
> `!important` 는 인라인 normal 을 이기므로 이 플래그가 캔버스를 컨테이너에 맞추는 장치다.
> CDP 의 `matchedCSSRules` 에는 인라인이 안 들어오므로 프로브가 못 봤다.
>
> **결론: 42개 중 증명 가능하게 안전한 것은 2개뿐이다.** 그 둘만 뗐고(35개 남음), 나머지는
> 측정한 경쟁자 수를 주석으로 남겼다(스펙 R3 이 요구하는 «이유 주석» 을 이걸로 만족시킨다).
> 남은 것을 해체하려면 UI 모드 3종 × 팔레트 상태별로 요소 단위 캐스케이드를 다시 풀어야 하고,
> 그건 청소가 아니라 **회귀 위험이 있는 별도 과제**다.

- [ ] **Step 4: 파일 내 중복을 접는다** — E §1.2 의 880그룹 중 map·shell 몫.
  **파일 간 중복(718)보다 파일 내 중복(880)이 더 많다.** 세대 파일을 기능 이름으로 접으면서
  중첩이 파일 경계를 넘어 한 파일 안으로 옮겨갔다. 이름만 바뀐 곳을 실제로 접는다.

- [ ] **Step 5: 승자 동일 + 시각 동일** — `check-css-winners --compare` 차이 0,
  `npm run shots:css` exit 0.

- [ ] **Step 6: R2·R3·R5 를 `map`·`shell` 에 실패로 승격하고 커밋**

---

# Phase 4 — `database` 접기 (스펙 4단계, PR 4개)

44,501줄 / 114파일 / `!important` 283. **전체 CSS 의 44%이고 가장 큰 단일 덩어리다.**
스펙대로 4개 PR 로 자른다. 각 PR 은 Phase 3 과 같은 6단계를 반복한다.

- [ ] **Task 13 (4a): DB 셸·레일·목록** — `studio-v2.css`(1,665줄) 기준으로
  `light-theme`·`studio-theme`·`workspace-modern`·`desktop`·`sidebar`·`dock` 흡수.
  `studio-theme.css` 의 `!important` 65개(내전)와 `sidebar.css` 39개가 여기서 사라진다.
  **주의:** `light-theme` 과 `studio-theme` 이 같은 `.database-modal-backdrop` 스코프에
  차례로 붙고 studio 가 light 를 **전부 덮지는 않는다**(C §3.3). 흡수할 때 덮이지 않던
  6개 값(스크롤바 2개 포함)이 어떻게 되는지 명시적으로 결정한다.

- [ ] **Task 14 (4b): DB `modern/*` 탭** — `spatial-collections.css` 의 `!important` 63개(내전).
  E §3.2 의 "블록 통째 무장" 사례가 여기 있다(`:482` 한 규칙에 9개).

- [ ] **Task 15 (4c): 조수 패널** — `tabs-b-assistant-panel/*` 18파일.
  Task 5 에서 등록한 7계열(`ai-team-` 등)의 소유자다. 번호 결번 13~17 은
  **의도적 삭제**이므로(B §5.2) 재번호하지 않는다 — 번호가 곧 캐스케이드 순서다.

- [ ] **Task 16 (4d): 공간** — `spatial-*`, `desktop-record-shell/12-spatial-authoring.css`.
  Phase 0 Task 2 에서 레이어를 붙인 `spatial-composition.css` 가 여기 흡수된다.

**Task 13 에 앞서 처리할 것:** `desktop-record-shell/13-actor-studio.css` 가
`14-party-ux-fixes.css` **뒤에** 실린다(`database/index.css:68` vs `:83`, 사이에 무관한 시트 14장).
번호가 곧 순서라는 계약이 깨져 있다(B §5.3). 13 을 68행으로 올리면 그 사이 14장과의 승자가
뒤집히므로, **`check-css-winners --compare` 로 먼저 재고** 뒤집힘이 0 일 때만 옮긴다.
0 이 아니면 번호를 `15-actor-studio.css` 로 바꿔 실제 순서에 맞춘다.

---

# Phase 5 — 값 계층 정리

구조가 정리된 뒤에 한다. 순서를 바꾸면 값을 고치는 동안 구조가 또 움직인다.

- [ ] **Task 17: 토큰 값 중복 463건을 토큰 참조로 바꾼다** — C §4.2.
  `#4a57d6`(184건, `--accent` 와 동일)과 `#ffffff`(135건, `--on-accent`/`--bg-raised`)가
  1·2위다. **가장 많이 하드코딩된 색이 액센트 토큰 값 그 자체다.**
  기계적 치환이 가능하지만 `--accent` 와 `--brand-blue` 처럼 **같은 값 다른 의미**인
  토큰이 있으므로 문맥을 보고 고른다. 치환 후 `check-css-winners --compare` 차이 0.

- [ ] **Task 18: 치수 토큰을 실사용에 맞춘다** — C §6.
  채택률이 space 19.2% / radius 10.9% / font-size 6.8% / **stroke 2.5%** 다.
  두 방향 중 하나를 고른다: (A) 토큰을 강제한다(20,194건 치환 — 비현실적),
  (B) **실사용에 맞춰 토큰을 고친다.** (B)를 권한다:
  - `11px`(730건)·`13px`(367)·`3px`(510)·`5px`(394)·`7px`(308) 에 토큰이 **없다**.
    4px 그리드 계약이 실질적으로 없으므로, 계약을 실태에 맞추거나 폐기한다.
  - `--font-size-*` 는 2개인데 실사용 57종이다. 2·3위인 11px·13px 부터 토큰화한다.
  - **`--bp-*` 4개는 삭제한다.** CSS 커스텀 속성은 `@media` 조건절에서 **평가되지 않는다**
    (`@custom-media` 미채택). 처음부터 쓸 수 없는 토큰이고 참조 0건이다.
    실제 브레이크포인트는 49종이며 1px 차이 쌍이 7개(720↔721, 799↔800, 900↔901 …)다.
    이건 별도 과제로 뺀다 — 토큰 삭제만 여기서 한다.
  - `--z-below`·`--z-proposal` 도 참조 0건이다(C §7). 같이 판단한다.

- [ ] **Task 19: 포커스 링 3종을 하나로** — C §3.4.
  `2px/0.45`(정본) · `2px/0.35`(studio-theme) · `4px/0.55`(battle) 로 갈려 있다.
  키보드 사용자가 셸→DB모달→전투씬을 넘어갈 때마다 포커스 표시가 달라진다.
  전투씬은 게임 크롬이라 의도일 수 있으므로 **에디터 두 개만** 통일한다.

- [ ] **Task 20: 커밋된 플레이어 번들의 토큰 동결 해제** — C §3.5.
  `community-site/public/player-static/assets/player-BsonWbrb.css` 가 토큰 102개 사본을
  들고 있고 **이미 2개가 빠졌다**(`--z-canvas-veil`, `--z-tooltip`). 지금은 z-index 둘이라
  영향이 작지만 색 토큰이 바뀌는 순간 배포된 플레이어만 옛 팔레트로 남는다.
  빌드 산출물을 커밋에서 빼거나, 재생성을 릴리스 절차에 넣는다.

---

# Phase 6 — 설계 과제 (별도 스펙 필요)

### 레이어 선형 순서의 한계

**근거:** A §12 (A11). 이건 Task 가 아니라 **결정이 필요한 문제**다.

`shell < map < event < database` 는 의미에서 도출된 순서가 **아니다.** 이미 존재하던 승자
관계에 사후적으로 끼워 맞춘 근사치이고, 맞지 않는 곳을 **파일 이동으로 때웠다.**
영수증은 `from-*` 39개 파일 / **6,153줄** / `[레이어 보존]` 마커 130개다.

증거가 네 방향으로 난다:
- `database` 모달의 시네마틱 미리보기가 런타임 `.play-viewport` 를 덮어야 하는데
  `database < runtime` 이라 불가능 → 규칙을 `runtime/` 시트로 물리 이동
- `database` 시트가 shell `.topbar` 를 소유하고 있어 `shell/` 로 **강등**
- shell 규칙이 map 콘텐츠를 이겨야 해서 12개 파일 ~270규칙을 map 으로 **승격**
- 같은 두 레이어 사이에서 규칙이 **양방향으로** 오간다(map↔database)

마지막 항목이 핵심이다. **두 표면 사이에 단일한 우선순위 관계가 존재하지 않는다.**
선형 10단 순서로 표현할 수 없는 관계를 선형 순서로 표현하려다 6,153줄이 나왔다.

그리고 `index.css:1-2` 는 *"승자는 아래 레이어 순서로만 정해진다"* 라고 적혀 있는데,
그 부채는 각 `from-*` 파일 헤더에만 적혀 있다. **문서가 실태와 반대다.**

**선택지:**
- (A) 현상 유지 + 정직한 문서화 — `index.css` 헤더에 "선형 순서로 표현 안 되는 관계가
  130곳 있고 `from-*` 파일이 그 우회로다"를 명시. 비용 최소, 부채는 남는다.
- (B) 레이어를 표면이 아니라 **역할**로 재정의 — `reset < tokens < primitive < surface <
  feature < state < override` 처럼. 표면 간 관계를 순서가 아니라 스코프로 푼다. 비용 최대.
- (C) 중첩 레이어를 쓴다 — `@layer surface.shell, surface.map` 으로 묶고 표면 간 예외는
  `surface` 직속에 둔다. 중간 비용. **단 서브레이어 함정(A §4)을 먼저 문서화해야 한다.**

**이 계획은 (A)를 기본값으로 한다.** (B)·(C)는 Phase 4 가 끝나 실제 충돌 면적이 드러난 뒤
별도 스펙으로 판단한다. 지금 결정하면 근거 없이 결정하는 것이다.

### 서브레이어 함정의 문서화 (Phase 1 과 병행 가능)

**근거:** A §4 (A3). `@import "x.css" layer(components)` 로 들어오는 파일이 내부에 다시
`@layer components { }` 를 두면 `components.components` **서브레이어**가 되고, 서브레이어는
**부모 직속 규칙에게 진다.** 읽는 사람 눈에는 "이미 components 인데 한 번 더 적은 멱등 선언"으로
보이지만 우선순위가 바뀐다. 해당 파일 **10개**:

`components/{app-modal,empty-state,grid-4}.css` · `shell/editor-welcome.css` ·
`editor/world-panel.css` · `database/from-editor-world-panel.css` ·
`runtime/{touchpad,pictures,transitions,minimap}.css`

**오늘 실제로 뒤집히는 승자는 0건이다**(4개 번들 전수 조사). 잠복 함정이지 현행 버그가 아니다.
그러나 **"중복이니 정리"하려고 래퍼를 지우면 그 파일이 직속으로 승격해 버그가 난다** —
`pictures.css` 가 정확히 그 사례다(Task 8 Step 3 참조).

`src/styles/TOKENS.md` 에 이 메커니즘을 그림과 함께 적고, Task 9 의 승자 게이트가
래퍼 제거를 자동으로 잡도록 한다.

---

## 성공 기준

| 지표 | 현재 | Phase 2 후 | 최종 |
|---|---:|---:|---:|
| `npm run gates` 가 돌리는 CSS 게이트 | 2 / 4 | **5 / 5** | 5 / 5 |
| `check-css-surfaces --enforce all` | exit 1 (710) | **exit 0** | exit 0 |
| 승자 뒤집힘 탐지 | **불가능** | 4/4 시나리오 탐지 | 4/4 |
| 언레이어 규칙 (R1) | 37 | **0** | 0 |
| 실제 렌더되는 폐기 크림 | ~146 | ~115 | **0** |
| 미정의 `var()` (폴백 없음) | 95 | ~55 | **0** |
| `!important` — database | 283 | 283 | **0** (`overrides` ≤ 10) |
| `editor/` 디렉터리 | 26파일 11,714줄 | 26파일 | **소멸** |
| 파일 내 중복 그룹 | 880 | 880 | **< 100** |
| 색 리터럴 중 토큰 중복 | 463 | 463 | **0** |

**측정 불가 항목을 명시한다:** 총 줄 수는 목표가 아니다(스펙 §5 와 동일). 3개월 만에
22 → 289파일로 늘어난 것은 제품이 그만큼 자란 결과이기도 하다. 줄 수를 목표로 삼으면
Phase 5 에서 토큰 치환이 줄을 늘릴 때 잘못된 압력이 생긴다.

---

## 자체 검토

**1. 스펙 커버리지.** 스펙의 3단계 → Phase 3, 4단계 → Phase 4, 5단계 → Phase 1 Task 8 +
Phase 5. 스펙이 **다루지 않은** 것을 이 계획이 추가했다: 게이트 집행 실패(Phase 1),
승자 게이트 신설(Phase 2), 플레이어 다크 토큰(Phase 0 Task 1). 스펙 §2 가 `runtime/` 을
비목표로 뒀지만, 리뷰 결과 **실사용자에게 보이는 버그 3건이 전부 runtime 에 있어서**
Phase 0 에 넣었다. 이건 스펙에서 벗어나는 결정이므로 명시한다.

**2. 플레이스홀더 점검.** Task 1·6·9 는 실제 테스트 코드와 구현 스케치를 담았다.
Task 12~16 은 Phase 3 의 6단계를 반복하는 구조라 각 Step 을 다시 적지 않고 참조했다 —
**이건 의도적 축약이고, 실행 시 Task 11·12 를 템플릿으로 삼는다.** Phase 4 의 4개 Task 는
표면 크기가 커서 실행 직전에 각각 Task 11 수준으로 전개해야 한다.

**3. 타입·이름 일관성.** `parseImports`(Task 6) → Task 9 가 소비. `computeWinners`(Task 9) →
Task 11·12·13 이 `--compare` 로 소비. `check-css-winners.mjs` 이름을 전 Task 에서 통일했다.

**4. 순서 의존성.** Task 7(게이트 켜기)은 Task 5(노이즈 제거) 이후여야 한다 — 빨간 게이트를
켜면 즉시 꺼진다. Task 9(승자 게이트)는 Task 6(파서 통합) 이후여야 한다 — 세탁 경로가
열린 채로 승자를 재면 기준선이 거짓이 된다. Phase 3·4 는 Task 9 이후여야 한다 —
승자 비교 없이 대규모 이동을 하면 과거 사고(정확-선택자 승자 182건 역전)를 반복한다.

**5. 이 계획이 검증하지 못한 것.** 5축 리뷰 전부 `node_modules` 없이 수행됐다.
브라우저에서 실제 승자를 잰 적이 **한 번도 없다.** Phase 0 의 색상 판정은 CSS 캐스케이드
규칙에 따른 정적 추론이다. **Task 1 Step 6, Task 2 Step 5, Task 3 Step 5, Task 4 Step 4 의
"본 체크아웃에서 눈으로 본다"를 건너뛰면 이 계획은 근거를 잃는다.**
