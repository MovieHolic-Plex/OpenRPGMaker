// project/mapDoorKinds.ts
// 문의 「종류 × 크기」 — 어떤 문이 어떻게 열리는가를 그림(타일 이름표·조립 부품)에서 정한다.
//
// 문 그림은 칩셋 타일이라 프레임이 없다. 여는 연출은 `map.doors`(MapDoorDef, eventCommands/doorAnimation.ts) 한 모델이 맡고
// 런타임(player/playSceneDoors.ts)이 그 칸들의 그림을 그대로 잘라 움직인다. 여기서는 그 문 정의를 추론한다:
//   종류  auto(유리 자동문 — 다가가면 양옆으로 미끄러져 열리고, 떠나면 닫힌다) · swing(외짝 여닫이) · double(두 짝 여닫이)
//         · slide(손으로 여는 미닫이·격자문) · shutter(셔터·롤업 — 위로 말려 올라간다) · kit(타일셋에 열림 그림 짝이 있는 문 —
//         project/kitDoors.ts 가 그 그림으로 연다) · none(통로·아치·성문 통로 — 여닫는 문짝이 없다).
//   크기  1×1 · 1×2(윗칸은 같은 문의 위쪽) · 2×1·2×2(두 짝 — 한 문으로 같이 움직인다). 문짝 사각형은 런타임이 그림에서 잰다(fit:"art").
// 조수 도구(set_map_door, link_jp_city_interior·create_transfer_pair·link_maps 의 자동 기록)와 런타임(정의가 없는 옛 맵의 이동 문)이
// 같은 함수를 쓴다 — 둘이 같은 문을 같은 종류로 본다.
import { isPassable } from "@/project/collision";
import { findKitDoor } from "@/project/kitDoors";
import type { MapDoorDef } from "@/project/eventCommands/doorAnimation";
import type { GameMap, Project, TilesetDef } from "@/project/types";

type Cell = { readonly x: number; readonly y: number };

export const DOOR_KINDS = ["auto", "swing", "double", "slide", "shutter", "kit", "none"] as const;
export type DoorKind = (typeof DOOR_KINDS)[number];

/** 종류별 기본 소리(번들 CC0 SE). 편의점 입점 차임은 chime(주인공이 열 때만). */
export const DOOR_KIND_SOUNDS = {
  autoOpen: "cc0-se-osx-tools-01", // 0.5초 마른 「스윽」 — 공기 밀리는 유리 자동문
  autoClose: "cc0-se-orp-inventory-armor-light",
  chime: "cc0-se-osx-dishes-02", // 밝은 두 음 전자 차임 — 편의점 입점음
  swingOpen: "cc0-se-osx-door-open",
  swingClose: "cc0-se-osx-door-close-01",
  slideOpen: "cc0-se-ors-item-wood-03",
  shutterOpen: "cc0-se-ors-creature-slime-03", // 금속 걸쇠 + 짧은 미끄럼 기계음
} as const;

const LAYERS = ["upperOverlayTiles", "upperTiles", "lowerOverlayTiles", "lowerTiles"] as const;

type MetaLike = { label?: string; tags?: readonly string[] };
function metaOf(tileset: TilesetDef | undefined, tile: number): MetaLike | undefined {
  const meta = (tileset as { tileMeta?: unknown } | undefined)?.tileMeta;
  if (!meta || tile < 0) return undefined;
  return (Array.isArray(meta) ? meta[tile] : (meta as Record<string, unknown>)[String(tile)]) as MetaLike | undefined;
}

/** 칸의 이름표와 태그(위 층부터). */
function labelsAt(project: Project, map: GameMap, x: number, y: number): { label: string; tags: string }[] {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return [];
  const tileset = project.tilesets[map.tilesetId];
  const index = y * map.width + x;
  const out: { label: string; tags: string }[] = [];
  for (const layer of LAYERS) {
    const tile = (map[layer] as ArrayLike<number> | undefined)?.[index] ?? -1;
    const m = metaOf(tileset, tile);
    if (m) out.push({ label: (m.label ?? "").trim(), tags: (m.tags ?? []).join(" ") });
  }
  return out;
}

