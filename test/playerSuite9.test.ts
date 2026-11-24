import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { autosaveCardModel, autosaveTriggerLabel, formatSavedAt, renderPlayerLoadPanel, saveSlotCardModel } from "@/player/playerLoadPanel";
import { createSaveSnapshot, saveSlotKey, saveToSlot, writeAutosave, type SaveSlotReadResult, type SaveSnapshot } from "@/player/saveSlots";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import { menuItemUnavailableReason, previewMenuItemTarget, useItemFromMenu } from "@/player/playerItemUse";
import { startPlayerRoute, yieldPlayerRouteToEvents } from "@/player/playerRouteState";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { timerConditionPages, updateRuntimeTimers } from "@/player/playSceneTimers";
import type { GameMap, GameEvent, Project } from "@/project/types";
import { calculatePlaySurfaceCropMetrics, calculatePlaySurfacePlacement, calculatePlaySurfaceScale } from "@/player/playSurfaceScale";
import { qaCheckpointStartEventId, sessionFromQaCheckpoint, type QaCheckpoint } from "@/player/qaCheckpoint";
import { executeInstantCommand } from "@/player/playSceneAutonomousCommands";
import { keptEventOpacity, type EventOpacityOverrides } from "@/player/eventOpacityOverrides";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { isolateTimers } from "./mergedTeardown";

describe("playerLoadPanel", () => {
  isolateTimers();
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

        expect(panel.className).toContain("oprn-load-panel");
        expect(findByTestId(panel, "player-load-window")?.className).toContain("oprn-load-window");
        expect(findByTestId(panel, "save-slot-1")?.className).toContain("oprn-load-slot");
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
        expect(slot?.querySelector(".oprn-load-slot-title")?.textContent).toBe("1번 저장");
        expect(slot?.querySelector(".oprn-load-slot-map")?.textContent).toBe("아주 긴 시작의 마을 바깥 평원 지도");
        expect(slot?.querySelector(".oprn-load-slot-level")?.textContent).toBe("Lv 7");
        expect(slot?.querySelector(".oprn-load-slot-playtime")?.textContent).toBe("1:11:02");
        expect(slot?.querySelector(".oprn-load-slot-saved-at")?.textContent).toBe("2026.08.21 14:05");
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
        expect(empty?.querySelector(".oprn-load-slot-title")?.textContent).toBe("1번 저장: 비어 있음");
        expect(empty?.querySelector(".oprn-load-slot-map")).toBeNull();
        expect(empty?.querySelector(".oprn-load-slot-meta")).toBeNull();

        const corrupt = findByTestId(panel, "save-slot-2");
        expect(corrupt?.className).toContain("is-corrupt");
        expect(corrupt?.querySelector(".oprn-load-slot-title")?.textContent).toBe("2번 저장: 이상함");
        expect(corrupt?.querySelector(".oprn-load-slot-meta")).toBeNull();
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
        expect(card?.querySelector(".oprn-load-slot-title")?.textContent).toBe("자동 저장");
        expect(card?.querySelector(".oprn-load-slot-trigger")?.textContent).toBe("맵 이동");
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
});

