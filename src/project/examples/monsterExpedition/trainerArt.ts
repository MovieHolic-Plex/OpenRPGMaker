import type { Project } from "@/project/types";
import { EXPEDITION_GYMS } from "./worldPlan";

// 트레이너 전투의 인물 그림(TroopRecord.trainerSprite)을 역할별로 채운다.
// 시각 QA 1판(D03, 2026-10-16): 캠페인 troop 67개가 전부 trainerSprite 없이 만들어져 트레이너 전투에 상대·주인공 인물 그림과 슬라이드 인 연출이 0이었다.
// 값은 번들 인물 그림 role id(public/assets/battle-trainers/<role>/{front,back}.png, OPRN 자작 · 닌텐도 원작 아님)다. 런타임은 업로드 그림 id 가 없으면 번들 role 로 읽는다.
// 번들에 없는 역할(불 관장 등)은 「가장 가까운 번들 초상」으로 채우고 STAND_IN 에 적어 둔다 — 전용 그림이 생기면 이 표만 바꾼다.

/** 번들 인물 그림 role id(앞모습). index.json 과 같아야 한다. */
export type TrainerArt = "boy" | "girl" | "fisher" | "hiker" | "bug_catcher" | "gym_rock" | "gym_water" | "scientist" | "punk" | "elder" | "hero_f_front";

/** 주인공 뒷모습. 주인공 걷기 칩이 소년(Scarloxy People1 0번)이라 남자 뒷모습을 쓴다. */
export const TRAINER_HERO_BACK = "hero_m";

/** 길 트레이너 셋(산책하는 소년 · 연구원 · 길을 걷는 조련사) — 그 길의 풍경에 맞는 직업. */
const ROUTE_ART: Readonly<Record<string, readonly [TrainerArt, TrainerArt, TrainerArt]>> = {
  meadow: ["boy", "scientist", "girl"],
  forest: ["bug_catcher", "scientist", "girl"],
  river: ["fisher", "scientist", "boy"],
  mountain: ["hiker", "scientist", "punk"],
  desert: ["hiker", "scientist", "punk"],
  snow: ["girl", "scientist", "hiker"],
  marsh: ["fisher", "scientist", "bug_catcher"],
  ruins: ["elder", "scientist", "hiker"],
};
const ROUTE_FALLBACK: readonly [TrainerArt, TrainerArt, TrainerArt] = ["boy", "scientist", "girl"];

/** 관장·사천왕의 타입 → 그림. 번들 관장 그림은 물·바위뿐이다(STAND_IN 표시). */
const TYPE_LEADER: Readonly<Record<string, TrainerArt>> = {
  water: "gym_water", rock: "gym_rock", ground: "gym_rock", fighting: "gym_rock",
  grass: "bug_catcher", bug: "bug_catcher", fire: "punk", electric: "scientist", poison: "punk",
  ice: "girl", psychic: "scientist", ghost: "elder", dragon: "hiker", flying: "hiker", normal: "boy",
};
/** 같은 판 체육관 단원 넷의 직업(타입별). 관장과 같은 얼굴이 줄 서지 않게 관장 그림은 뺀다. */
const TYPE_GRUNTS: Readonly<Record<string, readonly TrainerArt[]>> = {
  water: ["fisher", "girl", "boy", "fisher"],
  rock: ["hiker", "boy", "punk", "hiker"], ground: ["hiker", "boy", "punk", "hiker"], fighting: ["hiker", "boy", "punk", "hiker"],
  grass: ["bug_catcher", "girl", "boy", "bug_catcher"], bug: ["bug_catcher", "girl", "boy", "bug_catcher"],
  fire: ["punk", "boy", "punk", "girl"], electric: ["scientist", "punk", "boy", "scientist"],
  ice: ["girl", "boy", "hiker", "girl"], psychic: ["girl", "boy", "punk", "girl"], ghost: ["girl", "punk", "boy", "girl"],
  dragon: ["punk", "hiker", "boy", "girl"],
};
const GRUNT_FALLBACK: readonly TrainerArt[] = ["boy", "punk", "girl", "hiker"];
const ELITE_CYCLE: readonly TrainerArt[] = ["elder", "punk", "scientist", "girl"];
const GENERIC_CYCLE: readonly TrainerArt[] = ["boy", "girl", "punk", "hiker", "fisher", "scientist"];

/** 전용 그림 없이 가까운 번들 초상으로 채운 역할(보고·검수용). 관장 8곳 중 물·바위만 전용 그림이다. */
export const STAND_IN_NOTE = "관장 전용 번들 그림은 물(gym_water)·바위(gym_rock)뿐 — 그 밖의 관장·사천왕은 가장 가까운 직업 초상(punk·bug_catcher·scientist·girl·elder·hiker)으로 채움. 챔피언·라이벌 나루는 hero_f_front.";

