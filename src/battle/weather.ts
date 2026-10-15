// 포켓몬식 전투 날씨. 기술(SkillRecord.weather)이 켜고, 몇 차례 동안 같은 타입 기술의 피해를 키우거나 줄이고,
// 모래바람·싸라기눈은 차례 말에 해당 타입이 아닌 배틀러에게 피해를 준다. 전투 한 번 동안만 유지되고 저장하지 않는다.
// 지금은 gen1 전투 모델(몬스터 수집)에서만 적용한다. 타입 이름은 기술·종의 타입 id 를 gen1CanonicalTypeForId 로 읽은 표준 이름이다.
import { withJosa } from "@/util/josa";
import type { Gen1CanonicalType } from "@/battle/typeChart";
import type { SkillWeather, SkillWeatherKind } from "@/project/types";

export const SKILL_WEATHER_KINDS: readonly SkillWeatherKind[] = ["sun", "rain", "sandstorm", "hail"];
export const SKILL_WEATHER_MIN_TURNS = 3;
export const SKILL_WEATHER_MAX_TURNS = 8;
export const SKILL_WEATHER_DEFAULT_TURNS = 5;
/** 모래바람·싸라기눈의 차례 말 피해 = 최대 HP 의 1/16(최소 1). */
export const WEATHER_RESIDUAL_DIVISOR = 16;

export interface BattleWeatherState {
  readonly kind: SkillWeatherKind;
  /** 남은 차례 수(차례 말마다 하나 줄고 0 이면 끝난다). */
  readonly turnsLeft: number;
}

export const WEATHER_LABELS: Readonly<Record<SkillWeatherKind, string>> = { sun: "쾌청", rain: "비", sandstorm: "모래바람", hail: "싸라기눈" };
/** 화면 배지 글리프(텍스트·유니코드, 새 그림 없음). */
export const WEATHER_GLYPHS: Readonly<Record<SkillWeatherKind, string>> = { sun: "☀", rain: "☂", sandstorm: "≋", hail: "❄" };

export const WEATHER_START_LINES: Readonly<Record<SkillWeatherKind, string>> = {
  sun: "햇살이 강해졌다!", rain: "비가 내리기 시작했다!", sandstorm: "모래바람이 불기 시작했다!", hail: "싸라기눈이 내리기 시작했다!",
};
export const WEATHER_CONTINUE_LINES: Readonly<Record<SkillWeatherKind, string>> = {
  sun: "햇살이 강하다.", rain: "비가 계속 내리고 있다.", sandstorm: "모래바람이 휘몰아치고 있다.", hail: "싸라기눈이 계속 내리고 있다.",
};
export const WEATHER_END_LINES: Readonly<Record<SkillWeatherKind, string>> = {
  sun: "햇살이 약해졌다.", rain: "비가 그쳤다.", sandstorm: "모래바람이 잦아들었다.", hail: "싸라기눈이 그쳤다.",
};

/** 이 날씨가 차례 말 피해를 안 주는 타입. */
const RESIDUAL_IMMUNE_TYPES: Readonly<Partial<Record<SkillWeatherKind, readonly Gen1CanonicalType[]>>> = {
  sandstorm: ["rock", "ground", "steel"],
  hail: ["ice"],
};

/** 날씨가 이 타입 기술의 피해에 곱하는 % — 쾌청: 불 150·물 50, 비: 물 150·불 50, 나머지 100. */
export function weatherDamagePercent(kind: SkillWeatherKind | undefined, moveType: Gen1CanonicalType | undefined): number {
  if (!kind || !moveType) return 100;
  if (kind === "sun") return moveType === "fire" ? 150 : moveType === "water" ? 50 : 100;
  if (kind === "rain") return moveType === "water" ? 150 : moveType === "fire" ? 50 : 100;
  return 100;
}

/** 차례 말 날씨 피해(없으면 0). types 는 배틀러 타입의 표준 이름들. */
export function weatherResidualDamage(kind: SkillWeatherKind | undefined, maxHp: number, types: readonly (Gen1CanonicalType | undefined)[]): number {
  const immune = kind ? RESIDUAL_IMMUNE_TYPES[kind] : undefined;
  if (!kind || !immune) return 0;
  if (types.some((type) => type && immune.includes(type))) return 0;
  return Math.max(1, Math.floor(Math.max(1, maxHp) / WEATHER_RESIDUAL_DIVISOR));
}

export function weatherResidualLine(kind: SkillWeatherKind, name: string): string {
  return kind === "sandstorm" ? `${withJosa(name, "은/는")} 모래바람에 휩싸였다!` : `${withJosa(name, "은/는")} 싸라기눈에 맞았다!`;
}

export function weatherEffectText(weather: SkillWeather): string {
  const turns = weather.turns ?? SKILL_WEATHER_DEFAULT_TURNS;
  const effect = weather.kind === "sun" ? "불 기술 ×1.5, 물 기술 ×0.5"
    : weather.kind === "rain" ? "물 기술 ×1.5, 불 기술 ×0.5"
    : weather.kind === "sandstorm" ? "차례 말마다 바위·땅·강철 이외에 최대 HP 의 1/16 피해"
    : "차례 말마다 얼음 이외에 최대 HP 의 1/16 피해";
  return `${WEATHER_LABELS[weather.kind]} ${turns}차례 — ${effect}`;
}

/** 값이 맞는 모양일 때만 돌려준다(모르는 종류는 버린다). turns 는 3~8, 기본 5 는 저장하지 않는다. */
export function normalizeSkillWeather(raw: unknown): SkillWeather | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  if (!SKILL_WEATHER_KINDS.includes(record.kind as SkillWeatherKind)) return undefined;
  const kind = record.kind as SkillWeatherKind;
  const turns = typeof record.turns === "number" && Number.isFinite(record.turns)
    ? Math.max(SKILL_WEATHER_MIN_TURNS, Math.min(SKILL_WEATHER_MAX_TURNS, Math.round(record.turns)))
    : SKILL_WEATHER_DEFAULT_TURNS;
  return turns === SKILL_WEATHER_DEFAULT_TURNS ? { kind } : { kind, turns };
}
