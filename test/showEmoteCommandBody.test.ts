/** @vitest-environment happy-dom */
// 이모트 명령 편집 폼 — 그림으로 고르는 격자와 대상 전환이 실제 명령으로 커밋되는지.
import { beforeEach, describe, expect, it } from "vitest";
import { showEmoteBody } from "@/editor/panels/eventEditor/commandBodyPage3Native";
import { createBlankProject } from "@/project/defaults";
import { EMOTE_KINDS, EMOTE_MAX_DURATION_MS, emoteFrameIndex } from "@/project/emotes";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";

function harness(initial: Extract<Command, { kind: "showEmote" }>) {
  const replaced: Command[] = [];
  const context = {
    path: [0],
    lockKind: true,
    actions: {
      replaceCommand: (_path: readonly number[], command: Command) => replaced.push(command),
      addCommand: () => {},
      removeCommand: () => {},
      moveCommand: () => {},
    },
  } as unknown as CommandEditContext;
  const root = showEmoteBody(context, initial);
  document.body.replaceChildren(root);
  return { root, replaced };
}

const q = <T extends Element = HTMLElement>(root: ParentNode, testid: string): T | null =>
  root.querySelector<T>(`[data-testid="${testid}"]`);

describe("showEmote 편집 폼", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });

  it("12종 전부가 격자에 있고 각 칸이 자기 프레임을 보여준다", () => {
    const { root } = harness({ kind: "showEmote", target: { eventId: "" }, emote: "heart" });
    const grid = q(root, "show-emote-swatch-grid");
    expect(grid).not.toBeNull();
    expect(grid?.querySelectorAll("button")).toHaveLength(EMOTE_KINDS.length);

    for (const kind of EMOTE_KINDS) {
      const swatch = q<HTMLButtonElement>(root, `show-emote-swatch-${kind}`);
      expect(swatch, kind).not.toBeNull();
      const icon = swatch?.querySelector<HTMLElement>(".emote-swatch-icon");
      // CSSOM 이 값을 정규화한다: "-0px 0" → "0px 0px". 기하값 자체를 같은 형식으로 비교한다.
      expect(icon?.style.backgroundPosition).toBe(`${-(emoteFrameIndex(kind) * 16)}px 0px`);
    }
  });

  it("선택 상태가 aria-checked 로 노출되고 클릭하면 명령이 그 이모트로 커밋된다", () => {
    const { root, replaced } = harness({ kind: "showEmote", target: { eventId: "" }, emote: "heart" });
    expect(q(root, "show-emote-swatch-heart")?.getAttribute("aria-checked")).toBe("true");
    expect(q(root, "show-emote-swatch-music")?.getAttribute("aria-checked")).toBe("false");

    q<HTMLButtonElement>(root, "show-emote-swatch-music")?.click();

    expect(replaced.at(-1)).toMatchObject({ kind: "showEmote", emote: "music" });
    expect(q(root, "show-emote-swatch-music")?.getAttribute("aria-checked")).toBe("true");
    expect(q(root, "show-emote-swatch-heart")?.getAttribute("aria-checked")).toBe("false");
  });

  it("대상 전환: 주인공을 고르면 이벤트 칸이 숨고 target 이 player 로 커밋된다", () => {
    const { root, replaced } = harness({ kind: "showEmote", target: { eventId: "" }, emote: "heart" });
    const select = q<HTMLSelectElement>(root, "show-emote-target-kind-select");
    expect(select).not.toBeNull();
    expect((q(root, "show-emote-event-field") as HTMLElement).hidden).toBe(true);

    select!.value = "player";
    select!.dispatchEvent(new Event("change"));

    expect(replaced.at(-1)).toMatchObject({ target: "player" });
    expect((q(root, "show-emote-event-field") as HTMLElement).hidden).toBe(true);

    select!.value = "event";
    select!.dispatchEvent(new Event("change"));
    expect((q(root, "show-emote-event-field") as HTMLElement).hidden).toBe(false);
  });

  it("표시 시간은 상한으로 잘려서 커밋된다", () => {
    const { root, replaced } = harness({ kind: "showEmote", target: "player", emote: "heart" });
    const duration = q<HTMLInputElement>(root, "show-emote-duration-input");
    expect(duration).not.toBeNull();

    duration!.value = "999999";
    duration!.dispatchEvent(new Event("change"));

    expect(replaced.at(-1)).toMatchObject({ durationMs: EMOTE_MAX_DURATION_MS });
  });
});
