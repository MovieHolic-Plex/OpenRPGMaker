import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLightingBody } from "@/editor/panels/eventEditor/commandBodyPage3Native";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("lighting percent authoring", () => {
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); });
  afterEach(() => restore());
  it("converts percentages once and synchronizes slider, presets and preview", () => {
    const replaceCommand = vi.fn();
    const context: CommandEditContext = {
      path: [0], actions: { replaceCommand, addCommand: vi.fn(), insertCommand: vi.fn(),
        deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn() },
    };
    const body = renderWithFakeDom(() => setLightingBody(context, { kind: "setLighting", ambient: 0.35 }));
    const input = findByTestId(body, "set-lighting-ambient-input")!;
    const slider = findByTestId(body, "set-lighting-ambient-slider")!;
    const preview = () => findByTestId(body, "set-lighting-preview-stage")!;
    expect(input.value).toBe("35");
    expect(slider.value).toBe("35");
    expect(preview().children[0].style.opacity).toBe("0.35");
    input.value = "50";
    input.dispatchEvent(new Event("change"));
    expect(replaceCommand).toHaveBeenLastCalledWith([0], { kind: "setLighting", ambient: 0.5, color: "#000000" });
    expect(slider.value).toBe("50");
    expect(preview().children[0].style.opacity).toBe("0.5");
    slider.value = "75";
    slider.dispatchEvent(new Event("input"));
    expect(input.value).toBe("75");
    expect(preview().children[0].style.opacity).toBe("0.75");
    slider.dispatchEvent(new Event("change"));
    expect(replaceCommand.mock.calls.at(-1)?.[1].ambient).toBe(0.75);
    findByTestId(body, "set-lighting-preset-dusk")!.click();
    expect(input.value).toBe("35");
    expect(slider.value).toBe("35");
    expect(replaceCommand.mock.calls.at(-1)?.[1]).toMatchObject({ ambient: 0.35, transitionMs: 400 });
    expect(preview().children[0].style.opacity).toBe("0.35");
  });
});
