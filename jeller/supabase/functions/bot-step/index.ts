// MCGA bot-step Edge Function (Deno).
// pg_cron 이 5분마다 호출 → 세계 틱 1회분 수행:
//   1. 모든 고을 자원 갱신 (결정론적)
//   2. 봇 신하 행동 (코드 휴리스틱 — GPT 없음)
//   3. 봇 왕 결정 → 활성 전쟁 발생 시 전투 해석 + 점령
//   4. 멸만 처리
//   5. tick 증가 + event_logs 기록
//
// 엔진 공식은 src/engine.ts 와 동일 (Deno 클라이언트 tsconfig를 안 타므로 인라인).
// 키/시크릿 없음 — GPT 호출은 STEP 3 king-judgment 함수에서만.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface DbTerritory {
  id: string;
  nation_id: string | null;
  name: string;
  population: number;
  grain: number;
  troops: number;
  combat_power: number;
  q: number;
  r: number;
}

// ── 결정론적 자원 갱신 (src/engine.ts tickResources 와 동일) ──
function tickResources(t: DbTerritory): Partial<DbTerritory> {
  const grainGross = Math.round(t.population * 0.05);
  const grainConsume = Math.round(t.population * 0.03);
  const canGrow = t.grain + grainGross - grainConsume >= 0;
  const popGrowth = canGrow
    ? Math.max(1, Math.round(t.population * 0.01))
    : -Math.round(t.population * 0.02);
  return {
    grain: Math.max(0, t.grain + grainGross - grainConsume),
    population: Math.max(0, t.population + popGrowth),
  };
}

// ── 전투 해석 (src/engine.ts resolveCombat 와 동일) ──
interface CombatResult {
  winner: "attacker" | "defender";
  attacker_losses: number;
  defender_losses: number;
  territory_captured: boolean;
}
function resolveCombat(
  attackerTroops: number,
  attackerPower: number,
  defender: DbTerritory
): CombatResult {
  const attackerStrength = attackerTroops * (attackerPower / 100);
  const defenderStrength = defender.troops * (defender.combat_power / 100);
  if (attackerStrength <= 0 && defenderStrength <= 0) {
    return { winner: "defender", attacker_losses: 0, defender_losses: 0, territory_captured: false };
  }
  const total = attackerStrength + defenderStrength;
  const attackerWinRate = attackerStrength / total;
  const attackerWins = attackerWinRate >= 0.5;
  const loserLossRate = 0.6;
  const winnerLossRate = 0.35;
  return {
    winner: attackerWins ? "attacker" : "defender",
    attacker_losses: Math.round(attackerTroops * (attackerWins ? winnerLossRate : loserLossRate)),
    defender_losses: Math.round(defender.troops * (attackerWins ? loserLossRate : winnerLossRate)),
    territory_captured: attackerWins,
  };
}

// ── 헥스 인접 판정 (axial 거리) ──
function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  return (
    (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
  );
}

Deno.serve(async (_req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "missing env" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const startedAt = Date.now();

  // 1. 현재 시즌/틱
  const { data: world } = await sb
    .from("world_state")
    .select("season_id, tick")
    .eq("id", 1)
    .single();
  const seasonId = world?.season_id ?? 1;
  const tick = (world?.tick ?? 0) + 1;

  // 2. 자원 갱신 (모든 고을)
  const { data: territories } = await sb
    .from("territories")
    .select("*");
  const allTerr: DbTerritory[] = (territories ?? []) as DbTerritory[];

  let resourceUpdates = 0;
  for (const t of allTerr) {
    const upd = tickResources(t);
    await sb.from("territories").update(upd).eq("id", t.id);
    resourceUpdates++;
  }

  // 3. 봇 왕 행동: 약한 이웃 고을 침공 기회 탐색.
  //    단순 휴리스틱 — 자기 병력 > 이웃 수비 병력×1.3 이고 인접(헥스 거리 1)이면 전쟁 발생.
  //    GPT 없이 결정론적.
  const freshTerr = (await sb.from("territories").select("*")).data as DbTerritory[] ?? [];
  const botsByNation = new Map<string, { capital: DbTerritory; own: DbTerritory[] }>();
  for (const n of ["chosun", "myung", "yeojin", "wae", "ryukyu", "annam", "champa", "mongol"]) {
    const own = freshTerr.filter((t) => t.nation_id === n);
    const { data: nationRow } = await sb.from("nations").select("capital_id, eliminated").eq("id", n).single();
    const cap = own.find((t) => t.id === nationRow?.capital_id) ?? own[0];
    if (cap && !nationRow?.eliminated) botsByNation.set(n, { capital: cap, own });
  }

  let combatsResolved = 0;
  const eliminated: string[] = [];
  const ownershipChanges: Array<{ territory_id: string; from: string | null; to: string | null }> = [];

  for (const [nationId, { own }] of botsByNation) {
    if (own.length === 0) continue;
    // 병력 가장 많은 고을에서 출병
    const source = own.reduce((a, b) => (b.troops > a.troops ? b : a));
    if (source.troops < 100) continue; // 출병 최소 병력

    // 인접 적/무주공산 고을 중 가장 약한 것 타겟
    const targets = freshTerr
      .filter((t) => t.id !== source.id && t.nation_id !== nationId)
      .filter((t) => hexDistance({ q: source.q, r: source.r }, { q: t.q, r: t.r }) === 1)
      .sort((a, b) => a.troops - b.troops);

    const target = targets[0];
    if (!target) continue;
    if (source.troops < target.troops * 1.3) continue; // 우세할 때만

    // 전투
    const attackerTroops = Math.round(source.troops * 0.7); // 70% 출병
    const attackerPower = 60; // 봇 기본 전투력
    const result = resolveCombat(attackerTroops, attackerPower, target);
    combatsResolved++;

    // 출병 고을 병력 감소
    await sb.from("territories").update({
      troops: Math.max(0, source.troops - attackerTroops + Math.max(0, attackerTroops - result.attacker_losses)),
    }).eq("id", source.id);

    if (result.territory_captured && target.nation_id) {
      const previousOwner = target.nation_id;
      // 점령: 소유권 이전, 잔여 병력/전투력 감소 (applyCapture 공식)
      await sb.from("territories").update({
        nation_id: nationId,
        troops: Math.round(target.troops * 0.2),
        combat_power: Math.max(10, Math.round(target.combat_power * 0.5)),
      }).eq("id", target.id);
      ownershipChanges.push({ territory_id: target.id, from: previousOwner, to: nationId });

      // 멸만 판정
      const { count } = await sb
        .from("territories")
        .select("*", { count: "exact", head: true })
        .eq("nation_id", previousOwner);
      if ((count ?? 0) === 0) {
        eliminated.push(previousOwner);
        await sb.from("nations").update({ eliminated: true }).eq("id", previousOwner);
        await sb.from("kings").update({ alive: false }).eq("nation_id", previousOwner);
      }
    }
  }

  // 4. 사건 로그 (전투/점령 기록)
  for (const oc of ownershipChanges) {
    await sb.from("event_logs").insert({
      season_id: seasonId,
      tick_at: tick,
      type: "invasion",
      payload: { territory_id: oc.territory_id, from: oc.from, to: oc.to },
      affected_subject_ids: [],
    });
  }

  // 5. 틱 증가
  await sb.from("world_state").update({ tick }).eq("id", 1);

  const elapsedMs = Date.now() - startedAt;
  const result = {
    tick,
    resource_updates: resourceUpdates,
    combats_resolved: combatsResolved,
    nations_eliminated: eliminated,
    territory_ownership_changes: ownershipChanges,
    elapsed_ms: elapsedMs,
  };

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
