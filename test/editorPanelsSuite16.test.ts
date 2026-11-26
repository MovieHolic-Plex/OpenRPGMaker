import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { openCanvasInspectionPanel, type CanvasInspectionDeps } from "@/editor/panels/canvasInspectionPanel";
import { createBlankProject, TILE } from "@/project/defaults";
import { findByTestId, installFakeDom, renderWithFakeDom, FakeElement } from "./fakeDom";
import { resolveCharacterListThumbSource } from "@/editor/panels/characterListThumbnail";
import { listCharacterIdIndex } from "@/project/characterIdIndex";
import type { GameEvent, Project, MapId, ClusterRule, GameMap, TileGroupMetadata } from "@/project/types";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { Buffer } from "node:buffer";
import { prepareCinematicUpload } from "@/editor/cinematicMediaImport";
import { IMAGE_IMPORT_MAX_BYTES } from "@/editor/panels/resourceManagerImageImport";
import { mediaImportRuleFor } from "@/editor/panels/resourceManagerMediaImport";
import { store } from "@/project/store";
import { clusterAssistCopy, clusterRecoveryOffer, presentClusterRecovery, toggleClusterAssistMode } from "@/editor/clusterAssistRecovery";
import { makeTileBrushAssistPanel } from "@/editor/panels/tilePalettePreviewPanel";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { paintTilesBulk, type TilePaintRejection } from "@/editor/tileActions";
import { resetToastsForTest } from "@/util/toast";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { runTool } from "@/editor/tools/toolRunner";
import { mergeSurfaceRule } from "@/editor/panels/tilesetKnowledgeWorkspaceState";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
import { buildPaletteEntries, movePaletteIndex, paletteKeyAction } from "@/editor/panels/commandPalette";
import type { EditorCommand } from "@/editor/commandRegistry";
import { effectiveActorEquipment, transitionActorEquipment } from "@/project/equipmentRules";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { addEquipmentSlot, equipmentSlots, equipmentSlotLabel, equipmentSlotRemovalBlocker, renameEquipmentSlot, removeEquipmentSlot } from "@/project/equipmentSlots";
import { serialize, deserialize } from "@/project/io/serialize";
import { normalizeActorRecord } from "@/project/actorModel";
import { actorDerivedStats } from "@/battle/battleBattlers";
import { startSession } from "@/project/session";
import { changeActorEquipment } from "@/project/sessionActorCommands";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { createSaveSnapshot, saveToSlot, readSaveSlot, applySaveSnapshot, snapshotLoadBlocker, saveSlotKey } from "@/player/saveSlots";
import { isActorEquipmentRecord } from "@/player/saveSlotValidation";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { battlePanel } from "@/editor/panels/actorRecordBattlePanels";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import { el } from "@/util/dom";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { isolateTimers } from "./mergedTeardown";

describe("canvasInspectionPanel", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    document.querySelector('[data-testid="canvas-inspection-panel"]')?.remove();
    restoreDom?.();
    restoreDom = null;
  });
  describe("canvas inspection panel", () => {
    it("shows deterministic lint counts and can focus a located issue", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const focusIssue = vi.fn();
      const deps: CanvasInspectionDeps = {
        focusIssue,
        lint: () => [
          { code: "blocked-entry", mapId, message: "입구가 막혀 있습니다.", severity: "error", x: 4, y: 5 },
          { code: "map-size", mapId, message: "맵이 너무 큽니다.", severity: "warning" },
        ],
        openRegionTask: vi.fn(),
      };

      const panel = openCanvasInspectionPanel({ deps, mapId, project });

      expect(findByTestId(panel, "canvas-inspection-summary")?.textContent).toContain("문제 2개");
      expect(panel.querySelectorAll('[data-testid="canvas-inspection-item"]')).toHaveLength(2);
      findByTestId(panel, "canvas-inspection-focus-0")?.click();
      expect(focusIssue).toHaveBeenCalledWith({ mapId, x: 4, y: 5 });
    });

    it("sends a located issue to the bounded AI repair preview", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const openRegionTask = vi.fn();
      const deps: CanvasInspectionDeps = {
        focusIssue: vi.fn(),
        lint: () => [
          { code: "blocked-entry", mapId, message: "입구가 막혀 있습니다.", severity: "error", x: 4, y: 5 },
        ],
        openRegionTask,
      };

      const panel = openCanvasInspectionPanel({ deps, mapId, project });
      findByTestId(panel, "canvas-inspection-fix-0")?.click();

      expect(openRegionTask).toHaveBeenCalledWith(expect.objectContaining({
        autoRun: false,
        mapId,
        region: { x: 2, y: 3, width: 5, height: 5 },
      }));
      expect(openRegionTask.mock.calls[0]?.[0].initialInstruction).toContain("입구가 막혀 있습니다.");
    });

    it("shows a clean result when lint finds no issues", () => {
      const project = createBlankProject();
      const deps: CanvasInspectionDeps = {
        focusIssue: vi.fn(),
        lint: () => [],
        openRegionTask: vi.fn(),
      };

      const panel = openCanvasInspectionPanel({ deps, mapId: project.startMapId, project });

      expect(findByTestId(panel, "canvas-inspection-empty")?.textContent).toContain("문제를 찾지 못했습니다");
    });
  });
});

describe("characterListThumbnail", () => {
  isolateTimers();
  const CHARSET_ID = "tex_easyrpg_charset_people1";
  function entryFor(project: Project, characterId: string) {
    const entry = listCharacterIdIndex(project).find((item) => item.characterId === characterId);
    if (!entry) throw new Error(`missing entry ${characterId}`);
    return entry;
  }
  function withHostEvent(project: Project, event: GameEvent): Project {
    const mapId = project.startMapId;
    project.maps[mapId].events = [event];
    return project;
  }
  describe("resolveCharacterListThumbSource", () => {
    it("returns charset resource from first host's first non-transparent sprite page", () => {
      const project = createBlankProject();
      withHostEvent(project, {
        id: "ev_used",
        x: 1,
        y: 2,
        characterId: "char_used",
        pages: [
          {
            id: "p0",
            name: "투명",
            conditions: [],
            commands: [],
            graphic: { transparent: true, sprite: { type: "bundled", id: "tex_easyrpg_charset_actor1" } },
          },
          {
            id: "p1",
            name: "본체",
            conditions: [],
            commands: [],
            graphic: {
              sprite: { type: "bundled", id: CHARSET_ID },
              pattern: charsetFrameIndex({ characterIndex: 3, direction: "down", pattern: 1 }),
            },
          },
        ],
      });

      const source = resolveCharacterListThumbSource(project, entryFor(project, "char_used"));
      expect(source).toEqual({ resourceId: CHARSET_ID, characterIndex: 3 });
    });

    it("falls back to first sprite page when all sprites are transparent", () => {
      const project = createBlankProject();
      withHostEvent(project, {
        id: "ev_trans",
        x: 0,
        y: 0,
        characterId: "char_trans",
        pages: [
          {
            id: "p0",
            name: "투명만",
            conditions: [],
            commands: [],
            graphic: { transparent: true, sprite: { type: "bundled", id: CHARSET_ID } },
          },
        ],
      });

      const source = resolveCharacterListThumbSource(project, entryFor(project, "char_trans"));
      expect(source).toEqual({ resourceId: CHARSET_ID, characterIndex: 0 });
    });

    it("returns null for unused profiles (no hosts)", () => {
      const project = createBlankProject();
      project.characters = {
        char_idle: { displayName: "미사용" },
      };
      project.maps[project.startMapId].events = [];

      const source = resolveCharacterListThumbSource(project, entryFor(project, "char_idle"));
      expect(source).toBeNull();
    });

    it("returns null for orphan events without any charset graphic", () => {
      const project = createBlankProject();
      withHostEvent(project, {
        id: "ev_orphan",
        x: 2,
        y: 3,
        characterId: "char_orphan",
        pages: [{ id: "p1", name: "고아 NPC", conditions: [], commands: [] }],
      });

      const source = resolveCharacterListThumbSource(project, entryFor(project, "char_orphan"));
      expect(source).toBeNull();
    });

    it("uses hosts[0] only even when a later host has a graphic", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId].events = [
        {
          id: "ev_first",
          x: 0,
          y: 0,
          characterId: "char_multi",
          pages: [{ id: "p1", name: "빈", conditions: [], commands: [] }],
        },
        {
          id: "ev_second",
          x: 1,
          y: 1,
          characterId: "char_multi",
          pages: [
            {
              id: "p1",
              name: "스프라이트",
              conditions: [],
              commands: [],
              graphic: { sprite: { type: "bundled", id: CHARSET_ID } },
            },
          ],
        },
      ];

      const source = resolveCharacterListThumbSource(project, entryFor(project, "char_multi"));
      expect(source).toBeNull();
    });
  });
});

