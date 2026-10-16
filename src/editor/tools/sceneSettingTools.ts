// build_scene_setting — 이벤트·컷씬·함정 요청이 말한 «무대»(화산·용암 다리·독늪·유적·성소)를 버들항(beodeul_city)의
// 기존 키트로 한 번에 짓는다. 새 그림을 그리지 않는다: 용암 강·바위 다리·흑요석 제단(화산 동굴 팩), 늪 물·맹그로브,
// 신전 폐허 기둥·모자이크·소신전 키트를 이벤트 좌표 둘레에 배치한다.
//
// 2026-10-15 JRPG 파일럿 실측: 조수는 이벤트 도구만 쓰고 지형을 짓지 않았다. 도구를 보이게 해도(42회 stamp_object) 어떤 키트가
// 무엇이 되는지 몰라 구석에 소품만 얹었다. 이 도구가 «장면 낱말 → 키트 조합» 을 코드로 고정한다.

import type { GameMap, Project } from "@/project/types";
import { installBeodeulArchitecture } from "@/project/defaults/beodeulArchitecture";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { SHARED_OBJECT_TOOLS, prepareSharedObject } from "./sharedObjectTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const BUILD_SCENE_SETTING_TOOL = "build_scene_setting";

export const SCENE_THEMES = ["lava_bridge", "volcano", "poison_swamp", "ruins_shrine"] as const;
export type SceneTheme = (typeof SCENE_THEMES)[number];

const KIT = "kit:beodeul_city/";
const VOLCANO = "bd-pick-volcano-cave-";
const RUINS = "bd-pick-temple-ruins-";
const SWAMP = "bd-pick-swamp-stilt-";

interface Stamp {
  readonly id: string;
  readonly dx: number;
  readonly dy: number;
}

interface Layout {
  readonly ground: { readonly material: string; readonly rx: number; readonly ry: number };
  /** 바닥 위에 먼저 깔 칠하기(물 등). 이벤트 칸과 시작 칸을 침범하지 않게 좌표를 고른다. */
  readonly fills: readonly { readonly material: string; readonly dx: number; readonly dy: number; readonly w: number; readonly h: number }[];
  /** 위에서 아래 순서로 찍는다 — 뒤에 찍은 것이 앞의 것을 덮는다. */
  readonly stamps: readonly Stamp[];
}

const s = (id: string, dx: number, dy: number): Stamp => ({ id, dx, dy });

