#!/usr/bin/env node
// 대화형 플레이 한 걸음 — 떠 있는 출하 플레이어(runtimeQaInteractive.mjs)에 조작을 보내고 결과(상태 JSON·화면 PNG 경로)를 찍는다.
//   node scripts/qa/play-step.mjs <dir> '[{"kind":"move","dir":"up","steps":3}]'
//   node scripts/qa/play-step.mjs <dir> --quit
// 받는 op: key{key} · hold{dir|null,ms} · move{dir,steps} · face{dir} · action · waitFor{testid,state,timeoutMs} · waitForMap{mapId}
//          repeatUntil{testid,state,maxRounds,ops} · pressUntil{key,testid,state,maxPresses,timeoutMs} · battle{fallback:"attack",untilEnd:true}
import { existsSync, readdirSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

const [dir, raw] = process.argv.slice(2);
if (!dir || !raw) { console.error("usage: play-step.mjs <dir> '<ops json>' | --quit"); process.exit(2); }
if (!existsSync(join(dir, "res-0.json"))) { console.error(`플레이어가 아직 준비되지 않았다(${dir}/res-0.json 없음) — 부팅에 수 분 걸린다. 잠시 뒤 다시.`); process.exit(3); }
const n = readdirSync(dir).filter((f) => /^cmd-\d+\.json$/.test(f)).length + 1;
const cmd = raw === "--quit" ? { quit: true } : { ops: JSON.parse(raw.startsWith("@") ? await readFile(raw.slice(1), "utf8") : raw) };
const tmp = join(dir, `.cmd-${n}.tmp`);
await writeFile(tmp, JSON.stringify(cmd));
await rename(tmp, join(dir, `cmd-${n}.json`));
const res = join(dir, `res-${n}.json`);
const deadline = Date.now() + 10 * 60_000;
while (!existsSync(res)) {
  if (Date.now() > deadline) { console.error("10분 안에 결과가 없다 — 플레이어가 죽었을 수 있다."); process.exit(4); }
  await new Promise((r) => setTimeout(r, 250));
}
process.stdout.write(await readFile(res, "utf8") + "\n");
