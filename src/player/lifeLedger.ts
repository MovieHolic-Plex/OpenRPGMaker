import { FARMING_LIFE_UI_ASSETS } from "@/assets/farmingLifeUi";
import { contributeBundle } from "@/project/bundles";
import { collectionProgress } from "@/project/collections";
import { collectFarmAnimalProduct, feedFarmAnimal, petFarmAnimal } from "@/project/farmAnimals";
import { calendarDayKey } from "@/project/gameTime";
import { absoluteGameMinutes, collectMaker, startMaker } from "@/project/makers";
import { donateMuseumItem } from "@/project/museum";
import { depositShipping, withdrawShipping } from "@/project/shipping";
import { resolveSellPrice } from "@/project/upgrades";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";
import { orientedFootprint } from "@/project/spatialPlacements";
import { rotateHomeDecoration, upgradeFarmBuilding } from "@/project/spatialPlacementTransactions";
import type { StatusMenuDetail, StatusMenuDetailEntry } from "@/player/playerStatusMenuDetailTypes";

export const LIFE_LEDGER_TAB_IDS = ["shipping", "bundles", "skills", "makers", "animals", "spaces", "collections", "museum"] as const;
export type LifeLedgerTabId = (typeof LIFE_LEDGER_TAB_IDS)[number];
const BASE_LIFE_LEDGER_TAB_IDS: readonly LifeLedgerTabId[] = ["shipping", "bundles", "skills", "makers", "animals"];

const TAB_LABELS: Readonly<Record<LifeLedgerTabId, string>> = {
  shipping: "출하",
  bundles: "꾸러미",
  skills: "기술",
  makers: "가공 설비",
  animals: "동물 돌봄",
  spaces: "건물·꾸미기",
  collections: "수집 도감",
  museum: "박물관",
};

const TAB_ART: Readonly<Record<LifeLedgerTabId, string>> = {
  shipping: FARMING_LIFE_UI_ASSETS.buildings,
  bundles: FARMING_LIFE_UI_ASSETS.bundles,
  skills: FARMING_LIFE_UI_ASSETS.fishing,
  makers: FARMING_LIFE_UI_ASSETS.makers,
  animals: FARMING_LIFE_UI_ASSETS.animals,
  spaces: FARMING_LIFE_UI_ASSETS.decorating,
  collections: FARMING_LIFE_UI_ASSETS.foraging,
  museum: FARMING_LIFE_UI_ASSETS.museum,
};

export function hasLifeLedgerData(project: Project): boolean {
  return project.system.shipping?.enabled === true
    || (project.system.bundles?.length ?? 0) > 0
    || (project.system.skillSystem?.enabled === true && (project.database.lifeSkills?.length ?? 0) > 0)
    || (project.system.makers?.length ?? 0) > 0
    || (project.database.farmAnimalSpecies?.length ?? 0) > 0
    || (project.system.farmAnimalBuildings?.length ?? 0) > 0
    || (project.session.farmAnimals?.length ?? 0) > 0
    || (project.database.farmBuildingTypes?.length ?? 0) > 0
    || (project.database.homeDecorationTypes?.length ?? 0) > 0
    || (project.session.farmBuildingPlacements?.length ?? 0) > 0
    || (project.session.homeDecorationPlacements?.length ?? 0) > 0
    || project.system.fishing?.enabled === true
    || project.system.seasonalForage?.enabled === true
    || project.system.collections?.enabled === true
    || project.system.museum?.enabled === true;
}

export function createLifeLedgerDetail(options: {
  readonly project: Project;
  readonly session: PlaySession;
  readonly tab?: LifeLedgerTabId;
  readonly onSelectTab?: (tab: LifeLedgerTabId) => void;
  readonly onMutation?: (ok: boolean, message: string) => void;
}): StatusMenuDetail {
  const tab = options.tab ?? "shipping";
  const content = tabContent(options.project, options.session, tab, options.onMutation);
  const availableTabs = availableLifeLedgerTabs(options.project);
  return {
    title: "생활 장부",
    artwork: { src: TAB_ART[tab], alt: `${TAB_LABELS[tab]} 생활 장부 삽화` },
    tabs: availableTabs.map((id) => ({
      id,
      label: TAB_LABELS[id],
      selected: id === tab,
      testId: `life-ledger-tab-${id}`,
      onActivate: options.onSelectTab ? () => options.onSelectTab?.(id) : undefined,
    })),
    entries: content.entries,
    emptyLabel: content.emptyLabel,
    hint: "방향키로 이동하고 확인 키 또는 포인터로 선택하세요.",
  };
}

