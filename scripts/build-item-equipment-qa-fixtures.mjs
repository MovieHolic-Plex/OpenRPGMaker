import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = new URL("../test/fixtures/projects/item-runtime-qa-v3.json", import.meta.url);
const variants = [
  {
    weaponId: "equip_gen_rapier_noble",
    output: new URL("../test/fixtures/projects/item-equipment-rapier-qa-v3.json", import.meta.url),
    authored: { attack: 15, agility: 4, accuracy: 100, criticalRate: 9, attackElementIds: ["sword"] },
  },
  {
    weaponId: "equip_gen_whip_leather",
    output: new URL("../test/fixtures/projects/item-equipment-whip-qa-v3.json", import.meta.url),
    authored: { attack: 15, agility: 2, accuracy: 92, criticalRate: 0, attackElementIds: ["hit"] },
  },
];

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const baseline = structuredClone(source);
baseline.meta.title = "장비 전투 축 런타임 QA";
baseline.session.partyActorIds = ["actor_hero"];

const troop = requiredRecord(baseline.database.troops, "troop_forest_hornets", "troop");
troop.enemyIds = ["enemy_slime"];
troop.members = [{ enemyId: "enemy_slime", x: 116, y: 128, hidden: false }];

const enemy = requiredRecord(baseline.database.enemies, "enemy_slime", "enemy");
enemy.stats.maxHp = 999;
enemy.elementRates.sword = "A";
enemy.elementRates.hit = "D";
enemy.actions = [{
  skillId: "skill_focus",
  priority: 5,
  condition: { kind: "always" },
  switchOnAfterAction: { enabled: false },
  switchOffAfterAction: { enabled: false },
}];
enemy.skillIds = ["skill_focus"];

const rendered = [];
for (const variant of variants) {
  const project = structuredClone(baseline);
  const hero = requiredRecord(project.database.actors, "actor_hero", "actor");
  const weapon = requiredRecord(project.database.equipment, variant.weaponId, "equipment");
  assertAuthoredAxes(weapon, variant.authored);
  hero.initialEquipment.weapon = weapon.id;
  const json = `${JSON.stringify(project, null, 2)}\n`;
  await writeFile(variant.output, json, "utf8");
  rendered.push({ weaponId: variant.weaponId, json, output: variant.output });
}

const differingPaths = jsonDiffPaths(JSON.parse(rendered[0].json), JSON.parse(rendered[1].json));
const expectedDifference = "database.actors[id=actor_hero].initialEquipment.weapon";
if (differingPaths.length !== 1 || differingPaths[0] !== expectedDifference) {
  throw new Error(`Variant fixtures must differ only at ${expectedDifference}; got ${differingPaths.join(", ")}`);
}

for (const variant of rendered) {
  console.log(`${fileURLToPath(variant.output).slice(repoRoot.length)} <- ${variant.weaponId}`);
}
console.log(`verified sole variant difference: ${expectedDifference}`);

function requiredRecord(records, id, kind) {
  const record = records.find((entry) => entry.id === id);
  if (!record) throw new Error(`Missing ${kind}: ${id}`);
  return record;
}

function assertAuthoredAxes(record, expected) {
  const actual = {
    attack: record.statBonuses.attack,
    agility: record.statBonuses.agility,
    accuracy: record.accuracy,
    criticalRate: record.criticalRate,
    attackElementIds: record.attackElementIds,
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Authored axes changed for ${record.id}: ${JSON.stringify(actual)}`);
  }
}

function jsonDiffPaths(left, right, path = "") {
  if (Object.is(left, right)) return [];
  if (Array.isArray(left) && Array.isArray(right)) {
    const recordArray = left.every(hasStringId) && right.every(hasStringId);
    if (recordArray) {
      const ids = new Set([...left.map((entry) => entry.id), ...right.map((entry) => entry.id)]);
      return [...ids].flatMap((id) => jsonDiffPaths(
        left.find((entry) => entry.id === id),
        right.find((entry) => entry.id === id),
        `${path}[id=${id}]`,
      ));
    }
    if (left.length !== right.length) return [path];
    return left.flatMap((entry, index) => jsonDiffPaths(entry, right[index], `${path}[${index}]`));
  }
  if (isObject(left) && isObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].flatMap((key) => jsonDiffPaths(left[key], right[key], path ? `${path}.${key}` : key));
  }
  return [path];
}

function hasStringId(value) {
  return isObject(value) && typeof value.id === "string";
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}