const STOREFRONT = /가게 정면/u;
/** 자동으로 미끄러지는 유리문·승강기·전철 문. 편의점·맨션 로비·사무실 로비 유리문이 여기다. */
const AUTO = /자동문|자동 ?유리|autodoor|auto[- ]?door|自動|스크린도어|psd|platform[- ]?door|승강장 ?문|열차 ?문|전철 ?문|train[- ]?door|car[- ]?door|엘리베이터|승강기|elevator|lift ?door|로비 ?유리문|lobby/iu;
const SHUTTER = /셔터|shutter|롤업|roll-?up|rolling[- ]?door/iu;
const SLIDE = /미닫이|격자문|lattice|장지|shoji|후스마|fusuma|노렌|noren|sliding|引き戸|마치야|machiya/iu;
/** 여닫는 문짝이 없는 출구 — 통로·아치·성문 통로·계단·동굴·열린 그림. */
const OPENING = /통로|passage|아치|arch|출입구 틈|입구|entrance|출구|exit|동굴|cave|계단|stair|사다리|ladder|구멍|hole|열린|열림|\bopen|포털|portal|문턱|threshold|창살|portcullis|걷어|성문|관문|gate(?!house)/iu;
const DOUBLE = /대문|궁문|쌍문|양문|두 ?짝|double[- ]?door|큰 문/iu;
const DOOR = /(?<![창주성관])문(?![양자서장제구화턱틀패루])|door/iu;

/** 이름표 하나의 문 종류(문이 아니면 null). 가게 정면(일체형 1층 정면 — 편의점·맨션 로비)은 유리 자동문. */
export function classifyDoorLabel(label: string): Exclude<DoorKind, "kit"> | null {
  if (STOREFRONT.test(label)) return "auto";
  if (AUTO.test(label)) return "auto";
  if (SHUTTER.test(label)) return "shutter";
  if (SLIDE.test(label)) return "slide";
  if (OPENING.test(label)) return "none";
  if (DOUBLE.test(label)) return "double";
  if (DOOR.test(label)) return "swing";
  return null;
}

function classifyCell(project: Project, map: GameMap, c: Cell): { kind: Exclude<DoorKind, "kit">; label: string } | null {
  // 이름표가 먼저다 — 태그는 이름표가 종류를 못 정할 때만 본다. 왜: 조선 대문 칸의 태그 「gate_4」(조각 이름)가
  // 통로 낱말 gate 에 걸려 「대문」(두 짝)이 문짝 없는 출구로 읽혔다(2026-10-30).
  const cells = labelsAt(project, map, c.x, c.y);
  for (const { label } of cells) {
    const kind = classifyDoorLabel(label);
    if (kind) return { kind, label };
  }
  for (const { label, tags } of cells) {
    const kind = classifyDoorLabel(tags);
    if (kind) return { kind, label: label || tags };
  }
  return null;
}

/** 이름표의 같은 부품 줄기(좌표·번호 꼬리를 뗀 것) — 옆 칸이 같은 문의 다른 칸인지 본다. */
const stem = (label: string): string => label.replace(/\s*\(\d+,\s*\d+\).*$/u, "").replace(/[_\s]\d+(?:_\d+)*$/u, "").trim();

type KitLike = { id?: string; name?: string; width?: number; height?: number; rows?: readonly { tiles?: readonly number[]; upperTiles?: readonly number[] }[] };
const KIT_DOOR = /door|문|셔터|shutter|gate/iu;

