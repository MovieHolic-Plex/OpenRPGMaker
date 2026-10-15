import { readFileSync } from "node:fs";
import { createSession } from "@/project/session";
import { giveMonster, moveMonster, MONSTER_PARTY_MAX } from "@/project/monsterCollection";
import { monsterJournalEntry, recordMonsterSeen, reconcileMonsterJournal } from "@/project/monsterJournal";
import { tradeMonster, removeMonster } from "@/project/monsterTrade";
import * as S from "@/project/session";
const project = JSON.parse(readFileSync("qa-runs/audit-poke/A5-game.json", "utf8"));
const mk = (p: any) => (S as any).startSession(p, 7);

const session = mk(project);
const sp = project.database.monsterSpecies.map((s: any) => s.id);
const out: any = {};
for (let i = 0; i < 400; i++) giveMonster(project, session, { speciesId: sp[i % sp.length], level: 5 });
out.partyLen = session.monsterParty.length; out.boxLen = session.monsterBox.length; out.partyMax = MONSTER_PARTY_MAX;
const r = moveMonster(session, session.monsterBox[0], "party", project); out.moveWhenFull = r;
out.sessionBoxIsFlatArrayOfIds = Array.isArray(session.monsterBox) && typeof session.monsterBox[0] === "string";
out.sessionKeysBoxRelated = Object.keys(session).filter(k => /box/i.test(k));
// journal: seen vs caught
const s2 = mk(project);
recordMonsterSeen(project, s2, sp[10]);
out.seenOnly = monsterJournalEntry(s2, sp[10]);
giveMonster(project, s2, { speciesId: sp[0], level: 5 });
out.caught = monsterJournalEntry(s2, sp[0]);
const camp = project.system.monsterCampaign; out.campaignKeys = Object.keys(camp); out.noteSample = camp.speciesNotes[sp[0]]?.slice(0, 40);
out.journalFieldsOnSpecies = Object.keys(project.database.monsterSpecies[0]);
// trade
const s3 = mk(project);
giveMonster(project, s3, { speciesId: sp[0], level: 9 }); giveMonster(project, s3, { speciesId: sp[3], level: 9 });
out.trade = tradeMonster(project, s3, { fromSpeciesId: sp[3], toSpeciesId: sp[20] });
out.partyAfterTrade = s3.monsterParty.map((id: string) => s3.monsterInstances[id].speciesId);
out.tradeNoOffer = tradeMonster(project, s3, { fromSpeciesId: sp[40], toSpeciesId: sp[20] });
out.instanceKeys = Object.keys(Object.values(s3.monsterInstances)[0] as any);
console.log(JSON.stringify(out, null, 1));
