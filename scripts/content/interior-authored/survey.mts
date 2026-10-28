// bun scripts/content/interior-authored/survey.mts --out <dir> <게임 판 폴더>... — 실제 게임 판(project/project.sqlite)의 실내 맵을 1배 PNG 로 그리고
// 맵마다 이름·크기·방 종류(hand-layout-room 위치)·이벤트 수, 판마다 판정(judge)·VQA 결함 문장을 한 장(index.html)에 모은다.
// 어떤 용도의 방이 실제로 쓰이고 지적받는지 보고 손으로 짠 견본을 늘릴 용도를 고르는 데 쓴다. 원본 DB 에는 쓰지 않는다.
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../read-project-sqlite.mts";
import { addRenderAssetRoot, renderMapPng } from "../../qa-game/render.mts";
import { store } from "../../../src/project/store";

const argv = process.argv.slice(2);
const oi = argv.indexOf("--out");
const out = path.resolve(oi >= 0 ? argv[oi + 1]! : "/tmp/interior-survey");
const runs = argv.filter((a, i) => a !== "--out" && i !== oi + 1);
fs.mkdirSync(out, { recursive: true });
const esc = (s: string) => s.replace(/[&<>]/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const defectsOf = (file: string): string[] => {
  if (!fs.existsSync(file)) return [];
  try {
    const d = JSON.parse(fs.readFileSync(file, "utf8")) as { judge?: { defects?: { what: string; severity: string }[]; stuckAt?: string }; defects?: { what: string; severity: string }[] };
    const list = d.judge?.defects ?? d.defects ?? [];
    return [...(d.judge?.stuckAt ? [`[stuck] ${d.judge.stuckAt}`] : []), ...list.map((x) => `[${x.severity}] ${x.what}`)];
  } catch { return []; }
};
const rows: Record<string, unknown>[] = [];
let html = `<!doctype html><meta charset=utf-8><title>interior survey</title><style>body{background:#222;color:#ddd;font:13px sans-serif}section{border-top:1px solid #555;margin:12px 0}div.m{display:inline-block;margin:6px;vertical-align:top;max-width:620px}img{image-rendering:pixelated;zoom:2}li{max-width:1100px}</style>`;
for (const dir of runs) {
  const key = dir.split("/").slice(-3).join("/");
  const sqlite = path.join(dir, "project", "project.sqlite");
  if (!fs.existsSync(sqlite)) continue;
  let project;
  try { project = readProjectSqlite(path.join(dir, "project")); } catch (e) { console.error(key, String(e).slice(0, 200)); continue; }
  addRenderAssetRoot(path.join(dir, "project", "assets"));
  store.replaceProject(project);
  const cur = store.getCurrent();
  const judgeDir = fs.readdirSync(dir).find((f) => f.startsWith("judge-"));
  const defects = [...defectsOf(path.join(dir, judgeDir ?? "-", "result.json")).map((s) => `judge ${s}`), ...defectsOf(path.join(dir, "vqa-play", "result.json")).map((s) => `vqa ${s}`)];
  html += `<section><h3>${esc(key)}</h3><ul>${defects.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`;
  for (const map of Object.values(cur.maps) as { id: string; name?: string; width: number; height: number; tilesetId?: string; events?: unknown[]; locations?: { name: string; tags?: string[]; w: number; h: number }[] }[]) {
    const rooms = (map.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room"));
    const interior = rooms.length > 0 || /interior/u.test(String(map.tilesetId));
    if (!interior) continue;
    const file = `${key.replace(/\//gu, "_")}_${map.id}.png`;
    try { fs.writeFileSync(path.join(out, file), renderMapPng(cur, map as never, 1).png); } catch (e) { console.error(key, map.id, String(e).slice(0, 120)); continue; }
    const row = { run: key, map: map.id, name: map.name, size: `${map.width}x${map.height}`, tileset: map.tilesetId, rooms: rooms.map((r) => `${r.name} ${r.w}x${r.h}`).join(", "), events: map.events?.length ?? 0, png: file };
    rows.push(row);
    html += `<div class=m><b>${esc(String(map.name))}</b> ${row.size} ${esc(String(map.tilesetId))} ev ${row.events}<br>${esc(row.rooms)}<br><img src="${file}"></div>`;
  }
  html += `</section>`;
  console.log(key, rows.filter((r) => r.run === key).length);
}
fs.writeFileSync(path.join(out, "survey.json"), JSON.stringify(rows, null, 1));
fs.writeFileSync(path.join(out, "index.html"), html);
