/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openCharacterIdPicker } from "@/editor/panels/eventEditor/characterIdPickerDialog";
import { renderEventCharacterIdField } from "@/editor/panels/eventEditor/pageProps";
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
  readonly characterId?: string;
  readonly characters?: Record<string, { displayName?: string }>;
  readonly extraEvents?: readonly GameEvent[];
}): { mapId: string; event: GameEvent } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const event = baseEvent(options?.characterId ? { characterId: options.characterId } : {});
  project.maps[mapId] = {
    ...project.maps[mapId]!,
    events: [event, ...(options?.extraEvents ?? [])],
  };
  if (options?.characters) project.characters = options.characters;
  store.replace(project);
  return { mapId, event };
}

function dialogRoot(): HTMLElement {
  const root = document.querySelector('[data-testid="event-character-id-picker"]');
  if (!(root instanceof HTMLElement)) throw new Error("character id picker dialog missing");
  return root;
}

describe("characterId picker dialog", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  // 2026-08-19 초보 친화 스펙(eventEditorHostileUx): 연결 전에는 빈 입력칸 대신
  // "NPC/호감 연결" 행동 버튼 하나만 노출하고, 연결된 뒤에 자유 입력+피커를 보여준다.
  it("shows a connect action until linked, then the free-text field with picker", () => {
    const { mapId, event } = seedProject();
    const unlinked = renderEventCharacterIdField(mapId, event);
    document.body.append(unlinked);
    expect(unlinked.querySelector('[data-testid="event-character-id-connect"]')).toBeTruthy();
    expect(unlinked.querySelector('[data-testid="event-character-id-input"]')).toBeNull();
    unlinked.remove();

    const linked = renderEventCharacterIdField(mapId, { ...event, characterId: "char_linked" });
    document.body.append(linked);
    expect(linked.querySelector('[data-testid="event-character-id-input"]')).toBeTruthy();
    expect(linked.querySelector('[data-testid="event-character-id-picker-open"]')).toBeTruthy();
    expect(linked.querySelector('[data-testid="event-character-id-connect"]')).toBeNull();
    expect((linked.querySelector('[data-testid="event-character-id-input"]') as HTMLInputElement).placeholder).toContain(
      "일회용",
    );
  });

  it("opens dedicated dialog with union list, displayName, and usage counts", () => {
    const { mapId, event } = seedProject({
      characterId: "char_used",
      characters: {
        char_used: { displayName: "마을 촌장" },
        char_profile_only: { displayName: "미사용" },
      },
      extraEvents: [baseEvent({ id: "ev_orphan", characterId: "char_orphan" })],
    });

    openCharacterIdPicker({ mapId, eventId: event.id, currentId: event.characterId });
    const root = dialogRoot();

    expect(root.querySelector('[data-testid="event-character-id-picker-search"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="event-character-id-picker-list"]')).toBeTruthy();
    expect(root.textContent).toContain("char_used");
    expect(root.textContent).toContain("마을 촌장");
    expect(root.textContent).toContain("char_profile_only");
    expect(root.textContent).toContain("char_orphan");
    expect(root.textContent).toMatch(/사용\s*1/);
  });

  it("select attaches existing characterId without creating extra profiles", () => {
    const { mapId, event } = seedProject({
      characters: { char_existing: { displayName: "Existing" } },
    });

    openCharacterIdPicker({ mapId, eventId: event.id });
    const root = dialogRoot();
    const row = root.querySelector('[data-testid="event-character-id-picker-row-char_existing"]');
    expect(row).toBeTruthy();
    (row as HTMLButtonElement).click();
    (root.querySelector('[data-testid="event-character-id-picker-ok"]') as HTMLButtonElement).click();

    const updated = store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === event.id);
    expect(updated?.characterId).toBe("char_existing");
    expect(Object.keys(store.getCurrent().characters ?? {})).toEqual(["char_existing"]);
    expect(document.querySelector('[data-testid="event-character-id-picker"]')).toBeNull();
  });

  it("create registers profile + attaches, and rejects duplicates", () => {
    const { mapId, event } = seedProject({
      characters: { char_taken: { displayName: "Taken" } },
    });

    openCharacterIdPicker({ mapId, eventId: event.id });
    let root = dialogRoot();
    (root.querySelector('[data-testid="event-character-id-picker-create-toggle"]') as HTMLButtonElement).click();

    const idInput = root.querySelector('[data-testid="event-character-id-picker-create-id"]') as HTMLInputElement;
    const nameInput = root.querySelector('[data-testid="event-character-id-picker-create-name"]') as HTMLInputElement;
    idInput.value = "char_taken";
    idInput.dispatchEvent(new Event("input", { bubbles: true }));
    nameInput.value = "Duplicate";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    (root.querySelector('[data-testid="event-character-id-picker-ok"]') as HTMLButtonElement).click();

    expect(store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === event.id)?.characterId).toBeUndefined();
    expect(document.querySelector('[data-testid="event-character-id-picker"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="event-character-id-picker-create-error"]')?.textContent).toContain("이미 사용");

    idInput.value = "char_new";
    idInput.dispatchEvent(new Event("input", { bubbles: true }));
    nameInput.value = "새 주민";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    (root.querySelector('[data-testid="event-character-id-picker-ok"]') as HTMLButtonElement).click();

    const project = store.getCurrent();
    expect(project.maps[mapId]!.events.find((entry) => entry.id === event.id)?.characterId).toBe("char_new");
    expect(project.characters?.char_new).toEqual({ displayName: "새 주민" });
    expect(document.querySelector('[data-testid="event-character-id-picker"]')).toBeNull();
  });

  it("free-type unknown id attaches without auto profile create", () => {
    // 자유 입력은 연결된 상태의 필드에서만 가능(연결 전에는 connect 버튼뿐).
    const { mapId, event } = seedProject({ characterId: "char_seed" });
    const field = renderEventCharacterIdField(mapId, event);
    document.body.append(field);
    const input = field.querySelector('[data-testid="event-character-id-input"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = "char_orphan_free";
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const project = store.getCurrent();
    expect(project.maps[mapId]!.events.find((entry) => entry.id === event.id)?.characterId).toBe("char_orphan_free");
    expect(project.characters?.["char_orphan_free"]).toBeUndefined();
  });
});
