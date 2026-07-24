/**
 * 용암동굴 실제 수리 적용기 — 분석 파이프라인(scripts/lib/lavaMineRepair.mts)을
 * Supabase rpg-zzu-showcase 의 map_sc_dungeon_lava 에 반영한다.
 * 1) 맵 수리 (콘페티 회수/스펙클/벽 고정점/용암 위 구조물 철거/레일 재구성)
 * 2) 타일셋 밴드 통행성 교정 (102–104·132–134 → wall/solid, 레포 정본 라벨)
 * 3) 몬스터: 기존 6기 troopId 깨짐 수정 + 위치 재배치 + 신규 3기 추가
 * 4) 저장 → 재로드 → 사후조건·체크섬 검증 → 렌더 증거
 * 실행: npx tsx scripts/apply-lava-mine-fix.mts   (드라이: --dry)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PNG } from "pngjs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { buildFieldMonsterEvent, defaultFieldMonsterClearSwitchId } from "../src/project/fieldMonsterTemplate.ts";
import { charsetFrameIndex } from "../src/assets/easyrpgRtp.ts";
import { repairLavaMineMap, isFloorTile, RAIL } from "./lib/lavaMineRepair.mts";
import type { EventPageGraphic, GameMap, Project } from "../src/project/types.ts";

const OUT = path.resolve("output/evidence/lava-mine-apply");
fs.mkdirSync(OUT, { recursive: true });
const T = 16;
const COLS = 30;
const MAP_ID = "map_sc_dungeon_lava";
const DRY = process.argv.includes("--dry");

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: "rpg-zzu-showcase",
};

// ── 렌더러 (증거용) ─────────────────────────────────────────────────────────
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
function renderMap(project: Project, map: GameMap, file: string): void {
  const scale = 3;
  const png = new PNG({ width: map.width * T * scale, height: map.height * T * scale });
  for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 24; png.data[i + 1] = 22; png.data[i + 2] = 28; png.data[i + 3] = 255; }
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0), sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T, sh = q?.sh ?? T;
    for (let y = 0; y < sh * scale; y += 1) for (let x = 0; x < sw * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x, dx = x * T * scale, dy = y * T * scale;
    const tset = project.tilesets[map.tilesetId];
    const comp = tset ? chipsetQuarterComposition(map, tset, x, y) : null;
    if (comp) {
      blit(comp.underlayTile ?? map.lowerTiles[i]!, dx, dy);
      for (const s of comp.sources) blit(s.tile, dx + s.offsetX * scale, dy + s.offsetY * scale, { sx: s.offsetX, sy: s.offsetY, sw: 8, sh: 8 });
    } else if (map.lowerTiles[i]! >= 0) blit(map.lowerTiles[i]!, dx, dy);
    if (map.upperTiles[i]! >= 0) blit(map.upperTiles[i]!, dx, dy);
  }
  for (const ev of map.events ?? []) {
    const px = ev.x * T * scale, py = ev.y * T * scale;
    for (let y = 0; y < 6; y += 1) for (let x = 0; x < 6; x += 1) {
      const di = ((py + y) * png.width + (px + T * scale - 8 + x)) * 4;
      if (di < 0 || di + 3 >= png.data.length) continue;
      png.data[di] = 255; png.data[di + 1] = 60; png.data[di + 2] = 200; png.data[di + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(png));
  console.log("  rendered", file);
}
const hash = (m: GameMap): string =>
  crypto.createHash("sha256").update(JSON.stringify([m.lowerTiles, m.upperTiles, (m.events ?? []).map((e) => [e.id, e.x, e.y])])).digest("hex").slice(0, 16);

// ── 1. 로드 + 백업 ──────────────────────────────────────────────────────────
const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("원격 로드 실패");
const map = project.maps[MAP_ID];
if (!map) throw new Error(MAP_ID + " 없음");
fs.writeFileSync(path.join(OUT, "before.json"), JSON.stringify({ map, tileset: project.tilesets[map.tilesetId] }));
renderMap(project, map, "before.png");
console.log("[로드]", map.width + "x" + map.height, "events:", (map.events ?? []).length, "hash:", hash(map));

// ── 2. 맵 수리 ──────────────────────────────────────────────────────────────
const { m: fixed, unanchored, stats } = repairLavaMineMap(map, true);
console.log("[수리]", JSON.stringify({ unanchored, ...stats, railJunctionPending: undefined, railDangling: undefined, railOneWay: undefined }));
console.log("[수리] 분기후보:", JSON.stringify(stats.railJunctionPending), "잔여단절:", stats.railDangling.length + stats.railOneWay.length);
if (unanchored !== 0 || stats.directBorderLeft !== 0 || stats.badFaceHeight !== 0) throw new Error("벽 사후조건 실패");
if (stats.railDangling.length || stats.railOneWay.length) throw new Error("레일 사후조건 실패");
project.maps[MAP_ID] = { ...fixed, events: map.events };

// ── 3. 타일셋 밴드 통행성 교정 (벽이 실제로 막히도록) ───────────────────────
const tileset = project.tilesets[map.tilesetId]!;
for (const t of [102, 103, 104, 132, 133, 134]) {
  (tileset.passability as Record<number, { up: boolean; down: boolean; left: boolean; right: boolean }>)[t] = { up: false, down: false, left: false, right: false };
  const meta = (tileset.tileMeta as Record<number, { label?: string; role?: string; passage?: string }>)[t];
  if (meta) { meta.label = `거친 바위벽(갈색) ${t}`; meta.role = "wall"; meta.passage = "solid"; }
}
console.log("[타일셋] 102–104·132–134 → wall/solid 교정");

// ── 4. 몬스터: troopId 교정 + 재배치 + 신규 3기 ─────────────────────────────
const W = map.width, H = map.height;
const at = (x: number, y: number) => y * W + x;
const gmap = project.maps[MAP_ID]!;
const isOpenFloor = (x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const i = at(x, y);
  return isFloorTile(gmap.lowerTiles[i]!) && gmap.upperTiles[i]! === -1;
};
function nearestOpenFloor(cx: number, cy: number, taken: Set<number>): { x: number; y: number } {
  let best: { x: number; y: number } | null = null, bestD = Infinity;
  for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
    if (!isOpenFloor(x, y) || taken.has(at(x, y))) continue;
    const d = Math.abs(x - cx) + Math.abs(y - cy);
    if (d < bestD) { bestD = d; best = { x, y }; }
  }
  if (!best) throw new Error("빈 바닥 없음 near " + cx + "," + cy);
  return best;
}
// 기존 이벤트 troopId는 이미 유효 (database.troops 레코드 id와 일치) — 재매핑 금지.
// 주의: troops 객체의 키는 순번이고 참조는 레코드의 id 필드로 해야 한다 (수치 키 사용 시 로드 검증 실패).
const taken = new Set<number>();
const events = gmap.events ?? [];
for (const ev of events) {
  if (!isOpenFloor(ev.x, ev.y)) {
    const p = nearestOpenFloor(ev.x, ev.y, taken);
    console.log(`[재배치] ${ev.id}: (${ev.x},${ev.y}) → (${p.x},${p.y})`);
    ev.x = p.x; ev.y = p.y;
  }
  taken.add(at(ev.x, ev.y));
}
// 신규 3기
const MON1 = "tex_easyrpg_charset_monster1";
const MON2 = "tex_easyrpg_charset_monster2";
const MON3 = "tex_easyrpg_charset_monster3";
const monGraphic = (spriteId: string, characterIndex: number): EventPageGraphic => ({
  sprite: { type: "bundled", id: spriteId },
  direction: "down",
  pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
});
const newSpecs = [
  { id: "ev_lava_mine_slimes_2", troop: "troop_slime_pair", g: monGraphic(MON1, 0), near: [11, 34] as const, intro: ["용암 호숫가에서 마그마 슬라임이 불거져 나온다!"], victory: ["슬라임이 굳어 바스러졌다."] },
  { id: "ev_lava_mine_bats_3", troop: "troop_bat_swarm", g: monGraphic(MON3, 0), near: [31, 10] as const, intro: ["상층 광구의 천장에서 화산 박쥐 떼가 쏟아진다!"], victory: ["박쥐 떼가 흩어졌다."] },
  { id: "ev_lava_mine_golem_3", troop: "troop_golem_guard", g: monGraphic(MON2, 4), near: [44, 41] as const, intro: ["보스방 입구의 바위가 움직인다 — 광산 골렘이다!"], victory: ["골렘이 물러나 길이 열리었다."] },
];
gmap.events = gmap.events ?? [];
for (const s of newSpecs) {
  if (gmap.events.some((e) => e.id === s.id)) { console.log("[몹] 이미 존재:", s.id); continue; }
  const p = nearestOpenFloor(s.near[0], s.near[1], taken);
  taken.add(at(p.x, p.y));
  const sw = defaultFieldMonsterClearSwitchId(s.id);
  if (!project.switches.some((r) => r.id === sw)) project.switches.push({ id: sw, name: `전투 완료: ${s.id}` });
  project.session.switches[sw] ??= false;
  gmap.events.push(buildFieldMonsterEvent({
    eventId: s.id, troopId: s.troop, clearSwitchId: sw, graphic: s.g,
    intro: s.intro, victory: s.victory, x: p.x, y: p.y,
  }));
  console.log(`[몹] ${s.id} → troop ${s.troop} @ (${p.x},${p.y})`);
}
// 최종 검증: 모든 이벤트가 열린 바닥 위 + 트룹은 레코드 id 기준으로 존재
const troopIds = new Set(Object.values(project.database.troops).map((t) => (t as { id: string }).id));
for (const ev of gmap.events) {
  if (!isOpenFloor(ev.x, ev.y)) throw new Error(`이벤트 ${ev.id} 위치 불량 (${ev.x},${ev.y})`);
  const cmd = ev.pages?.[0]?.commands?.find((c) => c.kind === "battleProcessing") as { troopId?: string } | undefined;
  if (cmd?.troopId && !troopIds.has(cmd.troopId)) throw new Error(`이벤트 ${ev.id} 의 트룹 ${cmd.troopId} 부재`);
}
console.log("[검증] 이벤트", gmap.events.length, "기 — 위치·트룹 모두 유효");

// ── 5. 저장 → 재로드 검증 ───────────────────────────────────────────────────
const localHash = hash(gmap);
if (DRY) {
  renderMap(project, gmap, "after.dry.png");
  console.log("[드라이런] 저장 생략. localHash=", localHash);
  process.exit(0);
}
const saved = await saveProjectToSupabase(project, config);
console.log("[저장]", (saved as { kind?: string })?.kind);
if ((saved as { kind?: string })?.kind !== "saved") throw new Error("저장 실패: " + JSON.stringify(saved));

const reloaded = await loadProjectFromSupabase(config);
if (!reloaded) throw new Error("재로드 실패");
const rmap = reloaded.maps[MAP_ID]!;
const remoteHash = hash(rmap);
console.log("[재로드] hash:", remoteHash, "| 일치:", remoteHash === localHash);
if (remoteHash !== localHash) throw new Error("재로드 체크섬 불일치");
const rts = reloaded.tilesets[rmap.tilesetId]!;
const bandOk = [102, 103, 104, 132, 133, 134].every((t) => {
  const p = (rts.passability as Record<number, { up: boolean }>)[t];
  return p && p.up === false;
});
console.log("[재로드] 밴드 solid:", bandOk);
if (!bandOk) throw new Error("밴드 통행성 반영 안 됨");
renderMap(reloaded, rmap, "after.png");
fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({
  projectId: config.projectId, mapId: MAP_ID, savedAt: new Date().toISOString(),
  hash: remoteHash, stats, events: (rmap.events ?? []).map((e) => [e.id, e.x, e.y]),
}, null, 2));
console.log("[완료] 증거:", OUT);
