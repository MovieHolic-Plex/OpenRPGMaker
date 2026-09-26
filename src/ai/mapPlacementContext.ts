// ai/mapPlacementContext.ts
// 「이 맵에 무엇을 놓을 때」 모델이 참고할 사실 묶음 — **현재 맵이 1순위**다.
//
// 왜(2026-09-27 사용자 판단): 바로 깔기·조수가 상자를 놓을 때 보상을 감으로 정하면 후반 던전에 1G 상자가 생긴다.
// 이 맵에서 싸우는 적의 보상, 이미 깔린 상자, 이 마을 상점 물가가 곧 이 맵의 진행도다. 이 사실을 코드가 모아
// 모델에게 주고, 보상 범위도 여기서 정한다(clampChestGold). 현재 맵에 신호가 없을 때만 출입구로 이어진 이웃 맵,
// 그다음 프로젝트 전체로 넓힌다. 어느 범위를 썼는지는 scope 로 늘 밝힌다.
//
// 순수 함수 — 스토어·네트워크 없음. 바로 깔기(editor/stampPlaceRunner.ts)와 채팅 컨텍스트가 같은 것을 쓴다.
import { collectCommands } from "@/project/mapInspection";
import { projectWikiContext } from "@/ai/projectWikiContext";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";

export type RewardScope = "map" | "neighbor" | "project" | "none";

export interface GoldRange {
  readonly min: number;
  readonly med: number;
  readonly max: number;
}

export interface ChestRewardBasis {
  /** 상자 금액 기대 범위. 이 밖이면 clampChestGold 가 안으로 맞춘다. */
  readonly min: number;
  readonly max: number;
  /** 어느 범위의 사실로 정했나 — 결과 줄에 그대로 적는다. */
  readonly scope: RewardScope;
  /** 사람이 읽는 한 줄 근거(예: 「이 맵 전투 1회 120~240G · 기존 상자 300G」). */
  readonly reason: string;
}

export interface PlacementItemRef {
  readonly id: string;
  readonly name: string;
  readonly price: number;
}

export interface MapPlacementContext {
  readonly map: {
    readonly id: string;
    readonly name: string;
    readonly width: number;
    readonly height: number;
    readonly locations: readonly string[];
    readonly climate?: string;
    readonly saveDisabled?: boolean;
    readonly escapeDisabled?: boolean;
    readonly farm?: boolean;
  };
  /** 이 맵에서 싸우는 적(조우·필드 스폰). 없으면 null. */
  readonly fights: {
    readonly encounterRate: number;
    readonly enemyNames: readonly string[];
    readonly battleGold: GoldRange;
    readonly battleExp: GoldRange;
    readonly drops: readonly PlacementItemRef[];
  } | null;
  readonly existing: {
    readonly chests: readonly { readonly x: number; readonly y: number; readonly gold?: number; readonly item?: string }[];
    readonly shops: readonly { readonly eventName: string; readonly items: readonly PlacementItemRef[] }[];
    readonly npcs: readonly string[];
    readonly savepoints: number;
    readonly exits: readonly { readonly x: number; readonly y: number; readonly toMapId: string; readonly toName: string }[];
  };
  /** 이 맵에 걸린 설정집 문서(id·이름·요약). */
  readonly wiki: readonly { readonly id: string; readonly name: string; readonly summary: string }[];
  /** 상자에 넣어도 되는 실제 아이템 후보(이 맵 드롭·상점 → 없으면 이웃 → 프로젝트 싼 소모품). */
  readonly rewardItems: readonly PlacementItemRef[];
  /** 프로젝트에 실제로 있는 아이템·장비 id — 모델이 지어낸 id 를 거르는 데만 쓴다(모델에게 보내지 않는다). */
  readonly knownItemIds: readonly string[];
  readonly chestGold: ChestRewardBasis;
}

const MAX_LIST = 8;

function range(values: readonly number[]): GoldRange | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return { min: sorted[0]!, med: sorted[sorted.length >> 1]!, max: sorted[sorted.length - 1]! };
}

function itemRef(project: Project, id: string): PlacementItemRef | null {
  const record = project.database.items.find((item) => item.id === id)
    ?? project.database.equipment.find((item) => item.id === id);
  return record ? { id: record.id, name: record.name, price: record.price ?? 0 } : null;
}

function uniqueRefs(refs: readonly (PlacementItemRef | null)[]): PlacementItemRef[] {
  const seen = new Set<string>();
  const out: PlacementItemRef[] = [];
  for (const ref of refs) {
    if (!ref || seen.has(ref.id)) continue;
    seen.add(ref.id);
    out.push(ref);
  }
  return out;
}

