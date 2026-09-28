// 몬스터 마을 부품 칩셋 런타임 QA 픽스처 — 포켓몬풍 데모를 새로 굽는다(저장하지 않는 임시 fixture).
// 새싹 마을·초원 1번 길은 960칸 시트(scarloxy_chipset_monster_town_kit)를 쓴다. 출하 player 가
// 480 넘는 칸(부품)을 실제로 그리는지 보려고 시작 지점을 부품이 모인 자리로 옮긴다.
import { writeFileSync, mkdirSync } from "node:fs";
import { createScarloxyPokemonDemoProject } from "../../../src/project/defaults/defaultProject";

const out = process.argv[2] ?? "verify-shots/runtime-qa/monster-town-kit/fixture.json";
mkdirSync(out.slice(0, out.lastIndexOf("/")), { recursive: true });
const project = createScarloxyPokemonDemoProject();
project.startMapId = "map_pkmn_route";
project.startPos = { x: 15, y: 10 };
// 걸어서 전투가 끼어들지 않게 한다(렌더만 본다).
project.maps.map_pkmn_route!.encounterRate = 0;
writeFileSync(out, JSON.stringify(project));
console.log(out);

