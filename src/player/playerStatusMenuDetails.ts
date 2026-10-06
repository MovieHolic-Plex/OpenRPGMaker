import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { monsterUiEntry, monsterMenuIconResourceId } from "@/player/playerMonsterPartyModel";
import { monsterInstanceDetail, monsterPartySkillDetail, monsterPartyStatusDetail } from "@/player/playerMonsterPartyDetail";
import { usesMonsterParty } from "@/player/playerMonsterPartyModel";
import { createMonsterCampaignDetail } from "@/player/playerMonsterCampaignMenu";
import { monsterCampaign, monsterJournalEntry } from '@/project/monsterJournal';
import { inventoryViewEntries } from '@/player/playerInventoryView';
import { createPlayerOptionsDetail } from '@/player/playerOptionsDetail';
import { battleReportDetail } from "@/player/playerBattleReportDetail";
import { formationDetail } from "@/player/playerFormationDetail";
import { equipmentSlots, equipmentSlotLabel } from "@/project/equipmentSlots";
import { createGrowthMenu, growthMenuTabs } from "@/player/playerGrowthMenu";
import { canUseMenuItemOnActor } from "@/player/playerItemUse";
import { activeItemEffects, itemAllowsMenu } from "@/project/itemUsage";
import { actorOwnedSkillIds } from '@/project/growth/runtime';
import { canCraft, combinationPartnersOf, combinationRecipeFor } from "@/project/craftRecipes";
import { actorLoadoutSlots, equippedBattleSkillIds } from "@/project/skillLoadout";
import { actorDerivedStats } from '@/battle/battleBattlers';
import { menuItemUnavailableReason, previewMenuItemTarget, previewMonsterMedicine, targetsPartyMonsters } from "@/player/playerItemUse";
import type { SaveSlotIndex, SaveSlotReadResult } from "@/player/saveSlots";
import { canEquip, effectiveActorEquipment, equipmentSlotAccepts } from "@/project/equipmentRules";
import { resolveActorName, resolveActorFaceResourceId } from "@/project/sessionActorCommands";
import { defaultActorFaceResourceId, normalizeActorRecord } from "@/project/actorModel";
import type { StatusMenuStatDelta } from "@/player/playerStatusMenuDetailTypes";
import { effectiveActorClassId } from "@/project/sessionClass";
import type { PlaySession } from "@/project/session";
import type {
  ActorInitialEquipment,
  ActorRecord,
  EquipmentStatBonuses,
  EquipmentRecord,
  ItemRecord,
  Project,
  SkillRecord,
} from "@/project/types";
import type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailFact, StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";
import { buildQuestLog, questStateLabel } from "@/player/questLog";
import { MONSTER_PARTY_MAX, monsterCurrentHp, monsterDisplayName, monsterMaxHp } from "@/project/monsterCollection";
import { galleryMenuLabel, listGalleryUnlocks } from "@/project/gallery";
import { openGalleryViewer } from "@/player/galleryViewer";
import { resourceDisplayName } from "@/player/resourceDisplay";
import { listFriendshipEntries } from "@/project/friendship";
import { createLifeLedgerDetail } from "@/player/lifeLedger";
import {
  isStatusMenuGroupEntryId,
  listStatusMenuGroupCommandIds,
  statusMenuCommandLabel,
  statusMenuGroupEntryLabel,
  type StatusMenuCommandId,
  type StatusMenuGroupEntryId,
} from "@/player/playerStatusMenuModel";

export type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailFact, StatusMenuDetailOptions, StatusMenuStatDelta } from "@/player/playerStatusMenuDetailTypes";

const STAT_LABELS = [
  ["attack", "공격"],
  ["defense", "방어"],
  ["mind", "정신"],
  ["agility", "민첩"],
] as const satisfies readonly (readonly [keyof EquipmentStatBonuses, string])[];

export function createStatusMenuDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  // 접힌 그룹(기록/시스템)은 레일에 항목 하나만 남기고 실제 명령은 여기 작업 영역에서 고른다.
  if (isStatusMenuGroupEntryId(options.selectedCommand)) return groupDetail(options, options.selectedCommand);
  switch (options.selectedCommand) {
    case "items": return itemDetail(options);
    case "options": return createPlayerOptionsDetail(options.onOptionsChanged);
    case 'trainer-card': {
      const { project, session } = options;
      const campaign = monsterCampaign(project), ids = campaign?.speciesIds ?? [];
      const leader = project.database.actors.find(a => a.id === session.partyActorIds[0]);
      const trainer = leader ?? project.database.actors[0];
      return { title: `원정 수첩 · ${trainer ? resolveActorName(session, trainer) : '여행자'}`, entries: [
        { label: '현재 위치', value: project.maps[session.currentMapId]?.name ?? '알 수 없는 장소' },
        { label: '동료', value: `${session.monsterParty.length}마리` },
        { label: '발견', value: `${ids.filter(id => monsterJournalEntry(session,id).seen).length} / ${ids.length}종` },
        { label: '포획', value: `${ids.filter(id => monsterJournalEntry(session,id).caught).length} / ${ids.length}종` },
        { label: '배지', value: `${(campaign?.badges ?? []).filter(b => session.switches[b.switchId] === true).length} / ${campaign?.badges.length ?? 0}` },
        { label: '소지금', value: String(session.gold) },
      ], hint: session.monsterParty.length ? '도감과 배지는 저장 기록에 함께 남습니다.' : '연구소에서 첫 동료를 만나 원정을 시작하세요.' };
    }
    case "skills": return skillDetail(options);
    case "equipment": return equipmentDetail(options);
    case "monsters": return monsterDetail(options);
    case "monster-dex":
    case "region-map":
    case "campaign-progress": return createMonsterCampaignDetail(options, options.selectedCommand);
    case "save": return saveDetail(options);
    case "load": return loadDetail(options.slots, options.onLoadSlot);
    case "status": return usesMonsterParty(options.project) ? monsterPartyStatusDetail(options) : statusDetail(options.project, options.session);
    case "row": return rowDetail(options);
    case "formation": return formationDetail(options);
    case "battle-reports": return battleReportDetail(options);
    case "quests": return questsDetail(options.project, options.session);
    case "relationships": return relationshipsDetail(options.project, options.session);
    case "gallery": return galleryDetail(options.project, options.session);
    case "life-ledger": return createLifeLedgerDetail({
      project: options.project,
      session: options.session,
      tab: options.lifeLedgerTab,
      onSelectTab: options.onSelectLifeLedgerTab,
      onMutation: options.onLifeLedgerMutation,
      readLive: options.readLive,
      placementDirection: options.placementDirection,
      getPlacementDirection: options.getPlacementDirection,
      getScene: options.getScene,
    });
    case "wait": return waitDetail(options.waitModeEnabled);
    case "to-title": return toTitleDetail(options);
    default: return assertNever(options.selectedCommand);
  }
}

function groupDetail(options: StatusMenuDetailOptions, entryId: StatusMenuGroupEntryId): StatusMenuDetail {
  const commandIds = listStatusMenuGroupCommandIds(entryId, options.project, options.session);
  const entries = commandIds.map((commandId) => ({
    label: statusMenuCommandLabel(commandId, options.waitModeEnabled, options.project),
    value: "",
    description: commandId === "to-title" ? "미저장 진행 삭제" : GROUP_COMMAND_DESCRIPTIONS[commandId],
    testId: `status-menu-group-command-${commandId}`,
    onActivate: options.onCommand ? () => options.onCommand?.(commandId) : undefined,
    destructive: commandId === "to-title",
  }));
  return {
    title: statusMenuGroupEntryLabel(entryId).replace(" ▸", ""),
    entries,
    emptyLabel: "항목이 없습니다",
  };
}

