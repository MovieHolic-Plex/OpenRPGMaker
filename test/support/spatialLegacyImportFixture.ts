import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createBlankProject } from "../../src/project/defaults/defaultProject";
import { designBase, emptySpatialDocument } from "./spatialSchemaFixture";

/** Synthetic raw-wire root plus a newer map overlay; never a normalized Project. */
export function legacyRawFixture() {
  const project = createBlankProject();
  const tilesetId = "easyrpg_chipset_interior" as const;
  const tileset = project.tilesets[tilesetId];
  const map = project.maps[project.startMapId];
  assert.ok(tileset && map);
  const root = {
    ...project,
    terrainTemplates: [{ id: "retired-root", cells: [12, 72] }],
    tilesets: { ...project.tilesets, [tilesetId]: {
      ...tileset, structureKits: [],
      terrainTemplates: [{ id: "retired-tileset", cells: [139] }],
      interiorRoomKinds: [{ id: "archive-room", label: "Archive", requiredRoles: ["decoration"], suggestedModifiers: ["custom-rule"] }],
    } },
  };
  const overlay = { ...map, events: [{
    id: "raw-shop", name: "Legacy shop", x: 2, y: 2,
    trigger: { kind: "action" }, commands: [],
    pages: [{ id: "shop-page", name: "Shop", conditions: [], graphic: { transparent: true },
      trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "shop", itemIds: [], allowSell: true }],
    }],
  }] };
  const baseline = { ...root, maps: { ...root.maps, [overlay.id]: overlay } };
  const json = JSON.stringify(baseline);
  const sha256 = createHash("sha256").update(json).digest("hex");
  return { root, overlay, baseline, json, sha256, tilesetId };
}

/** A schema candidate, not a converter: exposes the blocking asset reference. */
export function legacyGraphicCandidate(kitId: string) {
  const raw = legacyRawFixture();
  const document = {
    ...emptySpatialDocument(),
    library: { ...emptySpatialDocument().library, objects: {
      legacy: { ...designBase("legacy"), graphic: { tilesetId: raw.tilesetId, kitId }, anchors: [], chips: [] },
    } },
    legacyImport: { version: 1, sourceHash: raw.sha256, mapping: [],
      backup: { encoding: "raw-json", json: raw.json, sha256: raw.sha256 },
    },
  };
  return { ...raw, document };
}
