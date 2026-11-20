import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import type { Project } from "@/project/types";

export const MAP = {
  street: "map_kc_street",
  home: "map_kc_home",
  bakery: "map_kc_bakery",
  depot: "map_kc_depot",
  police: "map_kc_police",
} as const;

const INTERIORS = [
  { id: MAP.home, name: "윤미소의 집", program: "mc_apartment", facade: "apartment" },
  { id: MAP.bakery, name: "보리빵집", program: "mc_bakery_cafe", facade: "cafe" },
  { id: MAP.depot, name: "솔목시장 창고", program: "mc_logistics", facade: "garage" },
  { id: MAP.police, name: "솔목경찰서", program: "mc_police", facade: "office" },
] as const;

export function author(project: Project, name: string, args: Record<string, unknown>) {
  const context = { project, assistantRun: false };
  const result = runTool(context, name, args, { dryRun: false });
  if (!result.ok) throw new Error(`[kimchi-case] ${name}: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  Object.assign(project, context.project);
  return result;
}

export function buildKimchiCaseMaps(project: Project): void {
  project.tilesets[JP_CITY_ID] = createJpCityTileset();
  const street = {
    ...createStarterMap(),
    id: MAP.street, name: "솔목시장 김치 축제", width: 40, height: 28, tilesetId: JP_CITY_ID,
    lowerTiles: Array<number>(40 * 28).fill(blankFillTileFor(JP_CITY_ID)),
    upperTiles: Array<number>(40 * 28).fill(-1),
  };
  project.startMapId = street.id;
  project.startPos = { x: 22, y: 12 };
  project.maps = { [street.id]: street };
  project.mapTree = { mapId: street.id, children: [] };
  author(project, "compose_jp_city_street", {
    mapId: street.id, style: "shopping", seed: 3,
    shops: INTERIORS.map(({ facade }) => facade), replace: true, avoidProps: ["bike"],
  });
  for (const { id, name, program, facade } of INTERIORS) {
    author(project, "build_hand_interior_room", {
      mapId: id, name, tileset: "modern_city", replace: true, layout: { program, seed: 1, furnish: true },
    });
    const door = project.maps[street.id]!.locations?.filter((location) =>
      location.tags?.includes("jp-building") && location.tags.includes(facade) && !location.note?.includes("닿지 않음"))
      .map((location) => /문 \((\d+),(\d+)\)/u.exec(location.note ?? "")).find(Boolean);
    if (!door) throw new Error(`[kimchi-case] ${name} 외부 문이 없다`);
    author(project, "link_jp_city_interior", {
      mapId: street.id, door: { x: Number(door[1]), y: Number(door[2]) }, interiorMapId: id, replace: true,
    });
  }
  project.mapTree = { mapId: street.id, children: INTERIORS.map(({ id }) => ({ mapId: id, children: [] })) };
  const used = new Set(Object.values(project.maps).map((map) => map.tilesetId));
  for (const id of used) for (const graft of project.tilesets[id]?.tileGrafts ?? []) used.add(graft.sourceChipset);
  for (const id of Object.keys(project.tilesets)) if (!used.has(id)) delete project.tilesets[id];
}
