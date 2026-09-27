/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import type { MutableBattler } from "@/battle/battleBattlers";
import { createBattleRuntime } from "@/battle/runtime";
import { isM2CatalogEntrySelectableInBattleEvent, m2CommandById } from "@/project/eventCommands/m2Catalog";
import {
  interpolateScreenFilter,
  NEUTRAL_SCREEN_FILTER,
  screenFilterCss,
  screenFilterFromFields,
} from "@/project/eventCommands/screenFilter";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, TroopRecord } from "@/project/types";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { syncScreenEffects } from "@/player/playSceneScreenEffects";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { mountBattleScene } from "@/player/battleDom";
import { syncBattleScreenFilter } from "@/player/battleScreenFilter";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";

// #37 Tint Screen 확장: 채도 0~200% · 흑백 · 세피아. 맵(필드 오버레이)과 전투(전투장 레이어) 둘 다.

type M2 = Extract<Command, { kind: "m2Command" }>;
const TINT_ID = "m2-046-tint-screen";

function tint(fields: M2["fields"]): M2 {
  return { kind: "m2Command", commandId: TINT_ID, fields };
}

function runOnMap(command: M2) {
  const project = store.getCurrent();
  const session = startSession(project);
  executeM2RuntimeCommand(session, m2CommandById(TINT_ID)!, command, { project });
  return session;
}

function sceneFor(session: ReturnType<typeof startSession>): { scene: PlaySceneContext; host: HTMLElement } {
  const host = document.createElement("div");
  document.body.append(host);
  const scene = {
    session,
    game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
  } as unknown as PlaySceneContext;
  return { scene, host };
}

