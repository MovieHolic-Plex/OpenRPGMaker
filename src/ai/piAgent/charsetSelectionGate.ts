import { decodeCharsetFrameIndex } from '@/assets/easyrpgRtp';
import { findCharsetAsset } from '@/assets/charsetCatalog';
import { findCharsetSemantic } from '@/assets/charsetSemantics';
import { charsetPreviewCandidates, type CharsetPreviewCandidate } from '../charsetPreview';
import type { Project } from '@/project/types';
import type { ToolResult } from '@/editor/tools/types';

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function selectionIdFor(project: Project, resource: string, slot: number): string | undefined {
  const asset = findCharsetAsset(resource);
  const textureKey = asset?.textureKey ?? (project.assets.uploaded[resource]?.kind === 'charset' ? resource : undefined);
  return textureKey ? `charset:${textureKey}:${slot}` : undefined;
}

/** Track identities by stable event/page/actor IDs; moving/deleting a page is not a new selection. */
function graphics(project: Project): Map<string, string> {
  const found = new Map<string, string>();
  const add = (path: string, resource: unknown, slot: number) => {
    if (typeof resource !== 'string') return;
    const id = selectionIdFor(project, resource, slot);
    if (id) found.set(path, id);
  };
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}/${String(object(item)?.id ?? index)}`)); return; }
    const row = object(value); if (!row) return;
    const graphic = object(row.graphic), sprite = object(graphic?.sprite);
    if (sprite && graphic?.transparent !== true) add(`${path}/graphic`, sprite.id,
      decodeCharsetFrameIndex(typeof graphic?.pattern === 'number' ? graphic.pattern : 0).characterIndex);
    if (typeof row.characterResourceId === 'string') add(`${path}/actor`, row.characterResourceId,
      typeof row.characterIndex === 'number' ? row.characterIndex : 0);
    for (const [key, child] of Object.entries(row)) if (key !== 'graphic' && child && typeof child === 'object') visit(child, `${path}/${key}`);
  };
  for (const map of Object.values(project.maps)) visit(map.events, `maps/${map.id}/events`);
  visit(project.database.actors, 'database/actors');
  visit(project.commonEvents, 'commonEvents');
  return found;
}

/** Credit a selection only after its exact result AND image reached a successful model turn. */
export class PiCharsetSelectionGate {
  private pending = new Map<string, { candidates: CharsetPreviewCandidate[]; image: string }>();
  private delivered = new Set<string>();
  private viewed = new Set<string>();
  offer(toolName: string, result: ToolResult, png: string): void {
    const candidates = charsetPreviewCandidates(toolName, result.data);
    if (result.ok && candidates.length && png) this.pending.set(JSON.stringify(result.data), { candidates, image: png });
  }
  payload(value: unknown): void {
    this.delivered.clear();
    const results = new Set<string>(), images = new Set<string>();
    const text = (value: unknown): void => {
      if (typeof value !== 'string') return;
      try { const row = JSON.parse(value); if (row.ok === true && !row.dataTruncated) results.add(JSON.stringify(row.data)); } catch { /* ordinary text */ }
    };
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      const row = object(value); if (!row) return;
      if (row.type === 'text' || row.type === 'input_text') text(row.text);
      if (row.type === 'function_call_output' || row.type === 'custom_tool_call_output') text(row.output);
      if (row.role === 'tool') text(row.content);
      const url = row.type === 'input_image' ? row.image_url : row.type === 'image_url' ? object(row.image_url)?.url : undefined;
      if (typeof url === 'string' && url.includes(';base64,')) images.add(url.slice(url.indexOf(',') + 1));
      const source = object(row.source), inline = object(row.inlineData) ?? object(row.inline_data);
      if (source?.type === 'base64' && typeof source.data === 'string') images.add(source.data);
      if (typeof inline?.data === 'string') images.add(inline.data);
      const fn = object(row.functionResponse); if (fn) text(object(fn.response)?.output);
      Object.values(row).forEach(child => { if (child && typeof child === 'object') visit(child); });
    };
    visit(value);
    for (const key of results) { const pending = this.pending.get(key); if (pending && images.has(pending.image)) pending.candidates.forEach(row => this.delivered.add(row.selectionId)); }
  }
  complete(success: boolean): string[] {
    const received = success ? [...this.delivered].filter(id => !this.viewed.has(id)) : [];
    if (success) this.delivered.forEach(id => this.viewed.add(id));
    this.delivered.clear();
    return received;
  }
  /** toolChosen: 이 호출에서 도구가 모델 대신 스스로 고른 칩(noteToolChosenGraphic) — 모델의 선택이 아니므로 면제한다. */
  afterWrite(before: Project, after: Project, toolChosen: ReadonlyArray<{ resource: string; pattern: number }> = []): ToolResult | null {
    const old = graphics(before);
    const chosenByTool = new Set<string>();
    for (const row of toolChosen) {
      const id = selectionIdFor(after, row.resource, decodeCharsetFrameIndex(row.pattern).characterIndex);
      if (id) chosenByTool.add(id);
    }
    // 같은 이벤트(또는 같은 배우)가 이미 쓰던 칩을 새 페이지에 그대로 옮기는 것은 새 선택이 아니다.
    // 실측(2026-10-24 v2 새 12 사례): 대장장이에게 조건 페이지를 더하며 원래 칩을 복사했는데 「새 페이지 경로」라 거절돼 gift·party 에서 같은 거절이 9~11번 났다.
    const owner = (path: string) => /^(maps\/[^/]+\/events\/[^/]+|database\/actors\/[^/]+|commonEvents\/[^/]+)/u.exec(path)?.[1] ?? path;
    const ownedBefore = new Set([...old].map(([path, id]) => `${owner(path)}|${id}`));
    for (const [path, selectionId] of graphics(after)) {
      if (old.get(path) === selectionId || this.viewed.has(selectionId) || chosenByTool.has(selectionId) || ownedBefore.has(`${owner(path)}|${selectionId}`)) continue;
      const match = /^charset:(.+):(\d+)$/u.exec(selectionId)!;
      const label = findCharsetSemantic(match[1]!, Number(match[2]))?.label ?? selectionId;
      return { ok: false, summary: `캐릭터 그림 선택을 되돌렸습니다: ${path}의 실제 칩은 「${label}」(${selectionId})입니다. `
        + 'list_npc_graphics(query:원하는 외형) 또는 list_resources(kind:"charset",query:원하는 외형)로 실제 후보 이미지를 먼저 확인하고, 그 결과의 selectionId 또는 nativeGraphic을 그대로 사용하세요. 캐릭터 칸 번호와 pattern 프레임 번호를 직접 바꾸지 마세요.' };
    }
    return null;
  }
}
