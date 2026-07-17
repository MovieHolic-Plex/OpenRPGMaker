import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderCharactersTab } from "@/editor/panels/databaseCharacterView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const openEventEditorModal = vi.fn();
const selectEditorMap = vi.fn(() => true);

vi.mock("@/editor/panels/eventEditor/modal", () => ({
  openEventEditorModal: (...args: unknown[]) => openEventEditorModal(...args),
}));

vi.mock("@/editor/mapSelection", () => ({
  selectEditorMap: (...args: unknown[]) => selectEditorMap(...args),
}));

let previousWindow: typeof globalThis.window | undefined;

function stubWindowTimers(): void {
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
      clearTimeout,
    },
  });
}

function restoreWindow(): void {
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
}

function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    render(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

function seedProject(): void {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  const orphanEvent: GameEvent = {
    id: "ev_orphan",
    x: 2,
    y: 3,
    characterId: "char_orphan",
    pages: [{ id: "p1", name: "고아 NPC", conditions: [], commands: [] }],
  };
  map.events = [orphanEvent];
  project.characters = {
    char_profile: {
      displayName: "민수",
      birthday: { season: "summer", day: 14 },
      giftPrefs: { loved: [project.database.items[0]?.id ?? "item_potion"] },
      giftResponses: { loved: "고마워!" },
    },
  };
  store.replace(project);
}

describe("database character catalog", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    stubWindowTimers();
    openEventEditorModal.mockReset();
    selectEditorMap.mockReset();
    selectEditorMap.mockReturnValue(true);
    seedProject();
    resetMapEditHistory();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
    restoreWindow();
  });

  it("lists the union of profiles and event-used orphan characterIds", () => {
    const host = renderUtility(renderCharactersTab);
    expect(findByTestId(host, "db-character-row-char_profile")).toBeTruthy();
    expect(findByTestId(host, "db-character-row-char_orphan")).toBeTruthy();
    expect(findByTestId(host, "db-characters-list")).toBeTruthy();
  });

  it("creates a profile for an orphan characterId without clearing event refs", () => {
    const host = renderUtility(renderCharactersTab);
    findByTestId(host, "db-character-row-char_orphan")?.click();

    const nameInput = findByTestId(host, "db-character-orphan-display-name");
    if (!nameInput) throw new Error("missing orphan display name input");
    nameInput.value = "고아 프로필";
    nameInput.dispatchEvent(new Event("input"));
    findByTestId(host, "db-character-create-profile")?.click();

    const project = store.getCurrent();
    expect(project.characters?.char_orphan?.displayName).toBe("고아 프로필");
    expect(project.maps[project.startMapId].events[0]?.characterId).toBe("char_orphan");
    expect(findByTestId(host, "db-character-profile-fields")).toBeTruthy();
  });

  it("edits profile fields and deletes only the profile", () => {
    const host = renderUtility(renderCharactersTab);
    findByTestId(host, "db-character-row-char_profile")?.click();

    const nameInput = findByTestId(host, "db-character-display-name");
    if (!nameInput) throw new Error("missing display name");
    nameInput.value = "민수 개명";
    nameInput.dispatchEvent(new Event("input"));
    expect(store.getCurrent().characters?.char_profile?.displayName).toBe("민수 개명");

    // Attach the profile id to an event, then delete profile only.
    store.update((project) => {
      project.maps[project.startMapId].events.push({
        id: "ev_profile",
        x: 1,
        y: 1,
        characterId: "char_profile",
        pages: [{ id: "p1", name: "프로필 NPC", conditions: [], commands: [] }],
      });
    });

    const host2 = renderUtility(renderCharactersTab);
    findByTestId(host2, "db-character-row-char_profile")?.click();
    const deleteButton = findByTestId(host2, "db-character-delete");
    if (!deleteButton) throw new Error("missing delete");
    deleteButton.click();
    expect(deleteButton.textContent).toBe("정말 삭제?");
    deleteButton.click();

    const project = store.getCurrent();
    expect(project.characters?.char_profile).toBeUndefined();
    expect(project.maps[project.startMapId].events.some((event) => event.characterId === "char_profile")).toBe(true);
    expect(findByTestId(host2, "db-character-orphan-create")).toBeTruthy();
  });

  it("jumps to a using map event via selectEditorMap + openEventEditorModal", () => {
    const host = renderUtility(renderCharactersTab);
    findByTestId(host, "db-character-row-char_orphan")?.click();
    const mapId = store.getCurrent().startMapId;
    findByTestId(host, `db-character-jump-${mapId}-ev_orphan`)?.click();
    expect(selectEditorMap).toHaveBeenCalledWith(mapId, { clearEventSelection: false });
    expect(openEventEditorModal).toHaveBeenCalledWith(mapId, "ev_orphan");
  });

  it("adds a unique profile from the toolbar", () => {
    const host = renderUtility(renderCharactersTab);
    expect(getMapEditHistoryState().canUndo).toBe(false);
    findByTestId(host, "db-character-add")?.click();
    expect(getMapEditHistoryState().canUndo).toBe(true);
    const characters = store.getCurrent().characters ?? {};
    const ids = Object.keys(characters);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.some((id) => characters[id]?.displayName === "새 캐릭터")).toBe(true);
  });

  it("renders charset thumbs for used hosts and empty thumbs for unused/orphan-without-graphic", () => {
    store.update((project) => {
      const mapId = project.startMapId;
      project.maps[mapId].events = [
        {
          id: "ev_used",
          x: 1,
          y: 1,
          characterId: "char_used",
          pages: [
            {
              id: "p1",
              name: "사용",
              conditions: [],
              commands: [],
              graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } },
            },
          ],
        },
        {
          id: "ev_orphan",
          x: 2,
          y: 3,
          characterId: "char_orphan",
          pages: [{ id: "p1", name: "고아 NPC", conditions: [], commands: [] }],
        },
      ];
      project.characters = {
        char_profile: { displayName: "민수" },
        char_used: { displayName: "사용 캐릭터" },
      };
    });

    const host = renderUtility(renderCharactersTab);

    const usedRow = findByTestId(host, "db-character-row-char_used");
    const profileRow = findByTestId(host, "db-character-row-char_profile");
    const orphanRow = findByTestId(host, "db-character-row-char_orphan");
    if (!usedRow || !profileRow || !orphanRow) throw new Error("missing character rows");

    const usedThumb = usedRow.childNodes.find(
      (node) => node instanceof Object && "className" in node && String((node as FakeElement).className).includes("db-list-thumb")
    ) as FakeElement | undefined;
    const profileThumb = profileRow.childNodes.find(
      (node) => node instanceof Object && "className" in node && String((node as FakeElement).className).includes("db-list-thumb")
    ) as FakeElement | undefined;
    const orphanThumb = orphanRow.childNodes.find(
      (node) => node instanceof Object && "className" in node && String((node as FakeElement).className).includes("db-list-thumb")
    ) as FakeElement | undefined;

    expect(usedThumb?.className).toContain("db-list-thumb");
    expect(usedThumb?.className).toContain("db-list-thumb-crop");
    expect(usedThumb?.className).not.toContain("empty");
    expect(String(usedThumb?.style.backgroundImage ?? "")).toContain("charset");

    expect(profileThumb?.className).toContain("db-list-thumb");
    expect(profileThumb?.className).toContain("empty");

    expect(orphanThumb?.className).toContain("db-list-thumb");
    expect(orphanThumb?.className).toContain("empty");
  });
});