const RIVAL_ART: TrainerArt = "hero_f_front";

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** troop 몬스터 전원이 공유하는 타입(관장·사천왕 팀은 그 타입 종으로 뽑는다). 둘 이상이면 이 마을 체육관 본래 타입을 먼저, 아니면 첫 몬스터의 첫 타입. */
function groupType(project: Project, troop: { id: string; enemyIds: readonly string[] }): string | undefined {
  const typeSets = troop.enemyIds.map((id) => {
    const enemy = project.database.enemies.find((e) => e.id === id);
    return project.database.monsterSpecies?.find((s) => s.id === enemy?.speciesId)?.types ?? [];
  }).filter((types) => types.length);
  if (!typeSets.length) return undefined;
  const shared = typeSets[0]!.filter((type) => typeSets.every((types) => types.includes(type)));
  if (shared.length <= 1) return shared[0] ?? typeSets[0]![0];
  const town = /^mx_troop_mx_map_([a-z0-9]+)_gym_leader$/u.exec(troop.id)?.[1];
  const native = EXPEDITION_GYMS.find((g) => g.town === town)?.type;
  return native && shared.includes(native) ? native : shared[0];
}

export interface TrainerArtAssignment { readonly troopId: string; readonly role: string; readonly front: string }

/**
 * 트레이너 전투 troop 마다 trainerSprite 를 채운다(이미 있는 것은 두지 않는다). 역할은 troop id 꼬리표(trainer_N·grunt_N·leader·rival·company_N·boss·league_challenge)와
 * 이름으로 읽는다 — 대회·사냥터 게임처럼 꼬리표가 다른 troop 도 이름으로 가장 가까운 역할을 잡고, 그래도 모르면 id 해시로 직업을 고른다.
 */
