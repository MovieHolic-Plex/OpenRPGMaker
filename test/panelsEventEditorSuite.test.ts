// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCachedCharacterIdIndex, invalidateCharacterIdIndexCache, listCharacterIdIndex } from "@/project/characterIdIndex";
import { renderEventCharacterSocialExtras, renderEventCharacterIdField, renderClassicPageTabStrip, renderEventPageProps } from "@/editor/panels/eventEditor/pageProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent, Command, EventPage, Project, Condition } from "@/project/types";
import { openCharacterIdPicker } from "@/editor/panels/eventEditor/characterIdPickerDialog";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { editorState } from "@/editor/editorState";
import { commandSummary, eventNameForSummary } from "@/editor/panels/eventEditor/commandSummary";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { renderCompanionRoster } from "@/editor/panels/eventEditor/companionRoster";
import { conditionForm } from "@/editor/panels/eventEditor/conditionForm";
import { pageConditionSentence } from "@/editor/panels/eventEditor/pageConditionSentence";
import { installFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("characterIdAutocomplete", () => {
  isolateTimers();
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
});

describe("characterIdPickerDialog", () => {
  isolateTimers();
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

    it("shows a direct relationship action, then a linked status and grouped settings", () => {
      const { mapId, event } = seedProject();
      const unlinked = renderEventCharacterIdField(mapId, event);
      document.body.append(unlinked);
      expect(unlinked.querySelector('[data-testid="event-character-id-connect"]')?.textContent).toContain("연결 안 됨");
      expect(unlinked.querySelector('[data-testid="event-character-id-input"]')).toBeNull();
      unlinked.remove();

      const linkedEvent = { ...event, characterId: "char_linked" };
      const linked = renderEventCharacterIdField(mapId, linkedEvent);
      const extras = renderEventCharacterSocialExtras(mapId, linkedEvent);
      document.body.append(linked);
      if (extras) document.body.append(extras);
      expect(linked.querySelector('[data-testid="event-character-id-picker-open"]')?.textContent).toContain("char_linked");
      expect(linked.querySelector('[data-testid="event-character-id-connect"]')).toBeNull();
      expect(extras?.querySelector('[data-testid="event-character-id-input"]')).toBeTruthy();
      expect(extras?.querySelector('[data-testid="event-talk-friendship-field"]')?.textContent).toContain("대화 보너스");
      expect(extras?.querySelector('[data-testid="event-character-social-unlink"]')).toBeTruthy();
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

      expect(root.textContent).toContain("NPC 관계 연결");
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
      // 자유 입력은 연결된 관계 카드의 고급 설정에서만 가능하다.
      const { mapId, event } = seedProject({ characterId: "char_seed" });
      const field = renderEventCharacterSocialExtras(mapId, event);
      if (!field) throw new Error("relationship settings missing");
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
});

// 명령 목록은 「선택 끝」「분기 끝」 마커 행을 두지 않는다(2026-09-03 제안서 §6·§8).
// 들여쓰기와 분기 머리 행이 구조를 말하고, 끝 행은 정보 없이 세로 공간만 썼다.
describe("commandListBranchEnd", () => {
  isolateTimers();
  const noop = (): void => {};
  const actions: CommandListActions = {
    addCommand: noop,
    insertCommand: noop,
    replaceCommand: noop,
    deleteCommand: noop,
    moveCommand: noop,
    moveCommandTo: noop,
  };
  const COMMANDS: Command[] = [
    {
      kind: "choices",
      prompt: "무엇을 하겠나?",
      options: [
        { text: "판다", branch: [{ kind: "changeGold", op: "+=", amount: 120 }] },
        { text: "산다", branch: [] },
      ],
    },
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "sw_1", value: true },
      then: [{ kind: "text", body: "맞을 때" }],
      else: [{ kind: "text", body: "아닐 때" }],
    },
    { kind: "wait", ms: 300 },
  ];
  describe("명령 목록의 분기 끝 행", () => {
    it("끝 마커 행이 없고 분기 머리·명령·빈 분기 행은 그대로다", () => {
      const host = document.createElement("div");
      document.body.append(host);
      renderCommandList(host, COMMANDS, [], actions);
      const markers = Array.from(host.querySelectorAll<HTMLElement>(".cmd-line-marker")).map((node) => node.textContent?.trim() ?? "");
      expect(markers.some((text) => /끝$/.test(text))).toBe(false);
      expect(markers.filter((text) => text.length > 0).length).toBeGreaterThanOrEqual(3);
      expect(host.querySelectorAll('[data-testid="event-command-changeGold"]').length).toBe(1);
      expect(host.querySelectorAll('[data-testid="event-command-text"]').length).toBe(2);
      expect(host.querySelector('[data-testid^="event-command-branch-empty-"]')).not.toBeNull();
      host.remove();
    });
  });
});

// 명령 요약은 이벤트 ID 가 아니라 이름을 말한다(2026-09-03 제안서 §6 — 「이동 경로 설정: ev_ux_stress (4개)」).
describe("commandSummaryEventName", () => {
  isolateTimers();
  function page(id: string, name: string): EventPage {
    return { id, name, conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] };
  }
  function event(id: string, pageName: string): GameEvent {
    return { id, x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page(`${id}-p1`, pageName)] };
  }
  describe("eventNameForSummary", () => {
    let mapId: string;
    beforeEach(() => {
      const project = createBlankProject();
      mapId = project.startMapId;
      project.maps[mapId]!.events = [event("ev_smith", "대장장이 하몬")];
      const otherId = "map_other_probe";
      project.maps[otherId] = { ...structuredClone(project.maps[mapId]!), id: otherId, name: "다른 맵", events: [event("ev_far", "먼 곳의 상인")] };
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventId: null, selectedEventPageId: null });
    });

    it("현재 맵의 이벤트는 표시 이름으로, 빈 ID 는 이 이벤트로", () => {
      expect(eventNameForSummary("ev_smith")).toBe("대장장이 하몬");
      expect(eventNameForSummary("")).toBe("이 이벤트");
    });

    it("다른 맵의 이벤트도 찾고, 없는 ID 는 끊어진 참조임을 드러낸다", () => {
      expect(eventNameForSummary("ev_far")).toBe("먼 곳의 상인");
      expect(eventNameForSummary("ev_ghost")).toBe("ev_ghost (없음)");
    });

    it("이동 경로·모습 바꾸기 요약에 원시 ID 가 남지 않는다", () => {
      const route = commandSummary({ kind: "moveEvent", eventId: "ev_smith", route: { moves: [{ kind: "move", dir: "left" }], repeat: false } });
      expect(route).toContain("대장장이 하몬");
      expect(route).not.toContain("ev_smith");
      expect(commandSummary({ kind: "moveEvent", eventId: PLAYER_MOVE_TARGET, route: { moves: [], repeat: false } })).toContain("주인공");
      const pattern = commandSummary({ kind: "setEventGraphicPattern", eventId: "ev_smith", pattern: 1 });
      expect(pattern).toContain("대장장이 하몬");
      expect(pattern).not.toContain("ev_smith");
    });
  });
});

