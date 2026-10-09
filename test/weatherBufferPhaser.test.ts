import { createRequire } from "node:module";
import { expect, it, vi } from "vitest";
import { installFakeDom } from "./fakeDom";
import { renderRainBuffer } from "@/player/weather/rainBuffer";
import { stormFlashOpacity } from "@/player/weather/weatherModel";
import { legacyPrecipitation } from "./fixtures/runtimeLag8Legacy";
const require = createRequire(import.meta.url);
it("matches installed Phaser Graphics methods (including flash) without renderer-specific shortcuts", () => {
  const restore = installFakeDom({ animationFrames: "manual" });
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  const probe = require.resolve("phaser/src/device/CanvasFeatures.js");
  const previous = require.cache[probe];
  require.cache[probe] = { exports: {} } as any;
  try {
    const Graphics = require("phaser/src/gameobjects/graphics/Graphics.js");
    const old = Object.create(Graphics.prototype), next = Object.create(Graphics.prototype);
    old.commandBuffer = []; next.commandBuffer = [];
    for (const kind of ["rain", "storm"] as const) for (const intensity of [0.1, 0.5, 1]) for (const time of [0, 120, 290, 4800]) {
      const params = { kind, intensity };
      old.commandBuffer.length = 0;
      legacyPrecipitation(old, params, 800, 450, time);
      const flash = stormFlashOpacity(params, time);
      if (flash > 0) { old.fillStyle(0xffffff, flash); old.fillRect(0, 0, 800, 450); }
      renderRainBuffer(next, params, 800, 450, time);
      expect(next.commandBuffer).toEqual(old.commandBuffer);
    }
  } finally {
    if (previous) require.cache[probe] = previous; else delete require.cache[probe];
    vi.unstubAllGlobals();
    restore();
  }
});
