// 부작용 검사 — 요청하지 않았는데 바뀐 것(기존 NPC 그림·이름)과 비워진 전투 데이터.
import type { Project } from "@/project/types";
import { gameHasCombat } from "@/project/combatPresence";
import { FACTORY_HERO_ARMS } from "../genreDefaults";
import { isStageWrite, type StageWrites } from "../stageWrites";
import { Obj } from "./gameCheckReads";

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

/** 배우·직업의 전투 데이터가 줄었다(요청이 메뉴·화면이 아니라 그 데이터를 지우라고 했을 때만 정상). */
export function battleDataEmptied(before: Project, after: Project, task: string, writes?: StageWrites): string[] {
  const deleteAsk = /(스킬|기술|장비|직업|전투\s*명령|skill|equip)[^.!?\n]{0,10}(지워|지우|없애|삭제|비워|빼앗|못\s*쓰게|배우지)/iu.test(task)
    && !/메뉴|탭|ESC|화면|창에서|창의|HUD|menu/iu.test(task);
  if (deleteAsk) return [];
  const out: string[] = [];
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
      out.push(`[게임 검사 부작용] 기존 ${section === "actors" ? "배우" : "직업"} 「${String(r.name ?? r.id)}」의 전투 데이터(${lost.join(",")})를 비웠다 — 요청은 그 데이터를 지우라는 것이 아니다. 메뉴·화면에서 숨기는 것은 데이터 지우기가 아니다: 원래 값으로 되돌리고(${section === "actors" ? "upsert_actor" : "upsert_class"}), 메뉴 항목은 configure_field_menu{preset:'story'} 로, 체력 표시는 set_field_hud{off:true} 로 뺀다.`);
    }
  }
  return out;
}

