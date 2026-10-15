import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { startSession } from "../../../src/project/session";
import { giveMonster } from "../../../src/project/monsterCollection";
import { useItemFromMenu } from "../../../src/player/playerItemUse";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
const project=createScarloxyPokemonDemoProject();
console.log("items of type book:",project.database.items.filter(i=>i.type==="book").map(i=>i.id+"->"+(i.learnedSkillId??i.skillId)));
console.log("items w/ learnedSkillId:",project.database.items.filter(i=>i.learnedSkillId).length, "total items", project.database.items.length);
const session:any=startSession(project);
const r=giveMonster(project,session,{speciesId:scarloxySpeciesId("sparchu"),level:20} as any) as any;
const id=r.instance.instanceId; console.log("party",session.monsterParty,"skills",session.monsterInstances[id].skillIds, "actor party", session.partyActorIds);
// author a TM
const skill=project.database.skills.find(s=>!session.monsterInstances[id].skillIds.includes(s.id))!;
const tm:any=JSON.parse(JSON.stringify(project.database.items.find(i=>i.type==="medicine")!)); tm.id="item_tm_audit";tm.name="TM Audit";tm.type="book";tm.learnedSkillId=skill.id;tm.skillId=skill.id;tm.scope="ally";tm.consumable=false;
project.database.items.push(tm); session.inventory["item_tm_audit"]=1;
const res=useItemFromMenu(project,session,"item_tm_audit",undefined,id);
console.log("TM on monster (no actor target):",JSON.stringify(res),"monster skills now:",session.monsterInstances[id].skillIds,"pending",session.monsterInstances[id].pendingSkillIds);
const res2=useItemFromMenu(project,session,"item_tm_audit",session.partyActorIds[0],id);
console.log("TM w/ actor target:",JSON.stringify(res2),"monster skills:",session.monsterInstances[id].skillIds,"actorSkillIds:",JSON.stringify(session.actorSkillIds));
