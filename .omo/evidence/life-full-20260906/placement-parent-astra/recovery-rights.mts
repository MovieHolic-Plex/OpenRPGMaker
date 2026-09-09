import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createBlankProject } from '../../../../src/project/defaults';
import { startSession } from '../../../../src/project/session';
import { placeFarmBuilding, placeHomeDecoration } from '../../../../src/project/spatialPlacementTransactions';
import { collectLifeRecoveryClaim } from '../../../../src/project/lifeRecovery';
import { createSaveSnapshot, applySaveSnapshot } from '../../../../src/player/saveSlots';
const project=createBlankProject(); const itemId=project.database.items[0]!.id; const mapId=project.startMapId;
project.database.farmBuildingTypes=[{id:'b',name:'B',levels:[{level:1,capacity:1,footprint:{width:1,height:1},graphicResourceId:'easyrpg-picture-cloud',cost:{gold:10,items:[{itemId,count:1}]}}]}];
project.database.homeDecorationTypes=[{id:'rug',name:'Rug',footprint:{width:1,height:1},blocksMovement:false,allowedOrientations:['down'],placementItemId:itemId,graphicResourceId:'easyrpg-picture-cloud'}];
const session=startSession(project,12948); session.gold=100; session.inventory[itemId]=10;
assert.equal(placeFarmBuilding(project,session,{instanceId:'b1',typeId:'b',mapId,x:8,y:5,orientation:'down'}).ok,true);
assert.equal(placeHomeDecoration(project,session,{instanceId:'r1',typeId:'rug',mapId,x:10,y:5,orientation:'down'}).ok,true);
const paid=structuredClone(session);
// Genuine persistent incompatibility: newly restored plots reserve both cells.
session.farmPlots={[mapId]:{'8,5':{tilled:true,watered:false},'10,5':{tilled:true,watered:false}}};
const input=structuredClone(session); const snapshot=createSaveSnapshot(project,session); assert.deepEqual(structuredClone(session),input);
const restored=applySaveSnapshot(project,snapshot); const beforeCollect=structuredClone(restored);
const claims=Object.values(restored.lifeRecovery!.claims); const building=claims.find(c=>c.sourceId==='b1')!; const rug=claims.find(c=>c.sourceId==='r1')!;
assert.deepEqual(building.items,[{itemId,count:1}]); assert.deepEqual(building.unresolved!.record,paid.farmBuildingPlacements!.b1);
assert.deepEqual(rug.items,[]); assert.deepEqual(rug.unresolved!.record,paid.homeDecorationPlacements!.r1);
const buildingCollection=collectLifeRecoveryClaim(project,restored,building.id); const rugCollection=collectLifeRecoveryClaim(project,restored,rug.id);
const resumed=applySaveSnapshot(project,createSaveSnapshot(project,restored));
writeFileSync(new URL('./recovery-rights-state.json',import.meta.url),JSON.stringify({itemId,paid,input,snapshot,beforeCollect,buildingCollection,rugCollection,afterCollect:restored,resumed},null,2));
console.log(JSON.stringify({goldPaid:10,goldBefore:100,goldAfter:resumed.gold,buildingCollection,rugCollection,remainingClaims:resumed.lifeRecovery,buildingGoldEvidenceStillPresent:JSON.stringify(resumed.lifeRecovery).includes('paymentReceipt')},null,2));
// Required conservation: claiming proved items must not erase unpaid proved gold evidence.
assert.ok(Object.values(resumed.lifeRecovery!.claims).some(c=>c.sourceId==='b1'), 'PROVED-RIGHTS GAP: collecting building items deletes its unresolved receipt including unpaid gold10');