function tabContent(
  project: Project,
  session: PlaySession,
  tab: LifeLedgerTabId,
  onMutation?: (ok: boolean, message: string) => void,
): { readonly entries: readonly StatusMenuDetailEntry[]; readonly emptyLabel: string } {
  switch (tab) {
    case "shipping": return shippingEntries(project, session, onMutation);
    case "bundles": return bundleEntries(project, session, onMutation);
    case "skills": return skillEntries(project, session);
    case "makers": return makerEntries(project, session, onMutation);
    case "animals": return animalEntries(project, session, onMutation);
    case "spaces": return spatialEntries(project, session, onMutation);
    case "collections": return collectionEntries(project, session);
    case "museum": return museumEntries(project, session, onMutation);
  }
}

function availableLifeLedgerTabs(project: Project): readonly LifeLedgerTabId[] {
  const tabs: LifeLedgerTabId[] = [...BASE_LIFE_LEDGER_TAB_IDS];
  if ((project.database.farmBuildingTypes?.length ?? 0) > 0
    || (project.database.homeDecorationTypes?.length ?? 0) > 0
    || (project.session.farmBuildingPlacements?.length ?? 0) > 0
    || (project.session.homeDecorationPlacements?.length ?? 0) > 0) {
    tabs.push("spaces");
  }
  if (project.system.collections?.enabled || project.system.fishing?.enabled || project.system.seasonalForage?.enabled) {
    tabs.push("collections");
  }
  if (project.system.museum?.enabled) tabs.push("museum");
  return tabs;
}


function spatialEntries(
  project: Project,
  session: PlaySession,
  onMutation?: (ok: boolean, message: string) => void,
): { entries: StatusMenuDetailEntry[]; emptyLabel: string } {
  const entries: StatusMenuDetailEntry[] = [];
  for (const placement of Object.values(session.farmBuildingPlacements ?? {})) {
    const type = project.database.farmBuildingTypes?.find((candidate) => candidate.id === placement.typeId);
    const level = type?.levels.find((candidate) => candidate.level === placement.level);
    const map = project.maps[placement.mapId];
    entries.push({
      label: type?.name ?? `${placement.typeId} (삭제된 유형)`,
      value: level ? `Lv.${placement.level} · 수용량 ${level.capacity}` : `Lv.${placement.level}`,
      description: `${map?.name ?? placement.mapId} (${placement.x}, ${placement.y}) · ${orientationLabel(placement.orientation)}`,
      testId: `life-ledger-space-building-${placement.instanceId}`,
      disabled: true,
    });
    const nextLevel = type?.levels.find((candidate) => candidate.level === placement.level + 1);
    if (nextLevel) {
      entries.push({
        label: `${type?.name ?? placement.typeId} 업그레이드`,
        value: `Lv.${nextLevel.level} · 수용량 ${nextLevel.capacity}`,
        description: spatialCostLabel(project, nextLevel.cost),
        testId: `life-ledger-space-building-upgrade-${placement.instanceId}`,
        disabled: false,
        onActivate: () => notify(
          onMutation,
          upgradeFarmBuilding(project, session, placement.instanceId),
          `${type?.name ?? placement.typeId}을(를) 업그레이드했습니다`,
        ),
      });
    }
  }
  for (const placement of Object.values(session.homeDecorationPlacements ?? {})) {
    const type = project.database.homeDecorationTypes?.find((candidate) => candidate.id === placement.typeId);
    const map = project.maps[placement.mapId];
    const footprint = type ? orientedFootprint(type.footprint, placement.orientation) : undefined;
    entries.push({
      label: type?.name ?? `${placement.typeId} (삭제된 유형)`,
      value: `${orientationLabel(placement.orientation)}${footprint ? ` · ${footprint.width}×${footprint.height}` : ""}`,
      description: `${map?.name ?? placement.mapId} (${placement.x}, ${placement.y})`,
      testId: `life-ledger-space-decoration-${placement.instanceId}`,
      disabled: true,
    });
    if (type && type.allowedOrientations.length > 1) {
      const currentIndex = type.allowedOrientations.indexOf(placement.orientation);
      const nextOrientation = type.allowedOrientations[(currentIndex + 1) % type.allowedOrientations.length] ?? type.allowedOrientations[0]!;
      entries.push({
        label: `${type.name} 회전`,
        value: `${orientationLabel(nextOrientation)}으로 돌리기`,
        testId: `life-ledger-space-decoration-rotate-${placement.instanceId}`,
        disabled: false,
        onActivate: () => notify(
          onMutation,
          rotateHomeDecoration(project, session, placement.instanceId, nextOrientation),
          `${type.name}을(를) 회전했습니다`,
        ),
      });
    }
  }
  return { entries, emptyLabel: "배치된 범용 건물이나 집 장식이 없습니다" };
}

