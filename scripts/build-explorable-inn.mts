/** Preview by default. --save updates the existing isolated inn after checking for concurrent edits. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync";
import { deserialize, serialize } from "../src/project/io";
import { createBlankProject } from "../src/project/defaults";
import { runTool } from "../src/editor/tools/toolRunner";
import { SCRATCH_INN_BUNDLE, cloneConceptBundle } from "../src/project/defaults/scratchInnBundle";
import { interiorObjectById } from "../src/editor/interiorObjectCatalog";
import { bakeInteriorObject } from "../src/editor/harnessSuggestion/structureKitRasterModel";
import { renderInteriorMapPng, writePng } from "./lib/renderInteriorMapPng.mts";
import { computeReachableCells, isAdjacentOrOn } from "../src/project/lint/reachability";
import { runWalkthrough, type WalkthroughStep } from "../src/testing/walkthroughRunner";
import type { ConceptLayoutRoom } from "../src/editor/conceptBundleResolve";
import type { GameMap } from "../src/project/types";
import { applyEasyRpgThemeMetadataPacks } from "../src/project/tilesetHarness/themePacks";

const out = "output/evidence/inn-exploration-v4";
const mapId = "map_inn_wander";
const ids = [mapId, `${mapId}_2f`, `${mapId}_3f`];
const tilesetId = "easyrpg_chipset_interior";
const config = await configFromEnv();
assert.equal(config.projectId, "rpg-zzu-house-template-gallery");
const target = { ...config, projectId: "rpg-zzu-inn-exploration-v4" };
const base = await loadProjectFromSupabase(target);
assert.ok(base, "Remote project must load before authoring");
// Build against the live tileset in a detached project. The tool's global changeset
// normalizers must not repaint unrelated village maps while authoring an interior.
const ctx = { project: createBlankProject() };
ctx.project.tilesets[tilesetId] = structuredClone(base.tilesets[tilesetId]!);
const tileset = ctx.project.tilesets[tilesetId];
assert.ok(tileset);
applyEasyRpgThemeMetadataPacks(tileset);
// Refresh only the reviewed stair, reception-table and flue definitions.
for (const id of ["stairs_horizontal", "stairs_down", "counter", "flue"]) {
  const object = interiorObjectById(id);
  assert.ok(object);
  const kit = { ...bakeInteriorObject(object, id, object.label), learnedFrom: "interior-catalog" as const, ai: { snap: object.snap, themes: [...object.themes], ...(object.role ? { interiorRole: object.role } : {}) } };
  tileset.structureKits = [...(tileset.structureKits ?? []).filter(kit => kit.id !== id), kit];
}
tileset.scratchConceptBundles = [
  ...(tileset.scratchConceptBundles ?? []).filter(bundle => bundle.id !== "inn"),
  cloneConceptBundle(SCRATCH_INN_BUNDLE),
];
const result = runTool(ctx, "place_concept", { query: "inn", name: "여행자의 등불 여관", mapId, seed: 7 }, { dryRun: false });
assert.ok(result.ok, result.summary);
const warnings = [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])];
assert.deepEqual(warnings, []);
type Room = ConceptLayoutRoom & { roomId: string; mapId: string; level: number };
const data = result.data as { rooms: Room[]; door: { x: number; y: number }; floors: { mapId: string; level: number }[] };
const names = ["여행자의 등불 · 식당과 접수", "여행자의 등불 · 길손들의 객실", "여행자의 등불 · 작은 다락"];
const stories: Record<string, string> = {
  dorm_bed_b: "이불만 반듯하게 개켜져 있다. 베개 밑 쪽지에는 '해 뜨기 전에 호수에서 만나자'고 적혀 있다.",
  dorm_bag: "진흙 묻은 장화와 젖은 지도가 나란히 말라 간다. 지도에는 북쪽 길만 여러 번 덧그려져 있다.",
  merchant_ledger: "장부 가장자리에 작은 글씨가 빼곡하다. '물건보다 약속을 먼저 싣는다.' 호수 건너 마을로 가는 주문서다.",
  merchant_crate: "상자마다 다른 마을의 이름이 적혀 있다. 하나에는 '깨지기 쉬움' 대신 '꽃이 잠들어 있음'이라고 쓰여 있다.",
  single_box: "머리맡 상자 위에 편지가 남아 있다. '방은 작지만, 계단을 오르는 발소리가 들려 외롭지 않았습니다.'",
  suite_tea: "차가 식어 간다. 창가에 앉으면 아래층 숟가락 부딪치는 소리와 멀리 호수의 물소리가 함께 들린다.",
  old_sign: "먼지를 걷어 내자 '첫 새벽 여관'이라는 옛 이름이 드러난다. 지금의 간판보다 훨씬 작다.",
  travel_records: "주인의 젊은 날 여행 기록이다. 마지막 장에는 지도가 아니라 이 여관의 첫 도면이 붙어 있다.",
  spare_linen: "이불 사이에 작은 표찰이 끼어 있다. '길이 막힌 날에는 방값을 받지 말 것.' 오래전부터 지켜 온 약속인 모양이다.",
  hearth: "난로 곁에는 크기가 서로 다른 장갑이 걸려 있다. 어느 여행자의 것이든 마르면 카운터에 맡겨 둔다.",
  stored_luggage: "맡긴 짐마다 이름표가 달려 있다. 유난히 오래된 하나에는 이름 대신 '다시 올 사람'이라고만 적혀 있다.",
};
for (const [index, id] of ids.entries()) {
  const map = ctx.project.maps[id];
  assert.ok(map);
  map.name = names[index] ?? map.name;
  for (const event of map.events) for (const [thingId, body] of Object.entries(stories)) {
    if (!event.id.startsWith(`ev_concept_${id}_${thingId}_`)) continue;
    for (const page of event.pages ?? []) {
      page.commands = page.commands.map(command => command.kind === "text" ? { kind: "text", body } : command);
    }
  }
}
const ground = ctx.project.maps[mapId];
assert.ok(ground);
ctx.project.startMapId = mapId;
ctx.project.startPos = { x: data.door.x, y: data.door.y - 1 };
const playable = deserialize(serialize(ctx.project));
const steps: WalkthroughStep[] = [];
let sourceId = mapId;
for (const targetId of [ids[1], ids[2], ids[1], ids[0]]) {
  assert.ok(targetId);
  const map = playable.maps[sourceId];
  assert.ok(map);
  const event = map.events.find(event => [...event.commands, ...(event.pages ?? []).flatMap(page => page.commands)]
    .some(command => command.kind === "transfer" && command.mapId === targetId));
  assert.ok(event, `${sourceId} must connect to ${targetId}`);
  steps.push(
    { expect: "mapId", mapId: sourceId },
    { do: "moveTo", mapId: sourceId, x: event.x, y: event.y + 1 },
    { do: "interact", eventId: event.id },
    { expect: "mapId", mapId: targetId },
  );
  sourceId = targetId;
}
const walkthrough = runWalkthrough(playable, steps, { seed: 7 });
assert.ok(walkthrough.ok, walkthrough.failureReason ?? "Stair walkthrough failed");
const access = ids.map(id => {
  const map = playable.maps[id];
  assert.ok(map);
  const entry = map.events.find(event => event.id === `ev_entrance_${id}`);
  assert.ok(entry);
  const reachable = computeReachableCells(playable, map, entry.x, entry.y + (id === mapId ? -1 : 1));
  const unreachable = map.events.filter(event => !isAdjacentOrOn(reachable, event.x, event.y));
  assert.deepEqual(unreachable.map(event => event.id), [], `${id}: unreachable interactions`);
  return { mapId: id, reachableCells: reachable.size, events: map.events.length, unreachable: [] };
});
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/preview-project.json`, serialize(playable));
fs.writeFileSync(`${out}/build.json`, JSON.stringify({ ...data, warnings, access, walkthrough: { ok: walkthrough.ok, stepsRun: walkthrough.stepsRun, log: walkthrough.log } }, null, 2));
fs.writeFileSync(`${out}/bundle.json`, JSON.stringify(SCRATCH_INN_BUNDLE, null, 2));
for (const [index, id] of ids.entries()) {
  const map = playable.maps[id];
  assert.ok(map);
  writePng(renderInteriorMapPng(map, playable.tilesets[tilesetId]!, { scale: 3 }), `${out}/floor-${index + 1}.png`);
}
console.log(JSON.stringify({ preview: true, maps: ids, access, walkthrough: walkthrough.ok }));
if (process.argv.includes("--save")) {
  assert.deepEqual(await loadProjectFromSupabase(target), base, "Concurrent edit: reload before saving");
  fs.writeFileSync(`${out}/before-architecture-save.json`, serialize(base));
  for (const [index, id] of ids.entries()) {
    const previousMap: GameMap | undefined = base.maps[id];
    assert.ok(previousMap);
    writePng(renderInteriorMapPng(previousMap, base.tilesets[tilesetId]!, { scale: 3 }), `${out}/before-architecture-floor-${index + 1}.png`);
  }
  const standalone = structuredClone(base);
  for (const id of ids) standalone.maps[id] = playable.maps[id]!;
  standalone.tilesets[tilesetId] = playable.tilesets[tilesetId]!;
  standalone.startMapId = mapId;
  standalone.startPos = playable.startPos;
  const saved = await saveProjectToSupabase(standalone, target);
  assert.equal(saved.kind, "saved");
  const reloaded = await loadProjectFromSupabase(target);
  assert.ok(reloaded);
  for (const id of ids) assert.deepEqual(reloaded.maps[id], standalone.maps[id]);
  assert.deepEqual(reloaded.tilesets[tilesetId]?.scratchConceptBundles?.find(bundle => bundle.id === "inn"), SCRATCH_INN_BUNDLE);
  for (const tile of [176, 209, 239, 408, 409, 410, 474, 475]) {
    assert.deepEqual(reloaded.tilesets[tilesetId]?.tileMeta?.[tile], standalone.tilesets[tilesetId]?.tileMeta?.[tile]);
  }
  for (const id of ["stairs_down", "counter", "flue"]) {
    assert.deepEqual(reloaded.tilesets[tilesetId]?.structureKits?.find(kit => kit.id === id), standalone.tilesets[tilesetId]?.structureKits?.find(kit => kit.id === id));
  }
  assert.equal(reloaded.startMapId, mapId);
  fs.writeFileSync(`${out}/reloaded-project.json`, serialize(reloaded));
  const proof = { projectId: target.projectId, sourceProjectId: config.projectId, saved: true, appReload: true, tileMetadataReload: true, correctedKitReload: true, sourceProjectUnmodified: true, addedMaps: ids, verifiedAt: new Date().toISOString() };
  fs.writeFileSync(`${out}/supabase-proof.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
}
