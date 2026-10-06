// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openLicenseDialog, withStoreCredits } from "@/player/titleLicenseNotice";
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
    expect(body.startsWith("Asset credits")).toBe(true);
    expect(body).toContain("OPRN 에셋 스토어");
    expect(body).toContain("「숲 마을 팩」 — 숲 작가 · CC-BY-4.0 · AI 생성 포함");
    expect(body).toContain("그림: 숲 작가");
  });
});
