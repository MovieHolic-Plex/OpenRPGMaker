// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openLicenseDialog, PLAYER_CREDITS, withStoreCredits } from "@/player/titleLicenseNotice";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "Asset credits" }));
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function () {
    this.open = true;
  });
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  });
});

afterEach(() => {
  document.querySelectorAll("dialog").forEach((dialog) => dialog.close());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("title credits keyboard ownership", () => {
  it.each(["Escape", "x", "X", "Enter", "z", "Z", " ", "e"])("closes with %s before document handlers", async (key) => {
    const onClose = vi.fn();
    openLicenseDialog(onClose);
    await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
    const button = document.querySelector<HTMLButtonElement>(".rm-license-dialog-close")!;
    expect(document.activeElement).toBe(button);
    const behind = vi.fn();
    document.addEventListener("keydown", behind, true);
    try {
      const repeat = new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true });
      button.dispatchEvent(repeat);
      expect(onClose).not.toHaveBeenCalled();
      const press = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      button.dispatchEvent(press);
      expect(press.defaultPrevented).toBe(true);
      expect(behind).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(document.querySelector("dialog")).toBeNull();
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      expect(behind).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("keydown", behind, true);
    }
  });

  it("scrolls the notice with arrows and page keys without closing", async () => {
    openLicenseDialog();
    await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
    const body = document.querySelector<HTMLElement>(".rm-license-dialog-body")!;
    const button = document.querySelector<HTMLButtonElement>(".rm-license-dialog-close")!;
    expect(document.querySelector("#title-credits-hint")?.textContent).toBe("↑↓ 로 읽고, Esc 로 닫습니다");
    expect(body.getAttribute("aria-label")).toBe("저작자 표기");
    expect(body.tabIndex).toBe(0);
    const press = (key: string): KeyboardEvent => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      button.dispatchEvent(event);
      return event;
    };
    const down = press("ArrowDown");
    expect(down.defaultPrevented).toBe(true);
    expect(body.scrollTop).toBe(32);
    expect(document.querySelector("dialog[open]")).not.toBeNull();
    const page = Math.max(96, Math.round((body.clientHeight || 256) * 0.85));
    press("PageDown");
    expect(body.scrollTop).toBe(32 + page);
    press("Home");
    expect(body.scrollTop).toBe(0);
    press("End");
    expect(body.scrollTop).toBe(body.scrollHeight);
    press("ArrowUp");
    expect(body.scrollTop).toBe(Math.max(0, body.scrollHeight - 32));
    const behind = vi.fn();
    document.addEventListener("keydown", behind, true);
    try {
      press("PageUp");
      expect(behind).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", behind, true);
    }
    expect(document.querySelector("dialog[open]")).not.toBeNull();
  });
});

describe("title credits include asset store items", () => {
  it("appends store credits after the base notice and leaves it alone without store items", async () => {
    expect(withStoreCredits("Base", "")).toBe("Base");
    const origin = { store: "https://store.example", itemSlug: "forest-pack", version: 2, title: "숲 마을 팩", author: "숲 작가", license: "CC-BY-4.0", aiGenerated: true, credits: "그림: 숲 작가", url: "https://store.example/items/forest-pack" };
    const project = { tilesets: {}, assets: { uploaded: { store_forest_pack__sheet: { id: "store_forest_pack__sheet", name: "숲", kind: "chipset", meta: {}, origin } } } } as unknown as Project;
    vi.spyOn(store, "getCurrent").mockReturnValue(project);
    openLicenseDialog();
    await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
    const body = document.querySelector(".rm-license-dialog-body")!.textContent!;
    expect(body.startsWith("만든 도구")).toBe(true);
    expect(body).not.toContain("Asset credits");
    expect(body).toContain("OPRN 에셋 스토어");
    expect(body).toContain("「숲 마을 팩」 — 숲 작가 · CC-BY-4.0 · AI 생성 포함");
    expect(body).toContain("그림: 숲 작가");
  });
});

