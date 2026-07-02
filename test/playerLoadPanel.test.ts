import { describe, expect, it } from "vitest";
import { renderPlayerLoadPanel } from "@/player/playerLoadPanel";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("player load panel", () => {
  it("renders the title load screen with the title background, not the system graphic", () => {
    const restoreDom = installFakeDom();
    const previousWindow = globalThis.window;
    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: { localStorage: new MemoryStorage() },
      });

      const panel = renderWithFakeDom(() => renderPlayerLoadPanel({
        fromTitle: true,
        onBack: () => undefined,
        onLoadSlot: () => undefined,
      }));

      expect(panel.className).toContain("rm2k3-load-panel");
      expect(findByTestId(panel, "player-load-window")?.className).toContain("rm2k3-load-window");
      expect(findByTestId(panel, "save-slot-1")?.className).toContain("rm2k3-load-slot");
      expect(findByTestId(panel, "player-load-back")).not.toBeNull();
      expect(panel.dataset.systemResource).toBeUndefined();
      expect(panel.style.backgroundImage).toMatch(/^url\("/);
    } finally {
      restoreWindow(previousWindow);
      restoreDom();
    }
  });
});

function restoreWindow(previousWindow: Window & typeof globalThis | undefined): void {
  if (previousWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
    return;
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: previousWindow,
  });
}
