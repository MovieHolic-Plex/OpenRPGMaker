import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Project } from "@/project/types";

// 몬스터 캠페인 NPC 얼굴 분산(시각 QA D02, 2026-10-16).
// 저장소에 있는 몬스터 수집용 사람 걷기 칩은 Scarloxy People1 8칸 + People2 2칸뿐이다. 장르 잠금의 자동 대체(remapCharsetsToPreset)는
// 「원래 칩 → 새 칩」 한 줄이라 안내원 47명이 같은 얼굴(주인공 칩과도 같음)이었고 관원 23명이 전부 같은 칸이었다.
// 이 함수는 그 뒤에 역할별 선호 칩으로 다시 나눈다: 역할마다 다른 얼굴, 같은 맵에서 겹치지 않게(10칸 안에서 가능한 만큼), 주인공 칩(People1 0)은 NPC 에 쓰지 않는다.
// 완전한 해결은 그림(더 많은 칩)이고 이 함수는 데이터로 가능한 만큼이다.

const P1 = "tex_scarloxy_charset_people1";
const P2 = "tex_scarloxy_charset_people2";
/** 변형 직군 칩 ScarloxyPeople3 — 5번은 흰 가운 「박사」(성인 남성). 오프닝 흉상(박사)과 같은 직군으로 읽히게 하는 연구소 박사 칩(3차 적대 감사 D34). 새 그림 없음. */
const P3 = "tex_oprn_charset_scarloxy_people3";
type Chip = readonly [string, number];
const chip = (sheet: string, index: number): Chip => [sheet, index];
const key = (c: Chip): string => `${c[0]}#${c[1]}`;

/** People1: 0 모자 소년(주인공) · 1 금발 · 2 초록 벙거지 · 3 보라 머리 소녀 · 4 갈래머리 소녀 · 5 짙은 머리 소년 · 6 밀짚모자 · 7 청록 머리 보스. People2: 0 불 보스 · 1 풀 보스. */
const HERO = key(chip(P1, 0));

/** 관장·사천왕의 타입 → 어울리는 보스급 칩. */
const TYPE_BOSS: Readonly<Record<string, Chip>> = {
  grass: chip(P2, 1), bug: chip(P2, 1), fire: chip(P2, 0), dragon: chip(P2, 0), water: chip(P1, 7), ice: chip(P1, 3), psychic: chip(P1, 2),
  ghost: chip(P1, 5), fighting: chip(P1, 6), rock: chip(P1, 6), ground: chip(P1, 6), electric: chip(P1, 1), normal: chip(P1, 2), flying: chip(P1, 4), poison: chip(P1, 3),
};
const BOSS_FALLBACK: readonly Chip[] = [chip(P2, 1), chip(P2, 0), chip(P1, 7)];
const GRUNT: readonly Chip[] = [chip(P1, 5), chip(P1, 1), chip(P1, 6), chip(P1, 2), chip(P1, 4), chip(P1, 3)];
const RESIDENT: readonly Chip[] = [chip(P1, 2), chip(P1, 1), chip(P1, 4), chip(P1, 3), chip(P1, 6), chip(P1, 5)];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rotate<T>(list: readonly T[], by: number): T[] {
  const n = list.length;
  return list.map((_, i) => list[(i + by) % n]!);
}

/** 이벤트 id → 선호 칩 목록(앞쪽이 먼저). `gymType` 은 그 맵 체육관 관장 타입. */
function preference(eventId: string, gymType: string | undefined, leagueType: string | undefined): readonly Chip[] {
  let m: RegExpExecArray | null;
  if (/_leader$/u.test(eventId)) return [...(gymType && TYPE_BOSS[gymType] ? [TYPE_BOSS[gymType]!] : []), ...BOSS_FALLBACK];
  if (/_league_challenge$/u.test(eventId)) {
    if (/league_4_/u.test(eventId)) return [chip(P1, 3), chip(P1, 4)]; // 챔피언 나루 = 라이벌과 같은 사람(여자 트레이너)
    return [...(leagueType && TYPE_BOSS[leagueType] ? [TYPE_BOSS[leagueType]!] : []), ...BOSS_FALLBACK];
  }
  if (/_rival$/u.test(eventId)) return [chip(P1, 3), chip(P1, 4)];
  if (/_boss$/u.test(eventId)) return [chip(P2, 0), chip(P1, 6), chip(P1, 5)];
  if (/_company_\d$/u.test(eventId)) return [chip(P1, 5), chip(P1, 2), chip(P1, 6)];
  if ((m = /_trainer_(\d)$/u.exec(eventId))) return rotate([chip(P1, 1), chip(P1, 5), chip(P1, 3)], Number(m[1]) % 3).concat(GRUNT);
  if ((m = /_grunt_(\d)$/u.exec(eventId))) return rotate(GRUNT, Number(m[1]) + (hash(eventId.replace(/_grunt_\d$/u, "")) % GRUNT.length));
  if (/_nurse$/u.test(eventId)) return [chip(P1, 3), chip(P1, 4)];
  if (/_shop$/u.test(eventId)) return [chip(P1, 6), chip(P1, 2), chip(P1, 1)];
  if (/professor$/u.test(eventId)) return [chip(P3, 5), chip(P1, 6), chip(P1, 2)];
  if (/(?:^|_)(?:teacher|curator|captain|researcher)$/u.test(eventId)) return [chip(P1, 2), chip(P1, 6), chip(P1, 5)];
  if (/(?:^|_)(?:guide|gym_guide|return_home|trail_sign)$/u.test(eventId) || /^sign_/u.test(eventId)) return rotate([chip(P1, 6), chip(P1, 2), chip(P1, 1), chip(P1, 4)], hash(eventId) % 4);
  return rotate(RESIDENT, hash(eventId) % RESIDENT.length);
}

