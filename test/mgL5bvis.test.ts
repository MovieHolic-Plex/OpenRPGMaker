// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BACKDROP_SCROLL_TILE_PX, battleBackdropMotion } from "@/battle/battleBackdrop";
import { createBattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { normalizeBattleBackdropAnimation } from "@/project/battleBackdropAnimation";
import { applyBattleMethod } from "@/project/battleMethod";
import { normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { applyFieldBackdrop, battleField, battlePartyStatus, syncBattleParty } from "@/player/battleFieldDom";
import { applyBattleBackdropMotion, backdropImageUrl, clearBattleBackdropMotion } from "@/player/battleBackdropMotion";
import { renderTroopRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import type { BattleBackdropAnimation, Command, TroopRecord } from "@/project/types";
import { mountBattleScene } from "@/player/battleDom";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { findByTestId, installFakeDom } from "./fakeDom";
import { applyRollingHpSurvival, createRollingHpMeter, DEFAULT_ROLLING_HP_PER_SECOND, normalizeRollingHpSpeed, startRollingHpTicker } from "@/player/rollingHp";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import type { MutableBattler } from "@/battle/battleBattlers";
import { isM2CatalogEntrySelectableInBattleEvent, m2CommandById } from "@/project/eventCommands/m2Catalog";
import { interpolateScreenFilter, NEUTRAL_SCREEN_FILTER, screenFilterCss, screenFilterFromFields } from "@/project/eventCommands/screenFilter";
import { startSession } from "@/project/session";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { syncScreenEffects } from "@/player/playSceneScreenEffects";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
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
      // 배경 카드는 접힌 「배경 고르기」 뒤에 있다(버튼 줄이기). 「배경 변경」 은 밖에 남는다.
      const fold = form.querySelector("[data-testid='db-troop-scenery-toggle']")?.parentElement as HTMLDetailsElement | null;
      expect(fold?.open).toBe(false);
      expect(form.querySelector<HTMLElement>("[data-testid='db-troop-scenery-scenery']")?.closest("[hidden]")).not.toBeNull();
      expect(form.querySelector("[data-testid='db-troop-change-background']")?.closest("details")).toBeNull();
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

describe("mgL5bvisRollingHp", () => {
  isolateTimers();
  // 마더(EarthBound)식 롤링 HP: 표시 HP 가 실제 HP 쪽으로 초당 N 만큼 흐르고, 치명타를 받은 아군은
  // 미터가 0 에 닿기 전까지 「쓰러지는 중」이며, 그 사이 전투가 끝나면 미터에 남은 HP 로 살아남는다.

  function battleSnapshot(): BattleSnapshot {
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const troop = project.database.troops[0];
    if (!actor || !troop) throw new Error("Missing rolling HP fixture records");
    const runtime = createBattleRuntime({
      project, troopId: troop.id, canEscape: true, canLose: true, rng: () => 0.5,
      party: { partyActorIds: [actor.id], levels: { [actor.id]: 5 }, experience: {} },
    });
    const snapshot = runtime.snapshot();
    const first = snapshot.actors[0]!;
    return { ...snapshot, actors: [{ ...first, maxHp: 100, hp: 100, defeated: false }] };
  }
  function withActorHp(snapshot: BattleSnapshot, hp: number): BattleSnapshot {
    return { ...snapshot, actors: snapshot.actors.map((actor) => ({ ...actor, hp, defeated: hp <= 0 })) };
  }
  function hpText(party: HTMLElement): string {
    return party.querySelector(".battle-actor-hp .battle-vital-value")?.textContent?.trim() ?? "";
  }
  describe("rolling HP meter model", () => {
    it("rolls displayed HP toward the target at the configured speed", () => {
      const meter = createRollingHpMeter({ perSecond: 50, nowMs: 0 });
      expect(meter.setTarget("a", 100, 100)).toBe(100);
      expect(meter.setTarget("a", 20, 100)).toBe(100);
      meter.advance(1000);
      expect(meter.displayed("a")).toBe(50);
      meter.advance(1500);
      expect(meter.displayed("a")).toBe(25);
      meter.advance(5000);
      expect(meter.displayed("a")).toBe(20);
      expect(meter.isRolling()).toBe(false);
    });

    it("rolls healing upward as well", () => {
      const meter = createRollingHpMeter({ perSecond: 10, nowMs: 0 });
      meter.setTarget("a", 10, 100);
      meter.setTarget("a", 60, 100);
      meter.advance(2000);
      expect(meter.displayed("a")).toBe(30);
    });

    it("marks a lethally hit actor as dying until the meter reaches zero", () => {
      const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
      meter.setTarget("a", 80, 100);
      meter.setTarget("a", 0, 100);
      expect(meter.isDying("a")).toBe(true);
      meter.advance(1000);
      expect(meter.displayed("a")).toBe(40);
      expect(meter.isDying("a")).toBe(true);
      meter.advance(2000);
      expect(meter.displayed("a")).toBe(0);
      expect(meter.isDying("a")).toBe(false);
    });

    it("stops rolling once frozen at the result screen", () => {
      const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
      meter.setTarget("a", 80, 100);
      meter.setTarget("a", 0, 100);
      meter.advance(1000);
      meter.freeze();
      meter.advance(9000);
      meter.setTarget("a", 0, 100);
      expect(meter.displayed("a")).toBe(40);
      expect(meter.isRolling()).toBe(false);
    });

    it("settles to the real HP on defeat so no dying cue lingers", () => {
      const meter = createRollingHpMeter({ perSecond: 5, nowMs: 0 });
      meter.setTarget("a", 514, 514);
      meter.setTarget("a", 0, 514);
      meter.advance(2000);
      expect(meter.displayed("a")).toBe(504);
      meter.settle();
      expect(meter.displayed("a")).toBe(0);
      expect(meter.isDying("a")).toBe(false);
      meter.setTarget("a", 100, 514);
      expect(meter.displayed("a")).toBe(0);
    });

    it("clamps the speed to 1..999 and defaults to 40", () => {
      expect(normalizeRollingHpSpeed(undefined)).toBe(DEFAULT_ROLLING_HP_PER_SECOND);
      expect(normalizeRollingHpSpeed(0)).toBe(1);
      expect(normalizeRollingHpSpeed(5000)).toBe(999);
      expect(normalizeRollingHpSpeed(Number.NaN)).toBe(40);
    });
  });
  describe("rolling HP survival settlement", () => {
    it("survives lethal damage when the battle is won before the meter reaches zero", () => {
      const base = battleSnapshot();
      const actorId = base.actors[0]!.recordId;
      const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
      meter.setTarget(actorId, 100, 100);
      meter.setTarget(actorId, 0, 100);
      meter.advance(1000);
      meter.freeze();
      const dead = withActorHp(base, 0);
      const settled = applyRollingHpSurvival("victory", dead, meter);
      expect(settled.actors[0]).toMatchObject({ hp: 60, defeated: false });
      expect(dead.actors[0]!.hp).toBe(0);
    });

    it("also settles an escape, but never a defeat", () => {
      const base = battleSnapshot();
      const actorId = base.actors[0]!.recordId;
      const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
      meter.setTarget(actorId, 100, 100);
      meter.setTarget(actorId, 0, 100);
      meter.advance(500);
      const dead = withActorHp(base, 0);
      expect(applyRollingHpSurvival("escape", dead, meter).actors[0]!.hp).toBe(80);
      expect(applyRollingHpSurvival("defeat", dead, meter)).toBe(dead);
    });

    it("keeps real HP when a heal is still rolling up (never settles below the real value)", () => {
      const base = battleSnapshot();
      const actorId = base.actors[0]!.recordId;
      const meter = createRollingHpMeter({ perSecond: 10, nowMs: 0 });
      meter.setTarget(actorId, 10, 100);
      meter.setTarget(actorId, 90, 100);
      meter.advance(1000);
      const healed = withActorHp(base, 90);
      expect(applyRollingHpSurvival("victory", healed, meter).actors[0]!.hp).toBe(90);
    });

    it("leaves the snapshot untouched without a meter (legacy projects)", () => {
      const dead = withActorHp(battleSnapshot(), 0);
      expect(applyRollingHpSurvival("victory", dead, undefined)).toBe(dead);
    });
  });
  describe("party HUD with the rolling HP meter", () => {
    it("shows the meter value and a dying cue instead of the instant HP", () => {
      const base = battleSnapshot();
      const party = battlePartyStatus(base);
      const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
      syncBattleParty(party, base, { rollingHp: meter });
      expect(hpText(party)).toBe("100");

      const lethal = withActorHp(base, 0);
      syncBattleParty(party, lethal, { rollingHp: meter });
      const row = party.querySelector<HTMLElement>(".battle-actor-status")!;
      expect(hpText(party)).toBe("100");
      expect(row.dataset.rollingHpDying).toBe("true");
      expect(row.classList.contains("defeated")).toBe(false);

      meter.advance(1000);
      syncBattleParty(party, lethal, { rollingHp: meter });
      expect(hpText(party)).toBe("60");

      meter.advance(3500);
      syncBattleParty(party, lethal, { rollingHp: meter });
      expect(hpText(party)).toBe("0");
      expect(row.dataset.rollingHpDying).toBeUndefined();
      expect(row.classList.contains("defeated")).toBe(true);
    });

    it("shows a frozen survivor as alive without the dying cue on the result screen", () => {
      const base = battleSnapshot();
      const party = battlePartyStatus(base);
      const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
      syncBattleParty(party, base, { rollingHp: meter });
      const lethal = withActorHp(base, 0);
      syncBattleParty(party, lethal, { rollingHp: meter });
      meter.advance(1000);
      meter.freeze();
      syncBattleParty(party, lethal, { rollingHp: meter });
      const row = party.querySelector<HTMLElement>(".battle-actor-status")!;
      expect(hpText(party)).toBe("60");
      expect(row.dataset.rollingHpDying).toBeUndefined();
      expect(row.classList.contains("defeated")).toBe(false);
    });

    it("shows the instant HP without a meter", () => {
      const base = battleSnapshot();
      const party = battlePartyStatus(base);
      syncBattleParty(party, withActorHp(base, 0));
      expect(hpText(party)).toBe("0");
      expect(party.querySelector<HTMLElement>(".battle-actor-status")!.classList.contains("defeated")).toBe(true);
    });
  });
  describe("rolling HP ticker", () => {
    it("drives frames only while rolling and renders on each visible change", () => {
      const callbacks: ((now: number) => void)[] = [];
      const scheduler = {
        request: (callback: (now: number) => void) => { callbacks.push(callback); return callbacks.length; },
        cancel: () => undefined,
      };
      const meter = createRollingHpMeter({ perSecond: 100 });
      meter.setTarget("a", 100, 100);
      let renders = 0;
      const ticker = startRollingHpTicker(meter, () => { renders += 1; }, scheduler);
      ticker.kick();
      expect(callbacks).toHaveLength(0);

      meter.setTarget("a", 50, 100);
      ticker.kick();
      ticker.kick();
      expect(callbacks).toHaveLength(1);
      callbacks.shift()!(1000);
      expect(meter.displayed("a")).toBe(100);
      callbacks.shift()!(1250);
      expect(meter.displayed("a")).toBe(75);
      callbacks.shift()!(2000);
      expect(meter.displayed("a")).toBe(50);
      expect(renders).toBe(2);
      expect(callbacks).toHaveLength(0);
      ticker.stop();
    });
  });
  describe("rolling HP system settings round-trip", () => {
    it("keeps explicit settings and omits defaults", () => {
      const system = createBlankProject().system;
      const kept = normalizeSystemRecords({ ...system, battleRollingHp: true, battleRollingHpPerSecond: 2000 });
      expect(kept.battleRollingHp).toBe(true);
      expect(kept.battleRollingHpPerSecond).toBe(999);
      const legacy = normalizeSystemRecords({ ...system });
      expect("battleRollingHp" in legacy).toBe(false);
      expect("battleRollingHpPerSecond" in legacy).toBe(false);
    });
  });
  describe("battle scene settles rolling HP on the confirmed result", () => {
    async function runLethalVictory(rolling: boolean): Promise<{ hp: number; defeated: boolean; rollingAttr?: string }> {
      const project = createBlankProject();
      if (rolling) {
        project.system.battleRollingHp = true;
        // 가장 느린 속도 — 결과가 뜰 때까지 미터가 거의 내려가지 않는다(치명타 생존).
        project.system.battleRollingHpPerSecond = 1;
      }
      store.replace(project);
      const actor = project.database.actors[0]!;
      const troop = project.database.troops[0]!;
      const real = createBattleRuntime({
        project, troopId: troop.id, canEscape: true, canLose: true, rng: () => 0.5,
        party: { partyActorIds: [actor.id], levels: { [actor.id]: 5 }, experience: {} },
      });
      const start = real.snapshot();
      const alive: BattleSnapshot = {
        ...start,
        phase: "charging",
        result: undefined,
        actors: start.actors.map((entry) => ({ ...entry, maxHp: 100, hp: 100, defeated: false })),
      };
      // 한 틱 뒤 치명타 + 같은 라운드 승리: 규칙 엔진 스냅샷은 HP 0 이다.
      const won: BattleSnapshot = {
        ...alive,
        result: "victory",
        actors: alive.actors.map((entry) => ({ ...entry, hp: 0, defeated: true })),
      };
      let current = alive;
      const runtime = { ...real, snapshot: () => current, tick: () => { current = won; }, cancel: () => undefined };
      vi.useFakeTimers();
      const host = document.createElement("div");
      document.body.append(host);
      let settled: BattleSnapshot | undefined;
      const controller = mountBattleScene({
        host, runtime, introHold: false,
        onResult: (_result, snapshot) => { settled = snapshot; },
      });
      try {
        const rollingAttr = controller.root.dataset.battleRollingHp;
        await vi.advanceTimersByTimeAsync(20_000);
        // 결과 확정 입력(첫 확인 = 보상 공개, 둘째 = 닫기).
        for (let press = 0; press < 4 && !settled; press += 1) {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
          await vi.advanceTimersByTimeAsync(1_000);
        }
        if (!settled) throw new Error("battle result was never confirmed");
        const shown = settled.actors[0]!;
        return { hp: shown.hp, defeated: shown.defeated, rollingAttr };
      } finally {
        controller.destroy();
        host.remove();
        vi.useRealTimers();
      }
    }

    it("passes the meter HP to onResult so the actor survives a lethal hit", async () => {
      const outcome = await runLethalVictory(true);
      expect(outcome.rollingAttr).toBe("true");
      expect(outcome.defeated).toBe(false);
      expect(outcome.hp).toBeGreaterThan(80);
    });

    it("keeps the engine's lethal HP when the option is off", async () => {
      const outcome = await runLethalVictory(false);
      expect(outcome.rollingAttr).toBeUndefined();
      expect(outcome).toMatchObject({ hp: 0, defeated: true });
    });
  });
  describe("rolling HP editor exposure", () => {
    it("lets an author turn the meter on and set its speed in the system battle settings", () => {
      const restore = installFakeDom();
      try {
        store.replace(createBlankProject());
        const host = document.createElement("div");
        const rerender = (): void => { host.replaceChildren(); renderSystemTab(host, rerender); };
        rerender();
        const toggle = findByTestId(host as never, "db-field-system-rolling-hp") as unknown as HTMLInputElement;
        const speedRow = () => findByTestId(host as never, "db-field-system-rolling-hp-speed") as unknown as HTMLInputElement;
        expect(toggle.checked).toBe(false);
        expect(speedRow().getAttribute("disabled")).not.toBeNull();

        toggle.checked = true;
        toggle.dispatchEvent(new Event("change"));
        expect(store.getCurrent().system.battleRollingHp).toBe(true);
        expect(speedRow().getAttribute("disabled")).toBeNull();

        const speed = speedRow();
        speed.value = "120";
        speed.dispatchEvent(new Event("input"));
        expect(store.getCurrent().system.battleRollingHpPerSecond).toBe(120);

        const reloaded = deserialize(serialize(store.getCurrent()));
        expect(reloaded.system.battleRollingHp).toBe(true);
        expect(reloaded.system.battleRollingHpPerSecond).toBe(120);
      } finally {
        restore();
      }
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
