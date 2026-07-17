/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import { getAudioEngine, playAudioCommand, stopAllAudio } from "@/player/audio";
import { resolveAudioSource } from "@/player/audio/audioResources";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

function projectPick() {
  return { assets: store.getCurrent().assets };
}

describe("CC0 / bundled audio playback path", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    stopAllAudio();
    document.querySelectorAll("[data-testid='audio-test-dialog']").forEach((node) => node.remove());
  });

  afterEach(() => {
    stopAllAudio();
    document.querySelectorAll("[data-testid='audio-test-dialog']").forEach((node) => node.remove());
    vi.restoreAllMocks();
  });

  it("resolves browser-playable wav files that exist on disk", () => {
    const cases = [
      ["easyrpg-sound-decision1", "public/assets/easyrpg/sound/Decision1.wav"],
      ["cc0-music-field-loop", "public/assets/cc0/audio/field-loop.wav"],
      ["cc0-sound-ui-confirm", "public/assets/cc0/audio/ui-confirm.wav"],
    ] as const;
    for (const [id, file] of cases) {
      const url = resolveAudioSource(id, projectPick());
      expect(url, id).toBeTruthy();
      expect(url!.startsWith("/assets/")).toBe(true);
      const bytes = readFileSync(resolve(process.cwd(), file));
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii")).toBe("WAVE");
    }
  });

  it("playAudioCommand routes SE/BGM to the audio engine with resolved urls", () => {
    const engine = getAudioEngine();
    const play = vi.spyOn(engine, "play").mockImplementation(() => undefined);
    engine.unlock();

    playAudioCommand({ resourceId: "easyrpg-sound-decision1", loop: false }, store.getCurrent());
    playAudioCommand({ resourceId: "cc0-music-field-loop", loop: true }, store.getCurrent());

    expect(play).toHaveBeenCalledWith(
      "se",
      "easyrpg-sound-decision1",
      "/assets/easyrpg/sound/Decision1.wav",
      false
    );
    expect(play).toHaveBeenCalledWith(
      "bgm",
      "cc0-music-field-loop",
      "/assets/cc0/audio/field-loop.wav",
      true
    );
  });

  it("audio test dialog play button uses CC0 field loop as first music track", () => {
    const engine = getAudioEngine();
    const play = vi.spyOn(engine, "play").mockImplementation(() => undefined);
    openAudioTestDialog();
    const dialog = document.querySelector('[data-testid="audio-test-dialog"]');
    expect(dialog).toBeTruthy();
    // index 1 = first real track after (꺼짐) — CC0 field loop is listed first
    (dialog!.querySelector('[data-testid="audio-test-option-1"]') as HTMLButtonElement).click();
    const playBtn = dialog!.querySelector('[data-testid="audio-test-play"]') as HTMLButtonElement;
    expect(playBtn).toBeTruthy();
    playBtn.click();
    expect(dialog!.querySelector('[data-testid="audio-test-status"]')?.textContent).toContain("재생 중");
    expect(play).toHaveBeenCalledWith(
      "bgm",
      "cc0-music-field-loop",
      "/assets/cc0/audio/field-loop.wav",
      true
    );
  });
});