const GROUP_COMMAND_DESCRIPTIONS: Partial<Record<StatusMenuCommandId, string>> = {
  "monster-dex": "발견·포획한 몬스터의 생태와 기술을 봅니다.",
  "region-map": "현재 위치와 섬의 길을 봅니다.",
  "campaign-progress": "모은 배지와 다음 원정 목표를 봅니다.",
  "battle-reports": "최근 전투 결과와 실제 행동 기록을 읽습니다.",
  quests: "받은 의뢰와 진행 상황을 봅니다.",
  relationships: "동료·주민과의 관계를 봅니다.",
  gallery: "모아 둔 그림을 다시 봅니다.",
  "life-ledger": "출하·꾸러미·생활 기술·가공 설비·수집 도감·박물관 기록을 관리합니다.",
  options: "음량·대사 속도·메뉴 움직임을 이 기기에 설정합니다.",
  save: "현재 진행을 슬롯에 저장합니다.",
  load: "저장한 진행을 불러옵니다.",
  wait: "전투 중 명령 입력 시 시간을 멈출지 정합니다.",
  "to-title": "타이틀 화면으로 돌아갑니다. 저장하지 않은 진행은 사라집니다.",
};

function toTitleDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  return {
    title: "타이틀로 돌아가기",
    entries: options.confirmToTitle ? [{
      label: "진행을 버리고 타이틀로",
      value: "확인",
      description: "저장하지 않은 진행은 사라집니다.",
      testId: "status-menu-confirm-to-title",
      onActivate: options.onCommand ? () => options.onCommand?.("to-title") : undefined,
      destructive: true,
    }] : [],
    emptyLabel: "타이틀 복귀 확인을 준비하지 못했습니다.",
    hint: "한 번 더 선택해야 타이틀 화면으로 돌아갑니다.",
  };
}

/**
 * 아이템 «다른 행동» 화면 — 바라보는 대상에 사용 + 가진 아이템과 조합. 둘 다 없으면 이 화면으로 들어오지 않는다.
 */
function itemActionDetail(options: StatusMenuDetailOptions, itemId: string): StatusMenuDetail {
  const { project, session } = options;
  const authored = project.database.items.find((record) => record.id === itemId);
  const item = authored ? activeItemEffects(authored) : undefined;
  const entries: StatusMenuDetailEntry[] = [];
  if (item && itemAllowsMenu(item)) {
    const needsTarget = item.type !== "switch" && (item.scope === "ally" || item.scope === "allAllies" || item.type === "book" || item.type === "seed" || Boolean(item.careProfile));
    entries.push({
      label: "사용",
      value: "",
      unavailableReason: menuItemUnavailableReason(item),
      testId: `status-menu-item-use-${itemId}`,
      ...(isEmeraldMonsterStyle(project) ? { icon: itemEntryIcon(item), description: item.description, facts: itemFacts(project, session, item) } : {}),
      onActivate: needsTarget && options.onSelectItemTarget
        ? () => options.onSelectItemTarget?.(itemId)
        : options.onUseItem ? () => options.onUseItem?.(itemId) : undefined,
    });
  }
  if (options.canUseItemOnFacedTarget?.(itemId)) {
    entries.push({
      label: "바라보는 대상에 사용",
      value: "",
      description: "주인공이 바라보는 대상에게 이 아이템을 씁니다.",
      testId: `status-menu-item-use-target-${itemId}`,
      onActivate: options.onUseItemOnFacedTarget ? () => options.onUseItemOnFacedTarget?.(itemId) : undefined,
    });
  }
  for (const partnerId of itemCombinationPartners(project, session, itemId)) {
    const partner = project.database.items.find((record) => record.id === partnerId);
    const recipe = combinationRecipeFor(project, itemId, partnerId);
    const output = recipe ? project.database.items.find((record) => record.id === recipe.outputItemId) : undefined;
    const check = recipe ? canCraft(project, session, recipe.id) : undefined;
    entries.push({
      label: `${partner?.name ?? partnerId}와(과) 조합`,
      value: output ? `→ ${output.name}` : "",
      description: recipe?.name ?? "두 아이템을 합쳐 새 아이템을 만듭니다.",
      unavailableReason: check && !check.ok ? combinationFailureText(check.reason) : undefined,
      testId: `status-menu-item-combine-${itemId}-${partnerId}`,
      onActivate: options.onCombineItems ? () => options.onCombineItems?.(itemId, partnerId) : undefined,
    });
  }
  if (item && isEmeraldMonsterStyle(project) && entries.length === 0) {
    entries.push({ label: "정보", value: "", description: item.description, icon: itemEntryIcon(item), facts: itemFacts(project, session, item), onActivate: () => undefined });
  }
  return {
    title: isEmeraldMonsterStyle(project) ? item?.name ?? itemId : `${item?.name ?? itemId} · 다른 행동`,
    entries,
    emptyLabel: "할 수 있는 행동이 없습니다",
    hint: "Enter 실행 · Esc 아이템 목록",
  };
}

/** 가진 아이템 중 조합 상대(같은 아이템끼리는 2개 이상 있을 때만). */
export function itemCombinationPartners(project: StatusMenuDetailOptions["project"], session: PlaySession, itemId: string): string[] {
  return combinationPartnersOf(project, itemId).filter((partnerId) =>
    partnerId === itemId ? (session.inventory[itemId] ?? 0) >= 2 : (session.inventory[partnerId] ?? 0) > 0,
  );
}

function combinationFailureText(reason: string): string {
  switch (reason) {
    case "locked": return "아직 배우지 않은 조합입니다";
    case "missing-gold": return "소지금이 부족합니다";
    case "missing-ingredients": return "재료가 부족합니다";
    case "inventory-overflow": return "더 가질 수 없습니다";
    default: return "조합할 수 없습니다";
  }
}

function itemDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const { project, session } = options;
  if (options.itemActionId) return itemActionDetail(options, options.itemActionId);
  if (options.targetItemId) {
    const authoredItem = project.database.items.find((record) => record.id === options.targetItemId);
    if (!authoredItem) return { title: "대상 선택", entries: [], emptyLabel: "아이템을 찾을 수 없습니다" };
    const item = activeItemEffects(authoredItem);
    const careProfile = item.careProfile;
    if (careProfile) {
      return {
        title: `대상 선택: ${item.name}`,
        entries: session.monsterParty.flatMap((instanceId) => {
          const instance = session.monsterInstances[instanceId];
          if (!instance) return [];
          return [{
            label: monsterDisplayName(project, instance),
            value: `Lv.${instance.level}  친밀도 ${instance.friendship}`,
            testId: `status-menu-monster-${instanceId}`,
            onActivate: options.onUseItem ? () => options.onUseItem?.(item.id, undefined, instanceId) : undefined,
          }];
        }),
        emptyLabel: "대상이 없습니다",
        hint: "사용할 대상을 선택하세요.",
      };
    }
    if (targetsPartyMonsters(project, item)) {
      const anyTarget = item.scope === "allAllies" && (session.monsterParty ?? []).some(id => !previewMonsterMedicine(project, session, item, id).reason);
      return {
        title: `${item.name} · ${session.inventory[item.id] ?? 0}개`,
        entries: (session.monsterParty ?? []).flatMap(instanceId => {
          const instance = session.monsterInstances?.[instanceId];
          if (!instance) return [];
          const preview = previewMonsterMedicine(project, session, item, instanceId);
          const stateName = (id: string) => project.database.states.find(state => state.id === id)?.name ?? id;
          const remaining = preview.stateIds.filter(id => !preview.curedStateIds.includes(id));
          const states = preview.stateIds.map(stateName).join(" · ") || "정상";
          const after = remaining.map(stateName).join(" · ") || "정상";
          const pp = item.ppRecovery ? `PP ${preview.pp}/${preview.maxPp} → ${preview.ppAfter}/${preview.maxPp}` : "";
          return [{
            label: `${monsterDisplayName(project, instance)}  Lv.${instance.level}`,
            value: `HP ${preview.hp}/${preview.maxHp}${preview.hpAfter !== preview.hp ? ` → ${preview.hpAfter}/${preview.maxHp}` : ""}`,
            description: anyTarget ? "사용 가능한 파티 몬스터 모두에게 적용됩니다." : preview.reason ?? [pp, preview.curedStateIds.length ? `${states} → ${after}` : states].filter(Boolean).join(" · "),
            disabled: !anyTarget && Boolean(preview.reason),
            unavailableReason: anyTarget ? undefined : preview.reason,
            testId: `status-menu-monster-${instanceId}`,
            attributes: { monsterMedicineTarget: "true" },
            onActivate: options.onUseItem ? () => options.onUseItem?.(item.id, undefined, instanceId) : undefined,
          }];
        }),
        emptyLabel: "파티 몬스터가 없습니다",
        hint: "Enter 사용 · Esc 아이템 목록",
      };
    }
    return {
      title: `${item.name} · ${session.inventory[item.id] ?? 0}개`,
      entries: partyActors(project, session).map((actor) => {
        const preview = previewMenuItemTarget(project, session, item, actor.id);
        const stateName = (stateId: string) => project.database.states.find((state) => state.id === stateId)?.name;
        const stateNames = preview.stateIds.map(stateName).filter((name): name is string => Boolean(name));
        const curedStateNames = preview.curedStateIds.map(stateName).filter((name): name is string => Boolean(name));
        const anyTarget = item.scope === "allAllies" && session.partyActorIds.some((id) => canUseMenuItemOnActor(project, session, item, id));
        const eligible = anyTarget || canUseMenuItemOnActor(project, session, item, actor.id);
        return {
          label: resolveActorName(session, actor),
          value: `HP ${preview.hp}/${preview.maxHp}  ${item.ppRecovery ? `PP ${preview.pp}/${preview.maxPp} → ${preview.ppAfter}/${preview.maxPp}` : `MP ${preview.mp}/${preview.maxMp}`}`,
          vitals: { ...preview, stateNames, curedStateNames },
          unavailableReason: anyTarget ? undefined : preview.reason,
          description: anyTarget ? "사용 가능한 파티원 모두에게 적용됩니다." : preview.reason,
          face: {
            resourceId: resolveActorFaceResourceId(session, actor, project) ?? defaultActorFaceResourceId(actor),
            alt: resolveActorName(session, actor),
            testId: `status-menu-target-face-${actor.id}`,
          },
          testId: `status-menu-item-target-${actor.id}`,
          disabled: !eligible,
          onActivate: options.onUseItem ? () => options.onUseItem?.(item.id, actor.id) : undefined,
        };
      }),
      emptyLabel: "대상이 없습니다",
      hint: item.scope === "allAllies" ? "사용 가능한 파티원 모두에게 적용됩니다." : "Enter 사용 · Esc 아이템 목록",
    };
  }

  const inventory = new Map(Object.entries(session.inventory).filter(([, count]) => count > 0));
  const itemEntries = project.database.items.filter((item) => inventory.has(item.id)).map((authored) => {
    const item = activeItemEffects(authored);
    const needsTarget = item.type !== "switch" && itemAllowsMenu(item) && (item.scope === "ally" || item.scope === "allAllies" || item.type === "book" || item.type === "seed" || Boolean(item.careProfile));
    // 조합할 짝이 있거나 바라보는 대상이 받는 아이템은 «행동 고르기» 화면으로 간다. 그 화면 첫 줄이 평소 「사용」이다.
    const hasOtherActions = Boolean(options.onOpenItemActions)
      && (isEmeraldMonsterStyle(project) || itemCombinationPartners(project, session, item.id).length > 0 || options.canUseItemOnFacedTarget?.(item.id) === true);
    if (hasOtherActions) {
      return {
        label: item.name,
        icon: itemEntryIcon(item),
        value: `${inventory.get(item.id) ?? 0}개`,
        description: item.description,
        facts: itemFacts(project, session, item),
        testId: `status-menu-item-${item.id}`,
        attributes: { itemActions: "true" },
        onActivate: () => options.onOpenItemActions?.(item.id),
      };
    }
    return {
      label: item.name,
      icon: itemEntryIcon(item),
      value: `${inventory.get(item.id) ?? 0}개`,
      description: item.description,
      unavailableReason: menuItemUnavailableReason(item),
      facts: itemFacts(project, session, item),
      testId: `status-menu-item-${item.id}`,
      onActivate: needsTarget && options.onSelectItemTarget
        ? () => options.onSelectItemTarget?.(item.id)
        : options.onUseItem ? () => options.onUseItem?.(item.id) : undefined,
    };
  });
  const { wornSummary, bagEntries } = usesMonsterParty(project)
    ? { wornSummary: undefined, bagEntries: [] } : ownedEquipmentEntries(options);
  const entries = [...(wornSummary ? [wornSummary] : []), ...itemEntries, ...bagEntries];
  return { title: usesMonsterParty(project) ? "가방" : "아이템", entries: inventoryViewEntries(entries, project, session, options.inventoryView, options.onInventoryViewChange), emptyLabel: "아이템이 없습니다", hint: "목록 끝에서 분류·정렬 변경 · ↑↓ 이동 · Enter 선택" };
}

function ownedEquipmentEntries(options: StatusMenuDetailOptions): {
  readonly wornSummary: StatusMenuDetailEntry | undefined;
  readonly bagEntries: readonly StatusMenuDetailEntry[];
} {
  const { project, session } = options;
  const party = partyActors(project, session);
  const wornNames: string[] = [];
  const seenWorn = new Set<string>();
  for (const actor of party) {
    const worn = actorEquipment(project, session, actor);
    for (const slot of equipmentSlots(project)) {
      const equipmentId = worn[slot.id];
      if (!equipmentId || seenWorn.has(equipmentId)) continue;
      seenWorn.add(equipmentId);
      const record = project.database.equipment.find((entry) => entry.id === equipmentId);
      if (record) wornNames.push(record.name);
    }
  }
  const wornSummary: StatusMenuDetailEntry | undefined = wornNames.length === 0
    ? undefined
    : {
      label: "장착 중",
      value: wornNames.join(", "),
      testId: "status-menu-owned-equipment-worn",
    };
  const bagEntries = project.database.equipment.flatMap((equipment) => {
    const bagCount = session.inventory[equipment.id] ?? 0;
    if (bagCount <= 0) return [];
    const actorId = party.find((actor) => actorEquipment(project, session, actor)[equipment.slot] === equipment.id)?.id
      ?? party[0]?.id;
    return [{
      label: equipment.name,
      icon: equipmentEntryIcon(equipment),
      value: `${bagCount}개`,
      description: equipment.description,
      testId: `status-menu-owned-equipment-${equipment.id}`,
      onActivate: actorId && options.onSelectEquipmentSlot
        ? () => options.onSelectEquipmentSlot?.(actorId, equipment.slot)
        : actorId && options.onSelectEquipmentActor
          ? () => options.onSelectEquipmentActor?.(actorId)
          : undefined,
    }];
  });
  return { wornSummary, bagEntries };
}

function skillDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  if (usesMonsterParty(options.project)) return monsterPartySkillDetail(options);
  const { project, session } = options;
  if (options.skillActorId) {
    const actor = partyActors(project, session).find((record) => record.id === options.skillActorId);
    if (!actor) return { title: "스킬", entries: [], emptyLabel: "파티원을 찾을 수 없습니다" };
    if (options.growthTab && options.growthTab !== "skills") return createGrowthMenu(options);
    const skills = learnedSkills(project, session, actor);
    const slots = actorLoadoutSlots(actor);
    if (slots !== undefined) {
      // 장착 칸이 있는 배우: 행을 고르면 장착/해제. 전투는 장착한 스킬만 쓴다(project/skillLoadout.ts).
      const equipped = new Set(equippedBattleSkillIds(actor, skills.map((skill) => skill.id), session.actorSkillLoadouts?.[actor.id]));
      return {
        title: `스킬 장착: ${actor.name} (${equipped.size}/${slots})`,
        tabs: project.growth || project.database.classes.some(c => c.promotions?.length) ? growthMenuTabs(options) : undefined,
        entries: skills.map((skill) => ({
          label: `${equipped.has(skill.id) ? "● " : "○ "}${skill.name}`,
          icon: skillEntryIcon(project, skill),
          value: equipped.has(skill.id) ? "장착" : `MP ${skill.mpCost.flat}`,
          description: `${skill.description || skillKindLabel(skill)} / 위력 ${skill.power} / 성공 ${skill.successRate}%`,
          testId: `status-menu-skill-${actor.id}-${skill.id}`,
          attributes: { loadoutEquipped: equipped.has(skill.id) ? "true" : "false" },
          onActivate: options.onToggleSkillLoadout
            ? () => options.onToggleSkillLoadout?.(actor.id, skill.id)
            : options.onSelectSkill ? () => options.onSelectSkill?.(skill.id) : undefined,
        })),
        emptyLabel: "배운 스킬이 없습니다",
        hint: `Enter 장착/해제 · 전투에서는 장착한 스킬 ${slots}개까지만 씁니다.`,
      };
    }
    return {
      title: `스킬: ${actor.name}`,
      tabs: project.growth || project.database.classes.some(c => c.promotions?.length) ? growthMenuTabs(options) : undefined,
      entries: skills.map((skill) => ({
        label: skill.name,
        icon: skillEntryIcon(project, skill),
        value: skill.fieldCommonEventId ? `MP ${skill.mpCost.flat} · 필드에서 사용` : `MP ${skill.mpCost.flat}`,
        description: `${skill.description || skillKindLabel(skill)} / 위력 ${skill.power} / 성공 ${skill.successRate}%`,
        testId: `status-menu-skill-${actor.id}-${skill.id}`,
        onActivate: options.onSelectSkill ? () => options.onSelectSkill?.(skill.id) : undefined,
      })),
      emptyLabel: "사용할 수 있는 스킬이 없습니다",
      hint: options.selectedSkillId ? "선택한 스킬 정보를 확인했습니다." : "스킬을 선택하면 설명을 확인합니다.",
    };
  }

  const entries = partyActors(project, session).map((actor) => {
    const skills = learnedSkills(project, session, actor);
    return {
      label: actor.name,
      value: skills.length > 0 ? skills.map((skill) => skill.name).join(", ") : "스킬 없음",
      description: actor.nickname || "스킬 목록을 봅니다",
      testId: `status-menu-skill-actor-${actor.id}`,
      onActivate: options.onSelectSkillActor ? () => options.onSelectSkillActor?.(actor.id) : undefined,
    };
  });
  return { title: "스킬", entries, emptyLabel: "스킬을 볼 파티원이 없습니다", hint: "파티원을 선택하세요." };
}

function equipmentDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const { project, session } = options;
  const equipmentById = new Map(project.database.equipment.map((item) => [item.id, item]));
  if (!options.equipmentActorId) {
    const entries = partyActors(project, session).map((actor) => {
      const worn = actorEquipment(project, session, actor);
      // 5개 부위를 " / " 로 이어 한 줄에 넣으면 좁은 패널에서 통째로 줄바꿈되어
      // 슬래시만 늘어선 정체불명의 덩어리가 된다(실측: "청동 검 / 참나무 방패 / ...").
      // 값은 무기 하나만 짧게 보이고, 나머지는 부위 이름을 붙여 설명 줄로 내린다.
      // 부위 전체를 설명 줄에 늘어놓아도 -webkit-line-clamp:2 에 걸려 잘린다.
      // 이 패널의 역할은 "누구 장비를 볼지" 고르는 것이므로 무기만 보이고,
      // 부위별 목록은 선택 후 화면(슬롯당 한 줄)에서 제대로 보여준다.
      const weaponSlot = { id: "weapon" };
      return {
        label: actor.name,
        value: equipmentName(equipmentById, worn[weaponSlot.id]),
        icon: equipmentEntryIcon(equipmentById.get(worn[weaponSlot.id] ?? "")),
        testId: `status-menu-equipment-actor-${actor.id}`,
        onActivate: options.onSelectEquipmentActor ? () => options.onSelectEquipmentActor?.(actor.id) : undefined,
      };
    });
    return { title: "장비", entries, emptyLabel: "장비를 볼 파티원이 없습니다", hint: "파티원을 선택하세요." };
  }

  const actor = project.database.actors.find((record) => record.id === options.equipmentActorId);
  if (!actor) return { title: "장비", entries: [], emptyLabel: "파티원을 찾을 수 없습니다" };
  if (!options.equipmentSlotId) {
    const worn = actorEquipment(project, session, actor);
    const entries = equipmentSlots(project).map((slot) => ({
      label: slot.label,
      value: equipmentName(equipmentById, worn[slot.id]),
      icon: equipmentEntryIcon(equipmentById.get(worn[slot.id] ?? "")),
      // 부위만 고르는 화면에서도 지금 능력치가 보여야 무엇을 바꿀지 판단한다(증감 0 = 현재값).
      statDelta: equipmentStatDelta(options, actor, slot.id as keyof ActorInitialEquipment, worn[slot.id]),
      testId: `status-menu-equipment-slot-${slot.id}`,
      onActivate: options.onSelectEquipmentSlot ? () => options.onSelectEquipmentSlot?.(actor.id, slot.id) : undefined,
    }));
    // 「최강 장비」 — 가진 것 중 능력치 합이 가장 높아지는 조합을 부위별로 고른다. 미리 바뀌는 수치를 보인다.
    const best = bestEquipmentPlan(options, actor);
    const optimize = best && options.onOptimizeEquipment
      ? [{
          label: "최강 장비",
          value: best.changes.length ? `합계 ${signed(best.gain)}` : "이미 최강",
          description: best.changes.length
            ? best.changes.map((change) => `${change.slotLabel} ${change.fromName} → ${change.toName}`).join(" · ")
            : "지금 장비가 가진 것 중 가장 강한 조합입니다.",
          statDelta: best.statDelta,
          testId: "status-menu-equipment-optimize",
          attributes: { equipmentGain: String(best.gain) },
          onActivate: () => options.onOptimizeEquipment?.(actor.id),
        }]
      : [];
    return { title: `장비: ${resolveActorName(session, actor)}`, entries: [...entries, ...optimize], hint: "바꿀 부위를 선택하세요." };
  }

  const currentEquipmentId = actorEquipment(project, session, actor)[options.equipmentSlotId];
  const classId = effectiveActorClassId(project, session, actor.id);
  const choices = project.database.equipment.filter((equipment) => {
    return equipmentSlotAccepts(project, actor, options.equipmentSlotId as keyof ActorInitialEquipment, equipment, classId)
      && (session.inventory[equipment.id] ?? 0) > 0
      && canEquip(project, actor, equipment, classId);
  });
  const currentStats = equipmentStats(project, currentEquipmentId);
  const unequipEntry = currentEquipmentId
    ? [{
        label: "해제",
        value: equipmentName(equipmentById, currentEquipmentId),
        icon: equipmentEntryIcon(equipmentById.get(currentEquipmentId ?? "")),
        description: `현재 장비를 벗습니다 / ${statDiffLine(zeroStats(), currentStats)}`,
        statDelta: equipmentStatDelta(options, actor, options.equipmentSlotId as keyof ActorInitialEquipment, undefined),
        testId: "status-menu-equipment-item-none",
        onActivate: options.onUnequipItem ? () => options.onUnequipItem?.(actor.id, options.equipmentSlotId as keyof ActorInitialEquipment) : undefined,
      }]
    : [];
  return {
    title: `${actor.name}: ${equipmentSlotLabel(project, options.equipmentSlotId)}`,
    entries: [
      ...unequipEntry,
      ...choices.map((equipment) => ({
        label: equipment.name,
        icon: equipmentEntryIcon(equipment),
        // 후보 행 오른쪽 = 가장 큰 변화 두 개(공+6 민−2). 소지 수는 쇼케이스가 보인다.
        value: `${deltaChips(equipmentStatDelta(options, actor, options.equipmentSlotId as keyof ActorInitialEquipment, equipment.id))} · ${session.inventory[equipment.id] ?? 0}개`,
        description: equipmentDetailLine(equipment, currentStats),
        statDelta: equipmentStatDelta(options, actor, options.equipmentSlotId as keyof ActorInitialEquipment, equipment.id),
        testId: `status-menu-equipment-item-${equipment.id}`,
        onActivate: options.onEquipItem ? () => options.onEquipItem?.(actor.id, options.equipmentSlotId as keyof ActorInitialEquipment, equipment.id) : undefined,
      })),
    ],
    emptyLabel: "장비할 수 있는 소지품이 없습니다",
    hint: "후보 이동 시 현재 장비 대비 능력치 증감을 표시합니다.",
  };
}

function saveDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  return {
    title: "저장",
    entries: options.slots.map((slot) => ({
      label: `${slot.slot}번 저장`,
      ...saveSlotEntryParts(slot, options.confirmSaveSlot === slot.slot),
      testId: `save-slot-${slot.slot}`,
      onActivate: options.onSaveSlot && options.saveEnabled !== false ? () => options.onSaveSlot?.(slot.slot) : undefined,
      disabled: options.saveEnabled === false,
    })),
    hint: options.saveEnabled === false
      ? "지금은 저장할 수 없습니다."
      : options.confirmSaveSlot
        ? "이미 저장된 칸입니다. 같은 슬롯을 다시 선택하면 덮어씁니다."
        : "저장할 슬롯을 선택하세요.",
  };
}

function loadDetail(slots: readonly SaveSlotReadResult[], onLoadSlot: ((slot: SaveSlotIndex) => void) | undefined): StatusMenuDetail {
  return {
    title: "로드",
    entries: slots.map((slot) => ({
      label: `${slot.slot}번 저장`,
      ...saveSlotEntryParts(slot, false),
      testId: `load-slot-${slot.slot}`,
      onActivate: onLoadSlot && slot.kind === "present" ? () => onLoadSlot(slot.slot) : undefined,
      disabled: slot.kind !== "present",
    })),
    hint: "불러올 저장 칸을 선택하세요.",
  };
}

function statusDetail(project: Project, session: PlaySession): StatusMenuDetail {
  const entries = partyActors(project, session).map((actor) => {
    const vitals = session.actorVitals[actor.id];
    const className = classNameFor(project, session, actor);
    const level = actorLevel(session, actor);
    return {
      label: actor.name,
      value: `${className} L${level}`,
      // 구분자를 "/" 로 쓰면 HP 510/514 의 분수 슬래시와 뒤섞여 어디까지가 한 항목인지
      // 읽히지 않는다. 가운뎃점으로 갈라 분수 슬래시만 슬래시로 남긴다.
      description: vitals
        ? `HP ${vitals.hp}/${vitals.maxHp} · MP ${vitals.mp}/${vitals.maxMp} · 정상`
        : "HP 0/0 · MP 0/0 · 정상",
    };
  });
  return { title: "상태", entries, emptyLabel: "상태를 볼 파티원이 없습니다" };
}

function rowDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const entries = partyActors(options.project, options.session).map((actor) => ({
    label: actor.name,
    value: (options.session.actorRows[actor.id] ?? "front") === "front" ? "전열" : "후열",
    description: "선택하면 전열/후열을 전환합니다",
    testId: `status-menu-row-${actor.id}`,
    onActivate: options.onToggleRow ? () => options.onToggleRow?.(actor.id) : undefined,
  }));
  return { title: "열 바꾸기", entries, emptyLabel: "열을 바꿀 파티원이 없습니다" };
}

function monsterDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const view = options.monsterView ?? "party";
  const ids = view === "party" ? options.session.monsterParty : options.session.monsterBox;
  const entries = [
    {
      label: view === "party" ? "보관함 보기" : "파티 보기",
      value: view === "party" ? `${options.session.monsterBox.length}마리` : `${options.session.monsterParty.length}/${MONSTER_PARTY_MAX}`,
      description: "선택하면 목록을 전환합니다",
      testId: "status-menu-monster-toggle",
      onActivate: options.onToggleMonsterView,
    },
    ...ids.flatMap((instanceId) => {
      const instance = options.session.monsterInstances[instanceId];
      if (!instance) return [];
      const maxHp = monsterMaxHp(options.project, instance);
      const hp = monsterCurrentHp(options.project, instance);
      return [
        {
          label: monsterDisplayName(options.project, instance),
          value: `Lv.${instance.level}  HP ${hp}/${maxHp}`,
          description: "선택하면 현재 능력·기술·PP를 봅니다",
          testId: `status-menu-monster-${instanceId}`,
          onActivate: options.onSelectMonster ? () => options.onSelectMonster?.(instanceId) : undefined,
        },
        ...(instance.pendingSkillIds ?? []).flatMap((pendingSkillId) => {
          const pending = options.project.database.skills.find((skill) => skill.id === pendingSkillId);
          return [
            ...(instance.skillIds ?? []).map((replacedSkillId) => {
              const replaced = options.project.database.skills.find((skill) => skill.id === replacedSkillId);
              return {
                label: `${replaced?.name ?? replacedSkillId} → ${pending?.name ?? pendingSkillId}`,
                value: "기술 교체",
                description: "기존 기술을 잊고 새 기술을 배웁니다",
                testId: `status-menu-monster-skill-replace-${instanceId}-${pendingSkillId}-${replacedSkillId}`,
                onActivate: options.onReplacePendingMonsterSkill
                  ? () => options.onReplacePendingMonsterSkill?.(instanceId, pendingSkillId, replacedSkillId)
                  : undefined,
              };
            }),
            {
              label: `${pending?.name ?? pendingSkillId} 포기`,
              value: "배우지 않음",
              description: "대기 중인 새 기술을 포기합니다",
              testId: `status-menu-monster-skill-reject-${instanceId}-${pendingSkillId}`,
              onActivate: options.onRejectPendingMonsterSkill
                ? () => options.onRejectPendingMonsterSkill?.(instanceId, pendingSkillId)
                : undefined,
            },
          ];
        }),
      ];
    }),
  ];
  const detail = monsterInstanceDetail(options, entries.filter(entry => entry.testId?.startsWith(`status-menu-monster-skill-`) && entry.testId.includes(`-${options.monsterInstanceId}-`)));
  if (detail) return detail;
  if (isEmeraldMonsterStyle(options.project) && view === "party") {
    const slots: StatusMenuDetailEntry[] = Array.from({ length: MONSTER_PARTY_MAX }, (_, index) => {
      const raw = options.session.monsterInstances[ids[index] ?? ""];
      if (!raw) return { label: "—", value: "", attributes: { partySlot: String(index), partyEmpty: "true", partyFainted: "false" }, disabled: true };
      const member = monsterUiEntry(options.project, raw);
      return { label: `${member.name} Lv.${raw.level}`, value: `Lv.${raw.level}`, description: member.stateNames.join(" · ") || "정상",
        testId: `status-menu-monster-${raw.instanceId}`,
        attributes: { partySlot: String(index), partyFainted: String(member.hp <= 0), monsterHp: String(member.hp), monsterMaxHp: String(member.maxHp) },
        vitals: { hp: member.hp, maxHp: member.maxHp, hpAfter: member.hp, mp: 0, maxMp: 0, mpAfter: 0, stateNames: member.stateNames },
        face: { resourceId: monsterMenuIconResourceId(options.project, member.species?.graphic.monsterResourceId), alt: member.name, testId: `status-menu-monster-art-${raw.instanceId}` },
        onActivate: () => options.onSelectMonster?.(raw.instanceId) };
    });
    return { title: "동료", layout: "campaign-party", entries: [...slots, entries[0]!], hint: "동료를 선택하세요. Enter 요약 · Esc 돌아가기" };
  }
  return {
    title: view === "party" ? "몬스터: 파티" : "몬스터: 보관함",
    entries,
    emptyLabel: "몬스터가 없습니다",
    hint: view === "party" ? `파티 ${options.session.monsterParty.length}/${MONSTER_PARTY_MAX}` : `보관함 ${options.session.monsterBox.length}마리`,
  };
}

function questsDetail(project: Project, session: PlaySession): StatusMenuDetail {
  const quests = buildQuestLog(project, session);
  return {
    title: "임무",
    entries: quests.flatMap((quest) => [
      {
        label: quest.title,
        value: quest.summary,
        description: "임무 요약",
        testId: `status-menu-quest-${quest.key}`,
        attributes: { "data-quest-row": "summary" },
      },
      {
        label: "진행",
        value: `${questStateLabel(quest.state)} (${quest.completedSteps}/${quest.totalSteps})`,
        description: "완료한 단계 / 전체 단계",
        testId: `status-menu-quest-state-${quest.key}`,
        attributes: { "data-quest-row": "state" },
      },
      ...quest.steps.map((step) => ({
        label: `${step.index + 1}. ${step.done ? "완료" : "진행"}`,
        value: step.label,
        description: step.done ? "완료됨" : "대기 중",
        testId: `status-menu-quest-step-${quest.key}-${step.index}`,
        attributes: { "data-quest-row": "step" },
      })),
    ]),
    emptyLabel: "등록된 임무가 없습니다",
    hint: "↑↓로 임무 목록을 읽습니다. ← 메뉴로 돌아갑니다.",
  };
}

function galleryDetail(project: Project, session: PlaySession): StatusMenuDetail {
  const label = galleryMenuLabel(project);
  const unlocks = listGalleryUnlocks(session);
  return {
    title: label,
    layout: "gallery",
    entries: unlocks.map((resourceId, index) => {
      const name = resourceDisplayName(resourceId, `그림 ${index + 1}`);
      return {
        label: name,
        value: String(index + 1),
        testId: `status-menu-gallery-${index}`,
        icon: {
          resourceId,
          alt: name,
          testId: `status-menu-gallery-thumb-${index}`,
          smooth: true,
        },
        onActivate: () => openGalleryViewer({ project, resourceIds: unlocks, index }),
      };
    }),
    emptyLabel: "아직 열린 그림이 없습니다.",
    hint: "결정 키로 화면 가득 봅니다. 연 뒤 좌우로 넘깁니다.",
  };
}

function relationshipsDetail(project: Project, session: PlaySession): StatusMenuDetail {
  const entries = listFriendshipEntries(session.friendship, undefined, undefined, project).map((entry) => ({
    label: entry.displayName ?? entry.key,
    value: entry.secondary,
    description: entry.label,
    testId: `status-menu-relationship-${entry.key}`,
  }));
  return {
    title: "관계",
    entries,
    emptyLabel: "알려진 관계가 없습니다.",
    hint: "호감이 기록된 관계만 표시됩니다.",
  };
}

function waitDetail(waitModeEnabled: boolean): StatusMenuDetail {
  return {
    title: "전투 대기",
    entries: [{
      label: "현재 설정",
      value: waitModeEnabled ? "ON" : "OFF",
      // 무엇에 영향을 주는지 안 적혀 있어서 켜도 끄도 뭐가 달라지는지 알 수 없었다.
      // 상세 패널이 좁아 3줄에서 잘린다 — 턴제 전투 전제는 제목("전투 대기")이 이미 말해준다.
      description: waitModeEnabled
        ? "명령 입력 중 시간이 멈춥니다."
        : "명령 입력 중에도 시간이 흐릅니다.",
    }],
  };
}

function partyActors(project: Project, session: PlaySession): readonly ActorRecord[] {
  const actorsById = new Map(project.database.actors.map((actor) => [actor.id, actor]));
  return session.partyActorIds.flatMap((actorId): ActorRecord[] => {
    const actor = actorsById.get(actorId);
    if (!actor) return [];
    const name = resolveActorName(session, actor);
    return [name === actor.name ? actor : { ...actor, name }];
  });
}

function learnedSkills(project: Project, session: PlaySession, actor: ActorRecord): readonly SkillRecord[] {
  const skillIds = new Set(actorOwnedSkillIds(project, session, actor.id));
  return project.database.skills.filter((skill) => skillIds.has(skill.id));
}

function actorLevel(session: PlaySession, actor: ActorRecord): number {
  return session.actorLevels[actor.id] ?? actor.initialLevel;
}

function classNameFor(project: Project, session: PlaySession, actor: ActorRecord): string {
  const classId = effectiveActorClassId(project, session, actor.id);
  return project.database.classes.find((record) => record.id === classId)?.name ?? "직업 없음";
}

function actorEquipment(project: Project, session: PlaySession, actor: ActorRecord): ActorInitialEquipment {
  return effectiveActorEquipment(project, actor, session.actorEquipment[actor.id], effectiveActorClassId(project, session, actor.id));
}

function equipmentStats(project: Project, equipmentId: string | undefined): EquipmentStatBonuses {
  return project.database.equipment.find((record) => record.id === equipmentId)?.statBonuses ?? zeroStats();
}

