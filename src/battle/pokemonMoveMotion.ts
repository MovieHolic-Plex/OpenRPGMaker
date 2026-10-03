import type { SkillRecord } from "@/project/types";

/**
 * 포켓몬 스킨의 기술 움직임 종류 (2026-10-02).
 *
 * 포켓몬도 기술 수백 개를 따로 연출하지 않는다 — 「움직임 종류 하나 + 이펙트 하나」의 조합이다. 이 파일은 기술 레코드에서
 * 종류를 정한다. 저자가 `SkillRecord.moveMotion` 을 적으면 그것을, 아니면 이미 있는 값(효과·계산 능력치·대상·이펙트 id)으로 판정한다.
 * 연출은 `player/battlePokemonMotion.ts` 가 종류마다 그린다.
 */
export type PokemonMoveMotion = "contact" | "projectile" | "strike" | "area" | "boost" | "status" | "heal";

export const POKEMON_MOVE_MOTIONS: readonly PokemonMoveMotion[] = ["contact", "projectile", "strike", "area", "boost", "status", "heal"];

export const POKEMON_MOVE_MOTION_LABELS: Readonly<Record<PokemonMoveMotion, string>> = {
  contact: "접촉 — 상대에게 돌진해 부딪친다",
  projectile: "발사체 — 제자리에서 쏘아 보낸다",
  strike: "현장 발생 — 상대 자리에 위·아래에서 떨어진다",
  area: "범위 — 발을 굴러 상대 전부를 친다",
  boost: "능력 올리기 — 자기·아군에 빛이 퍼진다",
  status: "상태 걸기 — 상대가 움츠러든다",
  heal: "회복 — 받는 쪽에 빛이 내려온다",
};

export function isPokemonMoveMotion(value: unknown): value is PokemonMoveMotion {
  return typeof value === "string" && (POKEMON_MOVE_MOTIONS as readonly string[]).includes(value);
}

/** 대상 자리에서 생기는 이펙트(번개·빛기둥·바위 솟음·운석). 날아가지 않는다. 물대포(water_column)는 물줄기라 발사체다. */
const STRIKE_ANIMATION = /thunder|lightning|bolt|holy_beam|judg|meteor|earth_spike|rock_spike|pillar|geyser/;
/** 물리 기술이어도 몸이 아니라 무언가를 던지는 이펙트 */
const THROWN_ANIMATION = /projectile|shot|throw|needle|knife|dagger|kunai|shuriken|volley|arrow|bomb/;

/** 기술 레코드 → 움직임 종류. 기술이 없으면(일반 공격·적 기본 공격) 접촉이다. */
export function pokemonMoveMotion(skill: Pick<SkillRecord, "effect" | "scope" | "animationId" | "moveMotion"> | undefined): PokemonMoveMotion {
  if (!skill) return "contact";
  if (isPokemonMoveMotion(skill.moveMotion)) return skill.moveMotion;
  const effect = skill.effect;
  if (effect.kind === "healing") return "heal";
  if (effect.kind !== "damage") {
    return skill.scope === "enemy" || skill.scope === "allEnemies" ? "status" : "boost";
  }
  if (skill.scope === "allEnemies") return "area";
  const animation = (skill.animationId ?? "").toLowerCase();
  if (STRIKE_ANIMATION.test(animation)) return "strike";
  if (effect.statistic === "attack") return THROWN_ANIMATION.test(animation) ? "projectile" : "contact";
  return "projectile";
}

/** 현장 발생 이펙트가 땅에서 솟는가(아니면 위에서 떨어진다). */
export function pokemonStrikeFromBelow(skill: Pick<SkillRecord, "animationId"> | undefined): boolean {
  return /earth|rock|spike|geyser|pillar/.test((skill?.animationId ?? "").toLowerCase());
}

const ELEMENT_COLORS: Readonly<Record<string, string>> = {
  fire: "#ff7a26",
  water: "#3d9dff",
  ice: "#9be8ff",
  thunder: "#ffe23d",
  earth: "#c08a4a",
  wind: "#9dffc8",
  grass: "#5fd04a",
  dark: "#8a4ad0",
  holy: "#fff3a8",
  poison: "#b456e0",
};

/** 발사체·빛의 색. 속성 → 이펙트 id 낱말 → 흰색. */
export function pokemonMoveColor(skill: Pick<SkillRecord, "elementId" | "animationId" | "effect"> | undefined): string {
  if (skill?.elementId && ELEMENT_COLORS[skill.elementId]) return ELEMENT_COLORS[skill.elementId]!;
  const animation = (skill?.animationId ?? "").toLowerCase();
  for (const [key, color] of Object.entries(ELEMENT_COLORS)) if (animation.includes(key)) return color;
  if (/shadow/.test(animation)) return ELEMENT_COLORS.dark!;
  if (/leaf/.test(animation)) return ELEMENT_COLORS.grass!;
  if (/psychic/.test(animation)) return "#ff8ad8";
  if (skill?.effect.kind === "healing") return "#8dffb0";
  return "#ffffff";
}

/**
 * 그림에서 「입·손」 자리 — 몸 위쪽에서 상대 방향으로 가장 튀어나온 칸. 발사체가 여기서 나간다.
 * `alphaAt(x,y)` 는 불투명 여부, `dir` 은 상대 쪽 화면 방향(내 몬스터 (+1,−1), 상대 (−1,+1)).
 * 위쪽 `upperShare`(기본 60%)만 본다 — 발끝이 앞으로 나와도 발에서 불이 나가면 안 된다.
 * 같은 거리면 위쪽 칸을 고른다. 몬스터 하네스(anim.json 의 emit)와 엔진이 같은 함수를 쓴다.
 */
export function spriteEmitPoint(
  width: number,
  height: number,
  alphaAt: (x: number, y: number) => boolean,
  dir: { readonly x: number; readonly y: number },
  upperShare = 0.6,
): { x: number; y: number } | null {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height && top < 0; y += 1) for (let x = 0; x < width; x += 1) if (alphaAt(x, y)) { top = y; break; }
  for (let y = height - 1; y >= 0 && bottom < 0; y -= 1) for (let x = 0; x < width; x += 1) if (alphaAt(x, y)) { bottom = y; break; }
  if (top < 0) return null;
  const limit = top + Math.max(1, Math.round((bottom - top + 1) * upperShare));
  let best: { x: number; y: number; score: number } | null = null;
  for (let y = top; y < limit; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!alphaAt(x, y)) continue;
      // 가로 방향을 주로 본다(입은 옆으로 튀어나온다). 세로는 같은 거리일 때 위를 고르는 정도로만.
      const score = x * dir.x + y * dir.y * 0.35;
      if (!best || score > best.score || (score === best.score && y < best.y)) best = { x, y, score };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}
