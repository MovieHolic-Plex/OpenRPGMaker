import { describe, expect, it } from "vitest";
import {
  deriveRequiredStartBgm,
  assertRequiredBgmObserved,
  browserScreenshotNames,
  assertScreenshotOrder,
} from "../scripts/lib/horror-capture-rules.mjs";

/**
 * The break: `capture-horror-browser-evidence.mts` observes the title resource and the live
 * start map/position but never observes the map's custom BGM — so a project whose required
 * start-map BGM fails to resolve/load/play still satisfies QA. The gallery (start) map declares
 * `bgm.mode: "custom"`, so its BGM is a *required* resource: if it cannot resolve to a served
 * URL and reach the playback engine, the browser capture must fail.
 *
 * It also writes only one screenshot (`browser-title.png`) and labels it ambiguously; the contract
 * needs `browser-title.png` = title before play and `browser-play-start.png` = after play.
 *
 * This names both breaks: a broken required BGM must be rejected, and the two screenshots must
 * map to their exact lifecycle phases.
 */
describe("horror required-BGM observation & screenshot phasing", () => {
  const map: { bgm?: { mode?: string; resourceId?: string } } = {
    bgm: { mode: "custom", resourceId: "cc0-bgm-dungeon", fadeInMs: 800 },
  } as { bgm?: { mode?: string; resourceId?: string } };

  it("derives the required start-map BGM resource from the authored project", () => {
    const derived = deriveRequiredStartBgm({
      startMap: map,
      resolveUrl: (resourceId) => resourceId === "cc0-bgm-dungeon" ? "/assets/cc0/audio/bgm/cave-theme.ogg" : null,
    });
    expect(derived).toEqual({
      resourceId: "cc0-bgm-dungeon",
      url: "/assets/cc0/audio/bgm/cave-theme.ogg",
    });
  });

  it("REJECTS a required BGM that fails to resolve to a URL", () => {
    expect(() => {
      const derived = deriveRequiredStartBgm({
        startMap: map,
        resolveUrl: () => null,
      });
      assertRequiredBgmObserved(derived, { requestedUrls: [], played: [] });
    }).toThrow(/BGM|벡그라운드|해석|resolve/i);
  });

  it("REJECTS a required BGM that never reaches the playback engine", () => {
    const derived = deriveRequiredStartBgm({
      startMap: map,
      resolveUrl: (id) => `/assets/cc0/audio/bgm/${id}.ogg`,
    });
    expect(() =>
      assertRequiredBgmObserved(derived, { requestedUrls: [], played: [] }),
    ).toThrow(/BGM|재생|play|로드/i);
  });

  it("ACCEPTS a required BGM that resolves, is requested, and reaches playback", () => {
    const derived = deriveRequiredStartBgm({
      startMap: map,
      resolveUrl: (id) => `/assets/cc0/audio/bgm/${id}.ogg`,
    });
    expect(() =>
      assertRequiredBgmObserved(derived, {
        requestedUrls: [derived.url],
        played: [derived.resourceId],
      }),
    ).not.toThrow();
  });

  it("maps browser-title.png to before-play and browser-play-start.png to after-play", () => {
    expect(browserScreenshotNames()).toStrictEqual({
      title: "browser-title.png",
      playStart: "browser-play-start.png",
    });
  });

  it("REJECTS an ordering where titles are declared after the play-start capture", () => {
    expect(() => assertScreenshotOrder({ titleAtMs: 2000, playStartAtMs: 1000 }))
      .toThrow(/타이틀|title|순서|order|이후|before/i);
  });

  it("ACCEPTS title-before-play phasing", () => {
    expect(() => assertScreenshotOrder({ titleAtMs: 1000, playStartAtMs: 2000 })).not.toThrow();
  });
});
