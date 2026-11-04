/** @vitest-environment happy-dom */
// 시작 화면(런처)에는 「플레이」 입구가 없다 — 내 게임·예제는 편집기에서 연다(Studio/런타임 분리 B안).
import { describe, expect, it } from "vitest";
import { builtinHomeShelf, builtinShelf, continueHero, firstRunHero, myGamesShelf, type HomeActions } from "@/start/home/homeView";
import type { RecentProjectEntry } from "../electron/shared/start";

function recorder(): { readonly actions: HomeActions; readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    actions: {
      edit: (entry) => { calls.push(`edit:${entry.projectDir}`); },
      newGame: () => { calls.push("new"); },
      openGameFile: () => { calls.push("file"); },
      builtinEdit: (id) => { calls.push(`builtin:${id}`); },
      openSettings: () => { calls.push("settings"); },
    },
  };
}

const entry: RecentProjectEntry = { projectDir: "/games/a", title: "A" };

describe("런처에 플레이 입구 없음", () => {
  it("배너·내 게임·예제 어디에도 「플레이」 단추가 없고, 누르면 편집기로 간다", () => {
    const { actions, calls } = recorder();
    const host = document.createElement("div");
    host.append(
      continueHero(entry, "A", "", actions),
      firstRunHero(actions),
      myGamesShelf({ entries: [entry], titles: new Map(), meta: () => "", showAll: true, onToggleAll: () => {}, note: null, actions }),
      builtinHomeShelf(actions, () => {}),
      builtinShelf(actions),
    );
    const labels = [...host.querySelectorAll("button")].map((button) => button.textContent?.trim() ?? "");
    expect(labels.some((label) => /플레이/.test(label))).toBe(false);
    for (const button of host.querySelectorAll<HTMLButtonElement>("button")) button.click();
    expect(calls.filter((call) => call.startsWith("edit:"))).not.toHaveLength(0);
    expect(calls.filter((call) => call.startsWith("builtin:"))).not.toHaveLength(0);
  });
});
