import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { generateAiImage, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import { createCharacterAppearanceGenerationController, type AppearanceGenerationDeps } from "@/editor/characterAppearanceGeneration";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { store } from "@/project/store";
import { resetMapEditHistory, recordProjectSnapshot, undoMapEdit } from "@/editor/mapEditHistory";
import { aiActivityFamilySource } from "@/editor/aiActivityNarration";
import { renderEventGraphicPreview } from "@/editor/panels/eventEditor/eventGraphicPreview";
import { editorEventMarkerTexture } from "@/editor/editSceneEventMarkers";
import { installFakeDom } from "./fakeDom";
import { collectAppearanceReferences, type AppearanceReferenceReader } from "@/editor/characterAppearanceReferences";
import { parseImageReferences } from "@/ai/imageReferences";
import { charsetFrameSource } from "@/assets/easyrpgRtp";
import type { CharacterAppearanceRecord } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("characterAppearanceGeneration", () => {
  isolateTimers();
  const image: GeneratedImageAsset = {
    dataUrl: "data:image/png;base64,aGVsbG8=", mimeType: "image/png", provider: "test", model: "test",
  };
  function deferred<T>() {
    let resolve: (value: T) => void = () => { throw new Error("not initialized"); };
    let reject: (error: Error) => void = () => { throw new Error("not initialized"); };
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  }
  function fixture() {
    const project = createBlankProject();
    project.database.characterAppearances = [{ id: "appearance", name: "Mira", description: "Green coat" }];
    store.replaceProject(project);
    resetMapEditHistory();
    const result = deferred<GeneratedImageAsset>();
    const started = deferred<void>();
    const generateImage = vi.fn(() => { started.resolve(); return result.promise; });
    const snapshot = vi.fn(recordProjectSnapshot);
    const update = vi.fn<AppearanceGenerationDeps["update"]>((mutator, change) => store.update(mutator, change));
    const controller = createCharacterAppearanceGenerationController({
      getProject: () => store.getCurrent(),
      getIdentity: () => store.getProjectIdentity(),
      update,
      recordSnapshot: snapshot,
      generateImage,
      references: async () => [],
    });
    return { controller, result, started, generateImage, snapshot, update };
  }
  describe("character appearance image references", () => {
    it("forwards actual reference bytes when an existing appearance image is supplied", async () => {
      const referenceImages = [{ mimeType: "image/png" as const, data: "aGVsbG8=" }];
      const request = { prompt: "portrait", referenceImages };
      let body: unknown;

      await generateAiImage(request, {
        fetch: async (_input, init) => {
          body = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({
            image: { dataUrl: "data:image/png;base64,aGVsbG8=" },
          }));
        },
      });

      expect(body).toMatchObject({ referenceImages });
    });
  });
  describe("appearance candidate safety", () => {
    it("does not insert a late generated portrait into a switched project", async () => {
      const f = fixture();
      const pending = f.controller.generate({ appearanceId: "appearance", slot: "face" });
      await f.started.promise;
      const replacement = structuredClone(store.getCurrent());
      store.replaceProject(replacement);
      const before = JSON.stringify(store.getCurrent());
      f.result.resolve(image);
      await pending;

      expect(f.controller.apply()).toBe(false);
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(f.snapshot).not.toHaveBeenCalled();
    });

    it("keeps a generated face detached until explicit Apply and undoes assets and slot together", async () => {
      const f = fixture();
      const before = JSON.stringify(store.getCurrent());
      f.result.resolve(image);
      await f.controller.generate({ appearanceId: "appearance", slot: "face" });
      expect(f.controller.getState()).toMatchObject({ status: "candidate", candidate: { presentation: "face" } });
      expect(JSON.stringify(store.getCurrent())).toBe(before);

      expect(f.controller.apply("face")).toBe(true);
      const id = store.getCurrent().database.characterAppearances?.[0]?.face?.resourceId ?? "";
      expect(id).not.toContain("bust");
      expect(store.getCurrent().assets.uploaded[id]?.kind).toBe("faceset");
      expect(f.update).toHaveBeenCalledTimes(1);
      expect(f.snapshot).toHaveBeenCalledTimes(1);
      expect(undoMapEdit()).toBe(true);
      expect(JSON.stringify(store.getCurrent())).toBe(before);
    });

    it("refuses a second Apply without creating another asset or undo entry", async () => {
      const f = fixture();
      f.result.resolve(image);
      await f.controller.generate({ appearanceId: "appearance", slot: "bust" });
      f.controller.apply();
      const before = JSON.stringify(store.getCurrent());

      expect(f.controller.apply()).toBe(false);
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(f.snapshot).toHaveBeenCalledTimes(1);
    });

    it("does not call the provider for an occupied slot without explicit replacement", async () => {
      const f = fixture();
      store.update((project) => {
        const record = project.database.characterAppearances?.[0];
        if (record) record.face = { resourceId: "existing" };
      });
      f.result.resolve(image);

      await f.controller.generate({ appearanceId: "appearance", slot: "face" });

      expect(f.generateImage).not.toHaveBeenCalled();
      expect(f.controller.getState().status).toBe("error");
    });

    it("discards a late result after cancellation even when the provider ignores abort", async () => {
      const f = fixture();
      const pending = f.controller.generate({ appearanceId: "appearance", slot: "face" });
      await f.started.promise;
      f.controller.cancel();

      f.result.resolve(image);
      await pending;

      expect(f.controller.getState().status).toBe("idle");
      expect(f.controller.apply()).toBe(false);
      expect(f.update).not.toHaveBeenCalled();
    });

    it("rejects a candidate after the target slot or description changes", async () => {
      const f = fixture();
      f.result.resolve(image);
      await f.controller.generate({ appearanceId: "appearance", slot: "face" });
      store.update((project) => {
        const record = project.database.characterAppearances?.[0];
        if (record) record.description = "Now wearing red";
      });
      const before = JSON.stringify(store.getCurrent());

      expect(f.controller.apply()).toBe(false);
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(f.snapshot).not.toHaveBeenCalled();
    });

    it("replaces only the explicitly selected slot with a fresh asset and keeps charset bytes and index", async () => {
      const f = fixture();
      store.update((project) => {
        project.assets.uploaded.existing = { id: "existing", kind: "faceset", name: "Old face", dataUrl: image.dataUrl, meta: {} };
        project.assets.uploaded.sheet = { id: "sheet", kind: "charset", name: "Manual", dataUrl: image.dataUrl, meta: {} };
        const record = project.database.characterAppearances?.[0];
        if (record) {
          record.charset = { resourceId: "sheet", characterIndex: 7 };
          record.face = { resourceId: "existing" };
        }
      });
      const before = structuredClone(store.getCurrent());
      f.result.resolve(image);
      await f.controller.generate({ appearanceId: "appearance", slot: "face", replace: true });

      expect(f.controller.apply()).toBe(true);

      const current = store.getCurrent();
      expect(current.database.characterAppearances?.[0]?.face?.resourceId).not.toBe("existing");
      expect(current.database.characterAppearances?.[0]?.charset).toEqual(before.database.characterAppearances?.[0]?.charset);
      expect(current.assets.uploaded.sheet).toEqual(before.assets.uploaded.sheet);
      expect(current.assets.uploaded.existing).toEqual(before.assets.uploaded.existing);
      expect(current.database.characterAppearances?.[0]?.bust).toBeUndefined();
    });

    it.each(["removed", "occupied"] as const)("rejects Apply when the target becomes %s", async (change) => {
      const f = fixture();
      f.result.resolve(image);
      await f.controller.generate({ appearanceId: "appearance", slot: "bust" });
      store.update((project) => {
        if (change === "removed") project.database.characterAppearances = [];
        else {
          const record = project.database.characterAppearances?.[0];
          if (record) record.bust = { resourceId: "human-picture" };
        }
      });
      const before = JSON.stringify(store.getCurrent());

      expect(f.controller.apply()).toBe(false);
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(f.snapshot).not.toHaveBeenCalled();
    });

    it("keeps provider errors outside project state and undo history", async () => {
      const f = fixture();
      const before = JSON.stringify(store.getCurrent());
      const pending = f.controller.generate({ appearanceId: "appearance", slot: "face" });
      await f.started.promise;

      f.result.reject(new Error("provider unavailable"));
      await pending;

      expect(f.controller.getState().status).toBe("error");
      expect(f.controller.apply()).toBe(false);
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(f.snapshot).not.toHaveBeenCalled();
    });

    it("does not let an older result replace a newer slot candidate", async () => {
      const f = fixture();
      const first = f.controller.generate({ appearanceId: "appearance", slot: "face" });
      await f.started.promise;
      const newer = { ...image, dataUrl: "data:image/png;base64,bmV3ZXI=" };
      f.generateImage.mockResolvedValueOnce(newer);
      await f.controller.generate({ appearanceId: "appearance", slot: "bust" });

      f.result.resolve(image);
      await first;

      expect(f.controller.getState()).toMatchObject({
        status: "candidate", slot: "bust", candidate: { dataUrl: newer.dataUrl, presentation: "bust" },
      });
      expect(f.update).not.toHaveBeenCalled();
    });
  });
});

