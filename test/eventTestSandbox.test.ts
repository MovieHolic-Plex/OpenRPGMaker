import { beforeEach, describe, expect, it } from "vitest";
import {
  buildEventTestSandboxProject,
  prepareEventTest,
  selectEventTestSpawn,
} from "@/editor/eventTestSandbox";
import { createBlankProject } from "@/project/defaults";
import { beginEventEditDraft } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent } from "@/project/types";

function eventPage(id: string, commands: Command[] = []): EventPage {
  return {
    id: `${id}-page`,
    name: id,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

function gameEvent(id: string, x: number, y: number, commands: Command[] = []): GameEvent {
  const page = eventPage(id, commands);
  return {
    id,
    x,
    y,
    trigger: page.trigger,
    commands: [],
    pages: [page],
  };
}

beforeEach(() => {
  _resetEventDraftVaultForTest();
});

describe("selected event test sandbox", () => {
  it("injects only the selected working draft over a canonical project snapshot", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const selected = gameEvent("selected", 3, 3);
    const unrelated = gameEvent("unrelated", 6, 6);
    const newDraft = gameEvent("new-draft", 8, 8, [{ kind: "text", body: "new working" }]);
    project.maps[mapId].events = [selected, unrelated, newDraft];
    beginEventEditDraft(project, mapId, selected.id);
    beginEventEditDraft(project, mapId, unrelated.id);
    selected.pages![0]!.commands = [{ kind: "text", body: "selected working" }];
    unrelated.pages![0]!.commands = [{ kind: "text", body: "unrelated working" }];
    newDraft.draft = { kind: "new" };

    const sandbox = buildEventTestSandboxProject(project, mapId, selected.id);

    expect(sandbox?.maps[mapId].events.find((event) => event.id === selected.id)?.pages?.[0]?.commands)
      .toEqual([{ kind: "text", body: "selected working" }]);
    expect(sandbox?.maps[mapId].events.find((event) => event.id === unrelated.id)?.pages?.[0]?.commands)
      .toEqual([]);
    expect(sandbox?.maps[mapId].events.some((event) => event.id === newDraft.id)).toBe(false);
    expect(sandbox?.maps[mapId].events.every((event) => event.draft === undefined)).toBe(true);
    expect(project.maps[mapId].events.find((event) => event.id === selected.id)?.draft?.kind).toBe("edit");
  });

  it("keeps store mutations on canonical state while runtime readers see the sandbox", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const selected = gameEvent("selected", 3, 3, [{ kind: "text", body: "working" }]);
    selected.draft = { kind: "new" };
    project.maps[mapId].events = [selected];
    store.replaceProject(project);
    const preparation = prepareEventTest(store.getCurrent(), mapId, selected.id);
    if (!preparation) throw new Error("expected event test preparation");

    const release = store.beginReadOnlyProjectSnapshot(preparation.project);
    expect(store.getCurrent()).toEqual(preparation.project);
    store.update((canonical) => {
      canonical.meta.title = "canonical changed while sandbox open";
    });
    expect(store.getCurrent().meta.title).not.toBe("canonical changed while sandbox open");

    release();
    expect(store.getCurrent().meta.title).toBe("canonical changed while sandbox open");
    expect(store.getCurrent().maps[mapId].events[0]?.draft?.kind).toBe("new");
  });

  it("prefers passable unoccupied adjacent cells and uses a deterministic diagnosed fallback", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const selected = gameEvent("selected", 4, 4);
    map.events = [selected, gameEvent("down", 4, 5)];

    const adjacent = selectEventTestSpawn(project, map, selected);
    expect(adjacent).toMatchObject({ x: 3, y: 4, usedFallback: false });

    map.events.push(
      gameEvent("left", 3, 4),
      gameEvent("right", 5, 4),
      gameEvent("up", 4, 3),
    );
    const fallbackA = selectEventTestSpawn(project, map, selected);
    const fallbackB = selectEventTestSpawn(project, map, selected);

    expect(fallbackA).toMatchObject({ x: 3, y: 3, usedFallback: true });
    expect(fallbackA.diagnostic).toContain("이벤트 옆");
    expect(fallbackB).toEqual(fallbackA);
  });
});
