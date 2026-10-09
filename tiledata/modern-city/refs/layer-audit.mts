/**
 * modern_city 칸의 층 표기를 실제 엔진 판정과 대조한다(AI-REFERENCE-CONTRACT 8항목: 투명 여부·홈 레이어·통행·렌더 우선순위는 별개의 정보).
 *
 *   npx vite-node tiledata/modern-city/refs/layer-audit.mts
 *
 * 칸마다
 *   · tileMeta 가 말하는 값 — passage(solid/passable/star)·defaultLayer·priority
 *   · 엔진이 실제로 내리는 판정
 *       홈 레이어  src/editor/tileLayerPolicy.ts   tileLayerPolicy().home
 *       통행       src/project/collision.ts        passabilityOf(아스팔트 1층 + 이 칸 3층)
 *       그림 순서  src/player/characterDepth.ts    mapUpperTileDepth() — 캐릭터 위/같은 줄 정렬/아래
 * 를 구해 어긋난 칸을 센다. 출력: 표준출력 요약 + tiledata/modern-city/refs/layer-audit.json
 */
import fs from "node:fs";
import path from "node:path";
import { tileLayerPolicy } from "../../../src/editor/tileLayerPolicy";
import { passabilityOf } from "../../../src/project/collision";
import { MAP_UPPER_LAYER_DEPTH, mapUpperTileDepth } from "../../../src/player/characterDepth";
import { createModernCityTileset } from "../../../src/project/defaults/modernCity";

const ts = createModernCityTileset();
const dir = path.dirname(new URL(import.meta.url).pathname);
const groupOf = new Map<number, string>();
for (const g of ts.tileGroups ?? []) for (const t of g.tileIds) groupOf.set(t, g.id);
const asphalt = ts.tileMeta!.findIndex((m) => m.label === "아스팔트");
const depthClass = (d: number) => (d === MAP_UPPER_LAYER_DEPTH ? "above" : d < 100_000 ? "below" : "ysort");
const expectClass: Record<string, string> = { solid: "ysort", passable: "below", star: "above" };

type Row = { tile: number; label: string; group: string; passage: string; defaultLayer: string; priority: string; engineHome: string; engineWalkOn3: boolean; engineDepth: string };
const mismatches: (Row & { problems: string[] })[] = [];
const byGroup: Record<string, Record<string, number>> = {};
let checked = 0;
for (let t = 1; t < ts.count; t++) {
  const m = ts.tileMeta![t]!;
  const group = groupOf.get(t) ?? "(그룹 없음)";
  if (m.label === "" || m.description?.startsWith("사용하지 않는")) continue;
  checked++;
  const engineHome = tileLayerPolicy(ts, t).home;
  const walk = passabilityOf(ts, asphalt, -1, t, -1).up;
  const cls = depthClass(mapUpperTileDepth(ts, t, 10, 16));
  const row: Row = { tile: t, label: m.label ?? "", group, passage: String(m.passage), defaultLayer: String(m.defaultLayer), priority: ts.priority[t]!, engineHome, engineWalkOn3: walk, engineDepth: cls };
  const problems: string[] = [];
  if (m.passage && expectClass[m.passage] && expectClass[m.passage] !== cls) problems.push(`passage=${m.passage} 는 엔진 그림 순서 ${expectClass[m.passage]} 인데 실제 ${cls}`);
  if (m.passage === "solid" && walk) problems.push("passage=solid 인데 엔진은 걸을 수 있다고 판정");
  if ((m.passage === "passable" || m.passage === "star") && !walk) problems.push(`passage=${m.passage} 인데 엔진은 막힘으로 판정`);
  if (m.defaultLayer && m.defaultLayer !== engineHome) problems.push(`defaultLayer=${m.defaultLayer} 인데 엔진 홈 레이어는 ${engineHome}`);
  const k = `${m.passage}|prio=${ts.priority[t]}|home=${engineHome}|depth=${cls}`;
  (byGroup[group] ??= {})[k] = (byGroup[group]![k] ?? 0) + 1;
  if (problems.length) mismatches.push({ ...row, problems });
}
const summary = {
  tileset: ts.id, count: ts.count, checked, mismatches: mismatches.length,
  byGroupKinds: Object.fromEntries(Object.entries(byGroup).map(([g, v]) => [g, v])),
  examples: mismatches.slice(0, 40),
  mismatchByProblem: mismatches.reduce<Record<string, number>>((acc, r) => { for (const p of r.problems) acc[p.replace(/\d+/g, "N")] = (acc[p.replace(/\d+/g, "N")] ?? 0) + 1; return acc; }, {}),
};
fs.writeFileSync(path.join(dir, "layer-audit.json"), JSON.stringify(summary, null, 1) + "\n");
console.log(JSON.stringify({ checked, mismatches: mismatches.length, mismatchByProblem: summary.mismatchByProblem, first: mismatches.slice(0, 5) }, null, 1));
