// 맞지 않는 칩으로 선 이름 붙은 인물을 실행 끝에 만든다 — 걷기 칩(공방 char-gen 작업)과 같은 인물의 얼굴(생성 브로커)을 함께.
// 모델이 「무기점 주인」을 여관 주인 앞치마 칩으로 세우고 끝내던 것(2026-11-05 상점 주인 셋, 두 엔진)을 엔진이 판정해 고친다(src/ai/characterFit.ts).
// 이번 실행에서 새로 놓은 이벤트만 본다(저작자가 이미 둔 인물은 건드리지 않는다). 얼굴은 등록이 성공한 뒤에만 대사 얼굴을 외형으로 바꾼다 —
// 실패하면 원래 짝 얼굴 명령을 그대로 둔다(ultrabrain AMEND 2).
import type { Command, Project } from '../../src/project/types';
import type { CinematicStillResult } from '../../src/editor/openingImageGeneration';
import type { ToolContext, ToolResult } from '../../src/editor/tools/types';
import { decodeCharsetFrameIndex } from '../../src/assets/easyrpgRtp';
import { characterBrief, characterRoleText, charsetEntryOf, chipFitsRole, eventRoleText, type CharacterRole } from '../../src/ai/characterFit';
import { linkWalkChipAppearance } from '../../src/editor/tools/walkChipTools';
import { nestedCommandLists } from '../../src/project/authoredCommandIndex';
import { cloneProjectSharingSharedDictionaries } from '../../src/project/projectClone';

export const CHARACTER_FACE_CONCURRENCY = 3;
export const CHARACTER_MAKE_WALL_MS = 6 * 60_000;

export interface MisfitCharacter {
  readonly mapId: string;
  readonly eventId: string;
  readonly name: string;
  readonly role: CharacterRole;
  readonly why: string;
}

type EventLike = Project['maps'][string]['events'][number];

function visibleSprite(event: EventLike): { id: string; characterIndex: number } | undefined {
  for (const page of event.pages ?? []) {
    const g = page.graphic;
    if (!g || g.transparent === true || g.appearanceId || !g.sprite?.id) continue;
    return { id: g.sprite.id, characterIndex: decodeCharsetFrameIndex(typeof g.pattern === 'number' ? g.pattern : 0).characterIndex };
  }
  return undefined;
}

export function misfitCharacters(project: Project, base: Project): MisfitCharacter[] {
  const out: MisfitCharacter[] = [];
  for (const [mapId, map] of Object.entries(project.maps)) {
    const before = new Set((base.maps[mapId]?.events ?? []).map(event => event.id));
    for (const event of map.events) {
      if (before.has(event.id) || !event.name?.trim()) continue;
      const sprite = visibleSprite(event);
      if (!sprite || project.assets.uploaded[sprite.id]) continue;
      const told = characterRoleText(project, mapId, event.id);
      const fit = chipFitsRole(charsetEntryOf(sprite.id, sprite.characterIndex), `${told} ${eventRoleText(event)}`, `${told} ${event.name}`);
      if (!fit.fits && fit.role) out.push({ mapId, eventId: event.id, name: told ? `${event.name.trim()} (${told})` : event.name.trim(), role: fit.role, why: fit.why ?? '' });
    }
  }
  return out;
}

export interface CharacterMakeOutcome {
  readonly target: MisfitCharacter;
  readonly appearanceId?: string;
  readonly chipStarted: boolean;
  readonly faceResourceId?: string;
  readonly faceDataUrl?: string;
  readonly reason?: string;
}

export interface MakeCharactersDeps {
  readonly ctx: ToolContext;
  readonly runTool: (ctx: ToolContext, name: string, args: Record<string, unknown>) => ToolResult;
  readonly startChip?: (appearanceId: string, description: string, name: string) => Promise<void>;
  readonly drawFace?: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<CinematicStillResult>;
  readonly chipsLeft: number;
  readonly progress?: (summary: string) => void;
  readonly signal?: AbortSignal;
  readonly deadline?: number;
}

