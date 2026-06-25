// MCGA fetch-shorts Edge Function (Deno).
// 신하의 부문 관련 사건을 숏(short)으로 반환.
// 긴급 사건(침공 등) 우선, 없으면 일상 숏(왕의 일상 명령/세금 건의).
// STEP 2: 판결은 정적(왕 대사 없이 결과만). STEP 3에서 king-judgment로 판결 연결.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "missing env" }, 500);
  }

  let body: { subject_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // 쿼리 파라미터 허용
  }
  const subjectId = body.subject_id ?? new URL(req.url).searchParams.get("subject_id");
  if (!subjectId) {
    return json({ error: "subject_id required" }, 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 신하 정보
  const { data: subject } = await sb
    .from("subjects")
    .select("*")
    .eq("id", subjectId)
    .eq("alive", true)
    .maybeSingle();
  if (!subject) {
    return json({ error: "subject not found or dead" }, 404);
  }

  // 현재 시즌/틱
  const { data: world } = await sb
    .from("world_state")
    .select("season_id, tick")
    .eq("id", 1)
    .single();
  const seasonId = world?.season_id ?? 1;
  const tick = world?.tick ?? 0;

  // 해결 안 된 숏이 이미 있으면 그것 반환 (중복 생성 방지)
  const { data: existingShort } = await sb
    .from("short_tickets")
    .select("*, event_logs(*)")
    .eq("subject_id", subjectId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingShort) {
    return json({ short: shapeShort(existingShort, subject, tick) });
  }

  // 새 숏 생성. 긴급(침공) 우선 → 내 고을 관련 사건 → 일상.
  const short = await generateShort(sb, subject, seasonId, tick);
  if (!short) {
    return json({ short: null, reason: "no events available" });
  }
  return json({ short });
});

interface ShortData {
  short_id: string;
  event_id: number | null;
  type: string;
  briefing: string; // 상황 설명
  territory?: { id: string; name: string; troops: number; grain: number; population: number };
  options: Array<{ kind: string; label: string; hint: string }>;
  tick: number;
}

/** DB 행을 클라이언트용 숏 데이터로 변환. */
function shapeShort(
  row: {
    id: string;
    event_id: number;
    type?: string;
    event_logs?: { type: string; payload: Record<string, unknown> } | null;
  },
  subject: { office: string },
  tick: number
): ShortData {
  const eventType = row.event_logs?.type ?? "royal_decree";
  const office = subject.office;
  return {
    short_id: row.id,
    event_id: row.event_id,
    type: eventType,
    briefing: briefingFor(eventType, row.event_logs?.payload ?? {}),
    options: optionsFor(office, eventType),
    tick,
  };
}

async function generateShort(
  sb: ReturnType<typeof createClient>,
  subject: { id: string; nation_id: string; office: string; territory_id: string | null },
  seasonId: number,
  tick: number
): Promise<ShortData | null> {
  // 1) 긴급: 내 세력 고을에 대한 최근 침공 사건
  const { data: invasionEvent } = await sb
    .from("event_logs")
    .select("*")
    .eq("season_id", seasonId)
    .eq("type", "invasion")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  let eventType = "royal_decree";
  let payload: Record<string, unknown> = {};
  let territoryRef: { id: string; name: string } | null = null;

  if (invasionEvent) {
    eventType = "war_report";
    payload = invasionEvent.payload ?? {};
    // 침공 대상 고을 정보
    const targetId = (payload as { territory_id?: string }).territory_id;
    if (targetId) {
      const { data: t } = await sb.from("territories").select("*").eq("id", targetId).maybeSingle();
      if (t) territoryRef = { id: t.id, name: t.name };
    }
  } else {
    // 2) 일상: 부문별 명분. 내정=세금 건의, 군사=병력 현황.
    eventType = subject.office === "interior" ? "tax_proposal" : "war_report";
  }

  // 대상 고을: 신하에게 할당된 고을 우선, 없으면 수도
  let territoryRow: Record<string, unknown> | null = null;
  if (subject.territory_id) {
    const { data } = await sb.from("territories").select("*").eq("id", subject.territory_id).maybeSingle();
    territoryRow = data;
  } else {
    const { data: cap } = await sb
      .from("nations")
      .select("capital_id")
      .eq("id", subject.nation_id)
      .maybeSingle();
    if (cap?.capital_id) {
      const { data } = await sb.from("territories").select("*").eq("id", cap.capital_id).maybeSingle();
      territoryRow = data;
    }
  }

  // 이벤트 로그 생성 (일상 숏도 기록)
  const { data: eventRow } = await sb
    .from("event_logs")
    .insert({
      season_id: seasonId,
      tick_at: tick,
      type: eventType,
      payload: { ...payload, subject_office: subject.office, territory: territoryRef?.name ?? null },
      affected_subject_ids: [subject.id],
    })
    .select("*")
    .single();

  const eventId = (eventRow as { id: number } | null)?.id ?? 0;

  // 숏 티켓 생성
  const shortId = `short_${crypto.randomUUID()}`;
  await sb.from("short_tickets").insert({
    id: shortId,
    subject_id: subject.id,
    event_id: eventId,
    status: "pending",
  });

  const territory =
    territoryRow
      ? {
          id: String(territoryRow.id),
          name: String(territoryRow.name),
          troops: Number(territoryRow.troops),
          grain: Number(territoryRow.grain),
          population: Number(territoryRow.population),
        }
      : undefined;

  return {
    short_id: shortId,
    event_id: eventId,
    type: eventType,
    briefing: briefingFor(eventType, payload),
    territory,
    options: optionsFor(subject.office, eventType),
    tick,
  };
}

function briefingFor(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "war_report": {
      const from = (payload.from as string) ?? "적";
      const to = (payload.to as string) ?? "아군";
      const terr = (payload.territory as string) ?? "고을";
      return `${from}(이)가 ${terr}(을)를 침공했다. 현재 점령은 ${to}. 병력을 어찌 조치할터이냐?`;
    }
    case "tax_proposal":
      return "세금을 올려 곡물을 비축할 수 있으나, 민심이 흉흉해진다. 어찌 하시겠소?";
    case "invasion":
      return "적병이 국경에 나타났다. 출병이냐, 수비냐.";
    default:
      return "왕의 명을 받들어 고을을 다스리시오.";
  }
}

function optionsFor(office: string, _type: string): Array<{ kind: string; label: string; hint: string }> {
  if (office === "military") {
    return [
      { kind: "conscript", label: "징병", hint: "병력↑ 인구·곡물↓" },
      { kind: "train", label: "훈련", hint: "전투력↑ 병력 약↓" },
      { kind: "defend", label: "수비 강화", hint: "전투력 약↑ 병력 보존" },
      { kind: "attack", label: "출병", hint: "병력 투입 → 전과" },
    ];
  }
  return [
    { kind: "tax_raise", label: "세율 인상", hint: "곡물↑ 민심↓" },
    { kind: "grain_levy", label: "곡물 징수", hint: "곡물 대↑ 민심 급↓" },
    { kind: "infrastructure", label: "치수·양잠", hint: "장기↑ 곡물 약↓" },
    { kind: "relief", label: "진휼", hint: "민심↑ 곡물↓" },
  ];
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
