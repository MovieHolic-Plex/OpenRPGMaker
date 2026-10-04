import { resolve } from 'node:path';
import { withTsModule } from '../../../../scripts/ontology-ts-loader.mjs';
const args = process.argv.slice(2);
const option = (flag) => { const index=args.indexOf(flag); if(index<0 || !args[index+1]) throw new Error(`Missing ${flag}`);return resolve(args[index+1]); };
const projectDir=option('--project-dir'), evidenceDir=option('--evidence');
const repo=resolve(import.meta.dirname,'../../../..');
await withTsModule(resolve(import.meta.dirname,'parkingProject.ts'),'parking-project.mjs', async mod => {
  console.log(JSON.stringify(await mod.saveParkingProject(projectDir,evidenceDir,repo),null,2));
});