export function pointFacesAtAppearance(project: Project, mapId: string, eventId: string, appearanceId: string): number {
  const event = project.maps[mapId]?.events.find(entry => entry.id === eventId);
  let changed = 0;
  const walk = (list: Command[]): void => {
    for (let i = 0; i < list.length; i += 1) {
      const command = list[i]!;
      for (const nested of nestedCommandLists(command)) walk(nested as Command[]);
      if (command.kind !== 'changeFace' || command.appearanceId || !command.resourceId) continue;
      list[i] = { ...command, appearanceId, resourceId: '' };
      changed += 1;
    }
  };
  for (const page of event?.pages ?? []) walk(page.commands ?? []);
  return changed;
}

function link(deps: MakeCharactersDeps, target: MisfitCharacter, description: string): string | undefined {
  const draft = cloneProjectSharingSharedDictionaries(deps.ctx.project);
  const { record } = linkWalkChipAppearance(draft, { name: target.name, description, events: [{ mapId: target.mapId, eventId: target.eventId }] });
  deps.ctx.project = draft;
  return record.id;
}

/**
 * 맞지 않는 인물마다: 외형을 만들어 잇고(지금 칩이 임시로 선다) → 공방에 걷기 칩 작업 → 얼굴 한 장을 그려 외형 face 에 넣고 대사 얼굴을 외형으로.
 * 걷기 칩은 기다리지 않는다(5~12분, 편집기가 끝내면 칩을 바꾼다). 얼굴은 동시 3장·시한 안에서만.
 */
export async function makeCharacters(targets: readonly MisfitCharacter[], deps: MakeCharactersDeps): Promise<CharacterMakeOutcome[]> {
  const picked = targets.slice(0, Math.max(0, deps.chipsLeft));
  const linked: FaceJob[] = [];
  for (const target of picked) {
    const description = characterBrief(target.name, target.role);
    let appearanceId: string | undefined;
    try { appearanceId = link(deps, target, description); }
    catch (error) { linked.push({ target, appearanceId: '', description, chipStarted: false, reason: error instanceof Error ? error.message : String(error) }); continue; }
    let chipStarted = false, reason: string | undefined;
    if (deps.startChip && appearanceId) {
      try { await deps.startChip(appearanceId, description, target.name); chipStarted = true; }
      catch (error) { reason = `걷기 칩 작업을 세우지 못했다: ${error instanceof Error ? error.message : String(error)}`; }
    }
    linked.push({ target, appearanceId: appearanceId ?? '', description, chipStarted, ...(reason ? { reason } : {}) });
  }
  if (linked.length) deps.progress?.(`맞는 칩이 없는 ${linked.length}명을 만드는 중: ${linked.map(entry => entry.target.name).join(', ')}`);
  return drawFaces(linked, deps);
}

export interface FaceJob {
  readonly target: MisfitCharacter;
  readonly appearanceId: string;
  readonly description: string;
  readonly chipStarted: boolean;
  readonly reason?: string;
  readonly events?: readonly { readonly mapId: string; readonly eventId: string }[];
}

/** 모델이 generate_walk_chip 으로 만든 외형도 얼굴이 없으면 같은 길로 그린다(도구 응답 45초를 막지 않게 실행 끝으로 미룬다). */
export function facelessNewAppearances(project: Project, base: Project, skip: ReadonlySet<string>): FaceJob[] {
  const before = new Set((base.database.characterAppearances ?? []).map(app => app.id));
  return (project.database.characterAppearances ?? []).filter(app => !before.has(app.id) && !skip.has(app.id) && !app.face && !app.bust && app.description.trim()).map(app => {
    const events = eventsWearing(project, base, app.id);
    const role = { rule: { role: /$^/u, label: '인물', looks: [], brief: '' }, elder: false, child: false };
    return { target: { mapId: events[0]?.mapId ?? '', eventId: events[0]?.eventId ?? '', name: app.name, role, why: '' }, appearanceId: app.id, description: app.description, chipStarted: true, events };
  });
}

/** 이번 실행에 새로 놓인 이벤트 중 이 외형을 입은 것 — 저작자가 전에 둔 인물의 대사 얼굴은 건드리지 않는다. */
export function eventsWearing(project: Project, base: Project, appearanceId: string): { mapId: string; eventId: string }[] {
  return Object.entries(project.maps).flatMap(([mapId, map]) => {
    const before = new Set((base.maps[mapId]?.events ?? []).map(event => event.id));
    return map.events.filter(event => !before.has(event.id) && event.pages?.some(page => page.graphic?.appearanceId === appearanceId)).map(event => ({ mapId, eventId: event.id }));
  });
}

