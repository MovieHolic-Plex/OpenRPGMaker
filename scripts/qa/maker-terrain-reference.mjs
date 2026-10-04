// Exercises the actual reference gate; no writes and no synthetic image approval.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { withTsModule } from '../ontology-ts-loader.mjs';
const [fixture, out] = process.argv.slice(2);
const p = JSON.parse(fs.readFileSync(fixture));
await withTsModule('src/ai/tilesetReferenceEvidence.ts', 'gate.mjs', async ({ TilesetReferenceEvidence }) => {
  const source = p.tilesets.beodeul_city;
  const terrain = source.structureKits.find(k => k.ai?.role === 'terrain');
  const prop = source.structureKits.find(k => k.ai?.role === 'prop');
  assert(terrain && prop);
  const sourceId = source.id;
  const gate = new TilesetReferenceEvidence();
  const args = { objectId: `kit:${sourceId}/${terrain.id}`, mapId:p.startMapId,x:8,y:8 };
  const blocked = gate.beforeWrite(p, 'stamp_object', args);
  assert(blocked && !blocked.ok, 'Terrain stamp must not bypass material references');
  assert.equal(gate.beforeWrite(p, 'stamp_object', {...args,objectId:`kit:${sourceId}/${prop.id}`}), null);
  assert.equal(gate.beforeWrite(p, 'stamp_object', {...args,objectId:`kit:${sourceId}/nonexistent`}), null); // Native dispatch rejects missing kit.
  const targetId = 'qa_target_without_references';
  const map = {...p.maps[p.startMapId],tilesetId:targetId};
  const target = {...source,id:targetId,referenceDocuments:[],referenceDocumentsOwner:undefined,referenceSourceTilesetId:undefined};
  const grafted = {...p,maps:{...p.maps,[p.startMapId]:map},tilesets:{...p.tilesets,[targetId]:target}};
  const graftBlock = gate.beforeWrite(grafted,'stamp_object',args);
  assert(graftBlock && !graftBlock.ok, 'Graft target without references must not bypass source references');
  const purpose = source.referenceDocuments[0].id;
  const required = gate.beforeWrite(p,'stamp_object',{...args,referencePurpose:purpose});
  assert(required && !required.ok);
  const bridge = source.structureKits.find(k=>k.id==='bd-pick-aqueduct-sewer-bridge-ns-stone');
  assert(bridge);
  const actualBypass = gate.beforeWrite(p,'stamp_object',{...args,objectId:`kit:${sourceId}/${bridge.id}`,referencePurpose:'beodeul-picks-field'});
  assert(actualBypass && !actualBypass.ok, 'Observed live bridge-as-road bypass must reject');
  fs.writeFileSync(out,JSON.stringify({terrainBlocked:true,propPreservesExistingRoute:true,graftedSourceBlocked:true,unreadPurposeBlocked:true,observedBridgeBypassBlocked:true,sourceId,terrainKit:terrain.id,propKit:prop.id,observedKit:bridge.id},null,2));
  console.log('Terrain source, graft source, unread purpose and live bypass rejected; ordinary props unchanged.');
});