describe("playerMenuItemPreview", () => {
  isolateTimers();
  function fixture() {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0]!;
    const item = project.database.items.find((item) => item.id === "item_potion")!;
    Object.assign(item, { type: "medicine", occasion: "always", scope: "ally", hpRecovery: { flat: 50, percentMax: 0 } });
    session.actorVitals[actorId] = { hp: 80, maxHp: 100, mp: 5, maxMp: 20 };
    session.inventory[item.id] = 2;
    return { project, session, actorId, item };
  }
  describe("menu item previews share the execution rules", () => {
    it("predicts clamped recovery without mutating the session or its random stream", () => {
      const { project, session, actorId, item } = fixture();
      const before = structuredClone(session);
      const preview = previewMenuItemTarget(project, session, item, actorId);
      expect(preview).toMatchObject({ hp: 80, hpAfter: 100, mp: 5, mpAfter: 5, reason: undefined });
      expect(session).toEqual(before);
      expect(useItemFromMenu(project, session, item.id, actorId).kind).toBe("used");
      expect(session.actorVitals[actorId]!.hp).toBe(preview.hpAfter);
      expect(session.inventory[item.id]).toBe(1);
    });

    it("does not advertise saved medicine effects after changing an item to goods", () => {
      const { project, session, actorId, item } = fixture();
      item.type = "normalGoods";
      const preview = previewMenuItemTarget(project, session, item, actorId);
      expect(preview.reason).toBeTruthy();
      expect(preview.hpAfter).toBe(80);
      expect(useItemFromMenu(project, session, item.id, actorId)).toEqual({ kind: "unusable", message: preview.reason });
      expect(session.inventory[item.id]).toBe(2);
    });

    it("explains battle-only items before opening a target list", () => {
      const { item } = fixture();
      item.occasion = "battle";
      expect(menuItemUnavailableReason(item)).toBe("전투 중에만 사용할 수 있습니다");
    });

    it("keeps state-removal targets usable even with full HP and MP", () => {
      const { project, session, actorId, item } = fixture();
      const state = project.database.states[0]!;
      item.healStateIds = [state.id];
      session.actorVitals[actorId] = { hp: 100, maxHp: 100, mp: 20, maxMp: 20 };
      session.actorStateIds[actorId] = [state.id];
      expect(previewMenuItemTarget(project, session, item, actorId).reason).toBeUndefined();
      expect(useItemFromMenu(project, session, item.id, actorId).kind).toBe("used");
      expect(session.actorStateIds[actorId]).toEqual([]);
    });

    it("explains dead-only and full-health targets without consuming a charge", () => {
      const { project, session, actorId, item } = fixture();
      item.onlyEffectiveOnDeadActors = true;
      expect(previewMenuItemTarget(project, session, item, actorId).reason).toContain("전투불능 대상");
      item.onlyEffectiveOnDeadActors = false;
      session.actorVitals[actorId]!.hp = 100;
      expect(previewMenuItemTarget(project, session, item, actorId).reason).toBe("적용할 효과가 없습니다");
      expect(session.inventory[item.id]).toBe(2);
    });
  });
});

// J62: 맵 탭·QA 걷기로 걷는 중 닿기 이벤트(놀래킴 대사)가 돌면 주인공은 칸 경계에서 멈춘다. 이벤트가 시킨 강제 이동은 계속 걷는다.
describe("playerRouteYieldsToEvents", () => {
  isolateTimers();
  type Scene = Pick<PlaySceneContext, "playerRoute" | "playerSlide" | "playerSlideKind" | "running">;
  const scene = (): Scene => ({ playerRoute: null, playerSlide: null, playerSlideKind: null, running: false });
  const moves = [{ kind: "move" as const, dir: "right" as const }, { kind: "move" as const, dir: "right" as const }];
  describe("자유 걷기는 이벤트에 자리를 내준다", () => {
    it("이벤트가 돌면 탭 걷기를 그만둔다", () => {
      const s = scene();
      startPlayerRoute(s, moves, false);
      s.playerRoute!.yieldsToEvents = true;
      expect(yieldPlayerRouteToEvents(s, false)).toBe(false);
      s.running = true;
      expect(yieldPlayerRouteToEvents(s, false)).toBe(true);
      expect(s.playerRoute).toBeNull();
    });

    it("컷신 입력 잠금도 멈춘다", () => {
      const s = scene();
      startPlayerRoute(s, moves, false);
      s.playerRoute!.yieldsToEvents = true;
      expect(yieldPlayerRouteToEvents(s, true)).toBe(true);
    });

    it("이벤트가 시킨 강제 이동은 계속 걷는다", () => {
      const s = scene();
      startPlayerRoute(s, moves, false);
      s.running = true;
      expect(yieldPlayerRouteToEvents(s, true)).toBe(false);
      expect(s.playerRoute?.moves.length).toBe(2);
    });
  });
});

