import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEquipmentRecord } from '../../../src/project/databaseRecordModel';
import { canEquip, equipmentSlotAccepts, transitionActorEquipment } from '../../../src/project/equipmentRules';

const root = dirname(fileURLToPath(import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const input = readJson(resolve(root, 'data.json'));
const ids = readJson(resolve(root, '../ids.json'));
const design = readJson(resolve(root, 'design.json'));
const assets = readJson(resolve(root, 'assets.json'));
const classLinks = readJson(resolve(root,'class-links.json'));
const prototypePath = process.env.JF_EQUIPMENT_PROTOTYPE ??
  '/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/prototype-database.json';
const baseline = readJson(prototypePath);
const pilot = readJson(resolve(root, 'review/pilot-baseline.json'));
const roles = ['warrior','rogue','shaman','taoist'];
assert.deepEqual(Object.keys(input), ['equipment']);
assert.equal(input.equipment.length, 36);
assert.equal(assets.length, 36);
const records = input.equipment.map(normalizeEquipmentRecord);
assert.equal(new Set(records.map(r => r.id)).size, 36);
assert.equal(new Set(assets.map(a => a.resourceId)).size, 36);
assert.equal(new Set(assets.map(a => a.rgbaSha256)).size, 36);
for (const old of pilot.equipment) assert.deepEqual(input.equipment.find(r => r.id === old.id),old);
for (const old of pilot.assets) assert.deepEqual(assets.find(a => a.resourceId === old.resourceId),old);
for (const role of roles) {
  for (const kind of ['weapon','body']) {
    const tiers = [1,2,3,4].map(t => records.find(r => r.id === `equip_jf_${role}_${kind}_${t}`)!);
    assert.ok(tiers.every(Boolean));
    const mainStat = kind==='body' ? 'defense' : ['shaman','taoist'].includes(role) ? 'mind' : 'attack';
    for (let i=1;i<tiers.length;i++) {
      assert.ok(tiers[i].price > tiers[i-1].price);
      assert.ok(tiers[i].statBonuses[mainStat] > tiers[i-1].statBonuses[mainStat]);
    }
  }
}
assert.deepEqual(Object.fromEntries(['weapon','armor','helmet','accessory'].map(slot =>
  [slot,records.filter(r => r.slot === slot).length])),{weapon:16,armor:16,helmet:2,accessory:2});
// A serialization/reload check of the same normalized records, in memory only.
assert.deepEqual(JSON.parse(JSON.stringify(records)), input.equipment);
assert.deepEqual(JSON.parse(JSON.stringify(records)).map(normalizeEquipmentRecord), records);

// Minimal in-memory integration fixture derived from the supplied read-only DB.
// No live store, editor session, runtime project or database is modified.
const classes = roles.map((role, i) => ({
  ...structuredClone(baseline.classes[i]), id: ids.classes[role],
  equipmentPermissions: {
    actorIds: [], classIds: [],
    equipmentIds: records.filter(r => r.equippableClassIds.includes(ids.classes[role])).map(r => r.id),
  },
}));
for (const c of classes) {
  assert.deepEqual(c.equipmentPermissions,classLinks[c.id]);
  assert.equal(c.equipmentPermissions.equipmentIds.length,12);
}
classes.push({ ...structuredClone(baseline.classes[0]), id: ids.classes.novice,
  equipmentPermissions: { actorIds: [], classIds: [], equipmentIds: [] } });
const actors = roles.map((role,i) => ({ ...structuredClone(baseline.actors[i]),
  classId: ids.classes[role], initialEquipment: {},
  options: {...baseline.actors[i].options, fixedEquipment:false, dualWield:false} }));
const project = { database: { ...structuredClone(baseline), equipment:records, classes, actors } } as any;
const permissionMatrix: Record<string, Record<string, boolean>> = {};
for (const [i, role] of roles.entries()) {
  const actor = actors[i];
  permissionMatrix[role] = {};
  for (const record of records) {
    const expected = record.equippableClassIds.includes(ids.classes[role]);
    const permitted = canEquip(project, actor, record);
    permissionMatrix[role][record.id] = permitted;
    assert.equal(permitted, expected, `class restriction: ${role}/${record.id}`);
    assert.equal(canEquip(project, actor, record, ids.classes.novice), false);
    assert.equal(equipmentSlotAccepts(project, actor, record.slot, record), true);
    const result = transitionActorEquipment({project,actorId:actor.id,equipment:{},
      inventory:{[record.id]:1},slot:record.slot,equipmentId:record.id});
    if (expected) {
      assert.equal(result.kind, 'accepted');
      if (result.kind === 'accepted') {
        assert.equal(result.equipment[record.slot],record.id);
        assert.equal(result.inventory[record.id] ?? 0,0);
      }
    } else {
      assert.deepEqual(result,{kind:'rejected',reason:'notEquippable'});
    }
  }
}
for (const record of records) {
  const shared = record.id.startsWith('equip_jf_shared_');
  assert.match(record.id,/^equip_jf_((warrior|rogue|shaman|taoist)_(weapon|body)_[1-4]|shared_(head|accessory)_[1-2])$/);
  assert.equal(record.equippableClassIds.length,shared ? 4 : 1);
  if (shared) assert.deepEqual(record.equippableClassIds,roles.map(r => ids.classes[r]));
  assert.deepEqual(record.equippableActorIds,[]);
  const detail=design.equipment.find(e => e.id === record.id);
  assert.ok(detail);
  if (detail.recommendedLevel===1) assert.ok(record.price>=50 && record.price<=120);
  assert.ok(record.price >= 50 && record.price <= 940);
  assert.ok([1,5,10,15].includes(detail.recommendedLevel));
  if (!shared) assert.equal(detail.recommendedLevel,[1,5,10,15][Number(record.id.slice(-1))-1]);
  assert.deepEqual(detail.classIds,record.equippableClassIds);
  assert.deepEqual(detail.engineEffects.stats,record.statBonuses);
  assert.equal(detail.engineEffects.criticalBonusPercentagePoints,record.criticalRate);
  assert.equal(record.slot, record.id.includes('_body_') ? 'armor' :
    record.id.includes('_head_') ? 'helmet' : record.id.includes('_accessory_') ? 'accessory' : 'weapon');
  assert.equal(record.accuracy,100);
  assert.equal(record.cursed,false);
  assert.equal(record.twoHanded,false);
  assert.equal(record.imageResourceId,record.iconResourceId);
  assert.equal(record.attackElementIds.length,record.slot === 'weapon' ? 1 : 0);
  for (const id of record.attackElementIds) assert.ok(Object.values(ids.elements).includes(id));
  assert.deepEqual(record.stateInflictIds,[]);
  assert.deepEqual(record.stateDefenseIds,[]);
  assert.ok(Object.values(record.effectFlags).every(flag => flag === false));
  const asset = assets.find(a => a.resourceId === record.iconResourceId);
  assert.ok(asset,`icon manifest missing ${record.id}`);
  assert.equal(asset.path,`assets/joseon-folklore/equipment/${record.iconResourceId!.replace('jf-icon-','')}.png`);
  const bytes = readFileSync(resolve(root,asset.sourcePath));
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal(bytes.readUInt32BE(16),32);
  assert.equal(bytes.readUInt32BE(20),32);
  assert.equal(bytes[25],6); // PNG truecolour RGBA
  assert.equal(digest(resolve(root,asset.sourcePath)),asset.sha256);
}
// Record the actual OR-permission limitation rather than implying strict deny support.
const broad = structuredClone(project);
broad.database.classes[1].equipmentPermissions.classIds = [ids.classes.rogue];
assert.equal(canEquip(broad,actors[1],records[0]),true);
const evidence = {
  scope:'saved local full files and actual engine normalizer/equipment rules; no live writes',
  equipmentCount:36, iconsCount:36, slotCounts:{weapon:16,armor:16,helmet:2,accessory:2},
  preservedPilotRecords:8, preservedPilotPngHashes:8, serializationReload:true,
  normalizationStable:true, permissionMatrix,
  noviceDeniedCount:144, transitionCases:144,
  permissionPrerequisite:'Class permissions actorIds/classIds must avoid blanket grants; equipmentIds may list own role eight and shared four only.',
  broadClassPermissionBypassesEquipmentClassRestriction:true,
  physicalElement:'element_jf_physical reserved in ids.json; skills role must install definition',
  hashes:{data:digest(resolve(root,'data.json')),design:digest(resolve(root,'design.json')),
    assets:digest(resolve(root,'assets.json')),prototype:digest(prototypePath),
    engineNormalizer:digest(resolve(root,'../../../src/project/databaseRecordModel.ts')),
    engineRules:digest(resolve(root,'../../../src/project/equipmentRules.ts'))},
  gameIntegrationVerified:false, userApproved:false,
};
writeFileSync(resolve(root,'review/smoke.json'),JSON.stringify(evidence,null,2)+'\n');
console.log('equipment full smoke: 36 normalized records + PNG hashes; 144 class/slot/equip cases; pilot eight unchanged; novice denied. No live writes.');
