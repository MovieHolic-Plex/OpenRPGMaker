import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
const base='b7b02d97ad6cb3b493bd60691ec61970e8a0e37e';
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile);
const {options}=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());
const changed=execFileSync('git',['diff','--name-only',base,'HEAD','--','src'],{encoding:'utf8'}).trim().split('\n');
const previous=new Map(changed.map(file=>[resolve(file),execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'})]));
function graph(old) {
  const visited=new Map();
  function visit(file) {
    if(visited.has(file))return;
    const text=(old&&previous.get(file))||readFileSync(file,'utf8');
    // Emission removes type-only imports; static edges are the eager load cost.
    const js=ts.transpileModule(text,{fileName:file,compilerOptions:{...options,module:ts.ModuleKind.ESNext,verbatimModuleSyntax:false}}).outputText;
    const ast=ts.createSourceFile(file+'.js',js,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const dependencies=[];visited.set(file,dependencies);
    for(const node of ast.statements) {
      if(!(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))||!node.moduleSpecifier||!ts.isStringLiteral(node.moduleSpecifier))continue;
      const dep=ts.resolveModuleName(node.moduleSpecifier.text,file,options,ts.sys).resolvedModule?.resolvedFileName;
      if(dep&&dep.includes('/src/')&&!dep.includes('/node_modules/')&&/\.[jt]sx?$/.test(dep)){dependencies.push(dep);visit(dep);}
    }
  }
  visit(resolve('src/player/playSceneTestHooks.ts'));
  return visited;
}
const before=graph(true),after=graph(false);
const path=key=>relative(process.cwd(),key);
const result={base,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),method:'TypeScript emitted static import/export edges, local src only; dynamic and external modules excluded',beforeCount:before.size,afterCount:after.size,added:[...after.keys()].filter(k=>!before.has(k)).map(path),removed:[...before.keys()].filter(k=>!after.has(k)).map(path),before:Object.fromEntries([...before].map(([k,v])=>[path(k),v.map(path)])),after:Object.fromEntries([...after].map(([k,v])=>[path(k),v.map(path)]))};
writeFileSync(new URL('dependency-graph.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({base,head:result.head,beforeCount:result.beforeCount,afterCount:result.afterCount,added:result.added,removed:result.removed}));
