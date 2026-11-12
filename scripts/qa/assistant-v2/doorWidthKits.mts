// 문 폭 × 건물 키트 표(모델 없음·맵 없음): 입구를 적어 둔 구조 키트를 하나씩 빈 바닥에 찍고, 그 입구 칸에서 추론한 문(project/mapDoorKinds.ts inferMapDoor)이
// 키트가 적은 입구 열과 같은 폭인지, 입구 옆의 막힌 벽 칸이 문으로 읽히는지 잰다. 런타임(문 열림 연출·문으로 들어가기)과 맵 잇기 도구(이동 발판 넓히기)가 같은 추론을 쓴다.
//   declared 적힌 폭 그대로 · wider 적힌 것보다 넓다(벽까지 문) · narrower 좁다 · none 문짝 없는 출구(통로·아치) · no-door 문으로 안 읽힘
//   입구가 걷는 칸인 키트(문턱·걸어 지나는 대문)는 문 그림이 그 둘레라 따로 센다(step).
//   bun scripts/qa/assistant-v2/doorWidthKits.mts [out.json] [칩셋,칩셋…]     문서 openwiki/assistant-v2.md 「문 폭은 키트가 적어 둔 입구 열까지」
import fs from "node:fs";
import { isPassable } from "../../../src/project/collision.ts";
import { createBlankProject } from "../../../src/project/defaults.ts";
import { classifyDoorLabel, inferMapDoor } from "../../../src/project/mapDoorKinds.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

const out = process.argv[2];
const only = process.argv[3] ? new Set(process.argv[3].split(",")) : undefined;
const P: any = createBlankProject();
const rows: any[] = [];
const tally: Record<string, Record<string, number>> = {};
for (const [id, ts] of Object.entries(P.tilesets) as [string, any][]) {
  if (only && !only.has(id)) continue;
  const kits = (ts.structureKits ?? []).filter((k: any) => (k.parts ?? []).some((p: any) => p.kind === "entrance" && typeof p.dx === "number"));
  if (!kits.length) continue;
  // 바닥: 사방으로 걷는 칸이고 건물 그림이 아니며 이름표가 문으로 읽히지 않는 첫 타일(jp_city 0번 「미닫이창 층 띠」 · sf_station 1번 돔 지붕 칸은 걷는 칸이지만 바닥이 아니다).
  const ground = (ts.passability ?? []).findIndex((p: any, t: number) => {
    const m = ts.tileMeta?.[t];
    return !!p && p.up && p.down && p.left && p.right && !!m?.label && !["wall", "building", "roof"].includes(m.role) && !classifyDoorLabel(m.label) && !classifyDoorLabel((m.tags ?? []).join(" "));
  });
  const t = (tally[id] ??= {});
  const bump = (k: string, n = 1) => { t[k] = (t[k] ?? 0) + n; };
  for (const k of kits) {
    const kw = Math.max(...k.rows.map((r: any) => Math.max(r.tiles?.length ?? 0, r.upperTiles?.length ?? 0)));
    const w = kw + 4, h = k.rows.length + 4;
    const M: any = { id: "m", name: "m", tilesetId: id, width: w, height: h, lowerTiles: new Array(w * h).fill(ground), upperTiles: new Array(w * h).fill(-1), events: [] };
    k.rows.forEach((row: any, y: number) => {
      (row.tiles ?? []).forEach((v: number, x: number) => { if (v >= 0) M.lowerTiles[(y + 2) * w + x + 2] = v; });
      (row.upperTiles ?? []).forEach((v: number, x: number) => { if (v >= 0) M.upperTiles[(y + 2) * w + x + 2] = v; });
    });
    const Q = { ...P, maps: { m: M } };
    for (const p of k.parts.filter((q: any) => q.kind === "entrance" && typeof q.dx === "number")) {
      const pw = p.w ?? 1, by = p.dy + (p.h ?? 1) - 1;
      const cell = { x: p.dx + 2, y: by + 2 };
      const step = isPassable(Q, M, cell.x, cell.y);
      const door = inferMapDoor(Q, M, cell);
      const v = !door ? "no-door" : door.kind === "none" ? "none" : door.rect.w === pw ? "declared" : door.rect.w > pw ? "wider" : "narrower";
      let walls = 0;
      for (let x = 0; x < kw; x++) {
        if (x >= p.dx && x < p.dx + pw) continue;
        const c = { x: x + 2, y: by + 2 };
        if (isPassable(Q, M, c.x, c.y)) continue;
        const d = inferMapDoor(Q, M, c);
        if (d && d.kind !== "none") walls++;
      }
      bump(`${step ? "step" : "door"}:${v}`);
      if (walls) bump(`${step ? "step" : "door"}:wall cells read as a door`, walls);
      rows.push({ chipset: id, kit: k.id ?? k.name, name: String(k.name ?? ""), size: `${kw}×${k.rows.length}`, entrance: step ? "step" : "door", part: { x: p.dx, y: p.dy, w: pw, h: p.h ?? 1 }, v, kind: door?.kind ?? null, rect: door ? { x: door.rect.x - 2, y: door.rect.y - 2, w: door.rect.w, h: door.rect.h } : null, walls });
    }
  }
  console.log(id, JSON.stringify(t));
}
const total: Record<string, number> = {};
for (const t of Object.values(tally)) for (const [k, n] of Object.entries(t)) total[k] = (total[k] ?? 0) + n;
console.log("TOTAL", JSON.stringify(total));
if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 1));
