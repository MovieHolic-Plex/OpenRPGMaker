import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
if (resolve(process.argv[1] ?? '') === resolve('scripts/verify-gates.mjs')) {
  const out = dirname(fileURLToPath(import.meta.url));
  const original = cp.spawnSync;
  let sequence = 0;
  cp.spawnSync = function(command, args, options) {
    const id = ++sequence;
    const start = {id,command,args,started:new Date().toISOString()};
    writeFileSync(join(out,id+'-start.json'),JSON.stringify(start,null,2)+'\n',{flag:'wx'});
    console.error('GATE_SUBPROCESS_START '+id+' '+command+' '+args.join(' '));
    const result = original.call(this,command,args,options);
    writeFileSync(join(out,id+'-end.json'),JSON.stringify({...start,finished:new Date().toISOString(),exit:result.status,signal:result.signal,error:result.error?.message,stdout:result.stdout,stderr:result.stderr},null,2)+'\n',{flag:'wx'});
    console.error('GATE_SUBPROCESS_END '+id+' exit='+result.status);
    return result;
  };
  syncBuiltinESMExports();
}
