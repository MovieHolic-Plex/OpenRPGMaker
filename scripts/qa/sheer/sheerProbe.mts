// 깎아지른 지형 탐침(모델 없음): build_sheer_terrain 으로 갈래 × 씨앗을 짓고 실제 렌더러(renderMapPng — 빈 칸에 견본 배경)로 그린다.
//   bun scripts/qa/sheer/sheerProbe.mts <outDir> [--kinds sky-plateau,waterfall-terraces,summit] [--seeds 1-4] [--scale 2] [--size medium]
// 쓰는 것: <kind>-s<seed>.png(배경 깔린 그림) · <kind>-s<seed>-pass.png(통행 덧그림) · table.json(갈래·씨앗마다 잰 값).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { runTool } from "../../../src/editor/tools/index.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import { sheerKindById, SHEER_KINDS } from "../../../src/editor/tools/sheerTerrainPlan.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import type { Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const out = argv[0] ?? "/tmp/sheer/probe";
const opt = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? String(argv[i + 1]) : d; };
const kinds = opt("kinds", SHEER_KINDS.map((k) => k.id).join(",")).split(",");
const [s0, s1] = opt("seeds", "1-4").split("-").map(Number);
const scale = Number(opt("scale", "2")), size = opt("size", "medium") as "small" | "medium" | "large";
fs.mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
for (const kid of kinds) for (let seed = s0!; seed <= (s1 ?? s0!); seed++) {
  const kind = sheerKindById(kid)!; const [W, H] = kind.size[size];
  const project = createBlankProject() as Project; const ctx: ToolContext = { project, lookKey: `sheer-probe-${kid}` };
  const made = runTool(ctx, "create_map", { name: `${kind.ko} ${seed}`, width: W, height: H, tilesetId: "beodeul_city" });
  const mapId = (made.data as { mapId: string }).mapId;
  const res = runTool(ctx, "build_sheer_terrain", { mapId, kind: kid, seed });
  if (!res.ok) { console.log(kid, seed, "FAIL", res.summary, JSON.stringify(res.issues)); continue; }
  const p = ctx.project, map = p.maps[mapId]!;
  const data = res.data as Record<string, unknown> & { entry: { x: number; y: number } };
  const png = renderMapPng(p, map, scale).png;
  const file = path.join(out, `${kid}-s${seed}.png`); fs.writeFileSync(file, png);
  // 통행 덧그림: 닿는 칸 초록 · 막힌 걷는 칸 빨강 · 장치 칸 노랑 — 그림 위에 반투명으로
  const img = PNG.sync.read(png); const T = 16 * scale;
  const reach = new Set<number>(); { const s = data.entry.y * W + data.entry.x, q = [s]; reach.add(s); for (let h = 0; h < q.length; h++) { const c = q[h]!, x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, n = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || reach.has(n) || !canMove(p, map, x, y, nx, ny)) continue; reach.add(n); q.push(n); } } }
  const pad = img.height - H * T;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = y * W + x, ramp = map.relief?.ramps?.[c] ?? 0;
    const col = ramp ? [255, 220, 40] : reach.has(c) ? [40, 220, 90] : isPassable(p, map, x, y) && map.relief?.levels[c] ? [230, 40, 40] : null;
    if (!col) continue;
    // 칸의 화면 자리: 그 칸 단만큼 들린 자리(단 × 48px × scale)
    const lift = (map.relief?.levels[c] ?? 0) * 3 * T;
    for (let py = 2; py < T - 2; py++) for (let px = 2; px < T - 2; px++) {
      const X = x * T + px, Y = pad + y * T - lift + py; if (Y < 0 || Y >= img.height) continue;
      const o = (Y * img.width + X) * 4; for (let k = 0; k < 3; k++) img.data[o + k] = Math.round(img.data[o + k]! * 0.55 + col[k]! * 0.45);
    }
  }
  fs.writeFileSync(path.join(out, `${kid}-s${seed}-pass.png`), PNG.sync.write(img));
  const row = { kind: kid, seed, W, H, ...data, png: path.basename(file) };
  rows.push(row);
  console.log(`${kid} s${seed}: ${res.summary}`);
}
fs.writeFileSync(path.join(out, "table.json"), JSON.stringify(rows, null, 1));
