// 저장 칸 요약(몬스터 수집 게임 전용): 불러오기·저장 화면의 한 줄 「도감 12/60 · 배지 2/8 · 파티 3」.
// 도감(monsterDexSpeciesIds)이 없는 게임은 undefined — 다른 장르의 저장 바이트와 슬롯 화면은 그대로다.
import { monsterCampaign, monsterDexSpeciesIds, monsterJournalEntry } from "@/project/monsterJournal";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export type MonsterSaveSummary = {
  readonly caught: number;
  readonly dexTotal: number;
  /** 원정 정의에 배지가 있는 게임만(없으면 0). */
  readonly badges: number;
  readonly badgeTotal: number;
  readonly party: number;
  /** 저장 당시 주인공(첫 파티원) 이름. 없으면 생략. */
  readonly trainer?: string;
};

export function monsterSaveSummary(project: Project, session: PlaySession): MonsterSaveSummary | undefined {
  const dex = monsterDexSpeciesIds(project);
  if (dex.length === 0) return undefined;
  const badges = monsterCampaign(project)?.badges ?? [];
  const leadId = session.partyActorIds?.[0];
  const trainer = leadId ? project.database.actors.find((actor) => actor.id === leadId)?.name.trim().slice(0, 12) : undefined;
  return {
    caught: dex.filter((speciesId) => monsterJournalEntry(session, speciesId).caught).length,
    dexTotal: dex.length,
    badges: badges.filter((badge) => session.switches[badge.switchId] === true).length,
    badgeTotal: badges.length,
    party: session.monsterParty?.length ?? 0,
    ...(trainer ? { trainer } : {}),
  };
}

/** 저장 파일에서 읽은 값을 정리한다. 모양이 틀리면 undefined(요약 없이 그냥 연다). */
export function readMonsterSaveSummary(value: unknown): MonsterSaveSummary | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const count = (key: string): number | undefined => {
    const entry = record[key];
    return typeof entry === "number" && Number.isFinite(entry) && entry >= 0 ? Math.floor(entry) : undefined;
  };
  const caught = count("caught"), dexTotal = count("dexTotal"), badges = count("badges"), badgeTotal = count("badgeTotal"), party = count("party");
  if (caught === undefined || dexTotal === undefined || badges === undefined || badgeTotal === undefined || party === undefined) return undefined;
  const trainer = typeof record.trainer === "string" && record.trainer.trim() ? record.trainer.trim().slice(0, 12) : undefined;
  return { caught, dexTotal, badges, badgeTotal, party, ...(trainer ? { trainer } : {}) };
}

/** 슬롯 한 줄. 배지가 없는 게임은 배지 칸을 뺀다. */
export function monsterSaveSummaryLine(summary: MonsterSaveSummary): string {
  return [
    `도감 ${summary.caught}/${summary.dexTotal}`,
    ...(summary.badgeTotal > 0 ? [`배지 ${summary.badges}/${summary.badgeTotal}`] : []),
    `파티 ${summary.party}`,
  ].join(" · ");
}
