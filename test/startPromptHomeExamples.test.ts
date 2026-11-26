/** @vitest-environment happy-dom */
// 첫 화면 「예제 열어 보기」 — 기본 게임 행은 편집기에서 연다. 바로 플레이하는 입구로 돌아가면 안 된다
// (Studio/런타임 분리 B안, http://mdc-server:18301/studio-runtime-split.html).
import { describe, expect, it, vi } from "vitest";
import { createPromptHome, PROMPT_HOME_TESTIDS } from "@/start/firstRun/promptHome";
import { BUILTIN_GAMES, type BuiltinGameId } from "@/start/home/builtinGames";

const { getAiConnectionStatus, refreshAiConnectionStatus, resetAiConnectionStatusCache, runAutoProviderPick } = vi.hoisted(() => ({
  getAiConnectionStatus: vi.fn<() => { kind: string; label: string }>(() => ({ kind: "disconnected", label: "ChatGPT 로그인 필요" })),
  refreshAiConnectionStatus: vi.fn(async () => {}),
  resetAiConnectionStatusCache: vi.fn(),
  // #4940: 첨 화면은 상태 요약 전에 연결 길을 자동으로 고른다. 이 시험은 «저장된 길의 배지 문구가 언어를 따라간다» 를 본다 —
  // 자동 고르기는 길을 바꾸지 않은 것(null)으로 두고, 불렸는지만 확인한다.
  runAutoProviderPick: vi.fn(async () => null),
}));
// mock 에 없는 export 를 읽으면 vitest 가 던져 배지가 빈 채 남는다(#4940 뒤 ci-full 45149079696 실패) — 첫 화면이 부르는 것을 모두 둔다.
vi.mock("@/editor/panels/aiConnectionStatus", () => ({ getAiConnectionStatus, refreshAiConnectionStatus, resetAiConnectionStatusCache }));
vi.mock("@/editor/panels/aiAutoProvider", () => ({ runAutoProviderPick }));

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

  it("다시 온 사람도 같은 한 장 — 내 게임 줄이 더해지고, 카드는 편집기로 연다", () => {
    const opened: string[] = [];
    const home = createPromptHome({
      submit: async () => {}, openLocale: () => {}, builtin: () => {}, builtinEdit: () => {}, openFolder: () => {}, blank: () => {},
      openGame: (key) => { opened.push(key); },
    });
    const section = home.element.querySelector<HTMLElement>(`[data-testid="${PROMPT_HOME_TESTIDS.games}"]`)!;
    expect(section.hidden).toBe(true);
    const game = (key: string) => ({ key, title: key, meta: "", cover: document.createElement("span") });
    home.setGames([game("/g/a"), game("/g/b"), game("/g/c"), game("/g/d")], 4);
    expect(section.hidden).toBe(false);
    const cards = [...section.querySelectorAll<HTMLButtonElement>(`[data-testid^="${PROMPT_HOME_TESTIDS.game}-"]`)];
    expect(cards.map((card) => card.dataset.testid)).toEqual([0, 1, 2, "new"].map((suffix) => `${PROMPT_HOME_TESTIDS.game}-${suffix}`));
    cards[1]!.click();
    expect(opened).toEqual(["/g/b"]);
    const more = section.querySelector<HTMLButtonElement>(`[data-testid="${PROMPT_HOME_TESTIDS.gamesMore}"]`)!;
    expect(more.hidden).toBe(false);
    expect(more.textContent).toContain("(4)");
    home.setGames([game("/g/a")], 1);
    expect(more.hidden).toBe(false);
    expect(more.textContent).toContain("(1)");
    home.setGames([], 1);
    expect(section.hidden).toBe(false);
    expect(more.hidden).toBe(false);
    expect([...home.element.querySelectorAll("button")].some((button) => /플레이/.test(button.textContent ?? ""))).toBe(false);
    home.setGames([], 0);
    expect(section.hidden).toBe(true);
  });
});
