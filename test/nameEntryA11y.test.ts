// @vitest-environment happy-dom
// 이름 입력은 모달인데 이름이 없었고, 방향키로 고른 글자는 포커스가 안 옮겨 읽히지 않았다.
import { afterEach, describe, expect, it } from "vitest";
import { showNameEntry } from "@/player/nameEntry/nameEntryOverlay";
import { charAt, pageById } from "@/player/nameEntry/hangulTable";
import { updatePlayerPreferences } from "@/player/playerPreferences";

afterEach(() => {
  document.body.replaceChildren();
  updatePlayerPreferences({ reduceMenuMotion: false });
});

function press(key: string): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

describe("name entry accessibility", () => {
  it("names the dialog with the prompt and announces the character under the arrow keys", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = showNameEntry(host, {
      currentName: "",
      maxLength: 6,
      showInitialName: false,
      prompt: "주인공의 이름",
    });
    void pending.catch(() => undefined);

    const dialog = host.querySelector<HTMLElement>("[data-testid='runtime-name-entry']");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("runtime-name-entry-title");
    expect(host.querySelector("#runtime-name-entry-title")?.textContent).toBe("주인공의 이름");
    expect(host.querySelector("[data-testid='runtime-name-entry-input']")?.getAttribute("aria-label")).toBe("주인공의 이름");
    expect(host.querySelector(".name-entry-tabs")?.getAttribute("aria-label")).toBe("문자 종류");
    expect(host.querySelector("[data-testid='runtime-name-entry-grid']")?.getAttribute("aria-label")).toBe("문자표 가나다");

    const announcement = host.querySelector("[data-testid='runtime-name-entry-announcement']");
    expect(announcement?.getAttribute("role")).toBe("status");
    expect(announcement?.textContent).toBe("");
    expect(host.querySelector(".name-entry-key[aria-current='true']")?.textContent).toBe("가");

    const next = charAt(pageById("hangul"), { row: 0, col: 1 });
    press("ArrowRight");
    expect(announcement?.textContent).toBe(next);
    expect(host.querySelector(".name-entry-key[aria-current='true']")?.textContent).toBe(next);

    const latin = pageById("latin");
    press("Tab");
    expect(announcement?.textContent).toBe(`${latin.label}, ${charAt(latin, { row: 0, col: 0 })}`);
    const space = [...host.querySelectorAll<HTMLButtonElement>(".name-entry-key")].find((button) => button.textContent === "␣");
    expect(space?.getAttribute("aria-label")).toBe("공백");

    host.querySelector<HTMLButtonElement>("[data-testid='runtime-name-entry-confirm']")?.click();
    expect(host.querySelector("[data-testid='runtime-name-entry']")).toBeNull();
  });

  it("falls back to the default title when the prompt is blank", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = showNameEntry(host, { currentName: "린", maxLength: 6, showInitialName: false, prompt: "  " });
    void pending.catch(() => undefined);
    expect(host.querySelector("#runtime-name-entry-title")?.textContent).toBe("이름 입력");
    expect(host.querySelector("[data-testid='runtime-name-entry-input']")?.getAttribute("aria-label")).toBe("이름 입력");
    host.querySelector<HTMLButtonElement>("[data-testid='runtime-name-entry-confirm']")?.click();
  });

  it("skips the showcase burst when menu motion is reduced", async () => {
    updatePlayerPreferences({ reduceMenuMotion: true });
    const host = document.createElement("div");
    document.body.append(host);
    const pending = showNameEntry(host, {
      currentName: "린",
      maxLength: 6,
      showInitialName: true,
      showcase: { hero: null },
    });
    const dialog = host.querySelector<HTMLElement>("[data-testid='runtime-name-entry']");
    expect(dialog?.dataset.reducedMotion).toBe("true");
    host.querySelector<HTMLButtonElement>("[data-testid='runtime-name-entry-confirm']")?.click();
    expect(host.querySelector("[data-testid='runtime-name-entry']")).toBeNull();
    await expect(pending).resolves.toBe("린");
  });
});
