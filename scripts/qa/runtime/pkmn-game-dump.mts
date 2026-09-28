// 포켓몬풍 완결 게임(createScarloxyPokemonDemoProject)을 JSON 으로 덤프한다 — 오프라인 게임 검사기 입력.
//   node_modules/.bin/vite-node --root . scripts/qa/runtime/pkmn-game-dump.mts qa-runs/pkmn-game/project.json
//   bun scripts/qa-game/check.mts qa-runs/pkmn-game --budget-ms 120000
//
// --starter-level N: 스타터를 N 레벨로 주고 같은 레벨의 동료 5마리를 더 준 사본(검사 전용, 저장하지 않는다).
// 자동 플레이는 야생에서 레벨을 올리지도, 포획하지도 않고 관장에게 곧장 걸어가므로 5레벨 스타터 한 마리로는
// 관장(10~12)·라이벌(3~5마리)·챔피언(5마리)에게 진다. 진행 사슬(문·관문·퍼즐·배지·엔딩)만 보려면
//   ... pkmn-game-dump.mts qa-runs/pkmn-game-l99/project.json --starter-level 99
// 전투 밸런스는 지역 파일마다 simulateBattle 로 따로 확인했다(scarloxyPokemonRegionA/B/C.ts 머리 주석).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Command } from "../../../src/project/types";
import { createScarloxyPokemonDemoProject } from "../../../src/project/defaults/defaultProject";

const args = process.argv.slice(2);
const levelFlag = args.indexOf("--starter-level");
const starterLevel = levelFlag >= 0 ? Number(args[levelFlag + 1]) : undefined;
const out = args.find((arg, index) => !arg.startsWith("--") && index !== levelFlag + 1) ?? "qa-runs/pkmn-game/project.json";
const project = createScarloxyPokemonDemoProject();
if (starterLevel !== undefined) {
  const bump = (commands: Command[]): void => {
    for (const command of commands) {
      if (command.kind === "giveMonster") command.level = starterLevel;
      if (command.kind === "choices") for (const option of command.options) bump(option.branch);
    }
  };
  const professor = project.maps.map_pkmn_town!.events.find((event) => event.id === "ev_pkmn_professor")!;
  for (const page of professor.pages!) bump(page.commands);
  const team: Command[] = ["cindrill", "gulfin", "cleaf", "pluma", "draem"].map((key) => ({
    kind: "giveMonster", speciesId: `species_scarloxy_${key}`, level: starterLevel,
  }));
  const choose = professor.pages![0]!.commands.find((command) => command.kind === "choices");
  if (choose?.kind === "choices") for (const option of choose.options) option.branch.unshift(...team);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(project));
console.log(out);
