// 조수 v2 목적표 — 장소를 깔기 전에 «이 장소가 게임에서 무엇을 위해 있는가»를 청사진에서 정해 구성기에 건넨다.
//
// 왜(오너 2026-11-11 «초록 네모가 전부 문이 맞기는 한데 ..», 「맵은 목적으로 깐다 — 공간이 남으면 너무 큰 것」): 세계 장소는 종류마다 고정 크기로 지어져
// 집 줄을 끝까지 채웠다 — 모델 없이 지은 사막 다섯 장에 건물 53채, 들어갈 수 있는 건물 3채, 청사진 단계는 맵마다 하나쯤. 문은 전부 진짜 문이었지만
// 그 뒤에 아무것도 없었다. 이제 청사진에서 장소마다 역할 건물(누구의 집 · 청사진이 적은 방이 달릴 건물 · 가게 · 쉴 곳 · 그 종류의 얼굴 건물)을 정하고,
// 구성기는 그 건물과 채움 집 몇 채만 놓는다. 맵 크기도 그 수에서 나온다(settlementProgram.ts — 번들이 선언한 역할·키트·방).
//
// 여기 있는 것: 계획(planPrograms) · 가게와 쉴 곳이 필요한가의 하나뿐인 결정(serviceNeeds) · 역할 건물의 문(roleDoor) · 그 사람이 설 문 앞 칸(programAnchor) ·
// 덮지 않고 적는 빈칸(programGaps). 방을 짓고 잇는 일은 programRooms.ts, 목적표가 지은 방인가(isProgramRoom)는 programMark.ts.
import { isPassable } from "@/project/collision";
import type { GameBlueprint } from "@/project/gameBlueprint";
import { HOME_ROLE, PROGRAM_ROLE_TAG, REST_ROLE, SUPPLY_ROLE, needTag, roleTag, type RoleNeed, type SettlementDecl, type SettlementProgram } from "@/project/settlementProgram";
import type { GameMap, Project } from "@/project/types";
import { allCommands, battleSites, healingSources } from "../judge/combatChecks";
import { buildingEntrances } from "./entrances";
import { worldKind, worldOf, type WorldKind, type WorldSetting } from "./world";

/** 한 장소에 세우는 «누구의 집» 상한 — 그 장소에 단계가 있는 서로 다른 사람마다 한 채씩, 넷째 사람부터는 집 없이 예전처럼 길가에 선다(빈칸으로 적는다). */
export const HOME_CAP = 3;
/** 종류의 얼굴 건물(궁전·피라미드 입구)이 맡는 역할의 id. */
const LANDMARK_ID = "landmark";

/** 목적표가 드러낸 빈칸 — 덮지 않고 적는다. 실내 종류가 없는 역할(no-room-kind)은 없는 그림 장부(shared/artGap.ts v2.art-gap)에도 실린다 — 짓는 쪽이 at 을 붙여 넘긴다. */
export interface ProgramGap {
  /** no-room-kind 그 역할의 실내 종류가 이 번들에 없다 · unplaced 역할 건물을 놓지 못했다 · home-cap 집 상한을 넘은 사람 · no-host 그 역할을 둘 수 있는 장소가 없다. */
  readonly kind: "no-room-kind" | "unplaced" | "home-cap" | "no-host";
  readonly world: string;
  readonly place: string;
  readonly role: string;
  readonly need?: string;
  readonly detail: string;
  /** 그 건물의 문 칸(지은 뒤의 빈칸만). */
  readonly at?: { readonly mapId: string; readonly x: number; readonly y: number };
}

export interface PlacePlan {
  readonly program: SettlementProgram;
  /** 그 장소에 단계가 있는 사람 → 그 사람이 문 앞에 서는 역할 건물(need id). */
  readonly people: ReadonlyMap<string, string>;
}
export interface ProgramPlan {
  /** 바깥 장소 이름 → 목적표. */
  readonly places: ReadonlyMap<string, PlacePlan>;
  /** 청사진이 적은 방 이름 → 그 방이 달리는 장소와 건물. */
  readonly rooms: ReadonlyMap<string, { readonly host: string; readonly needId: string }>;
  readonly gaps: readonly ProgramGap[];
}

