/** Test-only authored inputs for the real exported player's battle/session boundary. */
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";

export function battleEventStateRepairsProject() {
  const project = createBlankProject();
  project.meta.title = "Battle state repairs";
  if (project.system.titleScreen) {
    project.system.titleScreen = { ...project.system.titleScreen, title: project.meta.title };
  }
  project.system.battleFlow = "gauge";
  project.system.battleUiStyle = "vxace";
  project.system.startActorIds = ["actor_hero"];
  project.startPos = { x: 3, y: 6 };
  const hero = project.database.actors.find(actor => actor.id === "actor_hero");
  const enemy = project.database.enemies.find(record => record.id === "enemy_slime");
  const troop = project.database.troops.find(record => record.id === "troop_slime");
  const map = project.maps[project.startMapId];
  if (!hero || !enemy || !troop || !map) throw new Error("Missing battle state fixture records");
  const klass = project.database.classes.find(record => record.id === hero.classId);
  if (!klass) throw new Error("Missing hero class");
  hero.initialLevel = 7;
  hero.initialEquipment = {};
  hero.parameterCurves = {
    maxHp: Array.from({ length: 99 }, (_, index) => (index + 1) * 100),
    maxMp: Array(99).fill(40),
    attack: Array.from({ length: 99 }, (_, index) => (index + 1) * 10),
    defense: Array(99).fill(10), mind: Array(99).fill(20), agility: Array(99).fill(99),
  };
  klass.battleCommands = [
    { id: "qa_guard", name: "Guard", kind: "guard" },
    { id: "cmd_attack", name: "Attack", kind: "attack" },
  ];
  enemy.stats = { ...enemy.stats, maxHp: 5000, maxMp: 40, attack: 1, agility: 1 };
  troop.enemyIds = [enemy.id];
  troop.battleFlow = "gauge";
  troop.members = [{ enemyId: enemy.id, x: 160, y: 100, hidden: false }];
  troop.battleEventPages = [
    { id: "update", name: "Update state", span: "battle",
      conditions: [{ kind: "actorCommand", actorId: hero.id, commandId: "defend" }],
      commands: [
        { kind: "changeFriendship", npcKey: "qa_npc", delta: 19 },
        { kind: "changeLevel", actorId: hero.id, op: "+=", amount: 4 },
      ] },
    { id: "return", name: "Return state", span: "battle",
      conditions: [{ kind: "actorCommand", actorId: hero.id, commandId: "attack" }],
      commands: [{ kind: "m2Command", commandId: "m2-107-force-escape", fields: {} }] },
  ];
  map.lowerTiles.fill(240);
  map.upperTiles.fill(-1);
  map.bgm = { mode: "none" };
  map.encounterRate = 0;
  project.switches.push({ id: "state_repair_done", name: "State repair complete" });
  const commands: Command[] = [
    { kind: "changeFriendship", npcKey: "qa_npc", delta: 37 },
    { kind: "changeActorHp", actorId: hero.id, op: "-=", amount: 400 },
    { kind: "changeActorMp", actorId: hero.id, op: "-=", amount: 20 },
    { kind: "text", body: "STATE START" },
    { kind: "battleProcessing", troopId: troop.id, canEscape: false, canLose: true },
    { kind: "text", body: "STATE RETURNED" },
    { kind: "setSwitch", switchId: "state_repair_done", value: true },
  ];
  map.events = [{
    id: "state_owner", x: 0, y: 0, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: "state_owner", name: "State test", conditions: [{ kind: "switch", switchId: "state_repair_done", value: false }],
      graphic: {}, priority: "below", trigger: { kind: "auto" },
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
    }],
  }];
  return project;
}
