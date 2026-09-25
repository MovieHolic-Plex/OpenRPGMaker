// Transport contract probe only: simulated NDJSON, not a model-quality experiment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runPiAgentViaCompanion} from '../../src/ai/piAgent/client';
const project=JSON.parse(fs.readFileSync('output/paw-direct-v2/home-repair/result-project.json','utf8'));
const request:any={provider:'google-antigravity',project,task:'현대 주택',mapIds:['direct-home'],mode:'single'};
const done:any={type:'done',project,stats:{ms:1,turns:1,toolCalls:1,toolErrors:0},changedKeys:['maps'],interiorCompletion:[{mapId:'direct-home',issues:[{code:'REQUIRED_OBJECT_COUNT'}]}]};
const fetchImpl:any=async()=>new Response(JSON.stringify(done)+'\n',{headers:{'content-type':'application/x-ndjson'}});
await assert.rejects(runPiAgentViaCompanion(request,{fetchImpl}),/실내 미완료/);
done.interiorCompletion=[];
assert.equal((await runPiAgentViaCompanion(request,{fetchImpl})).type,'done');
const proof={pass:true,incompleteDoneRejected:true,validDoneAccepted:true,simulatedTransport:true,liveModel:false};
fs.writeFileSync('output/paw-direct-v2/client-contract-check.json',JSON.stringify(proof,null,2));console.log(proof);
