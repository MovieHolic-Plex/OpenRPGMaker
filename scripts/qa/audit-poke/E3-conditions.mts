import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
import { startSession } from "@/project/session";
import { eligibleEncounterEntries } from "@/player/encounters";
const project: any = deserialize(readFileSync("qa-runs/audit-poke/A1-base.json", "utf8"));
const session: any = startSession(project, 3);
console.log("project.system.timeSystem:", JSON.stringify(project.system.timeSystem ?? null), "session.gameTime:", JSON.stringify(session.gameTime ?? null));
const map: any = structuredClone(project.maps.mx_map_meadow);
const base = map.encounterTable[0].troopId;
function eligible(cond: any, s: any) { map.encounterTable = [{ troopId: base, weight: 1, conditions: cond }]; return eligibleEncounterEntries(map, s, { x: 5, y: 10 }).length > 0; }
for (const [label, cond] of [["timePhase=night", { timePhase: "night" }], ["timePhase=day", { timePhase: "day" }], ["season=summer", { season: "summer" }], ["minPartyLevel=10", { minPartyLevel: 10 }], ["switch not set", { switchId: "mx_ending" }], ["weather=rain (unknown key)", { weather: "rain" }]] as const) {
  console.log(label.padEnd(28), "eligible =", eligible(cond, { ...session, switches: {}, variables: {}, partyActorIds: session.partyActorIds ?? [], actorLevels: {} }));
}
// with an explicit time system
const s2: any = { ...session, switches: {}, variables: {}, partyActorIds: [], actorLevels: {}, gameTime: { day: 1, hour: 22, minute: 0, season: "winter", year: 1, weekday: 0 } };
console.log("with gameTime 22:00 winter -> night:", eligible({ timePhase: "night" }, s2), " day:", eligible({ timePhase: "day" }, s2), " season=winter:", eligible({ season: "winter" }, s2));