// 타이머가 0 이 되는 순간 타이머 조건 페이지를 다시 고르게 하는 두 조각(2026-10-31 sab-1031 A dungeon-2 「철창 닫힘」 20초 지연).
describe("playSceneTimerPages", () => {
  isolateTimers();
  function scene(seconds: number): PlaySceneContext {
    return { session: { timers: { timer1: seconds }, timerActive: { timer1: true } }, runtimeTimers: new Map([["timer1", { remaining: seconds, active: true }]]) } as unknown as PlaySceneContext;
  }
  describe("timer condition pages", () => {
    it("reports a change only when the shown second changes, and when the timer hits 0", () => {
      const s = scene(2);
      expect(updateRuntimeTimers(s, 400)).toBe(false); // 1.6s → 2 shown
      expect(updateRuntimeTimers(s, 700)).toBe(true); // 0.9s → 1 shown
      expect(updateRuntimeTimers(s, 2000)).toBe(true); // 0 → stops
      expect(s.session.timers.timer1).toBe(0);
      expect(s.runtimeTimers.get("timer1")!.active).toBe(false);
      expect(updateRuntimeTimers(s, 1000)).toBe(false);
    });

    it("finds auto pages gated on a timer, inside condition groups too", () => {
      const map = { events: [
        { id: "ev_gate", pages: [
          { id: "p0", conditions: [], trigger: { kind: "parallel" } },
          { id: "p1", conditions: [{ kind: "switch", switchId: "sw", value: true }, { kind: "timer", timerId: "timer1", seconds: 0 }], trigger: { kind: "auto" } },
        ] },
        { id: "ev_sign", pages: [{ id: "q0", conditions: [{ kind: "any", conditions: [{ kind: "timer", timerId: "timer2", seconds: 5, op: ">=" }] }], trigger: { kind: "action" } }] },
        { id: "ev_npc", pages: [{ id: "r0", conditions: [{ kind: "switch", switchId: "sw", value: true }], trigger: { kind: "action" } }] },
      ] } as unknown as GameMap;
      expect(timerConditionPages(map)).toEqual([
        { eventId: "ev_gate", pageId: "p1", auto: true },
        { eventId: "ev_sign", pageId: "q0", auto: false },
      ]);
    });
  });
});

