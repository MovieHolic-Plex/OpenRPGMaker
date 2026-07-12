/**
 * 방 구조(bbox) 데모 — map_interior_inn_rooms_v1 을 빌드해 JSON 으로 저장.
 * 라이브 반영: npx tsx scripts/save-inn-map-to-supabase.mts --json output/docs/interior-room-v1/map_interior_inn_rooms_v1.json [--force]
 */
import fs from "node:fs";
import path from "node:path";
import { INTERIOR_ROOM_DEMO_PLANS, runInteriorRoomPipeline } from "../src/editor/interiorRoomPipeline.ts";

const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.mapId === "map_interior_inn_rooms_v1");
if (!plan) throw new Error("rooms demo plan 없음");
const result = runInteriorRoomPipeline(plan);
console.log("critique:", result.ok ? "pass" : result.warnings);
if (!result.ok) process.exitCode = 1;
const outDir = path.resolve("output/docs/interior-room-v1");
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${plan.mapId}.json`);
fs.writeFileSync(file, JSON.stringify(result.map, null, 2));
console.log("wrote", file);
