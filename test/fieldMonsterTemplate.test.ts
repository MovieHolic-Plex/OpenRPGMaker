/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveEventDraft } from "@/editor/eventDraftActions";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { editorState } from "@/editor/editorState";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { openFieldMonsterTemplateDialog } from "@/editor/panels/eventEditor/fieldMonsterTemplateDialog";
import {
  buildFieldMonsterFightCommands,
  hasFieldMonsterVictoryErasePattern,
} from "@/project/fieldMonsterTemplate";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";

function basePage(overrides: Partial<EventPage> = {}): EventPage {
  return {
    id: "p1",
    name: "빈 이벤트",
    conditions: [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" } },
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
    ...overrides,
  };
}

function baseEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id: "ev_field_mob",
    x: 4,
    y: 5,
    trigger: { kind: "action" },
    commands: [],
    pages: [basePage()],
    ...overrides,
  };
}

describe("field monster template", () => {
  let host: HTMLElement;

  beforeEach(() => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId]!.events = [baseEvent()];
    if (project.database.troops.length === 0) {
      project.database.troops.push({
        id: "troop_test",
        name: "시험 무리",
        enemyIds: [],
        members: [],
        battleEventPages: [],
      });
    }
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    _resetEventDraftVaultForTest();
    host.remove();
    document.querySelectorAll('[data-testid="field-monster-template-dialog"]').forEach((node) => node.remove());
  });

  it("builds victory-only erase fight commands", () => {
    const commands = buildFieldMonsterFightCommands({
      troopId: "troop_test",
      clearSwitchId: "sw_clear",
      intro: ["싸운다!"],
      victory: ["이겼다!"],
      victoryItems: [{ itemId: "it_potion", amount: 1 }],
    });
    expect(hasFieldMonsterVictoryErasePattern(commands)).toBe(true);
    expect(commands[0]).toMatchObject({ kind: "text", body: "싸운다!" });
    expect(commands[1]).toMatchObject({ kind: "battleProcessing", troopId: "troop_test" });
    expect(commands[2]).toMatchObject({
      kind: "fork",
      condition: { kind: "battleResult", result: "victory" },
    });
    const then = commands[2]!.kind === "fork" ? commands[2].then : [];
    expect(then.some((c) => c.kind === "setSwitch" && c.switchId === "sw_clear")).toBe(true);
    expect(then.some((c) => c.kind === "m2Command" && c.commandId === "m2-086-erase-event")).toBe(true);
    expect(then.some((c) => c.kind === "changeItem" && c.itemId === "it_potion")).toBe(true);
  });

  it("shows toolbar button and applies two-page template from dialog", () => {
    const mapId = store.getCurrent().startMapId;
    renderEventEditorDynamic(host, mapId, "ev_field_mob");
    const button = host.querySelector('[data-testid="event-command-toolbar-field-monster"]');
    expect(button).toBeTruthy();
    expect(button?.getAttribute("title")).toContain("필드 몬스터");

    const page = store.getCurrent().maps[mapId]!.events[0]!.pages![0]!;
    openFieldMonsterTemplateDialog(mapId, "ev_field_mob", page);
    const dialog = document.querySelector('[data-testid="field-monster-template-dialog"]');
    expect(dialog).toBeTruthy();

    const troopSelect = dialog!.querySelector('[data-testid="field-monster-template-troop"]') as HTMLSelectElement;
    const troopId = store.getCurrent().database.troops[0]!.id;
    troopSelect.value = troopId;
    troopSelect.dispatchEvent(new Event("change"));

    const intro = dialog!.querySelector('[data-testid="field-monster-template-intro"]') as HTMLTextAreaElement;
    const victory = dialog!.querySelector('[data-testid="field-monster-template-victory"]') as HTMLTextAreaElement;
    intro.value = "나타난다!";
    victory.value = "쓰러졌다!";

    (dialog!.querySelector('[data-testid="field-monster-template-apply"]') as HTMLButtonElement).click();

    const event = store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === "ev_field_mob")!;
    expect(event.pages).toHaveLength(2);
    expect(event.pages![0]!.name).toBe("전투");
    expect(hasFieldMonsterVictoryErasePattern(event.pages![0]!.commands)).toBe(true);
    expect(event.pages![1]!.conditions).toEqual([
      { kind: "switch", switchId: "sw_ev_field_mob_clear", value: true },
    ]);
    expect(event.pages![1]!.graphic.transparent).toBe(true);
    expect(store.getCurrent().switches.some((entry) => entry.id === "sw_ev_field_mob_clear")).toBe(false);
    saveEventDraft(mapId, "ev_field_mob");
    expect(store.getCurrent().switches.some((entry) => entry.id === "sw_ev_field_mob_clear")).toBe(true);
    expect(document.querySelector('[data-testid="field-monster-template-dialog"]')).toBeNull();
  });
});