export function assignTrainerSprites(project: Project): TrainerArtAssignment[] {
  const out: TrainerArtAssignment[] = [];
  const gruntTypeByMap = new Map<string, string | undefined>();
  const troops = project.database.troops;
  // 체육관 단원이 따라갈 타입: 같은 체육관 맵 관장 troop 의 앞 몬스터 타입.
  for (const troop of troops) {
    const leader = /^mx_troop_(.+)_(?:gym_)?leader$/u.exec(troop.id);
    if (leader && troop.trainerBattle) gruntTypeByMap.set(leader[1]!, groupType(project, troop));
  }
  const elite = troops.filter((t) => t.trainerBattle && /league_challenge$/u.test(t.id));
  for (const troop of troops) {
    if (!troop.trainerBattle || troop.trainerSprite?.front) continue;
    let role = "generic";
    let art: TrainerArt | undefined;
    const id = troop.id;
    let m: RegExpExecArray | null;
    if ((m = /^mx_troop_mx_map_([a-z0-9]+)_trainer_(\d)$/u.exec(id))) {
      role = "route_trainer";
      const set = ROUTE_ART[m[1]!] ?? ROUTE_FALLBACK;
      art = set[Math.min(2, Number(m[2]))]!;
    } else if ((m = /^mx_troop_(.+)_grunt_(\d)$/u.exec(id))) {
      role = "gym_grunt";
      const type = gruntTypeByMap.get(m[1]!);
      const pool = (type && TYPE_GRUNTS[type]) || GRUNT_FALLBACK;
      art = pool[Number(m[2]) % pool.length]!;
    } else if (/_(?:gym_)?leader$/u.test(id)) {
      role = "gym_leader";
      const type = groupType(project, troop);
      art = (type && TYPE_LEADER[type]) || "punk";
    } else if (/_rival$/u.test(id)) {
      role = "rival";
      art = RIVAL_ART;
    } else if (/league_challenge$/u.test(id)) {
      const index = elite.findIndex((t) => t.id === id);
      const champion = /챔피언/u.test(troop.name) || index === elite.length - 1;
      role = champion ? "champion" : "elite_four";
      if (champion) art = RIVAL_ART;
      else {
        const type = groupType(project, troop);
        // 사천왕은 서로 다른 얼굴이 서야 한다 — 타입 그림이 앞 사천왕과 겹치면 순환표로 넘어간다.
        const used = new Set(out.filter((o) => o.role === "elite_four").map((o) => o.front));
        const byType = type ? TYPE_LEADER[type] : undefined;
        art = byType && !used.has(byType) ? byType : ELITE_CYCLE.find((a) => !used.has(a)) ?? ELITE_CYCLE[index % ELITE_CYCLE.length]!;
      }
    } else if (/_company_\d$/u.test(id) || /연구원/u.test(troop.name)) {
      role = "company_agent";
      art = "scientist";
    } else if (/_boss$/u.test(id)) {
      role = "company_boss";
      art = /대표/u.test(troop.name) ? "elder" : "punk";
    } else if (/챔피언|나루/u.test(troop.name)) {
      role = "champion";
      art = RIVAL_ART;
    } else if (/관장|보스/u.test(troop.name)) {
      role = "gym_leader";
      art = TYPE_LEADER[groupType(project, troop) ?? ""] ?? "punk";
    } else if (/사천왕/u.test(troop.name)) {
      role = "elite_four";
      art = ELITE_CYCLE[hash(id) % ELITE_CYCLE.length]!;
    }
    art ??= GENERIC_CYCLE[hash(id) % GENERIC_CYCLE.length]!;
    troop.trainerSprite = { front: art, back: TRAINER_HERO_BACK };
    out.push({ troopId: id, role, front: art });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// 이벤트 생성 시점 배정(world.ts·tournament.ts 의 battle()) — 맵 역할(관장·리그·두목)과 접미사·이름으로 번들 앞모습을 고른다.
// 위 assignTrainerSprites 는 trainerSprite 가 이미 있는 troop 을 건너뛰므로, 여기서 먼저 채운 것이 우선하고 나머지(타입 기반)가 뒤를 메운다.
// 번들 public/assets/battle-trainers/<역할>/front.png 만 쓴다(새 그림 없음). 번들에 맞는 인물이 없는 타입은 가장 가까운 직업으로 잇는다.
// ---------------------------------------------------------------------------------------------

/** 내 뒷모습(번들 hero_m·hero_f) — 캠페인 주인공 기본. */
export const EXPEDITION_HERO_BACK = "hero_m";

/** 체육관 열쇠(gyms/gym_<키>) → 관장 전투 그림. */
const GYM_LEADER_ART: Readonly<Record<string, string>> = {
  water: "gym_water", dojo: "gym_rock", grass: "girl", fire: "punk", psychic: "scientist", ice: "elder", ghost: "punk", dragon: "hiker",
};
/** 타입 → 리그 사천왕·전문가 그림(체육관 열쇠가 아닌 타입 이름으로 고른 경우). */
const TYPE_ART: Readonly<Record<string, string>> = {
  water: "gym_water", ice: "gym_water", rock: "gym_rock", ground: "gym_rock", fighting: "gym_rock", steel: "gym_rock", normal: "gym_rock",
  grass: "girl", bug: "bug_catcher", fire: "punk", dark: "punk", poison: "punk", ghost: "punk",
  psychic: "scientist", electric: "scientist", fairy: "girl", dragon: "hiker", flying: "hiker",
};
const GRUNT_ART = ["boy", "girl", "hiker", "bug_catcher"] as const;
const ROUTE_NAME_ART: readonly (readonly [RegExp, string])[] = [[/소년/u, "boy"], [/소녀|아가씨/u, "girl"], [/연구/u, "scientist"], [/낚시/u, "fisher"], [/등산|조련사/u, "hiker"]];

/**
 * 이름·직업 말만으로 번들 앞모습 역할을 고른다(조수가 place_trainer 로 놓은 트레이너의 기본 배정). 근거가 없으면 undefined — 지어내지 않는다.
 * 번들 역할: boy·girl·fisher·hiker·bug_catcher·gym_rock·gym_water·scientist·punk·elder.
 */
export function inferTrainerRoleFromName(name: string): string | undefined {
  const keyword: readonly (readonly [RegExp, string])[] = [
    [/물 도장|물 관장|water gym/iu, "gym_water"], [/바위 도장|바위 관장|rock gym/iu, "gym_rock"], [/낚시|fisher/iu, "fisher"], [/등산|hiker/iu, "hiker"],
    [/곤충|채집|bug catcher/iu, "bug_catcher"], [/연구|박사|scientist/iu, "scientist"], [/불량|펑크|punk/iu, "punk"], [/노인|할아버지|할머니|elder/iu, "elder"],
    [/소녀|아가씨|girl/iu, "girl"], [/소년|boy/iu, "boy"],
  ];
  return keyword.find(([pattern]) => pattern.test(name))?.[1];
}

export const gymLeaderArt = (gymKey: string): string => GYM_LEADER_ART[gymKey] ?? "gym_rock";
export const typeArt = (type: string | undefined): string => (type && TYPE_ART[type]) || "elder";

/**
 * 트레이너 이벤트 접미사·이름·맵 역할로 앞모습 역할을 고른다. 모르면 undefined(그림 없이 — 전투는 소개 없이 시작).
 * @param mapArt 체육관·리그 맵에서 미리 정해 둔 관장 그림(맵 id → 역할)
 */
export function expeditionTrainerFront(suffix: string, name: string, mapArt?: string): string | undefined {
  if (suffix === "leader" || suffix === "league_challenge") return mapArt;
  const grunt = /^grunt_(\d+)$/u.exec(suffix);
  if (grunt) return GRUNT_ART[Number(grunt[1]) % GRUNT_ART.length];
  if (/^company_/u.test(suffix)) return "scientist";
  if (suffix === "boss") return mapArt ?? "punk";
  if (suffix === "rival" || suffix === "rival_start") return "hero_f_front";
  if (/^sparring_/u.test(suffix) || /^trainer_/u.test(suffix) || suffix === "round") return ROUTE_NAME_ART.find(([pattern]) => pattern.test(name))?.[1] ?? GRUNT_ART[(name.length + suffix.length) % 2];
  return mapArt;
}
