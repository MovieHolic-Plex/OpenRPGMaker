// Call only after the actual PNG review receipt is saved. Never infers user approval.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root='content-packs/joseon-folklore/skills';
const read=name=>JSON.parse(readFileSync(`${root}/${name}`,'utf8'));
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
console.log(readFileSync('/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/steering.md','utf8').trim());
const data=read('data.json'), smoke=read('smoke-results.json'),review=read('visual-review.json'), art=read('art-hashes.json');
assert.equal(smoke.result,'pass');assert.equal(smoke.dataSha256,hash(`${root}/data.json`));
assert.equal(review.userApproved,false);
for(const entry of [...review.inspectedFiles,...art])assert.equal(hash(entry.path),entry.sha256,entry.path+' changed since review');
for(const c of read('choreography-sources.json'))for(const l of c.layers)assert.equal(hash(l.path),l.sha256);
const files=[];
function walk(dir){for(const f of readdirSync(dir).sort()){
  if((f.startsWith('.')&&f!=='.gitignore')||f==='__pycache__'||f==='status.json')continue;
  const path=`${dir}/${f}`;
  if(statSync(path).isDirectory())walk(path);else files.push({path,sha256:hash(path),bytes:statSync(path).size});
}}
walk(root);
for(const file of ['README.md','design.json','data.json','art.json','smoke-results.json','visual-review.json'])assert.ok(files.some(f=>f.path===`${root}/${file}`));
assert.equal(data.skills.length,12);assert.equal(art.length,12);
const status={phase:'pilot',ready:true,readyMeaning:'pilot-files-saved-and-scoped-checks-complete',
  counts:{skills:12,classSkills:8,enemySkills:4,states:data.states.length,elements:data.elements.length,icons:art.length},
  reviewFiles:review.inspectedFiles.filter(f=>f.path.startsWith(root)).map(f=>f.path),
  checkCount:smoke.checkCount,userApproved:false,approval:'pending-user-review',
  liveProjectWritten:false,publicRegistered:false,gameIntegrated:false,browserPlaybackVerified:false,
  files};
// The last artifact write: every other owned file has already been saved and hashed.
writeFileSync(`${root}/status.json`,JSON.stringify(status,null,2)+'\n');
console.log(JSON.stringify({phase:status.phase,ready:status.ready,counts:status.counts,userApproved:false,savedFiles:files.length+1}));
