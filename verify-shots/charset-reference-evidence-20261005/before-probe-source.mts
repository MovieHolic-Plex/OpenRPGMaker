import {writeFileSync} from 'node:fs';
import {queryNpcGraphics} from '/home/main/.codex/worktrees/99e0/rpg-zzu/src/assets/charsetQuery';
import {searchResources} from '/home/main/.codex/worktrees/99e0/rpg-zzu/src/assets/resourceSearch';
const queries=['king','golem','골렘','animal','흑발 여성 마법사'];
const result=queries.map(query=>({query,npc:queryNpcGraphics(query,100).map(r=>({id:`charset:${r.entry.textureKey}:${r.entry.characterIndex}`,label:r.entry.label})),resources:searchResources('charset',query).map(r=>({id:r.id,label:r.label}))}));
writeFileSync('/tmp/charset-reference-before.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