const sameKey = (name: string): string => name.normalize("NFC").replace(/\s+/gu, "");
const declOf = (world: WorldSetting | undefined): SettlementDecl | undefined => world?.program?.decl;
/** 바깥 종류의 선언 이름(구성기 값). */
const kindKey = (kind: WorldKind | undefined): string => kind?.compose?.value ?? kind?.id ?? "";

/**
 * 이 게임에 쉴 곳·가게가 필요한가 — 이 결정은 여기 하나뿐이다. 목적표(짓기 전, when "plan")는 청사진으로 미리 보고,
 * 끝맺음(지은 뒤, when "built")은 지어진 전투·벌 수 있는 돈·이미 있는 회복 길과 상점으로 본다. 어디에 둘지는 읽는 쪽이 정한다(목적표의 역할 건물 안, 없으면 시작 맵).
 */
export function serviceNeeds(project: Project, when: "plan" | "built"): { rest: boolean; supply: boolean } {
  if (when === "plan") {
    const bp = project.gameBlueprint, world = worldOf(project);
    const fights = !!bp && (bp.steps.some((st) => st.kind === "battle") || (!!world && (bp.places ?? []).some((pl) => worldKind(world, pl.kind)?.danger)));
    return { rest: fights, supply: fights };
  }
  const fights = battleSites(project).length > 0;
  return {
    rest: fights && !healingSources(project).length,
    supply: fights && goldObtainable(project) && !allCommands(project).some((r) => r.cmd.kind === "shop"),
  };
}

/** 전투로 돈을 벌거나(적 보상·상자·이벤트 돈) 시작 돈이 있는가. */
function goldObtainable(project: Project): boolean {
  if ((project.session.gold ?? 0) > 0) return true;
  const commands = allCommands(project);
  if (commands.some((r) => r.cmd.kind === "changeGold" && r.cmd.op !== "-=")) return true;
  const fought = new Set(commands.filter((r) => r.cmd.kind === "battleProcessing").map((r) => String(r.cmd.troopId)));
  for (const m of Object.values(project.maps)) for (const e of m.encounterTable ?? []) fought.add(String((e as { troopId?: string }).troopId));
  for (const m of Object.values(project.maps)) for (const id of m.troopIds ?? []) fought.add(String(id));
  const enemies = new Set(project.database.troops.filter((t) => fought.has(t.id)).flatMap((t) => t.enemyIds ?? []));
  return project.database.enemies.some((e) => enemies.has(e.id) && (e.rewards?.gold ?? 0) > 0);
}

/**
 * 청사진 → 장소마다의 목적표. 선언이 없는 세계는 undefined(예전 그대로 짓는다).
 * 역할의 차례 = 큰길 안쪽부터 서는 차례: 얼굴 건물 → 쉴 곳·가게 → 청사진이 적은 방의 건물 → 사람들의 집.
 *  - 얼굴 건물: 종류가 선언한 landmark. 그 종류의 방(알현실·묘실)을 청사진이 적었으면 그 방이 여기에 달리고, 그 장소의 첫 사람은 이 문 앞에 선다.
 *  - 쉴 곳·가게: serviceNeeds("plan") 가 필요하다고 할 때. 첫 위험한 장소보다 앞선 장소 가운데 그 역할이 본업인 종류(선언 roles 의 첫 역할), 없으면 그 역할을 둘 수 있는 첫 장소.
 *  - 집: 그 장소에 talk·choice 단계가 있는 서로 다른 사람마다 한 채(HOME_CAP 까지).
 */
