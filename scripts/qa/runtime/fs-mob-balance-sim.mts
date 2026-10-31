// 폴른 스타(chrono-bell) 잡몹 무리 승률표 — 구운 project.json 위에서 simulateBattle 을 전 부대에 돌린다.
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/fs-mob-balance-sim.mts <project.json> [n] [out.json] [--apply]
// --apply = 굽기 전 판에 mobBalance.ts 의 능력치·우두머리 기록을 덮어 잰다(맵 자리는 안 바꾼다).
import { readFileSync, writeFileSync } from "node:fs";
import { applyFallenMobStats } from "../../../src/project/flagship/fallen/mobBalance";
import { deserialize } from "../../../src/project/io";
import { runTable } from "./fs-mob-balance-lib.mts";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const project = deserialize(readFileSync(args[0]!, "utf8"));
if (process.argv.includes("--apply")) for (const w of applyFallenMobStats(project)) console.error("warn", w);
const rows = runTable(project, { n: Number(args[1] ?? 200), log: true });
if (args[2]) writeFileSync(args[2], JSON.stringify(rows, null, 1));
