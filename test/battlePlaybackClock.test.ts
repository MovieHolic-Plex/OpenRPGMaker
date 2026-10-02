/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BattlePlaybackClock } from "@/player/battlePlaybackClock";
import { clearBattleTimerScope, openBattleTimerScope } from "@/player/battleTimerScope";

describe("battle presentation clock", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }); openBattleTimerScope(); });
  afterEach(() => { clearBattleTimerScope(); vi.useRealTimers(); });

  it("holds a remaining interval across repeated pause/resume and delivers once", () => {
    const clock = new BattlePlaybackClock(), cue = vi.fn();
    clock.schedule(cue, 100);
    vi.advanceTimersByTime(40);
    clock.pause(); clock.pause();
    vi.advanceTimersByTime(500);
    expect(cue).not.toHaveBeenCalled();
    clock.resume(); clock.resume();
    vi.advanceTimersByTime(59);
    expect(cue).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cue).toHaveBeenCalledTimes(1);
    clock.dispose();
  });

  it("queues cues created during a hold and preserves their order", () => {
    const clock = new BattlePlaybackClock(), calls: string[] = [];
    clock.pause();
    clock.schedule(() => calls.push("contact"), 0);
    clock.schedule(() => calls.push("recovery"), 30);
    vi.advanceTimersByTime(300);
    expect(calls).toEqual([]);
    clock.resume(); vi.advanceTimersByTime(30);
    expect(calls).toEqual(["contact", "recovery"]);
    clock.dispose();
  });

  it("dispatches the contact cue within one frame before freezing later cues", () => {
    const clock = new BattlePlaybackClock(), calls: string[] = [];
    clock.schedule(() => calls.push("impact sound"), 100);
    clock.schedule(() => calls.push("tail"), 180);
    vi.advanceTimersByTime(90); clock.pause(16);
    expect(calls).toEqual(["impact sound"]);
    vi.advanceTimersByTime(500);
    expect(calls).toEqual(["impact sound"]);
    clock.resume(); vi.advanceTimersByTime(90);
    expect(calls).toEqual(["impact sound", "tail"]);
    clock.dispose();
  });

  it("never resumes disposed playback or fires its pending removal/sound callbacks", () => {
    const clock = new BattlePlaybackClock(), cue = vi.fn();
    clock.schedule(cue, 40); clock.pause(); clock.dispose(); clock.resume();
    clock.schedule(cue, 0); vi.advanceTimersByTime(1_000);
    expect(cue).not.toHaveBeenCalled();
  });

  it("scene teardown also cancels playback that is not paused", () => {
    const clock = new BattlePlaybackClock(), cue = vi.fn();
    clock.schedule(cue, 20); clearBattleTimerScope(); vi.advanceTimersByTime(100);
    expect(cue).not.toHaveBeenCalled();
    clock.dispose();
  });
});
