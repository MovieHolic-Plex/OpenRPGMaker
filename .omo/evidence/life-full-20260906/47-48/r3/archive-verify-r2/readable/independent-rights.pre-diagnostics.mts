// Independent Astra r3 public-surface probe. No producer probe imports.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createBlankProject } from '/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/project/defaults';
import { startSession } from '/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/project/session';
import { placeFarmBuilding, placeHomeDecoration, removeHomeDecoration, removeFarmBuilding, upgradeFarmBuilding } from '/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/project/spatialPlacementTransactions';
import { collectLifeRecoveryClaim, moveLifeRecoverySource, LifeReconciliationError } from '/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/project/lifeRecovery';
import { createSaveSnapshot, saveToSlot, readSaveSlot, applySaveSnapshot, saveSlotKey } from '/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/player/saveSlots';
class MemoryStorage implements Storage {
  values = new Map<string,string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string,v: string) { this.values.set(k,v); }
  removeItem(k: string) { this.values.delete(k); }
}
import { ITEM_QUANTITY_MAX } from '/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/project/itemQuantities';
const captures: unknown[] = [];
const storage = new MemoryStorage();
const p = createBlankProject();
let s = startSession(p, 470048);
try {
  const itemId = p.database.items[0]!.id;
  p.database.farmBuildingTypes = [{id:'paid',name:'Paid',levels:[{level:1,capacity:1,footprint:{width:1,height:1},graphicResourceId:'easyrpg-picture-cloud',cost:{gold:10,items:[{itemId,count:1}]}}]}];
  s.gold = 100; s.inventory[itemId] = 10;
  const before = structuredClone(s);
  assert.equal(placeFarmBuilding(p,s,{instanceId:'owner',typeId:'paid',mapId:p.startMapId,x:8,y:5,orientation:'down'}).ok,true);
  const original = structuredClone(s.farmBuildingPlacements!.owner);
  assert.deepEqual(original!.paymentReceipt,{gold:10,items:[{itemId,count:1}]});
  captures.push({label:'paid',before,after:structuredClone(s)});
  s.farmPlots = {[p.startMapId]:{'8,5':{tilled:true,watered:false}}};
  function roundtrip(label: string) {
    const before = structuredClone(s);
    const snapshot = createSaveSnapshot(p,s);
    assert.equal(saveToSlot(storage,1,snapshot).ok,true);
    const raw = storage.getItem(saveSlotKey(1));
    const parsed = readSaveSlot(storage,1);
    assert.equal(parsed.kind,'present');
    if(parsed.kind !== 'present') throw new Error('Missing slot');
    s = applySaveSnapshot(p,parsed.snapshot);
    captures.push({label,before,snapshot,raw,parsed,after:structuredClone(s)});
  }
  roundtrip('quarantine');
  const claim = Object.values(s.lifeRecovery!.claims).find(c=>c.items.length)!;
  assert.deepEqual(claim.items,[{itemId,count:1}]);
  assert.equal(collectLifeRecoveryClaim(p,s,claim.id).ok,true);
  assert.equal(Object.hasOwn(s.lifeRecovery!.claims,claim.id),false);
  roundtrip('collected'); roundtrip('repeated-save');
  assert.equal(s.gold,90); assert.equal(s.inventory[itemId],10);
  const unpaid = Object.values(s.lifeRecovery!.claims);
  assert.equal(unpaid.length,1); assert.deepEqual(unpaid[0]!.items,[]);
  assert.deepEqual(unpaid[0]!.unresolved!.record,original);
  console.log('Independent basic gold10+item1 conservation passed');

  // Fresh fixtures; never run the producer probe or import its assertions.
  function fixture() {
    const project = createBlankProject(); const item = project.database.items[0]!;
    project.database.homeDecorationTypes = [{id:'rug',name:'Rug',placementItemId:item.id,footprint:{width:1,height:1},blocksMovement:false,allowedOrientations:['down'],graphicResourceId:'easyrpg-picture-cloud'}];
    project.database.farmBuildingTypes = [{id:'house',name:'House',levels:[1,2].map(level=>({level,capacity:1,footprint:{width:1,height:1},graphicResourceId:'easyrpg-picture-cloud',cost:{gold:10,items:[{itemId:item.id,count:1}]}}))}];
    const state = startSession(project,470048); state.gold=100; state.inventory[item.id]=10;
    const input = {instanceId:'r',typeId:'rug',mapId:project.startMapId,x:8,y:5,orientation:'down'} as const;
    return {project,item,state,input};
  }
  function save(label:string, project:ReturnType<typeof createBlankProject>, state:ReturnType<typeof startSession>) {
    const before=structuredClone(state), snapshot=createSaveSnapshot(project,state);
    assert.equal(project.version,4); assert.equal(snapshot.schemaVersion,5);
    assert.deepEqual(structuredClone(state),before);
    assert.equal(saveToSlot(storage,1,snapshot).ok,true);
    const raw=storage.getItem(saveSlotKey(1)), parsed=readSaveSlot(storage,1);
    assert.equal(parsed.kind,'present'); if(parsed.kind!=='present') throw Error(parsed.kind);
    const after=applySaveSnapshot(project,parsed.snapshot);
    assert.deepEqual(structuredClone(state),before); assert.equal(storage.getItem(saveSlotKey(1)),raw);
    captures.push({label,before,snapshot,raw,parsed,after:structuredClone(after),slots:[...storage.values]}); return after;
  }
  function attempt(label:string,state:ReturnType<typeof startSession>,action:()=>unknown,expected:unknown) {
    const before=structuredClone(state), slots=[...storage.values]; const result=action();
    captures.push({label,before,result,after:structuredClone(state),slotsBefore:slots,slotsAfter:[...storage.values]});
    assert.deepEqual(result,expected); assert.deepEqual(structuredClone(state),before); assert.deepEqual([...storage.values],slots);
  }
  for(const mode of ['ordinary','changed','deleted','unknown'] as const) {
    const {project,item,state,input}=fixture();
    const live={...input,npcs:['DO-NOT-PERSIST'],readLive:()=>null};
    assert.equal(placeHomeDecoration(project,state,live).ok,true);
    assert.deepEqual(state.homeDecorationPlacements!.r!.recoveryItem,{itemId:item.id,count:1});
    assert.deepEqual(Object.keys(state.homeDecorationPlacements!.r!).sort(),['instanceId','typeId','mapId','x','y','orientation','recoveryItem'].sort());
    let current=save(mode+'-paid',project,state);
    if(mode==='changed') project.database.homeDecorationTypes=project.database.homeDecorationTypes!.map(t=>({...t,placementItemId:'new-cost'}));
    if(mode==='deleted'||mode==='unknown') project.database.homeDecorationTypes=[];
    if(mode!=='unknown') {
      const before=structuredClone(current);
      assert.equal(removeHomeDecoration(project,current,'r').ok,true);
      assert.equal(current.inventory[item.id],10); assert.equal(current.inventory['new-cost'],undefined);
      captures.push({label:mode+'-ordinary-reclaim',before,after:structuredClone(current),slots:[...storage.values]});
      attempt(mode+'-repeat',current,()=>removeHomeDecoration(project,current,'r'),{ok:false,reason:'missing'});
      current=save(mode+'-ordinary-saved',project,current);
      assert.equal(current.inventory[item.id],10);
    }
    // Incompatibility uses a separate actually paid session, not a refunded owner.
    if(mode==='ordinary') continue;
    if(mode==='unknown') project.database.items=project.database.items.filter(i=>i.id!==item.id);
    const incompatible=structuredClone(state); incompatible.farmPlots={[project.startMapId]:{'8,5':{tilled:true,watered:false}}};
    current=save(mode+'-quarantine',project,incompatible);
    const claim=Object.values(current.lifeRecovery!.claims)[0]!;
    assert.deepEqual(claim.items,[{itemId:item.id,count:1}]);
    if(mode==='unknown') {
      attempt('unknown-no-payout',current,()=>collectLifeRecoveryClaim(project,current,claim.id),{ok:false,reason:'unresolved'});
      project.database.items.push(item); const inventory=structuredClone(current.inventory);
      current=save('restored-no-auto-credit',project,current); assert.deepEqual(structuredClone(current.inventory),inventory);
    }
    const before=structuredClone(current); const quantity=current.inventory[item.id]??0;
    assert.equal(collectLifeRecoveryClaim(project,current,claim.id).ok,true);
    assert.equal(Object.hasOwn(current.lifeRecovery!.claims,claim.id),false);
    assert.equal(current.inventory[item.id],quantity+1);
    captures.push({label:mode+'-explicit-collect',before,after:structuredClone(current),slots:[...storage.values]});
    current=save(mode+'-collected-twice',project,save(mode+'-collected-once',project,current));
    assert.equal(current.inventory[item.id],quantity+1);
  }
  for(const kind of ['legacy','starting'] as const) {
    const {project,item,state,input}=fixture();
    if(kind==='starting') project.session.homeDecorationPlacements=[input]; else state.homeDecorationPlacements={r:input};
    const originalState=kind==='starting'?startSession(project,470048):state;
    const original=structuredClone(originalState.homeDecorationPlacements!.r);
    project.database.homeDecorationTypes=[];
    const next=save(kind+'-twice',project,save(kind+'-once',project,originalState));
    const claims=Object.values(next.lifeRecovery!.claims); assert.equal(claims.length,1);
    assert.deepEqual(claims[0]!.items,[]); assert.deepEqual(claims[0]!.unresolved!.record,original);
    assert.equal(next.inventory[item.id],originalState.inventory[item.id]);
    attempt(kind+'-no-guessed-payment',next,()=>collectLifeRecoveryClaim(project,next,claims[0]!.id),{ok:false,reason:'unresolved'});
  }
  {
    const {project,item,state,input}=fixture();
    project.database.homeDecorationTypes=project.database.homeDecorationTypes!.map(t=>({...t,placementItemId:''}));
    attempt('required-item-no-free-placement',state,()=>placeHomeDecoration(project,state,input),{ok:false,reason:'invalid'});
    project.database.homeDecorationTypes=project.database.homeDecorationTypes!.map(t=>({...t,placementItemId:item.id}));
    assert.equal(placeHomeDecoration(project,state,input).ok,true); state.inventory[item.id]=ITEM_QUANTITY_MAX;
    attempt('ordinary-inventory-overflow',state,()=>removeHomeDecoration(project,state,'r'),{ok:false,reason:'overflow'});
    project.database.items=project.database.items.filter(i=>i.id!==item.id);
    attempt('ordinary-item-deleted',state,()=>removeHomeDecoration(project,state,'r'),{ok:false,reason:'invalid'});
  }
  for(const proof of [null,{itemId:'',count:1}, {itemId:'item_potion',count:0},{itemId:'item_potion',count:2},{itemId:'item_potion',count:-1},{itemId:'item_potion',count:0.5}]) {
    const {project,state,input}=fixture(); assert.equal(placeHomeDecoration(project,state,input).ok,true);
    const valid=createSaveSnapshot(project,state); assert.equal(saveToSlot(storage,1,valid).ok,true);
    const slots=[...storage.values]; Object.assign(state.homeDecorationPlacements!.r!,{recoveryItem:proof});
    const before=structuredClone(state);
    for(const version of [4,5]) {
      const poisoned=structuredClone(valid); Object.assign(poisoned,{schemaVersion:version}); Object.assign(poisoned.session.homeDecorationPlacements!.r!,{recoveryItem:proof});
      const bad=new MemoryStorage(), raw=JSON.stringify(poisoned); bad.setItem(saveSlotKey(1),raw);
      for(let repeat=0;repeat<2;repeat++) {
        assert.throws(()=>createSaveSnapshot(project,state),LifeReconciliationError);
        assert.throws(()=>applySaveSnapshot(project,poisoned),LifeReconciliationError);
        assert.equal(readSaveSlot(bad,1).kind,'corrupt'); assert.equal(bad.getItem(saveSlotKey(1)),raw);
        assert.deepEqual([...storage.values],slots); assert.deepEqual(structuredClone(state),before);
        captures.push({label:'malformed-proof',proof,version,repeat,before,after:structuredClone(state),raw,slotsBefore:slots,slotsAfter:[...storage.values]});
      }
      bad.clear();
    }
  }
  {
    const {project,item,state,input}=fixture();
    const building={...input,typeId:'house'}; assert.equal(placeFarmBuilding(project,state,building).ok,true);
    // Earn/refill between real paid upgrades to create a split, rather than injecting a receipt.
    const type=project.database.farmBuildingTypes![0]!;
    project.database.farmBuildingTypes=[{...type,levels:type.levels.map(l=>({...l,cost:{gold:10,items:[{itemId:item.id,count:ITEM_QUANTITY_MAX}]}}))}];
    state.inventory[item.id]=ITEM_QUANTITY_MAX; assert.equal(upgradeFarmBuilding(project,state,'r').ok,true);
    const original=structuredClone(state.farmBuildingPlacements!.r!);
    assert.deepEqual(original.paymentReceipt,{gold:20,items:[{itemId:item.id,count:ITEM_QUANTITY_MAX+1}]});
    project.database.farmBuildingTypes=[]; let next=save('new-split',project,state);
    const all=Object.values(next.lifeRecovery!.claims), batches=all.filter(c=>c.items.length);
    assert.deepEqual(batches.map(c=>c.items),[[{itemId:item.id,count:ITEM_QUANTITY_MAX}],[{itemId:item.id,count:1}]]);
    const unpaid=all.filter(c=>!c.items.length); assert.equal(unpaid.length,1); assert.deepEqual(unpaid[0]!.unresolved!.record,original);
    assert.ok(batches.every(c=>c.unresolved===undefined));
    assert.equal(collectLifeRecoveryClaim(project,next,batches[0]!.id).ok,true); next=save('split-partial',project,next);
    attempt('split-inventory-refusal',next,()=>collectLifeRecoveryClaim(project,next,batches[1]!.id),{ok:false,reason:'inventory-overflow'});
    next.inventory[item.id]=0; assert.equal(collectLifeRecoveryClaim(project,next,batches[1]!.id).ok,true);
    next=save('split-final',project,save('split-final-first',project,next));
    assert.equal(next.gold,80); assert.deepEqual(Object.values(next.lifeRecovery!.claims),unpaid);
    for(const c of batches) assert.equal(Object.hasOwn(next.lifeRecovery!.claims,c.id),false);
  }
  for(const full of [false,true]) {
    const {project,item,state,input}=fixture(); assert.equal(placeFarmBuilding(project,state,{...input,typeId:'house'}).ok,true);
    const original=structuredClone(state.farmBuildingPlacements!.r!); state.farmBuildingPlacements={};
    const rawRecord=JSON.parse(JSON.stringify(original));
    const count=full?4096:2;
    state.lifeRecovery={nextSequence:count+1,claims:Object.fromEntries(Array.from({length:count},(_,i)=>{
      const id=`recovery:${i+1}`;
      return [id,{id,sourceKind:'farmBuildingPlacements',sourceId:'r',reason:'legacy-mixed',items:[{itemId:item.id,count:1}],unresolved:{record:rawRecord,detail:'legacy-mixed'}}];
    }))};
    let next=save(full?'legacy-full-before':'legacy-mixed-before',project,state);
    for(const id of ['recovery:1','recovery:2']) {
      const before=structuredClone(next), slots=[...storage.values];
      assert.equal(collectLifeRecoveryClaim(project,next,id).ok,true); assert.equal(Object.hasOwn(next.lifeRecovery!.claims,id),false);
      assert.equal(Object.keys(next.lifeRecovery!.claims).length,count);
      assert.equal(next.inventory[item.id],before.inventory[item.id]!+1); assert.equal(next.gold,90);
      assert.deepEqual([...storage.values],slots);
      captures.push({label:full?'legacy-full-net-owner-atomic':'legacy-mixed-no-dedup',before,after:structuredClone(next),slots});
      attempt('legacy-collected-id-absent',next,()=>collectLifeRecoveryClaim(project,next,id),{ok:false,reason:'missing-claim'});
      next=save('legacy-partial-save',project,next);
    }
    const unpaid=Object.values(next.lifeRecovery!.claims).filter(c=>c.items.length===0);
    assert.equal(unpaid.length,2); for(const c of unpaid) assert.deepEqual(c.unresolved!.record,original);
    assert.equal(next.lifeRecovery!.nextSequence,count+3); assert.equal(next.inventory[item.id],11);
  }
  for(const mode of ['capacity','sequence'] as const) {
    const {project,state,input}=fixture(); assert.equal(placeFarmBuilding(project,state,{...input,typeId:'house'}).ok,true);
    state.lifeRecovery= mode==='sequence'?{nextSequence:Number.MAX_SAFE_INTEGER-1,claims:{}}:{nextSequence:4096,claims:Object.fromEntries(Array.from({length:4095},(_,i)=>{
      const id=`recovery:${i+1}`;return [id,{id,sourceKind:'old',sourceId:'old',reason:'unknown',items:[],unresolved:{record:{unpaid:10},detail:'unknown'}}];
    }))};
    const snapshot=createSaveSnapshot(project,state); assert.equal(saveToSlot(storage,1,snapshot).ok,true);
    attempt(mode+'-conversion-refusal',state,()=>moveLifeRecoverySource(project,state,{sourceKind:'farmBuildingPlacements',sourceId:'r',reason:'removed'}),{ok:false,reason:'capacity'});
    project.database.farmBuildingTypes=[]; const before=structuredClone(state),slots=[...storage.values];
    assert.throws(()=>createSaveSnapshot(project,state),LifeReconciliationError); assert.throws(()=>applySaveSnapshot(project,snapshot),LifeReconciliationError);
    assert.deepEqual(structuredClone(state),before); assert.deepEqual([...storage.values],slots);
    captures.push({label:mode+'-writer-apply-refusal',before,after:structuredClone(state),snapshot,slots});
    assert.equal(removeFarmBuilding(state,'r').ok,true); assert.deepEqual(state.lifeRecovery,before.lifeRecovery);
    assert.deepEqual(state.inventory,before.inventory); assert.equal(state.gold,before.gold);
    captures.push({label:mode+'-nonrefund-demolition',before,after:structuredClone(state),slots:[...storage.values]});
  }
  {
    const {project,state,input,item}=fixture(); assert.equal(placeFarmBuilding(project,state,{...input,typeId:'house'}).ok,true);
    const original=JSON.parse(JSON.stringify(state.farmBuildingPlacements!.r!));state.farmBuildingPlacements={};
    state.lifeRecovery={nextSequence:Number.MAX_SAFE_INTEGER,claims:{'recovery:1':{id:'recovery:1',sourceKind:'farmBuildingPlacements',sourceId:'r',reason:'legacy',items:[{itemId:item.id,count:1}],unresolved:{record:original,detail:'legacy'}}}};
    save('legacy-sequence-before',project,state);
    attempt('legacy-sequence-no-prefix-credit',state,()=>collectLifeRecoveryClaim(project,state,'recovery:1'),{ok:false,reason:'capacity'});
  }
  {
    const {project,state,input}=fixture(); assert.equal(placeHomeDecoration(project,state,input).ok,true);
    const snapshot=createSaveSnapshot(project,state); Object.assign(snapshot,{schemaVersion:4});
    const legacy='oprn:save-slot:2', raw=JSON.stringify(snapshot); storage.setItem(legacy,raw);
    const parsed=readSaveSlot(storage,2); assert.equal(parsed.kind,'present'); if(parsed.kind!=='present') throw Error(parsed.kind);
    const next=applySaveSnapshot(project,parsed.snapshot); save('Save4-migration-repeat',project,save('Save4-migration',project,next));
    assert.equal(storage.getItem(legacy),raw); assert.deepEqual(next.homeDecorationPlacements,state.homeDecorationPlacements);
    captures.push({label:'legacy-raw-preserved',raw,parsed,after:structuredClone(next),slots:[...storage.values]});
  }
  console.log(JSON.stringify({ok:true,captures:captures.length,independent:true}));

} finally {
  writeFileSync(new URL('./public-state.json',import.meta.url),JSON.stringify({captures,final:s,slots:[...storage.values]},null,2));
  storage.clear();
}