describe("companionRoster", () => {
  isolateTimers();
  describe("companion roster in the companion command picker", () => {
    it("lists every database actor with a rendered portrait background", () => {
      const project = fixtureProject();
      const root = renderCompanionRoster(project);

      expect(root.dataset.testid).toBe("companion-roster");
      const cards = root.querySelectorAll("[data-testid^='companion-card-']");
      expect(cards.length).toBe(project.database.actors.length);
      for (const actor of project.database.actors) {
        const card = root.querySelector(`[data-testid='companion-card-${actor.id}']`);
        expect(card?.textContent ?? "").toContain(actor.name);
        const thumb = card?.querySelector(`[data-testid='companion-thumb-${actor.id}']`) as HTMLElement | null;
        expect(thumb?.style.backgroundImage ?? "").toContain("url(");
      }
    });

    it("collapses to a hint when no actor exists", () => {
      const project = createBlankProject();
      project.database.actors = [];
      const root = renderCompanionRoster(project);
      expect(root.querySelectorAll("[data-testid^='companion-card-']").length).toBe(0);
    });
  });
  function fixtureProject(): Project {
    const project = createBlankProject();
    const template = project.database.actors[0];
    if (!template) throw new Error("missing default actor fixture");
    project.database.actors = [template, ...project.database.actors.slice(1)].map((actor, index) => ({
      ...actor,
      faceResourceId: index === 0 ? undefined : actor.faceResourceId,
      characterResourceId: index === 0 ? "easyrpg-charset-object1" : actor.characterResourceId,
      characterIndex: index,
    }));
    return project;
  }
});