describe("title credits are written for players", () => {
  it("shows the short Korean credits first, without fetching the developer attribution document", async () => {
    openLicenseDialog();
    await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
    expect(fetch).not.toHaveBeenCalled();
    const body = document.querySelector<HTMLElement>(".rm-license-dialog-body")!;
    const headings = [...body.querySelectorAll(".rm-license-dialog-heading")].map((node) => node.textContent);
    expect(headings).toEqual(["만든 도구", "음악과 효과음", "그림", "글꼴", "라이선스"]);
    expect(body.textContent).not.toContain("Asset credits");
    // 개발 기록·파일 경로는 플레이어가 읽는 글에 없다.
    expect(body.textContent).not.toMatch(/public\/|src\/|scripts\/|\.png|\.ts\b|`/);
  });

  it("keeps every credit a licence or a permission requires", () => {
    // CC BY 4.0: 저작자·라이선스·출처·변경 사실·보증 없음.
    for (const author of ["Garakuta", "Juan Manuel Nigretti", "Marina Navarro Travesset", "MrBeast", "Orochii Zouveleki", "R.C.O.",
      "Stephen Challener (Redshrike)", "Tom Lemmens", "VictorSena", "andwhyisit", "kou", "lumiscosity", "russidan (Alephman)"]) {
      expect(PLAYER_CREDITS).toContain(author);
    }
    expect(PLAYER_CREDITS).toContain("https://github.com/EasyRPG/RTP");
    expect(PLAYER_CREDITS).toContain("Scarloxy (Ismael Garcia)");
    expect(PLAYER_CREDITS).toContain("https://scarloxy.itch.io/mpwsp01");
    expect(PLAYER_CREDITS).toContain("https://creativecommons.org/licenses/by/4.0/");
    expect(PLAYER_CREDITS).toContain("고쳐 그렸습니다");
    expect(PLAYER_CREDITS).toContain("보증하거나 후원하지 않습니다");
    // REFMAP 표기 줄은 원문 그대로.
    expect(PLAYER_CREDITS).toContain("REFMAP (http://refmap.wixsite.com/fsm-material), modified");
    // 저작자가 크레딧 표기를 조건으로 허락한 윤문 규칙.
    expect(PLAYER_CREDITS).toContain("general-good-writing, 코드 연규(code-yeongyu)");
    // OPRN BGM 은 사람이 지은 곡처럼 적지 않는다.
    expect(PLAYER_CREDITS).toContain("OPRN BGM (AI 로 만든 음악, Google Lyria)");
  });

  it("opens the full attribution document only from its button, by mouse or by keyboard", async () => {
    openLicenseDialog();
    await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
    const body = document.querySelector<HTMLElement>(".rm-license-dialog-body")!;
    const close = document.querySelector<HTMLButtonElement>(".rm-license-dialog-close")!;
    const full = document.querySelector<HTMLButtonElement>("[data-testid='title-credits-full']")!;
    expect(full.textContent).toBe("전체 출처 문서 (영문)");
    expect(document.activeElement).toBe(close);
    const press = (key: string): void => {
      (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    };
    press("ArrowLeft");
    expect(document.activeElement).toBe(full);
    press("ArrowRight");
    expect(document.activeElement).toBe(close);
    press("ArrowLeft");
    press("Enter");
    await vi.waitFor(() => expect(body.textContent).toBe("Asset credits"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(document.querySelector("dialog[open]")).not.toBeNull();
    expect(document.querySelector("[data-testid='title-credits-full']")).toBeNull();
    expect(document.activeElement).toBe(close);
    press("Escape");
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("closes with Escape even while the full-document button has focus", async () => {
    const onClose = vi.fn();
    openLicenseDialog(onClose);
    await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
    const full = document.querySelector<HTMLButtonElement>("[data-testid='title-credits-full']")!;
    full.focus();
    full.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
});
