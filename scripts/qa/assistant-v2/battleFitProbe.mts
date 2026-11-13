// 길 위 전투의 긴장 재기(모델 없음) — 지은 게임 하나의 청사진 길 위 전투를 시작 파티(레벨·장비·소지품 그대로)로 모의해
// «공격만·회복 없음» 과 «기술 + 가진 회복약» 두 가지 플레이의 승률·턴·잃는 HP·쓴 약을 적는다. 레벨이 오를 때 능력치가 오르는지도 같이.
//   bun scripts/qa/assistant-v2/battleFitProbe.mts <project.json | 재생 결과 폴더> [--json <out.json>] [--shots <폴더>]
// --shots: 출하 플레이어 캡처용(시나리오 battle-fit) — 오프닝을 끈 프로젝트 사본과 전투마다 적 칸·곁에 설 칸·보는 방향을 <폴더>/shots.json 에 쓴다.
// 수치는 모의전(전투 런타임 그대로, 시드 고정)이다 — 화면은 보지 않는다. 문서: openwiki/assistant-v2.md 「전투가 장소·파티에 맞는다」.
import fs from "node:fs";
import path from "node:path";
import { simulateBattle } from "../../../src/battle/simulate.ts";
import { actorBattlers } from "../../../src/battle/battleBattlers.ts";
import { resolveBattleBackdrop } from "../../../src/battle/battleBackdrop.ts";
import { bossBandReport, pathBattles } from "../../../src/ai/v2/story/pathBattleBudget.ts";
import { healingItemIds } from "../../../src/ai/v2/judge/combatChecks.ts";
import { startHealingItem } from "../../../src/ai/v2/story/healingAccess.ts";
import { isPassable } from "../../../src/project/collision.ts";
import type { Dir, Project } from "../../../src/project/types.ts";

const arg = process.argv[2];
if (!arg) { console.error("battleFitProbe <project.json | 폴더> [--json <out.json>]"); process.exit(2); }
const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : undefined;
const shotsOut = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : undefined;
const file = fs.statSync(arg).isDirectory() ? path.join(arg, "project.json") : arg;
const project = JSON.parse(fs.readFileSync(file, "utf8")) as Project;

const ids = (project.system.startActorIds ?? []).filter((id) => project.database.actors.some((a) => a.id === id));
const level = Math.max(1, ...ids.map((id) => project.database.actors.find((a) => a.id === id)!.initialLevel ?? 1));
const partyAt = (lv: number) => actorBattlers(project, { levels: Object.fromEntries(ids.map((id) => [id, lv])), partyActorIds: ids });
const party = partyAt(level);
const partyHp = party.reduce((sum, b) => sum + b.maxHp, 0);
const heals = healingItemIds(project);
const inventory = Object.fromEntries(Object.entries(project.session.inventory ?? {}).filter(([, n]) => n > 0));
const potion = startHealingItem(project);
const potions = Object.entries(inventory).reduce((sum, [id, n]) => sum + (heals.has(id) ? n : 0), 0);
const N = 24;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const sim = (troopId: string, sensible: boolean, heroLevel = level) => {
  try {
    const r = simulateBattle({ project, troopId, heroLevel, partyActorIds: ids, n: N, seed: 11, ...(sensible ? { useSkills: true, inventory, ...(potion && (inventory[potion] ?? 0) > 0 ? { potionItemId: potion } : {}) } : {}) });
    const hp = partyAt(heroLevel).reduce((sum, b) => sum + b.maxHp, 0);
    return { win: r.winRate, turns: r.avgTurns, lost: Math.max(0, 1 - r.avgHpRemaining / hp), potions: r.avgPotionsUsed };
  } catch (e) { return { win: -1, turns: 0, lost: 0, potions: 0, error: String((e as Error).message).slice(0, 120) }; }
};

const rows = pathBattles(project).map((b) => {
  const troop = project.database.troops.find((t) => t.id === b.troopId);
  const enemies = (troop?.enemyIds ?? []).map((id) => project.database.enemies.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);
  const map = project.maps[b.mapId];
  const ev = map?.events.find((e) => e.id === b.eventId);
  return {
    map: map?.name ?? b.mapId, role: b.role, touch: b.touch, troopId: b.troopId, name: troop?.name ?? b.troopId,
    enemies: enemies.map((e) => ({ name: e.name, level: e.level, hp: e.stats.maxHp, attack: e.stats.attack, mind: e.stats.mind, agility: e.stats.agility, hpBar: !e.hideHp, skills: [...new Set((e.actions ?? []).map((a) => project.database.skills.find((k) => k.id === a.skillId)?.name ?? a.skillId))] })),
    backdrop: resolveBattleBackdrop({ project, troopId: b.troopId, location: { mapId: b.mapId, x: ev?.x ?? 0, y: ev?.y ?? 0 } }),
    attackOnly: sim(b.troopId, false), sensible: sim(b.troopId, true),
  };
});

