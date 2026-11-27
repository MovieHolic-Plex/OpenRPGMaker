// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCachedCharacterIdIndex, invalidateCharacterIdIndexCache, listCharacterIdIndex } from "@/project/characterIdIndex";
import { renderEventCharacterSocialExtras, renderEventCharacterIdField, renderClassicPageTabStrip, renderEventPageProps } from "@/editor/panels/eventEditor/pageProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent, Command, EventPage, Project, Condition, M2CommandFields, MapId } from "@/project/types";
import { openCharacterIdPicker } from "@/editor/panels/eventEditor/characterIdPickerDialog";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import type { CommandListActions, CommandEditContext } from "@/editor/panels/eventEditor/types";
import { editorState } from "@/editor/editorState";
import { commandSummary, eventNameForSummary } from "@/editor/panels/eventEditor/commandSummary";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { renderCompanionRoster } from "@/editor/panels/eventEditor/companionRoster";
import { conditionForm } from "@/editor/panels/eventEditor/conditionForm";
import { pageConditionSentence } from "@/editor/panels/eventEditor/pageConditionSentence";
import { installFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, CHARSET_SHEET_COLUMNS, CHARSET_SHEET_ROWS, charsetFrameSource } from "@/assets/easyrpgRtp";
import { charsetIconOf, facesetIconOf } from "@/editor/panels/eventEditor/recordPicker";
import { actorPicker, itemPicker, mapPicker, mapSelectElement } from "@/editor/panels/eventEditor/sharedPickers";
import { showEmoteBody } from "@/editor/panels/eventEditor/commandBodyPage3Native";
import { EMOTE_KINDS, EMOTE_MAX_DURATION_MS, emoteFrameIndex } from "@/project/emotes";
import { openDatabaseResourcePickerDialog, resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { playAudioBodyForTest } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { renderMapProps } from "@/editor/panels/mapProps";
import { audioCommandContext } from "./support/audioSearchFixture";
import { renderCoordinateMoveCommandBody } from "@/editor/panels/eventEditor/commandBodyM2Coordinate";
import { m2CommandById, M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { movementResultCode } from "@/project/eventCommands/coordinateDestination";
import { commandCategoryVisual, pickerPageIcon, renderCategoryIcon } from "@/editor/panels/eventEditor/commandCategoryIcons";
import { EDITOR_ICON_NAMES, renderEditorIcon } from "@/editor/panels/eventEditor/editorIcons";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { resetEventAiStagedForTest } from "@/editor/panels/eventEditor/aiAssist";
import { resetEventEditLineForTest } from "@/editor/panels/eventEditor/eventEditLine";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import { getAudioEngine, playAudioCommand, resumeAudioState } from "@/player/audio";
import { enterBattleAudio, exitBattleAudio, playAuthoredBattleResultCue } from "@/player/battleAudio";
import { playBattleCue } from "@/player/battleJuice";
import { createInterpreter } from "@/player/interpreter";
import { runCommands } from "@/player/playSceneInterpreter";
import { applyNonBlockingStep } from "@/player/playSceneSchedulers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createSaveSnapshot, applySaveSnapshot, saveToSlot, readSaveSlot } from "@/player/saveSlots";
import { startMapBgm } from "@/player/mapBgm";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { buildContractProject } from "./commandContracts/harness";

describe("panelsEventEditorSuite", () => {
  isolateTimers();
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
});

describe("panelsEventEditorSuite13", () => {
  isolateTimers();
  describe("content", () => {
    isolateTimers();
    // 우선순위와 겹침은 런타임 통행 판정식(`priority === "same" && overlapForbidden`)의 두 반쪽이다.
    // 한 그룹에서 함께 보이고, 판정에 안 쓰이는 상태를 살아있는 것처럼 보이지 않게 하는 계약.
    describe("eventPagePassageGroup", () => {
      isolateTimers();
      function seed(pageOverrides: Partial<EventPage> = {}): string {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId]!;
        map.events = [
          {
            id: "ev_passage",
            x: 2,
            y: 3,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "p1",
                name: "통행",
                conditions: [],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                overlapForbidden: true,
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
                ...pageOverrides,
              } as EventPage,
            ],
          },
        ];
        store.replace(project);
        editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
        return mapId;
      }
      describe("겹침과 통행 그룹", () => {
        let host: HTMLElement;

        beforeEach(() => {
          host = document.createElement("div");
          document.body.append(host);
        });

        afterEach(() => {
          host.remove();
        });

        it("우선순위 select 가 겹침과 같은 memory 그룹에 있다", () => {
          renderEventEditorDynamic(host, seed(), "ev_passage");
          const priority = host.querySelector<HTMLElement>("[data-testid='event-page-priority-select']");
          expect(priority).toBeTruthy();
          expect(priority!.closest("[data-testid='evt-rail-group-memory']")).toBeTruthy();
          expect(priority!.closest("[data-testid='evt-rail-group-when']")).toBeNull();
        });

        it("같은 층이면 겹침 체크가 살아 있고 안내문이 판정에 쓰인다고 말한다", () => {
          renderEventEditorDynamic(host, seed({ priority: "same" }), "ev_passage");
          const overlap = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
          expect(overlap!.disabled).toBe(false);
          expect(host.querySelector("[data-testid='event-page-overlap-priority-hint']")!.textContent).toContain(
            "통행 판정에 쓰입니다",
          );
        });

        it("맵 아래/맵 위면 겹침 체크를 잠그고 왜 안 막히는지 알려 준다", () => {
          for (const priority of ["below", "above"] as const) {
            host.replaceChildren();
            renderEventEditorDynamic(host, seed({ priority }), "ev_passage");
            const overlap = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
            expect(overlap!.disabled, priority).toBe(true);
            const hint = host.querySelector("[data-testid='event-page-overlap-priority-hint']")!.textContent ?? "";
            expect(hint, priority).toContain("통행을 막지 않습니다");
            expect(hint, priority).toContain(priority === "below" ? "맵 아래" : "맵 위");
            // 헤더 요약도 «겹침 금지» 라고 거짓말하지 않는다.
            expect(host.querySelector("[data-testid='evt-rail-meta-memory']")!.textContent, priority).toContain("통행 허용");
          }
        });

        it("층을 옮겼으면 그룹에 손댄 표시(점)가 뜬다", () => {
          renderEventEditorDynamic(host, seed({ priority: "below", overlapForbidden: true }), "ev_passage");
          expect(host.querySelector("[data-testid='evt-rail-dot-memory']")).toBeTruthy();
        });

        it("기타 그룹이 생기지 않고 레일 순서는 그대로다", () => {
          renderEventEditorDynamic(host, seed(), "ev_passage");
          expect(host.querySelector("[data-testid='evt-rail-group-other']")).toBeNull();
          const rail = host.querySelector<HTMLElement>("[data-testid='event-editor-settings-accordion']");
          expect([...rail!.children].map((node) => (node as HTMLElement).dataset.railGroup)).toEqual([
            "look-talk",
            "when",
            "move",
            "memory",
            "npc",
          ]);
        });
      });
    });
    // 레일은 한 번에 한 그룹만 연다. 나머지 넷은 접혀 있으므로, 어느 그룹에 저작자가
    // 손댄 내용이 있는지 열어 보지 않고도 알 수 있어야 한다. 기본값 그대로인 그룹과
    // 값이 들어간 그룹을 점 하나로 가른다.
    describe("eventRailAuthoredDot", () => {
      isolateTimers();
      function seed(page: Partial<EventPage> = {}, event: Partial<GameEvent> = {}): string {
        const project = createBlankProject();
        const mapId = project.startMapId;
        project.maps[mapId]!.events = [
          {
            id: "ev_dot",
            x: 2,
            y: 3,
            trigger: { kind: "action" },
            commands: [],
            ...event,
            pages: [
              {
                id: "p1",
                name: "점",
                conditions: [],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                overlapForbidden: true,
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
                ...page,
              } as EventPage,
            ],
          } as GameEvent,
        ];
        store.replace(project);
        editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
        return mapId;
      }
      function hasDot(host: HTMLElement, slug: string): boolean {
        const group = host.querySelector<HTMLElement>(`[data-testid='evt-rail-group-${slug}']`);
        return Boolean(group?.querySelector(`[data-testid='evt-rail-dot-${slug}']`));
      }
      describe("레일 그룹 저작 표시 점", () => {
        let host: HTMLElement;

        beforeEach(() => {
          host = document.createElement("div");
          document.body.append(host);
        });

        afterEach(() => {
          host.remove();
        });

        it("기본값뿐인 페이지에는 점이 하나도 없다", () => {
          const mapId = seed();
          renderEventEditorDynamic(host, mapId, "ev_dot");
          for (const slug of ["look-talk", "when", "move", "memory", "npc"]) {
            expect(hasDot(host, slug), slug).toBe(false);
          }
        });

        it("조건을 넣으면 when 그룹에만 점이 붙는다", () => {
          const mapId = seed({ conditions: [{ kind: "switch", switchId: "sw_0001", value: true }] });
          renderEventEditorDynamic(host, mapId, "ev_dot");
          expect(hasDot(host, "when")).toBe(true);
          expect(hasDot(host, "move")).toBe(false);
          expect(hasDot(host, "look-talk")).toBe(false);
        });

        it("이동 유형이 정지가 아니면 move 그룹에 점이 붙는다", () => {
          const mapId = seed({ movement: { type: "random", speed: 4, frequency: 3 } });
          renderEventEditorDynamic(host, mapId, "ev_dot");
          expect(hasDot(host, "move")).toBe(true);
          expect(hasDot(host, "when")).toBe(false);
        });

        it("그래픽을 고르면 look-talk 그룹에 점이 붙는다", () => {
          const mapId = seed({ graphic: { sprite: "Actor1" } });
          renderEventEditorDynamic(host, mapId, "ev_dot");
          expect(hasDot(host, "look-talk")).toBe(true);
        });

        it("겹침 기본값(금지)에는 점이 없고, 통행 허용으로 바꾸면 붙는다", () => {
          const base = seed({ overlapForbidden: true });
          renderEventEditorDynamic(host, base, "ev_dot");
          expect(hasDot(host, "memory")).toBe(false);

          host.replaceChildren();
          const changed = seed({ overlapForbidden: false });
          renderEventEditorDynamic(host, changed, "ev_dot");
          expect(hasDot(host, "memory")).toBe(true);
        });

        it("NPC 를 연결하면 npc 그룹에 점이 붙는다", () => {
          const mapId = seed({}, { characterId: "npc_shopkeeper" });
          renderEventEditorDynamic(host, mapId, "ev_dot");
          expect(hasDot(host, "npc")).toBe(true);
        });
      });
    });
    // 레일 그룹 소속은 위치가 아니라 명시 claim 으로 결정된다는 계약을 고정한다.
    describe("eventRailGroupComposition", () => {
      isolateTimers();
      function seed(pageOverrides: Partial<EventPage> = {}): string {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId]!;
        map.events = [
          {
            id: "ev_rail",
            x: 2,
            y: 3,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "p1",
                name: "레일",
                conditions: [],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                overlapForbidden: true,
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
                ...pageOverrides,
              } as EventPage,
            ],
          },
        ];
        store.replace(project);
        editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
        return mapId;
      }
      describe("이벤트 편집기 좌측 레일 그룹 소속", () => {
        let host: HTMLElement;

        beforeEach(() => {
          host = document.createElement("div");
          document.body.append(host);
        });

        afterEach(() => {
          host.remove();
        });

        it("겹침 체크박스는 memory 그룹이 소유한다", () => {
          const mapId = seed();
          renderEventEditorDynamic(host, mapId, "ev_rail");
          const overlap = host.querySelector<HTMLElement>("[data-testid='event-classic-overlap']");
          expect(overlap).toBeTruthy();
          expect(overlap!.closest("[data-testid='evt-rail-group-memory']")).toBeTruthy();
          expect(overlap!.closest("[data-testid='evt-rail-group-when']")).toBeNull();
        });

        it("memory 그룹 body 에 편집 가능한 컨트롤이 있다", () => {
          const mapId = seed();
          renderEventEditorDynamic(host, mapId, "ev_rail");
          const body = host.querySelector<HTMLElement>(
            "[data-testid='evt-rail-group-memory'] .event-editor-settings-accordion-body",
          );
          expect(body).toBeTruthy();
          expect(body!.querySelectorAll("input, select, textarea").length).toBeGreaterThan(0);
        });

        it("미분류 자식이 없어 기타 그룹이 만들어지지 않는다", () => {
          const mapId = seed();
          renderEventEditorDynamic(host, mapId, "ev_rail");
          expect(host.querySelector("[data-testid='evt-rail-group-other']")).toBeNull();
          const rail = host.querySelector<HTMLElement>("[data-testid='event-editor-settings-accordion']");
          const slugs = [...rail!.children].map((node) => (node as HTMLElement).dataset.railGroup);
          expect(slugs).toEqual(["look-talk", "when", "move", "memory", "npc"]);
        });

        it("overlapForbidden 미지정 시 헤더 요약과 체크박스 상태가 일치한다", () => {
          const mapId = seed({ overlapForbidden: undefined });
          renderEventEditorDynamic(host, mapId, "ev_rail");
          const meta = host.querySelector<HTMLElement>("[data-testid='evt-rail-meta-memory']");
          const checkbox = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
          expect(checkbox!.checked).toBe(true);
          expect(meta!.textContent).toBe("겹침 금지");
        });

        it("움직임 그룹 요약은 원시 enum 이 아니라 한글 라벨을 보여준다", () => {
          const mapId = seed({ movement: { type: "random", speed: 5, frequency: 6 } });
          renderEventEditorDynamic(host, mapId, "ev_rail");
          const meta = host.querySelector<HTMLElement>("[data-testid='evt-rail-meta-move']");
          expect(meta!.textContent).toContain("무작위");
          expect(meta!.textContent).not.toContain("random");
        });

        it("이동 속도 select 는 런타임 범위 1~8 을 전부 제시한다", () => {
          const mapId = seed({ movement: { type: "random", speed: 8, frequency: 6 } });
          renderEventEditorDynamic(host, mapId, "ev_rail");
          const select = host.querySelector<HTMLSelectElement>("[data-testid='event-page-movement-speed-select']");
          expect([...select!.options].map((option) => option.value)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
          expect(select!.value).toBe("8");
        });
      });
    });
    // 계약: 스위치·변수·아이템·주인공은 "DB 레코드 하나 고르기"라는 같은 일이므로
    // 같은 컨트롤(트리거 버튼 + 숨은 select)로 편집한다.
    //
    // 이전에는 스위치/변수만 모달 픽커였고 아이템/주인공은 네이티브 <select> 였다.
    // 네이티브 select 는 좁은 조건 칸에서 폭이 눌려 선택값이 읽히지 않았다(실측 91px,
    // "0001: 회복약" 이 들어가지 않음). 숨은 select 는 남긴다 — Playwright
    // selectOption 과 기존 change 파이프라인 호환 때문이며, 스위치/변수가 이미 쓰는 방식이다.
    //
    // 조건 칸은 이후 칩 팔레트로 바뀌어 **켜진 조건의 행만** 렌더한다. 그래서 픽커를 보려면
    // 네 종류 조건을 실제로 심어야 한다 — 빈 conditions 로는 행 자체가 없어 픽커도 없다.
    describe("eventRecordPickerUnified", () => {
      isolateTimers();
      function seed(): string {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId]!;
        map.events = [
          {
            id: "ev_pick",
            x: 2,
            y: 3,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "p1",
                name: "픽커",
                conditions: [
                  { kind: "switch", switchId: "sw_1", value: true },
                  { kind: "variable", variableId: "var_1", op: ">=", value: 0 },
                  { kind: "item", itemId: "item_potion", present: true },
                  { kind: "actor", actorId: "actor_hero", present: true },
                ],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                overlapForbidden: true,
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
            ],
          },
        ];
        store.replace(project);
        editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
        return mapId;
      }
      describe("레코드 선택 컨트롤 통일", () => {
        let host: HTMLElement;

        beforeEach(() => {
          host = document.createElement("div");
          document.body.append(host);
        });

        afterEach(() => {
          host.remove();
        });

        for (const kind of ["item", "actor"] as const) {
          it(`${kind} 조건은 네이티브 select 가 아니라 픽커 트리거를 노출한다`, () => {
            const mapId = seed();
            renderEventEditorDynamic(host, mapId, "ev_pick");

            const trigger = host.querySelector<HTMLElement>(
              `[data-testid='event-page-${kind}-condition-picker-open']`,
            );
            expect(trigger, `${kind} 픽커 트리거가 있어야 한다`).not.toBeNull();
            expect(trigger?.tagName).toBe("BUTTON");
          });

          it(`${kind} 의 숨은 select 는 e2e 호환을 위해 남는다`, () => {
            const mapId = seed();
            renderEventEditorDynamic(host, mapId, "ev_pick");

            const select = host.querySelector<HTMLSelectElement>(
              `[data-testid='event-page-${kind}-condition-input']`,
            );
            expect(select, `${kind} 숨은 select 가 남아야 한다`).not.toBeNull();
            expect(select?.tagName).toBe("SELECT");
            expect(select?.getAttribute("aria-hidden")).toBe("true");
          });
        }

        it("네 종류 모두 같은 트리거 클래스를 쓴다", () => {
          const mapId = seed();
          renderEventEditorDynamic(host, mapId, "ev_pick");

          const ids = [
            "event-page-switch-condition-picker-open",
            "event-page-variable-picker-open",
            "event-page-item-condition-picker-open",
            "event-page-actor-condition-picker-open",
          ];
          for (const id of ids) {
            const node = host.querySelector<HTMLElement>(`[data-testid='${id}']`);
            expect(node, `${id} 가 있어야 한다`).not.toBeNull();
            expect(node?.classList.contains("event-record-picker-trigger"), id).toBe(true);
          }
        });
      });
    });
  });
  describe("sharedPickers", () => {
    isolateTimers();
    describe("sharedPickers", () => {
      isolateTimers();
      describe("sharedPickers", () => {
        it("mapPicker exposes select testid and map size subtitle", () => {
          const project = createBlankProject();
          const mapId = project.startMapId;
          const map = project.maps[mapId];
          expect(map).toBeTruthy();

          const picker = mapPicker({
            project,
            selectedId: mapId,
            testid: "change-tile-map-select",
          });

          expect(picker.select.dataset.testid).toBe("change-tile-map-select");
          expect(picker.select.value).toBe(mapId);
          expect(picker.root.querySelector(".record-picker-card-name")?.textContent).toContain(map!.name);
          expect(picker.root.querySelector(".record-picker-card-subtitle")?.textContent).toBe(
            `${map!.width}×${map!.height}`,
          );
        });

        it("mapSelectElement lists all maps and keeps empty option when allowed", () => {
          const project = createBlankProject();
          const select = mapSelectElement({
            project,
            selectedId: "",
            testid: "event-page-living-target-map",
            allowEmpty: true,
          });
          expect(select.dataset.testid).toBe("event-page-living-target-map");
          expect(select.options.length).toBe(Object.keys(project.maps).length + 1);
        });

        it("actorPicker and itemPicker reuse record cards with icons/subtitles", () => {
          const project = createBlankProject();
          const actor = project.database.actors[0];
          const item = project.database.items[0];
          expect(actor).toBeTruthy();
          expect(item).toBeTruthy();

          const actorHandle = actorPicker({
            project,
            selectedId: actor!.id,
            testid: "change-party-actor-select",
          });
          expect(actorHandle.select.dataset.testid).toBe("change-party-actor-select");
          expect(actorHandle.root.querySelector(".record-picker-card-name")?.textContent).toBe(actor!.name);

          const itemHandle = itemPicker({
            project,
            selectedId: item!.id,
            testid: "change-item-select",
            subtitleOf: () => "시작 보유 ×0",
          });
          expect(itemHandle.select.dataset.testid).toBe("change-item-select");
          expect(itemHandle.root.querySelector(".record-picker-card-subtitle")?.textContent).toBe("시작 보유 ×0");
        });

        it("facesetIconOf renders one standalone face image, never a sheet crop", () => {
          const project = createBlankProject();
          const icon = facesetIconOf(project, "easyrpg-faceset-actor1-05");
          expect(icon).not.toBeNull();
          if (icon?.kind !== "image") throw new Error("expected whole-image face icon");
          expect(icon.url).toContain("/assets/easyrpg/faceset/Actor1/05.png");

          // actorPicker must render that face as a plain <img>, not a crop box.
          const actor = project.database.actors[0]!;
          actor.faceResourceId = "easyrpg-faceset-actor1-05";
          const picker = actorPicker({ project, selectedId: actor.id, testid: "actor-face-crop" });
          expect(picker.root.querySelectorAll(".rich-record-icon-crop")).toHaveLength(0);
          const images = picker.root.querySelectorAll(".rich-record-icon");
          expect(images).toHaveLength(1);
          expect(images[0]?.getAttribute("src")).toContain("/assets/easyrpg/faceset/Actor1/05.png");
        });

        it("charsetIconOf crops one character slot idle-front frame from multi-object sheets", () => {
          const project = createBlankProject();
          const characterIndex = 4;
          const icon = charsetIconOf(project, "easyrpg-charset-object1", characterIndex);
          expect(icon).not.toBeNull();
          if (icon?.kind !== "sheetRect") throw new Error("expected sheetRect crop");
          const source = charsetFrameSource({ characterIndex, direction: "down", pattern: 1 });
          expect(icon.x).toBe(source.x);
          expect(icon.y).toBe(source.y);
          expect(icon.cellWidth).toBe(CHARSET_FRAME_WIDTH);
          expect(icon.cellHeight).toBe(CHARSET_FRAME_HEIGHT);
          expect(icon.sheetWidth).toBe(CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH);
          expect(icon.sheetHeight).toBe(CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT);
        });
      });
    });
    // 이모트 명령 편집 폼 — 그림으로 고르는 격자와 대상 전환이 실제 명령으로 커밋되는지.
    describe("showEmoteCommandBody", () => {
      isolateTimers();
      function harness(initial: Extract<Command, { kind: "showEmote" }>) {
        const replaced: Command[] = [];
        const context = {
          path: [0],
          lockKind: true,
          actions: {
            replaceCommand: (_path: readonly number[], command: Command) => replaced.push(command),
            addCommand: () => {},
            removeCommand: () => {},
            moveCommand: () => {},
          },
        } as unknown as CommandEditContext;
        const root = showEmoteBody(context, initial);
        document.body.replaceChildren(root);
        return { root, replaced };
      }
      const q = <T extends Element = HTMLElement>(root: ParentNode, testid: string): T | null =>
        root.querySelector<T>(`[data-testid="${testid}"]`);
      describe("showEmote 편집 폼", () => {
        beforeEach(() => {
          store.replace(createBlankProject());
        });

        it("12종 전부가 격자에 있고 각 칸이 자기 프레임을 보여준다", () => {
          const { root } = harness({ kind: "showEmote", target: { eventId: "" }, emote: "heart" });
          const grid = q(root, "show-emote-swatch-grid");
          expect(grid).not.toBeNull();
          expect(grid?.querySelectorAll("button")).toHaveLength(EMOTE_KINDS.length);

          for (const kind of EMOTE_KINDS) {
            const swatch = q<HTMLButtonElement>(root, `show-emote-swatch-${kind}`);
            expect(swatch, kind).not.toBeNull();
            const icon = swatch?.querySelector<HTMLElement>(".emote-swatch-icon");
            // CSSOM 이 값을 정규화한다: "-0px 0" → "0px 0px". 기하값 자체를 같은 형식으로 비교한다.
            expect(icon?.style.backgroundPosition).toBe(`${-(emoteFrameIndex(kind) * 48)}px 0px`);
          }
        });

        it("선택 상태가 aria-checked 로 노출되고 클릭하면 명령이 그 이모트로 커밋된다", () => {
          const { root, replaced } = harness({ kind: "showEmote", target: { eventId: "" }, emote: "heart" });
          expect(q(root, "show-emote-swatch-heart")?.getAttribute("aria-checked")).toBe("true");
          expect(q(root, "show-emote-swatch-music")?.getAttribute("aria-checked")).toBe("false");

          q<HTMLButtonElement>(root, "show-emote-swatch-music")?.click();

          expect(replaced.at(-1)).toMatchObject({ kind: "showEmote", emote: "music" });
          expect(q(root, "show-emote-swatch-music")?.getAttribute("aria-checked")).toBe("true");
          expect(q(root, "show-emote-swatch-heart")?.getAttribute("aria-checked")).toBe("false");
        });

        it("대상 전환: 주인공을 고르면 이벤트 칸이 숨고 target 이 player 로 커밋된다", () => {
          const { root, replaced } = harness({ kind: "showEmote", target: { eventId: "" }, emote: "heart" });
          const select = q<HTMLSelectElement>(root, "show-emote-target-kind-select");
          expect(select).not.toBeNull();
          expect((q(root, "show-emote-event-field") as HTMLElement).hidden).toBe(true);
          expect(getComputedStyle(q(root, "show-emote-event-field") as HTMLElement).display).toBe("none");

          select!.value = "player";
          select!.dispatchEvent(new Event("change"));

          expect(replaced.at(-1)).toMatchObject({ target: "player" });
          expect((q(root, "show-emote-event-field") as HTMLElement).hidden).toBe(true);
          expect(getComputedStyle(q(root, "show-emote-event-field") as HTMLElement).display).toBe("none");

          select!.value = "event";
          select!.dispatchEvent(new Event("change"));
          expect((q(root, "show-emote-event-field") as HTMLElement).hidden).toBe(false);
          expect(getComputedStyle(q(root, "show-emote-event-field") as HTMLElement).display).not.toBe("none");
        });

        it("표시 시간은 상한으로 잘려서 커밋된다", () => {
          const { root, replaced } = harness({ kind: "showEmote", target: "player", emote: "heart" });
          const duration = q<HTMLInputElement>(root, "show-emote-duration-input");
          expect(duration).not.toBeNull();

          duration!.value = "999999";
          duration!.dispatchEvent(new Event("change"));

          expect(replaced.at(-1)).toMatchObject({ durationMs: EMOTE_MAX_DURATION_MS });
        });
      });
    });
    describe("unsupportedMidiAuthoring", () => {
      isolateTimers();
      const MIDI = "easyrpg-music-battle-1";
      const WAV = "cc0-music-field-loop";
      function node<T extends HTMLElement>(id: string): T {
        const result = document.querySelector<T>(`[data-testid="${id}"]`);
        if (!result) throw new Error(`Missing ${id}`);
        return result;
      }
      function choose(id: string, value: string): void {
        const select = node<HTMLSelectElement>(id);
        select.value = value;
        select.dispatchEvent(new Event("change"));
      }
      beforeEach(() => {
        store.replace(createBlankProject());
        editorState.set({ currentMapId: store.getCurrent().startMapId });
      });
      afterEach(() => {
        // Close through the real dialog lifecycle to dispose modal/store subscriptions.
        for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-testid$="-cancel"]')) button.click();
        document.body.replaceChildren();
        vi.restoreAllMocks();
      });
      describe("unsupported MIDI authoring", () => {
        it("disables MIDI candidates in the shared picker but assigns supported audio", () => {
          const confirm = vi.fn();
          openDatabaseResourcePickerDialog({ kind: "music", title: "BGM", onConfirm: confirm });
          expect(node<HTMLButtonElement>(`db-resource-picker-option-${MIDI}`).disabled).toBe(true);
          node<HTMLButtonElement>(`db-resource-picker-option-${WAV}`).click();
          expect(node<HTMLButtonElement>("db-resource-picker-ok").disabled).toBe(false);
          node<HTMLButtonElement>("db-resource-picker-ok").click();
          expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ resourceId: WAV }));
        });

        it("keeps a legacy selection inspectable without confirming or rewriting it", () => {
          const confirm = vi.fn();
          openDatabaseResourcePickerDialog({ kind: "music", title: "BGM", currentId: MIDI, onConfirm: confirm });
          expect(node("db-resource-picker-preview").textContent).toContain(MIDI);
          expect(node<HTMLButtonElement>("db-resource-picker-audio-play").disabled).toBe(true);
          expect(node<HTMLButtonElement>("db-resource-picker-audio-stop").disabled).toBe(true);
          expect(node("db-resource-picker-audio-transport").dataset.state).toBe("unavailable");
          expect(node("db-resource-picker-preview").querySelector("audio")).toBeNull();
          expect(node<HTMLButtonElement>("db-resource-picker-ok").disabled).toBe(true);
          node<HTMLButtonElement>("db-resource-picker-ok").click();
          expect(confirm).not.toHaveBeenCalled();
        });

        it("guards the confirmation callback even for a synthetic activation", () => {
          const confirm = vi.fn();
          openDatabaseResourcePickerDialog({ kind: "music", title: "BGM", currentId: MIDI, onConfirm: confirm });
          node("db-resource-picker-ok").dispatchEvent(new Event("click"));
          expect(confirm).not.toHaveBeenCalled();
        });

        it.each(["music", "sound"] as const)("blocks the shared %s text-input application path", kind => {
          const change = vi.fn();
          document.body.append(resourcePickerControl({ label: "Audio", resourceId: WAV, kind, testid: "audio-field", onChange: change, rerender: () => {} }));
          const input = node<HTMLInputElement>("audio-field");
          input.value = MIDI;
          input.dispatchEvent(new Event("input"));
          input.dispatchEvent(new Event("change"));
          expect(change).not.toHaveBeenCalled();
          expect(input.value).toBe(WAV);
          input.value = "cc0-sound-ui-confirm";
          input.dispatchEvent(new Event("change"));
          expect(change).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "cc0-sound-ui-confirm" }));
        });

        for (const currentId of ["", MIDI]) {
          it.each(["native", "m2"] as const)(`blocks new MIDI in %s dropdowns while preserving current ${currentId || "empty"}`, surface => {
            const replace = vi.fn();
            const body = surface === "native"
              ? playAudioBodyForTest(audioCommandContext(replace), { kind: "playAudio", resourceId: currentId, loop: true })
              : renderM2CommandBody(audioCommandContext(replace), { kind: "m2Command", commandId: "m2-027-change-system-bgm", fields: { resourceId: currentId, volume: 100 } });
            if (!body) throw new Error("Missing command body");
            document.body.append(body);
            const id = surface === "native" ? "play-audio-resource-select" : "m2-command-resourceId-picker";
            const select = node<HTMLSelectElement>(id);
            expect(select.value).toBe(currentId);
            expect(replace).not.toHaveBeenCalled();
            expect([...select.options].find(option => option.value === MIDI)?.disabled).toBe(true);
            choose(id, MIDI);
            expect(replace).not.toHaveBeenCalled();
            expect(select.value).toBe(currentId);
            if (surface === "native") {
              const search = node<HTMLInputElement>("play-audio-search");
              search.value = "no-match-probe";
              search.dispatchEvent(new Event("input"));
              if (currentId) expect(select.selectedOptions[0]?.disabled).toBe(true);
              search.value = "";
              search.dispatchEvent(new Event("input"));
            }
            choose(id, WAV);
            expect(replace).toHaveBeenLastCalledWith([0], expect.objectContaining(surface === "native"
              ? { resourceId: WAV } : { fields: expect.objectContaining({ resourceId: WAV }) }));
            choose(id, MIDI);
            expect(select.value).toBe(WAV);
            expect(replace).toHaveBeenCalledTimes(1);
          });
        }

        it("preserves legacy map BGM during inspection and assigns supported BGM through its picker", () => {
          const project = store.getCurrent();
          const map = project.maps[project.startMapId]!;
          map.bgm = { mode: "custom", resourceId: MIDI, fadeInMs: 700 };
          const host = document.createElement("div");
          document.body.append(host);
          renderMapProps(host);
          node<HTMLButtonElement>("map-bgm-resource-set").click();
          expect(node("map-bgm-resource-dialog-preview").textContent).toContain(MIDI);
          expect(node<HTMLButtonElement>("map-bgm-resource-dialog-ok").disabled).toBe(true);
          node<HTMLButtonElement>("map-bgm-resource-dialog-cancel").click();
          expect(store.getCurrent().maps[map.id]?.bgm).toEqual({ mode: "custom", resourceId: MIDI, fadeInMs: 700 });
          node<HTMLButtonElement>("map-bgm-resource-set").click();
          node<HTMLButtonElement>(`map-bgm-resource-dialog-option-${WAV}`).click();
          node<HTMLButtonElement>("map-bgm-resource-dialog-ok").click();
          expect(store.getCurrent().maps[map.id]?.bgm).toEqual({ mode: "custom", resourceId: WAV, fadeInMs: 700 });
        });
      });
    });
  });
});

