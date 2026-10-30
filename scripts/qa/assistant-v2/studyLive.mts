// 서재 실제 조수 시험(study-live.sh) 결과 모으기: 모델·요청마다 마지막 make_place 의 방 설계, 실제로 지어진 맵 1배 그림, 함수가 고친 것 목록.
//   bun scripts/qa/assistant-v2/studyLive.mts <batch dir> <out dir>
// 고친 것 목록은 실행 기록에 요약만 남으므로, 같은 명세를 지금 빌더로 다시 지어(설계 방은 결정적) warnings 의 「고침:」 줄을 얻는다.
// 다시 지은 그림이 실제 맵과 화소까지 같은지도 적는다(replaySame).
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/builders/index.ts";
import { measureInteriorBareFloor } from "../../../src/editor/handInterior/bareFloor.ts";
import type { PlacePatch, PlaceSpec } from "../../../src/ai/v2/types.ts";
import { applyPatch } from "../../../src/ai/v2/verbs.ts";
import type { Project } from "../../../src/project/types.ts";

const [batch, out] = process.argv.slice(2);
if (!batch || !out) throw Error("studyLive <batch dir> <out dir>");
fs.mkdirSync(out, { recursive: true });
const rows: Record<string, unknown>[] = [];
const count = (ids: string[], re: RegExp) => ids.filter((id) => re.test(id)).length;
const funcsOf = (ids: string[]) => ({ desk: count(ids, /^desk |chart table|alchemy table/u), chair: count(ids, /^chair |stool/u), armchair: count(ids, /armchair|sofa/u), shelf: count(ids, /bookshelf|cabinet:book|scroll rack/u), table: count(ids, /roundtable|^dining /u) });
for (const arm of fs.readdirSync(batch).sort()) {
  const armDir = path.join(batch, arm);
  if (!fs.statSync(armDir).isDirectory()) continue;
  for (const pid of fs.readdirSync(armDir).sort()) {
    if (pid.includes("try")) continue;
    const G = path.join(armDir, pid);
    const turnsDir = path.join(G, "session", "turns");
    if (!fs.existsSync(turnsDir)) continue;
    const calls: { name: string; args: Record<string, unknown>; ok?: boolean; summary?: string }[] = [];
    let answer = "";
    for (const f of fs.readdirSync(turnsDir).filter((f) => f.endsWith(".json")).sort()) {
      const t = JSON.parse(fs.readFileSync(path.join(turnsDir, f), "utf8"));
      const ends = (t.toolCalls ?? []) as { name: string; ok?: boolean; summary?: string }[];
      (t.toolArgs ?? []).forEach((a: { name: string; args: Record<string, unknown> }, i: number) => calls.push({ ...a, ok: ends[i]?.ok, summary: ends[i]?.summary }));
      if (t.answer) answer = String(t.answer);
    }
    const makes = calls.filter((c) => c.name === "make_place" && c.ok);
    // 최종 명세 = 마지막 make_place + 그 뒤 성공한 edit_place 패치(실행기와 같은 applyPatch).
    const lastIdx = calls.lastIndexOf(makes[makes.length - 1]!);
    let spec = lastIdx >= 0 ? ((calls[lastIdx]!.args.spec ?? calls[lastIdx]!.args) as PlaceSpec) : undefined;
    const edits = lastIdx >= 0 ? calls.slice(lastIdx + 1).filter((c) => c.name === "edit_place" && c.ok) : [];
    for (const e of edits) { const patch = (e.args.patch ?? e.args) as PlacePatch; if (spec) spec = applyPatch(spec, { ...patch, mapId: patch.mapId ?? "" }); }
    const designs = (spec?.zones ?? []).map((z) => z.design).filter(Boolean);
    const projFile = path.join(G, "check", "project.json");
    const live = fs.existsSync(projFile) ? (JSON.parse(fs.readFileSync(projFile, "utf8")) as Project) : undefined;
    const mapId = live ? (Object.values(live.maps).find((m) => (m.locations ?? []).some((l) => (l.tags ?? []).includes("hand-layout-room")))?.id ?? live.startMapId) : undefined;
    const m = live && mapId ? live.maps[mapId] : undefined;
    const file = `live-${arm}-${pid}.png`;
    let livePng: Buffer | undefined;
    if (live && m) { livePng = renderMapPng(live, m).png; fs.writeFileSync(path.join(out, file), livePng); }
    // 다시 짓기(고친 것 목록·기물 수).
    let fixes: string[] = [], warnings: string[] = [], replaySame: boolean | undefined, objects: string[] = [], bare: number | undefined;
    if (spec) {
      const project = createBlankProject();
      const ctx = { project, currentMapId: project.startMapId, assistantRun: true } as never as { project: Project; currentMapId: string };
      const run = createBuildRun(ctx as never);
      let lastData: { rebuild?: { objects?: { id: string }[] } } | undefined;
      const call0 = run.call.bind(run);
      (run as { call: typeof run.call }).call = (tool, args) => { const r = call0(tool, args); if (tool === "build_hand_interior_room" && r.ok && (r as { data?: { rebuild?: unknown } }).data?.rebuild) lastData = (r as { data?: typeof lastData }).data; return r; };
      const { mapId: _drop, ...rest } = spec as PlaceSpec & { mapId?: string };
      const res = builderFor(rest as PlaceSpec)?.build(run, rest as PlaceSpec);
      warnings = res?.warnings ?? [];
      fixes = warnings.filter((w) => /^고침:|^설계 /u.test(w));
      objects = (lastData?.rebuild?.objects ?? []).map((o) => o.id).filter((id) => !/^door|sidedoor/u.test(id));
      const rm = res?.mapIds[0] ? ctx.project.maps[res.mapIds[0]] : undefined;
      if (rm) {
        const png = renderMapPng(ctx.project, rm).png;
        fs.writeFileSync(path.join(out, `replay-${arm}-${pid}.png`), png);
        replaySame = livePng ? Buffer.compare(png, livePng) === 0 : undefined;
        bare = measureInteriorBareFloor(ctx.project, rm)?.pct;
      }
    }
    const liveBare = live && m ? measureInteriorBareFloor(live, m)?.pct : undefined;
    const used = calls.map((c) => c.name);
    rows.push({ arm, pid, file, edits: edits.length, mapSize: m ? `${m.width}x${m.height}` : "", designed: designs.length > 0, designs, makes: makes.length, tools: used, fixes, otherWarnings: warnings.filter((w) => !fixes.includes(w)).slice(0, 6), replaySame, bare: liveBare ?? bare, funcs: funcsOf(objects), objects, answer: answer.slice(0, 500) });
    console.log(`${arm.padEnd(6)} ${pid.padEnd(8)} ${m ? `${m.width}x${m.height}` : "-"} designed=${designs.length > 0} makes=${makes.length} fixes=${fixes.length} same=${replaySame} bare=${liveBare} tools=${used.join(",")}`);
  }
}
fs.writeFileSync(path.join(out, "live.json"), JSON.stringify(rows, null, 1));
