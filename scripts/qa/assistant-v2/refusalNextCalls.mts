// 거절 글이 이르는 «다음 호출» 을 실제로 불러 본다(모델 없음) — 이른 호출이 다시 거절되면 그 거절 글이 결함이다.
//   bun scripts/qa/assistant-v2/refusalNextCalls.mts <깔기 판의 jobs/<id> 폴더 — 칸 배치가 든 make_place 기록, 예: …/lay-main-…/jobs/tavern> [--only 1,2,6]
// ① 칸 배치 거절 → 고친 배치를 make_place 로 / 빈 mapId 의 edit_place layoutPatch 로 ② 빈 시작 맵에 온 edit_place → make_place
// ③ 칸 배치로 깔지 않은 마을에 온 layoutPatch(빈 껍데기 · 기물 · 문) ④ 칩셋 계열 거절 뒤 make_place(그 세계의 종류로 선다) ⑤ 치워진 빈 시작 맵 id
// ⑥ 선 마을에 물건 하나를 더하려는 edit_place → draw_object → place_object.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { createV2Tools } from "../../../src/ai/v2/tools/verbs.ts";
import { withTodoLoop } from "../../../src/ai/v2/loop/todoTools.ts";
import { V2Session } from "../../../src/ai/v2/turn/session.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/shared/env.ts";

const jobDir = process.argv[2];
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > 0 ? new Set(String(process.argv[onlyArg + 1]).split(",").map(Number)) : undefined;
const want = (n: number) => !only || only.has(n);
if (!jobDir) { console.error("usage: refusalNextCalls.mts <jobs/<id> folder with a make_place layout>"); process.exit(2); }
const rec = JSON.parse(fs.readFileSync(path.join(jobDir, "session/turns/001.json"), "utf8")) as { toolArgs: { name: string; args: Record<string, any> }[]; toolCalls?: { ok: boolean }[] };
// 그 판에서 깔린 배치를 쓴다(없으면 첫 배치) — 옛 규칙에서도 깔리던 것이라야 고친 것만 잰다.
const withLayout = rec.toolArgs.map((c, k) => ({ c, ok: !!rec.toolCalls?.[k]?.ok })).filter(({ c }) => c.name === "make_place" && c.args.layout?.outer_wall?.path?.length);
const laid = (withLayout.find((r) => r.ok) ?? withLayout[0])!.c.args;
let seed = 7; Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };
let bad = 0;
const fresh = (task: string) => {
  const project = createBlankProject();
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true };
  const forced: string[] = [];
  const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project }, emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), checkpoint: async () => {},
    preferToolNextTurn: (name: string) => { forced.push(name); }, clearToolPreference: () => {} } as unknown as PiAssistantV2Env;
  const session = new V2Session();
  const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
  const call = async (name: string, args: unknown) => {
    const r = await tools.find((t) => t.name === name)!.execute("p", args).catch((e: Error) => ({ content: [{ type: "text", text: JSON.stringify({ ok: false, summary: e.message }) }] }));
    const body = r.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("\n");
    let ok = true; try { const j = JSON.parse(body.split("\n")[0]!); ok = j.ok !== false || j.notFailure === true; } catch { ok = !/^Rejected:|\[Argument check/u.test(body); }
    return { ok, body };
  };
  return { ctx, call, forced, session };
};
const say = (label: string, pass: boolean, detail: string) => { if (!want(Number(label[0]))) return; if (!pass) bad++; console.log(`${pass ? "ok  " : "BAD "} ${label} — ${detail.replace(/\s+/gu, " ").slice(0, 260)}`); };
const nextLine = (body: string) => /\[Next call\] ([^\n]*)/u.exec(body)?.[1] ?? /Next call[^:]*: ([^\n]*)/u.exec(body)?.[1] ?? "(none)";
const noEmptyId = (body: string) => !/"mapId":""/u.test(body);

