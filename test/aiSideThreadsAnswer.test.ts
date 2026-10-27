// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createSideThreads } from "@/editor/panels/aiSideThreads";

describe("J72 side-thread tray opens when a run waits for an answer", () => {
  it("opens and marks attention when a decision prompt with live buttons arrives", async () => {
    const tray = createSideThreads();
    document.body.append(tray.root);
    const card = document.createElement("div");
    card.className = "ai-map-run-card";
    card.dataset.state = "running";
    tray.adopt(card);
    expect(tray.root.dataset.open).toBe("false");
    const prompt = document.createElement("div");
    prompt.dataset.testid = "ai-decision-prompt";
    prompt.append(document.createElement("button"));
    card.append(prompt);
    await new Promise((r) => setTimeout(r, 0));
    expect(tray.root.dataset.open).toBe("true");
    expect(tray.root.dataset.attention).toBe("answer");
    tray.dispose();
  });
});