export function planPrograms(project: Pick<Project, "gameBlueprint">, world: WorldSetting | undefined = worldOf(project)): ProgramPlan | undefined {
  const bp: GameBlueprint | undefined = project.gameBlueprint;
  const decl = declOf(world);
  if (!bp || !world || !decl) return undefined;
  const listed = bp.places ?? [];
  const outdoor = listed.map((place, index) => ({ place, index, kind: worldKind(world, place.kind) }))
    .filter((e) => !!e.kind && !e.kind.indoor && !!decl.kinds[kindKey(e.kind)]);
  if (!outdoor.length) return undefined;
  const allows = (e: (typeof outdoor)[number], role: string): boolean => decl.kinds[kindKey(e.kind)]!.roles.includes(role);
  const rankOf = (e: (typeof outdoor)[number], role: string): number => decl.kinds[kindKey(e.kind)]!.roles.indexOf(role);
  const gaps: ProgramGap[] = [];
  const gap = (kind: ProgramGap["kind"], place: string, role: string, detail: string, need?: string) => gaps.push({ kind, world: world.id, place, role, detail, ...(need ? { need } : {}) });
  const front = new Map<string, RoleNeed[]>(), service = new Map<string, RoleNeed[]>(), roomNeeds = new Map<string, RoleNeed[]>(), homes = new Map<string, RoleNeed[]>();
  const people = new Map<string, Map<string, string>>();
  const push = (into: Map<string, RoleNeed[]>, place: string, need: RoleNeed) => into.set(place, [...(into.get(place) ?? []), need]);
  for (const e of outdoor) {
    const landmark = decl.kinds[kindKey(e.kind)]!.landmark;
    if (landmark) push(front, e.place.name, { id: LANDMARK_ID, role: landmark });
    people.set(e.place.name, new Map());
  }
  // 청사진이 적은 방 — 그 방 종류가 어느 역할의 실내인지는 선언이 말한다.
  const rooms = new Map<string, { host: string; needId: string }>();
  const landmarkTaken = new Set<string>();
  const roleOfRoom = (kind: WorldKind): string | undefined => Object.keys(decl.roles).find((role) => decl.roles[role]!.room === kindKey(kind));
  for (const place of listed) {
    const kind = worldKind(world, place.kind);
    const role = kind?.indoor ? roleOfRoom(kind) : undefined;
    if (!role) continue;
    const from = outdoor.find((e) => sameKey(e.place.name) === sameKey(place.from ?? "") && allows(e, role));
    const host = from ?? [...outdoor].filter((e) => allows(e, role)).sort((a, b) => rankOf(a, role) - rankOf(b, role) || a.index - b.index)[0];
    if (!host) continue;   // 그 역할을 둘 장소가 없으면 예전 길(문 낱말)로 단다
    if (decl.kinds[kindKey(host.kind)]!.landmark === role && !landmarkTaken.has(host.place.name)) {
      landmarkTaken.add(host.place.name);
      rooms.set(place.name, { host: host.place.name, needId: LANDMARK_ID });
      continue;
    }
    const need = { id: `room:${place.name}`, role, label: place.name };
    push(roomNeeds, host.place.name, need);
    rooms.set(place.name, { host: host.place.name, needId: need.id });
  }
  // 쉴 곳·가게 — 청사진이 그 역할의 방을 이미 적었으면 그 방이 맡는다.
  const want = serviceNeeds(project as Project, "plan");
  const firstDanger = outdoor.find((e) => e.kind!.danger)?.index ?? Infinity;
  const before = outdoor.filter((e) => e.index < firstDanger);
  for (const [role, needed] of [[REST_ROLE, want.rest], [SUPPLY_ROLE, want.supply]] as const) {
    if (!needed || !decl.roles[role]) continue;
    if ([...roomNeeds.values()].flat().some((need) => need.role === role)) continue;
    const pool = (before.length ? before : outdoor).filter((e) => allows(e, role));
    const host = pool.find((e) => rankOf(e, role) === 0) ?? pool[0];
    if (!host) { gap("no-host", "", role, `「${decl.roles[role]!.ko}」을 둘 수 있는 장소가 청사진에 없다 — 시작 맵에 예전처럼 둔다`); continue; }
    push(service, host.place.name, { id: `svc:${role}`, role });
  }
  // 사람들의 집 — 첫 사람은 얼굴 건물이 있으면 그 문 앞, 나머지는 한 사람에 한 채.
  for (const e of outdoor) {
    const name = e.place.name, who = people.get(name)!;
    const cast = [...new Set(bp.steps.filter((st) => sameKey(st.place) === sameKey(name) && (st.kind === "talk" || st.kind === "choice") && st.who?.trim()).map((st) => st.who!.trim()))];
    for (const person of cast) {
      if (front.get(name)?.length && ![...who.values()].includes(LANDMARK_ID)) { who.set(person, LANDMARK_ID); continue; }
      if (!allows(e, HOME_ROLE)) continue;   // 집을 세우지 않는 종류(유적) — 예전처럼 길가에 선다
      if ((homes.get(name)?.length ?? 0) >= HOME_CAP) { gap("home-cap", name, HOME_ROLE, `「${person}」의 집은 세우지 않았다 — 한 장소의 집은 ${HOME_CAP}채까지`); continue; }
      const need = { id: `home:${person}`, role: HOME_ROLE, label: `${person}의 집` };
      push(homes, name, need);
      who.set(person, need.id);
    }
  }
  const places = new Map<string, PlacePlan>();
  for (const e of outdoor) {
    const name = e.place.name;
    places.set(name, { program: { roles: [...(front.get(name) ?? []), ...(service.get(name) ?? []), ...(roomNeeds.get(name) ?? []), ...(homes.get(name) ?? [])] }, people: people.get(name)! });
  }
  return { places, rooms, gaps };
}

