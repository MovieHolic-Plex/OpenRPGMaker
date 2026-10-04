import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { MONSTER_PARTY_MAX } from "@/project/monsterCollection";
import { monsterBoxUnavailableReason, monsterMoveDescription, monsterPartyEntries, monsterMenuIconResourceId, monsterTypeLabel, monsterUiEntry } from "@/player/playerMonsterPartyModel";
import type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";

const readOnly = () => undefined;

export function monsterKnownMoveEntries(options: StatusMenuDetailOptions, instanceId: string): StatusMenuDetailEntry[] {
  const instance = options.session.monsterInstances[instanceId];
  if (!instance) return [];
  const entry = monsterUiEntry(options.project, instance);
  return (entry.instance.skillIds ?? []).map(id => {
    const skill = options.project.database.skills.find(record => record.id === id);
    const max = skill?.maxPp;
    return { label: skill?.name ?? id, value: max === undefined ? "PP —" : `PP ${entry.instance.skillPp?.[id] ?? max}/${max}`,
      description: [monsterTypeLabel(options.project, skill?.elementId ? [skill.elementId] : []),
        skill ? `위력 ${skill.power} · 성공 ${skill.successRate}%` : "", monsterMoveDescription(options.project, skill?.description)].filter(Boolean).join(" · "),
      testId: `status-menu-monster-known-skill-${instanceId}-${id}`, onActivate: readOnly };
  });
}

export function monsterPartyStatusDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  return { title: "상태: 몬스터 파티", entries: monsterPartyEntries(options.project, options.session).map(entry => ({
    label: entry.name, value: `Lv.${entry.instance.level}`, description: `${entry.typeLabel} · HP ${entry.hp}/${entry.maxHp} · ${entry.stateNames.join(" · ") || "정상"}`,
    icon: { resourceId: monsterMenuIconResourceId(options.project, entry.species?.graphic.monsterResourceId), alt: entry.name, testId: `status-menu-monster-art-${entry.instance.instanceId}` },
    testId: `status-menu-monster-${entry.instance.instanceId}`, onActivate: () => options.onSelectMonster?.(entry.instance.instanceId),
  })), emptyLabel: "파티 몬스터가 없습니다", hint: "Enter 현재 능력·기술 보기" };
}

export function monsterPartySkillDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  if (options.skillActorId) {
    const instance = options.session.monsterInstances[options.skillActorId];
    if (!instance || !options.session.monsterParty.includes(instance.instanceId)) return { title: "몬스터 기술", entries: [], emptyLabel: "파티 몬스터를 찾을 수 없습니다" };
    const entry = monsterUiEntry(options.project, instance);
    return { title: `기술: ${entry.name}`, entries: monsterKnownMoveEntries(options, instance.instanceId), emptyLabel: "배운 기술이 없습니다", hint: "현재 PP · Enter 기술 설명 · Esc 몬스터 목록" };
  }
  return { title: "몬스터 기술", entries: monsterPartyEntries(options.project, options.session).map(entry => ({
    label: entry.name, value: `Lv.${entry.instance.level}`, description: `HP ${entry.hp}/${entry.maxHp} · 기술 ${entry.instance.skillIds?.length ?? 0}개`,
    testId: `status-menu-skill-actor-${entry.instance.instanceId}`, onActivate: () => options.onSelectSkillActor?.(entry.instance.instanceId),
    icon: { resourceId: monsterMenuIconResourceId(options.project, entry.species?.graphic.monsterResourceId), alt: entry.name, testId: `status-menu-skill-monster-art-${entry.instance.instanceId}` },
  })), emptyLabel: "파티 몬스터가 없습니다", hint: "Enter 보유 기술·현재 PP 보기" };
}

export function monsterInstanceDetail(options: StatusMenuDetailOptions, pendingChoices: readonly StatusMenuDetailEntry[]): StatusMenuDetail | undefined {
  const instanceId = options.monsterInstanceId;
  const view = options.monsterView ?? "party";
  const ids = view === "party" ? options.session.monsterParty : options.session.monsterBox;
  const raw = instanceId && ids.includes(instanceId) ? options.session.monsterInstances[instanceId] : undefined;
  if (!raw) return undefined;
  const entry = monsterUiEntry(options.project, raw);
  const artwork = resolveAssetResourceUrl(entry.species?.graphic.monsterResourceId, { project: options.project });
  const target = view === "party" ? "box" : "party";
  const reason = target === "box" ? monsterBoxUnavailableReason(options.project, options.session, raw.instanceId)
    : options.session.monsterParty.length >= MONSTER_PARTY_MAX ? "파티가 가득 찼습니다" : undefined;
  return { title: `${entry.name} · Lv.${raw.level}`, layout: isEmeraldMonsterStyle(options.project) ? "campaign-summary" : "campaign-dex", artwork: artwork ? { src: artwork, alt: entry.name } : undefined,
    entries: [
      { label: "← 몬스터 목록", value: "", testId: "status-menu-monster-back", onActivate: () => options.onSelectMonster?.(undefined) },
      { label: "타입", value: entry.typeLabel, onActivate: readOnly },
      { label: "상태", value: entry.stateNames.join(" · ") || "정상", onActivate: readOnly },
      { label: "HP", value: `${entry.hp}/${entry.maxHp}`, testId: "status-menu-monster-current-hp", onActivate: readOnly },
      { label: "공격", value: String(entry.stats.attack), testId: "status-menu-monster-current-stats", onActivate: readOnly },
      { label: "방어", value: String(entry.stats.defense), onActivate: readOnly },
      { label: "특공", value: String(entry.stats.mind), onActivate: readOnly },
      { label: "속도", value: String(entry.stats.agility), onActivate: readOnly },
      ...monsterKnownMoveEntries(options, raw.instanceId),
      ...pendingChoices,
      { label: target === "box" ? "보관함으로 이동" : "파티로 이동", value: reason ? "이동 불가" : "", description: reason ?? "선택하면 이 몬스터를 이동합니다", unavailableReason: reason,
        testId: `status-menu-monster-move-${raw.instanceId}`, onActivate: () => options.onMoveMonster?.(raw.instanceId, target) },
    ], hint: "↑↓ 능력·현재 PP 확인 · Esc 몬스터 목록" };
}
