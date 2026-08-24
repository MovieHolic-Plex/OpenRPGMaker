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
    expect(body.querySelector('[data-testid="play-audio-resource-picker"]')?.textContent).toContain("효과음 라이브러리");
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
});