/**
 * 몬스터 캠페인 NPC 의 People1/People2 칩을 역할별로 다시 나눈다. 방향·걸음 모양은 그대로 두고 칩만 바꾼다.
 * 맵마다 이벤트 순서대로 선호 목록에서 그 맵에서 아직 안 쓴 칩을 고르고, 모두 쓰였으면 가장 덜 쓴 칩을 쓴다.
 * 반환값은 바꾼 이벤트 수.
 */
export function distributeNpcCharsets(project: Project): number {
  const gymTypeOf = (mapId: string): string | undefined => {
    const leader = project.database.troops.find((t) => t.id === `mx_troop_${mapId}_leader`);
    const enemy = project.database.enemies.find((e) => e.id === leader?.enemyIds[0]);
    const types = project.database.monsterSpecies?.find((s) => s.id === enemy?.speciesId)?.types;
    if (!leader || !types?.length) return undefined;
    const sets = leader.enemyIds.map((id) => project.database.monsterSpecies?.find((s) => s.id === project.database.enemies.find((e) => e.id === id)?.speciesId)?.types ?? []).filter((t) => t.length);
    return sets[0]?.find((t) => sets.every((s) => s.includes(t))) ?? types[0];
  };
  const leagueTypeOf = (eventId: string): string | undefined => {
    const troop = project.database.troops.find((t) => t.id === `mx_troop_${eventId}`);
    const sets = (troop?.enemyIds ?? []).map((id) => project.database.monsterSpecies?.find((s) => s.id === project.database.enemies.find((e) => e.id === id)?.speciesId)?.types ?? []).filter((t) => t.length);
    return sets[0]?.find((t) => sets.every((s) => s.includes(t)));
  };
  let changed = 0;
  for (const map of Object.values(project.maps)) {
    const used = new Map<string, number>();
    const gymType = gymTypeOf(map.id);
    // 보스급(관장·사천왕·라이벌·지부장)이 먼저 자기 칩을 잡는다 — 단원·주민이 관장의 어울리는 칩을 먼저 가져가지 않게.
    const bossFirst = [...map.events].sort((a, b) => Number(!/_(?:leader|league_challenge|rival|boss)$/u.test(a.id)) - Number(!/_(?:leader|league_challenge|rival|boss)$/u.test(b.id)));
    for (const event of bossFirst) {
      const pages = (event.pages ?? []).filter((page) => {
        const id = page.graphic?.sprite?.id;
        return id === P1 || id === P2 || (typeof id === "string" && id.startsWith("tex_oprn_charset_scarloxy_people"));
      });
      if (!pages.length || pages[0]!.graphic!.transparent) continue;
      const wanted = preference(event.id, gymType, leagueTypeOf(event.id));
      const candidates = [...wanted, ...RESIDENT, ...GRUNT, ...BOSS_FALLBACK].filter((c) => key(c) !== HERO);
      const free = candidates.find((c) => !used.has(key(c)));
      const pick = free ?? candidates.reduce((best, c) => ((used.get(key(c)) ?? 0) < (used.get(key(best)) ?? 0) ? c : best), candidates[0]!);
      used.set(key(pick), (used.get(key(pick)) ?? 0) + 1);
      for (const page of pages) {
        const graphic = page.graphic!;
        const decoded = decodeCharsetFrameIndex(typeof graphic.pattern === "number" ? graphic.pattern : 0);
        page.graphic = { ...graphic, sprite: { type: "bundled", id: pick[0] }, pattern: charsetFrameIndex({ characterIndex: pick[1], direction: decoded.direction, pattern: decoded.pattern }) };
      }
      changed += 1;
    }
  }
  return changed;
}