describe("playSurfaceScale", () => {
  isolateTimers();
  describe("calculatePlaySurfaceScale", () => {
    it("allows a 1.5x step when 1x would leave more than 35% of the box empty", () => {
      expect(calculatePlaySurfaceScale(768, 740, 480, 270)).toBe(1.5); // iPad mini portrait: 1x fills 23%
      expect(calculatePlaySurfaceScale(863, 316, 480, 270)).toBe(1); // below 1.5x: stays 1x
      expect(calculatePlaySurfaceScale(1280, 720, 480, 270)).toBe(2); // 2x and up stay integer
    });

    it("uses the largest integer contain scale while the logical stage fits at 1x", () => {
      expect(calculatePlaySurfaceScale(1600, 900)).toBe(3);
      expect(calculatePlaySurfaceScale(1280, 800)).toBe(3);
      expect(calculatePlaySurfaceScale(960, 720)).toBe(3);
      expect(calculatePlaySurfaceScale(800, 600)).toBe(2);
      expect(calculatePlaySurfaceScale(640, 480)).toBe(2);
      expect(calculatePlaySurfaceScale(400, 300)).toBe(1);
      expect(calculatePlaySurfaceScale(320, 240)).toBe(1);
    });

    it("rounds down when either axis cannot fit the next exact multiple", () => {
      expect(calculatePlaySurfaceScale(1279, 960)).toBe(3);
      expect(calculatePlaySurfaceScale(1280, 959)).toBe(3);
    });

    it("shrinks oversized logical stages to keep the full game visible", () => {
      // Break named: the current scale floor of 1 crops custom resolutions larger than the host.
      expect(calculatePlaySurfaceScale(300, 200)).toBeCloseTo(5 / 6);
      expect(calculatePlaySurfaceScale(1320, 690, 1920, 1080)).toBeCloseTo(23 / 36);
    });

    it("keeps scale 1 until a viewport has a measurable size", () => {
      expect(calculatePlaySurfaceScale(0, 0)).toBe(1);
      expect(calculatePlaySurfaceScale(-100, Number.NaN)).toBe(1);
    });

    it("supports custom logical dimensions", () => {
      expect(calculatePlaySurfaceScale(800, 600, 400, 300)).toBe(2);
      expect(calculatePlaySurfaceScale(801, 600, 400, 300)).toBe(2);
    });
  });
  describe("calculatePlaySurfaceScale scale modes", () => {
    // 실측: 테스트 플레이 창 본문 1214x640 CSS px / 논리 320x240 에서 integer 모드는 2.000 이라
    // 640x480 만 그리고 나머지 73% 가 죽은 레터박스였다. 배포/커뮤니티 플레이어는 이 값이 바뀌면 안 된다.
    it("keeps the shipped integer contain scale for the measured test play window body", () => {
      expect(calculatePlaySurfaceScale(1214, 640, 320, 240)).toBe(2);
      expect(calculatePlaySurfaceScale(1214, 640, 320, 240, "integer")).toBe(2);
    });

    it("returns the unfloored contain scale in fit mode so the window is filled", () => {
      expect(calculatePlaySurfaceScale(1214, 640, 320, 240, "fit")).toBeCloseTo(8 / 3);
      expect(calculatePlaySurfaceScale(1600, 900, 320, 240, "fit")).toBeCloseTo(3.75);
    });

    it("treats shrinking and empty viewports identically in both modes", () => {
      expect(calculatePlaySurfaceScale(300, 200, 320, 240, "fit")).toBeCloseTo(5 / 6);
      expect(calculatePlaySurfaceScale(300, 200, 320, 240, "integer")).toBeCloseTo(5 / 6);
      expect(calculatePlaySurfaceScale(0, 0, 320, 240, "fit")).toBe(1);
    });

    it("reports no crop for a fractional fit scale", () => {
      const scale = calculatePlaySurfaceScale(1214, 640, 320, 240, "fit");
      const crop = calculatePlaySurfaceCropMetrics(1214, 640, scale, 320, 240);
      expect(crop.left).toBe(0);
      expect(crop.top).toBe(0);
      expect(crop.visibleWidth).toBe(320);
      expect(crop.visibleHeight).toBe(240);
      const placement = calculatePlaySurfacePlacement(1214, 640, scale, 320, 240);
      expect(placement.top).toBe(0);
      expect(placement.left).toBeCloseTo((1214 - 320 * (8 / 3)) / 2);
    });
  });
  describe("calculatePlaySurfaceCropMetrics", () => {
    it("reports no crop when contain scaling leaves letterbox space", () => {
      const cases: Array<readonly [number, number]> = [
        [1600, 900],
        [1280, 800],
        [960, 720],
        [800, 600],
        [640, 480],
        [400, 300],
        [320, 240],
      ];
      for (const [w, h] of cases) {
        const crop = calculatePlaySurfaceCropMetrics(w, h, calculatePlaySurfaceScale(w, h));
        expect(crop.left).toBe(0);
        expect(crop.right).toBe(0);
        expect(crop.top).toBe(0);
        expect(crop.bottom).toBe(0);
        expect(crop.visibleWidth).toBe(320);
        expect(crop.visibleHeight).toBe(240);
      }
    });

    it("reports the full logical stage after automatic contain shrinking", () => {
      // Break named: crop metrics currently coerce a fractional fit scale back to 1.
      const scale = calculatePlaySurfaceScale(300, 200);
      const crop = calculatePlaySurfaceCropMetrics(300, 200, scale);
      expect(crop.left).toBe(0);
      expect(crop.right).toBe(0);
      expect(crop.top).toBe(0);
      expect(crop.bottom).toBe(0);
      expect(crop.visibleWidth).toBe(320);
      expect(crop.visibleHeight).toBe(240);
    });
  });
  describe("calculatePlaySurfacePlacement", () => {
    it("centers a fractionally scaled stage inside the host instead of centering its unscaled box", () => {
      // Break named: CSS grid safely aligns an overflowing unscaled stage to the start edge,
      // so transform-origin center shifts the contained pixels down and right.
      const scale = calculatePlaySurfaceScale(1320, 690, 1920, 1080);
      const placement = calculatePlaySurfacePlacement(1320, 690, scale, 1920, 1080);
      expect(placement.left).toBeCloseTo(140 / 3);
      expect(placement.top).toBe(0);
    });

    it("keeps an integer-scaled stage on whole screen pixels so pixel text is not shifted half a pixel", () => {
      // Break named: a 1281×721 window at 2× put the stage at (160.5, 90.5) and blurred the canvas and the dialogue font.
      const placement = calculatePlaySurfacePlacement(1281, 721, 2, 480, 270);
      expect(placement.left).toBe(160);
      expect(placement.top).toBe(90);
    });
  });
});

