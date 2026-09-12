import { expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { runTool } from "@/editor/tools/toolRunner";
import { computeReachableCells } from "@/project/lint/reachability";
import { emptySpatialDocument } from "./support/spatialSchemaFixture";
import { buildHouse30BatchA } from "../scripts/lib/house30BatchA.mts";
import { buildHouse30BatchB } from "../scripts/lib/house30BatchB.mts";
import { buildHouse30BatchC } from "../scripts/lib/house30BatchC.mts";
import { buildCompactVillageHouses } from "../scripts/lib/compactVillageHouses.mts";
import { HOUSE_STUDIES, bakeHouseStudy } from "../scripts/lib/houseStudyDesigns.mts";
import { buildSettlementReferenceHouses } from "../scripts/lib/settlementReferenceHouses.mts";
import { inspectHouse30 } from "../scripts/lib/house30Authoring.mts";
import { smallVillageDefinition } from "../scripts/lib/smallVillageDefinition.mts";
import { registerVillageDecorationCatalog } from "../scripts/lib/villageDecorationCatalog.mts";

it("combines all three house catalogs and counts a three- and four-storey landmark in the exact upstairs quota", () => {
  const entries = [
    ...[...buildHouse30BatchA(), ...buildHouse30BatchB(), ...buildHouse30BatchC()].map(e => ({ ...e, id: `house30:${e.number}` })),
    ...[...buildCompactVillageHouses(), ...buildSettlementReferenceHouses()].map(e => ({ ...e, floors: e.exteriorStories })),
    ...HOUSE_STUDIES.map(study => ({ id: `study:${study.id}`, name: study.name, kit: bakeHouseStudy(study), doors: study.doors,
      floors: ["townhouse", "setback", "inn", "workshop"].includes(study.id) ? 2 as const : 1 as const })),
  ];
  expect(entries).toHaveLength(57);
  const project = createBlankProject();
  project.tilesets[DEFAULT_TILESET_ID]!.structureKits = entries.map(e => e.kit);
  project.spatialAuthoring = emptySpatialDocument();
  project.spatialAuthoring.library.objects = Object.fromEntries(entries.map(e => [e.id, {
    id: e.id, name: e.name, revision: 2, exteriorStories: e.floors, chips: [], tags: [], provenance: { origin: "user" },
    graphic: { tilesetId: DEFAULT_TILESET_ID, kitId: e.kit.id },
    anchors: e.doors.map((d, i) => ({ id: `door:${i}`, name: "현관 앞", x: d.x, y: d.y + 1 })),
  }]));
  const preset = smallVillageDefinition(entries.map(e => e.id));
  preset.design!.objectVillage!.decorations = registerVillageDecorationCatalog(project);
  preset.design!.stories = [1, 2, 3, 4];
  project.villagePresets = [preset];
  const context = { project };
  const result = runTool(context, "author_village", { target: { kind: "new", mapId: "revised-village", name: "Revised catalog" },
    presetId: preset.id, countPolicy: "exact", seed: 20260913,
    housePlans: [{ objectId: "house30:26" }, { objectId: "house30:23" }, ...Array.from({ length: 24 }, () => ({}))] });
  expect(result.ok, result.summary).toBe(true);
  const map = context.project.maps["revised-village"]!;
  const houses = map.layoutPlan!.regions.filter(r => r.objectExterior);
  expect(houses).toHaveLength(26);
  expect(houses.filter(r => r.tags?.includes("exterior-stories:1"))).toHaveLength(23);
  for (const floor of [2, 3, 4]) expect(houses.filter(r => r.tags?.includes(`exterior-stories:${floor}`))).toHaveLength(1);
  expect(houses.filter(r => r.w > 10 || r.h > 10)).toHaveLength(2);
  expect(houses.some(r => r.objectExterior!.objectId.startsWith("study:"))).toBe(true);
  expect(houses.some(r => r.objectExterior!.objectId.startsWith("compact-village-"))).toBe(true);
  const reachable = computeReachableCells(context.project, map, context.project.startPos.x, context.project.startPos.y);
  expect(houses.flatMap(r => r.objectExterior!.doorApproaches).every(d => reachable.has(`${d.x},${d.y}`))).toBe(true);
  const decorations = map.layoutPlan!.regions.filter(r => r.tags?.includes("village-decoration"));
  for (const zone of ["house", "commons", "market", "shore", "road"]) expect(decorations.some(r => r.tags?.includes(`zone:${zone}`))).toBe(true);
  expect(decorations.every(r => reachable.has(`${r.front!.x},${r.front!.y}`))).toBe(true);
  expect(map.villageDesignSource?.resolvedSettings.spaceDecorations).toBeDefined();
}, 90_000);

it("keeps four settlement roof contours connected after removing log walls and map decoration", () => {
  const references = buildSettlementReferenceHouses();
  const report = inspectHouse30(references.map((e,i) => ({ number: i+1, name: e.name, description: "정주지 참고", family: "박공", floors: e.exteriorStories,
    doors: e.doors, kit: { ...e.kit, id: `house-30-0${i+1}-reference-check` } })));
  expect(report).toHaveLength(4);
  expect(report.every(r => r.connectedRoof && r.exteriorDoorApproaches === 1)).toBe(true);
});
