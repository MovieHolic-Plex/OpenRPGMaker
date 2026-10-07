import type { Project } from "@/project/types";
import { createProjectWithMaps } from "@/project/defaults/blankProject";
import { createBlankMap, singleNodeTree } from "@/project/defaults/defaultMaps";
import { GRASSLAND_TILESET_ID } from "@/project/defaults/scarloxyDemoGame";
import { configureScarloxyPokemonDemoProject } from "@/project/defaults/scarloxyPokemonDemoGame";

/**
 * 몬스터 전투·포획 테스트용 프로젝트. 옛 Scarloxy 포켓몬풍 데모 맵(실내가 지운 EasyRPG 실내 칩셋)은
 * 2026-10-07 저작권 정리로 지웠다. 데모의 DB 구성은 그대로 두고, 맵은 같은 id 의 빈 Scarloxy 초원 두 장만 둔다.
 */
export function createScarloxyPokemonDemoProject(): Project {
  const town = createBlankMap("새싹 마을", 26, 18, GRASSLAND_TILESET_ID);
  town.id = "map_pkmn_town";
  const route = createBlankMap("초원 1번 길", 30, 24, GRASSLAND_TILESET_ID);
  route.id = "map_pkmn_route";
  const project = createProjectWithMaps([town, route], 0);
  project.mapTree = { mapId: town.id, children: [singleNodeTree(route.id)] };
  configureScarloxyPokemonDemoProject(project);
  return project;
}
