import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const changed=JSON.parse(readFileSync(new URL('./changed-files.json',import.meta.url),'utf8'));
const config=ts.readConfigFile(resolve('tsconfig.app.json'),ts.sys.readFile);
if(config.error) throw Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());
if(parsed.errors.length) throw Error(JSON.stringify(parsed.errors));
const program=ts.createProgram([...new Set([...parsed.fileNames,...changed.map(p=>resolve(p))])],parsed.options);
let count=0;
for(const path of changed){const source=program.getSourceFile(resolve(path));if(!source)throw Error(`Missing ${path}`);const diagnostics=[...program.getSyntacticDiagnostics(source),...program.getSemanticDiagnostics(source)];count+=diagnostics.length;console.log(JSON.stringify({path,diagnostics:diagnostics.map(d=>({code:d.code,category:d.category,start:d.start,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}))}));}
process.exitCode=count?1:0;
