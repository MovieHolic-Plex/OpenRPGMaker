/**
 * 『폴른 스타』 왕도 아스텔의 살림(2026-10-24): 집 안 수납 뒤지기·주인에게 들키기·토마 빵집·대장간 재고.
 *
 * - 수납(통·궤짝·옷장·바구니·자루…)은 한 번만 뒤질 수 있고 먼저 말하는 한 줄로 결과를 보여 준다(더러는 빈다).
 * - 리사·오스본·토마는 집 안을 오가며 산다(걷는 경로). 수납을 뒤질 때 주인이 같은 방에서 이쪽을 향해 5칸 안에
 *   있어야만(eventSeesPlayer) 들킨다. 못 보면 그냥 챙긴다 — 다른 방이면 기척 없이, 가까이 있으면 「달그락」 소리.
 *   들키면 「!」 말풍선, 처음은 경고, 두 번째는 호통·내쫓김(리사·오스본은 출입 금지 스위치가 저장되고 문이 거절).
 *   토마(가게)·여관·약방·대장간은 잠글 수 없다.
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
        const l = (meta[t]?.label ?? "").replace(/^버들항 · /, "").replace(/\s*\(\s*\d+\s*,\s*\d+\s*\)\s*/g, " ").replace(/\s*\([^)]*\)/g, "").replace(/\s*\d+\s*[×x]\s*\d+/g, "").replace(/\s+/g, " ").trim();
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

/** 받침 유무로 조사를 고른다(을/를·은/는·이/가). */
function josa(word: string, withBatchim: string, without: string): string {
  const ch = word.trim().charCodeAt(word.trim().length - 1);
  const hangul = ch >= 0xac00 && ch <= 0xd7a3;
  return hangul && (ch - 0xac00) % 28 !== 0 ? withBatchim : without;
}
const narrate = (body: string): Command => ({ kind: "text", body, context: "narration", position: "bottom" } as Command);
const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as Command);

function lootCommands(project: Project, loot: Loot, label: string): Command[] {
  if (loot.kind === "empty") return [narrate(`${label}${josa(label, "을", "를")} 뒤져 봤지만 먼지뿐이다. 비어 있다.`)];
  if (loot.kind === "gold") {
    return [narrate(`${label} 바닥에서 ${loot.amount}G 를 찾았다.`), { kind: "changeGold", op: "+=", amount: loot.amount } as Command];
  }
  const name = project.database.items?.find((i) => i.id === loot.itemId)?.name ?? loot.itemId;
  return [narrate(`${label}에서 「${name}」${josa(name, "을", "를")} 찾았다.`), { kind: "changeItem", itemId: loot.itemId, op: "+=", amount: 1 } as Command];
}

function ensureSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}
function ensureVariable(project: Project, id: string, name: string): void {
  if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name });
}

/** 집 주인 — 이 사람이 방 안에서 나를 볼 수 있을 때만 수납 뒤지기가 들킨다(eventSeesPlayer). */
type Owner = {
  readonly mapId: string; readonly person: string; readonly name: string;
  readonly warnVar: string; readonly banSwitch: string | null;
  /** 주인이 가까이(다른 방·등 돌린 채) 있을 때 먼저 들리는 기척 */
  readonly cue: string;
  readonly lines: { readonly warn: readonly [string, string]; readonly expel: readonly [string, string]; readonly shove: string; readonly banned: string };
};

