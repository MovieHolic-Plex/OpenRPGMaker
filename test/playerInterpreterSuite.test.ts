import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { AUTOSAVE_DEBOUNCE_MS, maybeAutosave, performAutosave, resetAutosaveDebounce, shouldAutosave } from "@/player/autosave";
import { applySaveSnapshot, autosaveKey, createSaveSnapshot, readAutosave, readSaveSlot, saveSlotKey, saveToSlot, setSaveSlotStorageNamespace } from "@/player/saveSlots";
import { beginCutsceneControl } from "@/player/cutsceneControl";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession } from "@/project/session";
import { SCHEMA_VERSION, type Project } from "@/project/types";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { executeModernCommand } from "@/player/interpreter/m2ModernRuntime";
import { syncRuntimeState } from "@/player/playSceneMapRuntime";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("autosave", () => {
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
  function projectAndSession(): { project: Project; session: PlaySession } {
    const project = createBlankProject();
    const session = startSession(project);
    return { project, session };
  }
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetAutosaveDebounce();
    setSaveSlotStorageNamespace(null);
  });
  describe("autosave policy (shouldAutosave)", () => {
    it("saves by default with no prior autosave", () => {
      const { session } = projectAndSession();
      expect(shouldAutosave(session, "transfer", null, 10_000)).toBe(true);
    });

    it("respects Change Save Access: m2Runtime.access.save === false skips", () => {
      const { session } = projectAndSession();
      ensureM2Runtime(session).access.save = false;
      expect(shouldAutosave(session, "transfer", null, 10_000)).toBe(false);
      expect(shouldAutosave(session, "battleVictory", null, 10_000)).toBe(false);
    });

    it("disables autosave when the current map has disableSave", () => {
      const { project, session } = projectAndSession();
      project.maps[session.currentMapId]!.disableSave = true;
      expect(shouldAutosave(session, "transfer", null, 10_000, project)).toBe(false);
      expect(shouldAutosave(session, "battleVictory", null, 10_000, project)).toBe(false);
    });

    it("skips during cutscene input lock", () => {
      const { session } = projectAndSession();
      beginCutsceneControl(session, "cutscene-1", false);
      expect(shouldAutosave(session, "transfer", null, 10_000)).toBe(false);
    });

    it("debounces 5 seconds since the last autosave", () => {
      const { session } = projectAndSession();
      const last = 100_000;
      expect(shouldAutosave(session, "transfer", last, last + AUTOSAVE_DEBOUNCE_MS - 1)).toBe(false);
      expect(shouldAutosave(session, "transfer", last, last + AUTOSAVE_DEBOUNCE_MS)).toBe(true);
      // 트리거 종류가 달라도 디바운스는 공유된다.
      expect(shouldAutosave(session, "battleVictory", last, last + 1_000)).toBe(false);
    });
  });
  describe("performAutosave / round trip", () => {
    it("writes savedBy=auto with the trigger and round-trips through readAutosave into an identical session", () => {
      const { project, session } = projectAndSession();
      session.gold = 777;
      session.variables["v1"] = 42;
      session.x = 5;
      session.y = 6;
      const storage = new MemoryStorage();

      const written = performAutosave(project, session, storage, "battleVictory");
      expect(written).not.toBeNull();
      expect(written?.savedBy).toBe("auto");
      expect(written?.autosaveTrigger).toBe("battleVictory");

      const result = readAutosave(storage);
      expect(result.kind).toBe("present");
      if (result.kind !== "present") throw new Error("expected present autosave");
      expect(result.snapshot.savedBy).toBe("auto");
      expect(result.snapshot.autosaveTrigger).toBe("battleVictory");

      const restored = applySaveSnapshot(project, result.snapshot);
      expect(restored.gold).toBe(777);
      expect(restored.variables["v1"]).toBe(42);
      expect(restored.x).toBe(5);
      expect(restored.y).toBe(6);
      expect(restored.currentMapId).toBe(session.currentMapId);
    });

    it("keeps the autosave key fully separate from the 3 manual slots (namespace included)", () => {
      expect(autosaveKey()).toBe("oprn:save-slot:v5:auto");
      for (const slot of [1, 2, 3] as const) expect(autosaveKey()).not.toBe(saveSlotKey(slot));
      setSaveSlotStorageNamespace("proj-x");
      expect(autosaveKey()).toBe("proj-x:save-slot:v5:auto");
      expect(saveSlotKey(1)).toBe("proj-x:save-slot:v5:1");
    });

    it("does not touch manual slots when autosaving", () => {
      const { project, session } = projectAndSession();
      const storage = new MemoryStorage();
      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const before = storage.getItem(saveSlotKey(1));
      performAutosave(project, session, storage, "transfer");
      expect(storage.getItem(saveSlotKey(1))).toBe(before);
      expect(readSaveSlot(storage, 1).kind).toBe("present");
    });

    it("swallows quota failures: warn only, returns null, nothing thrown", () => {
      const { project, session } = projectAndSession();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const storage = new MemoryStorage();
      vi.spyOn(storage, "setItem").mockImplementation(() => {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      });
      expect(performAutosave(project, session, storage, "transfer")).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(readAutosave(storage).kind).toBe("empty");
    });
  });
  describe("maybeAutosave (PlayScene hook wrapper)", () => {
    it("no-ops without throwing when localStorage is unavailable (headless safety)", () => {
      vi.stubGlobal("localStorage", undefined);
      const { project, session } = projectAndSession();
      expect(maybeAutosave(project, session, "transfer")).toBe(false);
    });

    it("writes once then debounces, and saves again after the window", () => {
      const storage = new MemoryStorage();
      vi.stubGlobal("localStorage", storage);
      const { project, session } = projectAndSession();
      resetAutosaveDebounce();

      expect(maybeAutosave(project, session, "transfer", 50_000)).toBe(true);
      expect(readAutosave(storage).kind).toBe("present");
      expect(maybeAutosave(project, session, "battleVictory", 51_000)).toBe(false);
      expect(maybeAutosave(project, session, "battleVictory", 50_000 + AUTOSAVE_DEBOUNCE_MS)).toBe(true);

      const result = readAutosave(storage);
      if (result.kind !== "present") throw new Error("expected present autosave");
      expect(result.snapshot.autosaveTrigger).toBe("battleVictory");
    });

    it("does not consume the debounce window when the write fails", () => {
      const storage = new MemoryStorage();
      vi.stubGlobal("localStorage", storage);
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const setItem = vi.spyOn(storage, "setItem").mockImplementation(() => {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      });
      const { project, session } = projectAndSession();
      resetAutosaveDebounce();

      expect(maybeAutosave(project, session, "transfer", 10_000)).toBe(false);
      setItem.mockRestore();
      // 실패는 lastAutosaveAtMs 를 갱신하지 않으므로 바로 다음 기회에 다시 시도된다.
      expect(maybeAutosave(project, session, "transfer", 10_001)).toBe(true);
    });
  });
  describe("manual slot schemaVersion compatibility (regression)", () => {
    it("preserves persistent runtime progression through the real storage loader", () => {
      // Break caught: adding a PlaySession field without wiring the save type, writer,
      // known-field parser, and restorer silently resets player progress after reload.
      const { project, session } = projectAndSession();
      project.database.lifeSkills = [
        { id: "skill_farming", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [] },
      ];
      session.actorBattleCommands = { actor_hero: ["cmd_item"] };
      session.lifeSkills = { skill_farming: { xp: 100, level: 2 } };
      session.actorNicknames = { actor_hero: "별명" };
      session.actorFaceResourceIds = { actor_hero: "face_custom" };
      session.shopLoyaltySpend = { shop_1: 500 };
      session.shopTradeCounts = { shop_1: { sold: 2, bought: 1 } };
      session.shopMileagePoints = 42;
      session.shopPawnTickets = {
        ticket_1: { itemId: "item_bomb", pawnPrice: 25, dueDayKey: "1:spring:3" },
      };
      session.shopLastRestockDayKey = { shop_1: "1:spring:3" };
      ensureM2Runtime(session).access.save = false;
      const storage = new MemoryStorage();

      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const loaded = readSaveSlot(storage, 1);

      expect(loaded.kind).toBe("present");
      if (loaded.kind !== "present") throw new Error("expected present slot");
      const restored = applySaveSnapshot(project, loaded.snapshot);
      expect(restored.actorBattleCommands).toEqual(session.actorBattleCommands);
      expect(restored.lifeSkills).toEqual(session.lifeSkills);
      expect(restored.actorNicknames).toEqual(session.actorNicknames);
      expect(restored.actorFaceResourceIds).toEqual(session.actorFaceResourceIds);
      expect(restored.shopLoyaltySpend).toEqual(session.shopLoyaltySpend);
      expect(restored.shopTradeCounts).toEqual(session.shopTradeCounts);
      expect(restored.shopMileagePoints).toBe(42);
      expect(restored.shopPawnTickets).toEqual(session.shopPawnTickets);
      expect(restored.shopLastRestockDayKey).toEqual(session.shopLastRestockDayKey);
      expect(restored.m2Runtime?.access?.save).toBe(false);
    });

    it("parses a pre-autosave manual snapshot JSON (no savedBy/autosaveTrigger) as present", () => {
      const { project, session } = projectAndSession();
      const snapshot = createSaveSnapshot(project, session);
      // 구 스냅샷 시뮬레이션: 새 optional 필드가 아예 없는 JSON.
      const legacy = { ...snapshot, schemaVersion: SCHEMA_VERSION };
      delete legacy.savedBy;
      delete legacy.autosaveTrigger;
      expect(legacy.schemaVersion).toBe(SCHEMA_VERSION);

      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(2), JSON.stringify(legacy));
      const result = readSaveSlot(storage, 2);
      expect(result.kind).toBe("present");
      if (result.kind !== "present") throw new Error("expected present slot");
      expect(result.snapshot.savedBy).toBeUndefined();
      expect(result.snapshot.autosaveTrigger).toBeUndefined();
    });

    it("ignores unknown savedBy/autosaveTrigger values instead of corrupting the slot", () => {
      const { project, session } = projectAndSession();
      const snapshot = createSaveSnapshot(project, session) as unknown as Record<string, unknown>;
      snapshot.savedBy = "cloud";
      snapshot.autosaveTrigger = "meteor";
      const storage = new MemoryStorage();
      storage.setItem(autosaveKey(), JSON.stringify(snapshot));
      const result = readAutosave(storage);
      expect(result.kind).toBe("present");
      if (result.kind !== "present") throw new Error("expected present autosave");
      expect(result.snapshot.savedBy).toBeUndefined();
      expect(result.snapshot.autosaveTrigger).toBeUndefined();
    });

    it("reports empty/corrupt autosave results distinctly", () => {
      const storage = new MemoryStorage();
      expect(readAutosave(storage)).toEqual({ kind: "empty" });
      storage.setItem(autosaveKey(), "{broken json");
      expect(readAutosave(storage).kind).toBe("corrupt");
      storage.setItem(autosaveKey(), JSON.stringify({ schemaVersion: 999 }));
      expect(readAutosave(storage)).toEqual({ kind: "corrupt", message: "Unsupported save schema" });
    });
  });
});

