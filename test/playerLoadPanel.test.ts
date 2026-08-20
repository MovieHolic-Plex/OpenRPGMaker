import { describe, expect, it } from "vitest";
import {
  autosaveCardModel,
  autosaveTriggerLabel,
  formatSavedAt,
  renderPlayerLoadPanel,
  saveSlotCardModel,
} from "@/player/playerLoadPanel";
import {
  createSaveSnapshot,
  saveSlotKey,
  saveToSlot,
  writeAutosave,
  type SaveSlotReadResult,
  type SaveSnapshot,
} from "@/player/saveSlots";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

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

function presentSnapshot(): SaveSnapshot {
  const project = createBlankProject();
  const session = startSession(project);
  return {
    ...createSaveSnapshot(project, session),
    mapName: "아주 긴 시작의 마을 바깥 평원 지도",
    partyLevel: 7,
    playTimeSeconds: 4262,
    // 로컬 시각 기준으로 생성해 타임존과 무관하게 기대값이 고정된다.
    savedAt: new Date(2026, 7, 21, 14, 5).toISOString(),
  };
}

function renderPanelWithStorage(
  storage: Storage,
  extra: { readonly onLoadAutosave?: () => void } = {},
): FakeElement {
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { localStorage: storage },
  });
  try {
    return renderWithFakeDom(() => renderPlayerLoadPanel({
      fromTitle: true,
      onBack: () => undefined,
      onLoadSlot: () => undefined,
      ...extra,
    }));
  } finally {
    restoreWindow(previousWindow);
  }
}

function autosaveSnapshot(trigger: "transfer" | "battleVictory"): SaveSnapshot {
  return {
    ...presentSnapshot(),
    savedBy: "auto",
    autosaveTrigger: trigger,
  };
}

