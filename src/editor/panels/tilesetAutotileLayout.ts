import {
  buildEdgeCornerInnerVariantMap,
  buildEdgeCornerVariantMap,
  AUTOTILE_DIR,
  type EdgeCornerInnerTileSet,
  type EdgeCornerTileSet,
} from "@/project/defaults/autotileEngine";
import type { AutotileGroup, AutotileNeighborhood } from "@/project/types";
import type { AutotileTemplateGroupKind } from "@/editor/panels/tilesetAutotileTemplates";

// 오토타일 설정의 사람용 레이아웃. 엔진의 비트마스크·이웃 범위는 여기서 파생한다.
// 9칸 = 3×3(모서리·변·몸통), 11칸 = RM2K 3×4(외딴 점·오목 코너 추가).

export type AutotileLayoutKind = "cells-11" | "cells-9" | "cells-6" | "custom";

export type AutotileRole =
  | "isolated"
  | "inner"
  | "cornerNW"
  | "edgeN"
  | "cornerNE"
  | "edgeW"
  | "body"
  | "edgeE"
  | "cornerSW"
  | "edgeS"
  | "cornerSE";

export type AutotileRoleTiles = Partial<Record<AutotileRole, number>>;

export const AUTOTILE_ROLE_LABEL: Record<AutotileRole, string> = {
  isolated: "외딴 점",
  inner: "오목 코너",
  body: "몸통",
  edgeN: "북쪽",
  edgeS: "남쪽",
  edgeW: "서쪽",
  edgeE: "동쪽",
  cornerNW: "북서",
  cornerNE: "북동",
  cornerSW: "남서",
  cornerSE: "남동",
};

export const AUTOTILE_LAYOUT_GUIDES: readonly {
  id: AutotileLayoutKind;
  label: string;
  blurb: string;
  templateKind: AutotileTemplateGroupKind | null;
}[] = [
          { id: "cells-9", label: "9칸", blurb: "3×3 모서리·변·몸통", templateKind: "grid-3x3" },
  { id: "cells-11", label: "11칸", blurb: "3×4 외딴 점·오목 코너", templateKind: "oprn-3x4" },
  { id: "custom", label: "커스텀", blurb: "칸마다 직접 지정", templateKind: null },
];

const ROLES_9: readonly AutotileRole[] = [
  "cornerNW", "edgeN", "cornerNE",
  "edgeW", "body", "edgeE",
  "cornerSW", "edgeS", "cornerSE",
];

const ROLES_11: readonly AutotileRole[] = [...ROLES_9, "isolated", "inner"];

const ROLES_6: readonly AutotileRole[] = [
  "cornerNW", "edgeN", "cornerNE",
  "cornerSW", "edgeS", "cornerSE",
];

const MEMBER_ORDER_11: readonly AutotileRole[] = [
  "body", "edgeN", "edgeS", "edgeW", "edgeE",
  "cornerNW", "cornerNE", "cornerSW", "cornerSE",
  "isolated", "inner",
];

const MEMBER_ORDER_9: readonly AutotileRole[] = [
  "cornerNW", "edgeN", "cornerNE",
  "edgeW", "body", "edgeE",
  "cornerSW", "edgeS", "cornerSE",
];

const MEMBER_ORDER_6: readonly AutotileRole[] = [
  "cornerNW", "edgeN", "cornerNE",
  "cornerSW", "edgeS", "cornerSE",
];

const { N, E, S, W } = AUTOTILE_DIR;

export function layoutGrid(kind: AutotileLayoutKind): readonly (readonly (AutotileRole | null)[])[] {
  if (kind === "cells-9") {
    return [
      ["cornerNW", "edgeN", "cornerNE"],
      ["edgeW", "body", "edgeE"],
      ["cornerSW", "edgeS", "cornerSE"],
    ];
  }
  if (kind === "cells-6") {
    return [
      ["cornerNW", "edgeN", "cornerNE"],
      ["cornerSW", "edgeS", "cornerSE"],
    ];
  }
  return [
    ["isolated", null, "inner"],
    ["cornerNW", "edgeN", "cornerNE"],
    ["edgeW", "body", "edgeE"],
    ["cornerSW", "edgeS", "cornerSE"],
  ];
}

export function requiredRoles(kind: AutotileLayoutKind): readonly AutotileRole[] {
  if (kind === "cells-9") return ROLES_9;
  if (kind === "cells-6") return ROLES_6;
  if (kind === "cells-11") return ROLES_11;
  return ROLES_9;
}