// QA 체크포인트 startTroopId: 필드 적 이벤트 id 는 굽기마다 새로 뽑히므로, 부대 id 로 그 부대와 싸우는 맵 이벤트를 찾는다.
describe("qaCheckpointStartTroop", () => {
  isolateTimers();
  function fieldEnemy(id: string, x: number, y: number, troopId: string): GameEvent {
    return {
      id, x, y, trigger: { kind: "eventTouch" }, commands: [],
      pages: [{
        id: `${id}_fight`, name: "필드 적", conditions: [], trigger: { kind: "eventTouch" },
        commands: [{ kind: "fork", condition: { kind: "switch", switchId: "sw_x", value: true },
          then: [{ kind: "battleProcessing", troopId, canEscape: true, canLose: false }] }],
      }],
    } as unknown as GameEvent;
  }
  function projectWith(events: GameEvent[]): { project: Project; mapId: string } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId]!.events.push(...events);
    return { project, mapId };
  }
  describe("QA checkpoint startTroopId", () => {
    it("finds the field enemy that fights the troop, whatever its generated id", () => {
      const { project, mapId } = projectWith([
        fieldEnemy("ev_field_enemy_aaa", 3, 3, "troop_wolves"),
        fieldEnemy("ev_field_enemy_bbb", 9, 9, "troop_golem"),
      ]);
      const checkpoint: QaCheckpoint = { id: "golem", mapId, x: 9, y: 10, startTroopId: "troop_golem" };
      const session = sessionFromQaCheckpoint(project, checkpoint);
      expect(qaCheckpointStartEventId(project, checkpoint, session.currentMapId)).toBe("ev_field_enemy_bbb");
    });

    it("picks the event nearest the player when several fight the same troop", () => {
      const { project, mapId } = projectWith([
        fieldEnemy("ev_field_enemy_far", 1, 1, "troop_dogs"),
        fieldEnemy("ev_field_enemy_near", 14, 3, "troop_dogs"),
      ]);
      const checkpoint: QaCheckpoint = { id: "dogs", mapId, x: 14, y: 4, startTroopId: "troop_dogs" };
      expect(qaCheckpointStartEventId(project, checkpoint, mapId)).toBe("ev_field_enemy_near");
    });

    it("keeps startEventId ahead of startTroopId", () => {
      const { project, mapId } = projectWith([fieldEnemy("ev_field_enemy_aaa", 3, 3, "troop_wolves")]);
      const checkpoint: QaCheckpoint = { id: "fixed", mapId, startEventId: "ev_field_enemy_aaa", startTroopId: "troop_missing" };
      expect(qaCheckpointStartEventId(project, checkpoint, mapId)).toBe("ev_field_enemy_aaa");
    });

    it("throws when no event on the map fights the troop", () => {
      const { project, mapId } = projectWith([fieldEnemy("ev_field_enemy_aaa", 3, 3, "troop_wolves")]);
      expect(() => qaCheckpointStartEventId(project, { id: "none", mapId, startTroopId: "troop_golem" }, mapId))
        .toThrow(/부대 troop_golem 와 싸우는 이벤트가 없다/u);
    });
  });
});

describe("routeOpacityPersists", () => {
  isolateTimers();
  // 이동 경로 changeOpacity 는 경로가 끝난 뒤에도 남는다 — 흐려져 떠난 인물이 다음 표면 갱신에 255 로 되살아나
  // 몸과 들고 있던 빛이 다시 보였다(폴른 스타 B4 숲지기, 2026-11-03).
  describe("route changeOpacity persists", () => {
    it("records the faded opacity for the event and clears it at full opacity", () => {
      const eventOpacityOverrides: EventOpacityOverrides = new Map();
      const alphas: number[] = [];
      const sprite = { setAlpha: (a: number) => alphas.push(a) };
      const mover = { opacity: 255 } as never as { opacity: number };
      const ctx = { scene: { eventOpacityOverrides }, eventId: "ev_bram", mover } as never;
      const target = { mover, view: { pageId: "forest" }, sprite } as never;
      executeInstantCommand(ctx, target, { kind: "changeOpacity", delta: -255 } as never);
      expect(keptEventOpacity(eventOpacityOverrides, "ev_bram", "forest")).toBe(0);
      expect(alphas.at(-1)).toBe(0);
      executeInstantCommand(ctx, target, { kind: "changeOpacity", delta: 255 } as never);
      expect(eventOpacityOverrides.has("ev_bram")).toBe(false);
    });

    it("forgets the kept opacity once the event shows another page", () => {
      const overrides: EventOpacityOverrides = new Map([["ev_bram", { pageId: "leaving", opacity: 0 }]]);
      expect(keptEventOpacity(overrides, "ev_bram", "leaving")).toBe(0);
      expect(keptEventOpacity(overrides, "ev_bram", "back")).toBeUndefined();
      expect(overrides.has("ev_bram")).toBe(false);
    });
  });
});