describe("cinematicMediaImport", () => {
  isolateTimers();
  type UploadKind = Parameters<typeof prepareCinematicUpload>[1];
  const readers: ControlledReader[] = [];
  const images: ControlledImage[] = [];
  const media: ControlledMedia[] = [];
  class ControlledReader {
    readyState = 0;
    result: string | ArrayBuffer | null = null;
    error: DOMException | null = null;
    blob!: Blob;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    constructor() { readers.push(this); }
    readAsDataURL(blob: Blob): void {
      this.blob = blob;
      this.readyState = 1;
    }
    complete(result: string | ArrayBuffer | null): void {
      this.result = result;
      this.readyState = 2;
      this.onload?.();
    }
    abort = vi.fn(() => {
      this.readyState = 2;
      this.onabort?.();
    });
  }
  class ControlledImage {
    src = "";
    naturalWidth = 320;
    naturalHeight = 240;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() { images.push(this); }
    removeAttribute(name: string): void {
      if (name === "src") this.src = "";
    }
  }
  class ControlledMedia {
    src = "";
    preload = "";
    muted = false;
    readyState = 0;
    duration = 3;
    videoWidth = 640;
    videoHeight = 360;
    onloadedmetadata: (() => void) | null = null;
    onloadeddata: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    load = vi.fn();
    pause = vi.fn();
    play = vi.fn();
    constructor(readonly tag: string) { media.push(this); }
    removeAttribute(name: string): void {
      if (name === "src") this.src = "";
    }
  }
  function fileFor(kind: UploadKind): File {
    if (kind === "image") return new File(["image bytes"], "scene.gif", { type: "image/gif" });
    if (kind === "video") return new File(["video bytes"], "scene.webm", { type: "video/webm" });
    return new File(["audio bytes"], "voice.ogg", { type: "audio/ogg" });
  }
  async function completeRead(): Promise<string> {
    const reader = readers.at(-1)!;
    const bytes = Buffer.from(await reader.blob.arrayBuffer());
    const dataUrl = `data:${reader.blob.type};base64,${bytes.toString("base64")}`;
    reader.complete(dataUrl);
    return dataUrl;
  }
  function completeDecode(kind: UploadKind): void {
    if (kind === "image") images.at(-1)!.onload?.();
    else {
      const target = media.at(-1)!;
      target.readyState = 2;
      target.onloadeddata?.();
    }
  }
  beforeEach(() => {
    vi.useFakeTimers();
    readers.length = 0;
    images.length = 0;
    media.length = 0;
    vi.stubGlobal("FileReader", ControlledReader);
    vi.stubGlobal("Image", ControlledImage);
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        if (tag !== "audio" && tag !== "video") throw new Error(`Unexpected native resource: ${tag}`);
        return new ControlledMedia(tag);
      },
    });
    // Preserve real store behavior; preparation must never access it.
    vi.spyOn(store, "getCurrent");
    vi.spyOn(store, "update");
  });
  afterEach(() => {
    try {
      expect(store.getCurrent).not.toHaveBeenCalled();
      expect(store.update).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
  describe("prepareCinematicUpload", () => {
    it.each(["png", "jpeg", "gif", "webp"])("preserves %s payload bytes without canvas conversion", async (format) => {
      const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
      const file = new File([bytes], `scene.${format}`, { type: `image/${format}` });
      const controller = new AbortController();
      const removeListener = vi.spyOn(controller.signal, "removeEventListener");
      const promise = prepareCinematicUpload(file, "image", controller.signal);
      const dataUrl = await completeRead();
      expect(images[0].src).toBe(dataUrl);
      completeDecode("image");
      const asset = await promise;
      expect(asset).toMatchObject({
        name: "scene",
        kind: "picture",
        dataUrl,
        meta: { width: 320, height: 240 },
      });
      expect(asset.id.startsWith("picture_img")).toBe(true);
      expect(Buffer.from(asset.dataUrl.split(",")[1], "base64")).toEqual(Buffer.from(bytes));
      expect(images[0].src).toBe("");
      expect(images[0].onload).toBeNull();
      expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
    });

    it.each([
      ["scene.gif", "", "image/gif"],
      ["scene.webp", "application/octet-stream", "image/webp"],
      ["scene.jpg", "image/jpg", "image/jpeg"],
    ])("canonicalizes the header for %s without changing bytes", async (name, type, mime) => {
      const promise = prepareCinematicUpload(new File(["original"], name, { type }), "image", new AbortController().signal);
      const dataUrl = await completeRead();
      completeDecode("image");
      expect((await promise).dataUrl).toBe(dataUrl);
      expect(dataUrl).toBe(`data:${mime};base64,${Buffer.from("original").toString("base64")}`);
    });

    it.each([
      ["video", "scene.webm", "video/webm"],
      ["video", "scene.mp4", "video/mp4"],
      ["video", "scene.m4v", "video/mp4"],
      ["video", "scene.ogv", "video/ogg"],
      ["audio", "voice.wav", "audio/wav"],
      ["audio", "voice.mp3", "audio/mpeg"],
      ["audio", "voice.ogg", "audio/ogg"],
    ] as const)("prepares %s %s after decodable data without playback", async (kind, name, mime) => {
      const promise = prepareCinematicUpload(new File(["payload"], name, { type: mime }), kind, new AbortController().signal);
      const dataUrl = await completeRead();
      const target = media[0];
      expect(target.tag).toBe(kind);
      target.readyState = 1;
      target.onloadedmetadata?.();
      expect(target.pause).not.toHaveBeenCalled();
      expect(target.src).toBe(dataUrl);
      completeDecode(kind);
      const asset = await promise;
      expect(asset.kind).toBe(kind === "video" ? "movie" : "sound");
      expect(asset.id.startsWith(kind === "video" ? "movie" : "se")).toBe(true);
      expect(asset.dataUrl).toBe(dataUrl);
      expect(asset.meta).toEqual(kind === "video" ? { width: 640, height: 360 } : {});
      expect(target.play).not.toHaveBeenCalled();
      expect(target.pause).toHaveBeenCalledOnce();
      expect(target.src).toBe("");
      expect(target.onloadeddata).toBeNull();
      expect(target.load).toHaveBeenCalledTimes(2);
    });

    it("accepts a decoded video whose duration is not yet known", async () => {
      const promise = prepareCinematicUpload(fileFor("video"), "video", new AbortController().signal);
      const accepted = expect(promise).resolves.toMatchObject({
        kind: "movie",
        meta: { width: 640, height: 360 },
      });
      await completeRead();
      media[0].duration = Number.POSITIVE_INFINITY;
      completeDecode("video");
      await accepted;
      expect(media[0].src).toBe("");
    });

    it.each(["image", "video", "audio"] as const)("rejects empty and oversized %s before reading", async (kind) => {
      const source = fileFor(kind);
      await expect(prepareCinematicUpload(new File([], source.name, { type: source.type }), kind, new AbortController().signal))
        .rejects.toBeInstanceOf(RangeError);
      const limit = kind === "image" ? IMAGE_IMPORT_MAX_BYTES : mediaImportRuleFor(kind === "video" ? "movie" : "sound")!.maxBytes;
      Object.defineProperty(source, "size", { value: limit + 1 });
      await expect(prepareCinematicUpload(source, kind, new AbortController().signal)).rejects.toBeInstanceOf(RangeError);
      expect(readers).toHaveLength(0);
    });

    it.each(["image", "video", "audio"] as const)("accepts the exact %s size boundary", async (kind) => {
      const source = fileFor(kind);
      const limit = kind === "image" ? IMAGE_IMPORT_MAX_BYTES : mediaImportRuleFor(kind === "video" ? "movie" : "sound")!.maxBytes;
      Object.defineProperty(source, "size", { value: limit });
      const controller = new AbortController();
      const promise = prepareCinematicUpload(source, kind, controller.signal);
      expect(readers).toHaveLength(1);
      const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
      controller.abort();
      await rejection;
    });

    it.each([
      ["image", "scene.svg", "image/svg+xml"],
      ["video", "scene.avi", "video/x-msvideo"],
      ["audio", "voice.mid", "audio/midi"],
      ["video", "scene.webm", "image/png"],
      ["audio", "voice.ogg", "video/ogg"],
    ] as const)("rejects unsupported %s format %s before reading", async (kind, name, type) => {
      await expect(prepareCinematicUpload(new File(["x"], name, { type }), kind, new AbortController().signal))
        .rejects.toBeInstanceOf(TypeError);
      expect(readers).toHaveLength(0);
    });

    it("propagates native read errors", async () => {
      const promise = prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal);
      const error = new DOMException("read failed", "NotReadableError");
      const rejection = expect(promise).rejects.toBe(error);
      readers[0].error = error;
      readers[0].readyState = 2;
      readers[0].onerror?.();
      await rejection;
      expect(readers[0].abort).not.toHaveBeenCalled();
      expect(readers[0].onerror).toBeNull();
      expect(images).toHaveLength(0);
    });

    it("propagates synchronous read failures and removes the deadline", async () => {
      const error = new Error("read failed");
      vi.spyOn(ControlledReader.prototype, "readAsDataURL").mockImplementationOnce(() => { throw error; });
      await expect(prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal)).rejects.toBe(error);
    });

    it.each([null, "", "data:image/gif;base64,", "data:text/plain;base64,eA=="])("rejects an unusable reader result", async (result) => {
      const promise = prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "NotReadableError" });
      readers[0].complete(result);
      await rejection;
      expect(images).toHaveLength(0);
    });

    it.each(["image", "video", "audio"] as const)("rejects %s decoder failures and releases native resources", async (kind) => {
      const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "EncodingError" });
      await completeRead();
      const target = kind === "image" ? images[0] : media[0];
      target.onerror?.();
      await rejection;
      expect(target.src).toBe("");
      expect(target.onerror).toBeNull();
    });

    it.each(["image", "video", "audio"] as const)("rejects invalid %s dimensions or duration", async (kind) => {
      const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "EncodingError" });
      await completeRead();
      if (kind === "image") images[0].naturalWidth = 0;
      else if (kind === "video") media[0].videoHeight = 0;
      else media[0].duration = Number.NaN;
      completeDecode(kind);
      await rejection;
    });

    it("rejects pre-aborted work without allocating native resources", async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(prepareCinematicUpload(fileFor("image"), "image", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
      expect(readers).toHaveLength(0);
    });

    it("aborts a pending reader and ignores its late completion", async () => {
      const controller = new AbortController();
      const promise = prepareCinematicUpload(fileFor("image"), "image", controller.signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
      controller.abort();
      await rejection;
      expect(readers[0].abort).toHaveBeenCalledOnce();
      readers[0].complete("data:image/gif;base64,eA==");
      expect(images).toHaveLength(0);
    });

    it.each(["image", "video", "audio"] as const)("cancels pending %s decoding", async (kind) => {
      const controller = new AbortController();
      const promise = prepareCinematicUpload(fileFor(kind), kind, controller.signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
      await completeRead();
      controller.abort();
      await rejection;
      expect((kind === "image" ? images[0] : media[0]).src).toBe("");
      completeDecode(kind);
    });

    it("rejects cancellation between the final native event and async return", async () => {
      const controller = new AbortController();
      const promise = prepareCinematicUpload(fileFor("video"), "video", controller.signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
      await completeRead();
      completeDecode("video");
      controller.abort();
      await rejection;
    });

    it.each(["read", "image", "video", "audio"] as const)("bounds stalled %s preparation without polling", async (stage) => {
      const kind = stage === "read" ? "image" : stage;
      const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "TimeoutError" });
      if (stage !== "read") await completeRead();
      vi.advanceTimersByTime(15_000);
      await rejection;
      if (stage === "read") expect(readers[0].abort).toHaveBeenCalledOnce();
      else expect((kind === "image" ? images[0] : media[0]).src).toBe("");
    });
  });
});

