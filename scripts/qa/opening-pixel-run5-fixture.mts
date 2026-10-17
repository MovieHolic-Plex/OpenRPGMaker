import fs from 'node:fs';
import type { Project } from '../../src/project/types.ts';

const [, , input, generated, output] = process.argv;
if (!input || !generated || !output) throw Error('Usage: opening-pixel-run5-fixture.mts <base> <generated-project> <out>');
const base = JSON.parse(fs.readFileSync(input, 'utf8')) as Project;
const prior = JSON.parse(fs.readFileSync(generated, 'utf8')) as Project;
const dedicated = Object.fromEntries(Object.entries(prior.assets.uploaded).filter(([id, asset]) =>
  /^opening_still_[0-9a-f-]+$/iu.test(id) && asset.kind === 'backdrop'));
const project: Project = {
  ...base,
  assets: { ...base.assets, uploaded: { ...base.assets.uploaded, ...dedicated } },
};
fs.writeFileSync(output, JSON.stringify(project));
console.log(JSON.stringify({ output, importedDedicatedBackdrops: Object.keys(dedicated), uploaded: Object.keys(project.assets.uploaded).length }, null, 1));
