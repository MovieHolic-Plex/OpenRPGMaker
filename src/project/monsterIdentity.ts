// 몬스터 개체의 정체성: 별명 · 성별 · 색이 다른 개체(이로치). 모두 선택 필드라 옛 저장·다른 장르는 그대로다.
//   - 성별: 종의 genderRatio(암컷 비율 0~1)가 있을 때만. 없으면 무성(표시 없음 — 기존 동작).
//   - 색이 다른 개체: system.shinyRate(= 1/N, N≥2)가 있을 때만. 없으면 나오지 않는다.
//   - 둘 다 개체를 받는 순간 (게임 시드 + 개체 번호 + 종)으로 정해지는 결정적 값이다 — 같은 저장은 같은 결과(IV 와 같은 방식).
import type { MonsterInstance, PlaySession } from "@/project/session";
import type { MonsterSpeciesRecord, Project } from "@/project/types";

export type MonsterGender = "male" | "female";
export const MONSTER_NICKNAME_MAX = 8;
export const MONSTER_SHINY_RATE_MIN = 2;
export const MONSTER_SHINY_RATE_MAX = 65536;

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return h >>> 0;
}

export function normalizeGenderRatio(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? Math.round(value * 1000) / 1000 : undefined;
}

export function normalizeShinyRate(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rate = Math.trunc(value);
  return rate >= MONSTER_SHINY_RATE_MIN && rate <= MONSTER_SHINY_RATE_MAX ? rate : undefined;
}

export type MonsterIdentityRoll = { readonly gender?: MonsterGender; readonly shiny?: true };

export function rollMonsterIdentity(project: Pick<Project, "system">, species: Pick<MonsterSpeciesRecord, "id" | "genderRatio">, seedKey: string): MonsterIdentityRoll {
  const ratio = normalizeGenderRatio(species.genderRatio);
  const rate = normalizeShinyRate(project.system.shinyRate);
  const gender: MonsterGender | undefined = ratio === undefined ? undefined : hash32(`gender:${seedKey}`) / 4294967296 < ratio ? "female" : "male";
  const shiny = rate !== undefined && hash32(`shiny:${seedKey}`) % rate === 0;
  return { ...(gender ? { gender } : {}), ...(shiny ? { shiny: true as const } : {}) };
}

export const monsterGenderMark = (instance: Pick<MonsterInstance, "gender"> | undefined): string => (instance?.gender === "female" ? "♀" : instance?.gender === "male" ? "♂" : "");
export const monsterGenderLabel = (instance: Pick<MonsterInstance, "gender"> | undefined): string => (instance?.gender === "female" ? "암컷" : instance?.gender === "male" ? "수컷" : "");

export type RenameMonsterResult =
  | { readonly ok: true; readonly nickname: string | undefined }
  | { readonly ok: false; readonly reason: "missingInstance" };

/** 별명 바꾸기. 빈 글자·공백만이면 별명을 지워 종 이름으로 돌아간다. 최대 8글자(앞뒤 공백 제거). */
export function renameMonster(session: PlaySession, instanceId: string, rawName: string): RenameMonsterResult {
  const instance = session.monsterInstances?.[instanceId];
  if (!instance) return { ok: false, reason: "missingInstance" };
  const cleaned = rawName.replace(/\s+/gu, " ").trim().slice(0, MONSTER_NICKNAME_MAX).trim();
  const { nickname: _previous, ...rest } = instance;
  session.monsterInstances = { ...session.monsterInstances, [instanceId]: cleaned ? { ...rest, nickname: cleaned } : rest };
  return { ok: true, nickname: cleaned || undefined };
}