function spatialCostLabel(project: Project, cost: import("@/project/types").SpatialPlacementCost | undefined): string {
  if (!cost) return "추가 비용 없음";
  const parts = [
    ...(cost.gold ? [`${cost.gold}G`] : []),
    ...(cost.items ?? []).map((item) => `${itemName(project, item.itemId)} ${item.count}개`),
  ];
  return parts.join(" · ") || "추가 비용 없음";
}

function orientationLabel(value: import("@/project/types").Dir): string {
  return ({ down: "아래", left: "왼쪽", right: "오른쪽", up: "위" } as const)[value];
}

function collectionEntries(
  project: Project,
  session: PlaySession,
): { entries: StatusMenuDetailEntry[]; emptyLabel: string } {
  const entries = collectionItemIds(project, session).map((itemId): StatusMenuDetailEntry => {
    const item = project.database.items.find((candidate) => candidate.id === itemId);
    const progress = collectionProgress(session, itemId);
    return {
      label: item?.name ?? `${itemId} (삭제된 항목)`,
      value: progress?.discovered ? "발견" : "미발견",
      description: `출하 ${progress?.shippedCount ?? 0} · 낚시 ${progress?.caughtCount ?? 0} · 기부 ${progress?.donated ? "완료" : "미완료"}`,
      testId: `life-ledger-collection-${itemId}`,
      disabled: true,
    };
  });
  return { entries, emptyLabel: "수집 도감에 등록된 항목이 없습니다" };
}


function museumEntries(
  project: Project,
  session: PlaySession,
  onMutation?: (ok: boolean, message: string) => void,
): { entries: StatusMenuDetailEntry[]; emptyLabel: string } {
  const entries = (project.system.museum?.eligibleItemIds ?? []).map((itemId): StatusMenuDetailEntry => {
    const item = project.database.items.find((candidate) => candidate.id === itemId);
    const progress = collectionProgress(session, itemId);
    const donated = progress?.donated === true;
    const inventory = session.inventory[itemId] ?? 0;
    return {
      label: item?.name ?? `${itemId} (삭제된 항목)`,
      value: donated ? "기부 완료" : `보유 ${inventory} · 1개 기부`,
      description: donated ? "박물관 수집에 등록됨" : "새로운 보상 조건이 충족되면 즉시 지급됩니다",
      testId: `life-ledger-museum-donate-${itemId}`,
      disabled: !item || donated || inventory < 1,
      onActivate: item ? () => notify(
        onMutation,
        donateMuseumItem(project, session, itemId),
        `${item.name}을(를) 박물관에 기부했습니다`,
      ) : undefined,
    };
  });
  return { entries, emptyLabel: "박물관에 기부할 항목이 없습니다" };
}

function collectionItemIds(project: Project, session: PlaySession): readonly string[] {
  const ids = new Set(project.system.collections?.trackedItemIds ?? []);
  for (const fish of project.database.fishSpecies ?? []) ids.add(fish.itemId);
  for (const area of project.system.seasonalForage?.areas ?? []) {
    for (const entry of area.entries) {
      if (entry.itemId) ids.add(entry.itemId);
      for (const itemId of Object.values(entry.seasonalDrops ?? {})) if (itemId) ids.add(itemId);
    }
  }
  for (const itemId of project.system.museum?.eligibleItemIds ?? []) ids.add(itemId);
  for (const itemId of Object.keys(session.collections ?? {})) ids.add(itemId);
  return [...ids].sort();
}

