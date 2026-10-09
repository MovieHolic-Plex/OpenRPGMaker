// Browser module replay; isolated fixtures, no model calls or project writes.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true });
try {
 const page = await browser.newPage();
 await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
 await page.goto(process.env.BASE ?? 'http://127.0.0.1:9829/', { waitUntil: 'domcontentloaded' });
 const report = await page.evaluate(async () => {
  const { createPiGhostBridge } = await import('/src/editor/panels/aiPiGhostBridge.ts');
  const g = await import('/src/editor/agentGhostPreview.ts');
  const { createBlankProject } = await import('/src/project/defaults.ts');
  const { diffMapsForDelta } = await import('/src/ai/piAgent/mapDelta.ts');
  const base = createBlankProject(), id = Object.keys(base.maps)[0];
  const makeDelta = (i, t) => { const p = structuredClone(base); p.maps[id].lowerTiles[i] = t; return { type: 'map_delta', maps: diffMapsForDelta(base.maps, p.maps) }; };
  const send = (bridge, agentId, event) => bridge.handleEvent({ type: 'agent_event', agentId, event });
  const checks = [];
  const check = (name, ok) => { checks.push({ name, ok }); if (!ok) throw new Error(name); };
  const a = createPiGhostBridge({ baseProject: base });
  send(a, 'bad', makeDelta(0, 7)); send(a, 'good', makeDelta(1, 8)); a.flush();
  a.handleEvent({ type: 'agent_done', agentId: 'bad', ok: false });
  check('Failed worker rolled back while successful worker retained', a.draftProject().maps[id].lowerTiles[0] === base.maps[id].lowerTiles[0] && a.draftProject().maps[id].lowerTiles[1] === 8);
  a.handleEvent({ type: 'done', project: base });
  check('Final accepted project removes rejected preview', g.getAgentGhostPreviewState().previews.length === 0);
  send(a, 'good', makeDelta(1, 8)); a.flush();
  const b = createPiGhostBridge({ baseProject: base });
  check('New run clears old preview', g.getAgentGhostPreviewState().previews.length === 0);
  send(b, 'new', makeDelta(2, 9)); b.flush(); a.dispose();
  check('Old dispose preserves new preview and provider', g.getAgentGhostPreviewState().previews.length === 1 && g.getAgentGhostDraftMap(id).lowerTiles[2] === 9);
  send(a, 'late', makeDelta(0, 7)); a.flush();
  check('Late old events ignored', g.getAgentGhostDraftMap(id).lowerTiles[0] === base.maps[id].lowerTiles[0]);
  send(b, 'worker-b', { type: 'tool_start', name: 'paint_tiles', args: { mapId: id } });
  b.handleEvent({ type: 'agent_done', agentId: 'worker-a', ok: true });
  check('Other worker completion preserves running indicator', g.getAgentGhostPreviewState().runningToolName === 'paint_tiles');
  b.reconcile(base);
  check('Review reconcile removes filtered changes', g.getAgentGhostPreviewState().previews.length === 0);
  b.dispose();
  check('Owner dispose clears provider', !g.getAgentGhostDraftMap(id));
  return checks;
 });
 mkdirSync('output/evidence/team-ghost-ownership', { recursive: true });
 writeFileSync('output/evidence/team-ghost-ownership/report.json', JSON.stringify(report, null, 2));
 console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
