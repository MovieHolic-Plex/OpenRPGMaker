import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDatabaseCinematicActions,
  type DatabaseCinematicActions,
} from "@/editor/panels/databaseCinematicActions";
import {
  getMapEditHistoryEntries,
  getMapEditHistoryState,
  redoMapEdit,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import {
  renderDatabasePanel,
  setDatabaseActiveTab,
  TAB_GROUPS,
} from "@/editor/panels/database";
import {
  CINEMATIC_DURATION_MAX_MS,
  CINEMATIC_SCENE_LIMIT,
  type CinematicScene,
  type CinematicSequence,
} from "@/project/cinematicSettings";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

type Target = "opening" | "game-over";

// These tests enter through the shipped Database renderer and actual picker
// dialogs. Initial tab RED used only existing entry points; controller cases
// were added after its module existed.
// Shared authoring controls use db-cinematic-* IDs within the active tab.
let restoreDom: () => void;
let host: FakeElement;

function node(id: string, root = host): FakeElement {
  const result = findByTestId(root, id);
  expect(result, `missing DOM control ${id}`).not.toBeNull();
  return result!;
}

function control(suffix: string): FakeElement {
  return node(`db-cinematic-${suffix}`);
}

function edit(suffix: string, value: string, event = "change"): void {
  const input = control(suffix);
  input.value = value;
  input.dispatchEvent(new Event(event));
}

function open(target: Target): void {
  node(`db-tab-${target}`).click();
}

function sequence(target: Target = "opening"): CinematicSequence {
  const system = store.getCurrent().system;
  const result = target === "opening" ? system.opening : system.gameOver?.sequence;
  expect(result).toBeDefined();
  return result!;
}

function text(id: string): CinematicScene {
  return { id, kind: "text", narration: `Narration ${id}`, durationMs: 700 };
}

function image(id: string): CinematicScene {
  return {
    id,
    kind: "image",
    resourceId: "cinematic-picture",
    narration: `Narration ${id}`,
    narrationAudioResourceId: "cinematic-voice",
    durationMs: 1700,
    motion: "zoom",
  };
}

function seed(target: Target, scenes: CinematicScene[], enabled = true): void {
  const project = createBlankProject();
  project.assets.uploaded["cinematic-picture"] = {
    id: "cinematic-picture", name: "Cinematic picture", kind: "picture",
    dataUrl: "data:image/png;base64,AAAA", meta: {},
  };
  project.assets.uploaded["cinematic-movie"] = {
    id: "cinematic-movie", name: "Cinematic movie", kind: "movie",
    dataUrl: "data:video/webm;base64,AAAA", meta: {},
  };
  project.assets.uploaded["cinematic-voice"] = {
    id: "cinematic-voice", name: "Cinematic voice", kind: "sound",
    dataUrl: "data:audio/ogg;base64,AAAA", meta: {},
  };
  // These are selection fixtures, not assertions about native media decoding.
  // Actual uploads/decoding belong to the real-browser acceptance spec.
  const settings = { enabled, skippable: false, scenes };
  if (target === "opening") project.system.opening = settings;
  else project.system.gameOver = { sequence: settings };
  store.replace(project);
  resetMapEditHistory();
  setDatabaseActiveTab("system");
  renderDatabasePanel(host as unknown as HTMLElement);
  open(target);
}

function select(id: string): void {
  control(`scene-${id}`).click();
}

function pick(suffix: string, resourceId: string): void {
  control(`${suffix}-set`).click();
  const body = document.body as unknown as FakeElement;
  const prefix = `db-cinematic-${suffix}-dialog`;
  node(`${prefix}-option-${resourceId}`, body).click();
  node(`${prefix}-ok`, body).click();
}

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  delete project.system.opening;
  delete project.system.gameOver;
  store.replace(project);
  resetMapEditHistory();
  setDatabaseActiveTab("system");
  host = document.createElement("div") as unknown as FakeElement;
  document.body.append(host as unknown as Node);
  renderDatabasePanel(host as unknown as HTMLElement);
});

afterEach(() => {
  // Navigate through the public seam so tab-owned work can be disposed.
  findByTestId(host, "db-tab-system")?.click();
  host.remove();
  vi.restoreAllMocks();
  resetMapEditHistory();
  restoreDom();
});

