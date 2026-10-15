// 연애 첫 만남 무대 지정·범위 완화 증거 — 모델 없이 헤드리스 도구 경로(runTool)로 돈다.
//   bun scripts/qa/romance-fix/stage.mts <baseline.json> <outDir>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { runTool } from "../../../src/editor/tools/index.ts";
import { deserialize, serialize } from "../../../src/project/io.ts";
import { withVerifiedPlayableSegment, judgePlayableSegment } from "../../../src/project/playableSegment.ts";
import { inspectRomanceScene } from "../../../src/harnesses/romance-scene/runtime.ts";
import { romanceStageFlatFindings } from "../../../src/harnesses/romance-scene/artDirection.ts";
import type { Project } from "../../../src/project/types.ts";
const [baselineFile, outDir] = process.argv.slice(2) as [string, string];
mkdirSync(outDir, { recursive: true });
const log: Record<string, unknown> = {};
const baseline = deserialize(readFileSync(baselineFile, "utf8"));
const prose = { opening: ["도서관 앞이네요. 오랜만이에요, 잘 지냈어요?"], reactionA: "먼저 책을 건네줘서 고마워요. 예전 그대로네요.", reactionB: "말없이 지나치는 건 여전하네요. 그래도 반가웠어요.",
  revisitA: "아까 책을 건네준 일, 기억하고 있어요. 고마웠어요.", revisitB: "아까 말없이 지나간 일, 아직 기억해요. 다음엔 인사해요.", closing: "오늘 다시 만나서 반가웠어요. 또 봐요." };

// 1. 시드 — 단색 잔디가 아니라 구성기로 깐 캠퍼스에서 시작한다.
const seeded = withVerifiedPlayableSegment(baseline)!;
const start = seeded.maps[seeded.startMapId]!;
log.seed = { maps: Object.keys(seeded.maps).length, tileset: start.tilesetId, size: [start.width, start.height], name: start.name, locations: start.locations?.length ?? 0 };
assert.equal(start.tilesetId, "modern_campus");
assert.ok((start.locations?.length ?? 0) >= 3);
const ctx = { project: structuredClone(seeded) as Project };
let r = runTool(ctx, "author_romance_scene", prose); assert.ok(r.ok, JSON.stringify(r));
const authored = structuredClone(ctx.project);
log.authoredInspect = inspectRomanceScene(authored, seeded).ok;
assert.equal(romanceStageFlatFindings(authored).length, 0);
log.judge = judgePlayableSegment(authored, { expected: seeded }).ok;
assert.ok((log.judge as boolean));

// 2. 이어진 실내 맵은 허용 — 건물 문과 실내를 잇는다.
r = runTool(ctx, "build_hand_interior_room", { tileset: "modern_campus", name: "중앙도서관", layout: { program: "school-special-wing" }, floor: "mc-floor-parquet", wall: "mc-wall-class" }); log.buildInterior = r.ok ? r.summary.slice(0, 120) : r.summary;
const interiorId = Object.keys(ctx.project.maps).find(id => id !== ctx.project.startMapId)!;
const locs = ctx.project.maps[ctx.project.startMapId]!.locations ?? [];
const building = locs.find(l => (l.tags ?? []).includes("campus-building"))!.name.replace(/ 건물$/, "");
r = runTool(ctx, "link_campus_interior", { mapId: ctx.project.startMapId, building, interiorMapId: interiorId }); log.link = r.ok ? r.summary.slice(0, 160) : r.summary;
const linked = inspectRomanceScene(ctx.project, seeded);
log.extraLinkedMapInspect = { ok: linked.ok, blockers: linked.blockers };
assert.ok(linked.ok, JSON.stringify(linked));

// 3. 이어지지 않은 맵은 반려.
const orphanCtx = { project: structuredClone(authored) as Project };
r = runTool(orphanCtx, "create_map", { name: "방치된 맵", width: 20, height: 15 }); assert.ok(r.ok, r.summary);
const orphan = inspectRomanceScene(orphanCtx.project, seeded);
log.orphanInspect = { ok: orphan.ok, blockers: orphan.blockers };
assert.ok(!orphan.ok && orphan.blockers.some(b => b.includes("이어지지 않은")));

// 4. set_romance_stage — 단색 잔디 시작 맵(구성기 이전 상태)에서 다른 맵으로 무대를 옮긴다.
const flat = { project: deserialize(serialize(baseline)) as Project };
// 구성기 없이 옛 방식(빈 시작 맵)으로 하네스만 시드한다 — 감사 R2 의 재현.
const legacy = (await import("../../../src/harnesses/romance-scene/runtime.ts")).seedRomanceScene(flat.project)!;
const flatCtx = { project: structuredClone(legacy) as Project };
// 첫 대화를 먼저 쓴다(하네스 규칙) — 그 뒤에 장소를 꾸민다. 이 시점의 화면은 20×15 단색 잔디다.
r = runTool(flatCtx, "author_romance_scene", prose); assert.ok(r.ok, JSON.stringify(r));
log.flatBeforeFindings = romanceStageFlatFindings(flatCtx.project);
assert.ok((log.flatBeforeFindings as string[]).length === 1);
log.flatJudgeBefore = judgePlayableSegment(flatCtx.project, { expected: legacy });
assert.equal((log.flatJudgeBefore as { ok: boolean }).ok, false);
r = runTool(flatCtx, "create_map", { name: "도시 거리", tilesetId: "modern_city", width: 60, height: 48 }); assert.ok(r.ok, r.summary);
const cityId = Object.keys(flatCtx.project.maps).find(id => id !== legacy.startMapId)!;
r = runTool(flatCtx, "compose_modern_city_street", { mapId: cityId, seed: 5, shops: ["카페", "편의점"] }); assert.ok(r.ok, r.summary);
const preStage = inspectRomanceScene(flatCtx.project, legacy, { allowDraft: true });
log.beforeSetStage = { ok: preStage.ok, blockers: preStage.blockers };
r = runTool(flatCtx, "set_romance_stage", { mapId: cityId }); log.setStage = { ok: r.ok, summary: r.summary };
assert.ok(r.ok, r.summary);
const stillOld = inspectRomanceScene(flatCtx.project, legacy, { allowDraft: true });
log.afterSetStageOldMapStillThere = { ok: stillOld.ok, blockers: stillOld.blockers };
assert.ok(!stillOld.ok);
r = runTool(flatCtx, "remove_map", { mapId: legacy.startMapId }); log.removeOld = { ok: r.ok, summary: r.summary.slice(0, 160) };
assert.ok(r.ok, r.summary);
log.flatAfterFindings = romanceStageFlatFindings(flatCtx.project);
assert.equal((log.flatAfterFindings as string[]).length, 0);
const finalCity = inspectRomanceScene(flatCtx.project, legacy);
log.cityInspect = { ok: finalCity.ok, blockers: finalCity.blockers };
assert.ok(finalCity.ok, JSON.stringify(finalCity));
writeFileSync(`${outDir}/stage-city.json`, serialize(flatCtx.project));
writeFileSync(`${outDir}/stage-campus.json`, serialize(ctx.project));
writeFileSync(`${outDir}/stage-log.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 1));
