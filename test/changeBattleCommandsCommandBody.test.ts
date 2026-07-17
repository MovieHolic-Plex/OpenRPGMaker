import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { startSession } from "@/project/session";
import { battleCommandsForActor } from "@/battle/battleCommands";

describe("Change Battle Commands modern form + runtime", () => {
  let restoreDom: (() => void) | undefined;
  let staged: Command;

  const actions: CommandListActions = {
    addCommand: () => undefined,
    insertCommand: () => undefined,
    deleteCommand: () => undefined,
    moveCommand: () => undefined,
    moveCommandTo: () => undefined,
    replaceCommand: (_path, command) => {
      staged = command;
    },
  };

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    store.replace(project);
    staged = {
      kind: "m2Command",
      commandId: "m2-092-change-battle-commands",
      fields: { target: "party", operation: "add", value: "" },
    };
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("전용 폼: 대상/조작/커맨드/메뉴 프리뷰", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    expect(findByTestId(body, "change-battle-commands-command-body")).toBeTruthy();
    expect(findByTestId(body, "change-battle-commands-target-mode")).toBeTruthy();
    expect(findByTestId(body, "change-battle-commands-operation")).toBeTruthy();
    expect(findByTestId(body, "change-battle-commands-command-select")).toBeTruthy();
    expect(findByTestId(body, "change-battle-commands-preview")).toBeTruthy();
  });

  it("조작/커맨드 저장", () => {
    const commandId = store.getCurrent().database.battleCommands?.[0]?.id
      ?? store.getCurrent().database.classes[0]?.battleCommands[0]?.id
      ?? "cmd_attack";
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const op = findByTestId(body, "change-battle-commands-operation") as unknown as HTMLSelectElement;
    op.value = "set";
    op.dispatchEvent(new Event("change"));
    const cmdSelect = findByTestId(body, "change-battle-commands-command-select") as unknown as HTMLSelectElement;
    cmdSelect.value = commandId;
    cmdSelect.dispatchEvent(new Event("change"));
    expect(staged.kind).toBe("m2Command");
    if (staged.kind !== "m2Command") return;
    expect(staged.fields.operation).toBe("set");
    expect(staged.fields.value).toBe(commandId);
  });

  it("런타임: 세션 오버라이드에 커맨드를 추가한다", () => {
    const project = store.getCurrent();
    const session = startSession(project);
    const actorId = session.partyActorIds[0] ?? project.database.actors[0]?.id ?? "actor_hero";
    const entry = m2CommandById("m2-092-change-battle-commands");
    expect(entry).toBeTruthy();
    if (!entry) return;
    executeM2RuntimeCommand(session, entry, {
      commandId: "m2-092-change-battle-commands",
      fields: { target: actorId, operation: "add", value: "cmd_item" },
    }, { project });
    expect(session.actorBattleCommands?.[actorId]).toContain("cmd_item");
    const menu = battleCommandsForActor(project, actorId, {
      overrideCommandIds: session.actorBattleCommands?.[actorId],
    });
    expect(menu.some((command) => command.id === "cmd_item" || command.kind === "item")).toBe(true);
  });
});
