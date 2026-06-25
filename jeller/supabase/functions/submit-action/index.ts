// MCGA submit-action Edge Function (Deno).
// 플레이어가 숏에 대한 행동을 제출 → 검증 + 적용 + 결과 반환.
// 부문 일치 검증, 대상 고을 식별, 엔진 공식 적용(src/engine.ts applyAction과 동일).
// STEP 2: 결과만 반환 (왕 판결은 STEP 3 king-judgment에서).

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

// ── 엔진 공식 (src/engine.ts applyAction과 동일) ──
interface ActionResult {
  territoryPatch: Partial<DbTerritory>;
  summary: string;
  fame_delta: number;
}

function actionOffice(kind: string): "interior" | "military" | null {
  switch (kind) {
    case "tax_raise":
    case "grain_levy":
    case "infrastructure":
    case "relief":
      return "interior";
    case "conscript":
    case "train":
    case "attack":
    case "defend":
      return "military";
    default:
      return null;
  }
}

function applyAction(kind: string, t: DbTerritory): ActionResult {
  switch (kind) {
    case "tax_raise": {
      const grainGain = Math.round(t.population * 0.1);
      const popLoss = Math.round(t.population * 0.03);
      return {
        territoryPatch: { grain: t.grain + grainGain, population: Math.max(0, t.population - popLoss) },
        summary: `곡물 +${grainGain}, 민심 하락(인구 -${popLoss})`,
        fame_delta: 1,
      };
    }
    case "grain_levy": {
      const grainGain = Math.round(t.population * 0.2);
      const popLoss = Math.round(t.population * 0.06);
      return {
        territoryPatch: { grain: t.grain + grainGain, population: Math.max(0, t.population - popLoss) },
        summary: `군량 +${grainGain}, 민심 급락(인구 -${popLoss})`,
        fame_delta: 0,
      };
    }
    case "infrastructure": {
      const popGain = Math.round(t.population * 0.02);
      return {
        territoryPatch: { grain: Math.max(0, t.grain - 50), population: t.population + popGain },
        summary: `치수 시공 (곡물 -50), 인구 +${popGain}`,
        fame_delta: 2,
      };
    }
    case "relief": {
      const grainCost = Math.round(t.population * 0.1);
      const popGain = Math.round(t.population * 0.04);
      return {
        territoryPatch: { grain: Math.max(0, t.grain - grainCost), population: t.population + popGain },
        summary: `기민 구제 (곡물 -${grainCost}), 인구 +${popGain}`,
        fame_delta: 2,
      };
    }
    case "conscript": {
      const troopGain = Math.round(t.population * 0.1);
      return {
        territoryPatch: {
          troops: t.troops + troopGain,
          population: Math.max(0, t.population - troopGain),
          grain: Math.max(0, t.grain - troopGain * 2),
        },
        summary: `병력 +${troopGain}, 인구 -${troopGain}, 곡물 -${troopGain * 2}`,
        fame_delta: 1,
      };
    }
    case "train": {
      const troopLoss = Math.round(t.troops * 0.02);
      return {
        territoryPatch: {
          combat_power: Math.min(100, t.combat_power + 5),
          troops: Math.max(0, t.troops - troopLoss),
        },
        summary: `전투력 +5, 병력 -${troopLoss}`,
        fame_delta: 1,
      };
    }
    case "defend":
      return {
        territoryPatch: { combat_power: Math.min(100, t.combat_power + 3) },
        summary: "수비 태세 (전투력 +3)",
        fame_delta: 1,
      };
    case "attack": {
      const troopCost = Math.round(t.troops * 0.3);
      return {
        territoryPatch: { troops: Math.max(0, t.troops - troopCost) },
        summary: `출병 준비 (병력 -${troopCost} 투입)`,
        fame_delta: 0,
      };
    }
    default:
      return { territoryPatch: {}, summary: "알 수 없는 행동", fame_delta: 0 };
  }
}

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "missing env" }, 500);
  }

  let body: { short_id?: string; action?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty
  }
  const shortId = body.short_id;
  const action = body.action;
  if (!shortId || !action) {
    return json({ error: "short_id and action required" }, 400);
  }

  const office = actionOffice(action);
  if (!office) {
    return json({ error: `unknown action: ${action}` }, 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. 숏 티켓 + 신하 조회 (해결 안 된 것만)
  const { data: ticket } = await sb
    .from("short_tickets")
    .select("*")
    .eq("id", shortId)
    .eq("status", "pending")
    .maybeSingle();
  if (!ticket) {
    return json({ error: "short not found or already resolved" }, 404);
  }

  const { data: subject } = await sb
    .from("subjects")
    .select("*")
    .eq("id", ticket.subject_id)
    .eq("alive", true)
    .maybeSingle();
  if (!subject) {
    return json({ error: "subject not found or dead" }, 404);
  }

  // 2. 부문 일치 검증 — 군사 부문 신하가 내정 행동 제출 불가 (반대도 마찬가지)
  if (subject.office !== office) {
    return json(
      { error: `office mismatch: subject is ${subject.office}, action needs ${office}` },
      403
    );
  }

  // 3. 대상 고을 식별 — 신하에게 할당된 고을, 없으면 수도
  let territoryId = subject.territory_id;
  if (!territoryId) {
    const { data: nation } = await sb
      .from("nations")
      .select("capital_id")
      .eq("id", subject.nation_id)
      .maybeSingle();
    territoryId = nation?.capital_id ?? null;
  }
  if (!territoryId) {
    return json({ error: "no target territory for subject" }, 400);
  }

  const { data: territory } = await sb
    .from("territories")
    .select("*")
    .eq("id", territoryId)
    .maybeSingle() as { data: DbTerritory | null };
  if (!territory) {
    return json({ error: "territory not found" }, 404);
  }

  // 4. 행동 적용
  const result = applyAction(action, territory);
  const { data: updatedTerr } = await sb
    .from("territories")
    .update(result.territoryPatch)
    .eq("id", territoryId)
    .select("*")
    .maybeSingle();

  // 5. 공명(명성) 갱신
  const newFame = (subject.fame ?? 0) + result.fame_delta;
  await sb.from("subjects").update({ fame: newFame }).eq("id", subject.id);

  // 6. 숏 티켓 해결 처리
  await sb
    .from("short_tickets")
    .update({ status: "resolved", chosen_action: action })
    .eq("id", shortId);

  return json({
    result: {
      action,
      territory: updatedTerr,
      summary: result.summary,
      fame_delta: result.fame_delta,
      new_fame: newFame,
    },
    // STEP 3에서 이 자리에 왕의 판결(verdict)이 추가됨.
    verdict: null,
  });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
