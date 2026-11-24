// @vitest-environment happy-dom

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, CHARSET_SHEET_COLUMNS, CHARSET_SHEET_ROWS, charsetFrameSource } from "@/assets/easyrpgRtp";
import { createBlankProject } from "@/project/defaults";
import { charsetIconOf, facesetIconOf } from "@/editor/panels/eventEditor/recordPicker";
import { actorPicker, itemPicker, mapPicker, mapSelectElement } from "@/editor/panels/eventEditor/sharedPickers";
import { showEmoteBody } from "@/editor/panels/eventEditor/commandBodyPage3Native";
import { EMOTE_KINDS, EMOTE_MAX_DURATION_MS, emoteFrameIndex } from "@/project/emotes";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { openDatabaseResourcePickerDialog, resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { playAudioBodyForTest } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { renderMapProps } from "@/editor/panels/mapProps";
import { editorState } from "@/editor/editorState";
import { audioCommandContext } from "./support/audioSearchFixture";
import { isolateTimers } from "./mergedTeardown";

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