function eventCommands(event: GameEvent): readonly Command[] {
  return collectCommands([event]);
}

function eventLabel(event: GameEvent): string {
  return (event.name ?? event.pages?.[0]?.name ?? event.id).replace(/\((닫힘|열림)\)$/u, "").trim();
}

/** place_chest 가 만든 상자: 닫힘 페이지가 selfSwitch A=false 이고 명령에 changeGold/changeItem 이 있다. */
function chestReward(event: GameEvent): { gold?: number; itemId?: string } | null {
  const closed = event.pages?.find((page) => page.conditions?.some((cond) => cond.kind === "selfSwitch" && cond.key === "A" && cond.value === false));
  if (!closed) return null;
  let gold: number | undefined;
  let itemId: string | undefined;
  for (const command of collectCommands([{ ...event, pages: [closed] }])) {
    if (command.kind === "changeGold" && command.op === "+=" && typeof command.amount === "number") gold = (gold ?? 0) + command.amount;
    if (command.kind === "changeItem" && command.op === "+=" && typeof command.itemId === "string") itemId ??= command.itemId;
  }
  return gold !== undefined || itemId !== undefined ? { ...(gold !== undefined ? { gold } : {}), ...(itemId ? { itemId } : {}) } : null;
}

function isSavepoint(commands: readonly Command[]): boolean {
  return commands.some((command) => command.kind === "openSaveMenu" || command.kind === "checkpointSave");
}

function isNpcLike(event: GameEvent): boolean {
  const page = event.pages?.[0];
  const graphic = page?.graphic;
  return Boolean(graphic && "charsetId" in graphic && graphic.charsetId) && eventCommands(event).some((command) => command.kind === "text");
}

function mapTroopIds(map: GameMap): string[] {
  const ids = new Set<string>();
  for (const entry of map.encounterTable ?? []) ids.add(entry.troopId);
  if ((map.encounterRate ?? 0) > 0) for (const id of map.troopIds ?? []) ids.add(id);
  for (const spawn of map.fieldSpawns ?? []) ids.add(spawn.troopId);
  return [...ids];
}

interface MapFacts {
  readonly troopGold: number[];
  readonly troopExp: number[];
  readonly enemyNames: string[];
  readonly drops: PlacementItemRef[];
  readonly chestGold: number[];
  readonly shopItems: PlacementItemRef[];
}

/** 트룹 한 번 이기면 받는 골드·경험치(트룹 적 합계). */
function mapFacts(project: Project, map: GameMap): MapFacts {
  const troopGold: number[] = [];
  const troopExp: number[] = [];
  const enemyNames = new Set<string>();
  const drops: (PlacementItemRef | null)[] = [];
  for (const troopId of mapTroopIds(map)) {
    const troop = project.database.troops.find((record) => record.id === troopId);
    if (!troop) continue;
    const enemyIds = troop.members?.length ? troop.members.map((member) => member.enemyId) : troop.enemyIds;
    let gold = 0;
    let exp = 0;
    for (const enemyId of enemyIds) {
      const enemy = project.database.enemies.find((record) => record.id === enemyId);
      if (!enemy) continue;
      enemyNames.add(enemy.name);
      gold += enemy.rewards?.gold ?? 0;
      exp += enemy.rewards?.exp ?? 0;
      if (enemy.rewards?.dropItemId) drops.push(itemRef(project, enemy.rewards.dropItemId));
      for (const drop of enemy.rewards?.drops ?? []) drops.push(itemRef(project, drop.itemId));
    }
    if (gold > 0) troopGold.push(gold);
    if (exp > 0) troopExp.push(exp);
  }
  const chestGold: number[] = [];
  const shopItems: (PlacementItemRef | null)[] = [];
  for (const event of map.events) {
    const reward = chestReward(event);
    if (reward?.gold) chestGold.push(reward.gold);
    for (const command of eventCommands(event)) {
      if (command.kind === "shop") for (const id of command.itemIds ?? []) shopItems.push(itemRef(project, id));
    }
  }
  return { troopGold, troopExp, enemyNames: [...enemyNames], drops: uniqueRefs(drops), chestGold, shopItems: uniqueRefs(shopItems) };
}

