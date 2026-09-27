/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getCachedCharacterIdIndex,
  invalidateCharacterIdIndexCache,
  listCharacterIdIndex,
} from "@/project/characterIdIndex";
import { renderEventCharacterSocialExtras } from "@/editor/panels/eventEditor/pageProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";

function baseEvent(partial: Partial<GameEvent> = {}): GameEvent {
  return {
    id: "ev_host",
    x: 2,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    pages: [{ id: "p1", name: "page", conditions: [], commands: [], graphic: {}, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 } }],
    ...partial,
  };
}

function seedProject(options?: {
  readonly characters?: Record<string, { displayName?: string }>;
  readonly extraEvents?: readonly GameEvent[];
}): { mapId: string; event: GameEvent } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const event = baseEvent({ characterId: "alice" });
  project.maps[mapId] = {
    ...project.maps[mapId]!,
    events: [event, ...(options?.extraEvents ?? [])],
  };
  if (options?.characters) project.characters = options.characters;
  store.replace(project);
  return { mapId, event };
}

function focusCharacterIdInput(field: HTMLElement): HTMLInputElement {
  const input = field.querySelector<HTMLInputElement>('[data-testid="event-character-id-input"]')!;
  input.value = "";
  input.focus();
  return input;
}

describe("characterIdIndex cache", () => {
  afterEach(() => {
    invalidateCharacterIdIndexCache();
  });

  it("returns same array when project reference is unchanged", () => {
    const project = createBlankProject();
    project.characters = { alice: { displayName: "Alice" } };

    const first = getCachedCharacterIdIndex(project);
    const second = getCachedCharacterIdIndex(project);
    expect(second).toBe(first);
  });

  it("rebuilds when a different project reference is passed", () => {
    const projectA = createBlankProject();
    projectA.characters = { alice: { displayName: "Alice" } };

    const projectB = createBlankProject();
    projectB.characters = { bob: { displayName: "Bob" } };

    const first = getCachedCharacterIdIndex(projectA);
    expect(first.some((e) => e.characterId === "alice")).toBe(true);

    const second = getCachedCharacterIdIndex(projectB);
    expect(second).not.toBe(first);
    expect(second.some((e) => e.characterId === "bob")).toBe(true);
    expect(second.some((e) => e.characterId === "alice")).toBe(false);
  });

  it("produces same results as uncached listCharacterIdIndex", () => {
    const project = createBlankProject();
    project.characters = { alice: { displayName: "Alice" } };
    const mapId = project.startMapId;
    project.maps[mapId] = {
      ...project.maps[mapId]!,
      events: [baseEvent({ id: "ev_a", characterId: "alice" })],
    };

    invalidateCharacterIdIndexCache();
    const cached = getCachedCharacterIdIndex(project);
    const fresh = listCharacterIdIndex(project);
    expect(cached).toEqual(fresh);
  });

  it("invalidates after invalidateCharacterIdIndexCache", () => {
    const project = createBlankProject();
    project.characters = { alice: { displayName: "Alice" } };

    const first = getCachedCharacterIdIndex(project);
    invalidateCharacterIdIndexCache();
    const second = getCachedCharacterIdIndex(project);
    expect(second).not.toBe(first);
  });
});

