// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BACKDROP_SCROLL_TILE_PX, battleBackdropMotion } from "@/battle/battleBackdrop";
import { createBattleRuntime } from "@/battle/runtime";
import { normalizeBattleBackdropAnimation } from "@/project/battleBackdropAnimation";
import { applyBattleMethod } from "@/project/battleMethod";
import { normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { applyFieldBackdrop, battleField } from "@/player/battleFieldDom";
import { applyBattleBackdropMotion, backdropImageUrl, clearBattleBackdropMotion } from "@/player/battleBackdropMotion";
import { renderTroopRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import type { BattleBackdropAnimation, Command, TroopRecord } from "@/project/types";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import type { MutableBattler } from "@/battle/battleBattlers";
import { isM2CatalogEntrySelectableInBattleEvent, m2CommandById } from "@/project/eventCommands/m2Catalog";
import { interpolateScreenFilter, NEUTRAL_SCREEN_FILTER, screenFilterCss, screenFilterFromFields } from "@/project/eventCommands/screenFilter";
import { startSession } from "@/project/session";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { syncScreenEffects } from "@/player/playSceneScreenEffects";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { mountBattleScene } from "@/player/battleDom";
import { syncBattleScreenFilter } from "@/player/battleScreenFilter";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { isolateTimers } from "./mergedTeardown";

describe("mgL5bvisBackdropMotion", () => {
  isolateTimers();
  // 마더2식 움직이는 전투 배경: 트룹 backdropAnimation(스크롤 x/y · 물결 진폭/주파수 · 색 순환)이
  // 배경 노드의 CSS 변수와 data 속성으로 옮겨지고, prefers-reduced-motion 이면 아무 것도 걸리지 않는다.

  function backdropNode(): HTMLElement {
    const node = document.createElement("div");
    node.className = "battle-backdrop";
    node.style.backgroundImage = 'linear-gradient(red, blue), url("/generated/battle-reference-forest.png")';
    return node;
  }
  function mountFieldFor(animation: BattleBackdropAnimation | undefined): HTMLElement {
    const project = createBlankProject();
    // Troop backdrop motion drives the non-layered (monster stand-off) skin; the default side view (retro2003) draws layered
    // scenery instead (battleFieldDom.battleField) — the same split the troop form test below relies on.
    project.system.battleUiStyle = "pokemon";
    const troop = project.database.troops[0]!;
    if (animation) troop.backdropAnimation = animation;
    store.replace(project);
    const runtime = createBattleRuntime({ project, troopId: troop.id, canEscape: true, canLose: true, rng: () => 0.5 });
    return battleField(runtime.snapshot());
  }
  describe("backdrop motion model", () => {
    it("translates scroll speeds into one seamless tile cycle", () => {
      const motion = battleBackdropMotion({ scrollX: 64, scrollY: -32 });
      expect(motion?.kinds).toEqual(["scroll"]);
      // 빠른 축(64px/s)이 한 타일(640px)을 지나는 10초가 한 사이클이다.
      expect(BACKDROP_SCROLL_TILE_PX / 64).toBe(10);
      expect(motion?.vars).toMatchObject({
        "--battle-backdrop-scroll-duration": "10s",
        "--battle-backdrop-scroll-x": "640px",
        "--battle-backdrop-scroll-y": "-320px",
      });
    });

    it("maps wave amplitude/frequency and palette cycle", () => {
      const motion = battleBackdropMotion({ waveAmplitude: 6, waveFrequency: 2, paletteCycleSeconds: 12 });
      expect(motion?.kinds).toEqual(["wave", "palette"]);
      expect(motion?.vars).toMatchObject({
        "--battle-backdrop-wave-amplitude": "6px",
        "--battle-backdrop-wave-duration": "0.5s",
        "--battle-backdrop-palette-duration": "12s",
      });
      // 주파수가 없으면 1 회/초.
      expect(battleBackdropMotion({ waveAmplitude: 4 })?.vars["--battle-backdrop-wave-duration"]).toBe("1s");
    });

    it("returns nothing for a static backdrop", () => {
      expect(battleBackdropMotion(undefined)).toBeUndefined();
      expect(battleBackdropMotion({ scrollX: 0, waveFrequency: 3 })).toBeUndefined();
    });

    it("normalizes: clamps to the authoring range and drops zero/invalid keys", () => {
      expect(normalizeBattleBackdropAnimation({ scrollX: 9999, scrollY: 0, waveAmplitude: -3, paletteCycleSeconds: "x" }))
        .toEqual({ scrollX: 400 });
      expect(normalizeBattleBackdropAnimation({ waveAmplitude: 30, waveFrequency: 20, paletteCycleSeconds: 90 }))
        .toEqual({ waveAmplitude: 24, waveFrequency: 8, paletteCycleSeconds: 60 });
      expect(normalizeBattleBackdropAnimation({})).toBeUndefined();
      expect(normalizeBattleBackdropAnimation([1, 2])).toBeUndefined();
    });
  });
  describe("backdrop motion on the battle DOM", () => {
    it("applies CSS variables and motion kinds to the troop backdrop", () => {
      const field = mountFieldFor({ scrollX: 40, paletteCycleSeconds: 8 });
      const backdrop = field.querySelector<HTMLElement>("[data-testid='battle-backdrop']")!;
      expect(backdrop.dataset.backdropMotion).toBe("scroll palette");
      expect(backdrop.style.getPropertyValue("--battle-backdrop-scroll-duration")).toBe("16s");
      expect(backdrop.style.getPropertyValue("--battle-backdrop-palette-duration")).toBe("8s");
    });

    it("leaves a legacy troop (no backdropAnimation) static", () => {
      const field = mountFieldFor(undefined);
      const backdrop = field.querySelector<HTMLElement>("[data-testid='battle-backdrop']")!;
      expect(backdrop.dataset.backdropMotion).toBeUndefined();
      expect(backdrop.style.getPropertyValue("--battle-backdrop-scroll-duration")).toBe("");
    });

    it("falls back to a still backdrop under prefers-reduced-motion", () => {
      const backdrop = backdropNode();
      const applied = applyBattleBackdropMotion(backdrop, { scrollX: 40, waveAmplitude: 6 }, { reducedMotion: true });
      expect(applied).toBeUndefined();
      expect(backdrop.dataset.backdropMotion).toBeUndefined();
      expect(backdrop.dataset.backdropMotionReduced).toBe("true");
      expect(backdrop.querySelector("canvas")).toBeNull();
    });

    it("reads the OS reduced-motion preference by default", () => {
      const original = window.matchMedia;
      window.matchMedia = ((query: string) => ({ matches: query.includes("reduce"), media: query })) as typeof window.matchMedia;
      try {
        const backdrop = backdropNode();
        expect(applyBattleBackdropMotion(backdrop, { scrollX: 40 })).toBeUndefined();
        expect(backdrop.dataset.backdropMotionReduced).toBe("true");
      } finally {
        window.matchMedia = original;
      }
    });

    it("clears motion when the backdrop becomes a field snapshot", () => {
      const field = mountFieldFor({ scrollY: 20 });
      const backdrop = field.querySelector<HTMLElement>("[data-testid='battle-backdrop']")!;
      expect(backdrop.dataset.backdropMotion).toBe("scroll");
      applyFieldBackdrop(field, "data:image/png;base64,AAAA", undefined);
      expect(backdrop.dataset.backdropMotion).toBeUndefined();
      expect(backdrop.style.getPropertyValue("--battle-backdrop-scroll-x")).toBe("");
    });

    it("mounts a wave canvas when a 2D context exists and removes it on clear", () => {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
      vi.stubGlobal("cancelAnimationFrame", () => undefined);
      const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
      try {
        const backdrop = backdropNode();
        const motion = applyBattleBackdropMotion(backdrop, { waveAmplitude: 6, waveFrequency: 2 }, { reducedMotion: false });
        expect(motion?.kinds).toEqual(["wave"]);
        expect(backdrop.dataset.backdropWave).toBe("canvas");
        expect(backdrop.querySelector("[data-testid='battle-backdrop-wave-canvas']")).not.toBeNull();
        expect(frames).toHaveLength(1);
        clearBattleBackdropMotion(backdrop);
        expect(backdrop.querySelector("canvas")).toBeNull();
        expect(backdrop.dataset.backdropWave).toBeUndefined();
      } finally {
        getContext.mockRestore();
        vi.unstubAllGlobals();
      }
    });

    it("skips the wave canvas without a 2D context and keeps CSS motion", () => {
      vi.stubGlobal("requestAnimationFrame", () => 1);
      try {
        const backdrop = backdropNode();
        const motion = applyBattleBackdropMotion(backdrop, { waveAmplitude: 6, scrollX: 10 }, { reducedMotion: false });
        expect(motion?.kinds).toEqual(["scroll", "wave"]);
        expect(backdrop.querySelector("canvas")).toBeNull();
        expect(backdrop.dataset.backdropWave).toBeUndefined();
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("extracts the image url behind the scrim gradient", () => {
      expect(backdropImageUrl('linear-gradient(rgba(0,0,0,.1), rgba(0,0,0,.2)), url("/a/b.png")')).toBe("/a/b.png");
      expect(backdropImageUrl("url(/x.png)")).toBe("/x.png");
      expect(backdropImageUrl("")).toBe("");
    });
  });
  describe("backdrop motion stylesheet", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/runtime/battle/30-backdrop-motion.css"), "utf8");
    const index = readFileSync(resolve(process.cwd(), "src/styles/runtime/index.css"), "utf8");

    it("is imported into the runtime layer", () => {
      expect(index).toContain('@import "./battle/30-backdrop-motion.css" layer(runtime);');
    });

    it("drives scroll and palette keyframes from the JS variables", () => {
      expect(css).toMatch(/@keyframes battle-backdrop-scroll[\s\S]*var\(--battle-backdrop-scroll-x/);
      expect(css).toMatch(/@keyframes battle-backdrop-palette[\s\S]*hue-rotate\(360deg\)/);
      expect(css).toContain("var(--battle-backdrop-scroll-duration");
      expect(css).toContain("var(--battle-backdrop-palette-duration");
    });

    it("stops all backdrop motion under prefers-reduced-motion", () => {
      expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.battle-backdrop\[data-backdrop-motion\] \{ animation: none; \}/);
    });
  });
  describe("troop editor exposes backdrop motion", () => {
    let restore: (() => void) | undefined;
    beforeEach(() => { store.replace(createBlankProject()); });
    afterEach(() => { restore?.(); restore = undefined; });

    // 그림 한 장을 움직이는 효과라 그림을 그대로 까는 몬스터 대치에서만 칸을 보인다(2026-10-02).
    it("hides the motion fields in the default side-view battle", () => {
      const troop = store.getCurrent().database.troops[0]!;
      const form = document.createElement("section");
      document.body.append(form);
      renderTroopRecordForm(form, troop, () => undefined);
      expect(form.querySelector("[data-testid='db-troop-backdrop-motion']")).toBeNull();
      expect(form.querySelector("[data-testid='db-troop-scenery-scenery']")).not.toBeNull();
      // 배경 카드는 접힌 「배경 고르기」 뒤에 있다(버튼 줄이기). 「배경 변경」 은 그 밖, 「설정」 접기 안에 남는다(btn-trim-r2).
      const fold = form.querySelector("[data-testid='db-troop-scenery-toggle']")?.parentElement as HTMLDetailsElement | null;
      expect(fold?.open).toBe(false);
      expect(form.querySelector<HTMLElement>("[data-testid='db-troop-scenery-scenery']")?.closest("[hidden]")).not.toBeNull();
      const cycleFold = form.querySelector("[data-testid='db-troop-change-background']")?.closest("details");
      expect(cycleFold?.querySelector("summary")?.getAttribute("data-testid")).toBe("db-troop-config-toggle");
      form.remove();
    });

    it("writes scroll/wave/palette values that survive save and load", () => {
      store.update((project) => applyBattleMethod(project, "monster"));
      const troop = store.getCurrent().database.troops[0]!;
      const form = document.createElement("section");
      document.body.append(form);
      renderTroopRecordForm(form, troop, () => undefined);
      const set = (key: string, value: string): void => {
        const input = form.querySelector<HTMLInputElement>(`[data-testid='db-field-troop-backdrop-${key}']`);
        if (!input) throw new Error(`missing backdrop field ${key}`);
        input.value = value;
        input.dispatchEvent(new Event("input"));
      };
      set("scrollX", "30");
      set("waveAmplitude", "5");
      set("paletteCycleSeconds", "10");
      const saved = store.getCurrent().database.troops.find((entry) => entry.id === troop.id)!;
      expect(saved.backdropAnimation).toEqual({ scrollX: 30, waveAmplitude: 5, paletteCycleSeconds: 10 });

      set("scrollX", "0");
      expect(store.getCurrent().database.troops.find((entry) => entry.id === troop.id)!.backdropAnimation)
        .toEqual({ waveAmplitude: 5, paletteCycleSeconds: 10 });

      const reloaded = deserialize(serialize(store.getCurrent()));
      expect(reloaded.database.troops.find((entry) => entry.id === troop.id)!.backdropAnimation)
        .toEqual({ waveAmplitude: 5, paletteCycleSeconds: 10 });
      form.remove();
    });

    it("keeps legacy troops without the key", () => {
      const legacy = normalizeTroopRecord({ id: "troop_legacy", name: "옛 그룹", enemyIds: [], battleEventPages: [] });
      expect("backdropAnimation" in legacy).toBe(false);
    });
  });
});

describe("mgL5bvisScreenFilter", () => {
  isolateTimers();
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
});