function animalEntries(
  project: Project,
  session: PlaySession,
  onMutation?: (ok: boolean, message: string) => void,
): { entries: StatusMenuDetailEntry[]; emptyLabel: string } {
  const entries: StatusMenuDetailEntry[] = [];
  const dayKey = session.gameTime ? calendarDayKey(session.gameTime) : undefined;
  for (const animal of Object.values(session.farmAnimals ?? {})) {
    const species = project.database.farmAnimalSpecies?.find((candidate) => candidate.id === animal.speciesId);
    const building = project.system.farmAnimalBuildings?.find((candidate) => candidate.id === animal.buildingId);
    const progressTarget = species?.productEveryDays ?? "?";
    entries.push({
      label: animal.name,
      value: `${species?.name ?? `${animal.speciesId} (삭제된 종)`} · ${building?.name ?? "집 미배정"}`,
      description: `친밀도 ${animal.friendship}/1000 · 생산 ${animal.productionProgress}/${progressTarget} · 받을 물품 ${animal.readyProductCount}`,
      testId: `life-ledger-animal-summary-${animal.instanceId}`,
      disabled: true,
    });
    entries.push({
      label: `${animal.name} 먹이 주기`,
      value: animal.lastFedDayKey === dayKey ? "오늘 완료" : species ? `${itemName(project, species.feedItemId)} 1개` : "종 정보 없음",
      testId: `life-ledger-animal-feed-${animal.instanceId}`,
      disabled: !dayKey || !species || animal.lastFedDayKey === dayKey,
      onActivate: !dayKey || !species ? undefined : () => notify(
        onMutation,
        feedFarmAnimal(project, session, animal.instanceId, dayKey),
        `${animal.name}에게 먹이를 주었습니다`,
      ),
    });
    entries.push({
      label: `${animal.name} 쓰다듬기`,
      value: animal.lastPettedDayKey === dayKey ? "오늘 완료" : `친밀도 +${species?.petFriendship ?? 0}`,
      testId: `life-ledger-animal-pet-${animal.instanceId}`,
      disabled: !dayKey || !species || animal.lastPettedDayKey === dayKey,
      onActivate: !dayKey || !species ? undefined : () => notify(
        onMutation,
        petFarmAnimal(project, session, animal.instanceId, dayKey),
        `${animal.name}을(를) 쓰다듬었습니다`,
      ),
    });
    entries.push({
      label: `${animal.name} 생산물 받기`,
      value: animal.readyProductCount > 0 && species
        ? `${itemName(project, species.productItemId)} ${animal.readyProductCount}개`
        : "아직 준비되지 않음",
      testId: `life-ledger-animal-collect-${animal.instanceId}`,
      disabled: !species || animal.readyProductCount <= 0,
      onActivate: !species ? undefined : () => notify(
        onMutation,
        collectFarmAnimalProduct(project, session, animal.instanceId),
        `${animal.name}의 생산물을 받았습니다`,
      ),
    });
  }
  return { entries, emptyLabel: "돌볼 수 있는 동물이 없습니다" };
}

function shippingEntries(
  project: Project,
  session: PlaySession,
  onMutation?: (ok: boolean, message: string) => void,
): { entries: StatusMenuDetailEntry[]; emptyLabel: string } {
  const allowed = project.system.shipping?.allowedItemIds;
  const ids = new Set([
    ...Object.keys(session.inventory).filter((itemId) => (session.inventory[itemId] ?? 0) > 0),
    ...Object.keys(session.shippingQueue ?? {}),
  ]);
  const entries: StatusMenuDetailEntry[] = [];
  for (const itemId of [...ids].sort()) {
    const item = project.database.items.find((entry) => entry.id === itemId);
    const eligible = item !== undefined && resolveSellPrice(project, itemId) !== undefined && (!allowed || allowed.includes(itemId));
    const inventory = session.inventory[itemId] ?? 0;
    const queued = session.shippingQueue?.[itemId] ?? 0;
    const name = item?.name ?? `${itemId} (삭제된 품목)`;
    if (inventory > 0 && eligible) {
      entries.push({
        label: name,
        value: `보유 ${inventory} · 1개 출하`,
        description: `예상 단가 ${resolveSellPrice(project, itemId) ?? 0}G`,
        testId: `life-ledger-shipping-deposit-${itemId}`,
        onActivate: () => notify(onMutation, depositShipping(project, session, itemId, 1), "출하함에 넣었습니다"),
      });
    }
    if (queued > 0) {
      entries.push({
        label: name,
        value: `출하함 ${queued} · 1개 꺼내기`,
        testId: `life-ledger-shipping-withdraw-${itemId}`,
        onActivate: () => notify(onMutation, withdrawShipping(project, session, itemId, 1), "출하함에서 꺼냈습니다"),
      });
    }
  }
  return { entries, emptyLabel: "출하할 수 있는 물품이 없습니다" };
}