const OWNERS: readonly Owner[] = [
  {
    mapId: "fs_lisa_home", person: "ev_fs_lisa", name: "리사", warnVar: VAR_LISA_WARNED, banSwitch: SW_LISA_BANNED,
    cue: "부엌 쪽에서 달그락 소리가 난다. 리사가 가까이 있는 것 같다.",
    lines: {
      warn: ["…방금 거기, 손댔죠? 이번 한 번만 못 본 걸로 해 줄게요.", "한 번만 더 내 물건에 손대면 그땐 문밖으로 내쫓을 거예요. 이 집 문도 다시는 안 열어 줄 거고요."],
      expel: ["내가 분명히 말했죠! 남의 집 서랍을 또 뒤져요?", "나가요, 당장! 그리고 다시는 이 집 문턱도 넘지 말아요!"],
      shove: "리사에게 등을 떠밀려 집 밖으로 쫓겨났다.",
      banned: "문 안쪽에서 리사의 목소리가 날카롭게 울린다. 「남의 서랍 뒤지는 사람은 들이지 않아요! 돌아가요!」",
    },
  },
  {
    mapId: "fs_stargazer_home", person: "ev_fs_old_stargazer", name: "오스본", warnVar: "var_fs_osborn_warned", banSwitch: "sw_fs_osborn_banned",
    cue: "서재 쪽에서 책장 넘기는 소리와 낮은 헛기침이 들린다. 노인이 가까이 있다.",
    lines: {
      warn: ["…이보게, 지금 내 궤짝에 손을 넣지 않았나. 별 보는 늙은이도 눈은 멀쩡하다네.", "이번만은 넘어가겠네. 하지만 또 그러면 이 문을 다시는 열지 않을 걸세."],
      expel: ["내가 분명히 일렀네! 또 남의 물건에 손을 대다니!", "나가게. 이 천문대 문턱을 다시 넘을 생각은 말게!"],
      shove: "오스본의 지팡이에 떠밀려 집 밖으로 쫓겨났다.",
      banned: "문 너머에서 오스본의 지팡이 소리가 울린다. 「도둑 손버릇은 들이지 않네. 돌아가게!」",
    },
  },
  {
    mapId: "fs_bakery_home", person: "ev_fs_baker_husband", name: "토마", warnVar: "var_fs_toma_warned", banSwitch: null,
    cue: "오븐 쪽에서 반죽을 두드리는 소리가 난다. 토마가 멀지 않은 곳에 있다.",
    lines: {
      warn: ["어이쿠, 손님! 내 빵 궤짝에 손댔소? 이번엔 못 본 걸로 하겠소.", "하지만 한 번 더 그러면 가게 밖으로 끌어낼 거요. 알겠소?"],
      expel: ["내가 말했잖소! 또 뒤졌소?!", "나가시오! 오늘은 더 팔 빵 없소!"],
      shove: "토마에게 어깨를 잡혀 가게 밖으로 끌려 나왔다.",
      banned: "",
    },
  },
];

function ownerSeesFork(owner: Owner, then: Command[], otherwise: Command[]): Command {
  return {
    kind: "fork", condition: { kind: "eventSeesPlayer", eventId: owner.person, range: 5 }, then, else: otherwise,
  } as unknown as Command;
}

function containerEvent(
  project: Project, mapId: string, c: Cell, label: string, loot: Loot, owner: Owner | null, expel: Command[] | null,
): GameMap["events"][number] {
  const id = `ev_fs_box_${mapId}_${c.x}_${c.y}`;
  const take = [...lootCommands(project, loot, label), { kind: "setSelfSwitch", key: "A", value: true } as Command];
  let first: Command[] = take;
  if (owner && expel) {
    const spotted = { kind: "showEmote", target: { eventId: owner.person }, emote: "exclamation", durationMs: 900 } as Command;
    const near = {
      kind: "fork", condition: { kind: "eventSeesPlayer", eventId: owner.person, range: 8, sameRoom: false, requireFacing: false },
      then: [narrate(owner.cue), ...take], else: take,
    } as unknown as Command;
    first = [
      ownerSeesFork(owner, [
        spotted,
        {
          kind: "fork", condition: { kind: "variable", variableId: owner.warnVar, op: ">", value: 0 },
          then: expel,
          else: [
            ...take,
            say(owner.name, owner.lines.warn[0]),
            say(owner.name, owner.lines.warn[1]),
            { kind: "setVariable", variableId: owner.warnVar, op: "=", value: 1 } as Command,
          ],
        } as Command,
      ], [near]),
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
        commands: [narrate(`${label}${josa(label, "은", "는")} 이미 뒤져 봤다. 더 나올 것이 없다.`)],
      },
    ],
  } as unknown as GameMap["events"][number];
}

const HOME_MAPS = ["fs_inn", "fs_apothecary", "fs_bakery_home", "fs_stargazer_home", "fs_lisa_home", "fs_smithy"] as const;

/** 주인에게 호통 맞고 쫓겨나는 장면 — 집 문 앞으로 나가고(잠글 수 있는 집은) 출입 금지 스위치가 켜진다. */
function expelCommands(owner: Owner, exit: { mapId: string; x: number; y: number }): Command[] {
  return [
    { kind: "showEmote", target: "player", emote: "sweat", durationMs: 700 } as Command,
    { kind: "showEmote", target: { eventId: owner.person }, emote: "anger", durationMs: 1100 } as Command,
    say(owner.name, owner.lines.expel[0]),
    say(owner.name, owner.lines.expel[1]),
    narrate(owner.lines.shove),
    ...(owner.banSwitch ? [{ kind: "setSwitch", switchId: owner.banSwitch, value: true } as Command] : []),
    { kind: "transfer", mapId: exit.mapId, x: exit.x, y: exit.y, direction: "down", fade: "black" } as Command,
  ];
}

