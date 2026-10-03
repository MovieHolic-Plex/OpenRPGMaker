// Build the dedicated player harness fixture through the live canonical host API.
// This is gameplay QA data, not a shipping ZIP/package preparation receipt.
import { readFileSync, writeFileSync } from 'node:fs';
import { connectHostBridge } from '../lib/hostBridgeClient.mjs';

const report = JSON.parse(readFileSync('verify-shots/interview-live-handoff/report.json'));
const followup = JSON.parse(readFileSync('verify-shots/interview-live-handoff/followup.json'));
if (!report.passed || !followup.passed) throw Error('Canonical interview/content QA must pass first');
const bridge = await connectHostBridge(report.newFolderUrl);
const loaded = await bridge.call('oprn:project.load');
const project = JSON.parse(loaded.serialized);
let hydratedAssets = 0;
for (const asset of Object.values(project.assets.uploaded)) {
  if (asset.dataUrl || !asset.ref) continue;
  const bytes = await bridge.call('oprn:assets.read', {
    projectDir: report.afterReload.dir, sha256: asset.ref.sha256,
  });
  asset.dataUrl = `data:${asset.ref.mime};base64,${bytes}`;
  hydratedAssets++;
}
writeFileSync('output/qa/interview-e2e/runtime-project.json', JSON.stringify(project));
const receipt = {
  projectId: report.afterReload.projectId, revision: loaded.revision,
  hydratedAssets, source: 'canonical host API', startMapId: project.startMapId,
  startPos: project.startPos, exportPackagingVerified: false,
};
writeFileSync('verify-shots/interview-live-handoff/runtime-export.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