/** bottom 칸을 덮는, 맵에 그대로 찍힌 작은 문 키트(4×4 이하)의 사각형. */
function placedDoorKit(project: Project, map: GameMap, bottom: Cell): { x: number; y: number; w: number; h: number; id: string } | null {
  const kits = (project.tilesets[map.tilesetId] as { structureKits?: readonly KitLike[] } | undefined)?.structureKits ?? [];
  const at = (layer: "lowerTiles" | "upperTiles", x: number, y: number) => (map[layer] as ArrayLike<number>)[y * map.width + x] ?? -1;
  for (const kit of kits) {
    const w = kit.width ?? 0, h = kit.height ?? 0;
    if (!kit.id || w < 1 || h < 1 || w > 4 || h > 4 || !Array.isArray(kit.rows) || kit.rows.length !== h) continue;
    if (!KIT_DOOR.test(`${kit.id} ${kit.name ?? ""}`) || /open|열림|locked|잠김/iu.test(kit.id)) continue;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const ox = bottom.x - dx, oy = bottom.y - dy;
      if (ox < 0 || oy < 0 || ox + w > map.width || oy + h > map.height) continue;
      let drawn = 0, ok = true;
      for (let ky = 0; ky < h && ok; ky++) for (let kx = 0; kx < w && ok; kx++) {
        const row = kit.rows[ky]!;
        for (const [layer, tiles] of [["lowerTiles", row.tiles], ["upperTiles", row.upperTiles]] as const) {
          const t = tiles?.[kx] ?? -1;
          if (t < 0) continue;
          drawn++;
          if (at(layer, ox + kx, oy + ky) !== t) { ok = false; break; }
        }
      }
      // 문 칸(bottom)이 키트의 맨 아래 그린 줄이어야 한다 — 키트 아래 반만 문인 큰 건물은 이 함수 대상이 아니다.
      if (ok && drawn >= 2) return { x: ox, y: oy, w, h, id: kit.id };
    }
  }
  return null;
}

/**
 * 일체형 가게 정면 문(2칸)의 왼쪽 칸 x. 이름표 「… N칸(문 왼쪽|오른쪽) 칸 (c,r)」 에서 이 칸이 문의 몇 번째 칸인지 읽는다.
 * 왜: 오른쪽 짝 앞(발판을 넓힌 칸)에서 추론하면 사각형이 한 칸 오른쪽으로 밀려 벽까지 열렸다. 읽지 못하면 bottom.x.
 */
function storefrontDoorLeft(project: Project, map: GameMap, bottom: Cell, label: string): number {
  const m = /(\d+)칸\(문 (왼쪽|오른쪽)\)\s*칸\s*\((\d+),\s*\d+\)/u.exec(label);
  if (!m) return bottom.x;
  const width = Number(m[1]), col = Number(m[3]);
  const doorStart = m[2] === "왼쪽" ? 0 : width - 2;
  const offset = col - doorStart;
  if (offset !== 0 && offset !== 1) return bottom.x;
  const left = bottom.x - offset;
  const ok = classifyCell(project, map, { x: left, y: bottom.y });
  return ok && STOREFRONT.test(ok.label) ? left : bottom.x;
}

export interface InferredMapDoor {
  readonly kind: DoorKind;
  /** 문 그림 사각형(칸). kind none 이면 문 칸 하나. */
  readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** kind 가 none·kit 이 아니면 map.doors 에 넣을 정의. */
  readonly def?: MapDoorDef;
  /** 어떻게 정했는지(조수·보고용 한 줄). */
  readonly reason: string;
}

export interface InferDoorOptions {
  readonly kind?: DoorKind;
  readonly width?: number;
  readonly height?: number;
  readonly hinge?: "left" | "right";
  /** 편의점 입점 차임. 생략 = 편의점·마트 가게 정면이면 켠다. */
  readonly chime?: boolean;
  readonly openSe?: string;
  readonly closeSe?: string;
}

