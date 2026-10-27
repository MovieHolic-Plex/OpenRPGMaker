import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const noopActions = {
  addCommand: () => undefined,
  deleteCommand: () => undefined,
  insertCommand: () => undefined,
  moveCommand: () => undefined,
  moveCommandTo: () => undefined,
  replaceCommand: () => undefined,
};

describe("transfer command body", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId });
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("embeds the map picker inline without a nested 장소 이동... button", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [], actions: noopActions },
        { kind: "transfer", mapId: "", x: 0, y: 0, direction: "retain", fade: "black" } satisfies Command
      )
    );

    expect(findByTestId(body, "event-transfer-player-dialog")).not.toBeNull();
    expect(findByTestId(body, "transfer-player-map-tree")).not.toBeNull();
    expect(findByTestId(body, "transfer-player-map-preview")).not.toBeNull();
    expect(findByTestId(body, "transfer-player-open")).not.toBeNull();
    // No second nested "open picker" button with the same label friction.
    expect(body.textContent ?? "").not.toContain("장소 이동...");
    expect(findByTestId(body, "transfer-player-ok")?.textContent).toContain("선택 완료");
  });

  it("names a non-default fade and door in the command list, and hides the defaults", () => {
    const mapId = store.getCurrent().startMapId;
    const summary = commandSummary({
      kind: "transfer",
      mapId,
      x: 7,
      y: 10,
      direction: "down",
      fade: "white",
      door: true,
    });
    expect(summary).toContain("(7,10)");
    expect(summary).toContain("아래");
    expect(summary).toContain("페이드 흰색");
    expect(summary).toContain("문 열림");

    const defaults = commandSummary({
      kind: "transfer",
      mapId,
      x: 1,
      y: 1,
      direction: "retain",
      fade: "black",
    });
    expect(defaults).not.toContain("페이드");
    expect(defaults).not.toContain("문 열림");
    expect(defaults).not.toContain("문 연출");
    expect(commandSummary({ kind: "transfer", mapId, x: 1, y: 1, door: false })).toContain("문 연출 없음");
  });

  it("keeps the chosen direction and fade when the door setting changes", () => {
    const mapId = store.getCurrent().startMapId;
    let current: Command = { kind: "transfer", mapId, x: 2, y: 3, direction: "retain", fade: "black" };
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        {
          path: [],
          actions: {
            ...noopActions,
            replaceCommand: (_path, command) => { current = command; },
          },
          getCurrentCommand: () => current,
        },
        current,
      ),
    );

    const direction = findByTestId(body, "transfer-player-direction-right") as HTMLInputElement | null;
    expect(direction).not.toBeNull();
    direction!.checked = true;
    direction!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(current).toMatchObject({ x: 2, y: 3, direction: "right", fade: "black" });
    expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain("오른쪽");

    const fade = findByTestId(body, "transfer-player-fade-none") as HTMLInputElement | null;
    expect(fade).not.toBeNull();
    fade!.checked = true;
    fade!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(current).toMatchObject({ direction: "right", fade: "none" });
    expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain("페이드: 없음");

    const door = findByTestId(body, "transfer-door-mode") as HTMLSelectElement | null;
    expect(door).not.toBeNull();
    door!.value = "on";
    door!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(current).toMatchObject({ mapId, x: 2, y: 3, direction: "right", fade: "none", door: true });
    expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain("문 열림");
  });
});
