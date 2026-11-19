/** @vitest-environment happy-dom */
// 첫 화면 「예제 열어 보기」 — 기본 게임 행은 편집기에서 연다. 바로 플레이하는 입구로 돌아가면 안 된다
// (Studio/런타임 분리 B안, http://mdc-server:18301/studio-runtime-split.html).
import { describe, expect, it, vi } from "vitest";
import { LOCALE_CHANGED_EVENT, setLocale } from "@/i18n";
import { createPromptHome, PROMPT_HOME_TESTIDS } from "@/start/firstRun/promptHome";
import { BUILTIN_GAMES, type BuiltinGameId } from "@/start/home/builtinGames";
import { coverArt, fillCover, isDefaultProjectTitle } from "@/start/home/homeView";
import { mountStartScreen } from "@/start/startScreen";

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

  it("updates native locale label and Studio strings in both directions, preserving authored titles", async () => {
    await setLocale("en");
    const home = createPromptHome({
      submit: async () => {}, openLocale: () => {}, builtin: () => {}, builtinEdit: () => {}, openFolder: () => {}, blank: () => {},
    });
    document.addEventListener(LOCALE_CHANGED_EVENT, home.syncLocale);
    document.body.append(home.element);
    const game = (title: string) => ({
      key: title, title, titleIsDefault: isDefaultProjectTitle(title), meta: "",
      cover: coverArt({ projectDir: title, title }, "fr-gcard-cov"),
    });
    const defaultGame = game("새 프로젝트");
    home.setGames([defaultGame, game("첫사랑")], 2);
    const read = () => ({
      locale: home.element.querySelector(".fr-locale span:last-child")?.textContent,
      more: home.element.querySelector(`[data-testid="${PROMPT_HOME_TESTIDS.gamesMore}"]`)?.textContent,
      blank: home.element.querySelector(".fr-gcard-new .fr-gcard-meta")?.textContent,
      projects: [...home.element.querySelectorAll(".fr-gcard:not(.fr-gcard-new) .fr-gcard-name")].map((el) => el.textContent),
      examples: [...home.element.querySelectorAll(".fr-bcard-name")].map((el) => el.textContent),
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(read()).toEqual({
        locale: "English", more: "See all (2)", blank: "Build it yourself without AI",
        projects: ["New project", "첫사랑"], examples: ["Fallen Star", "Astra Horizon", "First Love"],
      });
      await setLocale("ko");
      expect(read()).toEqual({
        locale: "한국어", more: "모두 보기 (2)", blank: "AI 없이 직접 그리기",
        projects: ["새 프로젝트", "첫사랑"], examples: ["폴른 스타", "아스트라 호라이즌", "첫사랑"],
      });
      await setLocale("ja");
      expect(read()).toMatchObject({ locale: "日本語", more: "すべて表示（2）", examples: ["フォールン・スター", "アストラ・ホライゾン", "初恋"] });
      await setLocale("zh");
      expect(read()).toMatchObject({ locale: "简体中文", more: "查看全部（2）", examples: ["陨落之星", "星穹地平线", "初恋"] });
      fillCover(defaultGame.cover, "data:image/jpeg;base64,/9j/", defaultGame.title);
      expect(defaultGame.cover.querySelector("img")).not.toBeNull();
      fillCover(defaultGame.cover, null, defaultGame.title);
      expect(defaultGame.cover.textContent).toBe("新");
    } finally {
      document.removeEventListener(LOCALE_CHANGED_EVENT, home.syncLocale);
      home.element.remove();
      await setLocale("ko");
      localStorage.clear();
    }
  });

  it("updates the overflow menu and both My games views when the locale changes", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const initialUrl = location.href;
    const initialHistoryState = history.state;
    const find = (testid: string) => host.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)!;
    const labels = () => ["first-run-more-create", "first-run-more-builtin"].map((id) => find(id).textContent);
    const initials = () => [...host.querySelectorAll("[data-cover-for] .hm-ph b")].map((cover) => cover.textContent);
    try {
      mountStartScreen(host, {
        recentProjects: async () => [
          { projectDir: "/games/default", title: "새 프로젝트" },
          { projectDir: "/games/authored", title: "첫사랑" },
        ],
        openFolder: async () => null,
        createProject: async () => null,
      });
      await vi.waitFor(() => expect(initials()).toHaveLength(2));
      find("first-run-more").click();
      expect(find("first-run-more").getAttribute("aria-expanded")).toBe("true");
      expect(labels()).toEqual(["아이디어 둘러보기", "예제 모두 보기"]);
      expect(initials()).toEqual(["새", "첫"]);
      await setLocale("en");
      expect.soft(labels()).toEqual(["Browse ideas", "See all examples"]);
      expect.soft(initials()).toEqual(["N", "첫"]);
      await setLocale("ja");
      expect.soft(labels()).toEqual(["アイデアを探す", "すべてのサンプルを見る"]);
      expect.soft(initials()).toEqual(["新", "첫"]);
      await setLocale("zh");
      expect.soft(labels()).toEqual(["浏览创意", "查看所有示例"]);
      expect.soft(initials()).toEqual(["新", "첫"]);
      await setLocale("ko");
      expect(labels()).toEqual(["아이디어 둘러보기", "예제 모두 보기"]);
      expect(initials()).toEqual(["새", "첫"]);

      find(PROMPT_HOME_TESTIDS.gamesMore).click();
      expect(host.dataset.view).toBe("games");
      await setLocale("en");
      expect(initials()).toEqual(["N", "첫"]);
    } finally {
      host.remove();
      history.replaceState(initialHistoryState, "", initialUrl);
      await setLocale("ko");
      localStorage.clear();
    }
  });
});
