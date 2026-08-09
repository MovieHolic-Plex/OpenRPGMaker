import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("Erase Event command body", () => {
  let restoreDom: (() => void) | undefined;
  let replaced: Command | undefined;

  const actions: CommandListActions = {
    addCommand: () => {},
    insertCommand: () => {},
    replaceCommand: (_path, command) => {
      replaced = command;
    },
    deleteCommand: () => {},
    moveCommand: () => {},
    moveCommandTo: () => {},
  };

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    replaced = undefined;
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("catalog entry has no fake map/x/y fields", () => {
    const entry = m2CommandById("m2-086-erase-event");
    expect(entry?.title).toBe("Erase Event");
    expect(entry?.fields ?? []).toEqual([]);
  });

  it("renders intent card and target picker without map/x/y", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        { kind: "m2Command", commandId: "m2-086-erase-event", fields: {} },
      )
    );
    expect(findByTestId(body, "m2-command-intent-card")).toBeTruthy();
    expect(body.textContent).toContain("플레이 중 이벤트 지우기");
    expect(body.textContent).toContain("에디터 맵에서 이벤트 오브젝트를 삭제하는 버튼이 아닙니다");
    expect(findByTestId(body, "m2-erase-event-target")).toBeTruthy();
    expect(findByTestId(body, "m2-erase-event-preview")).toBeTruthy();
    expect(body.textContent).not.toContain("맵 선택");
    expect(body.textContent).not.toMatch(/\bX\b.*0/);
  });

  it("writes eventId when target changes", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    const eventId = map.events[0]?.id ?? "ev_test";
    if (!map.events[0]) {
      map.events.push({
        id: eventId,
        x: 1,
        y: 2,
        trigger: { kind: "action" },
        commands: [],
      });
      store.replace(project);
    }

    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        { kind: "m2Command", commandId: "m2-086-erase-event", fields: {} },
      )
    );
    const select = findByTestId(body, "m2-erase-event-target") as FakeElement | null;
    expect(select).toBeTruthy();
    if (!select) return;
    select.value = eventId;
    select.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "m2Command",
      commandId: "m2-086-erase-event",
      fields: { eventId },
    });
  });
});