/** 이 맵(바깥 장소)의 계획. */
export function placePlanOf(project: Project, map: Pick<GameMap, "name">): PlacePlan | undefined {
  const plan = planPrograms(project);
  if (!plan) return undefined;
  for (const [name, place] of plan.places) if (sameKey(name) === sameKey(map.name ?? "")) return place;
  return undefined;
}

export interface RoleDoor {
  readonly need: string;
  readonly role: string;
  /** 건물 이름(«나지라의 집»). */
  readonly label: string;
  /** 문 그림 칸(막힌 칸)과 문 앞 칸 — 문이 옆으로 여러 칸이면 가장 왼쪽. */
  readonly door: { readonly x: number; readonly y: number };
  readonly front: { readonly x: number; readonly y: number };
  /** 문 폭(칸). */
  readonly width: number;
  readonly kit: string;
}

const tagValue = (tags: readonly string[] | undefined, prefix: string): string | undefined => tags?.find((t) => t.startsWith(prefix))?.slice(prefix.length);

/** 이 맵에 놓인 역할 건물의 문 — 구성 도구가 남긴 로케이션 꼬리표(program-role)와 칩셋이 선언한 입구로 읽는다. */
export function roleDoors(project: Project, map: GameMap): RoleDoor[] {
  const marked = (map.locations ?? []).filter((l) => (l.tags ?? []).includes(PROGRAM_ROLE_TAG));
  if (!marked.length) return [];
  const entrances = buildingEntrances(project, map);
  const out: RoleDoor[] = [];
  for (const loc of marked) {
    const inside = entrances.filter((e) => e.x >= loc.x && e.x < loc.x + loc.w && e.y >= loc.y && e.y < loc.y + loc.h).sort((a, b) => b.y - a.y || a.x - b.x);
    const first = inside[0];
    const need = tagValue(loc.tags, needTag("")), role = tagValue(loc.tags, roleTag(""));
    if (!first || !need || !role) continue;
    const row = inside.filter((e) => e.y === first.y);
    out.push({ need, role, label: loc.name, door: { x: first.x, y: first.y }, front: first.front, width: row.length, kit: first.kit });
  }
  return out;
}

/** 그 역할 건물 문으로 들어가면 나오는 맵(문 칸이나 문 앞 칸의 이동). */
export function roomBehind(map: GameMap, door: RoleDoor): string | undefined {
  for (const ev of map.events ?? []) {
    if (ev.y !== door.door.y && ev.y !== door.front.y) continue;
    if (ev.x < door.door.x || ev.x >= door.door.x + door.width) continue;
    const hit = /"kind":"transfer"[^}]*?"mapId":"([^"]+)"/u.exec(JSON.stringify(ev.pages ?? []));
    if (hit) return hit[1];
  }
  return undefined;
}