// OPRN-OUT-017 — 두 보조가 화면에서도 **서로 다른 계약**으로 보이는가, 그리고 거부가
// 조용한 무동작이 아니라 누를 수 있는 복구 행동을 내놓는가.
describe("clusterAssistUi", () => {
  isolateTimers();
  let restoreFakeDom: () => void;
  function seed(): MapId {
    const project = startOnRetiredCombinedTown(createBlankProject());
    const map = project.maps[project.startMapId];
    map.width = 8;
    map.height = 8;
    map.lowerTiles = Array(64).fill(TILE.GRASS);
    map.upperTiles = Array(64).fill(TILE.EMPTY);
    map.events = [];
    project.startPos = { x: 0, y: 7 };
    store.replace(project);
    resetMapEditHistory();
    return project.startMapId;
  }
  function renderAssist(mapId: MapId) {
    const project = store.getCurrent();
    const map = project.maps[mapId]!;
    const state = editorState.get();
    return renderWithFakeDom(() =>
      makeTileBrushAssistPanel({
        autoConnectMode: state.autoConnectMode,
        clusterAssistMode: state.clusterAssistMode,
        mapId,
        onSelectTile: () => {},
        rerender: () => {},
        selectedTile: 290,
        tileset: project.tilesets[map.tilesetId]!,
      })
    );
  }
  beforeEach(() => {
    restoreFakeDom = installFakeDom();
    resetToastsForTest();
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
    editorState.set({ autoConnectMode: false, clusterAssistMode: true });
  });
  afterEach(() => {
    resetToastsForTest();
    restoreFakeDom();
    editorState.set({ autoConnectMode: false, clusterAssistMode: true });
  });
  describe("이웃 연결과 구조 보조는 화면에서 따로 표현된다", () => {
    it("두 토글이 각자의 줄·testid·상태로 존재한다", () => {
      const mapId = seed();

      const panel = renderAssist(mapId);

      const neighbor = findByTestId(panel, "auto-connect-mode-toggle");
      const cluster = findByTestId(panel, "cluster-assist-mode-toggle");
      expect(neighbor).toBeTruthy();
      expect(cluster).toBeTruthy();
      expect(neighbor).not.toBe(cluster);
      // 이웃 연결 수동 + 구조 보조 켜짐 — 두 상태가 독립적으로 표시된다.
      expect(neighbor!.getAttribute("aria-pressed")).toBe("false");
      expect(cluster!.getAttribute("aria-pressed")).toBe("true");
    });

    it("이웃 연결 수동 설명이 구조물 짝 배치를 따로 가리킨다 — 하나가 둘을 끈다고 읽히지 않는다", () => {
      const mapId = seed();

      const title = findByTestId(renderAssist(mapId), "auto-connect-mode-toggle")!.getAttribute("title") ?? "";

      expect(title).toContain("지형 연결만");
      expect(title).toContain("구조 보조");
    });

    it("구조 보조 문구가 켜짐/꺼짐에서 서로 다른 계약을 말한다", () => {
      const on = clusterAssistCopy(true);
      const off = clusterAssistCopy(false);

      expect(on.chip).not.toBe(off.chip);
      expect(on.title).toContain("동반 칸까지");
      expect(off.title).toContain("고른 칸·레이어 하나만");
      // 정확 배치도 보호셀·남의 덧그림은 덮지 않는다는 사실이 문구에 남아야 한다.
      expect(off.title).toContain("보호셀");
    });

    it("구조 보조 토글은 이웃 연결 상태를 건드리지 않는다", () => {
      editorState.set({ autoConnectMode: true, clusterAssistMode: true });

      expect(toggleClusterAssistMode()).toBe(false);

      expect(editorState.get().clusterAssistMode).toBe(false);
      expect(editorState.get().autoConnectMode).toBe(true);
    });
  });
  describe("거부는 실행 가능한 복구 경로를 화면에 낸다", () => {
    it("경계 거부 토스트에 규칙 문장과 정확 배치 버튼이 함께 있고, 누르면 그 칸이 칠해진다", () => {
      const mapId = seed();
      const rejections: TilePaintRejection[] = [];
      paintTilesBulk(mapId, [{ layer: "lower", tile: 291, x: 4, y: 0 }], {
        autoConnect: false,
        onRejected: (rejection) => rejections.push(rejection),
      });
      expect(rejections).toHaveLength(1);

      presentClusterRecovery(clusterRecoveryOffer(mapId, rejections[0]!));

      const toastEl = document.querySelector<HTMLElement>('[data-testid="toast"]');
      expect(toastEl).toBeTruthy();
      expect(toastEl!.textContent).toContain("261");
      const button = document.querySelector<HTMLElement>('[data-testid="cluster-exact-place"]');
      expect(button).toBeTruthy();

      button!.click();

      const map = store.getCurrent().maps[mapId]!;
      expect(map.lowerTiles[0 * map.width + 4]).toBe(291);
    });

    it("복구 불가(보호셀 자체)일 때는 버튼 대신 다음에 할 일을 말한다", () => {
      const mapId = seed();
      store.update((project) => {
        project.startMapId = mapId;
        project.startPos = { x: 4, y: 4 };
      });
      const rejections: TilePaintRejection[] = [];
      paintTilesBulk(mapId, [{ layer: "lower", tile: 290, x: 4, y: 4 }], {
        autoConnect: false,
        exactPlacement: true,
        onRejected: (rejection) => rejections.push(rejection),
      });

      presentClusterRecovery(clusterRecoveryOffer(mapId, rejections[0]!));

      expect(document.querySelector('[data-testid="cluster-exact-place"]')).toBeNull();
      expect(document.querySelector<HTMLElement>('[data-testid="toast"]')!.textContent).toContain("먼저 그 칸을 비우거나");
    });
  });
});

