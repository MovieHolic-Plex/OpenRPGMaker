// @vitest-environment happy-dom
// 선택 질문은 틀 본문에만 있다. 그 틀을 aria-hidden 으로 가리면 목록은 질문 없이 단추만 읽힌다.
import { afterEach, describe, expect, it } from "vitest";
import { createDialogueUI } from "@/player/dialogue";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const session = { variables: {}, actorNames: {}, gold: 0 };

function choiceRequest(prompt?: string) {
  return {
    ...(prompt ? { prompt } : {}),
    options: [{ text: "숲" }, { text: "마을" }],
    playerTileY: 0,
    mapHeight: 20,
    textContext: { session, project: store.getCurrent() },
  };
}

describe("choice prompt accessibility", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("names the choice list with the question and announces that question", () => {
    store.replaceProject(createBlankProject());
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const pending = dialogue.showChoices(choiceRequest("어디로 갈까?"));
    void pending.catch(() => undefined);

    const frame = host.querySelector<HTMLElement>("[data-testid='dialogue-choice-frame']");
    expect(frame?.getAttribute("aria-hidden")).not.toBe("true");
    const promptId = frame?.dataset.choicePromptId;
    expect(promptId).toBeTruthy();
    const prompt = document.getElementById(promptId ?? "");
    expect(prompt?.textContent).toContain("어디로 갈까?");
    expect(frame?.contains(prompt ?? null)).toBe(true);

    const list = host.querySelector("[data-testid='runtime-choices']");
    expect(list?.getAttribute("role")).toBe("listbox");
    expect(list?.getAttribute("aria-labelledby")).toBe(promptId);
    expect(list?.hasAttribute("aria-label")).toBe(false);

    const announcement = host.querySelector("[data-testid='dialogue-choice-announcement']");
    expect(announcement?.getAttribute("role")).toBe("status");
    expect(announcement?.textContent).toBe("어디로 갈까?");

    dialogue.hide();
  });

  it("hides an empty choice frame and still names the list", () => {
    store.replaceProject(createBlankProject());
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const pending = dialogue.showChoices(choiceRequest());
    void pending.catch(() => undefined);

    const frame = host.querySelector<HTMLElement>("[data-testid='dialogue-choice-frame']");
    expect(frame?.getAttribute("aria-hidden")).toBe("true");
    expect(frame?.dataset.choicePromptId).toBeUndefined();
    expect(host.querySelector("[data-testid='runtime-choices']")?.getAttribute("aria-label")).toBe("선택");
    expect(host.querySelector("[data-testid='dialogue-choice-announcement']")).toBeNull();

    dialogue.hide();
  });

  it("moves the choice cursor with W and S as well as the arrow keys", () => {
    store.replaceProject(createBlankProject());
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const pending = dialogue.showChoices({
      options: [{ text: "숲" }, { text: "마을" }, { text: "성" }],
      playerTileY: 0,
      mapHeight: 20,
      textContext: { session, project: store.getCurrent() },
    });
    void pending.catch(() => undefined);

    const selected = (): string | null =>
      host.querySelector("[data-testid^='runtime-choice-'].selected")?.getAttribute("data-testid") ?? null;

    const press = (key: string): void => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    };

    expect(selected()).toBe("runtime-choice-0");
    press("s");
    expect(selected()).toBe("runtime-choice-1");
    press("ArrowDown");
    expect(selected()).toBe("runtime-choice-2");
    press("w");
    expect(selected()).toBe("runtime-choice-1");
    press("W");
    expect(selected()).toBe("runtime-choice-0");
    press("ArrowUp");
    expect(selected()).toBe("runtime-choice-2");
    press("a");
    press("ArrowRight");
    expect(selected()).toBe("runtime-choice-2");

    dialogue.hide();
  });
});
