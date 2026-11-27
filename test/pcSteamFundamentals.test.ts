// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adoptLegacyExportSaves,
  applySaveSnapshot,
  createSaveSnapshot,
  isSaveSlotIndex,
  listSaveSlots,
  readSaveSlot,
  SAVE_SLOT_COUNT,
  SAVE_SLOT_INDICES,
  saveSlotKey,
  saveToSlot,
  setSavePublication,
  setSaveSlotStorageNamespace,
} from "@/player/saveSlots";
import { isLocalSaveSourceKey, publicationSaveKey } from "@/player/savePublication";
import {
  DEFAULT_KEY_BINDINGS,
  directionForKey,
  findKeyBindingConflicts,
  formatActionKeys,
  getActiveKeyBindings,
  isAutoBattleKey,
  isCancelKey,
  isConfirmKey,
  isDashKey,
  isGuardKey,
  isSkillCycleKey,
  isSkillKey,
  setCustomKeyBindings,
} from "@/player/keyBindings";
import {
  DEFAULT_PLAYER_PREFERENCES,
  getPlayerPreferences,
  normalizePlayerPreferences,
  readPlayerPreferences,
  resetKeyBindings,
  updatePlayerPreferences,
} from "@/player/playerPreferences";
import {
  detectGamepadVendor,
  formatControlHints,
  formatStatusMenuControlsForDevice,
  getActiveInputDevice,
  glyphForAction,
  setActiveInputDevice,
  subscribeInputDevice,
} from "@/player/inputGlyphs";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { statusMenuControls } from "@/player/playerStatusMenu";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import type { Publication } from "@/project/publication";

vi.mock("@/player/audio", () => ({ getAudioEngine: () => ({ setVolume: vi.fn() }) }));

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  key(index: number): string | null { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(key, value); }
}

