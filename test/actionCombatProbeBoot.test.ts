/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";

// Each case serializes the ~63MB blank project and boots the exported player from it; under
// ci-full load (8 workers on 4 cores) that alone can pass vitest's 15s default.
vi.setConfig({ testTimeout: 60_000 });

const { rendered } = vi.hoisted(() => ({ rendered: vi.fn() }));
vi.mock("@/player/player", () => ({ renderPlayer: rendered }));
// exportEntry unlocks audio inside the first-screen gesture (getAudioEngine().unlock()). Without it in the
// mock, boot rejected unhandled and `ready` never resolved — the "timeout" was this hang.
vi.mock("@/player/audio", () => ({ stopAllAudio: vi.fn(), getAudioEngine: () => ({ unlock: vi.fn() }) }));
vi.mock("@/project/store", () => import("@/player/exportProjectStoreShim"));

beforeEach(() => {
  vi.resetModules();
  rendered.mockReset();
  document.body.innerHTML = '<div id="app"></div>';
  const base = document.createElement("base");
  // A plain exported-game folder. Under /export-player/ every build is "hosted" and always reads assets from the
  // editor root (exportAssetBase.ts), which would hide the probe/non-probe distinction this file checks.
  base.href = `${location.origin}/exported-game/`;
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
    { qaInstrumentation: false, probe: true, expectedBase: "/exported-game/" },
    { qaInstrumentation: true, probe: false, expectedBase: "/exported-game/" },
  ])("uses editor public assets only with both probe capabilities: $qaInstrumentation/$probe", async ({ qaInstrumentation, probe, expectedBase }) => {
    const project = createBlankProject();
    Reflect.set(window, "__OPENRPG_BOOT__", {
      qaInstrumentation,
      ...(probe ? { actionCombatProbe: { runId: "owned-run", mapId: project.startMapId } } : {}),
    });
    // A fresh Response per request: boot fetches loading.json, project.json and the first-screen files, and a
    // single shared Response has its body consumed by the first read.
    const body = serialize(project);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
    const ready = new Promise<void>(resolve => rendered.mockImplementation(() => resolve()));
    // Without qaInstrumentation the web build waits on the boot loader's 「시작하기」 gesture (bootLoader.waitForStart)
    // before rendering; press it like a player would, otherwise `ready` never resolves.
    const pressStart = setInterval(() => {
      const start = document.querySelector<HTMLElement>('[data-testid="boot-loader-start"]');
      if (start && start.style.display !== "none") start.click();
    }, 20);
    try {
      await import("@/player/exportEntry");
      await ready;
    } finally {
      clearInterval(pressStart);
    }
    const { withInlineAsset } = await import("@/assets/inlineAssetStore");
    expect(withInlineAsset("/assets/easyrpg-chipset-exterior.png"))
      .toBe(`${location.origin}${expectedBase}assets/easyrpg-chipset-exterior.png`);
    const options = rendered.mock.calls[0]?.[1];
    expect(Boolean(options.startOverride)).toBe(qaInstrumentation && probe);
  });
});
