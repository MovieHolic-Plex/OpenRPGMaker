// project/partyBonds.ts
// 파티원 유대(2026-10-25) — 동료마다 0~max 점수를 변수에 두고, 상태 메뉴 「관계」에 함께 보인다.
//
// 호감(friendship)은 NPC 키 기준이라 파티원 유대를 담지 못한다. 유대는 이벤트가 그대로 읽고 쓸 수 있게 **보통 변수**에
// 두고(fork variable >= 3 같은 조건), `system.partyBonds` 는 「어느 변수가 누구의 유대인가」 메타데이터만 들고 있다.
// 옵트인이다 — 없으면 메뉴·저장 바이트가 그대로다. 저작은 조수 도구 configure_party_bonds(editor/tools/partyBondTools.ts).

import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";

export const DEFAULT_PARTY_BOND_MAX = 5;
export const PARTY_BOND_MAX_LIMIT = 10;

export type PartyBondMember = {
  readonly actorId: string;
  readonly variableId: string;
};

/** `system.partyBonds` — 저장 형태. max 생략 = 5. */
export type PartyBondsConfig = {
  readonly max?: number;
  readonly members: readonly PartyBondMember[];
};

export type PartyBondEntry = {
  readonly actorId: string;
  readonly variableId: string;
  readonly name: string;
  readonly value: number;
  readonly max: number;
  readonly inParty: boolean;
};

/** 저장·로드 왕복용 정규화. 쓸 멤버가 없으면 undefined(필드를 두지 않는다). */
export function normalizePartyBonds(raw: unknown): PartyBondsConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as { max?: unknown; members?: unknown };
  const seen = new Set<string>();
  const members: PartyBondMember[] = [];
  for (const row of Array.isArray(source.members) ? source.members : []) {
    if (!row || typeof row !== "object") continue;
    const actorId = typeof (row as { actorId?: unknown }).actorId === "string" ? (row as { actorId: string }).actorId.trim() : "";
    const variableId = typeof (row as { variableId?: unknown }).variableId === "string" ? (row as { variableId: string }).variableId.trim() : "";
    if (!actorId || !variableId || seen.has(actorId)) continue;
    seen.add(actorId);
    members.push({ actorId, variableId });
  }
  if (members.length === 0) return undefined;
  const max = typeof source.max === "number" && Number.isFinite(source.max) ? Math.trunc(source.max) : undefined;
  return {
    ...(max !== undefined && max !== DEFAULT_PARTY_BOND_MAX ? { max: Math.max(1, Math.min(PARTY_BOND_MAX_LIMIT, max)) } : {}),
    members,
  };
}

export function partyBondMax(config: PartyBondsConfig | undefined): number {
  return config?.max ?? DEFAULT_PARTY_BOND_MAX;
}

export function hasPartyBonds(project: Project): boolean {
  return normalizePartyBonds(project.system?.partyBonds) !== undefined;
}

/** 메뉴에 보일 유대 줄 — 정의 순서대로. 이름은 세션의 바뀐 이름을 따른다. */
export function listPartyBondEntries(project: Project, session: PlaySession): PartyBondEntry[] {
  const config = normalizePartyBonds(project.system?.partyBonds);
  if (!config) return [];
  const max = partyBondMax(config);
  const party = new Set(session.partyActorIds ?? []);
  return config.members.flatMap((member): PartyBondEntry[] => {
    const actor = project.database.actors.find((record) => record.id === member.actorId);
    if (!actor) return [];
    const raw = session.variables?.[member.variableId] ?? 0;
    const value = Math.max(0, Math.min(max, Math.trunc(Number.isFinite(raw) ? raw : 0)));
    return [{ actorId: actor.id, variableId: member.variableId, name: session.actorNames?.[actor.id] ?? actor.name, value, max, inParty: party.has(actor.id) }];
  });
}

/** 「♥♥♥♡♡」 — 점수를 칸으로. */
export function partyBondMeter(value: number, max: number): string {
  const filled = Math.max(0, Math.min(max, value));
  return "♥".repeat(filled) + "♡".repeat(Math.max(0, max - filled));
}