function exitsOf(project: Project, map: GameMap): { x: number; y: number; toMapId: string; toName: string }[] {
  const out: { x: number; y: number; toMapId: string; toName: string }[] = [];
  const seen = new Set<string>();
  for (const event of map.events) {
    for (const command of eventCommands(event)) {
      if (command.kind !== "transfer" || command.mapId === map.id || seen.has(command.mapId)) continue;
      const target = project.maps[command.mapId];
      if (!target) continue;
      seen.add(command.mapId);
      out.push({ x: event.x, y: event.y, toMapId: command.mapId, toName: target.name });
    }
  }
  for (const edge of project.worldGraph?.edges ?? []) {
    const other = edge.from.mapId === map.id ? edge.to.mapId : edge.to.mapId === map.id ? edge.from.mapId : null;
    if (!other || other === map.id || seen.has(other) || !project.maps[other]) continue;
    seen.add(other);
    out.push({ x: -1, y: -1, toMapId: other, toName: project.maps[other]!.name });
  }
  return out;
}

function roundGold(value: number): number {
  if (value < 20) return Math.max(1, Math.round(value));
  if (value < 200) return Math.round(value / 5) * 5;
  if (value < 2000) return Math.round(value / 10) * 10;
  return Math.round(value / 50) * 50;
}

/**
 * 상자 금액 기대 범위. 전투 1회분의 0.5~4배, 기존 상자가 있으면 그 범위의 0.5~2배를 합친다.
 * 상점만 있으면(마을) 대표 소모품 값의 0.5~3배. 사실이 하나도 없으면 프로젝트 적 보상 중앙값 기준.
 */
function goldBasis(facts: MapFacts, scope: RewardScope, where: string): ChestRewardBasis | null {
  const battle = range(facts.troopGold);
  const chests = range(facts.chestGold);
  const shop = range(facts.shopItems.map((item) => item.price));
  const lows: number[] = [];
  const highs: number[] = [];
  const reasons: string[] = [];
  if (battle) {
    lows.push(battle.min * 0.5);
    highs.push(battle.max * 4);
    reasons.push(`${where} 전투 1회 ${battle.min === battle.max ? `${battle.min}G` : `${battle.min}~${battle.max}G`}`);
  }
  if (chests) {
    lows.push(chests.min * 0.5);
    highs.push(chests.max * 2);
    reasons.push(`${where} 기존 상자 ${chests.min === chests.max ? `${chests.min}G` : `${chests.min}~${chests.max}G`}`);
  }
  if (!battle && !chests && shop) {
    lows.push(shop.min * 0.5);
    highs.push(shop.med * 3);
    reasons.push(`${where} 상점 ${shop.min}~${shop.max}G`);
  }
  if (lows.length === 0) return null;
  const min = roundGold(Math.max(...lows));
  const max = Math.max(min, roundGold(Math.max(...highs)));
  return { min, max, scope, reason: reasons.join(" · ") };
}

function projectBasis(project: Project): ChestRewardBasis {
  const gold = range(project.database.enemies.map((enemy) => enemy.rewards?.gold ?? 0));
  if (!gold) return { min: 20, max: 100, scope: "none", reason: "진행도 정보가 없어 기본 20~100G" };
  const min = roundGold(gold.min * 0.5);
  return { min, max: Math.max(min, roundGold(gold.med * 2)), scope: "project", reason: `이 맵에 진행도 신호가 없어 프로젝트 적 보상(중앙 ${gold.med}G) 기준` };
}