export function layoutLabel(kind: AutotileLayoutKind): string {
  if (kind === "cells-11") return "11칸";
  if (kind === "cells-9") return "9칸";
  if (kind === "cells-6") return "6칸";
  return "커스텀";
}

export function layoutBlockSize(kind: AutotileLayoutKind | "animated-water"): { rows: number; cols: number } {
  if (kind === "cells-9") return { rows: 3, cols: 3 };
  if (kind === "cells-6") return { rows: 2, cols: 3 };
  if (kind === "animated-water") return { rows: 1, cols: 3 };
  if (kind === "custom") return { rows: 1, cols: 1 };
  return { rows: 4, cols: 3 };
}

export function tilesInLayoutBlock(
  kind: AutotileLayoutKind | "animated-water",
  anchorTile: number,
  tilesPerRow: number,
  tileCount: number,
): number[] {
  const { rows, cols } = layoutBlockSize(kind);
  const column = anchorTile % tilesPerRow;
  if (column + cols > tilesPerRow) return [];
  const last = anchorTile + (rows - 1) * tilesPerRow + (cols - 1);
  if (last >= tileCount) return [];
  const tiles: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      tiles.push(anchorTile + row * tilesPerRow + col);
    }
  }
  return tiles;
}

export function templateKindForLayout(kind: AutotileLayoutKind): AutotileTemplateGroupKind | null {
  if (kind === "cells-11") return "oprn-3x4";
  if (kind === "cells-9") return "grid-3x3";
  if (kind === "cells-6") return "grid-3x2";
  return null;
}

export function inferAutotileLayoutKind(group: AutotileGroup): AutotileLayoutKind {
  const unique = new Set(group.memberTileIds).size;
  const neighborhood = group.neighborhood ?? 4;
  if (neighborhood === 8 && unique >= 11) return "cells-11";
  if (unique === 9) return "cells-9";
  if (unique === 6) return "cells-6";
  return "custom";
}

export function rolesFromGroup(group: AutotileGroup): AutotileRoleTiles {
  const fromMap = rolesFromVariantMap(group);
  const fromMembers = rolesFromMemberOrder(group);
  return { ...fromMembers, ...fromMap };
}

function rolesFromMemberOrder(group: AutotileGroup): AutotileRoleTiles {
  const ids = group.memberTileIds;
  const order =
    ids.length >= 11 ? MEMBER_ORDER_11
    : ids.length === 9 ? MEMBER_ORDER_9
    : ids.length === 6 ? MEMBER_ORDER_6
    : null;
  if (!order) return {};
  const roles: AutotileRoleTiles = {};
  for (const [index, role] of order.entries()) {
    const tile = ids[index];
    if (tile !== undefined) roles[role] = tile;
  }
  return roles;
}

function rolesFromVariantMap(group: AutotileGroup): AutotileRoleTiles {
  const map = group.variantMap;
  const at = (mask: number): number | undefined => {
    const tile = map[String(mask)];
    return typeof tile === "number" ? tile : undefined;
  };
  const roles: AutotileRoleTiles = {};
  const body4 = at(N | E | S | W);
  const isolated = at(0);
  if (group.neighborhood === 8) {
    const body8 = at(255);
    if (body8 !== undefined) roles.body = body8;
    else if (body4 !== undefined) roles.body = body4;
    if (isolated !== undefined) roles.isolated = isolated;
    if (body4 !== undefined) roles.inner = body4;
  } else {
    if (body4 !== undefined) roles.body = body4;
    if (isolated !== undefined) roles.cornerNW = isolated;
  }
  const edgeN = at(E | S | W);
  const edgeS = at(N | E | W);
  const edgeW = at(N | E | S);
  const edgeE = at(N | S | W);
  const cornerNW = at(E | S);
  const cornerNE = at(S | W);
  const cornerSW = at(N | E);
  const cornerSE = at(N | W);
  if (edgeN !== undefined) roles.edgeN = edgeN;
  if (edgeS !== undefined) roles.edgeS = edgeS;
  if (edgeW !== undefined) roles.edgeW = edgeW;
  if (edgeE !== undefined) roles.edgeE = edgeE;
  if (cornerNW !== undefined) roles.cornerNW = cornerNW;
  if (cornerNE !== undefined) roles.cornerNE = cornerNE;
  if (cornerSW !== undefined) roles.cornerSW = cornerSW;
  if (cornerSE !== undefined) roles.cornerSE = cornerSE;
  return roles;
}

