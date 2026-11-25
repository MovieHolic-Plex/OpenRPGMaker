// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi, beforeAll } from "vitest";
import * as catalog from "@/assets/charsetCatalog";
import { renderNpcGraphicPicker } from "@/editor/panels/eventEditor/npcGraphicPicker";
import { editorEventMarkerTexture } from "@/editor/editSceneEventMarkers";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, Project, Command } from "@/project/types";
import { runTool } from "@/editor/tools/toolRunner";
import { prepareScriptCompiler } from "@/editor/script/compile";
import { scriptLineNodes } from "@/editor/panels/eventEditor/scriptLines";
import { CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, CHARSET_SHEET_COLUMNS, CHARSET_SHEET_ROWS, charsetFrameSource } from "@/assets/easyrpgRtp";
import { charsetIconOf, facesetIconOf } from "@/editor/panels/eventEditor/recordPicker";
import { actorPicker, itemPicker, mapPicker, mapSelectElement } from "@/editor/panels/eventEditor/sharedPickers";
import { showEmoteBody } from "@/editor/panels/eventEditor/commandBodyPage3Native";
import { EMOTE_KINDS, EMOTE_MAX_DURATION_MS, emoteFrameIndex } from "@/project/emotes";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { openDatabaseResourcePickerDialog, resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { playAudioBodyForTest } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { renderMapProps } from "@/editor/panels/mapProps";
import { editorState } from "@/editor/editorState";
import { audioCommandContext } from "./support/audioSearchFixture";
import { isolateTimers } from "./mergedTeardown";

describe("npcGraphicRecovery", () => {
  isolateTimers();
  const textureKey = 'tex_easyrpg_charset_people1';
  let mapId: string;
  const page = (): EventPage => store.getCurrent().maps[mapId]!.events[0]!.pages![0]!;
  const get = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
  function mount() {
    const close = vi.fn();
    document.body.replaceChildren(renderNpcGraphicPicker(mapId, 'resident', page(), close));
    return close;
  }
  function enter(id: string) {
    const input = get('event-graphic-direct-sprite-input') as HTMLInputElement;
    input.value = id;
    input.dispatchEvent(new Event('input'));
    return input;
  }
  beforeEach(() => {
    const project = createBlankProject();
    mapId = project.startMapId;
    project.characters = { resident: { displayName: 'Existing resident' } };
    project.maps[mapId]!.events = [{ id: 'resident', characterId: 'resident', x: 2, y: 2,
      trigger: { kind: 'action' }, commands: [], pages: [{ id: 'page', name: 'Existing dialogue',
        graphic: { sprite: { type: 'bundled', id: textureKey }, opacity: 180 },
        conditions: [], trigger: { kind: 'action' }, priority: 'same',
        movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [{ kind: 'text', body: 'Keep my dialogue' }],
      }] }];
    store.replace(project);
  });
  afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
  describe('character asset recovery', () => {
    it('retains an unavailable request and data, then accepts a manual choice', () => {
      const close = mount();
      const before = structuredClone(store.getCurrent());
      const input = enter('unknown-character');
      get('event-graphic-confirm').click();
      expect(close).not.toHaveBeenCalled();
      expect(store.getCurrent()).toEqual(before);
      expect(input.value).toBe('unknown-character');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(get('event-graphic-recovery').dataset.code).toBe('graphic-not-found');
      get(`event-graphic-resource-${textureKey}`).click();
      get('npc-character-slot-3').click();
      get('event-graphic-confirm').click();
      expect(close).toHaveBeenCalledOnce();
      expect(page().graphic.sprite?.id).toBe(textureKey);
      expect(page().commands).toEqual(before.maps[mapId]!.events[0]!.pages![0]!.commands);
      expect(store.getCurrent().characters).toEqual(before.characters);
    });

    it('cancels a failed selection without any project write', () => {
      const close = mount();
      const before = structuredClone(store.getCurrent());
      enter('unknown-character');
      get('event-graphic-confirm').click();
      get('event-graphic-cancel').click();
      expect(close).toHaveBeenCalledOnce();
      expect(store.getCurrent()).toEqual(before);
    });

    it('offers explicit no-image recovery in an empty catalog without crashing or assigning an ID', () => {
      vi.spyOn(catalog, 'projectCharsetAssets').mockReturnValue([]);
      const before = structuredClone(store.getCurrent());
      const close = mount();
      expect(store.getCurrent()).toEqual(before);
      expect(get('event-graphic-recovery').dataset.code).toBe('graphic-not-found');
      get('event-graphic-placeholder').click();
      expect(close).toHaveBeenCalledOnce();
      expect(page().graphic.sprite).toBeUndefined();
      expect(page().graphic.transparent).toBeUndefined();
      expect(editorEventMarkerTexture(store.getCurrent(), page().graphic)).toBeNull();
      expect(page().commands).toEqual(before.maps[mapId]!.events[0]!.pages![0]!.commands);
    });

    it.each([undefined, false, true])('preserves authored transparency %s through no-image and manual recovery', (transparent) => {
      if (transparent !== undefined) page().graphic.transparent = transparent;
      const before = structuredClone(store.getCurrent());
      const close = mount();
      get('event-graphic-placeholder').click();
      expect(close).toHaveBeenCalledOnce();
      expect(page().graphic.sprite).toBeUndefined();
      expect(editorEventMarkerTexture(store.getCurrent(), page().graphic)).toBeNull();

      const expectedPlaceholder = { ...before.maps[mapId]!.events[0]!.pages![0]!.graphic };
      delete expectedPlaceholder.sprite;
      expect(page().graphic).toEqual(expectedPlaceholder);
      const reopenedClose = mount();
      get(`event-graphic-resource-${textureKey}`).click();
      get('npc-character-slot-3').click();
      get('event-graphic-confirm').click();
      expect(reopenedClose).toHaveBeenCalledOnce();
      expect(page().graphic.sprite?.id).toBe(textureKey);
      expect(page().graphic.transparent).toBe(transparent);
      const marker = editorEventMarkerTexture(store.getCurrent(), page().graphic);
      if (transparent === true) expect(marker).toBeNull();
      else expect(marker).not.toBeNull();
      const originalPage = before.maps[mapId]!.events[0]!.pages![0]!;
      expect({ ...page(), graphic: originalPage.graphic }).toEqual(originalPage);
      expect(store.getCurrent().characters).toEqual(before.characters);
    });

    it('does not commit a removed upload from an already-open picker', () => {
      store.getCurrent().assets.uploaded.custom = { id: 'custom', kind: 'charset', name: 'Custom', dataUrl: 'data:image/png;base64,AA==' };
      const close = mount();
      get('event-graphic-resource-custom').click();
      delete store.getCurrent().assets.uploaded.custom;
      const before = structuredClone(store.getCurrent());
      get('event-graphic-confirm').click();
      expect(close).not.toHaveBeenCalled();
      expect(store.getCurrent()).toEqual(before);
    });

    it('rejects an unmatched query instead of substituting a villager, and still accepts explicit retry and transparency', () => {
      // 2026-09-27: 검색어 미매칭은 다시 거절이다 — 대체+경고는 조수가 무시해 엉뚱한 그림이 저장됐다.
      const ctx = { project: store.getCurrent() };
      const args = { mapId, id: 'new-resident', x: 3, y: 3, name: 'Requested resident', pages: [{ text: 'Keep this request' }] };
      const result = runTool(ctx, 'place_npc', { ...args, graphic: { query: 'old woman monster' } });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe('graphic-not-found');
      expect(ctx.project.maps[mapId]?.events.find((event) => event.id === 'new-resident')).toBeUndefined();
      const retry = runTool(ctx, 'place_npc', { ...args, graphic: { textureKey, characterIndex: 1 } });
      expect(retry.ok, retry.summary).toBe(true);
      const transparent = runTool(ctx, 'place_npc', { ...args, id: 'transparent-resident', graphic: { transparent: true } });
      expect(transparent.ok, transparent.summary).toBe(true);
    });
  });
});

// test/scriptLines.test.ts — a script command reads like event lines in the event list
// (src/editor/panels/eventEditor/scriptLines.ts): exact command lines when the script converts, one plain line per
// statement (「조건 분기」 · 「계산: …」) when it does not.
describe("scriptLines", () => {
  isolateTimers();
  beforeAll(async () => {
    await prepareScriptCompiler();
  }, 60_000);
  function project(): Project {
    const p = createBlankProject();
    p.switches.push({ id: "sw_gate", name: "창고 문 열림" } as Project["switches"][number]);
    p.variables.push({ id: "var_rep", name: "평판" } as Project["variables"][number]);
    p.variables.push({ id: "var_price", name: "포션 값" } as Project["variables"][number]);
    return p;
  }
  const text = (nodes: readonly HTMLElement[]): string[] => nodes.map((node) => (node.textContent ?? "").replace(/\s+/gu, " ").trim());
  describe("scriptLineNodes", () => {
    it("shows the converted commands' own lines when the script converts exactly", () => {
      const lines = text(scriptLineNodes({ source: 'if (game.getSwitch("sw_gate")) {\n  await game.showMessage("열렸다.");\n}' }, project()));
      expect(lines.length).toBeGreaterThanOrEqual(3);
      // names come from the open project (store); this test project is not loaded there, so the id shows
      expect(lines.some((line) => line.includes("조건 분기") && (line.includes("창고 문 열림") || line.includes("sw_gate")))).toBe(true);
      expect(lines.some((line) => line.includes("열렸다."))).toBe(true);
    });

    it("falls back to one plain line per statement: named values, conditions as sentences", () => {
      const source = [
        "const BASE = 100;",
        'const price = Math.floor(BASE * (1 - game.getVar("var_rep") / 200));',
        'game.setVar("var_price", price);',
        'if (game.getVar("var_rep") >= 10) await game.showMessage("단골이네!");',
      ].join("\n");
      const lines = text(scriptLineNodes({ source }, project()));
      expect(lines.some((line) => line.includes("가격 정하기 — 내림(100 × (1 − 평판 ÷ 200))"))).toBe(true);
      expect(lines.some((line) => line.includes("평판이 10 이상이면"))).toBe(true);
      expect(lines.some((line) => line.includes("단골이네!"))).toBe(true);
    });

    it("keeps else-if flat, says 그러면/아니면, folds three code lines and renders headings and «» chips", () => {
      const source = [
        "// 확인",
        'if (game.getSwitch("sw_gate")) {',
        '  await game.showMessage("열려 있다.");',
        '} else if (game.getVar("var_rep") > 5) {',
        "  const qa = game.random(3);",
        "  const qb = qa * 2;",
        "  const qc = qb + qa;",
        '  game.setVar("var_price", qc);',
        "} else {",
        "  const price = 10;",
        "  await game.showMessage(`${price + game.getVar(\"var_rep\")}골드.`);",
        "}",
      ].join("\n");
      const nodes = scriptLineNodes({ source }, project());
      const lines = text(nodes);
      expect(lines[0]).toBe("확인");
      expect(nodes[0]?.dataset.testid).toBe("event-command-script-heading");
      expect(lines).toContain("스위치 「창고 문 열림」이 켜져 있으면");
      expect(lines).toContain("아니고 평판이 5보다 크면");
      expect(lines).toContain("아니면");
      expect(lines.some((line) => line.startsWith("계산 3줄"))).toBe(true);
      expect(nodes.some((node) => node.querySelector(".cmd-script-hole")?.textContent === "10 + 평판")).toBe(true);
      expect(lines.some((line) => line.includes("조건이 맞"))).toBe(false);
    });

    it("is empty for an empty script", () => {
      expect(scriptLineNodes({ source: "  " }, project())).toEqual([]);
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