export function buildMapPlacementContext(project: Project, mapId: string): MapPlacementContext | null {
  const map = project.maps[mapId];
  if (!map) return null;
  const here = mapFacts(project, map);
  const exits = exitsOf(project, map);
  const neighbors = exits.map((exit) => project.maps[exit.toMapId]).filter((next): next is GameMap => Boolean(next));

  let chestGold = goldBasis(here, "map", "이 맵");
  let neighborFacts: MapFacts | null = null;
  if (!chestGold && neighbors.length > 0) {
    const merged: MapFacts = { troopGold: [], troopExp: [], enemyNames: [], drops: [], chestGold: [], shopItems: [] };
    for (const next of neighbors) {
      const facts = mapFacts(project, next);
      merged.troopGold.push(...facts.troopGold);
      merged.troopExp.push(...facts.troopExp);
      merged.chestGold.push(...facts.chestGold);
      merged.drops.push(...facts.drops);
      merged.shopItems.push(...facts.shopItems);
    }
    neighborFacts = merged;
    chestGold = goldBasis(merged, "neighbor", "이웃 맵");
  }
  chestGold ??= projectBasis(project);

  // 드롭·상점이 없으면 값이 이 맵 상자 금액대에 드는 소모품을 고른다(후반 던전에 싼 물통이 나오지 않게).
  const mid = (chestGold.min + chestGold.max) / 2;
  const priceFits = project.database.items
    .filter((item) => item.consumable && (item.price ?? 0) >= chestGold.min * 0.3 && (item.price ?? 0) <= chestGold.max)
    .sort((a, b) => Math.abs((a.price ?? 0) - mid) - Math.abs((b.price ?? 0) - mid))
    .slice(0, 4)
    .map((item) => ({ id: item.id, name: item.name, price: item.price ?? 0 }));
  const rewardItems = uniqueRefs([
    ...here.drops,
    ...here.shopItems,
    ...(neighborFacts ? [...neighborFacts.drops, ...neighborFacts.shopItems] : []),
    ...(here.drops.length + here.shopItems.length === 0 && !neighborFacts?.drops.length && !neighborFacts?.shopItems.length ? priceFits : []),
  ]).slice(0, MAX_LIST);

  const chests: { x: number; y: number; gold?: number; item?: string }[] = [];
  const shops: { eventName: string; items: PlacementItemRef[] }[] = [];
  const npcs: string[] = [];
  let savepoints = 0;
  for (const event of map.events) {
    const reward = chestReward(event);
    if (reward) {
      const item = reward.itemId ? itemRef(project, reward.itemId)?.name ?? reward.itemId : undefined;
      chests.push({ x: event.x, y: event.y, ...(reward.gold ? { gold: reward.gold } : {}), ...(item ? { item } : {}) });
      continue;
    }
    const commands = eventCommands(event);
    const shopItems = uniqueRefs(commands.flatMap((command) => command.kind === "shop" ? (command.itemIds ?? []).map((id) => itemRef(project, id)) : []));
    if (shopItems.length > 0) shops.push({ eventName: eventLabel(event), items: shopItems.slice(0, MAX_LIST) });
    if (isSavepoint(commands)) savepoints += 1;
    else if (isNpcLike(event)) npcs.push(eventLabel(event));
  }

  const wiki = projectWikiContext(project, { query: map.name, mapId }).selectedIds
    .map((id) => project.world?.entities.find((entity) => entity.id === id))
    .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity))
    .slice(0, 4)
    .map((entity) => ({ id: entity.id, name: entity.name, summary: entity.summary.slice(0, 160) }));

  const battleGold = range(here.troopGold);
  const climate = !map.climate ? undefined : map.climate.mode === "fixed" ? String(map.climate.weather) : map.climate.mode === "indoor" ? "indoor" : undefined;
  return {
    map: {
      id: map.id,
      name: map.name,
      width: map.width,
      height: map.height,
      locations: (map.locations ?? []).map((location) => location.name).filter(Boolean).slice(0, MAX_LIST),
      ...(climate ? { climate } : {}),
      ...(map.disableSave ? { saveDisabled: true } : {}),
      ...(map.disableEscape ? { escapeDisabled: true } : {}),
      ...(map.farmableArea?.length ? { farm: true } : {}),
    },
    fights: battleGold
      ? {
        encounterRate: map.encounterRate ?? 0,
        enemyNames: here.enemyNames.slice(0, MAX_LIST),
        battleGold,
        battleExp: range(here.troopExp) ?? { min: 0, med: 0, max: 0 },
        drops: here.drops.slice(0, MAX_LIST),
      }
      : null,
    existing: { chests: chests.slice(0, MAX_LIST), shops: shops.slice(0, 4), npcs: npcs.slice(0, MAX_LIST), savepoints, exits: exits.slice(0, MAX_LIST) },
    wiki,
    rewardItems,
    knownItemIds: [...project.database.items.map((item) => item.id), ...project.database.equipment.map((item) => item.id)],
    chestGold,
  };
}

/** 범위 밖 금액을 안으로 맞춘다. 결과 줄에 붙일 문구도 함께 준다. */
export function clampChestGold(gold: number, basis: ChestRewardBasis): { readonly gold: number; readonly note: string } {
  const asked = Math.max(1, Math.round(gold));
  if (asked < basis.min) return { gold: basis.min, note: `${asked}G → ${basis.min}G로 올림(${basis.reason})` };
  if (asked > basis.max) return { gold: basis.max, note: `${asked}G → ${basis.max}G로 내림(${basis.reason})` };
  return { gold: asked, note: basis.reason };
}

/** 채팅 컨텍스트용 한 줄 — 모델이 상자 보상을 이 맵에 맞춰 고르게 한다. */
export function formatChestRewardHint(context: MapPlacementContext): string {
  const items = context.rewardItems.slice(0, 4).map((item) => `${item.name}(${item.id})`).join(", ");
  return `상자 보상 기준: ${context.chestGold.min}~${context.chestGold.max}G (${context.chestGold.reason})${items ? ` · 아이템 후보 ${items}` : ""}`;
}
