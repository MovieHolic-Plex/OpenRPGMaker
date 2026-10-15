import { abilityEffectText } from "@/battle/abilities";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { captureConditionLabel } from "@/battle/captureBalls";
import { heldEffectText } from "@/battle/heldItems";
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
    // 필드 기술(절단·파도타기 같은 비전머신)은 고르면 바로 쓴다 — 배우 스킬 목록의 필드 능력과 같은 동작.
    const field = Boolean(skill?.fieldCommonEventId) && Boolean(options.onUseMonsterFieldSkill);
    return { label: skill?.name ?? id, value: field ? "필드에서 사용" : max === undefined ? "PP —" : `PP ${entry.instance.skillPp?.[id] ?? max}/${max}`,
      description: [monsterTypeLabel(options.project, skill?.elementId ? [skill.elementId] : []),
        skill?.fieldCommonEventId ? "필드 기술 — Enter 로 바라보는 앞에 쓴다" : "",
        skill ? `위력 ${skill.power} · 성공 ${skill.successRate}%` : "", monsterMoveDescription(options.project, skill?.description)].filter(Boolean).join(" · "),
      testId: `status-menu-monster-known-skill-${instanceId}-${id}`, onActivate: field ? () => options.onUseMonsterFieldSkill?.(instanceId, id) : readOnly };
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

/** 「포획 볼」 줄 — 잡은 볼의 이름·등급·조건을 보인다(그림이 아니라 글자 ◓ + 이름: 볼 그림이 필요하면 아이템의 iconResourceId). 포획이 아닌 입수는 줄이 없다. */
function caughtBallEntries(options: StatusMenuDetailOptions, instanceId: string): StatusMenuDetailEntry[] {
  const ballId = options.session.monsterInstances[instanceId]?.caughtBallId;
  if (!ballId) return [];
  const item = options.project.database.items.find((record) => record.id === ballId);
  const profile = item?.captureProfile;
  const grade = profile?.ballClass === "master" ? "마스터 등급" : profile?.ballClass === "ultra" ? "울트라 등급" : profile?.ballClass === "great" ? "그레이트 등급" : "";
  const note = [grade, profile?.condition ? captureConditionLabel(profile.condition) : ""].filter(Boolean).join(" · ");
  return [{
    label: "포획 볼", value: `◓ ${item?.name ?? "알 수 없는 볼"}`,
    ...(note ? { description: note } : {}),
    testId: `status-menu-monster-ball-${instanceId}`,
    ...(item ? { icon: { resourceId: item.iconResourceId ?? item.imageResourceId, alt: item.name, testId: `status-menu-monster-ball-icon-${instanceId}` } } : {}),
    onActivate: readOnly,
  }];
}

/** 「지닌 도구」 줄 — 지닌 도구와 효과를 보이고, 고르면(파티 몬스터만) 가방으로 되돌린다. */
function heldItemEntry(options: StatusMenuDetailOptions, instanceId: string): StatusMenuDetailEntry {
  const held = options.session.monsterInstances[instanceId]?.heldItemId;
  const item = held ? options.project.database.items.find((record) => record.id === held) : undefined;
  if (!item?.heldEffect) {
    return { label: "지닌 도구", value: "없음", description: "가방의 지닐 수 있는 도구를 고르면 이 몬스터에게 쥐여 줄 수 있습니다", testId: `status-menu-monster-held-${instanceId}`, onActivate: readOnly };
  }
  return {
    label: "지닌 도구", value: item.name,
    description: `${heldEffectText(item.heldEffect)} 선택하면 가방으로 되돌립니다.`,
    testId: `status-menu-monster-held-${instanceId}`,
    onActivate: () => options.onTakeHeldItem?.(instanceId),
  };
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
      ...caughtBallEntries(options, raw.instanceId),
      ...(entry.species?.ability ? [{ label: "특성", value: entry.species.ability.name, description: abilityEffectText(entry.species.ability, (id) => monsterTypeLabel(options.project, [id]) || id), testId: "status-menu-monster-ability", onActivate: readOnly }] : []),
      { label: "HP", value: `${entry.hp}/${entry.maxHp}`, testId: "status-menu-monster-current-hp", onActivate: readOnly },
      { label: "공격", value: String(entry.stats.attack), testId: "status-menu-monster-current-stats", onActivate: readOnly },
      { label: "방어", value: String(entry.stats.defense), onActivate: readOnly },
      { label: "특공", value: String(entry.stats.mind), onActivate: readOnly },
      { label: "속도", value: String(entry.stats.agility), onActivate: readOnly },
      ...monsterKnownMoveEntries(options, raw.instanceId),
      ...pendingChoices,
      heldItemEntry(options, raw.instanceId),
      { label: target === "box" ? "보관함으로 이동" : "파티로 이동", value: reason ? "이동 불가" : "", description: reason ?? "선택하면 이 몬스터를 이동합니다", unavailableReason: reason,
        testId: `status-menu-monster-move-${raw.instanceId}`, onActivate: () => options.onMoveMonster?.(raw.instanceId, target) },
    ], hint: "↑↓ 능력·현재 PP 확인 · Esc 몬스터 목록" };
}
