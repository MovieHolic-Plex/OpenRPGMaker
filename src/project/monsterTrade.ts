// 몬스터 놓아주기·NPC 교환·합성 — 이벤트 명령 removeMonster/tradeMonster/fuseMonsters 의 규칙.
//
// 개체 저장소는 monsterCollection.ts 가 소유한다(giveMonster 로만 새 개체를 만든다). 이 파일은 그 위에서
// 개체를 지우고/바꾸는 규칙만 둔다. 파티가 마지막 한 마리일 때 놓아주기·재료가 되는 것은 막는다 —
// 몬스터 파티 전투에서 파티가 비면 전투를 열 수 없다(playSceneBattle 의 BATTLE_MONSTER_PARTY_EMPTY).
import { ensureMonsterSessionFields, giveMonster, monsterSpeciesById } from "@/project/monsterCollection";
import { recordMonsterCaught } from "@/project/monsterJournal";
import { syncMonsterPartyFollowers } from "@/project/followers";
import type { MonsterInstance, PlaySession } from "@/project/session";
import type { MonsterFusionRecord, MonsterSpeciesId, Project } from "@/project/types";

export const MONSTER_FUSION_LIMIT = 200;

export type RemoveMonsterResult =
  | { readonly ok: true; readonly instanceId: string }
  | { readonly ok: false; readonly reason: "missingInstance" | "lastPartyMonster" };

export type TradeMonsterResult =
  | { readonly ok: true; readonly givenInstanceId: string; readonly received: MonsterInstance }
  | { readonly ok: false; readonly reason: "missingSpecies" | "noOffer" };

export type FuseMonstersResult =
  | { readonly ok: true; readonly result: MonsterInstance; readonly resultSpeciesId: MonsterSpeciesId }
  | { readonly ok: false; readonly reason: "missingInstance" | "sameInstance" | "noRecipe" | "missingSpecies" };

