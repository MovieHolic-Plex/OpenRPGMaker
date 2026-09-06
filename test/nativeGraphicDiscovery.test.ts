import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { mockSprite, mockTileImage, type MockSprite } from "./runtimeEventPageFixtures";

// Independent sheet-frame oracle: 12 columns, four directions per character,
// four characters per row. Do not derive expected frames with the production encoder/decoder.
const IDLE_FRAMES = {
  down: [25, 28, 31, 34, 73, 76, 79, 82],
  left: [37, 40, 43, 46, 85, 88, 91, 94],
  right: [13, 16, 19, 22, 61, 64, 67, 70],
  up: [1, 4, 7, 10, 49, 52, 55, 58],
};
const DIRECTIONS: readonly (keyof typeof IDLE_FRAMES)[] = ["down", "left", "right", "up"];
const SURFACES = ["list_resources", "list_npc_graphics"];
const SHEETS = ["people1", "object1", "object2"];

function matchesFrom(data: unknown) {
  assert(data && typeof data === "object" && "matches" in data);
  assert(Array.isArray(data.matches));
  const matches: readonly unknown[] = data.matches;
  return matches.map(match => {
    assert(match && typeof match === "object");
    return match;
  });
}

function sceneFor(project: Project) {
  const map = project.maps[project.startMapId];
  assert(map);
  store.replace(project);
  return {
    map,
    session: startSession(project),
    eventPositions: initialRuntimeEventPositions(map.events),
    tileLayer: { removeAll: () => undefined, add: () => undefined },
    eventSprites: new Map<string, MockSprite>(),
    missingResources: new Set<string>(),
    runtimeDom: {
      clearEventMarkers: () => undefined,
      upsertEventMarker: () => undefined,
      syncMissingResourceError: () => undefined,
    },
    add: {
      image: () => mockTileImage(),
      sprite: (x: number, y: number, texture: string, frame?: string | number) => {
        const sprite = mockSprite(x, y, texture);
        if (frame !== undefined) sprite.setFrame(frame);
        return sprite;
      },
    },
    runEvent: async () => undefined,
    syncRuntimeState: () => undefined,
  };
}

describe("charset discovery to native authoring to player rendering", () => {
  it.each(SURFACES.flatMap(surface => SHEETS.map(sheet => ({ surface, sheet }))))(
    "$surface exposes unchanged native graphics for every $sheet slot and runtime direction",
    ({ surface, sheet }) => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const textureKey = `tex_easyrpg_charset_${sheet}`;
      const before = serialize(ctx.project);
      const discovery = runTool(ctx, surface, { kind: "charset", query: sheet });
      assert(discovery.ok, discovery.summary);
      expect(serialize(ctx.project)).toBe(before);
      const matches = matchesFrom(discovery.data).filter(entry => surface === "list_resources"
        ? "id" in entry && typeof entry.id === "string" && entry.id.startsWith(`charset:${textureKey}:`)
        : "textureKey" in entry && entry.textureKey === textureKey);
      expect(matches).toHaveLength(8);
      for (let slot = 0; slot < 8; slot += 1) {
        const match = matches.find(entry => surface === "list_resources"
          ? "id" in entry && entry.id === `charset:${textureKey}:${slot}`
          : "characterIndex" in entry && entry.characterIndex === slot);
        assert(match);
        assert("nativeGraphic" in match, `${surface} ${sheet} slot ${slot} lacks nativeGraphic`);
        const authored = runTool(ctx, "upsert_event", { mapId, event: {
          id: `slot_${slot}`, x: slot + 1, y: 1,
          pages: [{ id: `page_${slot}`, graphic: match.nativeGraphic, commands: [] }],
        } });
        assert(authored.ok, authored.summary);
        const page = ctx.project.maps[mapId]?.events.find(event => event.id === `slot_${slot}`)?.pages?.[0];
        expect(page?.graphic).toEqual(match.nativeGraphic);
        expect(page?.graphic).toEqual({
          sprite: { type: "bundled", id: textureKey }, direction: "down", pattern: IDLE_FRAMES.down[slot],
        });
      }
      const project = deserialize(serialize(ctx.project));
      const scene = sceneFor(project);
      renderTiles(scene);
      for (const direction of DIRECTIONS) {
        for (const event of scene.map.events) {
          scene.eventPositions[event.id] = { x: event.x, y: event.y, direction };
        }
        renderTiles(scene);
        for (let slot = 0; slot < 8; slot += 1) {
          const sprite = scene.eventSprites.get(`slot_${slot}`);
          assert(sprite);
          expect(sprite.texture.key).toBe(textureKey);
          expect(sprite.frame).toBe(IDLE_FRAMES[direction][slot]);
        }
      }
      expect(scene.missingResources.size).toBe(0);
    },
  );

  it.each(SURFACES)("%s retains user labels and tags while exposing the same native slot", surface => {
    const ctx = { project: createBlankProject() };
    const override = {
      textureKey: "tex_easyrpg_charset_people1", characterIndex: 7,
      label: "R14_CUSTOM_SLOT", tags: ["R14_CUSTOM_TAG"], origin: "user",
    } satisfies NonNullable<Project["charsetLabels"]>[number];
    ctx.project.charsetLabels = [override];
    const discovery = runTool(ctx, surface, { kind: "charset", query: override.label });
    assert(discovery.ok, discovery.summary);
    const match = matchesFrom(discovery.data)[0];
    assert(match);
    expect(match).toMatchObject({
      label: override.label, tags: expect.arrayContaining(override.tags),
      nativeGraphic: {
        sprite: { type: "bundled", id: override.textureKey }, direction: "down", pattern: 82,
      },
    });
    if (surface === "list_resources") {
      expect(match).toMatchObject({ id: `charset:${override.textureKey}:7`, score: expect.any(Number) });
    } else {
      expect(match).toMatchObject({ textureKey: override.textureKey, characterIndex: 7 });
      expect(match).toHaveProperty("gender");
      expect(match).toHaveProperty("age");
    }
  });

  it("preserves all 96 valid native sheet frames through upsert and reload without slot heuristics", () => {
    const ctx = { project: createBlankProject() };
    const pages = Array.from({ length: 96 }, (_, pattern) => ({
      id: `frame_${pattern}`, commands: [],
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" }, direction: "down", pattern },
    }));
    const result = runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId, event: { id: "native_frames", x: 1, y: 1, pages },
    });
    assert(result.ok, result.summary);
    const project = deserialize(serialize(ctx.project));
    const event = project.maps[project.startMapId]?.events.find(entry => entry.id === "native_frames");
    assert(event?.pages);
    expect(event.pages.map(page => page.graphic)).toEqual(pages.map(page => page.graphic));
  });

  it.each([{ pattern: 0, down: 25 }, { pattern: 3, down: 28 }, { pattern: 7, down: 31 }, { pattern: 95, down: 82 }])(
    "renders native pattern $pattern as a sheet frame, not a character index",
    ({ pattern, down }) => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "upsert_event", {
        mapId: ctx.project.startMapId, event: { id: "native", x: 1, y: 1, pages: [{
          graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" }, direction: "down", pattern },
          commands: [],
        }] },
      });
      assert(result.ok, result.summary);
      const scene = sceneFor(deserialize(serialize(ctx.project)));
      renderTiles(scene);
      expect(scene.eventSprites.get("native")?.frame).toBe(pattern);
      scene.eventPositions.native = { x: 1, y: 1, direction: "down" };
      renderTiles(scene);
      expect(scene.eventSprites.get("native")?.frame).toBe(down);
    },
  );
});
