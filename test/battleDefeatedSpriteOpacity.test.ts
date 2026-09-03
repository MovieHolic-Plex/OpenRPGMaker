// 쓰러진 적 **필드 스프라이트**의 불투명도는 퇴장 연출(`battle-death-dissolve`, 2026-09-03 전에는 battle-death-fade)만 소유한다.
//
// 왜 정적 선언을 금지하는가: 막타가 들어가는 프레임에는 스킨의 피격 juice
// (`rm2000-juice-hit` 등)가 `animation` 숏핸드를 가져가 `battle-death-dissolve` 가 돌지
// 못한다. 그때 남는 것은 정적 `opacity` 뿐이라 그 값이 그대로 화면에 드러난다.
// 실측(2026-09-01, troop_slime_pair): 임팩트 시점 `.battle-enemy` computed opacity
// = 0.42, animation = rm2000-juice-hit → 슬라임 몸통으로 배경 구름이 비쳤다.
//
// `.battle-enemy-list-row.defeated`(하단 목록의 **텍스트 행**)는 대상이 아니다.
// 거기서는 흐리게 죽인 표시가 올바른 표현이다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const RUNTIME_STYLES = join(ROOT, "src/styles/runtime");

/** /* ... *\/ 주석을 공백으로 치환해 주석 속 값이 잡히지 않게 한다(줄 번호 보존). */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...cssFiles(full));
    else if (entry.endsWith(".css")) out.push(full);
  }
  return out;
}

type Offender = { file: string; line: number; selector: string; value: string };

/**
 * `.battle-enemy.defeated` 를 겨냥하는 규칙 블록에서 1 미만의 정적 opacity 를 모은다.
 * 블록 분해는 `}` 기준의 소박한 방식이다 — 이 저장소의 전투 CSS 는 중첩을 쓰지 않는다
 * (@media/@keyframes 는 아래에서 걸러낸다).
 */
function staticDefeatedSpriteOpacity(): Offender[] {
  const offenders: Offender[] = [];
  for (const file of cssFiles(RUNTIME_STYLES)) {
    const clean = stripComments(readFileSync(file, "utf8"));
    let cursor = 0;
    for (const chunk of clean.split("}")) {
      const startLine = clean.slice(0, cursor).split("\n").length;
      cursor += chunk.length + 1;
      const brace = chunk.indexOf("{");
      if (brace === -1) continue;
      const selector = chunk.slice(0, brace).replace(/\s+/g, " ").trim();
      const body = chunk.slice(brace + 1);
      // @keyframes 의 퍼센트 스텝은 선택자가 아니다. 퇴장 연출 자체는 허용 대상이다.
      if (!selector || /^\d/.test(selector) || selector.startsWith("@")) continue;
      // 쓰러진 적을 가리키는 표현이 둘이다: `.defeated` 클래스와 `[data-battle-pose="dead"]`.
      // 실측에서 06 의 `.defeated{opacity:.42}` 를 지웠더니 05 의 pose 규칙 0.35 가
      // 그대로 드러났다 — 한쪽만 막으면 반드시 다른 쪽이 새어 나온다.
      const targetsSprite = selector
        .split(",")
        .map((s) => s.trim())
        .some((s) => /\.battle-enemy(?![\w-])/.test(s)
          && (/\.defeated(?![\w-])/.test(s) || /\[data-battle-pose\s*=\s*["']?dead["']?\]/.test(s)));
      if (!targetsSprite) continue;
      const match = /(?:^|[;{\s])opacity\s*:\s*([\d.]+)/.exec(body);
      if (!match) continue;
      if (Number.parseFloat(match[1]) >= 1) continue;
      offenders.push({
        file: file.slice(ROOT.length + 1),
        line: startLine + body.slice(0, match.index).split("\n").length - 1,
        selector,
        value: match[1],
      });
    }
  }
  return offenders;
}

describe("쓰러진 적 스프라이트 불투명도", () => {
  it("정적 opacity 선언이 없다 — 퇴장 연출만 불투명도를 소유한다", () => {
    const offenders = staticDefeatedSpriteOpacity();
    expect(
      offenders,
      `.battle-enemy.defeated 에 정적 opacity 가 남아 있으면 막타 프레임에 그대로 드러난다:\n`
        + offenders.map((o) => `  ${o.file}:${o.line} { ${o.selector} } opacity: ${o.value}`).join("\n"),
    ).toEqual([]);
  });

  it("퇴장 연출(battle-death-dissolve)은 여전히 존재한다", () => {
    const css = readFileSync(join(RUNTIME_STYLES, "battle/15-juice-capture-fx.css"), "utf8");
    expect(css).toContain("battle-death-dissolve");
    expect(stripComments(css)).toMatch(/@keyframes\s+battle-death-dissolve/);
  });
});
