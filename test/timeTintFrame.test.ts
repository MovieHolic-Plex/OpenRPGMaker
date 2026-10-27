import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { installTimeTintLayer, timeTintVisualForPhase, updateTimeTint } from "@/player/playSceneTime";

function graphicsRecorder() {
  return {
    clears: 0,
    fills: 0,
    visible: true,
    lastFill: undefined as { color: number; alpha: number } | undefined,
    lastRect: undefined as { x: number; y: number; w: number; h: number } | undefined,
    clear() { this.clears += 1; },
    setVisible(visible: boolean) { this.visible = visible; return this; },
    setScrollFactor() { return this; },
    setDepth() { return this; },
    fillStyle(color: number, alpha: number) { this.lastFill = { color, alpha }; return this; },
    fillRect(x: number, y: number, w: number, h: number) { this.fills += 1; this.lastRect = { x, y, w, h }; return this; },
  };
}

function sceneFor(graphics: ReturnType<typeof graphicsRecorder>) {
  const camera = { width: 480, height: 270 };
  const scene = {
    add: { graphics: () => graphics },
    cameras: { main: camera },
    session: { gameTime: undefined as { minute: number; hour: number; day: number; season: "spring"; year: number } | undefined },
    timeTintTransition: null,
  };
  return { scene, camera };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("time tint frame budget", () => {
  it("clears a hidden tint once when the clock is off", () => {
    vi.spyOn(store, "getCurrent").mockReturnValue(createBlankProject());
    const graphics = graphicsRecorder();
    const { scene } = sceneFor(graphics);
    installTimeTintLayer(scene as never);
    expect(graphics.clears).toBe(1);
    expect(graphics.visible).toBe(false);
    for (let frame = 0; frame < 30; frame += 1) updateTimeTint(scene as never, 16);
    expect(graphics.clears).toBe(1);
    expect(graphics.fills).toBe(0);
  });

  it("paints a stable night tint once and again when the camera size changes", () => {
    const project = createBlankProject();
    project.system = { ...project.system, timeSystem: { enabled: true } };
    vi.spyOn(store, "getCurrent").mockReturnValue(project);
    const graphics = graphicsRecorder();
    const { scene, camera } = sceneFor(graphics);
    const session = startSession(project);
    session.gameTime = { minute: 0, hour: 21, day: 1, season: "spring", year: 1 };
    scene.session = session;
    installTimeTintLayer(scene as never);
    const night = timeTintVisualForPhase("night");
    updateTimeTint(scene as never, 1500);
    expect(graphics.fills).toBe(1);
    expect(graphics.lastFill).toEqual({ color: night.color, alpha: night.alpha });
    expect(graphics.lastRect).toEqual({ x: 0, y: 0, w: 480, h: 270 });
    expect(graphics.visible).toBe(true);
    const clears = graphics.clears;
    for (let frame = 0; frame < 30; frame += 1) updateTimeTint(scene as never, 16);
    expect(graphics.clears).toBe(clears);
    expect(graphics.fills).toBe(1);
    camera.width = 960;
    updateTimeTint(scene as never, 16);
    expect(graphics.fills).toBe(2);
    expect(graphics.clears).toBe(clears + 1);
    expect(graphics.lastRect).toEqual({ x: 0, y: 0, w: 960, h: 270 });
    updateTimeTint(scene as never, 16);
    expect(graphics.fills).toBe(2);
  });
});
