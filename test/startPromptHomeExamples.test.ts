/** @vitest-environment happy-dom */
// 첫 화면 「예제 열어 보기」 — 기본 게임 행은 편집기에서 연다. 바로 플레이하는 입구로 돌아가면 안 된다
// (Studio/런타임 분리 B안, http://mdc-server:18301/studio-runtime-split.html).
import { describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { LOCALE_CHANGED_EVENT, setLocale } from "@/i18n";
import { createPromptHome, PROMPT_HOME_TESTIDS } from "@/start/firstRun/promptHome";
import { BUILTIN_GAMES, type BuiltinGameId } from "@/start/home/builtinGames";
import { coverArt, fillCover, isDefaultProjectTitle } from "@/start/home/homeView";
import { LOCAL_AGENTS_FLAG_KEY, saveEngineChoice } from "@/start/settings/localAgents";
import { mountStartScreen } from "@/start/startScreen";

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

  it.each([
    { mode: "ChatGPT", tone: "ok", ja: "ChatGPT接続済み · gpt-6.2-sol", en: "ChatGPT connected · gpt-6.2-sol", zh: "ChatGPT 已连接 · gpt-6.2-sol", ko: "ChatGPT 연결됨 · gpt-6.2-sol" },
    { mode: "Claude Code", tone: "ok", ja: "Claude Code · 接続済み", en: "Claude Code · Connected", zh: "Claude Code · 已连接", ko: "Claude Code · 연결됨" },
    { mode: "disconnected", tone: "off", ja: "AI 接続", en: "AI connection", zh: "AI 连接", ko: "AI 연결" },
  ])("updates the $mode badge when the locale changes", async ({ mode, tone, ja, en, zh, ko }) => {
    const initialUrl = location.href;
    const initialHistoryState = history.state;
    const host = document.createElement("div");
    document.body.append(host);
    try {
      history.replaceState(null, "", "#home");
      localStorage.setItem(LOCAL_AGENTS_FLAG_KEY, "0");
      if (mode === "ChatGPT") {
        getAiConnectionStatus.mockReturnValueOnce({ kind: "ready", label: "ChatGPT 연결됨" });
        localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "openai-codex", model: "gpt-6.2-sol" }));
      } else if (mode === "Claude Code") {
        saveEngineChoice({ kind: "local-cli", cli: "claude" });
      }
      await setLocale("ja");
      mountStartScreen(host, undefined);
      const badge = host.querySelector<HTMLButtonElement>(`[data-testid="${PROMPT_HOME_TESTIDS.aiStatus}"]`)!;
      await vi.waitFor(() => expect(badge.textContent).toBe(ja), { timeout: 2_000 });
      expect(badge.hidden).toBe(false);
      expect(badge.dataset.tone).toBe(tone);
      expect(runAutoProviderPick).toHaveBeenCalled();
      const checks = refreshAiConnectionStatus.mock.calls.length;
      for (const [locale, text] of [["en", en], ["zh", zh], ["ko", ko], ["ja", ja]] as const) {
        await setLocale(locale);
        expect(badge.textContent).toBe(text);
      }
      expect(refreshAiConnectionStatus).toHaveBeenCalledTimes(checks);
    } finally {
      host.remove();
      history.replaceState(initialHistoryState, "", initialUrl);
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
