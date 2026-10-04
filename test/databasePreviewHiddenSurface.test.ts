// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderEnemyPixelPreview } from "@/editor/panels/databaseEnemyPixelPreview";
import { renderSkillRetroStage } from "@/editor/panels/databaseSkillRetroStage";
import { PIXEL_ENEMY_SHEETS } from "@/assets/pixelEnemySheets";
import { createBlankProject } from "@/project/defaults";
import { disposeDatabasePreviewsIn, retainDatabasePreviewsIn, setDatabasePreviewSurfaceActive, setDatabasePreviewsActiveIn } from "@/editor/panels/databasePreviewLifecycle";

let host: HTMLElement;
let pending: Map<number, FrameRequestCallback>;
let hidden = false;
let reduced = false;
beforeEach(() => {
  pending = new Map(); hidden = false; reduced = false;
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { pending.set(++id, callback); return id; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => pending.delete(id));
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  vi.spyOn(preference, "matches", "get").mockImplementation(() => reduced);
  vi.spyOn(window, "matchMedia").mockReturnValue(preference);
  vi.stubGlobal("Image", class extends EventTarget {
    complete = true; naturalWidth = 480; naturalHeight = 480;
    set src(_url: string) { queueMicrotask(() => this.dispatchEvent(new Event("load"))); this.onload?.(); }
    onload?: () => void;
  });
  host = document.createElement("section");
  document.body.append(host);
  setDatabasePreviewSurfaceActive(host, false);
});
afterEach(() => {
  disposeDatabasePreviewsIn(host);
  document.body.replaceChildren();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function construct(kind: "skill" | "enemy"): Promise<HTMLElement> {
  const project = createBlankProject();
  const result = kind === "enemy"
    ? renderEnemyPixelPreview({ name: "Preview", monsterResourceId: PIXEL_ENEMY_SHEETS[0]!.resourceId })
    : renderSkillRetroStage(project.database.skills.find(skill => skill.id === "skill_attack")!, project);
  if (!result) throw new Error(`Missing ${kind} stage fixture`);
  host.append(result.element);
  await Promise.resolve(); await Promise.resolve();
  const stage = host.querySelector<HTMLElement>("[data-editor-preview-lifecycle]");
  if (!stage) throw new Error("Missing lifecycle stage");
  return stage;
}
function tick(stamp: number): void {
  const callbacks = [...pending.values()]; pending.clear();
  for (const callback of callbacks) callback(stamp);
}

describe("real retro/pixel stages on inactive surfaces", () => {
  it.each(["skill", "enemy"] as const)("keeps %s parked, pauses document hiding, reattaches cache and tears down", async kind => {
    const stage = await construct(kind);
    expect(pending.size).toBe(0);
    expect(stage.dataset.running).not.toBe("true");
    setDatabasePreviewSurfaceActive(host, true);
    expect(pending.size).toBe(1);
    tick(16); tick(100);
    hidden = true; document.dispatchEvent(new Event("visibilitychange"));
    expect(pending.size).toBe(0);
    hidden = false; document.dispatchEvent(new Event("visibilitychange"));
    expect(pending.size).toBe(1);
    retainDatabasePreviewsIn(host, true);
    setDatabasePreviewsActiveIn(host, false);
    const content = [...host.childNodes]; host.replaceChildren();
    await Promise.resolve();
    expect(pending.size).toBe(0);
    host.append(...content);
    retainDatabasePreviewsIn(host, false);
    setDatabasePreviewsActiveIn(host, true);
    expect(pending.size).toBe(1);
    disposeDatabasePreviewsIn(host);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(pending.size).toBe(0);
  });

  it.each(["skill", "enemy"] as const)("does not start %s under reduced motion", async kind => {
    reduced = true;
    await construct(kind);
    setDatabasePreviewSurfaceActive(host, true);
    expect(pending.size).toBe(0);
  });

  it("preserves the enemy's still-cell choice after hide/reveal", async () => {
    await construct("enemy");
    setDatabasePreviewSurfaceActive(host, true);
    const cell = host.querySelector<HTMLButtonElement>("[data-testid='db-enemy-pixel-cell-idle_a']")!;
    cell.click();
    setDatabasePreviewSurfaceActive(host, false);
    setDatabasePreviewSurfaceActive(host, true);
    expect(pending.size).toBe(0);
    expect(cell.getAttribute("aria-pressed")).toBe("true");
  });
});
