/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { mountPlayLoadingOverlay } from "@/player/playLoadingOverlay";

describe("playLoadingOverlay", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("mounts staged loading UI with message and progress", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const loading = mountPlayLoadingOverlay(host, "saving");
    expect(host.querySelector("[data-testid='play-loading-overlay']")).toBeTruthy();
    expect(host.querySelector("[data-testid='play-loading-message']")?.textContent).toContain("저장");
    expect(loading.root.dataset.stage).toBe("saving");

    loading.setStage("assets");
    expect(loading.root.dataset.stage).toBe("assets");
    expect(host.querySelector("[data-testid='play-loading-message']")?.textContent).toContain("에셋");

    loading.setProgress(0.42);
    const bar = host.querySelector<HTMLElement>("[data-testid='play-loading-bar']");
    expect(bar?.classList.contains("is-indeterminate")).toBe(false);
    expect(bar?.dataset.progress).toBe("42");

    loading.setStage("ready");
    loading.remove();
    expect(host.querySelector("[data-testid='play-loading-overlay']")).toBeNull();
  });
});
