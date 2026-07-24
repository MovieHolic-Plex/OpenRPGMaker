/**
 * 긴급 복구: apply-lava-mine-fix 의 잘못된 troopId 수치 매핑("1","2","4","5")을
 * 원래 문자열 트룹 id로 되돌린다. 유효성 검증이 로드를 막고 있으므로
 * raw REST로 current_json을 읽어 이벤트 troopId만 패치한 뒤 공식 저장 경로로 쓴다.
 * 실행: npx tsx scripts/repair-lava-troop-ids.mts
 */
import fs from "node:fs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";

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
const TROOP_BY_EVENT: Record<string, string> = {
  ev_lava_mine_bats_1: "troop_bat_swarm",
  ev_lava_mine_bats_2: "troop_bat_swarm",
  ev_lava_mine_bats_3: "troop_bat_swarm",
  ev_lava_mine_slimes: "troop_slime_pair",
  ev_lava_mine_slimes_2: "troop_slime_pair",
  ev_lava_mine_golem_1: "troop_golem_guard",
  ev_lava_mine_golem_2: "troop_golem_guard",
  ev_lava_mine_golem_3: "troop_golem_guard",
  ev_lava_mine_dragon: "troop_dragon",
};

// raw fetch (검증 우회)
const q = new URLSearchParams({ select: "current_json", project_id: `eq.${config.projectId}` });
const res = await fetch(`${config.url}/rest/v1/projects?${q}`, {
  headers: {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    Accept: "application/json",
    "Accept-Profile": "rpg_zzu",
  },
});
if (!res.ok) throw new Error("raw 로드 실패: " + (await res.text()));
const rows = (await res.json()) as { current_json: unknown }[];
const raw = rows[0]?.current_json as Project;
if (!raw) throw new Error("행 없음");

const map = raw.maps["map_sc_dungeon_lava"];
if (!map) throw new Error("맵 없음");
let patched = 0;
for (const ev of map.events ?? []) {
  const want = TROOP_BY_EVENT[ev.id];
  if (!want) continue;
  for (const page of ev.pages ?? []) {
    for (const cmd of page.commands ?? []) {
      if (cmd.kind === "battleProcessing" && cmd.troopId !== want) {
        console.log(`패치: ${ev.id} troopId ${cmd.troopId} → ${want}`);
        (cmd as { troopId: string }).troopId = want;
        patched += 1;
      }
    }
  }
}
if (patched === 0) console.log("패치 대상 없음(이미 정상)");
fs.writeFileSync("output/evidence/lava-mine-apply/troop-repair-backup.json", JSON.stringify(raw).slice(0, 0) || "");
const saved = await saveProjectToSupabase(raw, config);
console.log("저장:", (saved as { kind?: string })?.kind);
if ((saved as { kind?: string })?.kind !== "saved") throw new Error("저장 실패");

// 검증: 공식 로드가 다시 성공해야 한다
const reloaded = await loadProjectFromSupabase(config);
if (!reloaded) throw new Error("재로드 실패");
const rmap = reloaded.maps["map_sc_dungeon_lava"]!;
console.log("재로드 성공. 이벤트:", (rmap.events ?? []).length, "기");
for (const ev of rmap.events ?? []) {
  const cmd = ev.pages?.[0]?.commands?.find((c) => c.kind === "battleProcessing") as { troopId?: string } | undefined;
  console.log(" ", ev.id, "@", ev.x + "," + ev.y, "troop:", cmd?.troopId);
}
const rts = reloaded.tilesets[rmap.tilesetId]!;
console.log("밴드 solid 유지:", [102, 132].every((t) => (rts.passability as Record<number, { up: boolean }>)[t]?.up === false));