// 컷신 중 필드 HUD 억제. hideHud 는 Modern `Cutscene Control` 의 드롭다운 옵션으로만 존재하고
// 런타임 소비처가 없는 죽은 값이었다 — 미니맵·손 슬롯을 숨기는 유일한 경로가 대화창 `:has()`
// CSS 라, 대사가 없는 비트(카메라 팬·픽처)에서는 HUD 가 그대로 떠 있었다.
//
// 단정은 **프로덕션 경로**(syncRuntimeState)를 지난다. 리더 함수를 직접 부르면 호출 지점이
// syncRuntimeState 에서 사라져도 초록으로 남는다 — 그 구멍이 이 회귀의 원인이었다.
// 플래그·클래스 이름은 리터럴로 고정한다: 구현 상수를 import 해 비교하면 이름이 바뀌어도
// 통과하는 항등 단정이 된다(CSS 는 상수를 볼 수 없으므로 계약은 문자열 그 자체다).
describe("cutsceneHudVisibility", () => {
  isolateTimers();
  const HIDE_HUD_FLAG = "cutscene:hideHud";
  const LOCK_FLAG = "cutscene:inputLocked";
  const HUD_HIDDEN_CLASS = "cutscene-hud-hidden";
  /** 스테이지가 붙은 최소 씬. 보이는 HUD 갱신 경로(비계측)만 지나간다. */
  function sceneWithStage(stage: FakeElement) {
    const session = startSession(store.getCurrent());
    const scene = {
      game: { registry: { get: (key: string) => (key === "dialogueHost" ? stage : undefined) } },
      runtimeDom: {
        instrumented: false,
        syncPictureLayer: vi.fn(),
        syncVisibleHud: vi.fn(),
      },
      runtimeTimers: new Map(),
      session,
    };
    return { scene, session };
  }
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });
  describe("컷신 HUD 억제", () => {
    it("hideHud 플래그가 켜지면 스테이지에 억제 클래스가 붙는다", () => {
      // Given: 스테이지가 마운트된 씬과 HUD 숨김을 요청한 컷신.
      const stage = new FakeElement("div");
      stage.className = "play-stage";
      const { scene, session } = sceneWithStage(stage);
      session.flags[HIDE_HUD_FLAG] = true;

      // When: 런타임이 보이는 표면을 동기화한다.
      syncRuntimeState(scene as never);

      // Then: HUD 억제 클래스가 붙는다.
      expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(true);
    });

    it("입력 잠금 중에도 억제된다 — 대사 없는 비트(카메라 팬·픽처)를 포함한다", () => {
      // Given: 대화 오버레이가 비어 있는(자식이 없는) 스테이지와 입력 잠금.
      const stage = new FakeElement("div");
      stage.className = "play-stage";
      const { scene, session } = sceneWithStage(stage);
      session.flags[LOCK_FLAG] = true;
      expect(stage.childNodes.length).toBe(0);

      // When: 런타임이 보이는 표면을 동기화한다.
      syncRuntimeState(scene as never);

      // Then: 대화창 `:has()` 규칙에 의존하지 않고 억제된다.
      expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(true);
    });

    it("컷신이 끝나면 억제 클래스를 걷어낸다", () => {
      // Given: 이전 컷신의 억제 클래스가 남은 스테이지, 플래그는 모두 꺼져 있다.
      const stage = new FakeElement("div");
      stage.className = `play-stage ${HUD_HIDDEN_CLASS}`;
      const { scene } = sceneWithStage(stage);

      // When: 런타임이 보이는 표면을 동기화한다.
      syncRuntimeState(scene as never);

      // Then: 남은 억제 클래스가 사라진다(HUD 가 영구히 숨는 것을 막는다).
      expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(false);
    });

    it("Modern `Cutscene Control` 의 HUD 숨김 액션이 억제까지 이어진다", () => {
      // Given: 스테이지가 마운트된 씬(잠금은 걸지 않는다 — hideHud 단독 경로를 본다).
      const stage = new FakeElement("div");
      stage.className = "play-stage";
      const { scene, session } = sceneWithStage(stage);

      // When: 작가가 실제로 배치하는 Modern 커맨드를 그대로 실행하고 표면을 동기화한다.
      executeModernCommand(session, ensureM2Runtime(session), "Cutscene Control", {
        action: "hideHud",
        enabled: true,
      });
      syncRuntimeState(scene as never);

      // Then: 커맨드가 심은 플래그가 리더가 읽는 키와 같아서 HUD 가 숨는다.
      expect(session.flags[HIDE_HUD_FLAG]).toBe(true);
      expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(true);
    });

    it("억제 클래스가 미니맵과 손 슬롯을 실제로 숨긴다", async () => {
      // Given: 런타임 플레이 서페이스 시트.
      const css = await readFile(
        fileURLToPath(new URL("../src/styles/runtime/playSurface.css", import.meta.url)),
        "utf8",
      );

      // When: display:none 을 선언한 규칙의 선택자만 모은다.
      const suppressionSelectors = Array.from(
        css.matchAll(/([^{}]+)\{([^{}]*)\}/gu),
        ([, selectors, declarations]) => ({ declarations, selectors }),
      )
        .filter(({ declarations }) => /display:\s*none/u.test(declarations))
        .map(({ selectors }) => selectors)
        .join("\n");

      // Then: 두 필드 HUD 표면이 모두 억제 대상이다.
      expect(suppressionSelectors).toContain(`.play-stage.${HUD_HIDDEN_CLASS} .minimap-root`);
      expect(suppressionSelectors).toContain(`.play-stage.${HUD_HIDDEN_CLASS} .hand-slot`);
    });
  });
});

