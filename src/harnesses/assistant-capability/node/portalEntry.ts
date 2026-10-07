import { runPortalControls, runPortalProof, reviewPortalProof, recheckPortalRuntime } from './portalProof';

const [stage, root] = process.argv.slice(2);
if (!root || !['portals', 'portal-controls', 'portal-review', 'portal-recheck'].includes(stage!)) throw Error('portalEntry: supported stage and output required');
process.exit(await (stage === 'portal-recheck' ? recheckPortalRuntime(root, process.argv.slice(4)) : stage === 'portal-review' ? reviewPortalProof(root, process.argv.slice(4)) : stage === 'portals' ? runPortalProof(root) : runPortalControls(root)));
