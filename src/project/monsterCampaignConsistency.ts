// 캠페인 정의(system.monsterCampaign)가 실제로 지어진 이벤트·도감과 맞는지 본다.
//
// 정의는 도감·배지·진행 수첩·지도가 읽는 문서이고, 실제 게임은 이벤트와 DB 다. 둘이 따로 놀면 화면은 거짓말을 한다:
//   - 배지 8→5 요청에서 조수가 정의의 배지 배열만 5개로 줄였다 → 체육관 관장 8명은 그대로, check 는 통과(2026-10-14 자유도 감사).
//   - configure_monster_campaign 시험 호출이 정의를 1종·1배지로 덮어썼는데 게임은 60종·8체육관 그대로였고 check 는 통과했다.
// 순수 함수(프로젝트만 읽음) — 편집기 검수(review_monster_game)와 qa:game check 가 같은 규칙을 쓴다.
import type { Project } from "@/project/types";
import { monsterSpeciesForEnemy } from "@/project/monsterCollection";

export interface CampaignConsistencyFinding {
  readonly severity: "blocker" | "warning";
  readonly code: string;
  readonly message: string;
}

type Raw = Record<string, unknown>;

/** 저장본 그대로(모델이 쓴 잘못된 필드 포함)를 훑는다 — Command 타입이 아니라 레코드로. */
function visit(value: unknown, fn: (record: Raw) => void): void {
  if (Array.isArray(value)) { for (const v of value) visit(v, fn); return; }
  if (!value || typeof value !== "object") return;
  const record = value as Raw;
  if (typeof record.kind === "string") fn(record);
  for (const v of Object.values(record)) visit(v, fn);
}

const BADGE_LIKE = /badge|배지/iu;

export function checkMonsterCampaignDefinition(project: Project): CampaignConsistencyFinding[] {
  const campaign = project.system.monsterCampaign;
  if (!campaign) return [];
  const findings: CampaignConsistencyFinding[] = [];
  const setOn = new Set<string>(), giveSpecies = new Set<string>(), troopIds = new Set<string>();
  for (const map of Object.values(project.maps)) {
    for (const entry of map.encounterTable ?? []) troopIds.add(entry.troopId);
    for (const id of map.troopIds ?? []) troopIds.add(id);
    for (const event of map.events) visit(event.pages ?? event.commands, record => {
      if (record.kind === "setSwitch" && typeof record.switchId === "string" && record.value !== false) setOn.add(record.switchId);
      if (record.kind === "giveMonster" && typeof record.speciesId === "string") giveSpecies.add(record.speciesId);
      if (record.kind === "battleProcessing" && typeof record.troopId === "string") troopIds.add(record.troopId);
    });
  }
  for (const common of project.commonEvents ?? []) visit(common, record => {
    if (record.kind === "setSwitch" && typeof record.switchId === "string" && record.value !== false) setOn.add(record.switchId);
  });
  const startOn = new Set(Object.entries(project.session?.switches ?? {}).filter(([, v]) => v === true).map(([k]) => k));

  // 1) 정의의 배지는 실제로 어딘가에서 켜져야 한다(켜는 이벤트가 없으면 배지 화면이 영원히 비어 있다).
  for (const badge of campaign.badges) {
    if (!setOn.has(badge.switchId) && !startOn.has(badge.switchId)) {
      findings.push({ severity: "blocker", code: "campaign-badge-unreachable", message: `캠페인 배지 「${badge.name}」의 스위치(${badge.switchId})를 켜는 이벤트가 없습니다 — 정의만 있고 체육관은 없습니다.` });
    }
  }
  // 2) 이벤트가 켜는 배지 스위치는 정의에 있어야 한다(정의를 줄여 놓고 관장은 그대로 두는 일을 막는다).
  const defined = new Set(campaign.badges.map(b => b.switchId));
  const names = new Map(project.switches.map(s => [s.id, s.name]));
  const orphan = [...setOn].filter(id => !defined.has(id) && (BADGE_LIKE.test(id) || BADGE_LIKE.test(names.get(id) ?? "")));
  if (orphan.length) {
    findings.push({ severity: "blocker", code: "campaign-badge-undeclared", message: `캠페인 정의에는 배지가 ${campaign.badges.length}개인데 이벤트는 정의에 없는 배지 스위치 ${orphan.length}개(${orphan.slice(0, 4).join(", ")})를 켭니다 — 배지 수를 줄이려면 configure_monster_campaign 의 badgeCount 로 체육관 이벤트까지 함께 줄이거나 정의에 배지를 더하세요.` });
  }
  // 3) 계획(plan)이 약속한 체육관 수는 정의의 배지 수와 같아야 한다.
  if (campaign.plan && campaign.plan.gyms !== campaign.badges.length) {
    findings.push({ severity: "blocker", code: "campaign-plan-mismatch", message: `캠페인 계획은 체육관 ${campaign.plan.gyms}개인데 정의의 배지는 ${campaign.badges.length}개입니다.` });
  }
  // 4) 게임이 실제로 쓰는 종이 도감 정의에 있어야 한다 — 정의를 1종으로 덮어쓴 채 통과하던 손상.
  const enemies = new Map(project.database.enemies.map(e => [e.id, e]));
  const troops = new Map(project.database.troops.map(t => [t.id, t]));
  const used = new Set<string>(giveSpecies);
  for (const id of troopIds) for (const member of troops.get(id)?.members ?? []) {
    const record = monsterSpeciesForEnemy(project, enemies.get(member.enemyId));
    if (record) used.add(record.id);
  }
  const declared = new Set(campaign.speciesIds);
  const missing = [...used].filter(id => !declared.has(id));
  if (missing.length) {
    const shrunk = declared.size < used.size / 2;
    findings.push({ severity: shrunk ? "blocker" : "warning", code: "campaign-species-undeclared",
      message: `게임이 쓰는 종 ${used.size}종 중 ${missing.length}종(${missing.slice(0, 4).join(", ")})이 캠페인 도감 정의(${declared.size}종)에 없습니다 — 도감 화면에 나오지 않습니다(configure_monster_campaign speciesIds).` });
  }
  // 5) 진행 목표의 스위치도 켜질 길이 있어야 한다.
  for (const objective of campaign.objectives) {
    if (!setOn.has(objective.switchId) && !startOn.has(objective.switchId)) {
      findings.push({ severity: "warning", code: "campaign-objective-unreachable", message: `진행 목표 「${objective.title}」의 스위치(${objective.switchId})를 켜는 이벤트가 없습니다.` });
    }
  }
  return findings;
}
