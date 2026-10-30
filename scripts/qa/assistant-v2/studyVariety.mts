// 서재 다양성 판(모델 없음): 프롬프트 5개 × 게임(프로젝트 열쇠) 3개를 실내 빌더로 지어 1배 PNG·지표를 남긴다.
//   bun scripts/qa/assistant-v2/studyVariety.mts <outDir> [--furnish template|vignette|auto] [--tag before]
// make_place 가 넣는 값을 흉내 낸다: variety = `<프로젝트 열쇠>|<요청문>`(결정적), salt = 열쇠 해시(무작위 대신 고정 — 전/후 비교용).
// 사용자 신고(2026-10-29): 「서재」를 지으라고 하면 게임이 달라도 늘 같은 귀족 서재(authored-study-sq)가 나왔다.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/builders/index.ts";
import { measureInteriorBareFloor } from "../../../src/editor/handInterior/bareFloor.ts";
import type { PlaceSpec } from "../../../src/ai/v2/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const argv = process.argv.slice(2);
const opt = (name: string, d: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1]! : d; };
const out = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--"))) ?? "qa-runs/study-variety";
const furnish = opt("furnish", "auto");
const tag = opt("tag", "now");
fs.mkdirSync(out, { recursive: true });

export const STUDY_PROMPTS: readonly { id: string; spec: Omit<PlaceSpec, "salt"> }[] = [
  { id: "plain", spec: { type: "interior", name: "서재", zones: [{ kind: "study", purpose: "서재" }] } },
  { id: "wizard", spec: { type: "interior", name: "마법사의 서재", zones: [{ kind: "study", purpose: "마법사의 서재" }] } },
  { id: "small", spec: { type: "interior", name: "작은 서재", size: "small", zones: [{ kind: "study", purpose: "작은 서재" }] } },
  { id: "scholar", spec: { type: "interior", name: "학자의 서재", zones: [{ kind: "study", purpose: "학자의 서재" }] } },
  { id: "noble", spec: { type: "interior", name: "귀족 저택 서재", zones: [{ kind: "study", purpose: "귀족 저택의 서재" }] } },
];
export const STUDY_GAMES = ["proj-ashvale", "proj-moonharbor", "proj-thornkeep"] as const;
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const rows: Record<string, unknown>[] = [];
for (const p of STUDY_PROMPTS) for (const game of STUDY_GAMES) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const run = createBuildRun(ctx);
  // 마지막 build_hand_interior_room 결과(data.layout.rooms[].vignettes)를 잡아 둔다.
  let lastData: { layout?: { rooms?: { id: string; vignettes?: { placed: string[]; blockedShare: number } }[] }; rebuild?: { objects?: { id: string }[] } } | undefined;
  const call0 = run.call.bind(run);
  (run as { call: typeof run.call }).call = (tool, args) => { const r = call0(tool, args); if (tool === "build_hand_interior_room" && r.ok && (r as { data?: { layout?: unknown } }).data?.layout) lastData = (r as { data?: typeof lastData }).data; return r; };
  const spec: PlaceSpec = { ...p.spec, salt: hash(game) % 1_000_000, variety: `${game}|${p.spec.name}`, ...(furnish !== "auto" ? { hints: { furnish } } : {}) } as PlaceSpec;
  const builder = builderFor(spec)!;
  const res = builder.build(run, spec);
  const id = res.mapIds[0];
  const m = id ? ctx.project.maps[id] : undefined;
  const file = `${tag}-${p.id}-${game}.png`;
  let bare: number | undefined;
  if (m) { fs.writeFileSync(path.join(out, file), renderMapPng(ctx.project, m).png); bare = measureInteriorBareFloor(ctx.project, m)?.pct; }
  const last = [...run.calls].reverse().find((c) => c.tool === "build_hand_interior_room" && c.ok);
  const summary = last?.summary ?? "";
  const unreached = Number(/닿지 못한 빈 바닥 (\d+)/u.exec(summary)?.[1] ?? NaN);
  const warnCount = Number(/경고 (\d+)/u.exec(summary)?.[1] ?? NaN);
  const templates = (m?.locations ?? []).flatMap((l) => (l.tags ?? []).filter((t) => t.startsWith("template:")).map((t) => t.slice(9)));
  const roomsN = (m?.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room")).length;
  const placed = Object.fromEntries((lastData?.layout?.rooms ?? []).map((q) => [q.id, q.vignettes?.placed ?? []]));
  // 기능별 개수(사용자 「소파·책상·의자가 왜 이리 많냐」) — 지은 기물 목록에서 센다.
  const objs = (lastData?.rebuild?.objects ?? []).map((o) => o.id);
  const count = (re: RegExp) => objs.filter((id) => re.test(id)).length;
  const funcs = { desk: count(/^desk |captain desk|chart table|alchemy table|^work /u), chair: count(/^chair |stool/u), armchair: count(/armchair|sofa/u), shelf: count(/bookshelf|cabinet:book|scroll rack/u), table: count(/roundtable|^dining /u) };
  const row = { prompt: p.id, game, file, ok: res.ok, size: m ? `${m.width}x${m.height}` : "", template: templates.join(","), rooms: roomsN, placed, funcs, bare, unreached, warnings: warnCount, notes: res.warnings };
  rows.push(row);
  console.log(`${p.id.padEnd(8)} ${game.padEnd(16)} ${row.size.padEnd(6)} rooms=${roomsN} tpl=${row.template || "-"} bare=${bare}% unreached=${unreached} warn=${warnCount} ${JSON.stringify(funcs)}`);
}
fs.writeFileSync(path.join(out, `${tag}.json`), JSON.stringify(rows, null, 1));