/** 종류·사각형 → 문 정의. 문틀 두께는 런타임이 그림에서 잰다(fit:"art"). */
export function mapDoorDefFor(kind: Exclude<DoorKind, "kit" | "none">, rect: { x: number; y: number; w: number; h: number }, opts: InferDoorOptions = {}): MapDoorDef {
  const base = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, fit: "art" as const };
  const se = (open: string, close?: string) => ({ openSe: opts.openSe ?? open, ...(opts.closeSe ?? close ? { closeSe: opts.closeSe ?? close } : {}) });
  switch (kind) {
    case "auto":
      return { ...base, style: "slide", hinge: "left", interior: "lit", auto: true, ...se(DOOR_KIND_SOUNDS.autoOpen, DOOR_KIND_SOUNDS.autoClose), ...(opts.chime ? { chimeSe: DOOR_KIND_SOUNDS.chime } : {}) };
    case "slide":
      return { ...base, style: "slide", hinge: "left", interior: "dark", ...se(DOOR_KIND_SOUNDS.slideOpen) };
    case "shutter":
      return { ...base, style: "shutter", hinge: "left", interior: "dark", ...se(DOOR_KIND_SOUNDS.shutterOpen) };
    case "double":
      return { ...base, style: "swing", hinge: "both", interior: "dark", ...se(DOOR_KIND_SOUNDS.swingOpen, DOOR_KIND_SOUNDS.swingClose) };
    case "swing":
      return { ...base, style: "swing", hinge: rect.w >= 2 ? "both" : opts.hinge ?? "left", interior: "dark", ...se(DOOR_KIND_SOUNDS.swingOpen, DOOR_KIND_SOUNDS.swingClose) };
  }
}

/**
 * at(문 그림 칸, 또는 그 바로 아래 문 앞 칸)의 문을 추론한다. 문 그림이 없으면 null(opts.kind 를 주면 그 종류로 at 위 1×2 를 문으로 본다).
 *  - 종류: opts.kind > 열림 그림 짝(kit) > 이름표 낱말(가게 정면·자동문 → auto, 셔터 → shutter, 미닫이·격자 → slide, 통로·아치 → none,
 *    대문·쌍문 → double, 그 밖의 문 → swing). 두 칸 이상 폭의 swing 은 double.
 *  - 크기: opts.width/height > 가게 정면(문 2칸 × 2줄, at 이 왼쪽 문 칸) > 맵에 찍힌 작은 문 키트 > 옆 칸 이름표(같은 부품 줄기이고
 *    그 칸 앞이 걸을 수 있는 칸, 최대 4) · 높이 2(윗칸이 막힌 벽이나 같은 문이면 — 문짝은 런타임이 그림에서 잰다).
 */
export function inferMapDoor(project: Project, map: GameMap, at: Cell, opts: InferDoorOptions = {}): InferredMapDoor | null {
  const inside = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
  if (!inside(at)) return null;
  const above = { x: at.x, y: at.y - 1 };
  const here = classifyCell(project, map, at);
  const up = inside(above) ? classifyCell(project, map, above) : null;
  // 문 앞 칸(걸을 수 있고 윗칸이 문)을 주면 윗칸이 문 그림의 맨 아래 칸이다.
  const bottom = (!here || isPassable(project, map, at.x, at.y)) && up ? above : at;
  const cls = bottom === at ? here : up;
  const kit = findKitDoor(project, map, bottom) ?? findKitDoor(project, map, at);
  if (!cls && !kit && !opts.kind) return null;
  if (kit && (!opts.kind || opts.kind === "kit")) {
    return { kind: "kit", rect: { x: kit.origin.x, y: kit.origin.y, w: kit.pair.width, h: kit.pair.height }, reason: `타일셋 열림 그림 짝 ${kit.pair.closedId} ↔ ${kit.pair.openId} — 그 그림으로 연다` };
  }
  let kind: DoorKind = opts.kind ?? cls?.kind ?? "swing";
  const label = cls?.label ?? "";
  // 크기
  let rect: { x: number; y: number; w: number; h: number };
  let how: string;
  const placed = STOREFRONT.test(label) ? null : placedDoorKit(project, map, bottom);
  if (STOREFRONT.test(label)) {
    rect = { x: storefrontDoorLeft(project, map, bottom, label), y: bottom.y - 1, w: 2, h: 2 };
    how = "일체형 가게 정면의 문(2칸 × 2줄)";
  } else if (placed) {
    rect = { x: placed.x, y: placed.y, w: placed.w, h: bottom.y - placed.y + 1 };
    how = `찍힌 문 키트 ${placed.id}`;
  } else {
    const s = stem(label);
    const same = (c: Cell) => {
      if (!inside(c) || !s) return false;
      const other = classifyCell(project, map, c);
      if (!other || stem(other.label) !== s) return false;
      const front = { x: c.x, y: c.y + 1 };
      return inside(front) && isPassable(project, map, front.x, front.y);
    };
    let x0 = bottom.x, x1 = bottom.x;
    if (kind !== "none") {
      while (x1 - x0 + 1 < 4 && same({ x: x1 + 1, y: bottom.y })) x1++;
      while (x1 - x0 + 1 < 4 && same({ x: x0 - 1, y: bottom.y })) x0--;
    }
    const tall = inside(above) && !isPassable(project, map, above.x, above.y);
    rect = { x: x0, y: tall ? bottom.y - 1 : bottom.y, w: x1 - x0 + 1, h: tall ? 2 : 1 };
    how = `이름표 「${s || label}」${x1 > x0 ? ` 옆으로 ${x1 - x0 + 1}칸` : ""}`;
  }
  if (opts.width && opts.width >= 1) rect = { ...rect, w: Math.min(4, Math.floor(opts.width)) };
  if (opts.height && opts.height >= 1) {
    const h = Math.min(4, Math.floor(opts.height));
    rect = { ...rect, y: rect.y + rect.h - h, h };
  }
  if (kind === "swing" && rect.w >= 2) kind = "double";
  if (kind === "kit" || kind === "none") {
    return { kind: kind === "kit" ? "none" : kind, rect, reason: `${how} — ${kind === "none" ? "여닫는 문짝이 없는 출구(연출 없음)" : "열림 그림 짝이 없다 — 연출 없음"}` };
  }
  const chime = opts.chime ?? (kind === "auto" && /konbini|편의점|마트|super|약국|pharmacy/iu.test(label));
  const def = mapDoorDefFor(kind, rect, { ...opts, chime });
  return { kind, rect, def, reason: `${how} · 「${label || "지정"}」 → ${kind}` };
}

