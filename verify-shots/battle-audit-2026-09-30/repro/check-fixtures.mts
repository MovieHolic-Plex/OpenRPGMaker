import {readFileSync} from 'node:fs';
import {deserialize} from '../../src/project/io';
for(const id of ['input-auto','combo-menu','crosskind','same-name','capture-cancel']) {
 try {deserialize(readFileSync('.omo/battle-audit-3852/'+id+'.json','utf8'));console.log(id+':valid');}
 catch(e){console.log(id+':'+String(e).split('\n').slice(0,12).join('\n'));}
}
