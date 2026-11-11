// 실내 방 꾸밈 — 쓰임에 맞는 아늑한 소품 한 벌(cosyFor·swapForPurpose), 깔개 구역(coverZones), 설계 받은 방 읽기(designedRoom), 빈 방 꾸미기(dressEmptyRooms).
import { type HandInteriorSpec } from "@/editor/handInterior/builder";
import { roomTemplates } from "@/editor/handInterior/templates";
import type { BuildRun, PlaceSpec, ZoneSpec } from "../../shared/types";
import { purposeOf, purposeSwap } from "../roomPurpose";
import { DRESS_ROOM_TARGET, dressRoom, roomBarePct } from "./dressRoom";
import type { HandInteriorNotch } from "@/editor/handInterior/rooms";
import { normalizeDoor, shapeNotches, type RoomDesign } from "@/editor/handInterior/designRoom";
import { Rebuild, GENERIC_HOME } from "./interiorKind";

const COSY = ["fur rug", "armchair", "potted plant", "candle stand", "round rug", "tall vase red", "bookshelf 1w", "firewood bundle"];

/** 「아늑하게」 소품 — 집 방은 위 거실 소품, 쓰임이 있는 방은 그 쓰임에 맞는 소품만(예배당 안락의자·장난감 가게 모피 깔개 금지, J42). */
const COSY_BY_PURPOSE: Readonly<Record<string, readonly string[]>> = {
  chapel: ["votive stand", "candelabra", "holy water font", "tall stained window"],
  toyshop: ["shelf:toy", "cabinet:toy", "rocking horse", "music box", "wall clock"],
  shop: ["cabinet:candle", "shelf:jar+jarb+jarg", "crate", "wall clock"],
  weaponshop: ["weapon rack", "shield", "armor stand", "weapon barrel"],
  workshop: ["tool wall", "crate", "barrel", "sack"],
  library: ["bookshelf 1w", "candelabra", "globe", "book pile"],
};

/** 방마다 그 쓰임의 swaps 표로 견본 가구를 바꾼다 — 같은 크기·같은 종류(벽·바닥·걸이) 부품만(배치가 그대로 맞는다). */
export function swapForPurpose(spec: HandInteriorSpec, rb: Rebuild, kinds: ReadonlyMap<string, string>, context: string, zoneOf: (roomId: string) => ZoneSpec | undefined): { rb: Rebuild; count: number } {
  let count = 0;
  const turn = new Map<string, number>();
  const objects = rb.objects.map((o) => {
    const room = rb.rooms.find((r) => o.x >= r.x0 && o.x <= r.x1 && o.y >= r.y0 && o.y <= r.y1);
    if (!room) return o;
    const kind = kinds.get(room.id) ?? room.id;
    if (GENERIC_HOME.test(kind)) return o;
    const zone = zoneOf(room.id);
    const purpose = purposeOf(`${kind.replace(/[_-]/gu, " ")} ${zone?.id ?? ""} ${zone?.purpose ?? ""} ${context}`);
    if (!purpose?.swaps) return o;
    const base = o.id.split("@")[0]!;
    const from = spec.objects[base];
    if (!from) return o;
    const n = turn.get(base) ?? 0;
    const to = purposeSwap(purpose, base, n, (id) => { const d = spec.objects[id]; return !!d && d.kind === from.kind && d.w === from.w && d.h === from.h; });
    if (!to || to === base) return o;
    turn.set(base, n + 1);
    count++;
    return { ...o, id: to };
  });
  return { rb: { ...rb, objects }, count };
}

export function cosyFor(kind: string, context: string): readonly string[] {
  const purpose = GENERIC_HOME.test(kind) ? undefined : purposeOf(`${kind.replace(/[_-]/gu, " ")} ${context}`);
  return purpose ? COSY_BY_PURPOSE[purpose.id] ?? [] : COSY;
}

/**
 * 구역 묶음 하나를 통째로 덮는 한 용도의 견본(2026-10-29): 모델이 감옥을 「감방 셋 + 복도(간수 자리)」 구역으로 쪼개면
 * 방마다 방 종류 견본(cell 4×8·corridor)을 골라, 감방 줄과 간수 자리가 한 방에 짜인 감옥 견본(jail 7×8·11×9)을 쓰지 못했다(room-vig4 jail).
 * 결정적 규칙: 장소 이름·테마가 그 용도를 말하고, 1층 구역이 2개 이상이며 모두 그 용도의 부분(종류 또는 목적 문장)이고, 고정 크기(keep)가 없고,
 * 그 칩셋에 그 용도 견본이 있으면 — 1층 구역을 그 용도 방 하나로 합친다(주인공 물건은 합집합, 구역 셋 이상이면 큰 판). 위층 구역은 그대로.
 */
const COVERING_USES: readonly { readonly kind: string; readonly name: RegExp; readonly part: RegExp }[] = [
  { kind: "jail", name: /감옥|뇌옥|감방|jail|prison|dungeon cell/iu, part: /^(jail|cell|corridor|guard_room|armory)$|감방|감옥|간수|경비|복도|철창|죄수|\bcell|guard|corridor|prison/iu },
];