function findGate(hub: GameMap, toMapId: string): GameMap["events"][number] | undefined {
  const has = (cmds: readonly Command[] | undefined) => (cmds ?? []).some((c) => c.kind === "transfer" && c.mapId === toMapId);
  return hub.events.find((e) => has(e.commands as Command[]) || (e.pages ?? []).some((p) => has(p.commands as Command[])));
}

// ───────────────────────── 거리 수납(통·상자·자루) ─────────────────────────

/** 버들항 번들 그림 — [칸 번호, 라벨]. 24168·26606·27120·25804 는 막히고 26607·24380 은 걸어갈 수 있는 그림이다(이벤트가 막는다). */
const HUB_ART: Record<string, readonly [number, string]> = {
  barrel: [24168, "통"], crate: [26606, "나무 상자"], chest: [27120, "선원 궤짝"],
  fish: [25804, "생선 상자"], stack: [26607, "쌓인 상자"], sack: [24380, "곡식 자루"],
};
const SHOP_ART = ["barrel", "crate", "sack", "stack"] as const;
const DOCK_ART = ["fish", "chest", "stack", "barrel", "fish", "crate", "chest", "sack"] as const;

/**
 * 거리 곳곳(가게 문 곁·남쪽 부두와 창고 둘레)에 버들항 통·상자·자루를 자연스럽게 놓고 한 번 뒤지는 이벤트를 단다.
 * 격자로 박지 않는다 — 해시로 섞은 후보를 간격 3 이상으로 고르고, 길·문 앞·이벤트 옆은 피한다.
 * 문 앞 칸끼리 이어진 길이 놓은 뒤에도 그대로 이어지는지(BFS), 각 수납 옆에 닿을 수 있는 빈 칸이 있는지 확인하고 아니면 뺀다.
 */
function placeStreetContainers(project: Project, hubId: string): number {
  const hub = project.maps[hubId];
  if (!hub) return 0;
  const tileset = project.tilesets[hub.tilesetId];
  if (!tileset) return 0;
  const W = hub.width, H = hub.height;
  const at = (x: number, y: number) => y * W + x;
  const hasTransfer = (e: GameMap["events"][number]) =>
    [...((e.commands as Command[] | undefined) ?? []), ...(e.pages ?? []).flatMap((pg) => (pg.commands as Command[] | undefined) ?? [])].some((c) => c.kind === "transfer");
  const gates = hub.events.filter(hasTransfer);
  const shopGates = ["fs_inn", "fs_apothecary", "fs_bakery_home", "fs_smithy"].map((id) => findGate(hub, id)).filter((g): g is NonNullable<typeof g> => !!g);
  const fronts = gates.map((g) => ({ x: g.x, y: g.y + 1 })).filter((c) => c.y < H && isPassable(project, hub, c.x, c.y));

  const placed = new Set<string>();
  const blockedNow = (x: number, y: number) => placed.has(`${x},${y}`) || !isPassable(project, hub, x, y) || hub.events.some((e) => e.x === x && e.y === y && !hasTransfer(e) && (e.pages?.[0]?.priority ?? "same") === "same" && e.id.startsWith("ev_fs_box_"));
  const reach = (start: Cell): Set<string> => {
    const seen = new Set<string>([`${start.x},${start.y}`]);
    const q = [start];
    while (q.length) {
      const c = q.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = c.x + dx, ny = c.y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || blockedNow(nx, ny)) continue;
        seen.add(k); q.push({ x: nx, y: ny });
      }
    }
    return seen;
  };
  const start = fronts[0];
  if (!start) return 0;
  const baseReach = reach(start);
  const connectedFronts = fronts.filter((f) => baseReach.has(`${f.x},${f.y}`));

  const free = (x: number, y: number): boolean => {
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return false;
    if (!isPassable(project, hub, x, y)) return false;
    for (const g of gates) if (Math.abs(g.x - x) <= 1 && y >= g.y - 1 && y <= g.y + 3) return false; // 문 앞 길
    const i = at(x, y);
    for (const t of [hub.lowerTiles[i], hub.lowerOverlayTiles?.[i], hub.upperTiles[i], hub.upperOverlayTiles?.[i]]) {
      if (t === undefined || t < 0) continue;
      if (/길|포석|광장|road|plaza|물|water|바다/i.test(tileset.tileMeta?.[t]?.label ?? "")) return false;
    }
    if ((hub.upperTiles[i] ?? -1) >= 0 || (hub.upperOverlayTiles?.[i] ?? -1) >= 0) return false; // 이미 무언가 서 있다
    return !hub.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1);
  };

  const pickZone = (cands: Cell[], kinds: readonly (keyof typeof HUB_ART)[], count: number, label: string): number => {
    const sorted = [...cands].sort((a, b) => hashCell(`${hubId}:${label}`, a.x, a.y) - hashCell(`${hubId}:${label}`, b.x, b.y));
    let n = 0;
    for (const c of sorted) {
      if (n >= count) break;
      if (!free(c.x, c.y)) continue;
      if (Array.from(placed).some((k) => { const [px, py] = k.split(",").map(Number); return Math.max(Math.abs(px! - c.x), Math.abs(py! - c.y)) < 3; })) continue;
      const key = kinds[n % kinds.length]!;
      const [tile, name] = HUB_ART[key]!;
      placed.add(`${c.x},${c.y}`);
      const after = reach(start);
      const sideOpen = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => after.has(`${c.x + dx!},${c.y + dy!}`));
      if (!sideOpen || !connectedFronts.every((f) => after.has(`${f.x},${f.y}`))) { placed.delete(`${c.x},${c.y}`); continue; }
      hub.upperTiles[at(c.x, c.y)] = tile;
      const h = hashCell(hubId, c.x, c.y);
      const loot = rollLoot(project, hubId, c, h % 9 === 0);
      hub.events.push(containerEvent(project, hubId, c, name, loot, null, null));
      n++;
    }
    return n;
  };

  let total = 0;
  // 가게 문 곁: 문에서 3~7칸 안쪽, 문 아래쪽 앞길 둘레.
  for (const g of shopGates) {
    const cands: Cell[] = [];
    for (let y = g.y - 1; y <= g.y + 6; y += 1) for (let x = g.x - 7; x <= g.x + 7; x += 1) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (Math.max(Math.abs(x - g.x), Math.abs(y - g.y)) >= 2) cands.push({ x, y });
    }
    total += pickZone(cands, SHOP_ART, 2, `shop_${g.id}`);
  }
  // 남쪽 부두·창고: 아랫 3분의 1.
  const dock: Cell[] = [];
  for (let y = Math.floor(H * 0.62); y < H - 3; y += 1) for (let x = 2; x < W - 2; x += 1) dock.push({ x, y });
  total += pickZone(dock, DOCK_ART, 8, "dock");
  // 부두의 한 켠 — 창고 그늘(남서쪽 둘레)과 동쪽 선착장에도 한 무더기씩.
  total += pickZone(dock.filter((c) => c.x < W / 2), ["barrel", "crate"], 2, "dock_w");
  total += pickZone(dock.filter((c) => c.x >= W / 2), ["fish", "stack"], 2, "dock_e");
  return total;
}

