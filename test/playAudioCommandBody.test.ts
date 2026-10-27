/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SE_CATALOG } from "@/assets/seCatalog";
import { playAudioBodyForTest } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { getAudioEngine } from "@/player/audio";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";

describe("playAudio command body", () => {
  let host: HTMLElement;
  let replaced: Command | null;

  beforeEach(() => {
    store.replace(createBlankProject());
    replaced = null;
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
    vi.restoreAllMocks();
  });

  it("lists playable BGM/SE and previews selected audio", () => {
    const body = playAudioBodyForTest(
      {
        path: [0],
        actions: {
          addCommand: () => undefined,
          insertCommand: () => undefined,
          replaceCommand: (_path, command) => {
            replaced = command;
          },
          deleteCommand: () => undefined,
          moveCommand: () => undefined,
        },
      },
      { kind: "playAudio", resourceId: "", loop: true }
    );
    host.append(body);

    expect(body.dataset.testid).toBe("play-audio-command-body");
    const select = body.querySelector('[data-testid="play-audio-resource-select"]') as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(5);
    // first real option after (선택 없음) should be CC0 field loop for BGM
    const ids = Array.from(select.options).map((option) => option.value);
    expect(ids).toContain("cc0-music-field-loop");

    select.value = "cc0-music-field-loop";
    select.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "playAudio",
      resourceId: "cc0-music-field-loop",
      loop: true,
    });

    const engine = getAudioEngine();
    const play = vi.spyOn(engine, "play").mockImplementation(() => undefined);
    (body.querySelector('[data-testid="play-audio-preview"]') as HTMLButtonElement).click();
    expect(body.querySelector('[data-testid="play-audio-status"]')?.textContent).toContain("재생 중");
    expect(play).toHaveBeenCalledWith(
      "bgm",
      "cc0-music-field-loop",
      "/assets/cc0/audio/field-loop.wav",
      true
    );

    // switch to SE catalog
    (body.querySelector('[data-testid="play-audio-channel-se"]') as HTMLButtonElement).click();
    expect((body.querySelector('[data-testid="play-audio-search"]') as HTMLInputElement).placeholder).toContain("행동");
    expect(body.querySelector('[data-testid="play-audio-resource-picker"]')?.textContent).toContain("효과음 목록");
    const seSelect = body.querySelector('[data-testid="play-audio-resource-select"]') as HTMLSelectElement;
    const seIds = Array.from(seSelect.options).map((option) => option.value);
    expect(seIds.filter((id) => id.startsWith("cc0-se-"))).toHaveLength(SE_CATALOG.length);
    expect(seIds[1]).toBe(SE_CATALOG[0]?.id);
    expect(seIds).toContain("easyrpg-sound-decision1");
    expect(seIds).toContain("cc0-sound-ui-confirm");

    // Scene-language tags from the shared SE library must work in the inline event form.
    const seSearch = body.querySelector('[data-testid="play-audio-search"]') as HTMLInputElement;
    seSearch.value = "구매";
    seSearch.dispatchEvent(new Event("input"));
    expect(Array.from(seSelect.options).map((option) => option.value)).toContain("cc0-se-orp-inventory-coin");

    seSelect.value = "cc0-se-orp-inventory-coin";
    seSelect.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "playAudio",
      resourceId: "cc0-se-orp-inventory-coin",
      loop: false,
    });

    (body.querySelector('[data-testid="play-audio-preview"]') as HTMLButtonElement).click();
    expect(play).toHaveBeenLastCalledWith(
      "se",
      "cc0-se-orp-inventory-coin",
      "/assets/se/oga-rpg-pack/inventory/coin.wav",
      false
    );
  });

  it("shows authored loudness and keeps volume, fade, and BGS when the clip changes", () => {
    const body = playAudioBodyForTest(
      {
        path: [0],
        actions: {
          addCommand: () => undefined,
          insertCommand: () => undefined,
          replaceCommand: (_path, command) => {
            replaced = command;
          },
          deleteCommand: () => undefined,
          moveCommand: () => undefined,
        },
      },
      { kind: "playAudio", resourceId: "cc0-music-field-loop", loop: true, channel: "bgs", volume: 0.6, fadeInMs: 1500 }
    );
    host.append(body);

    const volume = body.querySelector('[data-testid="play-audio-volume"]') as HTMLInputElement;
    const fade = body.querySelector('[data-testid="play-audio-fade"]') as HTMLInputElement;
    expect(volume.value).toBe("60");
    expect(fade.value).toBe("1.5");
    expect(body.querySelector('[data-testid="play-audio-channel-note"]')?.textContent).toContain("환경음");

    const select = body.querySelector('[data-testid="play-audio-resource-select"]') as HTMLSelectElement;
    select.value = "cc0-bgm-town";
    select.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "playAudio",
      resourceId: "cc0-bgm-town",
      loop: true,
      channel: "bgs",
      volume: 0.6,
      fadeInMs: 1500,
    });

    volume.value = "40";
    volume.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({ volume: 40, channel: "bgs", fadeInMs: 1500 });

    fade.value = "0";
    fade.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({ volume: 40, fadeInMs: 0, channel: "bgs" });
  it("does not stop audio when a form that never previewed is removed", async () => {
    const body = mountedAudioBody(host);
    const stop = vi.spyOn(getAudioEngine(), "stopAll");
    host.remove();
    await flushMutations();
    expect(body.isConnected).toBe(false);
    expect(stop).not.toHaveBeenCalled();
  });

  it("stops a preview when the form leaves the document", async () => {
    const body = mountedAudioBody(host);
    const engine = getAudioEngine();
    const stop = vi.spyOn(engine, "stopAll");
    vi.spyOn(engine, "play").mockImplementation(() => undefined);
    (body.querySelector('[data-testid="play-audio-preview"]') as HTMLButtonElement).click();
    // The preview button fades whatever was already playing, then starts this form's track.
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(true);

    host.remove();
    await flushMutations();
    expect(stop).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenLastCalledWith(false);  });
});

function mountedAudioBody(parent: HTMLElement): HTMLElement {
  const body = playAudioBodyForTest(
    {
      path: [0],
      actions: {
        addCommand: () => undefined,
        insertCommand: () => undefined,
        replaceCommand: () => undefined,
        deleteCommand: () => undefined,
        moveCommand: () => undefined,
      },
    },
    { kind: "playAudio", resourceId: "cc0-music-field-loop", loop: true }
  );
  parent.append(body);
  return body;
}

function flushMutations(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
