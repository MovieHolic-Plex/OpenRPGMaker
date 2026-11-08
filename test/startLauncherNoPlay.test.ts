/** @vitest-environment happy-dom */
// 시작 화면(런처)에는 「플레이」 입구가 없다 — 내 게임·예제는 편집기에서 연다(Studio/런타임 분리 B안).
// 카드 「⋯」는 열기·이름 바꾸기·목록에서 지우기뿐이고, 지우기는 확인을 거치며 폴더·파일은 건드리지 않는다고 말한다.
import { describe, expect, it } from "vitest";
import { HOME_TESTIDS, builtinShelf, myGamesShelf, type HomeActions } from "@/start/home/homeView";
import type { RecentProjectEntry } from "../electron/shared/start";

function recorder(): { readonly actions: HomeActions; readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    actions: {
      edit: (entry) => { calls.push(`edit:${entry.projectDir}`); },
      newGame: () => { calls.push("blank"); },
      home: () => { calls.push("home"); },
      openGameFile: () => { calls.push("file"); },
      rename: async (entry, title) => { calls.push(`rename:${entry.projectDir}:${title}`); },
      forget: async (entry) => { calls.push(`forget:${entry.projectDir}`); },
      builtinEdit: (id) => { calls.push(`builtin:${id}`); },
      openSettings: () => { calls.push("settings"); },
    },
  };
}

const entry: RecentProjectEntry = { projectDir: "/games/a", title: "A" };
const shelf = (actions: HomeActions, entries: readonly RecentProjectEntry[] = [entry]): HTMLElement =>
  myGamesShelf({ entries, titles: new Map(), meta: () => "", note: null, actions });
const byId = (root: ParentNode, id: string): HTMLElement => root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

describe("런처에 플레이 입구 없음", () => {
  it("내 게임·예제 어디에도 「플레이」 단추가 없고, 누르면 편집기로 간다", () => {
    const { actions, calls } = recorder();
    const host = document.createElement("div");
    host.append(shelf(actions), builtinShelf(actions));
    const labels = [...host.querySelectorAll("button")].map((button) => button.textContent?.trim() ?? "");
    expect(labels.some((label) => /플레이/.test(label))).toBe(false);
    byId(host, `${HOME_TESTIDS.game}-1`).click();
    for (const button of host.querySelectorAll<HTMLButtonElement>("[data-testid^='start-builtin-edit-']")) button.click();
    expect(calls.filter((call) => call.startsWith("edit:"))).toEqual(["edit:/games/a"]);
    expect(calls.filter((call) => call.startsWith("builtin:"))).not.toHaveLength(0);
  });
});

describe("내 게임 카드 ⋯ 메뉴", () => {
  it("게임이 몇 개든 전부 보인다(20개)", () => {
    const { actions } = recorder();
    const entries = Array.from({ length: 20 }, (_, index) => ({ projectDir: `/g/${index}`, title: `G${index}` }));
    // 카드 ⋯ 메뉴 항목(start-world-menu-*)도 같은 접두를 쓴다(252b218eab) — 카드 단추 자체(start-world-<번호>)만 센다.
    const cards = [...shelf(actions, entries).querySelectorAll(`[data-testid^="${HOME_TESTIDS.game}-"]`)]
      .filter((node) => new RegExp(`^${HOME_TESTIDS.game}-\\d+$`).test(node.getAttribute("data-testid") ?? ""));
    expect(cards).toHaveLength(20);
  });

  it("이름 바꾸기는 새 제목을 저장하고 대화상자를 닫는다", async () => {
    const { actions, calls } = recorder();
    const host = document.createElement("div");
    document.body.append(host);
    host.append(shelf(actions));
    byId(host, `${HOME_TESTIDS.cardMenu}-1`).click();
    byId(host, `${HOME_TESTIDS.menuRename}-1`).click();
    const input = byId(document.body, HOME_TESTIDS.renameInput) as HTMLInputElement;
    input.value = "  새 이름  ";
    byId(document.body, HOME_TESTIDS.renameSave).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toContain("rename:/games/a:새 이름");
    expect(document.body.querySelector(`[data-testid="${HOME_TESTIDS.renameDialog}"]`)).toBeNull();
    host.remove();
  });

  it("목록에서 지우기는 확인 문구를 보이고, 확인해야만 지운다", async () => {
    const { actions, calls } = recorder();
    const host = document.createElement("div");
    document.body.append(host);
    host.append(shelf(actions));
    byId(host, `${HOME_TESTIDS.cardMenu}-1`).click();
    byId(host, `${HOME_TESTIDS.menuForget}-1`).click();
    const dialog = byId(document.body, HOME_TESTIDS.forgetDialog);
    expect(dialog.textContent).toContain("파일은 지워지지 않아요");
    expect(calls.some((call) => call.startsWith("forget:"))).toBe(false);
    byId(dialog, HOME_TESTIDS.dialogCancel).click();
    expect(calls.some((call) => call.startsWith("forget:"))).toBe(false);
    byId(host, `${HOME_TESTIDS.cardMenu}-1`).click();
    byId(host, `${HOME_TESTIDS.menuForget}-1`).click();
    byId(document.body, HOME_TESTIDS.forgetConfirm).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toContain("forget:/games/a");
    expect(document.body.querySelector(`[data-testid="${HOME_TESTIDS.forgetDialog}"]`)).toBeNull();
    host.remove();
  });
});
