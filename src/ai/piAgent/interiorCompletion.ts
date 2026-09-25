import type { Project } from '@/project/types';
import { referenceOwner } from '@/project/tilesetReferences';
import { inspectInteriorPlacement, type InteriorRequirements, type InteriorRoom } from '@/project/interiorPlacementAudit';
import type { PiToolCallRecord } from './toolAdapter';

const layoutSignature = (map: Project['maps'][string] | undefined) => map ? JSON.stringify([map.width, map.height, map.tilesetId, map.tileSize, map.lowerTiles, map.upperTiles, map.lowerTileStacks, map.upperTileStacks]) : '';

type Declaration = { wallMaterial: string; entry: { x: number; y: number }; rooms: InteriorRoom[] };
/** Carries inspection obligations through final replies; never paints or copies a map. */
export class PiInteriorCompletion {
  private declarations = new Map<string, Declaration>();
  private requirements = new Map<string, InteriorRequirements>();
  private previews = new Map<string, string>();
  constructor(private readonly enabled: boolean, fixed: Record<string, InteriorRequirements> = {}) {
    for (const [id, requirements] of Object.entries(fixed)) this.requirements.set(id, structuredClone(requirements));
  }
  record(project: Project, record: PiToolCallRecord) {
    if (!this.enabled || !record.result.ok) return;
    const a = (record.args && typeof record.args === 'object' ? record.args : {}) as Record<string, any>, id = String(a.mapId ?? '');
    if (record.name === 'inspect_interior_layout') {
      this.declarations.set(id, { wallMaterial: a.wallMaterial, entry: structuredClone(a.entry), rooms: structuredClone(a.rooms ?? []) });
      // Keep the first declared requirements, so a repair cannot silently weaken them.
      if (a.requirements && Object.keys(a.requirements).length && !this.requirements.has(id)) this.requirements.set(id, structuredClone(a.requirements));
    }
  }
  recordPreview(project: Project, data: { mapId?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown }) {
    if (!this.enabled) return;
    const id = String(data.mapId ?? ''), map = project.maps[id];
    if (map && data.x === 0 && data.y === 0 && data.w === map.width && data.h === map.height) this.previews.set(id, layoutSignature(map));
  }

  inspect(project: Project, base: Project) {
    const reports: { mapId: string; issues: unknown[] }[] = [];
    if (!this.enabled) return reports;
    for (const id of this.requirements.keys()) if (!project.maps[id]) reports.push({ mapId: id, issues: [{ code: 'REQUIRED_MAP_MISSING' }] });
    for (const [id, map] of Object.entries(project.maps)) {
      if (layoutSignature(map) === layoutSignature(base.maps[id]) && !this.requirements.has(id) && !this.declarations.has(id)) continue;
      const hasDictionary = (p: Project, tileId: string | undefined) => {
        const tile = tileId ? p.tilesets[tileId] : undefined;
        try { return !!tile && !!referenceOwner(p, tile).referenceDocuments?.some(c => c.id === 'direct-authoring' && c.documents.some(d => d.id === 'dictionary')); }
        catch { return false; }
      };
      if (!this.requirements.has(id) && !this.declarations.has(id) && !hasDictionary(project, map.tilesetId) && !hasDictionary(base, base.maps[id]?.tilesetId)) continue;
      const declaration = this.declarations.get(id), issues: unknown[] = [];
      if (!declaration) issues.push({ code: 'INSPECTION_REQUIRED', message: 'inspect_interior_layout에 실제 방 seed/문턱과 요구조건을 선언하세요.' });
      else try {
        const result = inspectInteriorPlacement(project, id, declaration.wallMaterial, declaration.entry, declaration.rooms, this.requirements.get(id));
        issues.push(...result.issues);
        if (result.omittedIssues) issues.push({ code: 'MORE_ISSUES', count: result.omittedIssues });
      } catch (error) { issues.push({ code: 'INSPECTION_FAILED', message: String(error) }); }
      if (this.previews.get(id) !== layoutSignature(map)) issues.push({ code: 'CURRENT_FULL_PREVIEW_REQUIRED' });
      if (issues.length) reports.push({ mapId: id, issues });
    }
    return reports;
  }
}