// ① 칸 배치 거절(없는 기물 id) → 다음 호출
if (want(1)) {
  const t = fresh("무기 가게 실내 맵을 만들어 줘.");
  await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "가게 만들기", id: "shop", check: { kind: "place", name: laid.name, placeKind: "interior", fresh: true } }] }] });
  const wrong = { ...laid, layout: { ...laid.layout, objects: [...laid.layout.objects, { id: "golden unicorn", x: 3, y: 3 }] } };
  const r0 = await t.call("make_place", wrong);
  say("1 layout with an unknown piece is rejected", !r0.ok, r0.body.slice(0, 120));
  say("1 the rejection says what to send again, lists the problem, and names no call with an empty mapId", /Send make_place again with the same name/u.test(r0.body) && /golden unicorn/u.test(r0.body) && !/another type or style/u.test(r0.body) && !/\[Next call\] (?!make_place)/u.test(r0.body) && noEmptyId(r0.body), r0.body.slice(0, 200));
  say("1 nothing is forced after the rejection", t.forced.length === 0, `forced: ${t.forced.join(",") || "-"}`);
  const viaEdit = await t.call("edit_place", { patch: { mapId: "", layoutPatch: { remove_objects: [{ id: "golden unicorn", x: 3, y: 3 }] } } });
  say("1 edit_place with an empty mapId patches the rejected layout and lays it", viaEdit.ok && t.ctx.project.maps[t.ctx.project.startMapId]!.name === laid.name, viaEdit.body.slice(0, 200));
  const again = await t.call("make_place", laid);
  say("1 the same place sent again is re-laid on its map (no second map)", again.ok && Object.keys(t.ctx.project.maps).length === 1, `maps ${Object.keys(t.ctx.project.maps).length}`);
}
// ② 빈 시작 맵에 온 edit_place
if (want(2)) {
  const t = fresh("여관 실내를 만들어 줘.");
  await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "여관 만들기", id: "inn", check: { kind: "place", name: "여관", placeKind: "interior", fresh: true } }] }] });
  const r0 = await t.call("edit_place", { patch: { mapId: "", addAnchors: [{ what: "침대" }] } });
  say("2 edit_place on the empty start map is refused with a make_place call that carries the place name and map id", !r0.ok && /make_place\(\{"type":"interior","name":"여관","mapId":"map_blank_start"\}\)/u.test(r0.body) && noEmptyId(r0.body), nextLine(r0.body));
  const r1 = await t.call("make_place", { type: "interior", name: "여관", mapId: "map_blank_start" });
  say("2 that make_place call is accepted (it returns the layout card, not a failure)", r1.ok, r1.body.slice(0, 140));
  const r2 = await t.call("edit_place", { patch: { mapId: "", set: { name: laid.name, layout: laid.layout } } });
  say("2 edit_place with a whole layout for a place that is not built yet is laid as make_place", r2.ok && !!t.ctx.project.maps.map_blank_start && t.ctx.project.maps.map_blank_start.name === laid.name, r2.body.slice(0, 160));
}
// ③ 마을(칸 배치 아님)에 온 layoutPatch · ④ 계열 거절 뒤 make_place · ⑤ 치워진 빈 시작 맵 id
if (want(3) || want(4) || want(5)) {
  const t = fresh("마을과 그 동쪽 들판을 만들어 줘.");
  await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "마을 만들기", id: "v", check: { kind: "place", name: "새벽 마을", placeKind: "village", fresh: true } }] }] });
  let made = await t.call("make_place", { type: "village", name: "새벽 마을", style: "pool:pirate_isles", size: "small" });
  if (!made.ok || !/"mapIds":\["/u.test(made.body)) made = await t.call("make_place", { type: "village", name: "새벽 마을", style: "pool:pirate_isles", size: "small" });
  const mapId = Object.values(t.ctx.project.maps).find((m) => m.name === "새벽 마을")?.id ?? "";
  say("3 a pool village is laid", made.ok && !!mapId, made.body.slice(0, 100));
  say("5 the start is on the village and the empty start map is gone", t.ctx.project.startMapId === mapId && !t.ctx.project.maps.map_blank_start, `start ${t.ctx.project.startMapId} · maps ${Object.keys(t.ctx.project.maps).length}`);
  const shell = { remove_objects: [], add_objects: [], remove_wall_items: [], add_wall_items: [], replace: { map: { w: 0, h: 0 }, landmark: { id: "", x: 0, y: 0 }, outer_wall: { material: "", path: [] }, walls: [], doors: [], entrance: { x: 0, y: 0 }, rooms: [], objects: [] } };
  const r0 = await t.call("edit_place", { patch: { mapId, layoutPatch: shell, variant: 0, dressing: 0, set: { name: "", layout: shell.replace } } });
  say("3 a schema-filled empty layoutPatch is not read as a layout patch", !/layoutPatch edits an interior/u.test(r0.body), r0.body.slice(0, 160));
  const r1 = await t.call("edit_place", { patch: { mapId, layoutPatch: { add_objects: [{ id: "barrel", x: 5, y: 5 }] } } });
  say("3 a real layoutPatch on a place without a cell layout names inspect with the real map id", !r1.ok && r1.body.includes(`inspect({"mapId":"${mapId}"})`) && noEmptyId(r1.body), nextLine(r1.body));
  const r2 = await t.call("inspect", { mapId });
  say("3 that inspect call is accepted", r2.ok, r2.body.slice(0, 80));
  const r3 = await t.call("edit_place", { patch: { mapId, layoutPatch: { replace: { doors: [{ wall: "outer", x: 12, y: 4 }] } } } });
  say("3 a door layoutPatch names create_transfer_pair with the door cell and the real map id", !r3.ok && r3.body.includes(`create_transfer_pair({"a":{"mapId":"${mapId}","x":12,"y":4}`), nextLine(r3.body));
  say("3 no call was forced by these refusals", t.forced.length === 0, `forced: ${t.forced.join(",") || "-"}`);
  // 숲길 지시서(prompt/forestBrief.ts)는 설계 없는 호출을 두 번까지 돌려보낸다 — 그 뒤의 답을 본다.
  let r4 = await t.call("author_forest_route", { fromMapId: mapId, side: "east", count: 1, names: ["동쪽 들판"], terrain: "field", linkFrom: true });
  for (let k = 0; k < 2 && /route brief/u.test(r4.body); k++) r4 = await t.call("author_forest_route", { fromMapId: mapId, side: "east", count: 1, names: ["동쪽 들판"], terrain: "field", linkFrom: true });
  const family = /타일 그림체를 바꾸지 않는다/u.test(r4.body);
  say("4 a route in another chipset family is refused and the next call is make_place with the place name", r4.ok || (family && /make_place\(\{"type":<[^>]*>,"name":"동쪽 들판"\}\)/u.test(nextLine(r4.body).replace(/\\"/gu, '"'))), r4.ok ? "(built — the brief or the family did not refuse)" : nextLine(r4.body));
  const r5 = await t.call("make_place", { type: "village", name: "동쪽 들판" });
  say("4 that make_place builds the place with the project's own chipset", r5.ok && Object.values(t.ctx.project.maps).some((m) => m.name === "동쪽 들판" && m.tilesetId === t.ctx.project.maps[mapId]!.tilesetId), r5.body.slice(0, 200));
  const r6 = await t.call("make_place", { type: "interior", name: "촌장 집", layout: laid.layout });
  say("4 an interior after the pool village is built with that chipset too (not refused by the chipset family rule)", r6.ok && Object.values(t.ctx.project.maps).some((m) => m.name === "촌장 집"), r6.body.slice(0, 200));
  const r7 = await t.call("inspect", { mapId: "map_blank_start" });
  say("5 a call that still uses the removed start map id is sent to the start map", r7.ok && /was removed when the first place was built/u.test(r7.body), r7.body.slice(-200));
}
// ⑥ 선 마을에 물건 하나를 더하려는 edit_place(빌더가 받지 않는 고침) · 바뀌는 것이 없는 고침
if (want(6)) {
  const t = fresh("시장 마을을 만들어 줘.");
  await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "마을 만들기", id: "v", check: { kind: "place", name: "시장 마을", placeKind: "village", fresh: true } }, { content: "광장에 노점 놓기", id: "stalls" }] }] });
  // 버들항 마을은 첫 호출에 땅 그림을 돌려주고(실패 아님) 둘째 호출에 짓는다.
  let made = await t.call("make_place", { type: "village", name: "시장 마을", style: "fantasy", size: "medium", features: ["plaza", "market stalls"], floors: 1 });
  if (/"notFailure":true/u.test(made.body)) made = await t.call("make_place", { type: "village", name: "시장 마을", style: "fantasy", size: "medium", features: ["plaza", "market stalls"], floors: 1 });
  const mapId = t.ctx.project.startMapId;
  say("6 a village is laid", made.ok && t.ctx.project.maps[mapId]!.name === "시장 마을", `${made.body.slice(0, 120)} · start ${mapId}`);
  const r0 = await t.call("edit_place", { patch: { mapId, set: { name: "", size: "medium", floors: 1, features: ["plaza", "market stalls"] }, addAnchors: [{ zone: "광장", what: "시장 노점", near: { x: 21, y: 25 } }], variant: 0, dressing: 0 } });
  say("6 a single prop sent to edit_place names draw_object with the prop, the real map id and the cell", !r0.ok && r0.body.includes(`draw_object({"object":{"what":"시장 노점","mapId":"${mapId}","at":{"x":21,"y":25}}})`) && !/\[Next call\]/u.test(r0.body), r0.body.slice(0, 400));
  const r1 = await t.call("draw_object", { object: { what: "시장 노점", mapId, at: { x: 21, y: 25 } } });
  const again = /Next call: place_object\((\{.*?\})\) —/u.exec(r1.body.replace(/\\"/gu, '"'))?.[1];
  say("6 that draw_object call draws, or — the chipset has such an object — names place_object with its id, the real map id and the cell", r1.ok || (!!again && again.includes(`"mapId":"${mapId}"`) && again.includes('"at":{"x":')), r1.body.slice(0, 420));
  if (again) { const r3 = await t.call("place_object", JSON.parse(again)); say("6 that place_object call puts the object on the map", r3.ok, r3.body.slice(0, 200)); }
  const r2 = await t.call("edit_place", { patch: { mapId, set: { name: "", size: "medium", floors: 1, features: ["plaza", "market stalls"] }, variant: 0, dressing: 0, addAnchors: [] } });
  say("6 an edit that changes nothing says so and names inspect with the real map id", !r2.ok && /changes nothing/u.test(r2.body) && r2.body.includes(`inspect({"mapId":"${mapId}"})`), r2.body.slice(0, 300));
}
console.log(bad ? `\n${bad} BAD` : "\nall next calls accepted");
process.exit(bad ? 1 : 0);
