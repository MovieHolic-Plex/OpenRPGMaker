/**
 * 『폴른 스타』 왕도 아스텔의 살림(2026-10-24): 집 안 수납 뒤지기·주인에게 들키기·토마 빵집·대장간 재고.
 *
 * - 수납(통·궤짝·옷장·바구니·자루…)은 한 번만 뒤질 수 있고 먼저 말하는 한 줄로 결과를 보여 준다(더러는 빈다).
 * - 리사네 집은 리사가 문 쪽을 보고 서 있다. 방 안쪽(리사 눈앞) 수납을 뒤지면 처음은 경고, 두 번째는 호통·내쫓김·
 *   출입 금지(스위치로 저장되고 집 문이 거절한다). 가게·여관·천문대는 잠글 수 없다.
 * - 토마의 빵은 전부 먹는 상태 기믹이다(데워진 빵=몇 전투에 걸친 재생, 약초 빵=상태 치료, 수상한 빵=무작위,
 *   든든한 빵=여관에서 쉴 때까지 힘 상승, 묵은 빵=싸지만 탈이 날 수 있음).
 * 이 파일은 fallenTownInteriors.ts 를 가져오지 않는다(재고 함수만 거기서 가져간다).
 */
import { normalizeItemRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { isPassable } from "@/project/collision";
import type { Command, GameMap, Project } from "@/project/types";

type Cell = { x: number; y: number };

export const SW_LISA_BANNED = "sw_fs_lisa_banned";
export const VAR_LISA_WARNED = "var_fs_lisa_warned";
const BREAD_ICON = "cc0-jetrel-bread";

/** 카엘 일행이 파는 무기·방어구(데모 DB 의 id). 없는 id 는 재고에서 빠진다. */
const SMITHY_GOODS = [
  "equip_gen_sword_bronze", "equip_gen_sword_iron", "equip_gen_sword_steel", "equip_gen_sword_flame",
  "equip_fs_sword_gale", "equip_fs_sword_star",
  "equip_gen_spear_iron", "equip_gen_halberd_guard", "equip_fs_spear_pike", "equip_fs_spear_star",
  "equip_gen_armor_leather", "equip_gen_armor_chain", "equip_gen_armor_plate",
  "equip_gen_shield_wood", "equip_gen_shield_iron", "equip_gen_helm_leather", "equip_gen_helm_iron",
];
const BAKERY_GOODS = [
  "fs_bread_warm", "fs_bread_herb", "fs_bread_hearty", "fs_bread_mystery", "fs_bread_stale", "item_bread", "item_potion",
];

function knownIds(project: Project): Set<string> {
  const db = project.database;
  return new Set([...(db.items ?? []), ...(db.equipment ?? [])].map((r) => r.id));
}
export function fallenBakeryStock(project: Project): string[] {
  const known = knownIds(project);
  return BAKERY_GOODS.filter((id) => known.has(id));
}
export function fallenSmithyStock(project: Project): string[] {
  const known = knownIds(project);
  return SMITHY_GOODS.filter((id) => known.has(id));
}

/** 토마의 빵 다섯 가지와 그 상태 — 이미 있으면 건드리지 않는다. */
export function ensureFallenTownDatabase(project: Project): void {
  const db = project.database;
  const states = (db.states ??= []);
  const items = (db.items ??= []);
  const addState = (s: Parameters<typeof normalizeStateRecord>[0]) => {
    if (!states.some((x) => x.id === s.id)) states.push(normalizeStateRecord(s));
  };
  const addItem = (i: Parameters<typeof normalizeItemRecord>[0]) => {
    if (!items.some((x) => x.id === i.id)) items.push(normalizeItemRecord(i));
  };
  // 데워진 빵: 먹고 나면 다음 몇 번의 전투에 걸쳐 매 턴 체력이 오른다(전투가 끝나도 남고, 가끔 풀린다).
  addState({
    id: "fs_state_bread_warm", name: "빵의 온기", battleAura: "regen-sparkle", restriction: "없음",
    removalCondition: "전투 종료 후 유지", recoverNaturallyFromTurn: 4, recoverNaturallyChance: 30,
    runtimeEffects: { hpHealPercentPerTurn: 10, removeOnBattleEnd: false },
  });
  // 든든한 빵: 공격·방어가 오르고, 여관에서 푹 쉴 때까지 간다.
  addState({
    id: "fs_state_bread_hearty", name: "든든함", restriction: "없음", removalCondition: "휴식 때까지 유지",
    runtimeEffects: { attackMultiplier: 1.25, defenseMultiplier: 1.15, removeOnBattleEnd: false },
  });
  const bread = (
    id: string, name: string, price: number, description: string,
    extra: { hp?: number; healStateIds?: string[]; stateEffects?: { stateId: string; chance: number; operation: "add" | "remove" }[] },
  ) => ({
    id, name, price, description, scope: "ally" as const, type: "medicine" as const, occasion: "always" as const, consumable: true,
    animationId: "anim_heal", imageResourceId: BREAD_ICON, iconResourceId: BREAD_ICON,
    hpRecovery: { flat: extra.hp ?? 0, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 },
    healStateIds: extra.healStateIds ?? [],
    stateEffects: [
      ...(extra.healStateIds ?? []).map((stateId) => ({ stateId, chance: 100, operation: "remove" as const })),
      ...(extra.stateEffects ?? []),
    ],
  });
  addItem(bread("fs_bread_warm", "갓 구운 온기빵", 45, "먹으면 HP 를 조금 채우고, 이후 몇 번의 전투 동안 턴마다 체력이 차오릅니다(가끔 식어서 풀립니다).", {
    hp: 15, stateEffects: [{ stateId: "fs_state_bread_warm", chance: 100, operation: "add" }],
  }));
  addItem(bread("fs_bread_herb", "약초 호밀빵", 55, "쓴 약초를 반죽에 넣어 구운 빵. 독과 수면을 풀고 HP 를 조금 채웁니다.", {
    hp: 10, healStateIds: ["state_poison", "state_sleep"],
  }));
  addItem(bread("fs_bread_hearty", "든든한 곡물빵", 70, "씹을수록 힘이 나는 빵. 공격과 방어가 오르며, 여관에서 푹 쉴 때까지 이어집니다.", {
    hp: 20, stateEffects: [{ stateId: "fs_state_bread_hearty", chance: 100, operation: "add" }],
  }));
  addItem(bread("fs_bread_mystery", "토마의 수상한 빵", 40, "속에 뭐가 들었는지는 토마도 모릅니다. 힘이 날 수도, 체력이 차오를 수도, 탈이 날 수도 있습니다.", {
    hp: 12, stateEffects: [
      { stateId: "state_attack_up", chance: 40, operation: "add" },
      { stateId: "fs_state_bread_warm", chance: 40, operation: "add" },
      { stateId: "state_poison", chance: 25, operation: "add" },
      { stateId: "state_sleep", chance: 15, operation: "add" },
    ],
  }));
  addItem(bread("fs_bread_stale", "묵은 빵", 8, "어제 못 판 딱딱한 빵. 싸고 배는 차지만 가끔 탈이 납니다.", {
    hp: 25, stateEffects: [{ stateId: "state_poison", chance: 35, operation: "add" }],
  }));
}

// ───────────────────────── 수납 뒤지기 ─────────────────────────

const FURNITURE = /통|상자|궤짝|옷장|항아리|바구니|자루|서랍|협탁|가방|단지|찬장|화장대/;
const NOT_FURNITURE = /빵|벽|문|열쇠|지도/;

function hashCell(mapId: string, x: number, y: number): number {
  let h = 2166136261;
  for (const ch of `${mapId}:${x}:${y}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h ^ (h >>> 15)) >>> 0;
}

type Loot = { kind: "empty" } | { kind: "gold"; amount: number } | { kind: "item"; itemId: string };
const LOOT_ITEMS = ["item_potion", "item_antidote", "item_wake_herb", "item_bread"];

function rollLoot(project: Project, mapId: string, c: Cell, rich: boolean): Loot {
  const h = hashCell(mapId, c.x, c.y);
  if (rich) return (h >>> 3) % 2 === 0 ? { kind: "gold", amount: 100 } : { kind: "item", itemId: "item_hi_potion" };
  const r = h % 100;
  if (r < 22) return { kind: "empty" };
  if (r < 52) return { kind: "gold", amount: [15, 30, 50][(h >>> 8) % 3]! };
  const known = knownIds(project);
  const pool = LOOT_ITEMS.filter((id) => known.has(id));
  return { kind: "item", itemId: pool[(h >>> 4) % pool.length]! };
}

/** 가구 칸을 라벨로 찾는다 — 키 큰 가구는 윗칸이 아닌 앞(아래)칸 하나만, 이웃 칸은 합친다. */
function findContainers(project: Project, map: GameMap, walkable: (x: number, y: number) => boolean): { cell: Cell; label: string }[] {
  const ts = project.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] } | undefined;
  const meta = ts?.tileMeta ?? [];
  const layers = [map.lowerTiles, map.lowerOverlayTiles, map.upperTiles, map.upperOverlayTiles] as (ArrayLike<number> | undefined)[];
  const found: { cell: Cell; label: string }[] = [];
  for (let y = map.height - 1; y >= 0; y--) {
    for (let x = 0; x < map.width; x++) {
      let label = "";
      for (const layer of layers) {
        const t = layer?.[y * map.width + x] ?? -1;
        if (t < 0) continue;
        const l = (meta[t]?.label ?? "").replace(/^버들항 · /, "");
        if (FURNITURE.test(l) && !NOT_FURNITURE.test(l)) { label = l; break; }
      }
      if (!label) continue;
      const open = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => walkable(x + dx!, y + dy!));
      if (!open) continue;
      if (found.some((f) => Math.abs(f.cell.x - x) + Math.abs(f.cell.y - y) <= 1)) continue;
      if (map.events.some((e) => e.x === x && e.y === y)) continue;
      found.push({ cell: { x, y }, label });
    }
  }
  return found;
}

const narrate = (body: string): Command => ({ kind: "text", body, context: "narration", position: "bottom" } as Command);
const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as Command);

function lootCommands(project: Project, loot: Loot, label: string): Command[] {
  if (loot.kind === "empty") return [narrate(`${label}을(를) 뒤져 봤지만 먼지뿐이다. 비어 있다.`)];
  if (loot.kind === "gold") {
    return [narrate(`${label} 바닥에서 ${loot.amount}G 를 찾았다.`), { kind: "changeGold", op: "+=", amount: loot.amount } as Command];
  }
  const name = project.database.items?.find((i) => i.id === loot.itemId)?.name ?? loot.itemId;
  return [narrate(`${label}에서 「${name}」을(를) 찾았다.`), { kind: "changeItem", itemId: loot.itemId, op: "+=", amount: 1 } as Command];
}

function ensureSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}
function ensureVariable(project: Project, id: string, name: string): void {
  if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name });
}

type Watch = { readonly person: string; readonly sees: (c: Cell) => boolean };

/** 리사: 문 쪽을 보고 서서 방 안쪽(서랍·옷장이 있는 아래쪽 왼편)을 지켜본다. */
const LISA_WATCH: Watch = { person: "ev_fs_lisa", sees: (c) => c.y >= 9 && c.x <= 12 };

function containerEvent(
  project: Project, mapId: string, c: Cell, label: string, loot: Loot, watch: Watch | null, expel: Command[] | null,
): GameMap["events"][number] {
  const id = `ev_fs_box_${mapId}_${c.x}_${c.y}`;
  const take = [...lootCommands(project, loot, label), { kind: "setSelfSwitch", key: "A", value: true } as Command];
  let first: Command[] = take;
  if (watch && expel) {
    first = [
      {
        kind: "fork", condition: { kind: "variable", variableId: VAR_LISA_WARNED, op: ">", value: 0 },
        then: expel,
        else: [
          ...take,
          { kind: "showEmote", target: { eventId: watch.person }, emote: "exclamation", durationMs: 900 } as Command,
          say("리사", "…방금 거기, 손댔죠? 이번 한 번만 못 본 걸로 해 줄게요."),
          say("리사", "한 번만 더 내 물건에 손대면 그땐 문밖으로 내쫓을 거예요. 이 집 문도 다시는 안 열어 줄 거고요."),
          { kind: "setVariable", variableId: VAR_LISA_WARNED, op: "=", value: 1 } as Command,
        ],
      } as Command,
    ];
  }
  return {
    id, name: `수납 · ${label}`, x: c.x, y: c.y, trigger: { kind: "action" }, commands: [],
    pages: [
      {
        id: `${id}_p0`, name: "뒤지기", conditions: [], graphic: { transparent: true },
        movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", trigger: { kind: "action" }, commands: first,
      },
      {
        id: `${id}_p1`, name: "이미 뒤짐", conditions: [{ kind: "selfSwitch", key: "A", value: true }], graphic: { transparent: true },
        movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", trigger: { kind: "action" },
        commands: [narrate(`${label}은(는) 이미 뒤져 봤다. 더 나올 것이 없다.`)],
      },
    ],
  } as unknown as GameMap["events"][number];
}

const HOME_MAPS = ["fs_inn", "fs_apothecary", "fs_bakery_home", "fs_stargazer_home", "fs_lisa_home", "fs_smithy"] as const;

/** 주인에게 호통 맞고 쫓겨나는 장면 — 리사 집 문 앞으로 나가고 출입 금지 스위치가 켜진다. */
function expelCommands(exit: { mapId: string; x: number; y: number }): Command[] {
  return [
    { kind: "showEmote", target: "player", emote: "sweat", durationMs: 700 } as Command,
    { kind: "showEmote", target: { eventId: "ev_fs_lisa" }, emote: "anger", durationMs: 1100 } as Command,
    say("리사", "내가 분명히 말했죠! 남의 집 서랍을 또 뒤져요?"),
    say("리사", "나가요, 당장! 그리고 다시는 이 집 문턱도 넘지 말아요!"),
    narrate("리사에게 등을 떠밀려 집 밖으로 쫓겨났다."),
    { kind: "setSwitch", switchId: SW_LISA_BANNED, value: true } as Command,
    { kind: "transfer", mapId: exit.mapId, x: exit.x, y: exit.y, direction: "down", fade: "black" } as Command,
  ];
}

function findGate(hub: GameMap, toMapId: string): GameMap["events"][number] | undefined {
  const has = (cmds: readonly Command[] | undefined) => (cmds ?? []).some((c) => c.kind === "transfer" && c.mapId === toMapId);
  return hub.events.find((e) => has(e.commands as Command[]) || (e.pages ?? []).some((p) => has(p.commands as Command[])));
}

export type TownLifeResult = { containers: Record<string, number>; bannedGate: Cell | null };

export function buildFallenTownLife(project: Project, hubId: string): TownLifeResult {
  ensureSwitch(project, SW_LISA_BANNED, "리사네 집 출입 금지(들켰다)");
  ensureVariable(project, VAR_LISA_WARNED, "리사의 경고 횟수");
  const containers: Record<string, number> = {};
  let bannedGate: Cell | null = null;

  const hub = project.maps[hubId];
  const lisaGate = hub ? findGate(hub, "fs_lisa_home") : undefined;
  const exit = lisaGate ? { mapId: hubId, x: lisaGate.x, y: lisaGate.y + 1 } : null;

  for (const mapId of HOME_MAPS) {
    const map = project.maps[mapId];
    if (!map) continue;
    const spots = findContainers(project, map, (x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height && isPassable(project, map, x, y));
    let n = 0;
    for (const { cell, label } of spots) {
      const watched = mapId === "fs_lisa_home" && LISA_WATCH.sees(cell);
      const loot = rollLoot(project, mapId, cell, watched);
      const ev = containerEvent(project, mapId, cell, label, loot, watched ? LISA_WATCH : null, watched && exit ? expelCommands(exit) : null);
      map.events.push(ev);
      n++;
    }
    containers[mapId] = n;
  }

  // 리사네 집 문: 쫓겨난 뒤에는 거절하고 문밖으로 되돌려 보낸다.
  if (hub && lisaGate && exit) {
    (lisaGate.pages ??= []).push({
      id: `${lisaGate.id}_banned`, name: "출입 금지", conditions: [{ kind: "switch", switchId: SW_LISA_BANNED, value: true }],
      graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same",
      trigger: { kind: "playerTouch" },
      commands: [
        narrate("문 안쪽에서 리사의 목소리가 날카롭게 울린다. 「남의 서랍 뒤지는 사람은 들이지 않아요! 돌아가요!」"),
        { kind: "transfer", mapId: exit.mapId, x: exit.x, y: exit.y, direction: "down", fade: "none" } as Command,
      ],
    } as never);
    bannedGate = { x: lisaGate.x, y: lisaGate.y };
  }
  return { containers, bannedGate };
}