describe("characterAppearanceNarration", () => {
  isolateTimers();
  it("assigns appearance generation an explicit activity family", () => {
    expect(aiActivityFamilySource("generate_character_appearance")).toBe("mapped");
  });
});

describe("characterAppearancePreview", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => { restoreDom = installFakeDom(); });
  afterEach(() => { restoreDom?.(); });
  describe("shared appearance event preview", () => {
    it.each(["easyrpg-charset-actor1", "tex_easyrpg_charset_actor1"])(
      "renders the selected bundled character when referenced by %s",
      (resourceId) => {
        const project = createBlankProject();
        project.database.characterAppearances = [{
          id: "guide", name: "Guide", description: "",
          charset: { resourceId, characterIndex: 5 },
        }];
        store.replace(project);

        const preview = renderEventGraphicPreview({ appearanceId: "guide" });

        expect(preview.dataset.unsupported).toBeUndefined();
        expect(preview.dataset.slot).toBe("5");
        expect(preview.dataset.pattern).toBe("76");
      },
    );

    it("uses the shared charset and cell on the editor map", () => {
      const project = createBlankProject();
      project.database.characterAppearances = [{
        id: "guide", name: "Guide", description: "",
        charset: { resourceId: "easyrpg-charset-actor1", characterIndex: 5 },
      }];

      const marker = editorEventMarkerTexture(project, { appearanceId: "guide" });

      expect(marker).toMatchObject({ texture: "tex_easyrpg_charset_actor1", frame: 76 });
      expect(editorEventMarkerTexture(project, { appearanceId: "guide", transparent: true })).toBeNull();
    });
  });
});