/** 이벤트 칸 (x,y), 시작 칸 (x-1,y). 두 칸은 걸어 닿아야 하므로 아래 배치는 그 칸을 막지 않는다. */
function layoutFor(theme: SceneTheme): Layout {
  switch (theme) {
    case "lava_bridge": {
      // 용암 강이 가로로 흐르고(y-1..y), 바위 다리(3×7)가 세로로 가로지른다. 이벤트 칸은 다리 한가운데.
      const lava: Stamp[] = [];
      for (let dx = -10; dx <= 10; dx += 2) lava.push(s(`${VOLCANO}lava-strip`, dx, -1));
      return {
        ground: { material: "버들항 광장 판석", rx: 10, ry: 6 },
        fills: [],
        stamps: [
          ...lava,
          s(`${VOLCANO}bridge`, -1, -3),
          s(`${VOLCANO}lava-fall-strip`, -8, -4),
          s(`${VOLCANO}altar`, 5, -6),
          s(`${VOLCANO}brazier`, -3, -4),
          s(`${VOLCANO}brazier`, 3, -4),
          s(`${VOLCANO}spike-wide`, -7, 3),
          s(`${VOLCANO}spike-tall`, 6, 3),
          s(`${VOLCANO}steam-vent`, 4, 5),
          s(`${VOLCANO}stalagmite`, -4, 4),
          s(`${VOLCANO}fire-crystal`, 3, -2),
          s(`${VOLCANO}ember-a`, -5, 1),
        ],
      };
    }
    case "volcano":
      // 이벤트 칸 오른쪽에 용암 못과 용암 폭포, 둘레에 흑요석·증기 구멍. 왼쪽(시작 칸 쪽)은 열린 땅.
      return {
        ground: { material: "버들항 모랫길", rx: 9, ry: 6 },
        fills: [],
        stamps: [
          s(`${VOLCANO}lava-fall-strip`, 2, -5),
          s(`${VOLCANO}lava-strip`, 2, -3),
          s(`${VOLCANO}lava-strip`, 4, -3),
          s(`${VOLCANO}lava-strip`, 2, -1),
          s(`${VOLCANO}lava-strip`, 4, -1),
          s(`${VOLCANO}lava-strip`, 6, -2),
          s(`${VOLCANO}lava-strip`, 3, 1),
          s(`${VOLCANO}lava-strip`, 5, 1),
          s(`${VOLCANO}spike-wide`, -5, -4),
          s(`${VOLCANO}spike-tall`, 8, 2),
          s(`${VOLCANO}spike-small`, -3, 3),
          s(`${VOLCANO}steam-vent`, 0, -2),
          s(`${VOLCANO}steam-vent`, 1, 3),
          s(`${VOLCANO}fire-crystal`, 7, -4),
          s(`${VOLCANO}brazier`, -3, -2),
          s(`${VOLCANO}ember-a`, -1, 1),
          s(`${VOLCANO}stalagmite`, -6, 2),
        ],
      };
    case "poison_swamp":
      // 이벤트 칸은 늪 가장자리 뭍. 늪(물)은 오른쪽으로 번지고 증기 구멍이 독기 분출구 역할.
      return {
        ground: { material: "버들항 풀밭", rx: 9, ry: 6 },
        fills: [
          { material: "버들항 물", dx: 2, dy: -4, w: 8, h: 8 },
          { material: "버들항 물", dx: 1, dy: -2, w: 10, h: 5 },
          { material: "버들항 물", dx: 4, dy: -5, w: 5, h: 10 },
        ],
        stamps: [
          s(`${SWAMP}mangrove`, 0, -6),
          s(`${SWAMP}mangrove`, 9, -6),
          s(`${SWAMP}mangrove`, 8, 5),
          s(`${SWAMP}pilings`, 5, -1),
          s(`${SWAMP}pilings`, 8, 1),
          s(`${SWAMP}reed-stack`, -2, 3),
          s(`${SWAMP}moss-log`, 2, 5),
          s(`${SWAMP}lantern`, -4, 2),
          s(`${VOLCANO}steam-vent`, 3, -1),
          s(`${VOLCANO}steam-vent`, 6, 1),
          s(`${VOLCANO}steam-vent`, 5, -3),
          s(`${RUINS}column-temple-broken`, -3, -4),
          s(`${RUINS}rubble-temple`, -6, 0),
        ],
      };
    case "ruins_shrine":
      // 모자이크 메달리온(7×7) 위에 이벤트 칸, 북쪽에 소신전과 제단 닫집, 둘레에 기둥·잔해.
      return {
        ground: { material: "버들항 광장 판석", rx: 9, ry: 7 },
        fills: [],
        stamps: [
          s(`${RUINS}mosaic-medallion-7x7`, -3, -3),
          s(`${RUINS}roof-naiskos-pediment`, -2, -9),
          s(`${RUINS}column-temple-tall`, -6, -4),
          s(`${RUINS}column-temple-tall`, 6, -4),
          s(`${RUINS}column-temple-broken`, -6, 3),
          s(`${RUINS}column-temple-broken`, 6, 3),
          s(`${RUINS}fallen-column-temple`, -9, 5),
          s(`${RUINS}rubble-temple`, 4, 5),
          s(`${VOLCANO}brazier`, -5, -2),
          s(`${VOLCANO}brazier`, 5, -2),
          s(`${RUINS}ruined-wall-2`, 8, 0),
        ],
      };
  }
}

function toolByName(list: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = list.find((t) => t.name === name);
  if (!tool) throw new Error(`내부 도구를 찾지 못했습니다: ${name}`);
  return tool;
}

