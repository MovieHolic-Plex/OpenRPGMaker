/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { commandLabel, openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import type { Command } from "@/project/types";

describe("event command picker audio intent", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it.each([
    ["BGM 재생...", true],
    ["SE 재생...", false],
  ] as const)("preserves the channel selected by %s", (label, loop) => {
    let selected: Command | null = null;
    openEventCommandPicker({
      title: "이벤트 명령",
      context: "map",
      onSelect: (command) => {
        selected = command;
      },
    });

    const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".event-command-picker-command"))
      .find((candidate) => candidate.textContent?.includes(label));
    expect(button, `${label} command button`).toBeDefined();
    button?.click();

    expect(selected).toEqual({ kind: "playAudio", resourceId: "", loop });
  });

  it("uses a channel-neutral edit-dialog label", () => {
    expect(commandLabel("playAudio")).toBe("소리 재생");
  });
});
