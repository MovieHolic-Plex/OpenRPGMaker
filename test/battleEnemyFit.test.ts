/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene, type BattleDomController } from "@/player/battleDom";
import { syncBattleField } from "@/player/battleFieldDom";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

let controller: BattleDomController | undefined;
let fieldWidth = 640;
let fieldHeight = 360;

beforeEach(() => {
  vi.useFakeTimers();
  fieldWidth = 640;
  fieldHeight = 360;
  // happy-dom has no layout engine. Supply measured logical field geometry,
  // not transformed screen rects (the real player scales this whole stage 2x).
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function () {
    return this.classList.contains("battle-field") ? fieldWidth : 640;
  });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function () {
    return this.classList.contains("battle-field") ? fieldHeight : 480;
  });
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function () {
    return this.classList.contains("battle-enemy-group") ? 48 : 0;
  });
});
afterEach(() => {
  controller?.destroy();
  controller = undefined;
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mount(percent: number, skin: "rm2000" | "rm2003" | "pokemon" = "rm2003") {
  const project = createBlankProject();
  project.system.battleUiStyle = skin;
  project.system.battleModel = skin === "pokemon" ? "gen1" : "rm2k3";
  project.system.battleFlow = "strict";
  const enemy = project.database.enemies.find((entry) => entry.id === "enemy_stone_golem");
  const troop = project.database.troops.find((entry) => entry.id === "troop_golem_guard");
  if (!enemy || !troop) throw new Error("Missing golem fixture");
  enemy.battleScalePercent = percent;
  troop.enemyIds = [enemy.id];
  troop.members = [{ enemyId: enemy.id, x: 108, y: 124 }];
  store.replace(project);
  // Base dimensions are the real skin's contract; fit logic must not infer
  // them from animated or already-fitted rectangles.
  const style = document.createElement("style");
  style.textContent = `.battle-enemy-image { --battle-enemy-base-width: ${skin === "pokemon" ? 148 : 200}px; --battle-enemy-base-height: ${skin === "pokemon" ? 148 : 240}px; }`;
  const host = document.createElement("div");
  document.body.append(style, host);
  const runtime = createBattleRuntime({ project: store.getCurrent(), troopId: troop.id, canEscape: true, canLose: false, rng: () => 0 });
  controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
  const field = controller.root.querySelector<HTMLElement>(".battle-field");
  const node = field?.querySelector<HTMLElement>(".battle-enemy");
  const image = node?.querySelector<HTMLImageElement>(".battle-enemy-image");
  if (!field || !node || !image) throw new Error("Missing mounted enemy");
  return { runtime, field, node, image };
}

function geometry(node: HTMLElement, baseWidth = 200, baseHeight = 240) {
  const requested = Number(node.style.getPropertyValue("--battle-enemy-scale"));
  const fit = Number(node.style.getPropertyValue("--battle-enemy-fit") || 1);
  const width = baseWidth * requested * fit;
  const height = baseHeight * requested * fit;
  const x = Number.parseFloat(node.style.getPropertyValue("--battle-node-x")) / 100 * fieldWidth;
  const bottom = 48 + Number.parseFloat(node.style.getPropertyValue("--battle-node-y")) / 100 * (fieldHeight - 48);
  return { fit, width, height, x, bottom, top: bottom - height, left: x - width / 2, right: x + width / 2 };
}

describe("mounted enemy battlefield containment", () => {
  it("fits the measured 175 percent single golem without clipping or changing the authored value", () => {
    // Given/When: the real battle scene mounts the reported 640x360 field.
    const { node, image } = mount(175);
    const box = geometry(node);
    // Then: uniform image-only fit, safe top/bottom, unchanged requested scale.
    expect(box.top).toBeGreaterThanOrEqual(32 - 0.001);
    expect(box.bottom).toBeLessThanOrEqual(336);
    expect(box.height).toBeCloseTo(304);
    expect(box.width / box.height).toBeCloseTo(200 / 240);
    expect(node.style.getPropertyValue("--battle-enemy-scale")).toBe("1.75");
    expect(store.getCurrent().database.enemies.find((entry) => entry.id === "enemy_stone_golem")?.battleScalePercent).toBe(175);
    expect(image.style.transform).toBe("");
    expect(image.style.getPropertyValue("scale")).toBe("");
    expect(node.style.transform).toBe("");
    expect(node.querySelector<HTMLElement>(".battle-enemy-chrome")?.style.cssText).toBe("");
  });

  it.each([
    ["rm2003", 50, 200, 240, 216, 289.8],
    ["rm2003", 100, 200, 240, 216, 289.8],
    ["rm2000", 100, 200, 240, 320, 289.8],
    ["pokemon", 100, 148, 148, 490, 227.4],
  ] as const)("preserves the existing %s dimensions and anchor at %s percent", (skin, percent, width, height, x, bottom) => {
    const { node } = mount(percent, skin);
    const box = geometry(node, width, height);
    expect(box.fit).toBe(1);
    expect(box.width).toBe(width * percent / 100);
    expect(box.height).toBe(height * percent / 100);
    expect(box.x).toBe(x);
    expect(box.bottom).toBeCloseTo(bottom);
  });

  it("keeps the exact requested multiplier when only the ground anchor needs adjustment", () => {
    const { node } = mount(125);
    const box = geometry(node);
    expect(box.fit).toBe(1);
    expect(box.width).toBe(250);
    expect(box.height).toBe(300);
    expect(box.top).toBeCloseTo(32);
    expect(box.bottom).toBeCloseTo(332);
  });

  it.each(["rm2000", "rm2003", "pokemon"] as const)("fits 300 percent in %s and remains stable through hit/HUD synchronization", (skin) => {
    const { node, field, runtime } = mount(300, skin);
    const before = geometry(node, skin === "pokemon" ? 148 : 200, skin === "pokemon" ? 148 : 240);
    // When: hit/idle and HP disclosure use the existing mounted render lifecycle.
    syncBattleField(field, runtime.snapshot(), undefined, { hitTargetId: "enemy_stone_golem" });
    const snapshot = runtime.snapshot();
    const damaged = { ...snapshot, enemies: snapshot.enemies.map((enemy) => ({ ...enemy, hp: Math.floor(enemy.maxHp / 2) })) };
    syncBattleField(field, damaged, undefined, { calm: true });
    expect(node.dataset.battleHpRevealed).toBe("true");
    const after = geometry(node, skin === "pokemon" ? 148 : 200, skin === "pokemon" ? 148 : 240);
    expect(after).toEqual(before);
    expect(after.top).toBeGreaterThanOrEqual(32 - 0.001);
    expect(after.bottom).toBeLessThanOrEqual(336);
    expect(after.left).toBeGreaterThanOrEqual(16 - 0.001);
    expect(after.right).toBeLessThanOrEqual(624.001);
  });

  it("recomputes from requested dimensions rather than compounding fit after a field layout change", () => {
    const { node, field, runtime } = mount(175);
    fieldWidth = 240;
    syncBattleField(field, runtime.snapshot());
    const narrow = geometry(node);
    expect(narrow.width).toBeCloseTo(208);
    expect(narrow.left).toBeGreaterThanOrEqual(16 - 0.001);
    expect(narrow.right).toBeLessThanOrEqual(224.001);
    fieldWidth = 640;
    syncBattleField(field, runtime.snapshot());
    expect(geometry(node).height).toBeCloseTo(304);
  });

  it("does not keep a new layout timer alive after the battle controller is destroyed", () => {
    mount(175);
    controller?.destroy();
    expect(document.querySelector(".battle-scene")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