/** 다리 칸(x-1..x+1, 용암 띠 y-1..y)을 옆 용암 칸의 타일로 바꾸면 다리가 무너져 보인다. 용암 칸 번호는 홀짝 칸마다 다르다. */
function bridgeCollapse(map: GameMap, x: number, y: number): { layer: "lower"; cells: { x: number; y: number; tile: number }[] } {
  const cells: { x: number; y: number; tile: number }[] = [];
  for (const cy of [y - 1, y]) {
    for (const cx of [x - 1, x, x + 1]) {
      let refX = cx - 2;
      while (refX >= x - 1) refX -= 2;
      if (refX < 0 || cx >= map.width || cy < 0 || cy >= map.height) continue;
      cells.push({ x: cx, y: cy, tile: map.lowerTiles[cy * map.width + refX] ?? -1 });
    }
  }
  return { layer: "lower", cells: cells.filter((c) => c.tile >= 0) };
}

function themeKitIds(theme: SceneTheme): string[] {
  return [...new Set(layoutFor(theme).stamps.map((st) => KIT + st.id))];
}

function clampRect(map: GameMap, x: number, y: number, w: number, h: number) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(map.width, x + w);
  const y1 = Math.min(map.height, y + h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export const SCENE_SETTING_TOOLS: readonly ToolDefinition[] = [
  {
    name: BUILD_SCENE_SETTING_TOOL,
    mode: "write",
    domains: ["map", "tile"],
    description:
      "이벤트·컷씬·함정이 놓일 «무대» 를 이벤트 좌표 둘레에 한 번에 짓는다(버들항 beodeul_city 맵 전용, 새 그림 없이 기존 키트). "
      + "theme: volcano(화산 열풍·용암 못·흑요석·증기 구멍) · lava_bridge(용암 강 + 바위 다리가 가로지름, 이벤트 칸이 다리 위) · "
      + "poison_swamp(독늪·맹그로브·증기 분출구, 이벤트 칸은 늪 가장자리) · ruins_shrine(마도·고대 유적/성소: 모자이크 바닥·소신전·기둥·화로). "
      + "x,y 는 이벤트(트리거) 칸이고 x-1,y 는 플레이어가 걸어 들어오는 칸이다 — 이 두 칸은 막지 않는다. 이 좌표 둘레 한 구역만 바꾸고 맵의 나머지는 보존한다. "
      + "houses 는 volcano 에서 «마을 외곽» 을 말할 때만(0~3) 구역 밖 모서리에 마을 집을 얹는다. 짓고 나서 show_map_region 으로 그림을 확인하고 이벤트를 만든다.",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string", description: "대상 맵 id(생략 시 현재 맵)" },
        theme: { type: "string", enum: [...SCENE_THEMES] },
        x: { type: "integer", description: "이벤트(트리거) 칸 x" },
        y: { type: "integer", description: "이벤트(트리거) 칸 y" },
        houses: { type: "integer", minimum: 0, maximum: 3, description: "volcano 전용: 마을 집 채수(0~3). 생략하면 0" },
      },
      required: ["theme", "x", "y"],
      additionalProperties: false,
    },
    invalidArgsExample: { mapId: "map_id", theme: "volcano", x: 16, y: 11 },
    prepare: async (args) => {
      const theme = args.theme as SceneTheme;
      if (!SCENE_THEMES.includes(theme)) return;
      await Promise.all(themeKitIds(theme).map((id) => prepareSharedObject(id)));
    },
    run(project: Project, args: Readonly<Record<string, unknown>>): ToolExecResult {
      const theme = args.theme as SceneTheme;
      if (!SCENE_THEMES.includes(theme)) throw new ToolError(`theme 은 ${SCENE_THEMES.join(" | ")} 중 하나여야 합니다`, { code: "bad-theme" });
      const mapId = String(args.mapId ?? "");
      const map = project.maps[mapId];
      if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found" });
      if (map.tilesetId !== "beodeul_city") {
        throw new ToolError(
          `build_scene_setting 은 버들항(beodeul_city) 맵 전용입니다 — 이 맵 칩셋은 ${map.tilesetId}. list_spatial_designs·stamp_object 로 이 칩셋의 오브젝트를 직접 찍으세요.`,
          { code: "tileset-not-supported" },
        );
      }
      const x = Number(args.x);
      const y = Number(args.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) {
        throw new ToolError(`좌표 (${args.x},${args.y}) 가 맵 ${map.width}×${map.height} 밖입니다`, { code: "out-of-map" });
      }

      const layout = layoutFor(theme);
      const fill = toolByName(CONSTRUCTION_TOOLS_V3, "fill_region");
      const stamp = toolByName(SHARED_OBJECT_TOOLS, "stamp_object");
      const warnings: string[] = [];
      const built: string[] = [];

      const g = layout.ground;
      const ground = clampRect(map, x - g.rx, y - g.ry, g.rx * 2 + 1, g.ry * 2 + 1);
      fill.run(project, { mapId, rect: ground, material: g.material, clearUpper: true });
      built.push(`바닥 ${g.material} ${ground.w}×${ground.h}`);

      for (const f of layout.fills) {
        const r = clampRect(map, x + f.dx, y + f.dy, f.w, f.h);
        if (r.w === 0 || r.h === 0) continue;
        try {
          fill.run(project, { mapId, rect: r, material: f.material, clearUpper: true });
        } catch (error) {
          warnings.push(`${f.material} 칠하기 실패: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (layout.fills.length) built.push(`${layout.fills[0]!.material} 영역`);

      let stamped = 0;
      for (const st of layout.stamps) {
        try {
          stamp.run(project, { objectId: KIT + st.id, mapId, x: x + st.dx, y: y + st.dy });
          stamped++;
        } catch (error) {
          warnings.push(`${st.id} (${x + st.dx},${y + st.dy}) 건너뜀: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`);
        }
      }
      built.push(`키트 ${stamped}/${layout.stamps.length}개`);

      const houses = theme === "volcano" ? Math.max(0, Math.min(3, Math.trunc(Number(args.houses ?? 0)))) : 0;
      if (houses > 0) {
        const slots: readonly { id: string; hx: number; hy: number; w: number; h: number }[] = [
          { id: "bd-house-village-cream", hx: 0, hy: 0, w: 7, h: 6 },
          { id: "bd-house-village-ochre", hx: 0, hy: 7, w: 6, h: 6 },
          { id: "bd-house-village-stone", hx: 8, hy: 0, w: 4, h: 6 },
        ];
        if (!project.tilesets.beodeul_city?.structureKits?.some((k) => k.id === slots[0]!.id)) installBeodeulArchitecture(project);
        const hot = { x0: x + 1, x1: x + g.rx, y0: y - 5, y1: y + 3 };
        let placed = 0;
        for (const slot of slots) {
          if (placed >= houses) break;
          const overlapsHot = slot.hx + slot.w > hot.x0 && slot.hx <= hot.x1 && slot.hy + slot.h > hot.y0 && slot.hy <= hot.y1;
          if (overlapsHot) continue;
          try {
            stamp.run(project, { objectId: KIT + slot.id, mapId, x: slot.hx, y: slot.hy });
            placed++;
          } catch (error) {
            warnings.push(`${slot.id} (${slot.hx},${slot.hy}) 건너뜀: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`);
          }
        }
        built.push(`마을 집 ${placed}채`);
      }

      const collapse = theme === "lava_bridge" ? bridgeCollapse(map, x, y) : undefined;
      return {
        summary: `무대 ${theme} → ${mapId} 이벤트 칸 (${x},${y}) 둘레: ${built.join(" · ")}. 이제 show_map_region 으로 확인하고 (${x},${y}) 에 이벤트를 만든다 — 시작 칸 (${x - 1},${y}) 은 막혀 있지 않다.${collapse ? ` 다리 붕괴 연출은 사망 분기에서 data.collapse.cells ${collapse.cells.length}칸에 changeTile{mapId,layer:"lower",x,y,tile} 을 적용한다.` : ""}`,
        data: { theme, mapId, focus: { x, y }, start: { x: x - 1, y }, ground, stamped, total: layout.stamps.length, ...(collapse ? { collapse } : {}) },
        ...(warnings.length ? { warnings } : {}),
      };
    },
  },
];
