/** @vitest-environment happy-dom */
// 첫 화면 「예제 열어 보기」 — 기본 게임 행은 편집기에서 연다. 바로 플레이하는 입구로 돌아가면 안 된다
// (Studio/런타임 분리 B안, http://mdc-server:18301/studio-runtime-split.html).
import { describe, expect, it } from "vitest";
import { createPromptHome, PROMPT_HOME_TESTIDS } from "@/start/firstRun/promptHome";
import { BUILTIN_GAMES, type BuiltinGameId } from "@/start/home/builtinGames";

describe("첫 화면 예제 행", () => {
  it("행을 누르면 그 게임을 편집기에서 연다", () => {
    const opened: BuiltinGameId[] = [];
    const home = createPromptHome({
      submit: async () => {},
      openLocale: () => {},
      builtin: () => {},
      builtinEdit: (id) => { opened.push(id); },
      openFolder: () => {},
      blank: () => {},
    });
    for (const game of BUILTIN_GAMES) {
      home.element.querySelector<HTMLButtonElement>(`[data-testid="${PROMPT_HOME_TESTIDS.builtinCard}-${game.id}"]`)!.click();
    }
    expect(opened).toEqual(BUILTIN_GAMES.map((game) => game.id));
    expect(home.element.querySelector("#fr-builtin-h")?.textContent).toContain("예제 열어 보기");
  });
});
