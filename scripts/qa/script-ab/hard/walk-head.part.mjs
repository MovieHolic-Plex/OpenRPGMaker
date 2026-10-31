// Hard-logic battery — scripted playthrough of one run's game in the SHIPPED player (wholeGamePlayer --serve + Firefox).
//
//   node scripts/qa/script-ab/hard/walk-hard.mjs --project-dir <run>/project --mech <id> --out <dir> [--video] [--netns]
//
// Checks are fixed per mechanic (same for every model). Events are found by their stage names («@name»), so no binding
// file is needed. Each mechanic covers its success AND failure paths, and save → reload → load where the request asks
// for persistence. Output <out>/walk.json {checks:[{id,pass,note,texts}], transcript, choices} and <out>/video/walk.webm.
// Generated from walk-head/walk-base/walk-mechs parts by build-walk.sh — edit the parts.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { firefox } from "playwright";
import { battleQaOp } from "../../../lib/runtimeQaBattle.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
if (process.argv.includes("--netns") && process.env.OPRN_QA_IN_NETNS !== "1") {
  const inner = process.argv.slice(1).filter((a) => a !== "--netns").map((a) => `'${a.replaceAll("'", "'\\''")}'`).join(" ");
  const r = spawnSync("unshare", ["-rn", "bash", "-c", `ip link set lo up && exec ${JSON.stringify(process.execPath)} ${inner}`], { stdio: "inherit", env: { ...process.env, OPRN_QA_IN_NETNS: "1" } });
  process.exit(r.status ?? 1);
}
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const projectDir = resolve(opt("project-dir"));
const request = opt("mech");
let bind = {};
const out = resolve(opt("out"));
const video = argv.includes("--video");
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

