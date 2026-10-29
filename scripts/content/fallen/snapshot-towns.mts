/**
 * 『폴른 스타』 마을 스냅숏 뽑기 — chrono-bell 빌드가 부르는 author_beodeul_town 결과를 그대로 기록한다.
 *
 * 데모는 마을 생성기 출력에 고정돼 있다(2막 좌표 HUB_ARRIVE (52,25) 등). 생성기가 바뀌어도 데모가 흔들리지 않게
 * 빌더는 src/project/flagship/fallen/frozenTowns.json 의 스냅숏으로 마을을 짓는다(frozenTowns.ts).
 * 이 스크립트는 그 스냅숏을 **의도적으로** 다시 뽑을 때만 쓴다. 다시 뽑으면 2막 고정 좌표가 맞는지 굽기로 확인하라.
 *
 * 어느 체크아웃에서나 돌 수 있게 frozenTowns.ts 에 기대지 않는다(생성기 변경 전 커밋 워크트리에서도 돈다):
 *   cd <뽑을 체크아웃> && node --max-old-space-size=12000 node_modules/vite-node/dist/cli.mjs --script \
 *     <이 파일 절대경로> --out <frozenTowns.json 경로> [--ids fs_hub,fs2_frostford] [--merge]
 * --ids 를 주면 그 마을만 기록하고, --merge 면 기존 파일의 다른 마을은 그대로 둔다.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getTool } from "@/editor/tools/toolRegistry";
import { createFlagshipDemoProject } from "@/project/flagship";

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const out = opt("--out");
if (!out) throw new Error("--out <frozenTowns.json> 이 필요하다");
const only = opt("--ids")?.split(",").map((s) => s.trim()).filter(Boolean);
const merge = argv.includes("--merge");
/** 비교용 — 다 지은 프로젝트의 맵들을 이 경로에 쓴다(고정 전후가 같은지 볼 때). */
const mapsOut = opt("--maps-out");

// 새 코드의 스냅숏 재생을 끈다(옛 커밋에는 이 변수가 없다).
process.env.FS_FROZEN_TOWNS = "off";

type Rec = Record<string, unknown>;
const json = (v: unknown): string => JSON.stringify(v);
const towns: Record<string, Rec> = {};

const tool = getTool("author_beodeul_town") as unknown as { run: (draft: Rec, args: Rec) => unknown };
const realRun = tool.run;
tool.run = (draft: Rec, args: Rec) => {
  const id = String(args.id ?? "");
  const maps = draft.maps as Record<string, Rec>;
  const tilesets = draft.tilesets as Record<string, Rec>;
  const tilesetsBefore = new Map(Object.entries(tilesets).map(([k, v]) => [k, JSON.parse(json(v)) as Rec]));
  const treeBefore = JSON.parse(json(draft.mapTree ?? null)) as { children?: unknown[] } | null;
  const otherKeys = Object.keys(draft).filter((k) => k !== "maps" && k !== "tilesets" && k !== "mapTree");
  const otherBefore = new Map(otherKeys.map((k) => [k, json(draft[k])]));
  const mapsBefore = new Map(Object.keys(maps).map((k) => [k, json(maps[k])]));
  const result = realRun.call(tool, draft, args) as { summary?: string; warnings?: unknown; issues?: unknown; data?: unknown };
  if (only && !only.includes(id)) return result;
  // 기록은 마을 맵·타일셋 꼬리 덧붙임·맵 나무 덧붙임뿐이어야 재생할 수 있다. 다른 것이 바뀌면 멈춘다.
  for (const k of otherKeys) if (json(draft[k]) !== otherBefore.get(k)) throw new Error(`[snapshot-towns] ${id}: 재생할 수 없는 변경 — project.${k}`);
  for (const [k, v] of mapsBefore) if (k !== id && json(maps[k]) !== v) throw new Error(`[snapshot-towns] ${id}: 다른 맵 ${k} 이 바뀌었다`);
  const map = maps[id];
  if (!map) throw new Error(`[snapshot-towns] ${id}: 맵이 안 생겼다`);
  const tilesetId = String(map.tilesetId);
  const tsAppend: Record<string, Rec> = {};
  for (const [tid, after] of Object.entries(tilesets)) {
    const before = tilesetsBefore.get(tid);
    if (!before) throw new Error(`[snapshot-towns] ${id}: 새 타일셋 ${tid}`);
    if (json(after) === json(before)) continue;
    const append: Rec = { baseCount: before.count, count: after.count, arrays: {} };
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const a = before[key], b = (after as Rec)[key];
      if (json(a) === json(b) || key === "count") continue;
      const aa = (a ?? []) as unknown[];
      if (!Array.isArray(b) || !Array.isArray(aa) || b.length < aa.length || json(b.slice(0, aa.length)) !== json(aa)) {
        throw new Error(`[snapshot-towns] ${id}: 타일셋 ${tid}.${key} 가 꼬리 덧붙임이 아니다`);
      }
      (append.arrays as Rec)[key] = b.slice(aa.length);
    }
    tsAppend[tid] = append;
  }
  const treeAfter = (draft.mapTree ?? null) as { children?: unknown[] } | null;
  const nb = treeBefore?.children ?? [], na = treeAfter?.children ?? [];
  if (json(na.slice(0, nb.length)) !== json(nb)) throw new Error(`[snapshot-towns] ${id}: 맵 나무가 덧붙임이 아니다`);
  // 뒤 단계가 같은 맵·data 객체를 고치므로 지금 모습을 복사해 둔다.
  const copy = <T,>(v: T): T => JSON.parse(json(v)) as T;
  towns[id] = copy({
    args, tilesetId,
    result: { summary: result.summary ?? "", ...(result.warnings ? { warnings: result.warnings } : {}), ...(result.issues ? { issues: result.issues } : {}), data: result.data ?? null },
    map, tilesets: tsAppend, mapTreeAppend: na.slice(nb.length),
  });
  console.log(`[snapshot-towns] 기록 ${id} ${map.width}×${map.height} 타일셋 덧붙임 ${Object.entries(tsAppend).map(([k, v]) => `${k} +${Number(v.count) - Number(v.baseCount)}`).join(", ") || "없음"}`);
  return result;
};

let failure: unknown;
try {
  const built = createFlagshipDemoProject("chrono-bell" as never) as unknown as { project: { maps: Rec; tilesets: Record<string, Rec> } };
  if (mapsOut) writeFileSync(mapsOut, json({ maps: built.project.maps, tilesetCounts: Object.fromEntries(Object.entries(built.project.tilesets).map(([k, v]) => [k, v.count])) }));
}
catch (error) { failure = error; console.warn(`[snapshot-towns] 빌드가 도중에 멈췄다(기록은 남긴다): ${String(error).slice(0, 300)}`); }
finally { tool.run = realRun; }

const prev = merge && existsSync(out) ? (JSON.parse(readFileSync(out, "utf8")) as { towns?: Record<string, Rec> }).towns ?? {} : {};
const file = { version: 1, note: "scripts/content/fallen/snapshot-towns.mts 로 뽑는다. 손으로 고치지 않는다.", towns: { ...prev, ...towns } };
writeFileSync(out, `${JSON.stringify(file)}\n`);
console.log(`[snapshot-towns] ${out} ← ${Object.keys(towns).join(", ") || "(없음)"}${failure ? " (빌드 실패 뒤)" : ""}`);
