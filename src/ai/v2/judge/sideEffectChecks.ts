// 부작용 검사 — 요청하지 않았는데 바뀐 것(기존 NPC 그림·이름)과 비워진 전투 데이터.
import type { Project } from "@/project/types";
import { gameHasCombat } from "@/project/combatPresence";
import { FACTORY_HERO_ARMS } from "../genreDefaults";
import { isStageWrite, type StageWrites } from "../shared/stageWrites";
import type { Obj } from "./gameCheckReads";
import { asksLookChange, asksRemoval } from "../request/readers";
import { tagged, type Finding } from "./finding";

/** 장비 칸에서 사라진 것이 모두 공장 기본 장비인가. */
function onlyFactoryGearRemoved(before: unknown, after: unknown): boolean {
  const b = (before ?? {}) as Record<string, unknown>, a = (after ?? {}) as Record<string, unknown>;
  const gone = Object.keys(b).filter((slot) => b[slot] && a[slot] !== b[slot]);
  return gone.length > 0 && gone.every((slot) => FACTORY_HERO_ARMS[slot] === b[slot] && !a[slot]);
}

/** 값의 크기(배열 길이·객체의 빈 아닌 칸 수·빈 아닌 값 1). */
function fill(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") return Object.values(v as Obj).reduce<number>((n, x) => n + (fill(x) > 0 ? 1 : 0), 0);
  return v === undefined || v === null || v === "" || v === false ? 0 : 1;
}

const BATTLE_DATA: Record<"actors" | "classes", readonly string[]> = {
  actors: ["learnedSkills", "initialEquipment", "battleCommandIds", "classId"],
  classes: ["skillIds", "learnedSkills", "battleCommands", "equipmentPermissions"],
};

/**
 * 배우·직업의 전투 데이터가 줄었다. 완료를 막지 않는다 — 보고(databaseChangeReport)와 검토(advisor)에 싣는다.
 * 전에는 요청 낱말(asksBattleDataRemoval)로 «지우라고 했나» 를 갈라 막았다(2026-11-16 db-review B #9: 낱말이 빗나가면 정당한 「배움표 비워 줘」가 막혔다).
 * _task 는 옛 호출 모양을 위해 남긴다.
 */
export function battleDataEmptied(before: Project, after: Project, _task: string, writes?: StageWrites): Finding[] {
  const out: Finding[] = [];
  for (const section of ["actors", "classes"] as const) {
    const old = new Map(((before.database as unknown as Obj)[section] as Obj[] | undefined ?? []).map((r) => [String(r.id), r]));
    for (const r of ((after.database as unknown as Obj)[section] as Obj[] | undefined) ?? []) {
      const prev = old.get(String(r.id));
      if (!prev) continue;
      // 전투 없는 게임에서 공장 기본 장비(검·방패·갑옷…)만 뺀 것은 장르 기본값이다 — 「되돌려라」 하지 않는다(J88: 그 말에 조수가 검·방패를 다시 넣었다).
      const lost = BATTLE_DATA[section].filter((k) => fill(prev[k]) > 0 && fill(r[k]) < fill(prev[k]))
        .filter((k) => !(section === "actors" && k === "initialEquipment" && !gameHasCombat(after) && onlyFactoryGearRemoved(prev[k], r[k])))
        .filter((k) => !isStageWrite(writes, section, r, k));
      if (!lost.length) continue;
      out.push(tagged("game", "부작용", `기존 ${section === "actors" ? "배우" : "직업"} 「${String(r.name ?? r.id)}」의 전투 데이터(${lost.join(",")})를 비웠다 — 요청은 그 데이터를 지우라는 것이 아니다. 메뉴·화면에서 숨기는 것은 데이터 지우기가 아니다: 원래 값으로 되돌리고(${section === "actors" ? "upsert_actor" : "upsert_class"}), 메뉴 항목은 configure_field_menu{preset:'story'} 로, 체력 표시는 set_field_hud{off:true} 로 뺀다.`, { variant: "battle-data", target: { ref: String(r.id) } }));
    }
  }
  return out;
}

