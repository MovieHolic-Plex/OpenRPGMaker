// scripts/qa/dungeon-gate-sweep.mts
// 던전 레버 관문 훑기: 씨앗 × 종류 × 장치로 author_dungeon 을 돌리고 층마다 관문 결함(editor/tools/dungeonGateAudit)을 JSON 줄로 찍는다.
//
//   bun scripts/qa/dungeon-gate-sweep.mts --seeds 1-200 [--types cave,castle] [--gimmicks default,lever,bridge] [--sizes small,medium,large] [--floors 1,2] [--look ember] [--flag lair|flooded] [--lint]
//   --look 겉모습 이름(던전 겉가죽을 입힌다) · --flag 소굴/물에 잠김 · --lint 지은 층의 프로젝트 린트 오류도 실패로 센다(code lint:<코드>).
//
// 줄 하나 = 실패 하나({type,gimmick,seed,size,floors,mapId,code,message}) — 마지막 줄은 {"summary":…}. 실패가 있으면 종료 코드 1.
// code: lever-unreachable(레버가 제 관문 너머) · gate-opens-nothing(관문 없이도 다 닿음) · sealed(관문을 다 열어도 못 닿는 이벤트) · error(시공 실패).
import { createBlankProject } from "../../src/project/defaults/blankProject.ts";
import { applyGenrePreset } from "../../src/project/genrePresets.ts";
import { getTool } from "../../src/editor/tools/toolRegistry.ts";
import { withKitLook } from "../../src/project/kitLook.ts";
import { DUNGEON_TYPES } from "../../src/editor/dungeonKit/types.ts";
import { floorGateReport } from "../../src/editor/tools/dungeonGateAudit.ts";
import { projectLint } from "../../src/project/lint/projectLint.ts";

const arg = (name: string, fallback: string): string => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback; };
const [s0, s1] = arg("seeds", "1-20").split("-").map(Number);
const types = arg("types", DUNGEON_TYPES.join(",")).split(",");
const gimmicks = arg("gimmicks", "default,lever,bridge").split(",");
const sizes = arg("sizes", "medium").split(",");
const floorsList = arg("floors", "1").split(",").map(Number);
const look = arg("look", "");
const flag = arg("flag", "");
const withLint = process.argv.includes("--lint");

// 판마다 새 프로젝트 — 큰 칩셋 표(tilesets)는 읽기만 하므로 한 벌을 같이 쓴다(통째 복제는 판마다 1.3초).
const BASE = createBlankProject(); applyGenrePreset(BASE, "adventure-jrpg");
const freshProject = (): typeof BASE => ({ ...structuredClone({ ...BASE, tilesets: {} }), tilesets: BASE.tilesets });
let built = 0, withGate = 0, failures = 0;
const byCode: Record<string, number> = {}, placed: Record<string, number> = {};
const fail = (row: Record<string, unknown>) => { failures += 1; byCode[String(row.code)] = (byCode[String(row.code)] ?? 0) + 1; process.stdout.write(`${JSON.stringify(row)}\n`); };
for (const type of types) for (const gimmick of gimmicks) for (const size of sizes) for (const floors of floorsList) for (let seed = s0!; seed <= (s1 ?? s0!); seed += 1) {
  const project = freshProject();
  const base = { type, gimmick, seed, size, floors };
  try {
    const args = { type, name: `${type} ${seed}`, mapId: project.startMapId, seed, size, ...(floors > 1 ? { floors } : {}), ...(gimmick === "default" ? {} : { gimmick }), ...(flag ? { [flag]: true } : {}) };
    const run = () => getTool("author_dungeon")!.run(project, args) as { data: { floors: string[]; gimmick: string | null } };
    const res = look ? withKitLook(`sweep-${look}`, run, () => ({ textureKey: "tex_beodeul_looks", dungeon: look }) as never) : run();
    built += 1;
    placed[String(res.data.gimmick)] = (placed[String(res.data.gimmick)] ?? 0) + 1;
    let gates = 0;
    for (const mapId of res.data.floors) {
      const rep = floorGateReport(project, project.maps[mapId]!);
      gates += rep.gates;
      for (const issue of rep.issues) fail({ ...base, mapId, code: issue.code, message: issue.message });
      if (rep.sealed.length) fail({ ...base, mapId, code: "sealed", message: rep.sealed.join(",") });
    }
    if (gates) withGate += 1;
    if (withLint) for (const issue of projectLint(project)) if (issue.severity === "error" && (!issue.mapId || res.data.floors.includes(issue.mapId))) fail({ ...base, mapId: issue.mapId, code: `lint:${issue.code}`, message: String(issue.message).slice(0, 200) });
  } catch (error) { fail({ ...base, code: "error", message: (error as Error).message.slice(0, 300) }); }
}
console.log(JSON.stringify({ summary: { built, withGate, failures, byCode, placed } }));
process.exit(failures ? 1 : 0);
