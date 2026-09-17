import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 에디터 유래 런타임 리프(`src/styles/runtime/from-*.css`)가 **전투 어휘를 주어로** 갖지 못하게 막는다.
 *
 * 왜 필요한가 — 2026-09-11 Task 6.5 는 editor/core.part-2.css 의 규칙을 런타임 레이어로 바이트 그대로
 * 옮기면서, 출하 플레이어로 새지 않도록 앞에 특이도 0 의 `:where(body:has(.editor-layout))` 을 붙였다.
 * 그 가드는 플레이어에는 제대로 먹었지만, `.battle-*` 클래스를 달고 있는 DOM 은 이 저장소에 하나뿐이다 —
 * 런타임 전투 씬(battleFieldDom · battleCommandDom · qa/backBattlerHarness). 에디터의 「전투 테스트」는
 * 그 씬을 `.editor-layout` 아래에 마운트하므로, 저작자가 전투를 미리 보는 자리에서만 규칙이 살아나
 * 런타임 스타일을 덮었다. 실측 피해:
 *   · `.battle-enemy:disabled { opacity: 0.55 }` — 적 배틀러는 `<button>` 이고 대상 선택 국면이
 *     아니면 `disabled` 다. 전투 시간 대부분 몬스터가 55% 로 비쳤다.
 *   · `.battle-command-panel { flex-wrap: wrap; justify-content: flex-end }` — 타깃 메뉴가 다음 열로
 *     랩되어 오른쪽이 잘렸다(18-pokemon-layout-redesign.css 가 우회를 들고 있었다).
 *
 * 무엇이 허용되는가 — 에디터 **전용 컨테이너**에 앵커된 것은 괜찮다. 예: 자료집 패널의
 * `.db-command-css-preview .battle-command` 는 견본 마크업이라 실제 전투 씬에 닿지 않는다.
 * 금지되는 것은 `.battle-*` 가 **주어**인 규칙이다 — 특이도 0 가드를 벗기면 전투 씬 전체에 걸린다.
 */

const RUNTIME_DIR = resolve("src/styles/runtime");

/**
 * 앞에 붙은 특이도 0 가드(`:where(...)`)를 벗긴다. 괄호를 세어 짝을 맞춰야 한다 —
 * `/^:where\([^)]*\)/` 로 하면 `:where(body:has(.editor-layout))` 의 **안쪽** 괄호에서 멈춰
 * `) .battle-enemy` 가 남고, 주어가 `)` 로 읽혀 누수를 놓친다(이 테스트를 쓰다가 실제로
 * 거짓 초록을 냈다 — 지운 규칙을 되살려도 통과했다).
 */
function stripLeadingWhereGuards(selector: string): string {
  let rest = selector.trim();
  while (rest.startsWith(":where(")) {
    let depth = 0;
    let end = -1;
    for (let i = ":where".length; i < rest.length; i += 1) {
      const ch = rest[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) return rest; // 짝이 안 맞는 선택자 — 그대로 둔다
    rest = rest.slice(end + 1).trim();
  }
  return rest;
}

function selectorsOf(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  const preludes = Array.from(
    withoutComments.matchAll(/(^|[}{;])\s*([^{}@;]+?)\s*\{/gu),
    (match) => match[2].trim(),
  );
  return preludes.flatMap((prelude) => prelude.split(",").map((part) => part.trim())).filter(Boolean);
}

/** 가드를 벗긴 뒤 첫 컴파운드가 전투 어휘인가 — 그렇다면 전투 씬 전체가 대상이다. */
function battleVocabularyIsSubject(selector: string): boolean {
  const unguarded = stripLeadingWhereGuards(selector);
  const firstCompound = unguarded.split(/[\s>+~]+/u)[0] ?? "";
  return firstCompound.startsWith(".battle-");
}

describe("에디터 유래 런타임 리프", () => {
  it("전투 어휘를 주어로 갖는 규칙이 없다", async () => {
    // Given: 런타임 사슬에 실리는 모든 에디터 유래 리프.
    const names = (await readdir(RUNTIME_DIR)).filter((name) => name.startsWith("from-") && name.endsWith(".css"));
    expect(names.length, "from-*.css 리프를 하나도 못 찾았다 — 경로 규약이 바뀌었는지 확인할 것").toBeGreaterThan(0);

    // When: 주석을 벗기고 모든 선택자의 주어를 읽는다.
    const offending: string[] = [];
    for (const name of names) {
      const css = await readFile(resolve(RUNTIME_DIR, name), "utf8");
      for (const selector of selectorsOf(css)) {
        if (battleVocabularyIsSubject(selector)) offending.push(`${name}: ${selector}`);
      }
    }

    // Then: 하나도 없어야 한다. 에디터 전용 컨테이너에 앵커된 것(.db-… .battle-command)은 통과한다.
    expect(
      offending,
      "에디터 유래 리프가 .battle-* 를 주어로 삼으면 에디터 안 전투 미리보기가 실제 게임과 달라진다. " +
        "필요하면 에디터 전용 클래스를 새로 만들거나 에디터 컨테이너에 앵커할 것.",
    ).toEqual([]);
  });

  it("에디터 컨테이너에 앵커된 전투 견본은 허용한다 — 가드가 과하지 않은지 확인", () => {
    expect(battleVocabularyIsSubject(".db-command-css-preview .battle-command")).toBe(false);
    expect(battleVocabularyIsSubject(":where(body:has(.editor-layout)) .db-x .battle-command")).toBe(false);
    // 가드만 붙은 무앵커는 잡아낸다(이번에 지운 모양 그대로).
    expect(battleVocabularyIsSubject(":where(body:has(.editor-layout)) .battle-enemy:disabled")).toBe(true);
    expect(battleVocabularyIsSubject(":where(body:has(.editor-layout)) .battle-command-panel")).toBe(true);
  });
});
