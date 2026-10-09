import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderEventEditorContent } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: () => void = () => undefined;

function emptyPage(): EventPage {
  return {
    id: "page-1",
    name: "회상",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
}

function gameEvent(page: EventPage): GameEvent {
  return { id: "event-1", x: 3, y: 3, trigger: page.trigger, commands: [], pages: [page] };
}

function renderEmptyEventEditor(): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId].events = [gameEvent(emptyPage())];
  store.replaceProject(project);
  editorState.set({ currentMapId: mapId, selectedEventId: "event-1", selectedEventPageId: "page-1" });
  const host = new FakeElement("div") as unknown as HTMLElement;
  document.body.append(host);
  renderEventEditorContent(host, mapId, "event-1");
  return mapId;
}

function activePage(mapId: string): EventPage {
  const pages = store.getCurrent().maps[mapId].events[0]?.pages ?? [];
  const page = pages.find((entry) => entry.id === "page-1");
  if (!page) throw new Error("page-1 사라짐");
  return page;
}

beforeEach(() => {
  vi.stubEnv("VITE_LEGACY_DB_URL", "http://dbserver:8100");
  vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "event-editor-memory-opening");
  _resetEventDraftVaultForTest();
  restoreDom = installFakeDom();
  store.replaceProject(createBlankProject());
});

afterEach(() => {
  _resetEventDraftVaultForTest();
  vi.unstubAllEnvs();
  restoreDom();
});

describe("empty-event 회상 오프닝 template", () => {
  it("Given an empty event page, When the 회상 오프닝 CTA is clicked, Then the page holds the memory_opening cutscene", () => {
    const mapId = renderEmptyEventEditor();
    const button = document.querySelector<HTMLElement>('[data-testid="event-template-memory-opening"]');
    expect(button).not.toBeNull();

    button?.click();

    const commands = activePage(mapId).commands;
    expect(commands.length).toBeGreaterThan(3);
    expect(commands.some((command) => command.kind === "text")).toBe(true);
    expect(commands.some((command) => command.kind === "wait" && command.ms >= 100)).toBe(true);
    expect(commands.some((command) => command.kind === "showPicture")).toBe(true);
    expect(commands.some((command) => command.kind === "playAudio")).toBe(true);
    // 프리셋이 만든 별도 「컷신」 페이지는 남기지 않는다 — 보고 있던 빈 페이지가 채워진다.
    expect(store.getCurrent().maps[mapId].events[0]?.pages?.length).toBe(1);
  });

  it("Given an empty event page, When the CTA is clicked, Then no command edit dialog blocks the author", () => {
    renderEmptyEventEditor();
    const button = document.querySelector<HTMLElement>('[data-testid="event-template-memory-opening"]');
    expect(button).not.toBeNull();
    button?.click();
    expect(document.querySelector('[data-testid="event-command-edit-dialog"]')).toBeNull();
  });
});