beforeEach(() => {
  store.replace(createBlankProject());
  document.body.replaceChildren();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("screen filter model", () => {
  it("reads percentages from command fields and clamps them", () => {
    expect(screenFilterFromFields({ saturation: 250, grayscale: -5, sepia: "40" })).toEqual({ saturation: 200, grayscale: 0, sepia: 40 });
    expect(screenFilterFromFields({})).toEqual(NEUTRAL_SCREEN_FILTER);
  });

  it("builds the CSS filter list and stays empty when neutral", () => {
    expect(screenFilterCss({ saturation: 0, grayscale: 0, sepia: 0 })).toBe("saturate(0%)");
    expect(screenFilterCss({ saturation: 150, grayscale: 30, sepia: 60 })).toBe("saturate(150%) grayscale(30%) sepia(60%)");
    expect(screenFilterCss(NEUTRAL_SCREEN_FILTER)).toBe("");
  });

  it("interpolates between filters for the tint duration", () => {
    expect(interpolateScreenFilter(NEUTRAL_SCREEN_FILTER, { saturation: 0, grayscale: 100, sepia: 50 }, 0.5))
      .toEqual({ saturation: 50, grayscale: 50, sepia: 25 });
  });

  it("adds the three fields to the catalog with neutral defaults", () => {
    const keys = Object.fromEntries(m2CommandById(TINT_ID)!.fields.map((field) => [field.key, field.defaultValue]));
    expect(keys).toMatchObject({ saturation: 100, grayscale: 0, sepia: 0 });
  });
});

describe("Tint Screen on the field", () => {
  it("records the filter in m2Runtime.screen and paints a backdrop-filter layer", () => {
    const session = runOnMap(tint({ color: "neutral", value: "", durationMs: 0, saturation: 40, grayscale: 0, sepia: 70 }));
    expect(session.m2Runtime?.screen.filter).toEqual({ saturation: 40, grayscale: 0, sepia: 70 });
    const { scene, host } = sceneFor(session);
    syncScreenEffects(scene);
    const layer = host.querySelector<HTMLElement>("[data-testid='runtime-screen-filter']");
    expect(layer).not.toBeNull();
    expect(layer!.style.getPropertyValue("backdrop-filter")).toBe("saturate(40%) sepia(70%)");
    expect(layer!.dataset.filter).toBe("saturate(40%) sepia(70%)");
  });

  it("clears the filter when a later Tint Screen omits the fields (legacy command)", () => {
    const session = runOnMap(tint({ color: "neutral", durationMs: 0, grayscale: 100 }));
    const { scene, host } = sceneFor(session);
    syncScreenEffects(scene);
    expect(host.querySelector("[data-testid='runtime-screen-filter']")).not.toBeNull();
    executeM2RuntimeCommand(session, m2CommandById(TINT_ID)!, tint({ color: "red", value: "" }), { project: store.getCurrent() });
    expect(session.m2Runtime?.screen.filter).toBeUndefined();
    syncScreenEffects(scene);
    expect(host.querySelector("[data-testid='runtime-screen-filter']")).toBeNull();
    expect(host.querySelector("[data-testid='runtime-screen-effect']")).not.toBeNull();
  });

  it("tweens the filter over durationMs using animation frames", () => {
    const frames: FrameRequestCallback[] = [];
    let now = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const session = runOnMap(tint({ color: "neutral", durationMs: 1000, grayscale: 100 }));
    const { scene, host } = sceneFor(session);
    syncScreenEffects(scene);
    expect(host.querySelector("[data-testid='runtime-screen-filter']")).toBeNull();
    now = 500;
    frames.shift()!(now);
    const layer = host.querySelector<HTMLElement>("[data-testid='runtime-screen-filter']");
    expect(layer?.dataset.filter).toBe("grayscale(50%)");
    now = 1000;
    frames.shift()!(now);
    expect(layer?.dataset.filter).toBe("grayscale(100%)");
    expect(frames).toHaveLength(0);
  });

  it("survives a save/load round trip", () => {
    const session = runOnMap(tint({ color: "neutral", durationMs: 0, saturation: 160 }));
    const project = store.getCurrent();
    const snapshot = JSON.parse(JSON.stringify(createSaveSnapshot(project, session)));
    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.m2Runtime?.screen.filter).toEqual({ saturation: 160, grayscale: 0, sepia: 0 });
  });
});

describe("Tint Screen in battle", () => {
  function stubBattler(recordId: string): MutableBattler {
    return {
      id: recordId, recordId, name: recordId, maxHp: 50, maxMp: 10, attackPower: 10, defense: 5, mind: 5,
      agility: 10, chargeRate: 0.1, skillIds: [], hidden: false, hp: 50, mp: 10, gauge: 0,
      stateIds: [], stateTurns: {}, defending: false,
    } as MutableBattler;
  }

  function troopWith(commands: Command[]): TroopRecord {
    return {
      id: "troop_tint", name: "tint", enemyIds: [], members: [], autoAlign: true,
      battleEventPages: [{ id: "page1", name: "start", conditions: [{ kind: "onRound", round: 0 }], span: "battle", runOnce: true, commands }],
    };
  }

  it("executes in troop events and exposes the screen state in the event snapshot", () => {
    const project = createBlankProject();
    const runtime = createBattleEventRuntime({
      project,
      troopRecord: troopWith([tint({ color: "blue", value: "", durationMs: 300, saturation: 0, grayscale: 0, sepia: 0 })]),
      actors: [stubBattler("actor_hero")],
      enemies: [],
      stateIds: [],
      state: { switches: {}, variables: {}, inventory: {} },
    });
    runtime.applyTroopEvents({ turn: 0 });
    expect(runtime.snapshot().screen).toEqual({ tint: "blue", tintDurationMs: 300, filter: { saturation: 0, grayscale: 0, sepia: 0 } });
    expect(runtime.logs().some((entry) => entry.kind === "unsupported")).toBe(false);
  });

  it("paints tint + filter on the battle field layer and removes it when neutral", () => {
    const field = document.createElement("div");
    syncBattleScreenFilter(field, { tint: "neutral", tintDurationMs: 250, filter: { saturation: 100, grayscale: 80, sepia: 0 } });
    const layer = field.querySelector<HTMLElement>("[data-testid='battle-screen-filter']")!;
    expect(layer.style.getPropertyValue("backdrop-filter")).toBe("grayscale(80%)");
    expect(layer.style.transition).toContain("250ms");
    syncBattleScreenFilter(field, { tint: "red", tintDurationMs: 0, filter: { saturation: 100, grayscale: 80, sepia: 0 } });
    expect(layer.dataset.tint).toMatch(/^rgba\(/);
    syncBattleScreenFilter(field, { tint: "neutral", tintDurationMs: 0, filter: { saturation: 100, grayscale: 0, sepia: 0 } });
    expect(field.querySelector("[data-testid='battle-screen-filter']")).toBeNull();
    syncBattleScreenFilter(field, undefined);
    expect(field.querySelector("[data-testid='battle-screen-filter']")).toBeNull();
  });

  it("reaches the mounted battle scene through the real runtime", () => {
    const project = createBlankProject();
    const troop = project.database.troops[0]!;
    troop.battleEventPages = [{
      id: "page_tint", name: "start", conditions: [{ kind: "everyRound", start: 1, interval: 1 }], span: "battle", runOnce: true,
      commands: [tint({ color: "neutral", value: "", durationMs: 0, sepia: 90 })],
    }];
    store.replace(project);
    vi.useFakeTimers();
    try {
      const runtime = createBattleRuntime({ project, troopId: troop.id, canEscape: true, canLose: true, rng: () => 0.5 });
      // 트룹 페이지는 행동이 끝난 차례 경계에서 평가된다 — 방어를 몇 번 두며 런타임을 민다.
      for (let step = 0; step < 400 && !runtime.snapshot().eventState.screen && !runtime.snapshot().result; step += 1) {
        if (runtime.snapshot().phase === "actorCommand") runtime.performActorCommand({ kind: "defend" });
        else runtime.tick(500);
      }
      expect(runtime.snapshot().eventState.screen?.filter.sepia).toBe(90);
      const host = document.createElement("div");
      document.body.append(host);
      const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
      const layer = controller.root.querySelector<HTMLElement>(".battle-field [data-testid='battle-screen-filter']");
      expect(layer?.dataset.filter).toBe("sepia(90%)");
      controller.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("is pickable in troop battle events", () => {
    expect(isM2CatalogEntrySelectableInBattleEvent(m2CommandById(TINT_ID)!)).toBe(true);
  });
});

describe("Tint Screen editor form", () => {
  it("commits saturation/grayscale/sepia and previews the filter", () => {
    let staged: Command = tint({ color: "neutral", value: "", durationMs: 0 });
    const context = {
      path: [0],
      actions: {
        addCommand: vi.fn(), insertCommand: vi.fn(), deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn(),
        replaceCommand: (_path: readonly number[], command: Command) => { staged = structuredClone(command); },
      },
      getCurrentCommand: () => staged,
    } as unknown as CommandEditContext;
    const body = renderM2CommandBody(context, staged as M2)!;
    document.body.append(body);
    const set = (key: string, value: string): void => {
      const input = body.querySelector<HTMLInputElement>(`[data-testid='tint-screen-${key}-input']`);
      if (!input) throw new Error(`missing ${key}`);
      input.value = value;
      input.dispatchEvent(new Event("input"));
    };
    set("saturation", "30");
    set("grayscale", "20");
    set("sepia", "50");
    expect((staged as M2).fields).toMatchObject({ saturation: 30, grayscale: 20, sepia: 50 });
    const swatch = body.querySelector<HTMLElement>("[data-testid='tint-screen-preview-swatch']");
    expect(swatch?.dataset.filter).toBe("saturate(30%) grayscale(20%) sepia(50%)");
    // 같은 필드로 맵에서 실행하면 같은 필터가 걸린다.
    expect(runOnMap(staged as M2).m2Runtime?.screen.filter).toEqual({ saturation: 30, grayscale: 20, sepia: 50 });
  });
});