function equipmentName(equipmentById: ReadonlyMap<string, EquipmentRecord>, equipmentId: string | undefined): string {
  if (!equipmentId) return "없음";
  return equipmentById.get(equipmentId)?.name ?? "없음";
}

// 데이터베이스가 이미 저작해 둔 아이콘을 목록 행에 그린다 — 에디터의
// databaseRecordThumbnails 와 같은 해석 우선순위(iconResourceId → imageResourceId)를 쓴다.
// 이전에는 iconResourceId 가 src/player 어디에서도 읽히지 않아 목록이 전부 글자만 났다.
function itemFacts(project: Project, session: PlaySession, item: ItemRecord): readonly StatusMenuDetailFact[] {
  const usesPerCopy = item.consumptionLimit === "noLimit" ? 1 : item.consumptionLimit;
  const remainingCopyUses = usesPerCopy - (session.itemUseCharges?.[item.id] ?? 0);
  // Match menu dispatch precedence, not scope left over from a previous type.
  const scope = item.careProfile || targetsPartyMonsters(project, item) ? "partyMonster"
    : item.learnedSkillId || Object.values(item.seedParameterBonuses).some((delta) => delta !== 0) ? "ally"
    : item.type === "switch" ? "none"
    : item.captureProfile ? "enemy"
    : item.scope;
  return [
    { id: "type", value: item.type },
    { id: "effects", value: itemEffectTokens(project, item).join(",") },
    {
      id: "eligibility", value: itemEligibilityFact(item),
      targeting: { scope, deadOnly: item.onlyEffectiveOnDeadActors },
      consumption: item.consumable
        ? { consumable: true, usesPerCopy, remainingCopyUses,
          remainingUses: remainingCopyUses + ((session.inventory[item.id] ?? 0) - 1) * usesPerCopy }
        : { consumable: false },
    },
  ];
}

function itemEligibilityFact(item: ItemRecord): string {
  if (item.occasion === "battle") return "battle";
  if (item.occasion === "never" || !itemAllowsMenu(item)) return "unusable";
  if ((item.type === "medicine" || item.type === "book" || item.type === "seed")
    && (item.usableActorIds.length > 0 || item.usableClassIds.length > 0)) return "restricted";
  return "usable";
}

function itemEffectTokens(project: Project, item: ItemRecord): string[] {
  const tokens: string[] = [];
  if (item.hpRecovery.flat > 0) tokens.push(`hp:${item.hpRecovery.flat}`);
  if (item.hpRecovery.percentMax > 0) tokens.push(`hp%:${item.hpRecovery.percentMax}`);
  if (item.mpRecovery.flat > 0) tokens.push(`mp:${item.mpRecovery.flat}`);
  if (item.mpRecovery.percentMax > 0) tokens.push(`mp%:${item.mpRecovery.percentMax}`);
  if (item.ppRecovery?.flat && item.ppRecovery.flat > 0) tokens.push(`pp:${item.ppRecovery.flat}`);
  if (item.ppRecovery?.percentMax && item.ppRecovery.percentMax > 0) tokens.push(`pp%:${item.ppRecovery.percentMax}`);
  const healedStateIds = new Set(item.healStateIds);
  for (const stateId of healedStateIds) tokens.push(`heal:${encodeURIComponent(stateId)}`);
  for (const effect of item.stateEffects) {
    if (effect.operation === "remove") {
      if (healedStateIds.has(effect.stateId)) continue;
      healedStateIds.add(effect.stateId);
      tokens.push(`heal:${encodeURIComponent(effect.stateId)}`);
    } else if (effect.chance > 0 && project.database.states.some((state) => state.id === effect.stateId)) {
      tokens.push(`state:${encodeURIComponent(effect.stateId)}:${effect.chance}`);
    }
  }
  if (item.learnedSkillId) tokens.push(`learn:${encodeURIComponent(item.learnedSkillId)}`);
  if (item.activateSkillId) tokens.push(`skill:${encodeURIComponent(item.activateSkillId)}`);
  if (item.switchId) tokens.push(`switch:${encodeURIComponent(item.switchId)}`);
  if (item.careProfile) tokens.push(`care:${item.careProfile.kind}:${item.careProfile.friendshipDelta}:${item.careProfile.expDelta ?? 0}`);
  if (item.captureProfile) {
    tokens.push(project.system.battleModel === "gen1"
      ? `capture-class:${item.captureProfile.ballClass ?? "poke"}`
      : `capture:${item.captureProfile.multiplier}`);
  }
  for (const [key] of STAT_LABELS) {
    const delta = item.seedParameterBonuses[key];
    if (delta !== 0) tokens.push(`seed:${key}:${delta}`);
  }
  return tokens.length > 0 ? tokens : ["none"];
}

function itemEntryIcon(item: ItemRecord): NonNullable<StatusMenuDetailEntry["icon"]> {
  return {
    resourceId: item.iconResourceId ?? item.imageResourceId,
    alt: item.name,
    testId: `status-menu-entry-icon-item-${item.id}`,
  };
}

function equipmentEntryIcon(equipment: EquipmentRecord | undefined): NonNullable<StatusMenuDetailEntry["icon"]> | undefined {
  if (!equipment) return undefined;
  return {
    resourceId: equipment.iconResourceId ?? equipment.imageResourceId,
    alt: equipment.name,
    testId: `status-menu-entry-icon-equipment-${equipment.id}`,
  };
}

// 스킬은 애니메이션 시트의 첫 셀을 썸네일로 쓴다. 시트 전체를 축소하지 않도록 규격도 넘긴다.
function skillEntryIcon(project: Project, skill: SkillRecord): NonNullable<StatusMenuDetailEntry["icon"]> {
  const animation = skill.animationId
    ? project.database.battleAnimations.find((entry) => entry.id === skill.animationId)
    : undefined;
  return {
    resourceId: animation?.resourceId,
    sheet: animation ? animation.sheet ?? { frameWidth: 96, frameHeight: 96, columns: 5 } : undefined,
    alt: skill.name,
    testId: `status-menu-entry-icon-skill-${skill.id}`,
  };
}

// 메타가 길면 value(우측 1줄)가 아니라 description(전폭 2줄) 행으로 내려 라벨과 겹치지 않게 한다.
function saveSlotEntryParts(
  slot: SaveSlotReadResult,
  confirmingOverwrite: boolean
): { value: string; description?: string } {
  switch (slot.kind) {
    case "empty": return { value: "비어 있음" };
    case "corrupt": return { value: "손상됨" };
    case "present": {
      const parts = [slot.snapshot.projectTitle];
      if (typeof slot.snapshot.partyLevel === "number") parts.push(`L${slot.snapshot.partyLevel}`);
      if (slot.snapshot.mapName) parts.push(slot.snapshot.mapName);
      if (typeof slot.snapshot.playTimeSeconds === "number") parts.push(formatPlayTime(slot.snapshot.playTimeSeconds));
      return {
        value: confirmingOverwrite ? "덮어쓰기 확인" : "저장됨",
        description: parts.join(" / "),
      };
    }
    default: return assertNever(slot);
  }
}


function skillKindLabel(skill: SkillRecord): string {
  switch (skill.effect.kind) {
    case "damage": return "공격";
    case "healing": return "회복";
    case "support": return "보조";
    case "switch": return "스위치";
    case "steal": return "훔치기";
    case "scan": return "탐색";
    case "learnEnemySkill": return "습득";
    case "randomSkillFrom": return "무작위";
    default: return assertNever(skill.effect);
  }
}

