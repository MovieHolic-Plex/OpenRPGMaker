// 포켓몬풍 완결 게임(createScarloxyPokemonDemoProject)을 JSON 으로 덤프한다 — 오프라인 게임 검사기 입력.
//   node_modules/.bin/vite-node --root . scripts/qa/runtime/pkmn-game-dump.mts qa-runs/pkmn-game/project.json
//   bun scripts/qa-game/check.mts qa-runs/pkmn-game --budget-ms 120000
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createScarloxyPokemonDemoProject } from "../../../src/project/defaults/defaultProject";

const out = process.argv[2] ?? "qa-runs/pkmn-game/project.json";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(createScarloxyPokemonDemoProject()));
console.log(out);
