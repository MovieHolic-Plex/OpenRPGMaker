// Test-only overlay of the existing fixture; never persist to a project service.
export function feature16WorldFixture(base, kind = "melee") {
  const project = structuredClone(base);
  const map = project.maps[project.startMapId];
  project.startPos = { x: 2, y: 3 };
  project.system.startActorIds = [project.database.actors[0].id];
  project.system.actionCombat = { enabled: true, hud: { enemyHpBars: "always" } };
  map.lowerTiles.fill(360); map.upperTiles.fill(-1);
  map.actionCombat = true; map.climate = { mode: "inherit" };
  const template = structuredClone(map.events[0].pages[0]);
  const event = (id, x, y, commands, trigger = "action") => ({ id, x, y, trigger: { kind: trigger }, commands: [],
    pages: [{ ...structuredClone(template), id: `${id}_page`, name: id, movement: { type: "fixed" },
      conditions: [], trigger: { kind: trigger }, commands }] });
  const indoorId = "map_feature16_indoor";
  const boot = event("feature16_rain", 0, 0, [{ kind: "setWeather", weather: "rain", intensity: 0.8 },
    { kind: "setSwitch", switchId: "sw_0001", value: true }], "auto");
  boot.pages.push({ ...structuredClone(boot.pages[0]), id: "rain_done", trigger: { kind: "action" },
    conditions: [{ kind: "switch", switchId: "sw_0001", value: true }], commands: [] });
  map.events = [boot, event("feature16_door", 2, 2, [{ kind: "transfer", mapId: indoorId, x: 2, y: 3 }])];
  project.session.switches.sw_0001 = false;
  const indoor = structuredClone(map);
  indoor.id = indoorId; indoor.name = "Feature16 실내"; indoor.climate = { mode: "indoor" };
  indoor.events = [event("feature16_exit", 2, 2, [{ kind: "transfer", mapId: map.id, x: 2, y: 3 }])];
  indoor.fieldSpawns = [];
  project.maps[indoorId] = indoor;
  project.mapTree.children.push({ mapId: indoorId, children: [] });
  const enemy = project.database.enemies[0];
  enemy.stats.maxHp = 1000; enemy.rewards = { exp: 0, gold: 0, dropRatePercent: 0 };
  enemy.actionProfile = { contactDamage: 0, knockbackResist: 1, aggroRange: 1, moveIntervalMs: 10000 };
  const troop = project.database.troops[0]; troop.enemyIds = [enemy.id];
  troop.members = [{ enemyId: enemy.id, x: 168, y: 112, hidden: false }];
  map.fieldSpawns = [{ id: "feature16_target", troopId: troop.id, area: { x: 4, y: 3, width: 1, height: 1 },
    maxAlive: 1, respawnSec: 999, chase: false }];
  const skill = { ...structuredClone(project.database.skills[0]), id: "skill_feature16", name: `Feature16 ${kind}`, mpCost: { flat: 2, percentMax: 0 },
    actionSkill: { kind, damage: 25, range: 2, cooldownMs: 500, durationMs: 2500, speedTilesPerSec: 6,
      fieldStatus: { kind: "poison", durationMs: 2000 } } };
  for (const existing of project.database.skills) delete existing.actionSkill;
  project.database.skills.push(skill);
  project.database.actors[0].learnedSkills = [{ skillId: skill.id, level: 1 }];
  return project;
}