export type TownLifeResult = { containers: Record<string, number>; bannedGate: Cell | null; bannedGates: Record<string, Cell> };

export function buildFallenTownLife(project: Project, hubId: string): TownLifeResult {
  for (const o of OWNERS) {
    ensureVariable(project, o.warnVar, `${o.name}의 경고 횟수`);
    if (o.banSwitch) ensureSwitch(project, o.banSwitch, `${o.name}네 집 출입 금지(들켰다)`);
  }
  const containers: Record<string, number> = {};
  const bannedGates: Record<string, Cell> = {};
  const hub = project.maps[hubId];

  for (const mapId of HOME_MAPS) {
    const map = project.maps[mapId];
    if (!map) continue;
    const owner = OWNERS.find((o) => o.mapId === mapId) ?? null;
    const gate = hub && owner ? findGate(hub, mapId) : undefined;
    const exit = gate ? { mapId: hubId, x: gate.x, y: gate.y + 1 } : null;
    const spots = findContainers(project, map, (x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height && isPassable(project, map, x, y));
    let n = 0;
    for (const { cell, label } of spots) {
      const loot = rollLoot(project, mapId, cell, false);
      map.events.push(containerEvent(project, mapId, cell, label, loot, owner, owner && exit ? expelCommands(owner, exit) : null));
      n++;
    }
    containers[mapId] = n;
    // 잠글 수 있는 집의 문: 쫓겨난 뒤에는 거절하고 문밖으로 되돌려 보낸다.
    if (gate && exit && owner?.banSwitch) {
      (gate.pages ??= []).push({
        id: `${gate.id}_banned`, name: "출입 금지", conditions: [{ kind: "switch", switchId: owner.banSwitch, value: true }],
        graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same",
        trigger: { kind: "playerTouch" },
        commands: [
          narrate(owner.lines.banned),
          { kind: "transfer", mapId: exit.mapId, x: exit.x, y: exit.y, direction: "down", fade: "none" } as Command,
        ],
      } as never);
      bannedGates[mapId] = { x: gate.x, y: gate.y };
    }
  }
  containers[hubId] = placeStreetContainers(project, hubId);
  return { containers, bannedGate: bannedGates["fs_lisa_home"] ?? null, bannedGates };
}
