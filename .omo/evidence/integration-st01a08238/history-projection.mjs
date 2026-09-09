// Validation-only projection. Never writes source or resolves the held Git paths.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
export const root = process.cwd();
export const ref = '72f1f179b39972c3838922746c7641a57e95fce8';
const upstreamFiles = ['src/ai/conversationStore.ts', 'src/editor/panels/aiConversationHistoryModal.ts', 'src/project/supabaseProjectSync.ts'];
const upstream = new Map(upstreamFiles.map(file => [file, execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8' })]));
const conflict = /^<<<<<<< HEAD\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> 72f1f179b39972c3838922746c7641a57e95fce8\n/gm;
export function projection(path) {
  const file = relative(root, resolve(path.split('?')[0]));
  if (upstream.has(file)) return upstream.get(file);
  if (file === 'src/editor/panels/aiChatPanel.ts') {
    const text = readFileSync(path.split('?')[0], 'utf8');
    const matches = [...text.matchAll(conflict)];
    if (matches.length !== 1 || !matches[0][1].includes('historyIdentity')) throw new Error('Unexpected panel projection seam');
    return text.replace(conflict, (_all, _ours, theirs) => theirs);
  }
  if (file === 'src/editor/projectWikiCoordinator.ts') {
    const text = readFileSync(path.split('?')[0], 'utf8');
    const matches = [...text.matchAll(conflict)];
    if (matches.length !== 1 || !matches[0][1].includes('ProjectWikiExtractionTimeoutError')) throw new Error('Unexpected wiki projection seam');
    return text.replace(conflict, (_all, _ours, theirs) => theirs.replace('import { extractProjectWiki }', 'import { extractProjectWiki, ProjectWikiExtractionTimeoutError }'));
  }
  return undefined;
}
export const projectedFiles = [...upstreamFiles, 'src/editor/panels/aiChatPanel.ts', 'src/editor/projectWikiCoordinator.ts'];
