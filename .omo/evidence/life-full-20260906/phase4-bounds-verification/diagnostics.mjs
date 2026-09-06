import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
const identity = JSON.parse(readFileSync(new URL("./identity.json", import.meta.url), "utf8"));
const files = Object.keys(identity.sourceSha256).filter(f => /^(src|test)\/.*\.ts$/.test(f));
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = files.flatMap(file => {
 const source=program.getSourceFile(file); if(!source) throw new Error(`Missing ${file}`);
 return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
});
const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:n=>n,getCurrentDirectory:()=>process.cwd(),getNewLine:()=>"\n"});
writeFileSync(new URL("./diagnostic-results.json",import.meta.url),JSON.stringify({files,count:diagnostics.length,formatted},null,2)+"\n",{flag:"wx"});
console.log(formatted || `Zero diagnostics on ${files.length} changed source/test files.`);
process.exit(diagnostics.length ? 1 : 0);
