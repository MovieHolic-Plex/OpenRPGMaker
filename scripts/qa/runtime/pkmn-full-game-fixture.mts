// 포켓몬풍 완결 게임 「몬스터 테이머」 런타임 QA 픽스처 — 새로 굽는 임시 fixture(저장하지 않는다).
//   node_modules/.bin/vite-node --root . scripts/qa/runtime/pkmn-full-game-fixture.mts
//   npm run qa:runtime -- --scenario pkmn-full-game
// 지역 맵(이끼 마을 ~ 챔피언의 탑)을 순간이동으로 돌며 네 칩셋이 출하 player 에서 그려지는지 본다.
// 걸어 다니는 동안 전투가 끼어들지 않게 조우율만 0 으로 둔다.
import { mkdirSync, writeFileSync } from "node:fs";
import { createScarloxyPokemonDemoProject } from "../../../src/project/defaults/defaultProject";

const out = process.argv[2] ?? "verify-shots/runtime-qa/pkmn-full-game/fixture.json";
mkdirSync(out.slice(0, out.lastIndexOf("/")), { recursive: true });
const project = createScarloxyPokemonDemoProject();
for (const map of Object.values(project.maps)) map.encounterRate = 0;
writeFileSync(out, JSON.stringify(project));
console.log(out);