describe("characterIdAutocomplete", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    document.body.replaceChildren();
    invalidateCharacterIdIndexCache();
  });

  it("renders dropdown with suggestions on focus", () => {
    const { mapId, event } = seedProject({
      characters: {
        alice: { displayName: "Alice" },
        bob: { displayName: "Bob" },
      },
      extraEvents: [baseEvent({ id: "ev_orphan", characterId: "char_orphan" })],
    });

    const field = renderEventCharacterSocialExtras(mapId, event)!;
    document.body.append(field);

    focusCharacterIdInput(field);

    const dropdown = document.querySelector<HTMLElement>('[data-testid="character-id-autocomplete"]')!;
    expect(dropdown.hidden).toBe(false);

    const rows = dropdown.querySelectorAll(".character-id-autocomplete-row");
    expect(rows.length).toBe(3);
    expect(dropdown.textContent).toContain("alice");
    expect(dropdown.textContent).toContain("Alice");
    expect(dropdown.textContent).toContain("char_orphan");
  });

  it("filters suggestions as user types", () => {
    const { mapId, event } = seedProject({
      characters: {
        alice: { displayName: "Alice" },
        bob: { displayName: "Bob" },
        charlie: { displayName: "Charlie" },
      },
    });

    const field = renderEventCharacterSocialExtras(mapId, event)!;
    document.body.append(field);

    const input = focusCharacterIdInput(field);
    input.value = "ali";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const dropdown = document.querySelector<HTMLElement>('[data-testid="character-id-autocomplete"]')!;
    const rows = dropdown.querySelectorAll(".character-id-autocomplete-row");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("alice");
    expect(rows[0].textContent).toContain("Alice");
  });

  it("shows no-results message when nothing matches", () => {
    const { mapId, event } = seedProject({
      characters: { alice: { displayName: "Alice" } },
    });

    const field = renderEventCharacterSocialExtras(mapId, event)!;
    document.body.append(field);

    const input = focusCharacterIdInput(field);
    input.value = "zzz_no_match";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const dropdown = document.querySelector<HTMLElement>('[data-testid="character-id-autocomplete"]')!;
    expect(dropdown.querySelector(".character-id-autocomplete-empty")).toBeTruthy();
  });

  it("fills input and fires change when a suggestion is clicked", () => {
    const { mapId, event } = seedProject({
      characters: { alice: { displayName: "Alice" } },
    });

    const field = renderEventCharacterSocialExtras(mapId, event)!;
    document.body.append(field);

    const input = focusCharacterIdInput(field);

    const row = document.querySelector<HTMLElement>('[data-testid="character-id-autocomplete-row-alice"]')!;
    row.click();

    expect(input.value).toBe("alice");
    const updated = store.getCurrent().maps[mapId]!.events.find((e) => e.id === event.id);
    expect(updated?.characterId).toBe("alice");
  });

  it("closes on Escape key", () => {
    const { mapId, event } = seedProject({
      characters: { alice: { displayName: "Alice" } },
    });

    const field = renderEventCharacterSocialExtras(mapId, event)!;
    document.body.append(field);

    const input = focusCharacterIdInput(field);

    const dropdown = document.querySelector<HTMLElement>('[data-testid="character-id-autocomplete"]')!;
    expect(dropdown.hidden).toBe(false);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(dropdown.hidden).toBe(true);
  });

  it("navigates with arrow keys and selects on Enter", () => {
    const { mapId, event } = seedProject({
      characters: {
        alice: { displayName: "Alice" },
        bob: { displayName: "Bob" },
      },
    });

    const field = renderEventCharacterSocialExtras(mapId, event)!;
    document.body.append(field);

    const input = focusCharacterIdInput(field);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

    const dropdown = document.querySelector<HTMLElement>('[data-testid="character-id-autocomplete"]')!;
    const highlighted = dropdown.querySelector(".character-id-autocomplete-row.highlighted");
    expect(highlighted).toBeTruthy();

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(input.value.length).toBeGreaterThan(0);
    const updated = store.getCurrent().maps[mapId]!.events.find((e) => e.id === event.id);
    expect(updated?.characterId).toBeTruthy();
  });

  it("destroy removes dropdown and listeners", () => {
    const { mapId, event } = seedProject({
      characters: { alice: { displayName: "Alice" } },
    });

    const field = renderEventCharacterSocialExtras(mapId, event)!;
    document.body.append(field);

    focusCharacterIdInput(field);
    expect(document.querySelector('[data-testid="character-id-autocomplete"]')).toBeTruthy();

    field.remove();
    const dropdownInBody = document.body.querySelector('[data-testid="character-id-autocomplete"]');
    expect(dropdownInBody).toBeNull();
  });
});
