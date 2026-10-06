import {spawnSync} from 'node:child_process';
export function python(args,options={}){
 return spawnSync(process.env.POKEMON_HARNESS_PYTHON||'python3',['-B',...args],{...options,env:{...process.env,PYTHONOPTIMIZE:''}});
}