describe("clusterRuleSurface", () => {
  isolateTimers();
  /**
   * 타일 그룹의 `surface` 규칙 — 「화덕은 북쪽 벽에 붙는다」의 타일 쪽 절반.
   * 구조물 킷 조건(structureKitPlacementConditions.test.ts)은 찍는 순간 차단하고,
   * 이쪽은 이미 찍힌 맵을 훑어 규칙 감사 패널에 올린다.
   */

  const MAP_ID = "map_surface_rules";
  const WALL = 300;
  const FLOOR = 400;
  const STOVE_TOP = 21;
  const STOVE_BOT = 51;
  function stoveGroup(rules: readonly ClusterRule[]): TileGroupMetadata {
    return {
      defaultLayer: "mixed",
      description: "화덕 오븐",
      id: "kitchen-stove",
      name: "화덕 오븐",
      patternGrammar: {
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 2,
        minWidth: 1,
        parts: [
          { role: "topCap", tileIds: [STOVE_TOP] },
          { role: "bottomCap", tileIds: [STOVE_BOT] },
        ],
        preserveCaps: true,
        repeat: "source_order",
      },
      placementRules: "부엌 북쪽 벽",
      role: "building",
      rules: [...rules],
      tileIds: [STOVE_TOP, STOVE_BOT],
    };
  }
  const NORTH_WALL_RULE: ClusterRule = {
    id: "r_interior_stove_north_wall",
    kind: "surface",
    message: "화덕은 북쪽 벽에 등을 대고 놓입니다.",
    params: { facing: "north", zone: "againstWall" },
    strength: "hard",
  };
  /** 8×6 방. y=1 행이 벽, 나머지는 바닥. */
  function projectWithStove(stoveOriginY: number): Project {
    const width = 8;
    const height = 6;
    const map: GameMap = {
      events: [],
      height,
      id: MAP_ID,
      lowerTiles: new Array<number>(width * height).fill(FLOOR),
      name: "주방",
      tileSize: 16,
      tilesetId: DEFAULT_TILESET_ID,
      upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
      width,
    };
    for (let x = 0; x < width; x += 1) map.lowerTiles[1 * width + x] = WALL;

    const project = createBlankProject();
    project.maps = { [MAP_ID]: map };
    project.mapTree = { mapId: MAP_ID, children: [] };
    project.startMapId = MAP_ID;
    project.startPos = { x: 0, y: 0 };
    const tileset = project.tilesets[DEFAULT_TILESET_ID]!;
    tileset.passability[WALL] = blockedFlag();
    tileset.passability[FLOOR] = passableFlag();
    tileset.priority[WALL] = "lower";
    tileset.priority[FLOOR] = "lower";
    // 화덕 자체는 통행 불가 — 검증기가 자기 발밑을 벽으로 오인하지 않는지 같이 본다.
    tileset.passability[STOVE_TOP] = blockedFlag();
    tileset.passability[STOVE_BOT] = blockedFlag();
    tileset.tileGroups = [stoveGroup([NORTH_WALL_RULE])];

    // 실내 파이프라인과 같은 방식으로 찍는다: 상단(21)은 **상위** 레이어에 벽면 위로 겹쳐 세우고,
    // 발밑(51)은 하위 레이어에 놓는다. 그래야 벽의 지형 타일이 남아 감사가 되돌려 볼 수 있다.
    map.upperTiles[stoveOriginY * width + 3] = STOVE_TOP;
    map.lowerTiles[(stoveOriginY + 1) * width + 3] = STOVE_BOT;
    return project;
  }
  describe("cluster-rule surface — 맵 감사", () => {
    it("벽 아래에 등을 댄 화덕은 위반이 아니다", () => {
      // 상단이 벽 행(y=1), 발밑이 y=2 바닥 → 발밑 위(y=1)가 벽.
      const violations = validateClusterRules(projectWithStove(1), MAP_ID);
      expect(violations.filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
    });

    it("방 가운데 떠 있는 화덕은 error 로 보고된다", () => {
      const violations = validateClusterRules(projectWithStove(3), MAP_ID);
      const surface = violations.filter((entry) => entry.rule.kind === "surface");
      expect(surface).toHaveLength(1);
      expect(surface[0]!.severity).toBe("error");
      expect(surface[0]!.code).toBe("cluster-rule:surface:kitchen-stove");
      // 규칙 감사 패널이 위치를 찍을 수 있어야 한다.
      expect(surface[0]!.coords.length).toBeGreaterThan(0);
    });

    it("지형까지 덮어 찍힌 세로쌍은 «판정 불가» 로 건너뛴다 — 벽을 지운 자리는 되볼 수 없다", () => {
      // 구조물 킷 스탬프는 두 줄을 모두 하위 레이어에 쓴다 → 상단이 앉았던 벽 타일이 사라진다.
      // 찍는 순간에는 검사를 통과했으므로, 나중에 되보고 위반이라 우기면 거짓 위반이다.
      const project = projectWithStove(1);
      const map = project.maps[MAP_ID]!;
      map.upperTiles[1 * map.width + 3] = TILE.EMPTY;
      map.lowerTiles[1 * map.width + 3] = STOVE_TOP;
      expect(validateClusterRules(project, MAP_ID).filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
    });

    it("params 가 망가진 규칙은 조용히 건너뛴다 — 거짓 위반을 만들지 않는다", () => {
      const project = projectWithStove(3);
      project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [
        stoveGroup([{ ...NORTH_WALL_RULE, params: { zone: "없는존" } }]),
      ];
      expect(validateClusterRules(project, MAP_ID).filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
    });
  });
  describe("set_cluster_rule — surface 규칙 편집", () => {
    it("zone·facing 을 받아 그룹에 저장한다", () => {
      const project = projectWithStove(1);
      project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [stoveGroup([])];
      const context = { project };
      const result = runTool(context, "set_cluster_rule", {
        tilesetId: DEFAULT_TILESET_ID,
        groupId: "kitchen-stove",
        rule: {
          id: "r_stove_surface",
          kind: "surface",
          strength: "hard",
          params: { zone: "againstWall", facing: "north" },
        },
      });
      expect(result.ok).toBe(true);
      const saved = context.project.tilesets[DEFAULT_TILESET_ID]!.tileGroups!
        .find((group) => group.id === "kitchen-stove")!.rules!
        .find((rule) => rule.kind === "surface");
      expect(saved?.params).toEqual({ facing: "north", zone: "againstWall" });
    });

    it("모르는 zone 은 거부한다 — 조용히 통과시키면 검사가 없는 것과 같아진다", () => {
      const project = projectWithStove(1);
      project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [stoveGroup([])];
      const result = runTool({ project }, "set_cluster_rule", {
        tilesetId: DEFAULT_TILESET_ID,
        groupId: "kitchen-stove",
        rule: { id: "r_bad", kind: "surface", strength: "hard", params: { zone: "북벽" } },
      });
      expect(result.ok).toBe(false);
      expect(result.summary + JSON.stringify(result.issues ?? [])).toContain("params.zone");
    });
  });
  describe("타일셋 지식 저장 — 배치 면 병합", () => {
    const adjacency: ClusterRule = {
      id: "r_interior_stove_v_pair",
      kind: "adjacency",
      params: { a: STOVE_TOP, b: STOVE_BOT, relation: "aAboveB" },
      strength: "hard",
    };

    it("«조건 없음» 은 surface 규칙만 지우고 다른 규칙은 남긴다", () => {
      const merged = mergeSurfaceRule([adjacency, NORTH_WALL_RULE], "kitchen-stove", {
        surfaceFacing: "any",
        surfaceStrength: "hard",
        surfaceZone: "none",
      });
      expect(merged).toEqual([adjacency]);
    });

    it("배치 면을 고르면 규칙이 생기고, 인접 규칙은 그대로 보존된다", () => {
      const merged = mergeSurfaceRule([adjacency], "kitchen-stove", {
        surfaceFacing: "north",
        surfaceStrength: "hard",
        surfaceZone: "againstWall",
      });
      expect(merged).toHaveLength(2);
      expect(merged[0]).toEqual(adjacency);
      expect(merged[1]).toMatchObject({
        id: "r_surface_kitchen-stove",
        kind: "surface",
        params: { facing: "north", zone: "againstWall" },
        strength: "hard",
      });
    });

    it("같은 그룹에 두 번 저장해도 surface 규칙은 하나만 남는다", () => {
      const once = mergeSurfaceRule([adjacency], "kitchen-stove", {
        surfaceFacing: "north",
        surfaceStrength: "hard",
        surfaceZone: "againstWall",
      });
      const twice = mergeSurfaceRule(once, "kitchen-stove", {
        surfaceFacing: "west",
        surfaceStrength: "soft",
        surfaceZone: "againstWall",
      });
      expect(twice.filter((rule) => rule.kind === "surface")).toHaveLength(1);
      expect(twice[1]).toMatchObject({ params: { facing: "west", zone: "againstWall" }, strength: "soft" });
    });

    it("방향은 againstWall 에서만 실린다 — 다른 면에 facing 을 남기면 읽는 쪽이 헷갈린다", () => {
      const merged = mergeSurfaceRule([], "g", {
        surfaceFacing: "north",
        surfaceStrength: "medium",
        surfaceZone: "wallFace",
      });
      expect(merged[0]!.params).toEqual({ zone: "wallFace" });
    });
  });
});

describe("commandPalette", () => {
  isolateTimers();
  function cmd(id: string, label: string): EditorCommand {
    return { id, label, category: "도구", keywords: [label], run: () => {} };
  }
  describe("buildPaletteEntries", () => {
    it("명령 → 맵 순으로 합치고 종류별 상한을 지킨다", () => {
      const commands = Array.from({ length: 10 }, (_, i) => cmd(`c${i}`, `명령${i}`));
      const maps = Array.from({ length: 10 }, (_, i) => cmd(`m${i}`, `맵${i}`));
      const entries = buildPaletteEntries("", { commands, maps });
      expect(entries.filter((e) => e.kind === "command")).toHaveLength(6);
      expect(entries.filter((e) => e.kind === "map")).toHaveLength(4);
      expect(entries[0]!.kind).toBe("command");
    });

    it("질의가 명령과 맵을 함께 거른다", () => {
      const entries = buildPaletteEntries("맵3", {
        commands: [cmd("c1", "명령1")],
        maps: [cmd("m3", "맵3"), cmd("m4", "맵4")],
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]!.id).toBe("m3");
    });
  });
  describe("movePaletteIndex", () => {
    it("순환 이동한다", () => {
      expect(movePaletteIndex(3, 0, 1)).toBe(1);
      expect(movePaletteIndex(3, 2, 1)).toBe(0);
      expect(movePaletteIndex(3, 0, -1)).toBe(2);
      expect(movePaletteIndex(0, 0, 1)).toBe(0);
    });
  });
  describe("paletteKeyAction", () => {
    it("조합 중 Enter·화살표는 명령을 실행하거나 선택을 옮기지 않는다", () => {
      expect(paletteKeyAction({ key: "Enter", isComposing: true })).toBe("ignore");
      expect(paletteKeyAction({ key: "Enter", keyCode: 229 })).toBe("ignore");
      expect(paletteKeyAction({ key: "Process", keyCode: 229 })).toBe("ignore");
      expect(paletteKeyAction({ key: "ArrowDown", isComposing: true })).toBe("ignore");
      expect(paletteKeyAction({ key: "ArrowUp", keyCode: 229 })).toBe("ignore");
      expect(paletteKeyAction({ key: "Unidentified" })).toBe("ignore");
    });

    it("조합이 끝난 Enter 는 실행이고 화살표는 이동이다", () => {
      expect(paletteKeyAction({ key: "Enter" })).toBe("run");
      expect(paletteKeyAction({ key: "ArrowDown" })).toBe("down");
      expect(paletteKeyAction({ key: "ArrowUp" })).toBe("up");
      expect(paletteKeyAction({ key: "Escape" })).toBe("ignore");
    });
  });
});

describe("customEquipmentSlots", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();
    get length() { return this.values.size; }
    clear() { this.values.clear(); }
    getItem(key: string) { return this.values.get(key) ?? null; }
    key(index: number) { return [...this.values.keys()][index] ?? null; }
    removeItem(key: string) { this.values.delete(key); }
    setItem(key: string, value: string) { this.values.set(key, value); }
  }
  function fixture() {
    const project = createBlankProject();
    const actor = project.database.actors[0]!;
    const slot = addEquipmentSlot(project, "Boots");
    const boots = normalizeEquipmentRecord({
      id: "equip_test_custom_boots", name: "Boots", slot: slot.id,
      statBonuses: { attack: 2, defense: 3, mind: 4, agility: 7 },
      equippableActorIds: [actor.id], iconResourceId: project.database.equipment[0]!.iconResourceId,
      effectFlags: { ...project.database.equipment[0]!.effectFlags, doubleAttack: true },
    });
    project.database.equipment.push(boots);
    return { project, actor, slot, boots };
  }
  function node(root: FakeElement, id: string): FakeElement {
    const found = findByTestId(root, id);
    if (!found) throw new Error(`Missing UI control: ${id}`);
    return found;
  }
  describe("project-authored equipment slots", () => {
    it("retains a real custom slot in the runtime equipment projection", () => {
      const project = createBlankProject();
      project.database.equipmentSlots = [{ id: "slot_boots", label: "Boots" }];
      const actor = project.database.actors[0]!;
      const boots = normalizeEquipmentRecord({ id: "equip_test_custom_boots", name: "Boots", slot: "slot_boots" });
      project.database.equipment.push(boots);
      expect(effectiveActorEquipment(project, actor, { slot_boots: boots.id }))
        .toEqual({ slot_boots: boots.id });
    });

    it("creates distinct stable IDs, renames in place, and removes only unused custom slots", () => {
      const { project, actor, slot, boots } = fixture();
      const second = addEquipmentSlot(project, "Boots");
      expect(second.id).not.toBe(slot.id);
      const order = equipmentSlots(project).map((entry) => entry.id);
      renameEquipmentSlot(project, slot.id, "Greaves");
      expect(equipmentSlotLabel(project, slot.id)).toBe("Greaves");
      expect(equipmentSlots(project).map((entry) => entry.id)).toEqual(order);
      expect(boots.slot).toBe(slot.id);
      expect(removeEquipmentSlot(project, slot.id)).toBe(false);
      expect(equipmentSlotRemovalBlocker(project, slot.id)).toBe("referenced");
      boots.slot = "accessory";
      actor.initialEquipment[slot.id] = boots.id;
      expect(removeEquipmentSlot(project, slot.id)).toBe(false);
      delete actor.initialEquipment[slot.id];
      project.commonEvents.push({ id: "ce_slot", name: "Slot", trigger: "call", commands: [{ kind: "loop", body: [
        { kind: "changeEquipment", actorId: actor.id, slot: slot.id, equipmentId: "" },
      ] }] } as typeof project.commonEvents[number]);
      expect(removeEquipmentSlot(project, slot.id)).toBe(false);
      project.commonEvents.pop();
      expect(removeEquipmentSlot(project, slot.id)).toBe(true);
      expect(removeEquipmentSlot(project, "weapon")).toBe(false);
      expect(() => addEquipmentSlot(project, " ")).toThrow();
      expect(() => renameEquipmentSlot(project, second.id, " ")).toThrow();
    });

    it("roundtrips initial equipment, equips through menu and event authority, derives stats, and saves/reloads", () => {
      const { project, actor, slot, boots } = fixture();
      actor.initialEquipment = { [slot.id]: boots.id };
      renameEquipmentSlot(project, slot.id, "Greaves");
      const loaded = deserialize(serialize(project));
      const loadedActor = loaded.database.actors.find((entry) => entry.id === actor.id)!;
      expect(loadedActor.initialEquipment).toEqual({ [slot.id]: boots.id });
      expect(loaded.database.equipment.find((entry) => entry.id === boots.id)).toEqual(boots);
      expect(equipmentSlotLabel(loaded, slot.id)).toBe("Greaves");
      const session = startSession(loaded);
      expect(session.actorEquipment[actor.id]).toEqual({ [slot.id]: boots.id });
      expect(changeActorEquipment(session, loaded, { kind: "changeEquipment", actorId: actor.id, slot: slot.id, equipmentId: "" }).kind).toBe("accepted");
      expect(session.inventory[boots.id]).toBe(1);
      const options = { project: loaded, session, selectedCommand: "equipment" as const, equipmentActorId: actor.id, slots: [], waitModeEnabled: false };
      const slots = createStatusMenuDetail(options);
      expect(slots.entries.find((entry) => entry.testId === `status-menu-equipment-slot-${slot.id}`)).toMatchObject({ label: "Greaves" });
      const detail = createStatusMenuDetail({ ...options, equipmentSlotId: slot.id,
        onEquipItem: (actorId, slotId, equipmentId) => {
          expect(changeActorEquipment(session, loaded, { kind: "changeEquipment", actorId, slot: slotId, equipmentId }).kind).toBe("accepted");
        },
      });
      const candidate = detail.entries.find((entry) => entry.testId === `status-menu-equipment-item-${boots.id}`);
      expect(candidate?.onActivate).toBeTypeOf("function");
      candidate!.onActivate!();
      expect(session.inventory[boots.id]).toBeUndefined();
      const normalized = normalizeActorRecord(loadedActor);
      const base = actorDerivedStats(loaded, normalized, { level: 1, equipment: {} });
      const equipped = actorDerivedStats(loaded, normalized, { level: 1, equipment: effectiveActorEquipment(loaded, loadedActor, session.actorEquipment[actor.id]) });
      expect(equipped.agility - base.agility).toBe(7);
      expect(equipped.attack - base.attack).toBe(2);
      expect(equipped.equipmentEffects.doubleAttack).toBe(true);
      const storage = new MemoryStorage();
      expect(saveToSlot(storage, 1, createSaveSnapshot(loaded, session)).ok).toBe(true);
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("Save did not roundtrip");
      expect(snapshotLoadBlocker(loaded, read.snapshot)).toBeNull();
      const restored = applySaveSnapshot(loaded, read.snapshot);
      expect(restored.actorEquipment[actor.id]).toEqual({ [slot.id]: boots.id });
      expect(restored.inventory).toEqual(session.inventory);
      loaded.database.equipmentSlots = [];
      expect(snapshotLoadBlocker(loaded, read.snapshot)).not.toBeNull();
    });

    it("rejects unknown slots atomically, including empty-slot unequip, and preserves permissions and curse rules", () => {
      const { project, actor, slot, boots } = fixture();
      const input = { project, actorId: actor.id, equipment: {}, inventory: { [boots.id]: 1 }, slot: "missing" };
      expect(transitionActorEquipment(input)).toEqual({ kind: "rejected", reason: "invalidSlot" });
      expect(transitionActorEquipment({ ...input, equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "invalidSlot" });
      expect(transitionActorEquipment({ ...input, slot: "accessory", equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "invalidSlot" });
      boots.equippableActorIds = [];
      project.database.classes.find((entry) => entry.id === actor.classId)!.equipmentPermissions = { actorIds: [], classIds: [], equipmentIds: [] };
      expect(transitionActorEquipment({ ...input, slot: slot.id, equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "notEquippable" });
      boots.equippableActorIds = [actor.id];
      boots.cursed = true;
      expect(transitionActorEquipment({ ...input, slot: slot.id, equipment: { [slot.id]: boots.id } })).toEqual({ kind: "rejected", reason: "cursedEquipment" });
      boots.twoHanded = true;
      expect(transitionActorEquipment({ ...input, slot: slot.id, equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "invalidSlot" });
      expect(input.inventory).toEqual({ [boots.id]: 1 });
    });

    it.each(["missing", "", "__proto__"])("rejects unknown or unsafe authored slot %j on project reload", (id) => {
      const { project, boots } = fixture();
      boots.slot = id;
      expect(() => deserialize(serialize(project))).toThrow(/slot/i);
    });

    it("validates catalog identity, initial equipment, event slots, and all custom save values", () => {
      const { project, actor, slot } = fixture();
      project.database.equipmentSlots!.push({ ...slot });
      expect(() => deserialize(serialize(project))).toThrow(/Duplicate equipment slot/);
      project.database.equipmentSlots!.pop();
      actor.initialEquipment.missing = project.database.equipment[0]!.id;
      expect(() => deserialize(serialize(project))).toThrow(/slot/);
      delete actor.initialEquipment.missing;
      project.commonEvents.push({ id: "ce_slot", name: "Slot", trigger: "call", commands: [
        { kind: "changeEquipment", actorId: actor.id, slot: slot.id, equipmentId: "" },
      ] } as typeof project.commonEvents[number]);
      expect(deserialize(serialize(project)).commonEvents.at(-1)!.commands[0]).toMatchObject({ slot: slot.id });
      project.commonEvents.at(-1)!.commands = [{ kind: "changeEquipment", actorId: actor.id, slot: "missing", equipmentId: "" }];
      expect(() => deserialize(serialize(project))).toThrow(/slot/);
      expect(isActorEquipmentRecord({ [actor.id]: { [slot.id]: 42 } })).toBe(false);
      const storage = new MemoryStorage();
      const snapshot = createSaveSnapshot(project, startSession(project));
      const malformed = JSON.parse(JSON.stringify(snapshot));
      malformed.session.actorEquipment[actor.id][slot.id] = 42;
      storage.setItem(saveSlotKey(1), JSON.stringify(malformed));
      expect(readSaveSlot(storage, 1).kind).toBe("corrupt");
    });

    it("keeps catalog-free legacy projects and saves compatible, even after renaming built-in labels", () => {
      const project = createBlankProject();
      expect(project.database.equipmentSlots).toBeUndefined();
      const loaded = deserialize(serialize(project));
      expect(equipmentSlots(loaded).map((slot) => slot.id)).toEqual(["weapon", "shield", "helmet", "armor", "accessory"]);
      const actor = loaded.database.actors[0]!;
      const weapon = loaded.database.equipment.find((entry) => entry.slot === "weapon")!;
      weapon.twoHanded = true;
      weapon.equippableActorIds = [actor.id];
      renameEquipmentSlot(loaded, "weapon", "Main hand");
      const result = transitionActorEquipment({ project: loaded, actorId: actor.id, equipment: {}, inventory: { [weapon.id]: 1 }, slot: "weapon", equipmentId: weapon.id });
      expect(result).toMatchObject({ kind: "accepted", equipment: { weapon: weapon.id, shield: weapon.id }, inventory: {} });
      const snapshot = createSaveSnapshot(loaded, startSession(loaded));
      const legacy = { ...snapshot, session: { ...snapshot.session, actorEquipment: undefined } };
      const storage = new MemoryStorage();
      saveToSlot(storage, 1, legacy);
      expect(readSaveSlot(storage, 1).kind).toBe("present");
      expect(applySaveSnapshot(loaded, legacy).actorEquipment[actor.id]).toEqual(actor.initialEquipment);
    });

    it("authors a custom slot inline, retains its ID on rename, and exposes it in the actor picker", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        const equipmentId = project.database.equipment[0]!.id;
        store.replace(project);
        const form = document.createElement("section") as unknown as FakeElement;
        const render = () => {
          form.replaceChildren();
          renderEquipmentRecordForm(form as unknown as HTMLElement, store.getCurrent().database.equipment.find((entry) => entry.id === equipmentId)!, render);
        };
        render();
        node(form, "db-equipment-slot-new-label").value = "Boots";
        node(form, "db-equipment-slot-add").click();
        const slot = store.getCurrent().database.equipmentSlots![0]!;
        expect(slot.id).not.toBe("accessory");
        expect(store.getCurrent().database.equipment[0]!.slot).toBe(slot.id);
        const label = node(form, `db-equipment-slot-label-${slot.id}`);
        label.value = "Greaves";
        label.dispatchEvent(new Event("change"));
        expect(store.getCurrent().database.equipmentSlots![0]).toEqual({ id: slot.id, label: "Greaves" });
        expect(node(form, `db-equipment-slot-remove-${slot.id}`).disabled).toBe(true);
        const actor = store.getCurrent().database.actors[0]!;
        const panel = battlePanel(actor, () => undefined, () => undefined) as unknown as FakeElement;
        const picker = node(panel, `db-picker-actor-equipment-${slot.id}`);
        picker.value = equipmentId;
        picker.dispatchEvent(new Event("change"));
        expect(store.getCurrent().database.actors[0]!.initialEquipment[slot.id]).toBe(equipmentId);
        expect(deserialize(serialize(store.getCurrent())).database.actors[0]!.initialEquipment[slot.id]).toBe(equipmentId);
      } finally {
        restoreDom();
      }
    });
  });
});

describe("databaseAnimationCellStaleClosure", () => {
  isolateTimers();
  // P2/P8 회귀 스펙(qa-battle Major): 셀 값을 인라인 수정한 직후 '셀 추가/삭제'를 누르면
  // 렌더 시점 셀 배열(스테일 클로저)이 프레임을 덮어써 방금 수정한 값이 조용히 롤백되던 결함.
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    (globalThis as unknown as { Image: new () => object }).Image = class {
      addEventListener(): void {}
      set src(_value: string) {}
    };
    store.replace(createBlankProject());
    resetMapEditHistory();
    editorState.set({ selectedAnimationFrameIndex: 0, selectedAnimationCellIndex: 0 });
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function renderForm(): { form: FakeElement; animationId: string } {
    const animation = store.getCurrent().database.battleAnimations[0];
    if (!animation) throw new Error("expected default battle animation");
    const form = el("div") as unknown as FakeElement;
    renderBattleAnimationRecordForm(form as unknown as HTMLElement, animation);
    return { form, animationId: animation.id };
  }
  function storedCells(animationId: string): readonly { x: number }[] {
    const record = store.getCurrent().database.battleAnimations.find((entry) => entry.id === animationId);
    return record?.frames?.[0]?.cells ?? [];
  }
  describe("battle animation cell mutations refetch from the store (P2)", () => {
    it("keeps an inline cell edit when 셀 추가 is clicked right after", () => {
      const { form, animationId } = renderForm();
      const xInput = findByTestId(form, "db-animation-cell-x-0");
      if (!xInput) throw new Error("missing cell x input");
      xInput.value = "55";
      xInput.dispatchEvent(new Event("input"));
      expect(storedCells(animationId)[0]?.x).toBe(55);

      const add = findByTestId(form, "db-animation-cell-add");
      if (!add) throw new Error("missing cell add button");
      add.dispatchEvent(new Event("click"));

      const cells = storedCells(animationId);
      expect(cells.length).toBe(2);
      // 스테일 클로저였다면 여기서 x 가 0 으로 롤백된다.
      expect(cells[0]?.x).toBe(55);
    });

    it("keeps an inline cell edit when another cell is deleted right after", () => {
      const { form, animationId } = renderForm();
      // 셀을 하나 늘려 2개로 만든 뒤 다시 그린다.
      const add = findByTestId(form, "db-animation-cell-add");
      if (!add) throw new Error("missing cell add button");
      add.dispatchEvent(new Event("click"));
      expect(storedCells(animationId).length).toBe(2);

      const form2 = el("div") as unknown as FakeElement;
      const animation = store.getCurrent().database.battleAnimations.find((entry) => entry.id === animationId);
      if (!animation) throw new Error("missing animation");
      renderBattleAnimationRecordForm(form2 as unknown as HTMLElement, animation);

      const xInput = findByTestId(form2, "db-animation-cell-x-0");
      if (!xInput) throw new Error("missing cell x input");
      xInput.value = "77";
      xInput.dispatchEvent(new Event("input"));

      const deleteSecond = findByTestId(form2, "db-animation-cell-delete-1");
      if (!deleteSecond) throw new Error("missing cell delete button");
      deleteSecond.dispatchEvent(new Event("click"));

      const cells = storedCells(animationId);
      expect(cells.length).toBe(1);
      expect(cells[0]?.x).toBe(77);
    });
  });
});

describe("databaseClassLearnedSkills", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  describe("class learned skills editor", () => {
    it("editing the first row does not drop the rest of learnedSkills", () => {
      const klass = store.getCurrent().database.classes[0];
      const skills = store.getCurrent().database.skills;
      if (!klass || skills.length < 2) throw new Error("fixture needs a class and two skills");
      updateDatabaseRecord("classes", klass.id, {
        learnedSkills: [
          { level: 1, skillId: skills[0]!.id },
          { level: 8, skillId: skills[1]!.id },
        ],
      });

      const form = document.createElement("section") as unknown as FakeElement;
      renderClassRecordForm(form as unknown as HTMLElement, store.getCurrent().database.classes[0]!);

      const level = findByTestId(form, "db-field-class-skill-level");
      expect(level).not.toBeNull();
      level!.value = "3";
      level!.dispatchEvent(new Event("input"));

      const after = store.getCurrent().database.classes[0]!;
      expect(after.learnedSkills).toHaveLength(2);
      expect(after.learnedSkills[0]).toEqual({ level: 3, skillId: skills[0]!.id });
      expect(after.learnedSkills[1]).toEqual({ level: 8, skillId: skills[1]!.id });
    });

    it("add button appends a learned-skill row instead of replacing the array", () => {
      const klass = store.getCurrent().database.classes[0];
      const skills = store.getCurrent().database.skills;
      if (!klass || !skills[0]) throw new Error("fixture needs a class and a skill");
      updateDatabaseRecord("classes", klass.id, {
        learnedSkills: [{ level: 1, skillId: skills[0].id }],
      });

      const form = document.createElement("section") as unknown as FakeElement;
      renderClassRecordForm(form as unknown as HTMLElement, store.getCurrent().database.classes[0]!);
      findByTestId(form, "db-add-class-skill")?.click();

      const after = store.getCurrent().database.classes[0]!;
      expect(after.learnedSkills.length).toBe(2);
      expect(after.learnedSkills[0]?.skillId).toBe(skills[0].id);
    });
  });
});