describe("Track 2: Commercial PC/Steam Fundamentals", () => {
  beforeEach(() => {
    setSavePublication(undefined);
    setSaveSlotStorageNamespace(null);
    setCustomKeyBindings(undefined);
    setActiveInputDevice("keyboard");
    updatePlayerPreferences({
      ...DEFAULT_PLAYER_PREFERENCES,
      displayScaleMode: undefined,
      keyBindings: undefined,
      textSpeedChosen: undefined,
    });
  });

  afterEach(() => {
    setSavePublication(undefined);
    setSaveSlotStorageNamespace(null);
    setCustomKeyBindings(undefined);
    setActiveInputDevice("keyboard");
    delete (window as Window & { __oprnDesktopPlayer?: unknown }).__oprnDesktopPlayer;
    delete (window as Window & { __oprnDesktopShellState?: unknown }).__oprnDesktopShellState;
  });

  describe("1. Save slots expanded to 20 with backwards compatibility", () => {
    it("supports 20 manual slots and validates slot indices", () => {
      expect(SAVE_SLOT_COUNT).toBe(20);
      expect(SAVE_SLOT_INDICES).toHaveLength(20);
      expect(SAVE_SLOT_INDICES[0]).toBe(1);
      expect(SAVE_SLOT_INDICES[19]).toBe(20);

      expect(isSaveSlotIndex(1)).toBe(true);
      expect(isSaveSlotIndex(20)).toBe(true);
      expect(isSaveSlotIndex(0)).toBe(false);
      expect(isSaveSlotIndex(21)).toBe(false);
      expect(isSaveSlotIndex(-1)).toBe(false);
      expect(isSaveSlotIndex(1.5)).toBe(false);
      expect(isSaveSlotIndex("1")).toBe(false);
    });

    it("saves, reads, and lists across slots 1..20 while keeping v4/v5/v6 compatibility", () => {
      const project = createBlankProject();
      const storage = new MemoryStorage();

      const session1 = startSession(project);
      session1.gold = 111;
      const session20 = startSession(project);
      session20.gold = 2020;

      expect(saveToSlot(storage, 1, createSaveSnapshot(project, session1))).toEqual({ ok: true });
      expect(saveToSlot(storage, 20, createSaveSnapshot(project, session20))).toEqual({ ok: true });
      expect(saveToSlot(storage, 21, createSaveSnapshot(project, session20)).ok).toBe(false);

      // Legacy v4 key in slot 2 remains readable
      const session2 = startSession(project);
      session2.gold = 222;
      storage.setItem("oprn:save-slot:2", JSON.stringify(createSaveSnapshot(project, session2)));

      const slots = listSaveSlots(storage);
      expect(slots).toHaveLength(20);
      expect(slots[0]?.kind).toBe("present");
      expect(slots[1]?.kind).toBe("present");
      expect(slots[19]?.kind).toBe("present");
      expect(slots[2]?.kind).toBe("empty");

      const read20 = readSaveSlot(storage, 20);
      expect(read20.kind).toBe("present");
      if (read20.kind === "present") {
        expect(applySaveSnapshot(project, read20.snapshot).gold).toBe(2020);
      }

      const read2 = readSaveSlot(storage, 2);
      expect(read2.kind).toBe("present");
      if (read2.kind === "present") {
        expect(applySaveSnapshot(project, read2.snapshot).gold).toBe(222);
      }
    });

    it("authorizes slots 1..20 in savePublication and adoptLegacyExportSaves", () => {
      const publication: Publication = {
        gameId: "0123456789abcdef0123456789abcdef",
        saveCompatibilityId: "fedcba9876543210fedcba9876543210",
        acceptedSaveCompatibilityIds: [],
        contentRating: "general",
        releaseVersion: "1.0.0",
      };
      setSavePublication(publication);
      const key20 = publicationSaveKey(20, publication)!;
      expect(isLocalSaveSourceKey(key20, publication, false)).toBe(true);
      expect(isLocalSaveSourceKey(publicationSaveKey(21, publication)!, publication, false)).toBe(false);

      const storage = new MemoryStorage();
      storage.setItem("rpgzzu-export:demo:save-slot:v5:1", "legacy-1");
      storage.setItem("rpgzzu-export:demo:save-slot:v5:15", "legacy-15");
      expect(adoptLegacyExportSaves(storage, "oprn-export:demo")).toBe(2);
      expect(storage.getItem("oprn-export:demo:save-slot:v5:1")).toBe("legacy-1");
      expect(storage.getItem("oprn-export:demo:save-slot:v5:15")).toBe("legacy-15");
      expect(saveSlotKey(20)).toContain(":save-slot:v6:20");
    });
  });

  describe("2. Keyboard remapping and preferences", () => {
    it("keeps 100% identical defaults when unset and applies custom remappings", () => {
      expect(isConfirmKey("z")).toBe(true);
      expect(isConfirmKey("Enter")).toBe(true);
      expect(isCancelKey("x")).toBe(true);
      expect(isCancelKey("Escape")).toBe(true);
      expect(directionForKey("w")).toBe("up");
      expect(isDashKey("Shift")).toBe(true);
      expect(isSkillKey("q")).toBe(true);
      expect(isSkillCycleKey("r")).toBe(true);
      expect(isGuardKey("c")).toBe(true);
      expect(isAutoBattleKey("f")).toBe(true);
      expect(getActiveKeyBindings()).toEqual(DEFAULT_KEY_BINDINGS);

      // AZERTY + custom battle layout
      setCustomKeyBindings({
        confirm: ["j"],
        cancel: ["k"],
        up: ["z", "arrowup"],
        left: ["q", "arrowleft"],
        dash: ["e"],
        skill: ["u"],
        skillCycle: ["i"],
        guard: ["o"],
        autoBattle: ["p"],
      });

      expect(isConfirmKey("j")).toBe(true);
      expect(isConfirmKey("z")).toBe(false);
      // Safety fallback keeps Enter/Escape working when unclaimed by other actions
      expect(isConfirmKey("Enter")).toBe(true);
      expect(isCancelKey("k")).toBe(true);
      expect(isCancelKey("x")).toBe(false);
      expect(isCancelKey("Escape")).toBe(true);
      expect(directionForKey("z")).toBe("up");
      expect(directionForKey("q")).toBe("left");
      expect(directionForKey("w")).toBeNull();
      expect(isDashKey("e")).toBe(true);
      expect(isDashKey("Shift")).toBe(false);
      expect(isSkillKey("u")).toBe(true);
      expect(isSkillCycleKey("i")).toBe(true);
      expect(isGuardKey("o")).toBe(true);
      expect(isAutoBattleKey("p")).toBe(true);
      expect(formatActionKeys("confirm")).toBe("J");
    });

    it("detects key conflicts and persists/resets via playerPreferences", () => {
      const conflicts = findKeyBindingConflicts({ confirm: ["j"], cancel: ["j"] });
      expect(conflicts).toEqual([{ key: "j", actions: ["confirm", "cancel"] }]);

      const storage = new MemoryStorage();
      expect(updatePlayerPreferences({ keyBindings: { confirm: ["j"], skill: ["u"] }, displayScaleMode: "fit" }, storage)).toBe(true);
      expect(isConfirmKey("j")).toBe(true);
      expect(isSkillKey("u")).toBe(true);

      const loaded = readPlayerPreferences(storage);
      expect(loaded.keyBindings).toEqual({ confirm: ["j"], skill: ["u"] });
      expect(loaded.displayScaleMode).toBe("fit");

      expect(resetKeyBindings(storage)).toBe(true);
      expect(getPlayerPreferences().keyBindings).toBeUndefined();
      expect(isConfirmKey("z")).toBe(true);
      expect(isConfirmKey("j")).toBe(false);
      expect(normalizePlayerPreferences({ displayScaleMode: "bogus", keyBindings: { confirm: ["Control"] } })).toEqual(DEFAULT_PLAYER_PREFERENCES);
    });
  });

  describe("3. Active input device detection and controller glyphs", () => {
    it("detects PlayStation, Nintendo, and Xbox/Steam Deck vendors from gamepad IDs", () => {
      expect(detectGamepadVendor("DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)")).toBe("playstation");
      expect(detectGamepadVendor("Sony Interactive Entertainment Wireless Controller (054c)")).toBe("playstation");
      expect(detectGamepadVendor("Nintendo Switch Pro Controller (Vendor: 057e Product: 2009)")).toBe("nintendo");
      expect(detectGamepadVendor("Joy-Con (L+R)")).toBe("nintendo");
      expect(detectGamepadVendor("Xbox Wireless Controller (Vendor: 045e Product: 02fd)")).toBe("xbox");
      expect(detectGamepadVendor("Steam Deck Controller")).toBe("xbox");
      expect(detectGamepadVendor("Generic USB Gamepad")).toBe("xbox");
    });

    it("formats action glyphs and menu controls per input device", () => {
      expect(glyphForAction("confirm", "keyboard")).toBe("Enter/Z");
      expect(glyphForAction("confirm", "xbox")).toBe("A");
      expect(glyphForAction("confirm", "playstation")).toBe("✕");
      expect(glyphForAction("confirm", "nintendo")).toBe("B");

      expect(glyphForAction("cancel", "keyboard")).toBe("Esc/X");
      expect(glyphForAction("cancel", "xbox")).toBe("B");
      expect(glyphForAction("cancel", "playstation")).toBe("○");
      expect(glyphForAction("cancel", "nintendo")).toBe("A");

      expect(formatControlHints([{ action: "confirm", label: "결정" }, { action: "cancel", label: "취소" }], "playstation", " · ")).toBe("✕ 결정 · ○ 취소");
      expect(formatStatusMenuControlsForDevice("function", { device: "keyboard" })).toBeNull();
      expect(statusMenuControls("function")).toBe("↑↓ 항목 이동   Enter 결정   ← 메뉴   Esc 뒤로");
      expect(statusMenuControls("function", 1, false, undefined, "xbox")).toContain("A 결정");
      expect(statusMenuControls("function", 1, false, undefined, "playstation")).toContain("✕ 결정");
      expect(statusMenuControls("function", 1, false, undefined, "nintendo")).toContain("B 결정");

      const seen: string[] = [];
      const unsub = subscribeInputDevice((device) => seen.push(device));
      setActiveInputDevice("playstation");
      expect(getActiveInputDevice()).toBe("playstation");
      expect(seen).toEqual(["playstation"]);
      unsub();
    });
  });

  describe("4. In-game PC/Steam options and Quit to Desktop", () => {
    it("exposes fullscreen, display scale, key bindings subscreen, and conditional Quit to Desktop", () => {
      const project = createBlankProject();
      const session = startSession(project);

      const optionsDetail = createStatusMenuDetail({
        project,
        session,
        selectedCommand: "options",
        slots: [],
        waitModeEnabled: true,
      });
      const optionIds = optionsDetail.entries.map((entry) => entry.testId);
      expect(optionIds).toEqual(expect.arrayContaining([
        "player-option-fullscreen",
        "player-option-display-scale",
        "player-option-key-bindings",
      ]));

      const scaleEntry = optionsDetail.entries.find((entry) => entry.testId === "player-option-display-scale")!;
      const initialValue = scaleEntry.value;
      scaleEntry.onActivate?.();
      const nextValue = createStatusMenuDetail({
        project,
        session,
        selectedCommand: "options",
        slots: [],
        waitModeEnabled: true,
      }).entries.find((entry) => entry.testId === "player-option-display-scale")!.value;
      expect(nextValue).not.toBe(initialValue);

      const keyDetail = createStatusMenuDetail({
        project,
        session,
        selectedCommand: "options",
        optionsSubscreen: "key-bindings",
        slots: [],
        waitModeEnabled: true,
      });
      expect(keyDetail.entries.map((entry) => entry.testId)).toContain("player-option-key-confirm");
      expect(keyDetail.entries.map((entry) => entry.testId)).toContain("player-option-key-bindings-reset");

      // Without desktop quit or onQuitGame, Quit to Desktop is not shown
      const webSystemMenu = createStatusMenuDetail({
        project,
        session,
        selectedCommand: "system-menu",
        slots: [],
        waitModeEnabled: true,
      });
      expect(webSystemMenu.entries.some((entry) => entry.testId === "status-menu-group-command-quit-game")).toBe(false);

      // With desktop quit API, Quit to Desktop appears in system-menu
      const quitSpy = vi.fn();
      (window as Window & { __oprnDesktopPlayer?: { quit?: () => void } }).__oprnDesktopPlayer = { quit: quitSpy };
      const desktopSystemMenu = createStatusMenuDetail({
        project,
        session,
        selectedCommand: "system-menu",
        slots: [],
        waitModeEnabled: true,
      });
      const quitEntry = desktopSystemMenu.entries.find((entry) => entry.testId === "status-menu-group-command-quit-game");
      expect(quitEntry).toBeDefined();
      quitEntry?.onActivate?.();
      expect(quitSpy).toHaveBeenCalledOnce();
    });
  });
});
