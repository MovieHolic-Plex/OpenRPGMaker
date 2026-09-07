import receipt as r
import pathlib,subprocess,json,hashlib
assert not r.W.exists()
assert r.run('create-tree',['git','worktree','add','--no-checkout','-b','agent/life-full-spatial-rights-r3',str(r.W),'b5c679efc6c5e575f7a1afb65dfa86939aade325'],cwd=r.P)==0
assert r.run('initial-sparse',['git','sparse-checkout','set','--cone','src','test','scripts','openwiki','public','vendor','community-site/scripts','.omo/evidence/life-full-20260906/47-48/r3'],seconds=180)==0
assert r.run('initial-populate',['git','read-tree','-mu','HEAD'],seconds=180)==0
assert r.run('adopt',['npm','run','wt','--','adopt','--path',str(r.W)])==0
assert r.run('assert-inputs',['node','--input-type=module','-e', '''import { PLAYER_SOURCE_INPUT_INVENTORY, collectSourceInputRecords } from './scripts/lib/playerArtifactInventory.mjs';
import { statSync, readFileSync } from 'node:fs';
for (const input of PLAYER_SOURCE_INPUT_INVENTORY) { const s=statSync(input.path); if (input.kind==='file' ? !s.isFile() : !s.isDirectory()) throw Error(input.path); }
for (const p of ['src','test','scripts','openwiki','public','vendor','community-site/scripts','community-site/package.json','index.html','player.html','tsconfig.json','tsconfig.app.json','vite.config.ts','vite.player.config.ts','vite.standalone.config.ts','vitest.config.ts','node_modules/typescript','node_modules/vitest','node_modules/vite-node']) statSync(p);
console.log(JSON.stringify({inventory:PLAYER_SOURCE_INPUT_INVENTORY, records:await collectSourceInputRecords(process.cwd()), scripts:JSON.parse(readFileSync('package.json','utf8')).scripts},null,2));'''])==0
assert r.run('setup-frozen',['bash','-lc','git status --short; git rev-parse HEAD; git sparse-checkout list; df -B1 . /dev/shm; du -sh .; readlink node_modules'])==0
(r.E/'SETUP-FROZEN.json').write_text(json.dumps({'worktree':str(r.W),'base':'b5c679efc6c5e575f7a1afb65dfa86939aade325','sparse_changes_after_this_point':'forbidden','evidence':str(r.E)},indent=2))