/** 그 역할(가게·쉴 곳)의 건물로 들어가면 나오는 방 — 끝맺음이 가게 주인·여관 주인을 그 안에 세운다. */
export function serviceRoom(project: Project, role: string): { mapId: string; hostMapId: string; door: RoleDoor } | undefined {
  for (const map of Object.values(project.maps)) for (const door of roleDoors(project, map)) {
    if (door.role !== role) continue;
    const mapId = roomBehind(map, door);
    if (mapId && project.maps[mapId]) return { mapId, hostMapId: map.id, door };
  }
  return undefined;
}

/**
 * 그 사람이 설 칸 — 제 역할 건물(집·얼굴 건물)의 문 옆, 길 위. 없으면 undefined(예전 자리 고르기).
 * 문 앞 칸 자체에는 서지 않는다(들어가는 길이고, 잠긴 문 한 줄이 문 칸에 선다). 세웠을 때 길이 끊기는 칸(한 칸 골목)도 쓰지 않는다.
 */
export function programAnchor(project: Project, map: GameMap, who: string | undefined, avoid: readonly { x: number; y: number }[] = []): { x: number; y: number } | undefined {
  const person = who?.trim();
  const needId = person ? placePlanOf(project, map)?.people.get(person) : undefined;
  const door = needId ? roleDoors(project, map).find((d) => d.need === needId) : undefined;
  if (!door) return undefined;
  const busy = new Set([...(map.events ?? []).map((e) => `${e.x},${e.y}`), ...avoid.map((c) => `${c.x},${c.y}`)]);
  const reach = (blocked?: string): number => {
    const seen = new Set<string>([`${door.front.x},${door.front.y}`]);
    const queue = [door.front];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = c.x + dx, y = c.y + dy, k = `${x},${y}`;
        if (seen.has(k) || k === blocked || x < 0 || y < 0 || x >= map.width || y >= map.height || !isPassable(project, map, x, y)) continue;
        seen.add(k); queue.push({ x, y });
      }
    }
    return seen.size;
  };
  const base = reach();
  const y = door.front.y;
  for (const cell of [{ x: door.front.x + door.width, y }, { x: door.front.x - 1, y }, { x: door.front.x + door.width, y: y + 1 }, { x: door.front.x - 1, y: y + 1 }]) {
    if (cell.x < 1 || cell.y < 1 || cell.x >= map.width - 1 || cell.y >= map.height - 1) continue;
    if (!isPassable(project, map, cell.x, cell.y) || busy.has(`${cell.x},${cell.y}`)) continue;
    if (reach(`${cell.x},${cell.y}`) < base - 1) continue;
    return cell;
  }
  return undefined;
}

/** 지은 뒤의 빈칸: 계획에서 드러난 것 + 놓지 못한 역할 + 실내 종류가 없는 역할 건물(문 앞에 사람만 선다). */
export function programGaps(project: Project): ProgramGap[] {
  const world = worldOf(project), decl = declOf(world), plan = planPrograms(project);
  if (!world || !decl || !plan) return [];
  const gaps = [...plan.gaps];
  for (const [name, place] of plan.places) {
    const map = Object.values(project.maps).find((m) => sameKey(m.name ?? "") === sameKey(name));
    if (!map) continue;
    const doors = roleDoors(project, map);
    for (const need of place.program.roles) {
      const door = doors.find((d) => d.need === need.id);
      const ko = need.label ?? decl.roles[need.role]?.ko ?? need.role;
      if (!door) gaps.push({ kind: "unplaced", world: world.id, place: name, role: need.role, need: need.id, detail: `「${ko}」 건물을 「${name}」에 놓지 못했다` });
      else if (!decl.roles[need.role]?.room) gaps.push({ kind: "no-room-kind", world: world.id, place: name, role: need.role, need: need.id, at: { mapId: map.id, x: door.door.x, y: door.door.y }, detail: `「${ko}」 — ${world.ko} 번들에 「${decl.roles[need.role]?.ko ?? need.role}」 실내 종류가 없어 들어갈 수 없다(사람이 문 앞에 선다)` });
    }
  }
  return gaps;
}
