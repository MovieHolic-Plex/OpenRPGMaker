import ts from 'typescript';
import path from 'node:path';
const file = '.omo/evidence/life-full-20260906/12/ui/fixtures-r4/fixture.mts';
const config = ts.readConfigFile('tsconfig.json',ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed = ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());
if (parsed.errors.length) throw new Error(JSON.stringify(parsed.errors));
const program = ts.createProgram([...parsed.fileNames,path.resolve(file)],parsed.options);
const source = program.getSourceFile(path.resolve(file));
if (!source) throw new Error('Missing owned probe source');
const diagnostics = [...program.getSyntacticDiagnostics(source),...program.getSemanticDiagnostics(source)].map(d=>({
  code:d.code,line:d.start===undefined?undefined:source.getLineAndCharacterOfPosition(d.start).line+1,
  message:ts.flattenDiagnosticMessageText(d.messageText,'\n')
}));
console.log(JSON.stringify({config:'tsconfig.json',file,diagnostics},null,2));
process.exitCode=diagnostics.length?1:0;