/** 요청과 상관없이 바뀌면 안 되는 것 — 기존 NPC 의 그림·이름이 요청 없이 바뀌었는지(고치기 요청에서 흔한 부작용). */
export function unaskedChanges(before: Project, after: Project, task: string, _writes?: StageWrites): Finding[] {
  const artAsk = asksLookChange(task);
  const out: Finding[] = [];
  if (!artAsk) for (const map of Object.values(before.maps)) {
    const now = after.maps[map.id];
    if (!now) continue;
    for (const ev of map.events ?? []) {
      const cur = (now.events ?? []).find((e) => e.id === ev.id);
      if (!cur) continue;
      const g0 = JSON.stringify(ev.pages?.[0]?.graphic ?? null), g1 = JSON.stringify(cur.pages?.[0]?.graphic ?? null);
      const f0 = JSON.stringify((ev.pages?.[0] as unknown as Obj | undefined)?.face ?? null), f1 = JSON.stringify((cur.pages?.[0] as unknown as Obj | undefined)?.face ?? null);
      if (g0 !== "null" && (g0 !== g1 || f0 !== f1)) out.push(tagged("game", "부작용", `기존 「${ev.name || ev.id}」의 그림·얼굴이 요청 없이 바뀌었다 — 원래 graphic·face 를 그대로 둔다.`, { variant: "look", target: { mapId: map.id, eventId: ev.id } }));
    }
  }
  // 요청 없이 지운 이야기 이벤트(2026-10-25 G31: 회상을 넣어 달라는 요청에 하나뿐인 오프닝 컷신 ev_v2cut_start 를 지우고 보고도 안 했다).
  // 장소를 다시 지으며 바뀐 것·자리표시·같은 이름으로 다시 만든 것은 빼고, 명령이 3개 이상인 이벤트만 센다.
  if (!asksRemoval(task)) {
    const names = new Set(Object.values(after.maps).flatMap((m) => (m.events ?? []).map((e) => e.name || e.id)));
    const ids = new Set(Object.values(after.maps).flatMap((m) => (m.events ?? []).map((e) => e.id)));
    for (const map of Object.values(before.maps)) {
      if (!after.maps[map.id]) continue;
      for (const ev of map.events ?? []) {
        if (ids.has(ev.id) || names.has(ev.name || ev.id) || /placeholder|자리표시/iu.test(`${ev.id} ${ev.name ?? ""}`)) continue;
        const size = (ev.pages ?? []).reduce((n, pg) => n + (pg.commands?.length ?? 0), 0);
        const auto = (ev.pages ?? []).some((pg) => ["auto", "parallel"].includes(String((pg.trigger as { kind?: string } | undefined)?.kind ?? "")));
        if (size < 3) continue;
        out.push(tagged("game", "부작용", `요청에 없는데 기존 이벤트 「${ev.name || ev.id}」(${ev.id}${auto ? ", 자동 실행 컷신" : ""}, 명령 ${size}개)를 지웠다 — 그 장면·대사가 게임에서 사라진다. 요청과 상관없으면 restore_event{eventId:"${ev.id}"} 로 요청 전 그대로 되살리고(기억으로 다시 쓰지 않는다), 일부러 대신했으면 보고에 무엇을 왜 지웠는지 적는다.`, { variant: "event", target: { mapId: map.id, eventId: ev.id } }));
      }
    }
  }
  // 자료집 레코드 변경(이름·값·목록)은 여기서 막지 않는다 — 요청 낱말로 «물어본 종류인가» 를 가르던 검사가 넓은 고치기(「자료집 전부 다시 써 줘」)를 막고,
  // 「옷·모습·목적지」 같은 낱말 하나에 통째로 꺼졌다(2026-11-16 db-review B #9). 무엇이 바뀌었는지는 databaseChangeReport 가 보고에 적고,
  // 목록이 줄어든 쓰기는 도구 결과가 그 자리에서 «LIST SHRANK» 로 알린다(dbUpsertEnvelope.ts).
  return out.slice(0, 6);
}

/** 자료집 묶음 — 보고에 싣는 순서. 공용 이벤트는 프로젝트 뿌리에 있다. */
const REPORT_SECTIONS = ["actors", "classes", "skills", "items", "equipment", "enemies", "troops", "states", "elements", "battleCommands", "battleAnimations", "equipmentSlots", "monsterSpecies", "schedules"] as const;

/**
 * 이번 요청이 자료집에서 바꾼 것 — 묶음마다 만든 것·지운 것·고친 것(칸 이름), 줄어든 목록, 비운 전투 데이터, 용어. 완료를 막지 않는다(보고와 실행 기록에만).
 * writes = 끝맺음 단계가 스스로 쓴 칸(stageWrites) — «조수가 고침» 과 «끝맺음이 맞춤» 을 가른다.
 */