// 조건 문장·요약·배지·분기 폼에 내부 토큰이 새면 안 된다.
// 페이지 문장과 분기 요약은 같은 기능의 두 표면이므로 한 계약으로 묶는다.
describe("conditionCopyTokens", () => {
  isolateTimers();
  const FORBIDDEN: readonly { readonly name: string; readonly re: RegExp }[] = [
    { name: "ON", re: /\bON\b/ },
    { name: "OFF", re: /\bOFF\b/ },
    { name: "AND(", re: /AND\(/ },
    { name: "OR(", re: /OR\(/ },
    { name: "NOT", re: /\bNOT\b/ },
    { name: "timer1", re: /timer1/ },
    { name: "timer2", re: /timer2/ },
    { name: "completed", re: /\bcompleted\b/ },
    { name: "failed", re: /\bfailed\b/ },
    { name: "abandoned", re: /\babandoned\b/ },
    { name: "run", re: /\brun\b/ },
  ];
  function assertCleanCopy(label: string, text: string): void {
    for (const token of FORBIDDEN) {
      expect(text, `${label} leaked ${token.name}: ${text}`).not.toMatch(token.re);
    }
  }
  function sampleConditions(): readonly Condition[] {
    const project = store.getCurrent();
    const switchId = project.switches[0]?.id ?? "sw_0001";
    const variableId = project.variables[0]?.id ?? "var_0001";
    const actorId = project.database.actors[0]?.id ?? "act_0001";
    const itemId = project.database.items[0]?.id ?? "item_0001";
    const switchCond: Condition = { kind: "switch", switchId, value: true };
    return [
      switchCond,
      { kind: "switch", switchId, value: false },
      { kind: "variable", variableId, op: ">=", value: 10 },
      { kind: "variable", variableId, op: "==", value: 4 },
      { kind: "variable", variableId, op: "!=", value: 1 },
      { kind: "selfSwitch", key: "A", value: true },
      { kind: "selfSwitch", key: "B", value: false },
      { kind: "actor", actorId, present: true },
      { kind: "actor", actorId, present: false },
      { kind: "item", itemId, present: true },
      { kind: "item", itemId, present: false },
      { kind: "gold", op: ">=", amount: 100 },
      { kind: "timer", timerId: "timer1", seconds: 5 },
      { kind: "timer", timerId: "timer2", seconds: 90 },
      { kind: "timePhase", phase: "morning" },
      { kind: "season", season: "winter" },
      { kind: "npcActivity", activity: "work" },
      { kind: "friendshipAtLeast", npcKey: "촌장", value: 50 },
      { kind: "battleResult", result: "victory" },
      { kind: "run", query: "active", value: true },
      { kind: "run", query: "active", value: false },
      { kind: "run", query: "floor", op: ">=", value: 3 },
      { kind: "run", query: "flag", flag: "door", value: true },
      { kind: "run", query: "result", result: "completed" },
      { kind: "run", query: "result", result: "failed" },
      { kind: "run", query: "result", result: "abandoned" },
      { kind: "all", conditions: [switchCond] },
      { kind: "any", conditions: [switchCond] },
      { kind: "not", condition: switchCond },
      { kind: "all", conditions: [] },
      { kind: "any", conditions: [] },
    ];
  }
  function pageWith(conditions: readonly Condition[]): EventPage {
    return {
      id: "p1",
      name: "조건 복사",
      conditions: [...conditions],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
  function hostEvent(page: EventPage): GameEvent {
    return {
      id: "ev_copy",
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: [],
      pages: [page],
    };
  }
  describe("조건 복사에 내부 토큰이 없다", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });

    it("페이지 문장과 분기 요약에 금지 토큰이 없다", () => {
      for (const condition of sampleConditions()) {
        assertCleanCopy(`sentence ${condition.kind}`, pageConditionSentence([condition]).text);
        assertCleanCopy(
          `fork ${condition.kind}`,
          commandSummary({ kind: "fork", condition, then: [] }),
        );
      }
    });

    it("페이지 탭·배지·조건 폼에도 금지 토큰이 없다", () => {
      const mapId = store.getCurrent().startMapId;
      for (const condition of sampleConditions()) {
        const page = pageWith([condition]);
        const event = hostEvent(page);
        const tabs = renderClassicPageTabStrip(mapId, event, page);
        assertCleanCopy(`tab ${condition.kind}`, tabs.textContent ?? "");
        const tooltip = tabs.querySelector('[data-testid="evt-page-cond-1"]')?.parentElement?.getAttribute("title") ?? "";
        assertCleanCopy(`tooltip ${condition.kind}`, tooltip);

        const props = renderEventPageProps(mapId, event.id, page, event);
        assertCleanCopy(`props ${condition.kind}`, props.textContent ?? "");

        const form = conditionForm(condition, () => {});
        assertCleanCopy(`form ${condition.kind}`, form.textContent ?? "");
      }
    });
  });
});

// test/conditionModeCacheScope.test.ts
//
// conditionModeCache 가 모듈 전역 kind 키였다 — fork A에서 switch sw_0001 저작 후
// fork B에서 같은 종류로 전환하면 A의 switchId 가 B에 복원됐다.
// 캐시 키에 편집 호스트(맵·이벤트·페이지·경로)를 포함한 회귀 계약이다.
describe("conditionModeCacheScope", () => {
  isolateTimers();
  describe("condition mode cache scope", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom?.();
    });

    function switchTo(form: HTMLElement, kind: Condition["kind"]): void {
      const mode = form.querySelector('[data-testid="event-condition-mode"]') as HTMLSelectElement | null;
      if (!mode) throw new Error("missing mode select");
      mode.value = kind;
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    }

    it("does not leak one fork's switch into another fork's form", () => {
      const seen: Condition[] = [];
      const onChange = (next: Condition): void => {
        seen.push(next);
      };

      // fork A: switch sw_AAA 저작 후 variable 로 전환(캐시에 sw_AAA 저장).
      editorState.set({ selectedEventId: "ev_A" });
      const formA = conditionForm({ kind: "switch", switchId: "sw_AAA", value: true }, onChange, [0]);
      document.body.append(formA);
      switchTo(formA, "variable");

      // fork B: 다른 이벤트·경로. switch 로 전환해도 A의 값이 복원되면 안 된다.
      seen.length = 0;
      editorState.set({ selectedEventId: "ev_B" });
      const formB = conditionForm({ kind: "variable", variableId: "var_x", op: ">=", value: 0 }, onChange, [3]);
      document.body.append(formB);
      switchTo(formB, "switch");

      expect(seen).toHaveLength(1);
      expect(seen[0]).toEqual({ kind: "switch", switchId: "", value: true });
    });
  });
});
