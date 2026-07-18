import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
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
});