describe("panelsEventEditorSuite2", () => {
  isolateTimers();
  // test/coordinateMoveCommandBody.test.ts — OPRN-OUT-013 저작 표면.
  //
  // 「좌표로 이동」 폼이 (1) 대상 세 종류를 정본 문자열로 커밋하고, (2) X·Y 를 각각 숫자/변수로
  // 전환하며 표준 변수 픽커를 쓰고, (3) 실패 정책·대체 목적지·결과 기록처를 저작하게 하고,
  // (4) 옛 고정 좌표 명령을 열어도 값과 저장 형태가 변하지 않는지를 실제 DOM 으로 잰다.
  describe("coordinateMoveCommandBody", () => {
    isolateTimers();
    const PATHFIND_ID = "m2-205-pathfind-move";
    type M2Command = Extract<Command, { kind: "m2Command" }>;
    function projectWithRecords(): Project {
      const project = createBlankProject();
      project.variables = [
        ...project.variables,
        { id: "var_x", name: "목표 X" },
        { id: "var_y", name: "목표 Y" },
        { id: "var_result", name: "이동 결과" },
      ];
      project.switches = [...project.switches, { id: "sw_arrived", name: "도착" }];
      const map = project.maps[project.startMapId]!;
      map.events = [
        { id: "ev_guard", x: 3, y: 4, trigger: { kind: "action" }, commands: [] },
      ];
      return project;
    }
    function harness(fields: M2CommandFields) {
      const initial: M2Command = { kind: "m2Command", commandId: PATHFIND_ID, fields };
      let current: M2Command = initial;
      const replaced: M2Command[] = [];
      const context = {
        path: [0],
        lockKind: true,
        getCurrentCommand: () => current,
        actions: {
          replaceCommand: (_path: readonly number[], command: Command) => {
            current = command as M2Command;
            replaced.push(current);
          },
          addCommand: () => {},
          removeCommand: () => {},
          moveCommand: () => {},
        },
      } as unknown as CommandEditContext;
      const root = renderCoordinateMoveCommandBody(context, initial);
      expect(root, "좌표 이동 전용 폼이 렌더되지 않았다").toBeTruthy();
      document.body.replaceChildren(root!);
      return { root: root!, replaced, latest: () => replaced.at(-1) };
    }
    const q = <T extends Element = HTMLElement>(root: ParentNode, testid: string): T | null =>
      root.querySelector<T>(`[data-testid="${testid}"]`);
    function setSelect(root: ParentNode, testid: string, value: string): void {
      const select = q<HTMLSelectElement>(root, testid);
      expect(select, testid).not.toBeNull();
      select!.value = value;
      select!.dispatchEvent(new Event("change"));
    }
    function setInput(root: ParentNode, testid: string, value: string): void {
      const input = q<HTMLInputElement>(root, testid);
      expect(input, testid).not.toBeNull();
      input!.value = value;
      input!.dispatchEvent(new Event("change"));
    }
    describe("좌표로 이동 — 저작 폼", () => {
      beforeEach(() => {
        store.replace(projectWithRecords());
      });

      it("카탈로그가 좌표 소스·실패 정책·대체·결과 필드를 선언한다", () => {
        const entry = m2CommandById(PATHFIND_ID)!;
        const keys = entry.fields.map((field) => field.key);
        expect(keys).toEqual(expect.arrayContaining([
          "target", "xSource", "x", "xVariableId", "ySource", "y", "yVariableId",
          "speed", "wait", "onFailure", "fallback", "resultVariableId", "resultSwitchId",
        ]));
        // 기본값은 옛 고정 좌표 동작과 같아야 한다.
        const byKey = new Map(entry.fields.map((field) => [field.key, field.defaultValue]));
        expect(byKey.get("xSource")).toBe("fixed");
        expect(byKey.get("ySource")).toBe("fixed");
        expect(byKey.get("onFailure")).toBe("continue");
        expect(byKey.get("fallback")).toBe("none");
      });

      it("옛 고정 좌표 명령을 열면 숫자 칸이 보이고 변수 칸은 숨는다", () => {
        const { root } = harness({ target: "this-event", x: 6, y: 4, speed: 4, wait: true });
        expect(q<HTMLSelectElement>(root, "coordinate-move-x-source")?.value).toBe("fixed");
        expect(q<HTMLInputElement>(root, "coordinate-move-x-input")?.value).toBe("6");
        expect(q<HTMLInputElement>(root, "coordinate-move-y-input")?.value).toBe("4");
        expect((q(root, "coordinate-move-x-variable-field") as HTMLElement).hidden).toBe(true);
        expect((q(root, "coordinate-move-x-number-field") as HTMLElement).hidden).toBe(false);
        // 대상이 「특정 이벤트」가 아니면 이벤트 검색 줄도 숨는다.
        expect((q(root, "coordinate-move-event-field") as HTMLElement).hidden).toBe(true);
      });

      it("폼을 열기만 해도 저장값이 바뀌지 않는다 — 옛 프로젝트를 여는 것이 편집이 되면 안 된다", () => {
        const { replaced } = harness({ target: "this-event", x: 6, y: 4, speed: 4, wait: true });
        expect(replaced).toEqual([]);
      });

      it.each([
        ["player", PLAYER_MOVE_TARGET],
        ["this-event", "this-event"],
      ])("대상 %s 를 정본 문자열로 커밋한다", (segment, stored) => {
        const { root, latest } = harness({ target: "this-event", x: 1, y: 1 });
        setSelect(root, "coordinate-move-target", segment);
        expect(latest()?.fields.target).toBe(stored);
      });

      it("「특정 이벤트」를 고르면 이 맵의 이벤트 목록에서 골라 id 가 커밋된다 (원시 id 입력 불필요)", () => {
        const { root, latest } = harness({ target: "this-event", x: 1, y: 1 });
        setSelect(root, "coordinate-move-target", "event");
        expect((q(root, "coordinate-move-event-field") as HTMLElement).hidden).toBe(false);
        // 이동 경로 설정과 같은 픽커다 — 목록 버튼과 옵션 testid 가 그 계약을 그대로 쓴다.
        q<HTMLButtonElement>(root, "move-route-event-picker-open")!.click();
        const option = q<HTMLButtonElement>(root, "move-route-event-option-ev_guard");
        expect(option, "이 맵의 이벤트가 목록에 없다").not.toBeNull();
        option!.click();
        expect(latest()?.fields.target).toBe("ev_guard");
      });

      it("X 를 변수로 바꾸면 표준 변수 픽커가 나타나고 숫자 칸이 숨는다", () => {
        const { root, latest } = harness({ target: "player", x: 6, y: 4 });
        setSelect(root, "coordinate-move-x-source", "variable");
        expect((q(root, "coordinate-move-x-variable-field") as HTMLElement).hidden).toBe(false);
        expect((q(root, "coordinate-move-x-number-field") as HTMLElement).hidden).toBe(true);
        expect(latest()?.fields.xSource).toBe("variable");
        // 표준 레코드 픽커의 숨은 select 를 통해 고른다 (e2e selectOption 과 같은 경로).
        const select = q(root, "coordinate-move-x-variable")!.querySelector("select")!;
        select.value = "var_x";
        select.dispatchEvent(new Event("change"));
        expect(latest()?.fields.xVariableId).toBe("var_x");
        // 고정 X 값은 지워지지 않는다 — 숫자로 되돌리면 원래 값이 살아 있어야 한다.
        expect(latest()?.fields.x).toBe(6);
      });

      it("X 는 변수, Y 는 숫자처럼 축마다 다르게 저작할 수 있다", () => {
        const { root, latest } = harness({ target: "player", x: 0, y: 0 });
        setSelect(root, "coordinate-move-x-source", "variable");
        const xSelect = q(root, "coordinate-move-x-variable")!.querySelector("select")!;
        xSelect.value = "var_x";
        xSelect.dispatchEvent(new Event("change"));
        setInput(root, "coordinate-move-y-input", "9");
        expect(latest()?.fields).toMatchObject({
          xSource: "variable", xVariableId: "var_x", ySource: "fixed", y: 9,
        });
      });

      it("실패 정책·대체 목적지·결과 기록처를 저작한다", () => {
        const { root, latest } = harness({ target: "player", x: 2, y: 2 });
        setSelect(root, "coordinate-move-failure", "stop");
        setSelect(root, "coordinate-move-fallback", "nearest");
        const variable = q(root, "coordinate-move-result-variable")!.querySelector("select")!;
        variable.value = "var_result";
        variable.dispatchEvent(new Event("change"));
        const sw = q(root, "coordinate-move-result-switch")!.querySelector("select")!;
        sw.value = "sw_arrived";
        sw.dispatchEvent(new Event("change"));
        expect(latest()?.fields).toMatchObject({
          onFailure: "stop", fallback: "nearest",
          resultVariableId: "var_result", resultSwitchId: "sw_arrived",
        });
      });

      it("속도는 1–8 로 묶이고 대기는 체크박스가 소유한다", () => {
        const { root, latest } = harness({ target: "player", x: 2, y: 2, speed: 4, wait: true });
        setInput(root, "coordinate-move-speed-input", "99");
        expect(latest()?.fields.speed).toBe(8);
        setInput(root, "coordinate-move-speed-input", "-3");
        expect(latest()?.fields.speed).toBe(1);
        expect(q(root, "coordinate-move-speed-input")?.getAttribute("max")).toBe("8");
        expect(root.textContent).toContain("속도(1–8)");
        const wait = q<HTMLInputElement>(root, "coordinate-move-wait-checkbox")!;
        wait.checked = false;
        wait.dispatchEvent(new Event("change"));
        expect(latest()?.fields.wait).toBe(false);
      });

      it("미리보기가 목적지·정책·결과 코드 표를 말한다 (색만으로 상태를 구분하지 않는다)", () => {
        const { root } = harness({
          target: "player", xSource: "variable", xVariableId: "var_x", y: 4,
          resultVariableId: "var_result", onFailure: "stop",
        });
        const preview = q(root, "coordinate-move-preview")!;
        expect(preview.textContent).toContain("주인공");
        expect(preview.textContent).toContain("목표 X");
        expect(preview.textContent).toContain("이벤트를 중단");
        expect(preview.textContent).toContain(`도착 ${movementResultCode("arrived")}`);
        expect(preview.textContent).toContain(`막힘 ${movementResultCode("blocked")}`);
      });

      it("변수를 골랐지만 정하지 않으면 미리보기가 경고한다", () => {
        const { root } = harness({ target: "player", xSource: "variable", xVariableId: "", y: 4 });
        expect(q(root, "coordinate-move-preview-warning")?.textContent).toContain("X");
      });

      it("대체를 끄면 미리보기가 (0,0) 으로 떨어지지 않는다고 명시한다", () => {
        const { root } = harness({ target: "player", x: 2, y: 2, fallback: "none" });
        expect(q(root, "coordinate-move-preview")?.textContent).toContain("(0,0)");
      });
    });
    describe("좌표로 이동 — 저작 시점 진단", () => {
      /** 이 명령 하나만 단 페이지 이벤트를 검사하고 이슈 코드만 돌린다. */
      function issuesFor(fields: M2CommandFields): readonly string[] {
        const project = projectWithRecords();
        store.replace(project);
        const mapId = project.startMapId;
        const event = {
          id: "probe", x: 1, y: 1, trigger: { kind: "action" as const }, commands: [],
          pages: [{
            id: "page-1", name: "검사", conditions: [], graphic: {},
            trigger: { kind: "action" as const }, priority: "below" as const,
            movement: { type: "fixed" as const, speed: 3, frequency: 3 },
            commands: [{ kind: "m2Command" as const, commandId: PATHFIND_ID, fields }],
          }],
        };
        project.maps[mapId]!.events = [...project.maps[mapId]!.events, event];
        return validateEventDraftBody(project, mapId, event).issues.map((issue) => issue.code);
      }

      it("고정 좌표가 맵 범위를 벗어나면 지금 잡는다", () => {
        expect(issuesFor({ target: "player", xSource: "fixed", x: 9999, ySource: "fixed", y: 0 }))
          .toContain("map.position.out-of-bounds");
      });

      it.each([
        ["소수", 2.5],
        ["음수", -1],
      ])("고정 좌표가 %s 면 런타임과 같은 이유로 반려한다", (_label, value) => {
        expect(issuesFor({ target: "player", xSource: "fixed", x: value, ySource: "fixed", y: 0 }))
          .toContain("m2.coordinate.fixed.invalid");
      });

      it("변수를 골랐는데 정하지 않으면 저작 시점에 잡는다", () => {
        expect(issuesFor({ target: "player", xSource: "variable", xVariableId: "", ySource: "fixed", y: 0 }))
          .toContain("m2.coordinate.variable.unselected");
      });

      it("없는 변수를 가리키면 참조 오류다", () => {
        expect(issuesFor({ target: "player", xSource: "variable", xVariableId: "var_missing", ySource: "fixed", y: 0 }))
          .toContain("reference.variable.missing");
      });

      it("한 축이라도 변수면 지도 범위를 단정하지 않는다 — 런타임 전에는 알 수 없다", () => {
        const codes = issuesFor({ target: "player", xSource: "variable", xVariableId: "var_x", ySource: "fixed", y: 0 });
        expect(codes).not.toContain("map.position.out-of-bounds");
        expect(codes).not.toContain("m2.coordinate.variable.unselected");
      });

      it("옛 고정 좌표 명령(새 키 없음)은 아무 진단도 새로 만들지 않는다", () => {
        expect(issuesFor({ target: "this-event", x: 3, y: 3, speed: 4, wait: true })).toEqual([]);
      });

      it("결과 기록처를 비워 두는 것은 정상이다 (기본이 안전)", () => {
        expect(issuesFor({ target: "player", x: 2, y: 2, resultVariableId: "", resultSwitchId: "" })).toEqual([]);
      });

      it("결과 기록처가 없는 레코드를 가리키면 잡는다", () => {
        expect(issuesFor({ target: "player", x: 2, y: 2, resultVariableId: "var_gone" }))
          .toContain("reference.variable.missing");
        expect(issuesFor({ target: "player", x: 2, y: 2, resultSwitchId: "sw_gone" }))
          .toContain("reference.switch.missing");
      });
    });
  });
  describe("editorIcons", () => {
    isolateTimers();
    describe("editorIcons", () => {
      it("아이콘은 22×22 스트로크 SVG 이고 기본은 장식(aria-hidden)이다", () => {
        const icon = renderEditorIcon("close");
        expect(icon.tagName.toLowerCase()).toBe("svg");
        expect(icon.getAttribute("viewBox")).toBe("0 0 22 22");
        expect(icon.getAttribute("aria-hidden")).toBe("true");
        expect(icon.classList.contains("ee-icon")).toBe(true);
        expect(icon.classList.contains("ee-icon-close")).toBe(true);
        expect(icon.querySelector("path, rect, circle")).not.toBeNull();
      });

      it("라벨을 주면 아이콘 혼자 뜻을 전한다(role=img)", () => {
        const icon = renderEditorIcon("trash", { label: "삭제" });
        expect(icon.getAttribute("role")).toBe("img");
        expect(icon.getAttribute("aria-label")).toBe("삭제");
        expect(icon.hasAttribute("aria-hidden")).toBe(false);
      });

      it("모든 이름이 비어 있지 않은 스펙을 가진다", () => {
        expect(EDITOR_ICON_NAMES.length).toBeGreaterThan(30);
        for (const name of EDITOR_ICON_NAMES) {
          expect(renderEditorIcon(name).querySelector("path, rect, circle"), name).not.toBeNull();
        }
      });

      it("명령 분류마다 아이콘 이름이 붙고 글리프 문자 대신 SVG 로 그려진다", () => {
        expect(commandCategoryVisual({ kind: "text", body: "" }).icon).toBe("chat");
        expect(commandCategoryVisual({ kind: "choices", options: [] }).icon).toBe("choice");
        expect(commandCategoryVisual({ kind: "fork", condition: { kind: "switch", switchId: "s", value: true }, then: [] }).icon).toBe("branch");
        expect(commandCategoryVisual({ kind: "transfer", mapId: "m", x: 0, y: 0 }).icon).toBe("route");
        expect(commandCategoryVisual({ kind: "shop", itemIds: [] }).icon).toBe("coin");
        const node = renderCategoryIcon(commandCategoryVisual({ kind: "text", body: "" }));
        expect(node.tagName.toLowerCase()).toBe("svg");
        expect(node.classList.contains("ee-icon-chat")).toBe(true);
        expect([pickerPageIcon(1), pickerPageIcon(2), pickerPageIcon(3), pickerPageIcon(4)]).toEqual(["chat", "party", "spark", "gear"]);
      });
    });
  });
  // 「AI 로 이벤트 고치기」의 실제 모달 통합 계약.
  //
  // 조수 창(도크)은 없고 맨 아래 한 줄 입력칸이 입구다(목업 v2). 진짜 편집기 모달을 열어, 전역 선택 페이지가 다른 이벤트를
  // 가리킬 때(A 를 최소화한 채 B 를 고른 뒤 A 로 돌아옴)도 입력칸이 초점을 받는지 고정한다.
  describe("eventAiAuthoringIntegration", () => {
    isolateTimers();
    const EVENT_A = "ev_ai_int_a";
    const EVENT_B = "ev_ai_int_b";
    function event(id: string, x: number, pageId: string): GameEvent {
      return {
        id,
        x,
        y: 5,
        trigger: { kind: "action" },
        commands: [],
        pages: [{
          id: pageId,
          name: "페이지",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ kind: "text", body: "안녕" }],
        }],
      };
    }
    function lineInput(): HTMLInputElement | null {
      return document.querySelector<HTMLInputElement>('[data-testid="event-edit-line-input"]');
    }
    describe("AI 이벤트 고치기 — 실제 모달 통합(한 줄 입력칸)", () => {
      let mapId: MapId;

      beforeEach(() => {
        _resetEventDraftVaultForTest();
        resetEventAiStagedForTest();
        resetEventEditLineForTest();
        const project = createBlankProject();
        mapId = project.startMapId;
        project.maps[mapId]!.events = [event(EVENT_A, 2, "page_a"), event(EVENT_B, 6, "page_b")];
        store.replace(project);
        editorState.set({ currentMapId: mapId, selectedEventId: EVENT_A, selectedEventPageId: "page_a" });
      });

      afterEach(() => {
        document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.remove();
        document.body.replaceChildren();
        _resetEventDraftVaultForTest();
        resetEventAiStagedForTest();
        resetEventEditLineForTest();
      });

      it("조수 입구로 새로 열면 한 줄 입력칸이 초점을 받는다", async () => {
        openEventEditorModal(mapId, EVENT_A, { aiDock: true });
        await Promise.resolve();
        expect(document.activeElement).toBe(lineInput());
        expect(document.querySelector('[data-testid="ai-event-assist"]')).toBeNull();
      });

      it("최소화된 편집기를 다른 이벤트 페이지가 선택된 채로 다시 열어도 입력칸이 초점을 받는다", async () => {
        openEventEditorModal(mapId, EVENT_A);
        document.querySelector<HTMLButtonElement>('[data-testid="event-editor-window-minimize"]')?.click();
        expect(document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.hidden).toBe(true);
        editorState.set({ selectedEventId: EVENT_B, selectedEventPageId: "page_b" });

        openEventEditorModal(mapId, EVENT_A, { aiDock: true });
        await Promise.resolve();
        expect(document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.hidden).toBe(false);
        expect(document.activeElement).toBe(lineInput());
      });

      it("이미 열려 있는 편집기를 다시 요청하면 입력칸이 초점을 받는다", async () => {
        openEventEditorModal(mapId, EVENT_A);
        (document.activeElement as HTMLElement | null)?.blur();
        openEventEditorModal(mapId, EVENT_A, { aiDock: true });
        await Promise.resolve();
        expect(document.activeElement).toBe(lineInput());
      });
    });
  });
  describe("eventAudioHandoffs", () => {
    isolateTimers();
    const FIELD = "cc0-bgm-rtp-fld-002";
    const BATTLE = "cc0-bgm-rtp-btl-002";
    const SE = "easyrpg-sound-decision1";
    const OTHER_SE = "easyrpg-sound-cancel1";
    const originalProject = store.getCurrent();
    function m2(title: string, fields: M2CommandFields = {}): Command {
      const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
      if (!entry) throw new Error(`Missing command: ${title}`);
      return { kind: "m2Command", commandId: entry.id, fields };
    }
    function setup(commands: Command[] = []) {
      const project = buildContractProject(commands);
      store.replaceProject(project);
      const session = startSession(project, 3);
      const dialogue = {
        showText: vi.fn(async () => undefined), showChoices: vi.fn(async () => 0),
        showNumberInput: vi.fn(async () => 0), hide: vi.fn(), close: vi.fn(),
      };
      // Only non-audio scene surfaces are stubbed; interpreter, scheduler, resolver and engine are real.
      const scene = {
        session, running: false, inputEnabled: true, lastActionTargetKey: "", tileY: 0,
        map: project.maps[project.startMapId],
        game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : undefined } },
        setInputEnabled: vi.fn(), refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
        showRuntimeOverlay: vi.fn(), clearRuntimeOverlay: vi.fn(),
      } as unknown as PlaySceneContext;
      return { project, session, scene };
    }
    function audioElements(): HTMLAudioElement[] {
      return [...document.querySelectorAll<HTMLAudioElement>("audio[data-oprn-audio]")];
    }
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
      const engine = getAudioEngine();
      engine.stopAll();
      engine.unlock();
      engine.setFadeInMs(600);
      engine.setVolume("bgm", 0.7);
      engine.setVolume("se", 0.8);
    });
    afterEach(() => {
      getAudioEngine().stopAll();
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.restoreAllMocks();
      document.body.replaceChildren();
      localStorage.clear();
      store.replaceProject(originalProject);
    });
    describe("U14 actual audio handoffs", () => {
      it.each(["blocking", "parallel"] as const)("delivers ambient gain and explicit zero fade through %s execution", async (path) => {
        const { scene, session } = setup();
        const command = m2("Sound Layer", { channel: "ambient", resourceId: FIELD, volume: 25, fadeMs: 0 });
        if (path === "blocking") await runCommands(scene, [command]);
        else applyNonBlockingStep(scene, createInterpreter([command], session).start());
        const audio = audioElements();
        expect(audio).toHaveLength(1);
        expect(audio[0]?.loop).toBe(true);
        expect(audio[0]?.volume).toBeCloseTo(0.7 * 0.25);
        expect(getAudioEngine().getFadeInMs()).toBe(0);
        expect(session.audio.ambient?.resourceId).toBe(FIELD);
        expect(session.audio.bgm).toBeUndefined();
      });

      it("keeps per-track gain when the group volume changes and the same track is requested again", async () => {
        const { scene } = setup();
        await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: 25, fadeMs: 0 })]);
        getAudioEngine().setVolume("bgm", 0.4);
        expect(audioElements()[0]?.volume).toBeCloseTo(0.1);
        await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: 50, fadeMs: 0 })]);
        expect(audioElements()).toHaveLength(1);
        expect(audioElements()[0]?.volume).toBeCloseTo(0.2);
      });

      it.each(["command", "map"] as const)("resets omitted gain on the same track through %s and keeps save/resume consistent", async (path) => {
        const { scene, session, project } = setup();
        await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: 25, fadeMs: 0 })]);
        const element = audioElements()[0];
        expect(element?.volume).toBeCloseTo(0.175);

        if (path === "command") await runCommands(scene, [{ kind: "playAudio", resourceId: FIELD, loop: true }]);
        else {
          project.system.defaultBgmResourceId = FIELD;
          startMapBgm(project, session, project.startMapId);
        }

        expect(audioElements()).toEqual([element]);
        expect(element?.volume).toBeCloseTo(0.7);
        expect(session.audio.bgm).toEqual({ resourceId: FIELD, loop: true });
        saveToSlot(localStorage, 1, createSaveSnapshot(project, session));
        const saved = readSaveSlot(localStorage, 1);
        if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
        const restored = applySaveSnapshot(project, saved.snapshot);
        getAudioEngine().stopAll();
        resumeAudioState(restored.audio, project, { fadeInMs: 0 });
        expect(audioElements()[0]?.volume).toBeCloseTo(0.7);
      });

      it.each([
        { volume: 0.25, sameTrack: false }, { volume: 0, sameTrack: false },
        { volume: 0.25, sameTrack: true }, { volume: 0, sameTrack: true },
      ])("restores field gain $volume after battle (same track: $sameTrack)", async ({ volume, sameTrack }) => {
        const { scene, session, project } = setup();
        project.system.battleBgmResourceId = sameTrack ? FIELD : BATTLE;
        await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: volume * 100, fadeMs: 0 })]);
        const before = { ...session.audio.bgm };
        const saved = enterBattleAudio(project, session);
        expect(audioElements().at(-1)?.volume).toBeCloseTo(sameTrack ? volume * 0.7 : 0.7);

        exitBattleAudio(project, session, saved);

        expect(session.audio.bgm).toEqual(before);
        expect(audioElements().at(-1)?.volume).toBeCloseTo(volume * 0.7);
      });

      it("preserves an explicit field loop flag through a battle handoff", () => {
        const { session, project } = setup();
        session.audio.bgm = { resourceId: FIELD, loop: false, volume: 25 };
        const saved = enterBattleAudio(project, session);
        const play = vi.spyOn(getAudioEngine(), "play");
        exitBattleAudio(project, session, saved);
        expect(session.audio.bgm).toEqual({ resourceId: FIELD, loop: false, volume: 25 });
        expect(play.mock.calls.at(-1)?.[0]).toBe("bgm");
        expect(play.mock.calls.at(-1)?.[3]).toBe(false);
      });

      it.each(["me", "se"] as const)("plays %s once with its own gain without changing BGM", async (channel) => {
        const { scene, project } = setup();
        playAudioCommand({ resourceId: FIELD, loop: true }, project, { fadeInMs: 0 });
        const field = audioElements()[0];
        await runCommands(scene, [m2("Sound Layer", { channel, resourceId: SE, volume: 50, fadeMs: 0 })]);
        expect(audioElements()[0]).toBe(field);
        expect(field?.volume).toBeCloseTo(0.7);
        expect(audioElements()[1]?.loop).toBe(false);
        expect(audioElements()[1]?.volume).toBeCloseTo((channel === "me" ? 0.7 : 0.8) * 0.5);
        getAudioEngine().setVolume(channel === "me" ? "bgm" : "se", 0.6);
        expect(audioElements()[1]?.volume).toBeCloseTo(0.3);
      });

      it("replays memorized BGM through the engine, not only the session record", async () => {
        const { scene } = setup();
        const play = vi.spyOn(getAudioEngine(), "play");
        await runCommands(scene, [
          { kind: "playAudio", resourceId: FIELD, loop: true }, m2("Memorize Current BGM"),
          { kind: "playAudio", resourceId: BATTLE, loop: true }, m2("Play Memorized BGM"),
        ]);
        expect(play.mock.calls.map(([channel, resource]) => [channel, resource])).toEqual([
          ["bgm", FIELD], ["bgm", BATTLE], ["bgm", FIELD],
        ]);
      });

      it("inserts the Fadeout BGM alias with its channel and preserves it through project export/import", () => {
        let selected: Command | undefined;
        openEventCommandPicker({ title: "Commands", context: "map", onSelect: (command) => { selected = command; } });
        const button = [...document.querySelectorAll<HTMLButtonElement>(".event-command-picker-command")]
          .find((candidate) => candidate.textContent?.includes("BGM 페이드아웃"));
        expect(button).toBeDefined();
        button?.click();
        expect(selected).toEqual({ kind: "stopAudio", channel: "bgm" });
        if (!selected) throw new Error("Picker did not insert a command");
        const project = buildContractProject([selected, { kind: "stopAudio" }]);
        const restored = deserialize(serialize(project));
        expect(restored.maps[restored.startMapId]?.events[0]?.commands).toEqual([selected, { kind: "stopAudio" }]);
      });

      it.each(["blocking", "parallel", "legacy"] as const)("stops only BGM through the %s path", async (path) => {
        const { scene, session } = setup();
        await runCommands(scene, [
          m2("Sound Layer", { channel: "bgm", resourceId: FIELD, fadeMs: 0 }),
          m2("Sound Layer", { channel: "ambient", resourceId: BATTLE, fadeMs: 0 }),
          m2("Sound Layer", { channel: "se", resourceId: SE }),
        ]);
        const stop = vi.spyOn(getAudioEngine(), "stopChannel");
        const stopAll = vi.spyOn(getAudioEngine(), "stopAll");
        if (path === "parallel") applyNonBlockingStep(scene, { kind: "stopAudio", channel: "bgm" });
        else await runCommands(scene, [path === "legacy" ? m2("Fadeout BGM") : { kind: "stopAudio", channel: "bgm" }]);
        expect(stop).toHaveBeenCalledWith("bgm");
        expect(stopAll).not.toHaveBeenCalled();
        expect(session.audio.bgm).toBeUndefined();
        expect(session.audio.ambient?.resourceId).toBe(BATTLE);
        expect(session.audio.se?.resourceId).toBe(SE);
      });

      it("persists system replacements through save-slot parsing and consumes them on map/battle entry", async () => {
        const { project, session, scene } = setup();
        await runCommands(scene, [m2("Change System BGM", { slot: "field", resourceId: FIELD }), m2("Change System BGM", { slot: "battle", resourceId: BATTLE })]);
        expect(saveToSlot(localStorage, 1, createSaveSnapshot(project, session)).ok).toBe(true);
        const saved = readSaveSlot(localStorage, 1);
        if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
        const restored = applySaveSnapshot(project, saved.snapshot);
        const play = vi.spyOn(getAudioEngine(), "play");
        startMapBgm(project, restored, project.startMapId);
        enterBattleAudio(project, restored);
        expect(play.mock.calls.map(([, resource]) => resource)).toEqual([FIELD, BATTLE]);
        expect(startSession(project, 3).m2Runtime).toBeUndefined();
      });

      it("restores authored battle music across both command formats without clearing the field slot", async () => {
        const { project, session, scene } = setup();
        project.system.battleBgmResourceId = FIELD;
        await runCommands(scene, [
          m2("Change System BGM", { slot: "field", resourceId: BATTLE }),
          m2("Change System BGM", { slot: "battle", value: BATTLE }),
          m2("Change System BGM", { cue: "battle", operation: "set", resourceId: BATTLE, volume: 42 }),
        ]);
        enterBattleAudio(project, session);
        expect(session.audio.bgm).toMatchObject({ resourceId: BATTLE, volume: 42 });

        await runCommands(scene, [m2("Change System BGM", { cue: "battle", operation: "reset" })]);
        enterBattleAudio(project, session);
        expect(session.audio.bgm).toEqual({ resourceId: FIELD, loop: true });
        startMapBgm(project, session, project.startMapId);
        expect(session.audio.bgm?.resourceId).toBe(BATTLE);

        await runCommands(scene, [
          m2("Change System BGM", { cue: "battle", operation: "set", resourceId: BATTLE, volume: 42 }),
          m2("Change System BGM", { slot: "battle", resourceId: "" }),
        ]);
        enterBattleAudio(project, session);
        expect(session.audio.bgm).toEqual({ resourceId: FIELD, loop: true });
      });

      it.each(["defeat", "escape"] as const)("plays the active %s sound and restores the authored sound in either format", async cue => {
        const { project, session, scene } = setup();
        project.system.seCues = { [cue]: SE };
        const play = vi.spyOn(getAudioEngine(), "play");
        const playResult = () => playBattleCue(cue, { project, session });
        const playedResources = () => play.mock.calls.filter(([channel]) => channel === "se").map(([, resource]) => resource);

        await runCommands(scene, [m2("Change System SE", { slot: cue, resourceId: OTHER_SE })]);
        playResult();
        expect(playedResources()).toEqual([OTHER_SE]);

        await runCommands(scene, [m2("Change System SE", { cue, operation: "set", resourceId: "", volume: 100 })]);
        playResult();
        expect(playedResources()).toEqual([OTHER_SE]);

        await runCommands(scene, [m2("Change System SE", { cue, operation: "reset" })]);
        playResult();
        expect(playedResources()).toEqual([OTHER_SE, SE]);

        await runCommands(scene, [
          m2("Change System SE", { cue, operation: "set", resourceId: OTHER_SE, volume: 42 }),
          m2("Change System SE", { slot: cue, resourceId: "" }),
        ]);
        playResult();
        expect(playedResources()).toEqual([OTHER_SE, SE, SE]);
      });

      it("keeps battle result overrides session-owned even with overlapping battle lifetimes", async () => {
        const first = setup();
        const second = setup();
        await runCommands(first.scene, [m2("Change System SE", { slot: "defeat", resourceId: SE })]);
        await runCommands(second.scene, [m2("Change System SE", { slot: "defeat", resourceId: OTHER_SE })]);
        const saved = enterBattleAudio(first.project, first.session);
        enterBattleAudio(second.project, second.session);
        exitBattleAudio(first.project, first.session, saved);
        const play = vi.spyOn(getAudioEngine(), "play");
        playAuthoredBattleResultCue(first.project, "defeat", first.session);
        playAuthoredBattleResultCue(second.project, "defeat", second.session);
        expect(play.mock.calls.map(([channel, resource]) => [channel, resource])).toEqual([["se", SE], ["se", OTHER_SE]]);
      });

      it("restores a layer's gain through save parsing and engine resume", async () => {
        const { project, session, scene } = setup();
        await runCommands(scene, [m2("Sound Layer", { channel: "ambient", resourceId: FIELD, volume: 30, fadeMs: 0 })]);
        saveToSlot(localStorage, 1, createSaveSnapshot(project, session));
        const saved = readSaveSlot(localStorage, 1);
        if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
        const restored = applySaveSnapshot(project, saved.snapshot);
        getAudioEngine().stopAll();
        resumeAudioState(restored.audio, project, { fadeInMs: 0 });
        expect(audioElements()[0]?.volume).toBeCloseTo(0.21);
      });
    });
  });
});