export async function drawFaces(linked: readonly FaceJob[], deps: Omit<MakeCharactersDeps, 'chipsLeft' | 'startChip'>): Promise<CharacterMakeOutcome[]> {
  const outcomes: CharacterMakeOutcome[] = new Array(linked.length);
  let next = 0, done = 0;
  const worker = async (): Promise<void> => {
    while (next < linked.length) {
      const index = next++;
      const entry = linked[index]!;
      const base = { target: entry.target, chipStarted: entry.chipStarted, ...(entry.appearanceId ? { appearanceId: entry.appearanceId } : {}) };
      if (!entry.appearanceId || !deps.drawFace) { outcomes[index] = { ...base, reason: entry.reason ?? '얼굴 그리기 경로가 없다' }; continue; }
      if (deps.signal?.aborted || (deps.deadline !== undefined && Date.now() > deps.deadline)) { outcomes[index] = { ...base, reason: '시간이 모자라 얼굴을 그리지 못했다' }; continue; }
      let still: CinematicStillResult;
      try { still = await deps.drawFace({ prompt: `${entry.target.name} portrait`, name: `${entry.target.name} 얼굴`, appearancePortrait: { name: entry.target.name, description: entry.description } }, deps.signal); }
      catch (error) {
        if (deps.signal?.aborted) throw error;
        still = { ok: false, code: 'image-generation-failed', summary: error instanceof Error ? error.message : String(error) };
      }
      done += 1;
      if (still.ok && !still.resourceId.startsWith('appearance-face')) still = { ok: false, code: 'editor-too-old', summary: '편집기가 인물 얼굴 그리기를 모른다(판이 예전이다) — 그린 그림을 얼굴로 쓰지 않는다' };
      if (!still.ok) { outcomes[index] = { ...base, reason: still.summary }; deps.progress?.(`얼굴 ${done}/${linked.length} — 「${entry.target.name}」 실패`); continue; }
      const record = deps.ctx.project.database.characterAppearances?.find(app => app.id === entry.appearanceId);
      if (!record || record.face) { outcomes[index] = { ...base, reason: '그리는 동안 외형이 지워졌거나 이미 얼굴이 생겼다' }; continue; }
      const registered = deps.runTool(deps.ctx, 'upsert_resource', { resource: { id: still.resourceId, name: still.name, kind: 'faceset', dataUrl: still.dataUrl } });
      if (!registered.ok) { outcomes[index] = { ...base, reason: registered.summary }; continue; }
      const draft = cloneProjectSharingSharedDictionaries(deps.ctx.project);
      draft.database.characterAppearances!.find(app => app.id === entry.appearanceId)!.face = { resourceId: still.resourceId };
      for (const ref of entry.events ?? [{ mapId: entry.target.mapId, eventId: entry.target.eventId }]) if (ref.mapId) pointFacesAtAppearance(draft, ref.mapId, ref.eventId, entry.appearanceId);
      deps.ctx.project = draft;
      outcomes[index] = { ...base, faceResourceId: still.resourceId, faceDataUrl: still.dataUrl };
      deps.progress?.(`얼굴 ${done}/${linked.length} — 「${entry.target.name}」 그려 붙임`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CHARACTER_FACE_CONCURRENCY, linked.length) }, worker));
  return outcomes;
}

export function characterMakeSummary(outcomes: readonly CharacterMakeOutcome[], skipped: readonly MisfitCharacter[]): string {
  const lines = outcomes.map(o => `${o.target.name}(${o.target.role.rule.label}): ${o.chipStarted ? '걷기 칩 만드는 중' : '걷기 칩 못 세움'} · ${o.faceResourceId ? '얼굴 그림' : `얼굴 없음 — ${o.reason ?? ''}`}`);
  const rest = skipped.length ? [`상한이라 가장 가까운 칩으로 둔 사람: ${skipped.map(s => s.name).join(', ')}`] : [];
  return [`번들 칩이 역할과 맞지 않는 사람 ${outcomes.length}명을 새로 만들었습니다 — ${lines.join(' / ')}.`, ...rest].join(' ');
}
