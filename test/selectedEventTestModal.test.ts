import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const playerMocks = vi.hoisted(() => ({
  renderPlayer: vi.fn(),
  teardownPlayer: vi.fn(),
}));

vi.mock("@/player/player", () => playerMocks);
vi.mock("@/assets/bundledAssetWarmup", () => ({ warmBundledPlayAssets: vi.fn() }));
vi.mock("@/player/playLoadingOverlay", () => ({
  mountPlayLoadingOverlay: (host: HTMLElement) => {
    const root = document.createElement("div");
    host.append(root);
    return { root, remove: () => root.remove(), setStage: vi.fn() };
  },
}));
vi.mock("@/player/runtimeDebugPanel", () => ({
  renderRuntimeDebugPanel: () => document.createElement("div"),
}));

import { beginEventEditDraft } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { closeTestPlayModal, openSelectedEventTestModal, openTestPlayModal } from "@/editor/panels/testPlayModal";
import { AUTHORING_TEST_BOOT_SUCCESS_EVENT } from "@/editor/authoringJourney";
import { installFakeDom } from "./fakeDom";

let restoreDom: () => void = () => undefined;
let previousWindow: PropertyDescriptor | undefined;

function eventPage(body: string): EventPage {
  return {
    id: "page-selected",
    name: "선택 이벤트",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body }],
  };
}

function selectedEvent(body: string): GameEvent {
  const page = eventPage(body);
  return {
    id: "event-selected",
    x: 3,
    y: 3,
    trigger: page.trigger,
    commands: [],
    pages: [page],
  };
}

beforeEach(() => {
  _resetEventDraftVaultForTest();
  restoreDom = installFakeDom();
  previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
      dispatchEvent: vi.fn(() => true),
    },
  });
  playerMocks.renderPlayer.mockClear();
  playerMocks.teardownPlayer.mockClear();
});

afterEach(() => {
  closeTestPlayModal();
  vi.restoreAllMocks();
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
  _resetEventDraftVaultForTest();
  restoreDom();
});

describe("selected event test modal", () => {
  it("boots the actual selected-event player route without flushing or persisting the draft", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = selectedEvent("canonical");
    project.maps[mapId].events = [event];
    beginEventEditDraft(project, mapId, event.id);
    event.pages![0]!.commands = [{ kind: "text", body: "working draft" }];
    store.replaceProject(project);
    const flushSpy = vi.spyOn(store, "flush");
    // A background editor tab can throttle rAF completely. The test action must
    // still advance from its preparation overlay via the timer fallback.
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: () => 1,
    });

    const opened = await openSelectedEventTestModal(mapId, event.id);

    expect(opened).toBe(true);
    expect(flushSpy).not.toHaveBeenCalled();
    expect(playerMocks.renderPlayer).toHaveBeenCalledTimes(1);
    const [, options] = playerMocks.renderPlayer.mock.calls[0] as [HTMLElement, {
      initialEventTestId: string;
      initialSession: { currentMapId: string; x: number; y: number };
    }];
    expect(options.initialEventTestId).toBe(event.id);
    expect(options.initialSession.currentMapId).toBe(mapId);
    expect(store.getCurrent().maps[mapId].events[0]?.pages?.[0]?.commands)
      .toEqual([{ kind: "text", body: "working draft" }]);
    expect(store.getCurrent().maps[mapId].events[0]?.draft).toBeUndefined();

    closeTestPlayModal();

    expect(playerMocks.teardownPlayer).toHaveBeenCalled();
    expect(store.getCurrent().maps[mapId].events[0]?.draft?.kind).toBe("edit");
    expect(store.getCurrent().maps[mapId].events[0]?.pages?.[0]?.commands)
      .toEqual([{ kind: "text", body: "working draft" }]);
    expect(flushSpy).not.toHaveBeenCalled();
  });

  it("does not record journey test completion when player boot throws", async () => {
    store.replaceProject(createBlankProject());
    vi.spyOn(store, "flush").mockResolvedValue({ kind: "not-configured" });
    playerMocks.renderPlayer.mockImplementationOnce(() => { throw new Error("boot failed"); });

    await openTestPlayModal();

    const dispatchedTypes = vi.mocked(window.dispatchEvent).mock.calls.map(([event]) => event.type);
    expect(dispatchedTypes).not.toContain(AUTHORING_TEST_BOOT_SUCCESS_EVENT);
  });
});


describe("ordinary test play canonical snapshot", () => {
  it("runs canonical events while preserving working and new drafts in the editor", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = selectedEvent("canonical");
    const newDraft = selectedEvent("new draft");
    newDraft.id = "event-new-draft";
    newDraft.draft = { kind: "new" };
    project.maps[mapId].events = [event, newDraft];
    beginEventEditDraft(project, mapId, event.id);
    event.pages![0]!.commands = [{ kind: "text", body: "working draft" }];
    store.replaceProject(project);
    const flushSpy = vi.spyOn(store, "flush").mockResolvedValue({ kind: "not-configured" });

    await openTestPlayModal();

    expect(flushSpy).toHaveBeenCalledTimes(1);
    expect(playerMocks.renderPlayer).toHaveBeenCalledTimes(1);
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: AUTHORING_TEST_BOOT_SUCCESS_EVENT }));
    const runtimeEvents = store.getCurrent().maps[mapId].events;
    expect(runtimeEvents.find((entry) => entry.id === event.id)?.pages?.[0]?.commands)
      .toEqual([{ kind: "text", body: "canonical" }]);
    expect(runtimeEvents.some((entry) => entry.id === newDraft.id)).toBe(false);
    expect(runtimeEvents.every((entry) => entry.draft === undefined)).toBe(true);

    closeTestPlayModal();

    const editorEvents = store.getCurrent().maps[mapId].events;
    expect(editorEvents.find((entry) => entry.id === event.id)?.pages?.[0]?.commands)
      .toEqual([{ kind: "text", body: "working draft" }]);
    expect(editorEvents.find((entry) => entry.id === event.id)?.draft?.kind).toBe("edit");
    expect(editorEvents.find((entry) => entry.id === newDraft.id)?.draft?.kind).toBe("new");
  });
});
