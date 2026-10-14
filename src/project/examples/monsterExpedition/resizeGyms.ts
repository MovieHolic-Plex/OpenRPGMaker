// 이미 지어진 몬스터 캠페인의 체육관(=배지) 수를 줄인다 — 「배지 8개를 5개로 줄여 줘」.
//
// 정의(system.monsterCampaign)의 배지 배열만 줄이면 관장 이벤트가 그대로 남아 거짓말이 된다(2026-10-14 감사: 정의 5개·관장 8명).
// 그래서 정의·이벤트·진행 잠금·서사를 한 번에 맞춘다. 순수 함수 — 프로젝트를 제자리에서 고친다(도구가 복제본에 부른다).
import type { Project } from "@/project/types";
import { LEGACY_CAMPAIGN_PLAN, retellForGymCount } from "./campaignPlan";

export interface ResizeGymsResult {
  readonly before: number;
  readonly after: number;
  readonly removedBadges: readonly string[];
  readonly retiredLeaderEvents: readonly string[];
  readonly rewiredConditions: number;
  readonly retoldStrings: number;
}

type Raw = Record<string, unknown>;

function walkObjects(value: unknown, fn: (record: Raw) => void): void {
  if (Array.isArray(value)) { for (const v of value) walkObjects(v, fn); return; }
  if (!value || typeof value !== "object") return;
  const record = value as Raw;
  fn(record);
  for (const v of Object.values(record)) walkObjects(v, fn);
}

const setsSwitch = (commands: unknown, ids: ReadonlySet<string>): boolean => {
  let found = false;
  walkObjects(commands, r => { if (r.kind === "setSwitch" && typeof r.switchId === "string" && ids.has(r.switchId) && r.value !== false) found = true; });
  return found;
};

export function resizeCampaignGyms(project: Project, countInput: number): ResizeGymsResult {
  const campaign = project.system.monsterCampaign;
  if (!campaign) throw new Error("몬스터 캠페인 정의가 없습니다.");
  const count = Math.round(countInput);
  const before = campaign.badges.length;
  if (!Number.isFinite(count) || count < 0) throw new Error("체육관 수는 0 이상의 정수여야 합니다.");
  if (count > before) throw new Error(`체육관은 이 도구로 늘릴 수 없습니다(현재 ${before}개). 새 체육관은 마을·체육관 맵을 직접 더한 뒤 configure_monster_campaign 으로 배지를 등록하세요.`);
  const removed = campaign.badges.slice(count);
  const removedSwitches = new Set(removed.map(b => b.switchId));
  // 앞선 약속(마지막으로 남는 배지, 0이면 스타터)으로 잠금을 옮긴다.
  const fallback = count > 0 ? campaign.badges[count - 1]!.switchId : (campaign.objectives[0]?.switchId ?? "mx_starter");
  const retired: string[] = [];
  let rewired = 0;
  if (removed.length) {
    // 1) 그 배지를 주는 관장 이벤트 — 대전·배지 지급을 지우고 체육관은 그대로 열어 둔다(건물·퍼즐은 남는다).
    for (const map of Object.values(project.maps)) for (const event of map.events) {
      if (!setsSwitch(event.pages ?? event.commands, removedSwitches)) continue;
      const hasBattle = (() => { let found = false; walkObjects(event.pages ?? event.commands, r => { if (r.kind === "battleProcessing") found = true; }); return found; })();
      if (!hasBattle) continue;
      const retire = (): unknown[] => [{ kind: "text", body: "이 체육관은 이제 시험을 열지 않아. 관장은 오래전에 약속을 마쳤단다. 길을 가는 여행자에게 행운을 빌어 줄게." }];
      if (event.pages?.length) for (const page of event.pages) { page.commands = retire() as typeof page.commands; page.conditions = []; }
      else event.commands = retire() as typeof event.commands;
      retired.push(`${map.id}:${event.id}`);
    }
    // 2) 그 배지로 잠긴 문·대전·목표 — 앞선 약속으로.
    const rewire = (record: Raw): void => {
      if (record.kind === "switch" && typeof record.switchId === "string" && removedSwitches.has(record.switchId)) { record.switchId = fallback; rewired++; }
    };
    for (const map of Object.values(project.maps)) walkObjects(map.events, rewire);
    walkObjects(project.commonEvents, rewire);
    walkObjects(project.endings, rewire);
    for (const objective of campaign.objectives) if (objective.requiresSwitchId && removedSwitches.has(objective.requiresSwitchId)) { objective.requiresSwitchId = fallback; rewired++; }
    // 3) 정의 — 배지와 그 배지를 받으라는 목표를 덜어 낸다.
    campaign.badges = campaign.badges.slice(0, count);
    campaign.objectives = campaign.objectives.filter(o => !removedSwitches.has(o.switchId));
  }
  campaign.plan = { ...(campaign.plan ?? { ...LEGACY_CAMPAIGN_PLAN, species: Math.min(LEGACY_CAMPAIGN_PLAN.species, campaign.speciesIds.length) }), gyms: count };
  const retold = removed.length ? retellForGymCount(project, count) : 0;
  return { before, after: count, removedBadges: removed.map(b => b.name), retiredLeaderEvents: retired, rewiredConditions: rewired, retoldStrings: retold };
}
