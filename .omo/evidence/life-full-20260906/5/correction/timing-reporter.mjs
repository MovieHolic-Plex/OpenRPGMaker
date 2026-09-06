import { writeFileSync } from 'node:fs';
export default class TimingReporter {
  onTestModuleEnd(module) {
    if (!module.moduleId.endsWith('/test/debugSession.test.ts')) return;
    const result={module:module.moduleId,diagnostic:module.diagnostic(),tests:[...module.children.allTests()].map(test=>({name:test.name,diagnostic:test.diagnostic(),result:test.result()}))};
    writeFileSync(new URL('debug-timing-after.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({debugSessionTiming:result}));
  }
}
