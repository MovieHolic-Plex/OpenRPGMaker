import { describe, expect, it } from "vitest";
import { normalizeScenario, renderSummary } from "../scripts/lib/runtimeQa.mjs";

describe("runtime audio QA contract", () => {
  it("accepts an audio action when a scenario requests real playback evidence", () => {
    // Given
    const op = {
      kind: "audioAction", action: "start", resourceId: "fixture-bgm",
      sourcePath: "/fixture.mp3", loop: true, timeoutMs: 1000,
    } as const;
    // When
    const scenario = normalizeScenario({ id: "audio", beats: [{ id: "start", ops: [op] }] });
    // Then
    expect(scenario.beats[0]?.ops).toEqual([op]);
  });

  it("ships machine-readable evidence when rendering the summary", () => {
    // Given
    const audio = [{
      action: "start",
      resourceId: "fixture-bgm",
      sourcePath: "/fixture.mp3",
      loop: true,
      error: null,
      playing: {
        trusted: true, sourcePath: "/fixture.mp3", paused: false,
        ended: false, readyState: 4, currentTime: 0, loop: true,
        volume: 0, muted: false, playbackRate: 1,
      },
      snapshot: {
        volume: { bgm: 0.7, se: 0.8 }, playbackRate: 1, pan: 0, fadeInMs: 600,
      },
    }] as const;
    const actions = [{
      kind: "audioAction", action: "start", resourceId: "fixture-bgm",
      sourcePath: "/fixture.mp3", loop: true,
    }] as const;
    const report = {
      scenarioId: "audio", projectPath: "fixture.json", seed: 1,
      viewport: { width: 1024, height: 768 }, errors: [],
      beats: [{
        index: 0, id: "start", shot: "01-start.png",
        failures: [], state: null, actions, audio,
      }],
    };
    // When
    const summary = renderSummary(report);
    const block = /```json\n([\s\S]*?)\n```/.exec(summary)?.[1];
    // Then: parse the machine-readable payload; do not pin report prose.
    expect(block).toBeDefined();
    if (block === undefined) throw new TypeError("Missing audio evidence JSON");
    expect(JSON.parse(block)).toEqual([{
      id: "start", actions, state: null, audio,
    }]);
  });
});