/** 요청과 상관없이 바뀌면 안 되는 것 — 기존 NPC 의 그림·이름이 요청 없이 바뀌었는지(고치기 요청에서 흔한 부작용). */
export function unaskedChanges(before: Project, after: Project, task: string, writes?: StageWrites): string[] {
  const artAsk = /그림|외형|모습|얼굴|옷|칩|graphic|sprite|face/iu.test(task);
  const out: string[] = [];
  if (!artAsk) for (const map of Object.values(before.maps)) {
    const now = after.maps[map.id];
    if (!now) continue;
    for (const ev of map.events ?? []) {
      const cur = (now.events ?? []).find((e) => e.id === ev.id);
      if (!cur) continue;
      const g0 = JSON.stringify(ev.pages?.[0]?.graphic ?? null), g1 = JSON.stringify(cur.pages?.[0]?.graphic ?? null);
      const f0 = JSON.stringify((ev.pages?.[0] as unknown as Obj | undefined)?.face ?? null), f1 = JSON.stringify((cur.pages?.[0] as unknown as Obj | undefined)?.face ?? null);
      if (g0 !== "null" && (g0 !== g1 || f0 !== f1)) out.push(`[게임 검사 부작용] 기존 「${ev.name || ev.id}」의 그림·얼굴이 요청 없이 바뀌었다 — 원래 graphic·face 를 그대로 둔다.`);
    }
  }
  // 요청 없이 지운 이야기 이벤트(2026-10-25 G31: 회상을 넣어 달라는 요청에 하나뿐인 오프닝 컷신 ev_v2cut_start 를 지우고 보고도 안 했다).
  // 장소를 다시 지으며 바뀐 것·자리표시·같은 이름으로 다시 만든 것은 빼고, 명령이 3개 이상인 이벤트만 센다.
  if (!/지워|지우|삭제|없애|빼\s*줘|빼고|치워|remove|delete/iu.test(task)) {
    const names = new Set(Object.values(after.maps).flatMap((m) => (m.events ?? []).map((e) => e.name || e.id)));
    const ids = new Set(Object.values(after.maps).flatMap((m) => (m.events ?? []).map((e) => e.id)));
    for (const map of Object.values(before.maps)) {
      if (!after.maps[map.id]) continue;
      for (const ev of map.events ?? []) {
        if (ids.has(ev.id) || names.has(ev.name || ev.id) || /placeholder|자리표시/iu.test(`${ev.id} ${ev.name ?? ""}`)) continue;
        const size = (ev.pages ?? []).reduce((n, pg) => n + (pg.commands?.length ?? 0), 0);
        const auto = (ev.pages ?? []).some((pg) => ["auto", "parallel"].includes(String((pg.trigger as { kind?: string } | undefined)?.kind ?? "")));
        if (size < 3) continue;
        out.push(`[게임 검사 부작용] 요청에 없는데 기존 이벤트 「${ev.name || ev.id}」(${ev.id}${auto ? ", 자동 실행 컷신" : ""}, 명령 ${size}개)를 지웠다 — 그 장면·대사가 게임에서 사라진다. 요청과 상관없으면 restore_event{eventId:"${ev.id}"} 로 요청 전 그대로 되살리고(기억으로 다시 쓰지 않는다), 일부러 대신했으면 보고에 무엇을 왜 지웠는지 적는다.`);
      }
    }
  }
  // 배우·직업의 전투 데이터(배울 기술·처음 장비·전투 명령·장비 허용)를 비웠다 — 「메뉴의 스킬·장비 빼 줘」를 데이터 지우기로 흉내 냈다
  // (2026-10-25 장난감 가게 고치기 4턴: 메뉴 도구가 안 실려 upsert_actor·upsert_class 로 주인공 기술·직업을 비웠다. 요청에 「파티」「스킬」이 있어
  // 아래 일반 검사의 낱말 면제에 걸려 못 잡았다). 메뉴·화면에서 숨기는 요청이면 데이터는 그대로 둔다 — 낱말 면제 없이 본다.
  out.push(...battleDataEmptied(before, after, task, writes));
  // 이미 있던 데이터(아이템·장비·적·기술·직업)를 요청이 그 이름을 말하지 않았는데 고쳤다 — 값·능력치가 게임 전체에서 바뀐다(2026-10-24 스위트).
  const bdb = before.database as unknown as Record<string, unknown>, adb = after.database as unknown as Record<string, unknown>;
  if (!artAsk) for (const section of ["items", "weapons", "armors", "enemies", "skills", "classes", "actors"]) {
    const old = new Map(((bdb[section] as Obj[] | undefined) ?? []).map((r) => [String(r.id), r]));
    for (const r of (adb[section] as Obj[] | undefined) ?? []) {
      const prev = old.get(String(r.id));
      if (!prev || JSON.stringify(prev) === JSON.stringify(r)) continue;
      const name = String(r.name ?? prev.name ?? "");
      if (name && task.includes(name)) continue;
      // 주인공·동료 요청은 배우 고치기가 정상이다.
      if (section === "actors" && /주인공|동료|파티|합류|이름|직업|레벨|능력치|hero|party/iu.test(task)) continue;
      if (section === "classes" && /직업|레벨|스킬|기술|배우|class|skill|level/iu.test(task)) continue;
      // 요청이 그 종류를 가리키면(이름을 안 불러도) 고치기가 정상이다 — 「보스는 얼음에 약하게」·「난이도를 맞춰」에서 보스 적을 고친 것을
      // 부작용이라 해서 조수가 되돌렸고, 힌트 NPC 가 거짓말을 하게 됐다(2026-10-25 조수 단독 게임 G6).
      if (section === "enemies" && /보스|적|몬스터|약점|약하|약해|내성|강하게|속성|난이도|어렵|쉽|밸런스|이기|체력|공격력|boss|enemy|weak/iu.test(task)) continue;
      if (section === "skills" && /기술|스킬|마법|위력|MP|마나|공격|회복|skill|spell/iu.test(task)) continue;
      if ((section === "items" || section === "weapons" || section === "armors") && /가격|값|상점|가게|아이템|장비|무기|방어구|갑옷|회복약|포션|price|item|weapon|armor/iu.test(task)) continue;
      const keys = Object.keys({ ...prev, ...r }).filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(r[k]) && !isStageWrite(writes, section, r, k));
      if (!keys.length) continue;
      out.push(`[게임 검사 부작용] 요청에 없는 기존 ${section} 「${name || String(r.id)}」 를 바꿨다(${keys.slice(0, 4).join(",")}) — 게임 전체 값이 바뀐다. 요청과 상관없는 변경이면 되돌리고, 요청을 이루려고 바꾼 것이면 그대로 두고 보고에 무엇을 왜 바꿨는지 적는다(요청을 이룬 변경을 되돌리지 않는다).`);
    }
  }
  return out.slice(0, 6);
}