/** 칸을 덮는(또는 문 그림 바로 아래 문 앞 줄의) 문 정의. */
export function mapDoorAt(doors: readonly MapDoorDef[] | undefined, cell: Cell): MapDoorDef | undefined {
  return (doors ?? []).find((d) => cell.x >= d.x && cell.x < d.x + d.w && cell.y >= d.y && cell.y <= d.y + d.h);
}

/** 문 정의를 맵에 넣는다 — 사각형이 겹치는 옛 정의는 바꾼다. */
export function upsertMapDoor(map: GameMap, def: MapDoorDef): void {
  const overlaps = (d: MapDoorDef) => d.x < def.x + def.w && def.x < d.x + d.w && d.y < def.y + def.h && def.y < d.y + d.h;
  map.doors = [...(map.doors ?? []).filter((d) => !overlaps(d)), def];
}

export function removeMapDoorsOver(map: GameMap, rect: { x: number; y: number; w: number; h: number }): number {
  const before = map.doors?.length ?? 0;
  const overlaps = (d: MapDoorDef) => d.x < rect.x + rect.w && rect.x < d.x + d.w && d.y < rect.y + rect.h && rect.y < d.y + d.h;
  map.doors = (map.doors ?? []).filter((d) => !overlaps(d));
  if (map.doors.length === 0) delete map.doors;
  return before - (map.doors?.length ?? 0);
}

/**
 * 저작 도구가 이동 문을 놓을 때 자동으로 적는 문 — 옛 여닫이 연출(외짝 swing: playSceneFieldFx 의 경첩 접힘·키트 짝)이 이미 맞는 문은
 * 적지 않고, 그 연출이 틀리는 문(자동문·미닫이·셔터·두 짝 문)만 적는다. 적은 정의를 돌려준다(없으면 undefined).
 */
export function recordInferredMapDoor(project: Project, map: GameMap, at: Cell, opts: InferDoorOptions = {}): InferredMapDoor | undefined {
  if (mapDoorAt(map.doors, at)) return undefined;
  const inferred = inferMapDoor(project, map, at, opts);
  if (!inferred?.def || inferred.kind === "swing") return undefined;
  upsertMapDoor(map, inferred.def);
  return inferred;
}
