import { spawn } from 'node:child_process';
import path from 'node:path';

export function run(argv: string[]): Promise<number> {
  return new Promise((resolve,reject)=>{
    // 'repair' is a separate service: queue.py is hashed into the gate profile and must not grow new stages.
    const [script,args]=argv[0]==='repair'?['repair.py',argv.slice(1)]:['queue.py',argv];
    const child=spawn('python3',[path.resolve('src/harnesses/beodeul-building-review/node',script),...args],{stdio:'inherit'});
    child.on('error',reject);
    child.on('exit',code=>resolve(code??1));
  });
}