export function coverZones(tilesetId: string, spec: PlaceSpec, zones: readonly ZoneSpec[], notes: string[]): readonly ZoneSpec[] {
  const first = zones.filter((z) => (z.floor ?? 1) === 1);
  if (first.length < 2 || first.some((z) => z.keep)) return zones;
  const text = `${spec.name} ${spec.theme ?? ""}`;
  for (const use of COVERING_USES) {
    if (!use.name.test(text)) continue;
    if (!first.every((z) => use.part.test(String(z.kind)) || use.part.test(z.purpose ?? ""))) continue;
    if (!roomTemplates(tilesetId).some((t) => t.kind === use.kind)) continue;
    const anchors = [...new Set(first.flatMap((z) => z.anchors ?? []))];
    const merged: ZoneSpec = { id: first[0]!.id ?? use.kind, kind: use.kind, purpose: first.map((z) => z.purpose).filter(Boolean).join(" / ") || spec.name, ...(anchors.length ? { anchors } : {}), size: first.length >= 3 ? "large" : (spec.size ?? "medium"), floor: 1 };
    notes.push(`구역 ${first.map((z) => z.id ?? z.kind).join("·")} 은 모두 ${use.kind} 의 부분이라 ${use.kind} 견본 한 방으로 지었다(감방 줄·간수 자리가 한 견본에 짜여 있다)`);
    return [merged, ...zones.filter((z) => (z.floor ?? 1) !== 1)];
  }
  return zones;
}

/** 모델 설계(zone.design)로 방 한 칸의 layout 요청을 만든다 — 모양 → 도려 낼 귀퉁이, 크기·재질·문 자리. 모르는 재질은 알리고 뺀다. */
export function designedRoom(zone: ZoneSpec, kind: string, n: number, design: RoomDesign, S: HandInteriorSpec, notes: string[]) {
  const w = Math.max(5, Math.min(24, Math.round(design.w ?? 8))), fh = Math.max(4, Math.min(18, Math.round(design.h ?? 6)));
  // 모양은 모델 몫 — 바닥이 그 모양 최소보다 작으면 함수가 크기를 키우지 않고 네모로 지은 뒤 알린다.
  const sn = shapeNotches(design, w, fh);
  const shape = sn.shape;
  const notches: HandInteriorNotch[] = sn.notches;
  if (sn.dropped) notes.push(`고침: 「${zone.purpose ?? zone.kind}」 ${sn.dropped}`);
  const floor = design.floor && S.floors[design.floor] ? design.floor : undefined;
  const wall = design.wall && S.walls[design.wall] ? design.wall : undefined;
  if (design.floor && !floor) notes.push(`설계 바닥 「${design.floor}」는 칩셋에 없어 기본 바닥으로 지었다(있는 것: ${Object.keys(S.floors).slice(0, 12).join("·")}…)`);
  if (design.wall && !wall) notes.push(`설계 벽면 「${design.wall}」는 칩셋에 없어 기본 벽면으로 지었다(있는 것: ${Object.keys(S.walls).slice(0, 12).join("·")}…)`);
  const exitAt = normalizeDoor(design.door) ?? (shape === "T" ? 0.5 : undefined);
  return { id: zone.id ?? (n > 1 ? `${kind}${n}` : kind), kind, vig: false, tplId: undefined as string | undefined, composed: false, designed: true, design,
    w, h: fh + 2, min: { w: 5, h: 6 }, ...(floor ? { floor } : {}), ...(wall ? { wall } : {}), ...(notches.length ? { notches } : {}), ...(exitAt !== undefined ? { exitAt } : {}), zone };
}

/** 고치기: 앞 상태(마지막 인자)에서 출발해 주인공 물건만 더한다(방 배치는 그대로). */
/**
 * 방마다 쓰임 가구(교실=책상 줄·서고=책장·홀=벤치)가 서게 — 줄이고 메운 뒤에도 맨바닥 30% 넘는 방은 그 방 쓰임으로 dress_room 과 같은 규칙
 * (벽 등진 자리·같은 가구 3점·깔개 1장)으로 채운다(2026-10-28 마법학교: 견본보다 작아진 교실에 책상 두 개만 남았다).
 */
export function dressEmptyRooms(run: BuildRun, mapId: string, rooms: readonly { kind: string; id: string; purpose?: string }[], notes: string[]): void {
  const m = run.ctx.project.maps[mapId];
  if (!m) return;
  const taken = new Map<string, number>();
  for (const l of (m.locations ?? []).filter((q) => (q.tags ?? []).includes("hand-layout-room"))) {
    const k = taken.get(l.name) ?? 0; taken.set(l.name, k + 1);
    const zone = rooms.filter((r) => r.kind === l.name || r.id === l.name)[k];
    const rect = { name: l.name, x0: l.x, y0: l.y, x1: l.x + l.w - 1, y1: l.y + l.h - 1 };
    if (roomBarePct(run.ctx.project, run.ctx.project.maps[mapId]!, rect) <= DRESS_ROOM_TARGET) continue;
    // 쓰임 낱말(「입학 홀」「교수 연구실」)이 칩셋 가구 표에 없으면 방 종류(entrance·study)로 다시 — 칩셋이 아는 낱말로 내려간다.
    const at = { x: l.x + Math.floor(l.w / 2), y: l.y + l.h - 1 };
    let dressed = dressRoom(run, mapId, at, String(zone?.purpose ?? zone?.kind ?? l.name));
    for (const word of [zone?.kind, l.name]) if (!dressed.placed.length && word && /찾지 못했다/u.test(dressed.summary)) dressed = dressRoom(run, mapId, at, word);
    if (dressed.placed.length) notes.push(`${l.name}: 맨바닥 ${dressed.before}% → ${dressed.after}% — 쓰임 가구 ${dressed.placed.length}점`);
  }
}