const lead = project.database.actors.find((a) => a.id === ids[0]);
const growth = [0, 1, 2, 3, 4].map((d) => { const b = partyAt(level + d)[0]; return b ? { level: level + d, maxHp: b.maxHp, attack: b.attackPower, defense: b.defense, agility: b.agility } : undefined; }).filter(Boolean);
const report = {
  file, party: { ids, level, hp: partyHp, lead: lead?.name, attack: party[0]?.attackPower, defense: party[0]?.defense, agility: party[0]?.agility, battler: lead?.battleCharacterResourceId ?? null },
  inventory, potions, potion: potion ?? null, expCurve: lead?.expCurve ?? null, growth, battles: rows,
};
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));

console.log(`파티 ${ids.join(",")} Lv${level} HP ${partyHp} 공 ${party[0]?.attackPower} 방 ${party[0]?.defense} 민 ${party[0]?.agility} · 회복약 ${potions}(${potion ?? "없음"}) · 전투 그림 ${report.party.battler}`);
console.log(`레벨별 선두 능력치: ${growth.map((g) => `Lv${g!.level} HP ${g!.maxHp}·공 ${g!.attack}·방 ${g!.defense}`).join(" / ")}`);
for (const r of rows) {
  console.log(`[${r.role}${r.touch ? "·닿으면" : ""}] ${r.map} — ${r.name} (${r.enemies.map((e) => `${e.name} Lv${e.level} HP ${e.hp} 공 ${e.attack}${e.hpBar ? "" : " ·HP 숨김"} «${e.skills.join("·")}»`).join(" + ")}) · 배경 ${r.backdrop}`);
  console.log(`    공격만·회복 없음: 승률 ${pct(r.attackOnly.win)} · ${r.attackOnly.turns.toFixed(1)}턴 · HP -${pct(r.attackOnly.lost)}   |   기술+회복약: 승률 ${pct(r.sensible.win)} · ${r.sensible.turns.toFixed(1)}턴 · HP -${pct(r.sensible.lost)} · 약 ${r.sensible.potions.toFixed(1)}개`);
}
// 보스 밴드 — 빌더가 재는 그대로(그 보스 앞에 도착하는 파티의 레벨·회복약).
for (const line of bossBandReport(project)) console.log(line);

if (shotsOut) {
  fs.mkdirSync(shotsOut, { recursive: true });
  // 곁에 설 칸: 적 칸으로 걸어 들어갈 수 있는 이웃(아래 → 왼쪽 → 오른쪽 → 위). 서서 적 쪽을 본다.
  const sides: readonly { dx: number; dy: number; face: Dir }[] = [{ dx: 0, dy: 1, face: "up" }, { dx: -1, dy: 0, face: "right" }, { dx: 1, dy: 0, face: "left" }, { dx: 0, dy: -1, face: "down" }];
  const shots = pathBattles(project).flatMap((b) => {
    const map = project.maps[b.mapId];
    const ev = map?.events.find((e) => e.id === b.eventId);
    if (!map || !ev) return [];
    const taken = new Set(map.events.map((e) => `${e.x},${e.y}`));
    const side = sides.find((s) => !taken.has(`${ev.x + s.dx},${ev.y + s.dy}`) && isPassable(project, map, ev.x + s.dx, ev.y + s.dy));
    if (!side) return [];
    // 싸움 페이지가 스위치를 바라면(앞 단계를 끝낸 뒤에만 싸우는 보스) 캡처가 그 스위치를 켠다.
    const fight = (ev.pages ?? []).find((page) => JSON.stringify(page.commands ?? []).includes('"battleProcessing"'));
    const switches = (fight?.conditions ?? []).flatMap((c) => { const cond = c as { kind?: string; switchId?: string; value?: boolean }; return cond.kind === "switch" && cond.switchId && cond.value !== false ? [cond.switchId] : []; });
    return [{ mapId: b.mapId, map: map.name ?? b.mapId, role: b.role, touch: b.touch, eventId: ev.id, troopId: b.troopId, foe: { x: ev.x, y: ev.y }, stand: { x: ev.x + side.dx, y: ev.y + side.dy }, face: side.face, switches }];
  });
  // 재생 결과의 project.json 은 번들 칩셋을 전부 펼쳐 담아 90MB 를 넘는다(플레이어 탭이 죽는다) — 맵이 쓰는 칩셋만, 참고문서는 빼고 싣는다.
  const used = new Set(Object.values(project.maps).map((map) => map.tilesetId));
  const tilesets = Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => used.has(id)).map(([id, tileset]) => [id, { ...tileset, referenceDocuments: undefined }]));
  const copy = { ...project, tilesets, system: { ...project.system, opening: { ...(project.system.opening ?? {}), enabled: false } } };
  fs.writeFileSync(path.join(shotsOut, "shots.project.json"), JSON.stringify(copy));
  fs.writeFileSync(path.join(shotsOut, "shots.json"), JSON.stringify(shots, null, 1));
  console.log(`캡처 자리 ${shots.length}곳 → ${path.join(shotsOut, "shots.json")}`);
}
