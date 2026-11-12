// 겉모습을 고른 버들항 마을 프로젝트를 project.json 으로 쓴다(모델 없음) — 런타임 QA 시나리오 tileset-look 의 픽스처.
//   bun scripts/content/beodeul-variety/lookFixture.mts <폴더> [게임 이름=moonharbor] [씨앗=91357]
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { serialize } from "../../../src/project/io.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { describeTilesetLook } from "../../../src/assets/tilesetLooks.ts";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const [out, name = "moonharbor", salt = "91357"] = process.argv.slice(2);
if (!out) throw new Error("lookFixture.mts <폴더> [게임 이름] [씨앗]");
const key = JSON.stringify(["project", `variety-${name}`]);
const project = createBlankProject();
const ctx = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: key } as ToolContext;
const spec = { type: "village", name: "버들 마을", salt: Number(salt), variety: `${key}|강가에 작은 마을을 만들어 줘` } as PlaceSpec;
const res = builderFor(spec)!.build(createBuildRun(ctx), spec);
if (!res.ok) throw new Error(res.summary);
const map = ctx.project.maps[res.mapIds[0]!]!;
if (res.entrance && res.entrance.mapId === map.id) { ctx.project.startMapId = map.id; ctx.project.startPos = { x: res.entrance.x, y: res.entrance.y }; }
// 시작하자마자 마을이 보이게 기본 오프닝은 뺀다(런타임 QA 가 첫 화면을 찍는다)
delete (ctx.project.system as { opening?: unknown }).opening;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "project.json"), serialize(ctx.project));
fs.writeFileSync(path.join(out, "map-1x.png"), renderMapPng(ctx.project, map).png);
console.log(`${path.join(out, "project.json")} · ${map.width}×${map.height} · 겉모습 [${describeTilesetLook(map.tilesetId, ctx.project.tilesets[map.tilesetId]!.look) || "원래 모습"}] · 시작 (${ctx.project.startPos.x},${ctx.project.startPos.y})`);
