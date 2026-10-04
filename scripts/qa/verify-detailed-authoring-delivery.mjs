// Verify captured live provider events against every character of the shipped manuals.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve('verify-shots/detailed-authoring-live');
const documents = JSON.parse(readFileSync('src/project/gameAuthoringPresets/documents.json', 'utf8'));
const task = readFileSync(`${out}/sent-task.txt`, 'utf8');
const brief = JSON.parse(readFileSync(`${out}/sent-brief.json`, 'utf8'));
// The checked-in evidence retains unmodified first provider snapshots for each role.
const capture = existsSync(`${out}/provider-prompts.json`) ? 'provider-prompts.json' : 'provider-events.json';
const events = JSON.parse(readFileSync(`${out}/${capture}`, 'utf8'));
const selected = ['common', brief.interview.genre, ...(brief.interview.secondary ? [brief.interview.secondary] : [])];
const roleChecks = [];
for (const event of events) {
  const inner = event.type === 'agent_event' ? event.event : event;
  if (inner.type !== 'prompt_inspection') continue;
  const text = inner.snapshot.sections.map(section => section.text).join('\n');
  const checks = selected.map(id => {
    const document = documents[id];
    const raw = JSON.stringify(document.text).slice(1, -1);
    return { id, sha256: document.sha256, characters: document.text.length,
      fullTextMatches: text.includes(document.text) || text.includes(raw),
      begin: text.includes(`AUTHORING_PRESET_BEGIN ${id} ${document.sha256}`),
      end: text.includes(`AUTHORING_PRESET_END ${id} ${document.sha256}`) };
  });
  roleChecks.push({ agent: event.agentId ?? 'single', model: inner.snapshot.model,
    boundary: inner.snapshot.boundary, at: inner.snapshot.at, documents: checks,
    displayOmittedCharacters: inner.snapshot.sections.reduce((n, s) => n + s.omittedCharacters, 0) });
}
const fields = { summary: brief.summary, concept: brief.interview.concept, protagonist: brief.interview.protagonist, notes: brief.interview.notes,
  ...Object.fromEntries(Object.entries(brief.answers).map(([slot, answer]) => [slot, answer.text])) };
const requestChecks = selected.map(id => ({ id, fullTextMatches: task.includes(documents[id].text), sha256: documents[id].sha256 }));
const fieldChecks = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, task.includes(value)]));
const rolePass = prefix => roleChecks.some(role => role.agent.startsWith(prefix) && role.documents.every(d => d.fullTextMatches && d.begin && d.end));
const report = JSON.parse(readFileSync(`${out}/report.json`, 'utf8'));
const saved = report.afterReload ?? report.sqlite;
const proof = { mocked: false, requestCharacters: task.length, requestChecks, fieldChecks,
  roleChecks, orchestratorVerified: rolePass('orchestrator-'), builderVerified: rolePass('builder-'),
  canonicalFolder: report.afterReload?.dir ?? report.sqlite?.dir,
  projectId: report.afterReload?.projectId ?? report.sqlite?.projectId,
  reloadVerified: Boolean(report.sameProjectAfterReload && report.sameBriefAfterReload),
  nativeWrites: (report.afterReload?.agentCommits ?? report.sqlite?.agentCommits ?? []).flatMap(c => c.tools),
  savedFieldChecks: { protagonist: saved?.hero === '지우', meetingPlace: saved?.mapNames?.includes('별빛 우체국 앞') === true },
  fullGameVerified: false,
  scope: 'Full preset delivery and the first real model write were observed. This does not verify complete game authoring or all runtime branches.' };
proof.passed = requestChecks.every(c => c.fullTextMatches) && Object.values(fieldChecks).every(Boolean)
  && proof.orchestratorVerified && proof.builderVerified && proof.reloadVerified
  && ['set_project_settings', 'upsert_actor', 'set_map_properties'].every(tool => proof.nativeWrites.includes(tool))
  && Object.values(proof.savedFieldChecks).every(Boolean);
writeFileSync(`${out}/delivery-proof.json`, JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ passed: proof.passed, requestCharacters: proof.requestCharacters,
  orchestratorVerified: proof.orchestratorVerified, builderVerified: proof.builderVerified,
  reloadVerified: proof.reloadVerified, nativeWrites: proof.nativeWrites }));
assert.ok(proof.passed, 'Live full-document delivery evidence is incomplete');