describe("freezeFrameSaveRestore", () => {
  isolateTimers();
  function mkSession(project = createBlankProject()): PlaySession {
    return {
      switches: {},
      selfSwitches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [],
      monsterInstances: {},
      monsterParty: [],
      monsterBox: [],
      classOverrides: {},
      actorSkillIds: {},
      actorExperience: {},
      actorLevels: {},
      actorVitals: {},
      eventLocations: {},
      erasedEventIds: [],
      npcTravelStates: {},
      followers: [],
      followerTrail: [],
      actorEquipment: {},
      actorRows: {},
      currentMapId: project.startMapId,
      x: project.startPos.x,
      y: project.startPos.y,
      lighting: { ambient: 0, sources: [] },
      mapOverrides: {},
      flags: {},
      audio: {},
      pictures: {},
      playTimeSeconds: 0,
    };
  }
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length(): number {
      return this.store.size;
    }
    clear(): void {
      this.store.clear();
    }
    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }
    key(index: number): string | null {
      return [...this.store.keys()][index] ?? null;
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }
  }
  describe("세이브/로드 — 정지 화면", () => {
    it("정지 화면이 없으면 화면 상태에 적지 않는다", () => {
      const project = createBlankProject();
      const snapshot = createSaveSnapshot(project, mkSession(project));
      expect(snapshot.session.screen).toBeUndefined();
    });

    it("색감·다시 찍기 횟수·전환 시간은 슬롯을 다시 읽어도 남고, 찍은 그림은 세이브에 없다", () => {
      const project = createBlankProject();
      const session = mkSession(project);
      const screen = ensureM2Runtime(session).screen;
      screen.freeze = { style: "sepia", at: 2 };
      screen.freezeDurationMs = 400;

      const storage = new MemoryStorage();
      expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
      const stored = JSON.parse(storage.getItem(saveSlotKey(1)) ?? "{}") as {
        session: { screen: { freeze: Record<string, unknown> } };
      };
      expect(stored.session.screen.freeze).toEqual({ style: "sepia", at: 2 });

      const result = readSaveSlot(storage, 1);
      expect(result.kind).toBe("present");
      if (result.kind !== "present") return;
      expect(result.snapshot.session.screen).toMatchObject({
        freeze: { style: "sepia", at: 2 },
        freezeDurationMs: 400,
      });

      const restored = applySaveSnapshot(project, result.snapshot);
      expect(restored.m2Runtime?.screen.freeze).toEqual({ style: "sepia", at: 2 });
      expect(restored.m2Runtime?.screen.freezeDurationMs).toBe(400);
    });

    it("정지를 푼 뒤에는 세이브에 남지 않는다", () => {
      const project = createBlankProject();
      const session = mkSession(project);
      const screen = ensureM2Runtime(session).screen;
      screen.freeze = { style: "warm", at: 1 };
      screen.freezeDurationMs = 200;
      delete screen.freeze;
      delete screen.freezeDurationMs;

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
      expect(restored.m2Runtime?.screen.freeze).toBeUndefined();
    });

    it("깨진 정지 화면 칸은 슬롯 전체를 손상으로 보지 않고, 같이 적힌 색조는 남긴다", () => {
      const project = createBlankProject();
      const session = mkSession(project);
      ensureM2Runtime(session).screen.tint = "128,64,32";
      const storage = new MemoryStorage();
      expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
      const key = saveSlotKey(1);
      const raw = JSON.parse(storage.getItem(key) ?? "{}") as { session: { screen: Record<string, unknown> } };
      raw.session.screen.freeze = { style: "poster", at: 0, image: "data:image/png;base64,aaaa" };
      raw.session.screen.freezeDurationMs = -20;
      storage.setItem(key, JSON.stringify(raw));

      const result = readSaveSlot(storage, 1);
      expect(result.kind).toBe("present");
      if (result.kind !== "present") return;
      expect(result.snapshot.session.screen?.freeze).toBeUndefined();
      expect(result.snapshot.session.screen?.freezeDurationMs).toBeUndefined();
      expect(result.snapshot.session.screen?.tint).toBe("128,64,32");

      const restored = applySaveSnapshot(project, result.snapshot);
      expect(restored.m2Runtime?.screen.freeze).toBeUndefined();
      expect(restored.m2Runtime?.screen.tint).toBe("128,64,32");
    });

    it("전환 시간만 깨지면 정지 화면은 즉시(0ms)로 불러온다", () => {
      const project = createBlankProject();
      const session = mkSession(project);
      ensureM2Runtime(session).screen.freeze = { style: "mono", at: 1 };
      const storage = new MemoryStorage();
      expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
      const key = saveSlotKey(1);
      const raw = JSON.parse(storage.getItem(key) ?? "{}") as { session: { screen: Record<string, unknown> } };
      raw.session.screen.freezeDurationMs = 9_999_999;
      storage.setItem(key, JSON.stringify(raw));

      const result = readSaveSlot(storage, 1);
      expect(result.kind).toBe("present");
      if (result.kind !== "present") return;
      expect(result.snapshot.session.screen?.freeze).toEqual({ style: "mono", at: 1 });
      expect(result.snapshot.session.screen?.freezeDurationMs).toBeUndefined();
      expect(applySaveSnapshot(project, result.snapshot).m2Runtime?.screen.freezeDurationMs).toBe(0);
    });
  });
});
