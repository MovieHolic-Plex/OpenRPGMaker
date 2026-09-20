// Small patch over an existing QA project; no authored app content or remote writes.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function writeFeature16Fixture() {
  const project = JSON.parse(await readFile(new URL('../projects/editor-authored-demo-v3.json', import.meta.url), 'utf8'));
  project.system.menuUiStyle = 'workbench';
  project.system.battleParty = 'actors';
  project.system.monsterBattleParty = false;
  project.system.battleModel = 'rm2k3';
  project.system.activeSlots = 2;
  const troop = project.database.troops.find(t => t.id === 'troop_forest_hornets');
  troop.activeSlots = 2;
  troop.battleEventPages = [];
  troop.members = troop.members.slice(0, 1);
  const enemy = project.database.enemies.find(e => e.id === troop.members[0].enemyId);
  enemy.stats = { ...enemy.stats, maxHp: 1, attack: 1, defense: 1, agility: 1 };
  const event = project.maps.map_moonwell_forest.events.find(e => e.id === 'ev_map_moonwell_forest_seal');
  event.pages = [{ ...event.pages[0], conditions: [], commands: [{ kind: 'battleProcessing', troopId: troop.id, canEscape: false, canLose: true }] }];
  const path = resolve('verify-shots/runtime-qa/_fixtures/feature16-battle-ui.json');
  await mkdir(resolve('verify-shots/runtime-qa/_fixtures'), { recursive: true });
  await writeFile(path, JSON.stringify(project));
  return path;
}