export function databaseChangeReport(before: Project, after: Project, writes?: StageWrites): string[] {
  const out: string[] = [];
  const untouched: string[] = [];
  let touchedRecords = 0;
  const rows = (p: Project, section: string): Obj[] => (section === "commonEvents" ? (p.commonEvents as unknown as Obj[]) : (((p.database as unknown as Record<string, unknown>)[section] as Obj[] | undefined) ?? []));
  for (const section of [...REPORT_SECTIONS, "commonEvents"]) {
    const was = new Map(rows(before, section).map((r) => [String(r.id), r]));
    const now = new Map(rows(after, section).map((r) => [String(r.id), r]));
    const created = [...now.keys()].filter((id) => !was.has(id));
    const deleted = [...was.keys()].filter((id) => !now.has(id));
    const changed: string[] = [];
    const shrank: string[] = [];
    for (const [id, r] of now) {
      const prev = was.get(id);
      if (!prev || JSON.stringify(prev) === JSON.stringify(r)) continue;
      // 길 맞춤 사본(enemy_path_* · skill_path_*)은 끝맺음이 만들고 맞추는 행이다 — 모델이 원본을 고치면 걷었다가 다시 만든다(story/foughtCopy).
      // 다시 만든 행은 단계 쓰기 기록에 «새 행» 으로 빠져 모델이 바꾼 것으로 짚혔다(2026-11-16 명세 은행 r3b-fun, main #4751 — 여기로 옮겼다).
      if (/^(?:enemy|skill)_path_/u.test(id)) continue;
      const keys = Object.keys({ ...prev, ...r }).filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(r[k]));
      const own = keys.filter((k) => !isStageWrite(writes, section, r, k));
      if (!own.length) continue;
      changed.push(`${String(r.name ?? id)}(${own.slice(0, 4).join(",")}${own.length > 4 ? "…" : ""})`);
      for (const k of own) if (Array.isArray(prev[k]) && Array.isArray(r[k]) && (r[k] as unknown[]).length < (prev[k] as unknown[]).length) shrank.push(`${String(r.name ?? id)}.${k} ${(prev[k] as unknown[]).length}→${(r[k] as unknown[]).length}`);
    }
    if (!created.length && !deleted.length && !changed.length) { untouched.push(`${section} ${now.size}`); continue; }
    touchedRecords += created.length + deleted.length + changed.length;
    const name = (id: string, m: Map<string, Obj>) => String(m.get(id)?.name ?? id);
    out.push(`${section}: ${[
      created.length ? `만듦 ${created.length}(${created.slice(0, 5).map((id) => name(id, now)).join(", ")}${created.length > 5 ? " …" : ""})` : "",
      deleted.length ? `지움 ${deleted.length}(${deleted.slice(0, 5).map((id) => name(id, was)).join(", ")}${deleted.length > 5 ? " …" : ""})` : "",
      changed.length ? `고침 ${changed.length}/${now.size}(${changed.slice(0, 5).join(", ")}${changed.length > 5 ? " …" : ""})` : "",
    ].filter(Boolean).join(" · ")}${shrank.length ? ` · 줄어든 목록 ${shrank.slice(0, 4).join(", ")}${shrank.length > 4 ? " …" : ""}` : ""}`);
  }
  // 넓게 고친 요청(레코드 20개 이상)이면 손대지 않은 묶음과 그 크기를 적는다 — 「자료집 전부 ○○로」 가 한 턴에 다 끝나지 않았을 때
  // 보고가 «무엇이 남았나» 를 말한다(2026-11-16 리뷰 D). 묶음 크기 0 은 뺀다.
  if (touchedRecords >= 20) { const left = untouched.filter((u) => !u.endsWith(" 0")); if (left.length) out.push(`손대지 않은 묶음(레코드 수): ${left.join(", ")}`); }
  const t0 = (before.meta?.terms ?? {}) as unknown as Record<string, unknown>, t1 = (after.meta?.terms ?? {}) as unknown as Record<string, unknown>;
  const terms = Object.keys({ ...t0, ...t1 }).filter((k) => JSON.stringify(t0[k]) !== JSON.stringify(t1[k]));
  if (terms.length) out.push(`용어: ${terms.slice(0, 8).map((k) => `${k} «${String(t0[k] ?? "")}»→«${String(t1[k] ?? "")}»`).join(", ")}`);
  // 배우·직업의 전투 데이터를 비운 것은 따로 한 줄(메뉴에서 숨기라는 요청을 데이터 지우기로 흉내 낸 2026-10-25 T4 — 이제 막지 않고 보이게 적는다).
  for (const f of battleDataEmptied(before, after, "", writes).slice(0, 4)) out.push(`⚠ 비운 전투 데이터: ${f.ko.replace(/^\[[^\]]*\]\s*/u, "").split(" — ")[0]}`);
  return out;
}
