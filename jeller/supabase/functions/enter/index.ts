// MCGA enter Edge Function (Deno).
// 닉네임으로 입장 → users 생성/조회 → 조선의 빈 신하 자리(봇)를 사람으로 인계.
// 반환: user_id, subject_id, subject 정보(부문, 고을).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DEFAULT_FACTION = "chosun"; // 플레이어 기본 세력 (스펙 6-A)

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "missing env" }, 500);
  }

  let body: { nickname?: string; faction?: string } = {};
  try {
    body = await req.json();
  } catch {
    // GET 또는 빈 본문 허용
  }
  const nickname = (body.nickname ?? "").trim();
  const faction = body.faction ?? DEFAULT_FACTION;

  if (!nickname) {
    return json({ error: "nickname required" }, 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. users upsert (닉네임 기준)
  const { data: existingUser } = await sb
    .from("users")
    .select("id")
    .eq("nickname", nickname)
    .maybeSingle();

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
  } else {
    const userIdNew = `u_${crypto.randomUUID()}`;
    const { error } = await sb.from("users").insert({
      id: userIdNew,
      nickname,
    });
    if (error) return json({ error: `user insert: ${error.message}` }, 500);
    userId = userIdNew;
  }

  // 2. 이미 이 유저가 소속한 살아있는 신하가 있으면 그대로 반환 (재접속)
  const { data: existingSubject } = await sb
    .from("subjects")
    .select("*")
    .eq("user_id", userId)
    .eq("alive", true)
    .maybeSingle();

  if (existingSubject) {
    return json({
      user_id: userId,
      subject: existingSubject,
      reassigned: false,
    });
  }

  // 3. 조선(또는 지정 세력)의 빈 봇 신하 자리 하나 인계.
  //    전략: 해당 세력의 봇 신하 중 user_id가 null인 것을 사람으로 전환.
  //          없으면 새 신하 생성 (영의정으로 — 부문은 빈 자리에 따라).
  const { data: botSlot } = await sb
    .from("subjects")
    .select("*")
    .eq("nation_id", faction)
    .eq("is_bot", true)
    .is("user_id", null)
    .limit(1)
    .maybeSingle();

  let subjectId: string;
  let subjectRow: Record<string, unknown>;

  if (botSlot) {
    // 봇 자리 → 사람 인계
    subjectId = botSlot.id;
    const { data: updated, error } = await sb
      .from("subjects")
      .update({
        user_id: userId,
        is_bot: false,
        nickname,
      })
      .eq("id", subjectId)
      .select("*")
      .single();
    if (error || !updated) return json({ error: `reassign: ${error?.message}` }, 500);
    subjectRow = updated;
  } else {
    // 빈 봇 자리 없음 → 새 신하 생성 (병조판서로 — 영의정 자리가 보통 먼저 참)
    subjectId = `s_${crypto.randomUUID()}`;
    const { data: created, error } = await sb
      .from("subjects")
      .insert({
        id: subjectId,
        nation_id: faction,
        user_id: userId,
        nickname,
        office: "military",
        territory_id: null,
        fame: 0,
        is_bot: false,
        alive: true,
      })
      .select("*")
      .single();
    if (error || !created) return json({ error: `create subject: ${error?.message}` }, 500);
    subjectRow = created;
  }

  return json({
    user_id: userId,
    subject: subjectRow,
    reassigned: true,
  });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