describe("runtimeCursorMenu", () => {
  isolateTimers();
  // fakeDom 은 KeyboardEvent 클래스가 없으므로 dispatchEvent 가 읽는 필드만 갖춘 가짜 이벤트를 만든다.
  function keydown(key: string): KeyboardEvent {
    return {
      type: "keydown",
      key,
      bubbles: true,
      defaultPrevented: false,
      target: null,
      isComposing: false,
      repeat: false,
      preventDefault(): void {
        (this as { defaultPrevented: boolean }).defaultPrevented = true;
      },
      stopPropagation(): void {},
    } as unknown as KeyboardEvent;
  }
  describe("attachCursorMenu (DOM)", () => {
    let restore: () => void;
    beforeEach(() => {
      restore = installFakeDom();
    });
    afterEach(() => {
      restore();
    });

    function build(count: number): { root: HTMLElement; items: HTMLElement[]; clicks: number[] } {
      const root = document.createElement("div");
      const items: HTMLElement[] = [];
      const clicks: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const button = document.createElement("button");
        button.dataset.testid = `item-${i}`;
        button.addEventListener("click", () => clicks.push(i));
        root.append(button);
        items.push(button);
      }
      document.body.append(root);
      return { root, items, clicks };
    }

    it("selects the first item and moves with wrapping arrows", () => {
      const { root, items } = build(3);
      attachCursorMenu(root, { items });
      expect(items[0].classList.contains("selected")).toBe(true);

      root.dispatchEvent(keydown("ArrowDown"));
      expect(items[1].classList.contains("selected")).toBe(true);
      expect(items[0].classList.contains("selected")).toBe(false);
      expect(items[1].getAttribute("aria-current")).toBe("true");

      root.dispatchEvent(keydown("ArrowUp"));
      root.dispatchEvent(keydown("ArrowUp"));
      expect(items[2].classList.contains("selected")).toBe(true);
    });

    it("confirm key (Z / Enter) clicks the selected item", () => {
      const { root, items, clicks } = build(3);
      attachCursorMenu(root, { items });
      root.dispatchEvent(keydown("ArrowDown"));
      root.dispatchEvent(keydown("z"));
      expect(clicks).toEqual([1]);
      root.dispatchEvent(keydown("Enter"));
      expect(clicks).toEqual([1, 1]);
      void items;
    });

    it("cancel key (X / Esc) clicks the cancel element", () => {
      const { root, items } = build(2);
      const cancel = document.createElement("button");
      let cancelled = 0;
      cancel.addEventListener("click", () => {
        cancelled += 1;
      });
      root.append(cancel);
      attachCursorMenu(root, { items, cancelEl: cancel });
      root.dispatchEvent(keydown("x"));
      expect(cancelled).toBe(1);
      root.dispatchEvent(keydown("Escape"));
      expect(cancelled).toBe(2);
    });

    it("onHorizontal consumes ←→ without moving the cursor", () => {
      const { root, items } = build(3);
      const dirs: number[] = [];
      attachCursorMenu(root, {
        items,
        onHorizontal: (dir) => {
          dirs.push(dir);
          return true;
        },
      });
      root.dispatchEvent(keydown("ArrowRight"));
      root.dispatchEvent(keydown("ArrowLeft"));
      expect(dirs).toEqual([1, -1]);
      expect(items[0].classList.contains("selected")).toBe(true);
    });

    it("stops handling and clears selection after detach", () => {
      const { root, items, clicks } = build(3);
      const detach = attachCursorMenu(root, { items });
      detach();
      root.dispatchEvent(keydown("ArrowDown"));
      root.dispatchEvent(keydown("z"));
      expect(clicks).toEqual([]);
      expect(items[0].classList.contains("selected")).toBe(false);
      expect(items[0].classList.contains("rm-nav-item")).toBe(false);
    });

    it("skips disabled items", () => {
      const { root, items } = build(3);
      (items[1] as unknown as { disabled: boolean }).disabled = true;
      attachCursorMenu(root, { items });
      root.dispatchEvent(keydown("ArrowDown"));
      expect(items[2].classList.contains("selected")).toBe(true);
      expect(items[1].classList.contains("selected")).toBe(false);
    });
  });
});
