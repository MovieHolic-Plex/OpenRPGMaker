import type { Project, CinematicSequence } from './types';

/** Versioned metadata extension keeps authored timelines through older host validators.
 * The legacy sequence is a visible still/text fallback; current readers restore full timelines.
 * A legacy client's intentional scene edit invalidates that restoration, rather than being overwritten.
 */
export type CinematicWireCapsule = { version: 1; entries: { target: string; authored: CinematicSequence; fallback: CinematicSequence }[]; monsterCampaign?: Project['system']['monsterCampaign'] };
const KEY = 'oprnCinematicTimelines';
function stable(v: unknown): string { return JSON.stringify(v, (_k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x); }
function slots(p: Project): { target: string; sequence: CinematicSequence | undefined; set: (s: CinematicSequence) => void }[] {
  return [
    { target: 'opening', sequence: p.system.opening, set: s => { p.system.opening = s; } },
    { target: 'game-over', sequence: p.system.gameOver?.sequence, set: s => { if(p.system.gameOver) p.system.gameOver.sequence = s; } },
    ...(p.system.gameOvers ?? []).map(row => ({ target: 'game-over:' + row.id, sequence: row.settings.sequence, set: (s: CinematicSequence) => { row.settings.sequence = s; } })),
  ];
}
export function encodeCinematicWire(project: Project): Project {
  const candidates = slots(project).filter(s => s.sequence?.entry || s.sequence?.scenes.some(s => s.kind === 'animatic'));
  if (!candidates.length && !project.system.monsterCampaign && !project.meta.oprnCinematicTimelines) return project;
  const next = { ...project, meta: { ...project.meta }, system: { ...project.system, ...(project.system.gameOver ? { gameOver: { ...project.system.gameOver } } : {}), ...(project.system.gameOvers ? { gameOvers: project.system.gameOvers.map(r => ({ ...r, settings: { ...r.settings } })) } : {}) } };
  const entries: CinematicWireCapsule['entries'] = [];
  for (const slot of slots(next)) {
    const authored = slot.sequence;
    if (!authored || !authored.entry && !authored.scenes.some(s => s.kind === 'animatic')) continue;
    const { entry: _entry, ...fields } = authored;
    const fallback: CinematicSequence = { ...fields, enabled: authored.enabled && (!authored.entry || authored.entry.mode === 'new-game'), scenes: authored.scenes.map(s => {
      if (s.kind !== 'animatic') return s;
      const image = s.composition.layers.find(l => l.kind === 'image');
      const common = { id: s.id, narration: s.narration, durationMs: s.durationMs, ...(s.narrationAudioResourceId ? { narrationAudioResourceId: s.narrationAudioResourceId } : {}) };
      return image ? { ...common, kind: 'image' as const, resourceId: image.resourceId!, motion: 'none' as const } : { ...common, kind: 'text' as const };
    }) };
    entries.push({ target: slot.target, authored: structuredClone(authored), fallback: structuredClone(fallback) }); slot.set(fallback);
  }
  if (entries.length || project.system.monsterCampaign) next.meta.oprnCinematicTimelines = { version: 1, entries, ...(project.system.monsterCampaign ? { monsterCampaign: structuredClone(project.system.monsterCampaign) } : {}) };
  else delete next.meta.oprnCinematicTimelines;
  return next;
}
/** Mutates a detached parsed tree before normal shape/resource validation. */
export function decodeCinematicWire(project: Project): Project {
  const capsule = project.meta?.oprnCinematicTimelines;
  if (capsule === undefined) return project;
  if (!capsule || typeof capsule !== 'object' || capsule.version !== 1 || !Array.isArray(capsule.entries) || capsule.entries.length > 66) throw Error('Invalid cinematic metadata extension.');
  const seen = new Set<string>(), available = slots(project);
  for (const row of capsule.entries) {
    if (!row || typeof row.target !== 'string' || !row.authored || !row.fallback || seen.has(row.target)) throw Error('Invalid cinematic metadata entry.');
    seen.add(row.target); const slot = available.find(s => s.target === row.target);
    if (slot && stable(slot.sequence) === stable(row.fallback)) slot.set(structuredClone(row.authored));
  }
  if (!project.system.monsterCampaign && capsule.monsterCampaign) project.system.monsterCampaign = structuredClone(capsule.monsterCampaign);
  return project;
}
