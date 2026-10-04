// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openLicenseDialog } from "@/player/titleLicenseNotice";

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
