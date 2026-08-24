/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { createPlaySurface, type PlaySurface } from "@/player/playSurface";

describe("project play resolution", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("preserves a custom project resolution and clamps unsafe dimensions", () => {
    // Break named: normalizeSystemRecords currently drops the authored resolution.
    const custom = normalizeSystemRecords({
      startActorIds: [],
      playResolution: { width: 640, height: 360 },
    } as Parameters<typeof normalizeSystemRecords>[0]);
    const clamped = normalizeSystemRecords({
      startActorIds: [],
      playResolution: { width: 99, height: 9999 },
    } as Parameters<typeof normalizeSystemRecords>[0]);

    expect((custom as { playResolution?: unknown }).playResolution).toEqual({ width: 640, height: 360 });
    expect((clamped as { playResolution?: unknown }).playResolution).toEqual({ width: 320, height: 1080 });
  });

  it("sizes the runtime stage and Phaser host from the project resolution", () => {
    // Break named: createPlaySurface currently hard-codes its 320x240 CSS geometry.
    const createWithResolution = createPlaySurface as unknown as (
      resolution: { readonly width: number; readonly height: number },
    ) => PlaySurface;

    const surface = createWithResolution({ width: 640, height: 360 });
    document.body.append(surface.viewport);

    expect(surface.stage.style.width).toBe("640px");
    expect(surface.stage.style.height).toBe("360px");
    expect(surface.phaserContainer.style.width).toBe("640px");
    expect(surface.phaserContainer.style.height).toBe("360px");
    expect(surface.viewport.style.getPropertyValue("--play-logical-width")).toBe("640px");
    expect(surface.viewport.style.getPropertyValue("--play-logical-height")).toBe("360px");

    surface.cleanup();
  });

  it("survives the real project save and load boundary", () => {
    // Break named: schema validation or normalization could drop the field on reload.
    const project = createBlankProject();
    project.system.playResolution = { width: 426, height: 240 };

    const loaded = deserialize(serialize(project));

    expect(loaded.system.playResolution).toEqual({ width: 426, height: 240 });
  });
});
