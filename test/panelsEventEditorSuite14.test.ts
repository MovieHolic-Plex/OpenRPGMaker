// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveEventDraft } from "@/editor/eventDraftActions";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { editorState } from "@/editor/editorState";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { openFieldMonsterTemplateDialog } from "@/editor/panels/eventEditor/fieldMonsterTemplateDialog";
import { buildFieldMonsterFightCommands, hasFieldMonsterVictoryErasePattern } from "@/project/fieldMonsterTemplate";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent, EventPageCondition, Project } from "@/project/types";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { openEventRailGroupFor } from "@/editor/panels/eventEditor/pageProps";
import { isolateTimers } from "./mergedTeardown";

describe("fieldMonsterTemplate", () => {
  isolateTimers();
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
});

// 호감도 조건의 UI 게이트 — 런타임이 하드 게이트(resolveSocialKey → null)로 항상 거짓을 내는 조합을
// 저작 화면이 조용히 만들게 두지 않는다. 근거: docs/specs/2026-07-14-character-id-relationship-gate.md §1-7,8
describe("friendshipConditionGate", () => {
  isolateTimers();
  const HINT = "event-condition-friendship-requires-character-id";
  function pageWith(conditions: readonly EventPageCondition[]): EventPage {
    return {
      id: "p1",
      name: "호감도 게이트",
      conditions: [...conditions],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "안녕" }],
    };
  }
  function renderRow(page: EventPage, event?: { characterId?: string }): HTMLElement {
    const host = document.createElement("div");
    host.append(...renderPageConditions("map-start", "ev_gate", page, event));
    return host;
  }
  function seedEvent(page: EventPage, characterId?: string): { project: Project; mapId: string; event: GameEvent } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event: GameEvent = {
      id: "ev_gate",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [page],
      ...(characterId ? { characterId } : {}),
    };
    project.maps[mapId]!.events = [event];
    return { project, mapId, event };
  }
  function issueCodes(page: EventPage, characterId?: string): readonly string[] {
    const { project, mapId, event } = seedEvent(page, characterId);
    return validateEventDraftBody(project, mapId, event).issues.map((issue) => issue.code);
  }
  describe("호감도 조건 게이트", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });

    it("NPC 관계가 없으면 조건 행이 항상 거짓임을 말한다", () => {
      const host = renderRow(pageWith([{ kind: "friendshipAtLeast", value: 80 }]));
      expect(host.querySelector(`[data-testid="${HINT}"]`)).not.toBeNull();
      // 행 자체는 사라지지 않는다 — RM 계약상 핵심 조건 행은 항상 자리를 지킨다.
      expect(host.querySelector('[data-testid="event-page-friendship-condition-value"]')).not.toBeNull();
    });

    it("NPC 관계가 연결되면 경고가 사라진다", () => {
      const host = renderRow(pageWith([{ kind: "friendshipAtLeast", value: 80 }]), { characterId: "char_a" });
      expect(host.querySelector(`[data-testid="${HINT}"]`)).toBeNull();
    });

    it("NPC 키를 직접 적은 경로는 미연결에서도 유효하다", () => {
      const host = renderRow(pageWith([{ kind: "friendshipAtLeast", npcKey: "village_herbalist", value: 80 }]));
      expect(host.querySelector(`[data-testid="${HINT}"]`)).toBeNull();
    });

    it("검증기가 미연결 호감도 조건을 경고로 잡는다", () => {
      expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", value: 80 }])))
        .toContain("condition.friendship.no-character-id");
    });

    it("검증기는 연결됐거나 NPC 키가 있으면 경고하지 않는다", () => {
      expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", value: 80 }]), "char_a"))
        .not.toContain("condition.friendship.no-character-id");
      expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", npcKey: "char_b", value: 80 }])))
        .not.toContain("condition.friendship.no-character-id");
    });

    it("중첩·명령 안 조건도 같은 게이트를 받는다", () => {
      const nested = pageWith([{ kind: "all", conditions: [{ kind: "friendshipAtLeast", value: 10 }] }]);
      expect(issueCodes(nested)).toContain("condition.friendship.no-character-id");

      const forked = pageWith([]);
      const page: EventPage = {
        ...forked,
        commands: [{
          kind: "fork",
          condition: { kind: "friendshipAtLeast", value: 10 },
          then: [],
          else: [],
        }],
      };
      expect(issueCodes(page)).toContain("condition.friendship.no-character-id");
    });
  });
  describe("검증 이슈 앵커와 설정 레일 그룹", () => {
    it("닫힌 그룹 안의 앵커를 가리키면 그 그룹이 열린다", () => {
      const rail = document.createElement("div");
      rail.className = "event-editor-settings-accordion";
      rail.dataset.railKey = "rail-test";
      const groups = ["look-talk", "when"].map((slug, index) => {
        const group = document.createElement("div");
        group.className = `event-editor-settings-accordion-group${index === 0 ? " is-open" : ""}`;
        group.dataset.railGroup = slug;
        const header = document.createElement("button");
        header.className = "event-editor-settings-accordion-header";
        header.setAttribute("aria-expanded", index === 0 ? "true" : "false");
        group.append(header);
        rail.append(group);
        return group;
      });
      const anchor = document.createElement("input");
      groups[1]!.append(anchor);
      document.body.append(rail);

      openEventRailGroupFor(anchor);

      expect(groups[1]!.classList.contains("is-open")).toBe(true);
      expect(groups[0]!.classList.contains("is-open")).toBe(false);
      expect(groups[1]!.querySelector(".event-editor-settings-accordion-header")?.getAttribute("aria-expanded")).toBe("true");
      rail.remove();
    });
  });
});
