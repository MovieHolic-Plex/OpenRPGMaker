// 포켓몬풍 데모의 마을·1번 길 배열을 덤프한다 — prepare-monster-town-kit-references.mjs 의 완성 예제 입력.
// 실행: node_modules/.bin/vite-node --root . scripts/content/dump-pokemon-demo-maps.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { createScarloxyPokemonDemoProject } from "@/project/defaults/defaultProject";

const project = createScarloxyPokemonDemoProject();
const maps = ["map_pkmn_town", "map_pkmn_route"].map((id) => {
  const map = project.maps[id]!;
  return { id, w: map.width, h: map.height, lower: map.lowerTiles, upper: map.upperTiles, events: map.events.map((event) => [event.x, event.y]) };
});
mkdirSync(".omo/tmp", { recursive: true });
writeFileSync(".omo/tmp/pkmn-maps.json", JSON.stringify(maps));
console.log(".omo/tmp/pkmn-maps.json");

