/** @vitest-environment happy-dom */
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
import type { BattleBackdropAnimation } from "@/project/types";

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
  const css = readFileSync(resolve(process.cwd(), "src/styles/runtime/battle/24-backdrop-motion.css"), "utf8");
  const index = readFileSync(resolve(process.cwd(), "src/styles/runtime/index.css"), "utf8");

  it("is imported into the runtime layer", () => {
    expect(index).toContain('@import "./battle/24-backdrop-motion.css" layer(runtime);');
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
