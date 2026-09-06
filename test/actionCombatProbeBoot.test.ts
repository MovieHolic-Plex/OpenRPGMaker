/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";

const { rendered } = vi.hoisted(() => ({ rendered: vi.fn() }));
vi.mock("@/player/player", () => ({ renderPlayer: rendered }));
vi.mock("@/player/audio", () => ({ stopAllAudio: vi.fn() }));
vi.mock("@/project/store", () => import("@/player/exportProjectStoreShim"));

beforeEach(() => {
  vi.resetModules();
  rendered.mockReset();
  document.body.innerHTML = '<div id="app"></div>';
  const base = document.createElement("base");
  base.href = `${location.origin}/export-player/`;
  document.head.append(base);
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "__OPENRPG_BOOT__");
  document.querySelector("base")?.remove();
  document.body.replaceChildren();
});

describe("private action proof exported boot", () => {
  it.each([
    { qaInstrumentation: true, probe: true, expectedBase: "/" },
    { qaInstrumentation: false, probe: true, expectedBase: "/export-player/" },
    { qaInstrumentation: true, probe: false, expectedBase: "/export-player/" },
  ])("uses editor public assets only with both probe capabilities: $qaInstrumentation/$probe", async ({ qaInstrumentation, probe, expectedBase }) => {
    const project = createBlankProject();
    Reflect.set(window, "__OPENRPG_BOOT__", {
      qaInstrumentation,
      ...(probe ? { actionCombatProbe: { runId: "owned-run", mapId: project.startMapId } } : {}),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(serialize(project))));
    const ready = new Promise<void>(resolve => rendered.mockImplementation(() => resolve()));
    await import("@/player/exportEntry");
    await ready;
    const { withInlineAsset } = await import("@/assets/inlineAssetStore");
    expect(withInlineAsset("/assets/easyrpg-chipset-exterior.png"))
      .toBe(`${location.origin}${expectedBase}assets/easyrpg-chipset-exterior.png`);
    const options = rendered.mock.calls[0]?.[1];
    expect(Boolean(options.startOverride)).toBe(qaInstrumentation && probe);
  });
});