function statDiffLine(next: EquipmentStatBonuses, current: EquipmentStatBonuses): string {
  return STAT_LABELS.map(([key, label]) => `${label} ${signed(next[key] - current[key])}`).join(" / ");
}

/** 기본 능력치(레벨 곡선) + 전 부위 장비 보너스 합계. 한 부위만 후보로 갈아끼워 비교한다.
    장비 보너스 증감만 보여주면 "방어 +7" 이 큰 건지 작은 건지 판단할 기준이 없다. */
function actorStatTotal(
  options: StatusMenuDetailOptions,
  actor: ActorRecord,
  statKey: keyof EquipmentStatBonuses,
  slotId: keyof ActorInitialEquipment,
  candidateId: string | undefined
): number {
  const { project, session } = options;
  const level = session.actorLevels[actor.id] ?? actor.initialLevel;
  const worn: ActorInitialEquipment = { ...actorEquipment(project, session, actor), [slotId]: candidateId };
  return actorDerivedStats(project, normalizeActorRecord(actor), {
    level, classOverrides: session.classOverrides, promotionLineage: session.promotionLineage,
    growthProgress: session.growthProgress, paramBonuses: session.actorParamBonuses?.[actor.id],
    equipment: effectiveActorEquipment(project, actor, worn, effectiveActorClassId(project, session, actor.id)),
  })[statKey];
}

function equipmentStatDelta(
  options: StatusMenuDetailOptions,
  actor: ActorRecord,
  slotId: keyof ActorInitialEquipment,
  candidateId: string | undefined
): readonly StatusMenuStatDelta[] {
  const currentId = actorEquipment(options.project, options.session, actor)[slotId];
  return STAT_LABELS.map(([key, label]) => ({
    label,
    current: actorStatTotal(options, actor, key, slotId, currentId),
    next: actorStatTotal(options, actor, key, slotId, candidateId),
  }));
}

/** 증감 요약 — 절대값이 큰 순서로 둘. 변화가 없으면 「변화 없음」. */
function deltaChips(deltas: readonly StatusMenuStatDelta[]): string {
  const chips = deltas
    .map((delta) => ({ label: delta.label, diff: delta.next - delta.current }))
    .filter((chip) => chip.diff !== 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 2)
    .map((chip) => `${chip.label}${chip.diff > 0 ? "+" : "−"}${Math.abs(chip.diff)}`);
  return chips.length ? chips.join(" ") : "변화 없음";
}

export type BestEquipmentPlan = {
  readonly swap: ActorInitialEquipment;
  readonly gain: number;
  readonly changes: readonly { readonly slotId: string; readonly slotLabel: string; readonly fromName: string; readonly toName: string; readonly equipmentId?: string }[];
  readonly statDelta: readonly StatusMenuStatDelta[];
};

/**
 * 「최강 장비」 — 부위마다 (지금 장비 + 가방 속 장착 가능 후보) 중 네 능력치 합이 가장 높은 것을 고른다.
 * 앞 부위의 선택을 누적한 상태에서 다음 부위를 본다(두손 무기·쌍수 판정은 actorDerivedStats·transition 이 맡는다).
 * 저주·고정 장비가 끼어 있으면 그 부위는 건너뛴다 — 실제 적용(transitionActorEquipment)이 거부할 조합을 권하지 않는다.
 */
export function bestEquipmentPlan(options: Pick<StatusMenuDetailOptions, "project" | "session">, actor: ActorRecord): BestEquipmentPlan | undefined {
  const { project, session } = options;
  const classId = effectiveActorClassId(project, session, actor.id);
  const classRecord = project.database.classes.find((record) => record.id === classId);
  if (actor.options.fixedEquipment || classRecord?.options.fixedEquipment) return undefined;
  const byId = new Map(project.database.equipment.map((record) => [record.id, record]));
  const current = actorEquipment(project, session, actor);
  const stats = (worn: ActorInitialEquipment) => {
    const level = session.actorLevels[actor.id] ?? actor.initialLevel;
    return actorDerivedStats(project, normalizeActorRecord(actor), {
      level, classOverrides: session.classOverrides, promotionLineage: session.promotionLineage,
      growthProgress: session.growthProgress, paramBonuses: session.actorParamBonuses?.[actor.id],
      equipment: effectiveActorEquipment(project, actor, worn, classId),
    });
  };
  const score = (worn: ActorInitialEquipment) => { const s = stats(worn); return s.attack + s.defense + s.mind + s.agility; };
  const swap: ActorInitialEquipment = { ...current };
  const used = new Map<string, number>();
  for (const slot of equipmentSlots(project)) {
    const slotId = slot.id as keyof ActorInitialEquipment;
    const wornId = swap[slotId];
    const worn = wornId ? byId.get(wornId) : undefined;
    if (worn?.cursed || worn?.effectFlags.fixedEquipment) continue;
    // 두손 무기가 방패 칸을 비추는 거울이면 방패 칸은 무기가 정한다.
    if (slotId === "shield" && swap.weapon && byId.get(swap.weapon)?.twoHanded) continue;
    const candidates = project.database.equipment.filter((record) =>
      equipmentSlotAccepts(project, actor, slotId, record, classId)
      && canEquip(project, actor, record, classId)
      && (session.inventory[record.id] ?? 0) - (used.get(record.id) ?? 0) > 0
      && !(record.twoHanded && slotId !== "weapon"));
    let bestId = wornId, bestScore = score(swap);
    for (const record of candidates) {
      const trial: ActorInitialEquipment = { ...swap, [slotId]: record.id };
      if (record.twoHanded) trial.shield = record.id;
      const value = score(trial);
      if (value > bestScore) { bestScore = value; bestId = record.id; }
    }
    if (bestId !== wornId && bestId) {
      swap[slotId] = bestId;
      if (byId.get(bestId)?.twoHanded) swap.shield = bestId;
      used.set(bestId, (used.get(bestId) ?? 0) + 1);
    }
  }
  const before = stats(current), after = stats(swap);
  const changes = equipmentSlots(project)
    .filter((slot) => swap[slot.id] !== current[slot.id] && !(slot.id === "shield" && swap.weapon && swap.shield === swap.weapon))
    .map((slot) => ({
      slotId: slot.id,
      slotLabel: slot.label,
      fromName: equipmentName(byId, current[slot.id]),
      toName: equipmentName(byId, swap[slot.id]),
      equipmentId: swap[slot.id],
    }));
  return {
    swap,
    gain: score(swap) - score(current),
    changes,
    statDelta: STAT_LABELS.map(([key, label]) => ({ label, current: before[key], next: after[key] })),
  };
}

function equipmentDetailLine(equipment: EquipmentRecord, currentStats: EquipmentStatBonuses): string {
  return [
    equipment.description || "장비",
    statDiffLine(equipment.statBonuses, currentStats),
    ...equipmentEffectLabels(equipment),
  ].join(" / ");
}

function equipmentEffectLabels(equipment: EquipmentRecord): string[] {
  const labels: string[] = [];
  if (equipment.effectFlags.doubleAttack) labels.push("더블어택");
  if (equipment.elementalDefenseIds.length > 0) labels.push(`속성 방어 ${equipment.elementalDefenseIds.length}`);
  if (equipment.stateDefenseIds.length > 0 && equipment.stateDefenseMode === "resist") labels.push(`상태 방어 ${equipment.stateResistanceChance}%`);
  return labels;
}

function zeroStats(): EquipmentStatBonuses {
  return { attack: 0, defense: 0, mind: 0, agility: 0 };
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function formatPlayTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled status menu detail: ${String(value)}`);
}
