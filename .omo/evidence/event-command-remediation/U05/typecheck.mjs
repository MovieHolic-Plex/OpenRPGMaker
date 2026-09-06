import ts from 'typescript';
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());
const paths=['src/editor/panels/eventEditor/commandBodyM2Actor.ts','src/editor/panels/eventEditor/commandBodyDatabase.ts','src/editor/panels/eventEditor/commandBodyAdvanced.ts','src/player/interpreter/m2Runtime.ts','src/editor/eventDraftValidator.ts','test/eventCommandRemediation/U05.test.ts','test/eventCommandRemediation/U05.fixture.ts','test/e2e/event-command-remediation-U05.spec.ts','test/e2e/eventCommandRemediationHarness.ts','src/editor/panels/eventEditor/commandEditDialog.ts','test/commandEditModalPreview.test.ts'];
const program=ts.createProgram([...new Set([...parsed.fileNames,...paths])],{...parsed.options,noEmit:true});
const diagnostics=paths.flatMap(path=>{const source=program.getSourceFile(path);if(!source)throw Error(path);return [...program.getSyntacticDiagnostics(source),...program.getSemanticDiagnostics(source)];});
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));
console.log(`${paths.length} files: ${diagnostics.length} diagnostics`);process.exitCode=diagnostics.length?1:0;
