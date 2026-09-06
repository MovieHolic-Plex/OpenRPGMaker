import { spawnSync,execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const [name,seconds,command,...args]=process.argv.slice(2);
const argv=["--timeout","900","/tmp/rpg-zzu-life-full-qa-01a0727b.lock","timeout","--signal=TERM","--kill-after=15s",`${seconds}s`,command,...args];
const started=new Date().toISOString();
const result=spawnSync("flock",argv,{encoding:"utf8",maxBuffer:64*1024*1024});
writeFileSync(new URL(`./${name}.json`,import.meta.url),JSON.stringify({command:["flock",...argv],cwd:process.cwd(),head:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),tree:execFileSync("git",["rev-parse","HEAD^{tree}"],{encoding:"utf8"}).trim(),started,finished:new Date().toISOString(),exit:result.status,signal:result.signal,error:result.error?.message,stdout:result.stdout,stderr:result.stderr},null,2)+"\n",{flag:"wx"});
console.log(`${name}: exit ${result.status}`); process.exit(result.status ?? 1);
