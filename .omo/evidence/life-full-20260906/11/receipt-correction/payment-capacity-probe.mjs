import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {writeFile,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname,join} from 'node:path';
const output=process.argv[2],root=process.cwd(),cache=join(dirname(output),'payment-capacity-cache');
const source=join(root,'src/project/spatialPlacementTransactions.ts');
const hash=async()=>createHash('sha256').update(await readFile(source)).digest('hex');
const sourceHash=await hash();
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHash};
const server=await createServer({root,configFile:false,envFile:false,cacheDir:cache,resolve:{alias:{'@':join(root,'src')}},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,watch:null,hmr:false},appType:'custom'});
try{
 const {animalProject}=await server.ssrLoadModule('/test/fixtures/p1FarmAnimals.ts');
 const {normalizeItemRecord}=await server.ssrLoadModule('/src/project/databaseRecordModel.ts');
 const {serialize,deserialize}=await server.ssrLoadModule('/src/project/io.ts');
 const {startSession}=await server.ssrLoadModule('/src/project/session.ts');
 const {placeFarmBuilding,upgradeFarmBuilding}=await server.ssrLoadModule('/src/project/spatialPlacementTransactions.ts');
 const {reconcileLifeState}=await server.ssrLoadModule('/src/project/lifeRecovery.ts');
 const project=animalProject();
 const items=Array.from({length:65},(_,i)=>({itemId:'paid-'+i,count:1}));
 project.database.items.push(...items.map(i=>normalizeItemRecord({id:i.itemId,name:i.itemId,scope:'none'})));
 for(const i of items)project.session.inventory[i.itemId]=1;
 project.database.farmBuildingTypes=[{id:'paid-building',name:'Paid building',levels:[
 {level:1,footprint:{width:1,height:1},capacity:1,cost:{items:items.slice(0,32)},graphicResourceId:'easyrpg-picture-cloud'},
 {level:2,footprint:{width:1,height:1},capacity:1,cost:{items:items.slice(32)},graphicResourceId:'easyrpg-picture-cloud'}]}];
 const authored=deserialize(serialize(project));
 assert.deepEqual(authored.database.farmBuildingTypes[0].levels.map(l=>l.cost.items.length),[32,33]);
 const session=startSession(authored,11);
 assert.deepEqual(placeFarmBuilding(authored,session,{instanceId:'home',typeId:'paid-building',mapId:authored.startMapId,x:5,y:5,orientation:'down'}),{ok:true});
 const before=structuredClone(session);
 const result=upgradeFarmBuilding(authored,session,'home');
 Object.assign(report,{authoredRoundtripAccepted:true,costItemCounts:[32,33],cumulativeDistinctItems:65,result,level:session.farmBuildingPlacements.home.level,receiptItems:session.farmBuildingPlacements.home.paymentReceipt.items.length,unchangedOnRefusal:JSON.stringify(before)===JSON.stringify(session)});
 assert.equal(await hash(),sourceHash,'Source changed during probe');
 assert.equal(result.ok,true,'Valid per-level costs must not be rejected by a per-claim receipt bound');
 assert.equal(session.farmBuildingPlacements.home.paymentReceipt.items.length,65);
 authored.database.farmBuildingTypes=[];
 const recovered=reconcileLifeState(authored,session);
 assert.equal(Object.keys(recovered.lifeRecovery.claims).length,2);
 assert.equal(Object.values(recovered.lifeRecovery.claims).flatMap(c=>c.items).length,65);
 report.recoveryClaimSizes=Object.values(recovered.lifeRecovery.claims).map(c=>c.items.length);
 report.pass=true;
}finally{await server.close();await rm(cache,{recursive:true,force:true});report.cleanup={serverClosed:true,ownedCacheRemoved:true};await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}