export function filledRoleCount(kind: AutotileLayoutKind, roles: AutotileRoleTiles): { filled: number; total: number } {
  const needed = requiredRoles(kind);
  let filled = 0;
  for (const role of needed) {
    if (roles[role] !== undefined) filled += 1;
  }
  return { filled, total: needed.length };
}

export function firstEmptyRole(kind: AutotileLayoutKind, roles: AutotileRoleTiles): AutotileRole | null {
  for (const role of requiredRoles(kind)) {
    if (roles[role] === undefined) return role;
  }
  return null;
}

export function bodyTileOf(roles: AutotileRoleTiles, members: readonly number[]): number | undefined {
  return roles.body ?? members[0];
}

export type AutotileGroupLayoutPatch = {
  neighborhood: AutotileNeighborhood;
  memberTileIds: number[];
  connectTileIds: number[];
  variantMap: Record<string, number>;
};

export function groupPatchFromRoles(
  kind: AutotileLayoutKind,
  roles: AutotileRoleTiles,
): AutotileGroupLayoutPatch | null {
  const needed = requiredRoles(kind);
  const complete = needed.every((role) => roles[role] !== undefined);
  const memberTileIds = uniqueTiles(needed.map((role) => roles[role]).filter((tile): tile is number => tile !== undefined));
  if (!complete) {
    return {
      neighborhood: kind === "cells-11" ? 8 : 4,
      memberTileIds,
      connectTileIds: [...memberTileIds],
      variantMap: {},
    };
  }
  if (kind === "cells-11") {
    const tiles = completeInnerTiles(roles);
    if (!tiles) return null;
    const members = uniqueTiles([
      tiles.body, tiles.edgeN, tiles.edgeS, tiles.edgeW, tiles.edgeE,
      tiles.cornerNW, tiles.cornerNE, tiles.cornerSW, tiles.cornerSE,
      tiles.isolated, tiles.inner,
    ]);
    return {
      neighborhood: 8,
      memberTileIds: members,
      connectTileIds: [...members],
      variantMap: buildEdgeCornerInnerVariantMap(tiles),
    };
  }
  const tiles = completeEdgeTiles(kind, roles);
  if (!tiles) return null;
  const members = kind === "cells-6"
    ? uniqueTiles([tiles.cornerNW, tiles.edgeN, tiles.cornerNE, tiles.cornerSW, tiles.edgeS, tiles.cornerSE])
    : uniqueTiles([
        tiles.cornerNW, tiles.edgeN, tiles.cornerNE,
        tiles.edgeW, tiles.body, tiles.edgeE,
        tiles.cornerSW, tiles.edgeS, tiles.cornerSE,
      ]);
  return {
    neighborhood: 4,
    memberTileIds: members,
    connectTileIds: [...members],
    variantMap: buildEdgeCornerVariantMap(tiles),
  };
}

function completeEdgeTiles(kind: AutotileLayoutKind, roles: AutotileRoleTiles): EdgeCornerTileSet | null {
  if (kind === "cells-6") {
    const nw = roles.cornerNW;
    const n = roles.edgeN;
    const ne = roles.cornerNE;
    const sw = roles.cornerSW;
    const s = roles.edgeS;
    const se = roles.cornerSE;
    if (nw === undefined || n === undefined || ne === undefined || sw === undefined || s === undefined || se === undefined) {
      return null;
    }
    return {
      cornerNW: nw, edgeN: n, cornerNE: ne,
      edgeW: nw, body: n, edgeE: ne,
      cornerSW: sw, edgeS: s, cornerSE: se,
    };
  }
  const keys: (keyof EdgeCornerTileSet)[] = [
    "body", "edgeN", "edgeS", "edgeW", "edgeE",
    "cornerNW", "cornerNE", "cornerSW", "cornerSE",
  ];
  const tiles = {} as Record<keyof EdgeCornerTileSet, number>;
  for (const key of keys) {
    const value = roles[key];
    if (value === undefined) return null;
    tiles[key] = value;
  }
  return tiles;
}

function completeInnerTiles(roles: AutotileRoleTiles): EdgeCornerInnerTileSet | null {
  const edge = completeEdgeTiles("cells-11", roles);
  if (!edge || roles.isolated === undefined || roles.inner === undefined) return null;
  return { ...edge, isolated: roles.isolated, inner: roles.inner };
}

function uniqueTiles(ids: readonly number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function friendlyLayoutName(kind: AutotileLayoutKind): string {
  return `${layoutLabel(kind)} 오토타일`;
}
