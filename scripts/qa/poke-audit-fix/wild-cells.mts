// bun 전용: 1번길에서 야생 조우가 실제로 나는 칸(풀숲)을 JSON 으로 쓴다. poke-vqa.capture.mjs 의 WILD_CELLS 가 읽는다.
//   bun scripts/qa/poke-audit-fix/wild-cells.mts <campaign.json> <out.json>
import { writeFileSync, readFileSync } from "node:fs";
import { deserialize } from "@/project/io";
import { eligibleEncounterEntries } from "@/player/encounters";
import { canMove } from "@/project/collision";
const project: any = deserialize(readFileSync(process.argv[2]!, "utf8"));
const session: any = { switches: { mx_starter: true }, variables: {}, partyActorIds: ["actor_hero"], actorLevels: { actor_hero: 5 }, gameTime: { totalMinutes: 600 } };
const map = project.maps["mx_map_meadow"];
const cells: number[][] = [];
for (let y = 0; y < map.height; y++) for (let x = 1; x < map.width - 1; x++) {
  if (eligibleEncounterEntries(map, session, { x, y }, project).length > 0 && canMove(project, map, x, y, x + 1, y) && canMove(project, map, x + 1, y, x, y)) cells.push([x, y]);
}
writeFileSync(process.argv[3]!, JSON.stringify(cells)); console.log(cells.length);