describe("Database cinematic authoring", () => {
  it("renders a detached initial cinematic tab without enabling edits before attachment", () => {
    host.remove();
    setDatabaseActiveTab("opening");
    const before = JSON.stringify(store.getCurrent());
    renderDatabasePanel(host as unknown as HTMLElement);
    expect(findByTestId(host, "db-cinematic-enabled")).not.toBeNull();
    control("add").click();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    document.body.append(host as unknown as Node);
    control("add").click();
    expect(sequence().scenes).toHaveLength(1);
  });

  it("keeps a controller created during a replacement notification active", () => {
    const created: DatabaseCinematicActions[] = [];
    const unsubscribe = store.subscribe(() => {
      if (created.length === 0) {
        created.push(createDatabaseCinematicActions({ target: "opening", isActive: () => true }));
      }
    });
    try {
      store.replace(createBlankProject());
      expect(created).toHaveLength(1);
      expect(created[0].isActive()).toBe(true);
    } finally {
      unsubscribe();
      for (const actions of created) actions.dispose();
    }
  });

  it(
    "registers dedicated cinematic tabs in the System group",
    () => {
      renderDatabasePanel(host as unknown as HTMLElement);
      // First failing baseline assertion: the existing renderer has no such tab.
      expect(findByTestId(host, "db-tab-opening")).not.toBeNull();
      expect(findByTestId(host, "db-tab-game-over")).not.toBeNull();
      expect(TAB_GROUPS.find((group) => group.slug === "system")?.tabs)
        .toEqual(expect.arrayContaining(["system", "opening", "gameOver"]));
      expect(TAB_GROUPS.filter((group) => group.slug !== "system")
        .flatMap((group) => group.tabs))
        .not.toEqual(expect.arrayContaining(["opening", "gameOver"]));
    },
  );

  it("does not materialize optional settings or history merely by viewing tabs", () => {
    const before = JSON.stringify(store.getCurrent());
    const update = vi.spyOn(store, "update");
    open("opening");
    open("game-over");
    node("db-tab-system").click();
    expect(findByTestId(host, "db-title-workbench")).not.toBeNull();
    expect(update).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryState()).toEqual({ canUndo: false, canRedo: false });
  });

  it.each(["opening", "game-over"] as const)(
    "%s selection and navigation retain disabled content without writes",
    (target) => {
      seed(target, [text("a"), image("b")], false);
      const before = JSON.stringify(store.getCurrent());
      const update = vi.spyOn(store, "update");
      select("b");
      select("a");
      node("db-tab-system").click();
      open(target);
      expect(sequence(target).enabled).toBe(false);
      expect(sequence(target).scenes).toEqual([text("a"), image("b")]);
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(update).not.toHaveBeenCalled();
      expect(getMapEditHistoryState().canUndo).toBe(false);
    },
  );

  it.each(["opening", "game-over"] as const)(
    "%s enabled/skippable changes retain scenes and are undoable",
    (target) => {
      seed(target, [image("a")]);
      const update = vi.spyOn(store, "update");
      const enabled = control("enabled");
      enabled.checked = false;
      enabled.dispatchEvent(new Event("change"));
      expect(sequence(target)).toEqual({
        enabled: false, skippable: false, scenes: [image("a")],
      });
      expect(undoMapEdit()).toBe(true);
      expect(sequence(target).enabled).toBe(true);
      expect(redoMapEdit()).toBe(true);
      expect(sequence(target).enabled).toBe(false);
      node("db-tab-system").click();
      open(target);
      const skippable = control("skippable");
      skippable.checked = true;
      skippable.dispatchEvent(new Event("change"));
      expect(sequence(target)).toEqual({
        enabled: false, skippable: true, scenes: [image("a")],
      });
      expect(update).toHaveBeenCalled();
      for (const [, annotation] of update.mock.calls) {
        expect(annotation?.scope).toBe("system");
        expect(annotation?.label?.trim().length).toBeGreaterThan(0);
      }
    },
  );

  it("commits image-to-text without leaking motion or required media fields", () => {
    seed("opening", [image("a")]);
    select("a");
    edit("kind", "text");
    expect(sequence().scenes).toEqual([{
      id: "a", kind: "text", narration: "Narration a",
      narrationAudioResourceId: "cinematic-voice", durationMs: 1700,
    }]);
    expect(undoMapEdit()).toBe(true);
    expect(sequence().scenes).toEqual([image("a")]);
    expect(redoMapEdit()).toBe(true);
    expect(sequence().scenes[0]).not.toHaveProperty("motion");
    expect(sequence().scenes[0]).not.toHaveProperty("resourceId");
  });

  it.each(["image", "video"] as const)(
    "keeps text valid until a %s resource is confirmed",
    (kind) => {
      seed("opening", [text("a")]);
      select("a");
      const before = JSON.stringify(store.getCurrent());
      edit("kind", kind);
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(getMapEditHistoryState().canUndo).toBe(false);
      control("resource-set").click();
      const body = document.body as unknown as FakeElement;
      node("db-cinematic-resource-dialog-cancel", body).click();
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      pick("resource", kind === "image" ? "cinematic-picture" : "cinematic-movie");
      const scene = sequence().scenes[0]!;
      expect(scene).toMatchObject({
        id: "a", kind, narration: "Narration a", durationMs: 700,
        resourceId: kind === "image" ? "cinematic-picture" : "cinematic-movie",
      });
      if (kind === "image") expect(scene).toHaveProperty("motion", "none");
      else expect(scene).not.toHaveProperty("motion");
      expect(undoMapEdit()).toBe(true);
      expect(sequence().scenes).toEqual([text("a")]);
    },
  );

  it("replaces image with video atomically and removes image motion", () => {
    seed("opening", [image("a")]);
    select("a");
    const before = JSON.stringify(store.getCurrent());
    edit("kind", "video");
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    pick("resource", "cinematic-movie");
    expect(sequence().scenes).toEqual([{
      id: "a", kind: "video", resourceId: "cinematic-movie",
      narration: "Narration a", narrationAudioResourceId: "cinematic-voice",
      durationMs: 1700,
    }]);
    expect(undoMapEdit()).toBe(true);
    expect(sequence().scenes).toEqual([image("a")]);
  });

  it.each(["image", "video"] as const)(
    "does not allow clearing required %s media into an invalid variant",
    (kind) => {
      const scene: CinematicScene = kind === "image" ? image("a") : {
        id: "a", kind: "video", resourceId: "cinematic-movie",
        narration: "Narration a", durationMs: 1700,
      };
      seed("opening", [scene]);
      select("a");
      const before = JSON.stringify(store.getCurrent());
      control("resource-set").click();
      const body = document.body as unknown as FakeElement;
      expect(findByTestId(body, "db-cinematic-resource-dialog-clear")).toBeNull();
      node("db-cinematic-resource-dialog-cancel", body).click();
      // The shared picker also exposes a legacy raw-ID input. Clearing through
      // this path must not bypass the required-resource invariant.
      edit("resource", "");
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(getMapEditHistoryState().canUndo).toBe(false);
    },
  );

  it("allows optional voice to be selected and cleared without changing the variant", () => {
    seed("opening", [text("a")]);
    select("a");
    pick("voice", "cinematic-voice");
    expect(sequence().scenes[0]).toEqual({
      ...text("a"), narrationAudioResourceId: "cinematic-voice",
    });
    control("voice-set").click();
    node("db-cinematic-voice-dialog-clear", document.body as unknown as FakeElement).click();
    expect(sequence().scenes).toEqual([text("a")]);
    expect(sequence().scenes[0]).not.toHaveProperty("narrationAudioResourceId");
  });

  it.each(["opening", "game-over"] as const)(
    "%s reorders and deletes the selected scene without losing values",
    (target) => {
      seed(target, [text("a"), image("b"), text("c")], false);
      select("b");
      control("up").click();
      expect(sequence(target).scenes).toEqual([image("b"), text("a"), text("c")]);
      expect(control("up").disabled).toBe(true);
      control("down").click();
      expect(sequence(target).scenes).toEqual([text("a"), image("b"), text("c")]);
      control("delete").click();
      expect(sequence(target).scenes).toEqual([text("a"), text("c")]);
      expect(sequence(target).enabled).toBe(false);
      expect(undoMapEdit()).toBe(true);
      expect(sequence(target).scenes).toEqual([text("a"), image("b"), text("c")]);
      expect(redoMapEdit()).toBe(true);
      expect(sequence(target).scenes).toEqual([text("a"), text("c")]);
    },
  );

  it("adds valid unique text scenes and enforces the shared scene limit", () => {
    seed("opening", Array.from({ length: CINEMATIC_SCENE_LIMIT - 1 }, (_, i) => text(`s${i}`)));
    control("add").click();
    const scenes = sequence().scenes;
    expect(scenes).toHaveLength(CINEMATIC_SCENE_LIMIT);
    expect(new Set(scenes.map((scene) => scene.id)).size).toBe(CINEMATIC_SCENE_LIMIT);
    expect(scenes.at(-1)).toMatchObject({ kind: "text", narration: "" });
    expect(scenes.at(-1)).not.toHaveProperty("resourceId");
    expect(scenes.at(-1)).not.toHaveProperty("motion");
    expect(control("add").disabled).toBe(true);
    expect(undoMapEdit()).toBe(true);
    expect(sequence().scenes).toHaveLength(CINEMATIC_SCENE_LIMIT - 1);
  });

  it("bounds authored duration using the shipped limits", () => {
    seed("opening", [text("a")]);
    select("a");
    // FakeElement stores attributes without native reflected min/max properties.
    expect(control("duration").getAttribute("min")).toBe("0");
    expect(control("duration").getAttribute("max")).toBe(String(CINEMATIC_DURATION_MAX_MS));
    edit("duration", String(CINEMATIC_DURATION_MAX_MS + 1));
    expect(sequence().scenes[0]!.durationMs).toBe(CINEMATIC_DURATION_MAX_MS);
    edit("duration", "-1");
    expect(sequence().scenes[0]!.durationMs).toBe(0);
  });

  it("retains the narration input, focus and caret while coalescing typing", () => {
    seed("opening", [text("a")]);
    select("a");
    const input = control("narration");
    input.focus();
    const before = getMapEditHistoryEntries().length;
    for (const value of ["A", "AB", "ABC"]) {
      input.value = value;
      input.setSelectionRange(value.length, value.length);
      input.dispatchEvent(new Event("input"));
      expect(control("narration")).toBe(input);
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(value.length);
      expect(input.selectionEnd).toBe(value.length);
      expect(sequence().scenes[0]!.narration).toBe(value);
    }
    expect(getMapEditHistoryEntries().length).toBe(before + 1);
    expect(undoMapEdit()).toBe(true);
    expect(sequence().scenes[0]!.narration).toBe("Narration a");
    expect(redoMapEdit()).toBe(true);
    expect(sequence().scenes[0]!.narration).toBe("ABC");
  });

  it("does not commit an old picker confirmation after its scene is deleted", () => {
    seed("opening", [image("a"), text("b")]);
    select("a");
    control("resource-set").click();
    const body = document.body as unknown as FakeElement;
    node("db-cinematic-resource-dialog-option-cinematic-picture", body).click();
    const confirm = node("db-cinematic-resource-dialog-ok", body);
    // Capture an already-open callback, then invalidate its owning record.
    control("delete").click();
    const before = JSON.stringify(store.getCurrent());
    const update = vi.spyOn(store, "update");
    confirm.click();
    expect(sequence().scenes).toEqual([text("b")]);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["tab", "project"] as const)(
    "rejects a pending picker confirmation after %s replacement",
    (replacement) => {
      seed("opening", [text("a")]);
      select("a");
      edit("kind", "video");
      control("resource-set").click();
      const body = document.body as unknown as FakeElement;
      node("db-cinematic-resource-dialog-option-cinematic-movie", body).click();
      const confirm = node("db-cinematic-resource-dialog-ok", body);
      if (replacement === "tab") node("db-tab-system").click();
      else store.replace(createBlankProject());
      const before = JSON.stringify(store.getCurrent());
      const update = vi.spyOn(store, "update");
      confirm.click();
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(update).not.toHaveBeenCalled();
    },
  );
});