export function normalizeMonsterFusions(value: readonly Partial<MonsterFusionRecord>[] | undefined): MonsterFusionRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows: MonsterFusionRecord[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (rows.length >= MONSTER_FUSION_LIMIT) break;
    const speciesA = clean(raw?.speciesA);
    const speciesB = clean(raw?.speciesB);
    const resultSpeciesId = clean(raw?.resultSpeciesId);
    if (!speciesA || !speciesB || !resultSpeciesId) continue;
    const key = fusionKey(speciesA, speciesB);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ speciesA, speciesB, resultSpeciesId });
  }
  return rows.length > 0 ? rows : undefined;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fusionKey(a: string, b: string): string {
  return a <= b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/** 두 종의 합성 결과 종(순서 무관). 표에 없으면 undefined. */
export function fusionResultSpeciesId(project: Project, speciesA: MonsterSpeciesId, speciesB: MonsterSpeciesId): MonsterSpeciesId | undefined {
  const key = fusionKey(speciesA, speciesB);
  return (project.system.monsterFusions ?? []).find((row) => fusionKey(row.speciesA, row.speciesB) === key)?.resultSpeciesId;
}

/** 개체를 파티·보관함·개체표에서 지운다. 확인 없이 지우는 내부 도구다. */
function deleteMonsterInstance(project: Project, session: PlaySession, instanceId: string): void {
  const speciesId = session.monsterInstances[instanceId]?.speciesId;
  if (speciesId) recordMonsterCaught(project, session, speciesId);
  const match = /^monster_(\d+)$/.exec(instanceId);
  if (match) session.retiredMonsterInstanceSeq = Math.max(session.retiredMonsterInstanceSeq ?? 0, Number(match[1]));
  session.monsterParty = session.monsterParty.filter((id) => id !== instanceId);
  session.monsterBox = session.monsterBox.filter((id) => id !== instanceId);
  const next = { ...session.monsterInstances };
  delete next[instanceId];
  session.monsterInstances = next;
}

/** 이 개체들을 빼면 파티에 한 마리도 안 남는가(원래 파티가 비어 있었다면 막지 않는다). */
function wouldEmptyParty(session: PlaySession, instanceIds: readonly string[]): boolean {
  if (session.monsterParty.length === 0) return false;
  return session.monsterParty.every((id) => instanceIds.includes(id));
}

/** 놓아주기. instanceId 가 비면 보관함 첫 개체(없으면 실패). 파티 마지막 한 마리는 놓아줄 수 없다. */
export function removeMonster(project: Project, session: PlaySession, instanceId: string): RemoveMonsterResult {
  ensureMonsterSessionFields(session);
  const id = instanceId.trim() || session.monsterBox[0] || "";
  if (!id || !session.monsterInstances[id]) return { ok: false, reason: "missingInstance" };
  if (wouldEmptyParty(session, [id])) return { ok: false, reason: "lastPartyMonster" };
  deleteMonsterInstance(project, session, id);
  syncMonsterPartyFollowers(project, session);
  return { ok: true, instanceId: id };
}

/**
 * NPC 교환: fromSpeciesId 종 개체 하나(보관함 먼저, 그다음 파티 뒤쪽)를 내주고 toSpeciesId 종을 받는다.
 * 받는 개체는 내준 개체의 레벨(level 을 주면 그 레벨)로 태어나고, 내준 자리가 파티였으면 파티로 간다.
 */
export function tradeMonster(
  project: Project,
  session: PlaySession,
  input: { readonly fromSpeciesId: MonsterSpeciesId; readonly toSpeciesId: MonsterSpeciesId; readonly level?: number; readonly nickname?: string },
): TradeMonsterResult {
  ensureMonsterSessionFields(session);
  if (!monsterSpeciesById(project, input.toSpeciesId)) return { ok: false, reason: "missingSpecies" };
  const ofSpecies = (id: string) => session.monsterInstances[id]?.speciesId === input.fromSpeciesId;
  const offered = session.monsterBox.find(ofSpecies) ?? [...session.monsterParty].reverse().find(ofSpecies);
  if (!offered) return { ok: false, reason: "noOffer" };
  const given = session.monsterInstances[offered]!;
  const partyIndex = session.monsterParty.indexOf(offered);
  deleteMonsterInstance(project, session, offered);
  const received = giveMonster(project, session, {
    speciesId: input.toSpeciesId,
    level: input.level ?? given.level,
    ...(input.nickname?.trim() ? { nickname: input.nickname.trim() } : {}),
  });
  if (!received.ok) return { ok: false, reason: "missingSpecies" };
  // 파티에서 내준 개체였으면 같은 자리에 받는다(giveMonster 는 빈 칸이 있으면 끝에 붙인다).
  if (partyIndex >= 0 && received.location === "party") {
    const id = received.instance.instanceId;
    const rest = session.monsterParty.filter((entry) => entry !== id);
    rest.splice(Math.min(partyIndex, rest.length), 0, id);
    session.monsterParty = rest;
    syncMonsterPartyFollowers(project, session);
  }
  return { ok: true, givenInstanceId: offered, received: received.instance };
}

/**
 * 합성: 두 개체의 종 쌍을 system.monsterFusions 에서 찾아 결과 종 한 마리를 만든다. 두 재료는 사라진다.
 * 결과 레벨은 두 재료의 평균(내림, 최소 1). 두 재료가 파티의 전부였어도 결과가 파티로 들어가므로 막지 않는다.
 */
export function fuseMonsters(project: Project, session: PlaySession, instanceIdA: string, instanceIdB: string): FuseMonstersResult {
  ensureMonsterSessionFields(session);
  const a = session.monsterInstances[instanceIdA];
  const b = session.monsterInstances[instanceIdB];
  if (!a || !b) return { ok: false, reason: "missingInstance" };
  if (instanceIdA === instanceIdB) return { ok: false, reason: "sameInstance" };
  const resultSpeciesId = fusionResultSpeciesId(project, a.speciesId, b.speciesId);
  if (!resultSpeciesId) return { ok: false, reason: "noRecipe" };
  if (!monsterSpeciesById(project, resultSpeciesId)) return { ok: false, reason: "missingSpecies" };
  const level = Math.max(1, Math.floor((a.level + b.level) / 2));
  const firstPartyIndex = Math.min(
    ...[instanceIdA, instanceIdB].map((id) => session.monsterParty.indexOf(id)).filter((index) => index >= 0),
  );
  deleteMonsterInstance(project, session, instanceIdA);
  deleteMonsterInstance(project, session, instanceIdB);
  const created = giveMonster(project, session, { speciesId: resultSpeciesId, level });
  if (!created.ok) return { ok: false, reason: "missingSpecies" };
  if (Number.isFinite(firstPartyIndex) && created.location === "party") {
    const id = created.instance.instanceId;
    const rest = session.monsterParty.filter((entry) => entry !== id);
    rest.splice(Math.min(firstPartyIndex, rest.length), 0, id);
    session.monsterParty = rest;
  }
  syncMonsterPartyFollowers(project, session);
  return { ok: true, result: created.instance, resultSpeciesId };
}