function bundleEntries(
  project: Project,
  session: PlaySession,
  onMutation?: (ok: boolean, message: string) => void,
): { entries: StatusMenuDetailEntry[]; emptyLabel: string } {
  const entries = (project.system.bundles ?? []).flatMap((bundle): StatusMenuDetailEntry[] =>
    bundle.requirements.map((requirement) => {
      const contributed = session.bundleContributions?.[bundle.id]?.[requirement.itemId] ?? 0;
      const item = project.database.items.find((candidate) => candidate.id === requirement.itemId);
      const complete = contributed >= requirement.count || (session.completedBundleIds ?? []).includes(bundle.id);
      return {
        label: `${bundle.name ?? bundle.id} · ${item?.name ?? requirement.itemId}`,
        value: `${Math.min(contributed, requirement.count)}/${requirement.count}`,
        description: complete ? "완료" : `보유 ${session.inventory[requirement.itemId] ?? 0}`,
        testId: `life-ledger-bundle-${bundle.id}-${requirement.itemId}`,
        disabled: complete || (session.inventory[requirement.itemId] ?? 0) <= 0 || !item,
        onActivate: complete ? undefined : () => notify(
          onMutation,
          contributeBundle(project, session, bundle.id, requirement.itemId, 1),
          "꾸러미에 기여했습니다",
        ),
      };
    }),
  );
  return { entries, emptyLabel: "등록된 꾸러미가 없습니다" };
}

function skillEntries(project: Project, session: PlaySession): { entries: StatusMenuDetailEntry[]; emptyLabel: string } {
  const entries = (project.database.lifeSkills ?? []).map((skill): StatusMenuDetailEntry => {
    const progress = session.lifeSkills?.[skill.id] ?? { level: 1, xp: 0 };
    return {
      label: skill.name,
      value: `Lv.${progress.level}`,
      description: `경험치 ${progress.xp}`,
      testId: `life-ledger-skill-${skill.id}`,
    };
  });
  return { entries, emptyLabel: "등록된 생활 기술이 없습니다" };
}

function makerEntries(
  project: Project,
  session: PlaySession,
  onMutation?: (ok: boolean, message: string) => void,
): { entries: StatusMenuDetailEntry[]; emptyLabel: string } {
  const entries: StatusMenuDetailEntry[] = [];
  if ((project.system.makers?.length ?? 0) === 0) {
    entries.push({ label: "등록된 가공 설비가 없습니다", value: "" });
  }
  for (const maker of project.system.makers ?? []) {
    const instanceId = `ledger:${maker.id}`;
    const state = session.makerInstances?.[instanceId];
    const inputLabel = maker.inputs.map((input) => `${itemName(project, input.itemId)} ${input.count}`).join(", ");
    if (state?.status === "processing") {
      entries.push({
        label: maker.name ?? maker.id,
        value: "가공 중",
        description: `완료 시각 ${state.readyAtMinute ?? "?"}분`,
        testId: `life-ledger-maker-${maker.id}`,
        disabled: true,
      });
      continue;
    }
    const collect = state?.status === "ready";
    entries.push({
      label: maker.name ?? maker.id,
      value: collect ? "완성품 받기" : "가공 시작",
      description: collect ? maker.outputs.map((output) => `${itemName(project, output.itemId)} ${output.count}`).join(", ") : inputLabel,
      testId: `life-ledger-maker-${maker.id}`,
      onActivate: () => {
        if (collect) {
          notify(onMutation, collectMaker(project, session, instanceId), "완성품을 받았습니다");
          return;
        }
        const time = session.gameTime;
        if (!time) {
          onMutation?.(false, "게임 시간을 확인할 수 없습니다");
          return;
        }
        notify(onMutation, startMaker(project, session, instanceId, maker.id, absoluteGameMinutes(time, project.system.timeSystem)), "가공을 시작했습니다");
      },
    });
  }
  const known = new Set((project.system.makers ?? []).map((maker) => maker.id));
  for (const state of Object.values(session.makerInstances ?? {})) {
    if (known.has(state.makerId)) continue;
    entries.push({ label: `${state.makerId} (삭제된 가공 설비)`, value: state.status, disabled: true });
  }
  return { entries, emptyLabel: "등록된 가공 설비가 없습니다" };
}

function itemName(project: Project, itemId: string): string {
  return project.database.items.find((item) => item.id === itemId)?.name ?? itemId;
}

function notify(
  callback: ((ok: boolean, message: string) => void) | undefined,
  result: { readonly ok: boolean; readonly reason?: string },
  successMessage: string,
): void {
  callback?.(result.ok, result.ok ? successMessage : `처리할 수 없습니다: ${result.reason ?? "unknown"}`);
}