describe("characterAppearanceReferences", () => {
  isolateTimers();
  describe("appearance reference images", () => {
    it("reads the exact manual chipset crop and existing face as actual image parts", async () => {
      const project = createBlankProject();
      project.assets.uploaded["manual-charset"] = {
        id: "manual-charset", kind: "charset", name: "Sheet", dataUrl: "data:image/png;base64,c2hlZXQ=", meta: {},
      };
      project.assets.uploaded["manual-face"] = {
        id: "manual-face", kind: "faceset", name: "Face", dataUrl: "data:image/png;base64,ZmFjZQ==", meta: {},
      };
      const record: CharacterAppearanceRecord = {
        id: "appearance", name: "Mira", description: "",
        charset: { resourceId: "manual-charset", characterIndex: 6 },
        face: { resourceId: "manual-face" },
      };
      const before = JSON.stringify({ project, record });
      const reader = vi.fn<AppearanceReferenceReader>()
        .mockResolvedValueOnce("data:image/png;base64,Y3JvcA==")
        .mockResolvedValueOnce("data:image/png;base64,ZmFjZQ==");
      const signal = new AbortController().signal;

      const references = await collectAppearanceReferences(project, record, signal, reader);

      expect(reader).toHaveBeenNthCalledWith(1, "data:image/png;base64,c2hlZXQ=",
        charsetFrameSource({ characterIndex: 6, direction: "down", pattern: 1 }), signal);
      expect(reader).toHaveBeenNthCalledWith(2, "data:image/png;base64,ZmFjZQ==", undefined, signal);
      expect(references).toEqual([
        { mimeType: "image/png", data: "Y3JvcA==" },
        { mimeType: "image/png", data: "ZmFjZQ==" },
      ]);
      expect(JSON.stringify({ project, record })).toBe(before);
    });

    it("allows description-only appearance generation without a charset", async () => {
      const reader = vi.fn<AppearanceReferenceReader>();
      const record = { id: "appearance", name: "Mira", description: "Green coat" };

      const result = await collectAppearanceReferences(createBlankProject(), record, new AbortController().signal, reader);

      expect(result).toEqual([]);
      expect(reader).not.toHaveBeenCalled();
    });

    it.each([
      [{ mimeType: "image/svg+xml", data: "PHN2Zz4=" }],
      [{ mimeType: "image/png", data: "https://remote.example/image.png" }],
      [{ mimeType: "image/png", data: "not base64" }],
      Array.from({ length: 3 }, () => ({ mimeType: "image/png", data: "YQ==" })),
      [{ mimeType: "image/png", data: "a".repeat(8 * 1024 * 1024 + 4) }],
    ].map((parts) => [parts]))("rejects malformed or oversized external reference payload %#", (parts) => {
      expect(() => parseImageReferences(parts)).toThrow();
    });

    it("does not send an oversized reference request to the companion", async () => {
      const send = vi.fn<typeof fetch>();

      await expect(generateAiImage({
        prompt: "face",
        referenceImages: [{ mimeType: "image/png", data: "a".repeat(8 * 1024 * 1024 + 4) }],
      }, { fetch: send })).rejects.toThrow();

      expect(send).not.toHaveBeenCalled();
    });
  });
});
