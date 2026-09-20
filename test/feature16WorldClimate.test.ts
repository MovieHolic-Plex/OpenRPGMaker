import { describe, expect, it } from "vitest";
import { advanceWeatherTransition, parseWeather, resolveMapWeather } from "@/player/weather/weatherModel";

describe("feature16 map climate resolution", () => {
  it.each(["rain", "snow", "storm", "fog"])("suppresses %s indoors and restores the same global weather outside", (kind) => {
    const global = Object.freeze(parseWeather(`${kind},0.8`));
    expect(resolveMapWeather(global, { mode: "indoor" })).toEqual({ kind: "none", intensity: 0 });
    expect(resolveMapWeather(global)).toBe(global);
    expect(resolveMapWeather(global, { mode: "inherit" })).toBe(global);
    expect(resolveMapWeather(global, { mode: "fixed", weather: "snow", intensity: 0.2 })).toEqual({ kind: "snow", intensity: 0.2 });
    expect(global.kind).toBe(kind);
  });
  it("lets global transitions advance under the indoor override", () => {
    const transition = { from: parseWeather("rain,0.2"), to: parseWeather("snow,0.8"), elapsedMs: 0, durationMs: 1000 };
    const halfway = advanceWeatherTransition(transition, 500);
    expect(resolveMapWeather(halfway.params, { mode: "indoor" }).intensity).toBe(0);
    const final = advanceWeatherTransition(transition, 500);
    expect(resolveMapWeather(final.params)).toEqual(parseWeather("snow,0.8"));
    expect(final.done).toBe(true);
  });
});

// Exercise the real scene presentation boundary, not only the pure resolver.
import { syncWeatherLayer } from "@/player/playSceneWeather";
import type { PlaySceneContext } from "@/player/playSceneTypes";
it("actual layer hides immediately on entry and restores without touching session weather", () => {
  let visible = false;
  const graphics: object = new Proxy({}, { get: () => () => graphics });
  const scene = {
    map: { climate: { mode: "indoor" } }, session: { m2Runtime: { screen: { weather: "rain,0.8" } } },
    weatherLayer: { setVisible: (next: boolean) => { visible = next; } }, weatherGraphics: graphics,
    weatherClockMs: 0, weatherTransition: null,
    cameras: { main: { width: 320, height: 240 } },
  } as unknown as PlaySceneContext;
  syncWeatherLayer(scene); expect(visible).toBe(false);
  scene.map.climate = undefined;
  syncWeatherLayer(scene); expect(visible).toBe(true);
  expect(scene.session.m2Runtime?.screen.weather).toBe("rain,0.8");
});