describe("player load panel", () => {
  it("renders the title load screen with the title background, not the system graphic", () => {
    const restoreDom = installFakeDom();
    try {
      const panel = renderPanelWithStorage(new MemoryStorage());

      expect(panel.className).toContain("rm2k3-load-panel");
      expect(findByTestId(panel, "player-load-window")?.className).toContain("rm2k3-load-window");
      expect(findByTestId(panel, "save-slot-1")?.className).toContain("rm2k3-load-slot");
      expect(findByTestId(panel, "player-load-back")).not.toBeNull();
      expect(panel.dataset.systemResource).toBeUndefined();
      expect(panel.style.backgroundImage).toMatch(/^url\("/);
    } finally {
      restoreDom();
    }
  });

  it("renders a present slot as a card with map name, level, play time, and saved-at", () => {
    const restoreDom = installFakeDom();
    try {
      const storage = new MemoryStorage();
      saveToSlot(storage, 1, presentSnapshot());
      const panel = renderPanelWithStorage(storage);

      const slot = findByTestId(panel, "save-slot-1");
      expect(slot).not.toBeNull();
      expect(slot?.className).toContain("is-present");
      expect(slot?.querySelector(".rm2k3-load-slot-title")?.textContent).toBe("1번 저장");
      expect(slot?.querySelector(".rm2k3-load-slot-map")?.textContent).toBe("아주 긴 시작의 마을 바깥 평원 지도");
      expect(slot?.querySelector(".rm2k3-load-slot-level")?.textContent).toBe("Lv 7");
      expect(slot?.querySelector(".rm2k3-load-slot-playtime")?.textContent).toBe("1:11:02");
      expect(slot?.querySelector(".rm2k3-load-slot-saved-at")?.textContent).toBe("2026.08.21 14:05");
    } finally {
      restoreDom();
    }
  });

  it("renders empty and corrupt slots as single-row status cards with the legacy wording", () => {
    const restoreDom = installFakeDom();
    try {
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(2), "{broken json");
      const panel = renderPanelWithStorage(storage);

      const empty = findByTestId(panel, "save-slot-1");
      expect(empty?.className).toContain("is-empty");
      expect(empty?.querySelector(".rm2k3-load-slot-title")?.textContent).toBe("1번 저장: 비어 있음");
      expect(empty?.querySelector(".rm2k3-load-slot-map")).toBeNull();
      expect(empty?.querySelector(".rm2k3-load-slot-meta")).toBeNull();

      const corrupt = findByTestId(panel, "save-slot-2");
      expect(corrupt?.className).toContain("is-corrupt");
      expect(corrupt?.querySelector(".rm2k3-load-slot-title")?.textContent).toBe("2번 저장: 이상함");
      expect(corrupt?.querySelector(".rm2k3-load-slot-meta")).toBeNull();
      // 손상 안내 문구는 버튼 밖 별도 알림으로 유지된다.
      expect(findByTestId(panel, "save-slot-corrupt-2")?.textContent).toContain("2번 저장 칸 이상");
    } finally {
      restoreDom();
    }
  });

  it("keeps every slot as a BUTTON with the save-slot testid for the keyboard cursor menu", () => {
    const restoreDom = installFakeDom();
    try {
      const storage = new MemoryStorage();
      saveToSlot(storage, 1, presentSnapshot());
      storage.setItem(saveSlotKey(2), "{broken json");
      const panel = renderPanelWithStorage(storage);

      // player.ts 는 [data-testid^='save-slot-'] + tagName === "BUTTON" 으로 커서 메뉴를 붙인다.
      for (const slot of [1, 2, 3] as const) {
        const element = findByTestId(panel, `save-slot-${slot}`);
        expect(element?.tagName).toBe("BUTTON");
      }
      // 손상 알림은 접두사가 겹치지만 버튼이 아니어야 커서 메뉴에서 걸러진다.
      expect(findByTestId(panel, "save-slot-corrupt-2")?.tagName).toBe("DIV");
    } finally {
      restoreDom();
    }
  });

  it("renders a read-only autosave card on top when an autosave exists and the callback is wired", () => {
    const restoreDom = installFakeDom();
    try {
      const storage = new MemoryStorage();
      writeAutosave(storage, autosaveSnapshot("transfer"));
      saveToSlot(storage, 1, presentSnapshot());
      let loaded = 0;
      const panel = renderPanelWithStorage(storage, { onLoadAutosave: () => { loaded += 1; } });

      const card = findByTestId(panel, "save-slot-auto");
      expect(card).not.toBeNull();
      expect(card?.tagName).toBe("BUTTON");
      expect(card?.className).toContain("is-autosave");
      expect(card?.querySelector(".rm2k3-load-slot-title")?.textContent).toBe("자동 저장");
      expect(card?.querySelector(".rm2k3-load-slot-trigger")?.textContent).toBe("맵 이동");
      // 최상단: 수동 1번 슬롯보다 앞에 온다.
      const slots = findByTestId(panel, "player-load-slots");
      const first = slots?.childNodes[0];
      expect(first && (first as FakeElement).dataset?.testid).toBe("save-slot-auto");

      card?.dispatchEvent?.(new Event("click", { bubbles: true }));
      expect(loaded).toBe(1);
    } finally {
      restoreDom();
    }
  });

  it("renders no autosave card when the autosave slot is empty or the callback is omitted", () => {
    const restoreDom = installFakeDom();
    try {
      // 오토세이브 없음 + 콜백 있음 → 카드 없음.
      const empty = renderPanelWithStorage(new MemoryStorage(), { onLoadAutosave: () => undefined });
      expect(findByTestId(empty, "save-slot-auto")).toBeNull();

      // 오토세이브 있음 + 콜백 없음(레거시 호출부) → 카드 없음.
      const storage = new MemoryStorage();
      writeAutosave(storage, autosaveSnapshot("battleVictory"));
      const noCallback = renderPanelWithStorage(storage);
      expect(findByTestId(noCallback, "save-slot-auto")).toBeNull();
    } finally {
      restoreDom();
    }
  });

  it("maps autosave snapshots to a card model with the trigger label", () => {
    expect(autosaveCardModel(autosaveSnapshot("battleVictory"))).toEqual({
      title: "자동 저장",
      mapName: "아주 긴 시작의 마을 바깥 평원 지도",
      level: "Lv 7",
      playTime: "1:11:02",
      savedAt: "2026.08.21 14:05",
      trigger: "전투 승리",
    });
    // 구 스냅샷(트리거 없음)은 표기를 생략한다.
    expect(autosaveCardModel(presentSnapshot()).trigger).toBeUndefined();
    expect(autosaveTriggerLabel("transfer")).toBe("맵 이동");
    expect(autosaveTriggerLabel(undefined)).toBeUndefined();
  });

  it("formats saved-at as local 'YYYY.MM.DD HH:mm' and returns empty string for invalid ISO", () => {
    expect(formatSavedAt(new Date(2026, 0, 5, 9, 7).toISOString())).toBe("2026.01.05 09:07");
    expect(formatSavedAt(new Date(2025, 11, 31, 23, 59).toISOString())).toBe("2025.12.31 23:59");
    expect(formatSavedAt("not-a-date")).toBe("");
    expect(formatSavedAt("")).toBe("");
  });

  describe("saveSlotCardModel", () => {
    it("maps a present slot to a card model", () => {
      const slot: SaveSlotReadResult = { kind: "present", slot: 1, snapshot: presentSnapshot() };
      expect(saveSlotCardModel(slot)).toEqual({
        title: "1번 저장",
        mapName: "아주 긴 시작의 마을 바깥 평원 지도",
        level: "Lv 7",
        playTime: "1:11:02",
        savedAt: "2026.08.21 14:05",
      });
    });

    it("falls back to the project title when the map name is missing and drops invalid saved-at", () => {
      const base = presentSnapshot();
      const slot: SaveSlotReadResult = {
        kind: "present",
        slot: 2,
        snapshot: { ...base, projectTitle: "테스트 게임", mapName: undefined, savedAt: "garbage" },
      };
      const model = saveSlotCardModel(slot);
      expect(model.mapName).toBe("테스트 게임");
      expect(model.savedAt).toBeUndefined();
    });

    it("keeps the legacy single-line wording for empty and corrupt slots", () => {
      expect(saveSlotCardModel({ kind: "empty", slot: 2 })).toEqual({ title: "2번 저장: 비어 있음" });
      expect(saveSlotCardModel({ kind: "corrupt", slot: 3, message: "bad" })).toEqual({ title: "3번 저장: 이상함" });
    });

    it("is pure: same frozen input gives equal output and the input is not mutated", () => {
      const snapshot = presentSnapshot();
      const slot: SaveSlotReadResult = Object.freeze({
        kind: "present" as const,
        slot: 1 as const,
        snapshot: Object.freeze(snapshot) as SaveSnapshot,
      });
      const before = JSON.stringify(slot);
      const first = saveSlotCardModel(slot);
      const second = saveSlotCardModel(slot);
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(JSON.stringify(slot)).toBe(before);
    });
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
