// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { emptyGrowth } from '@/project/growth/types';
import { classGrowthArt, nodeGrowthArt } from '@/assets/growthTreeArt';
import { registerInlineAssets } from '@/assets/inlineAssetStore';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { growthArt } from '@/editor/panels/growthTree/art';
import { renderGrowthTreeTab } from '@/editor/panels/growthTree/studio';
import { createGrowthMenu } from '@/player/playerGrowthMenu';
import { renderStatusMenuDetailPanel } from '@/player/playerStatusMenuDetailRenderer';

const storeMock = vi.hoisted(() => ({ getCurrent: vi.fn(), subscribe: vi.fn(() => () => {}) }));
vi.mock('@/project/store', () => ({ store: storeMock }));
afterEach(() => { document.body.replaceChildren(); registerInlineAssets(null); });
function fixture() {
  const p = createBlankProject();
  p.growth = { ...emptyGrowth(), initialPoints: 5, skillTrees: [{ id: 'tree', name: 'Custom tree', description: '', classIds: [], allowReset: true, nodes: [
    { id: 'defense', name: '방어 숙련', description: '', x: 60, y: 60, cost: 1, maxRank: 3, level: 1, prerequisites: [], effect: { kind: 'parameter', parameter: 'defense', amount: 5 } },
    { id: 'missing', name: '미연결 스킬', description: '', x: 300, y: 60, cost: 1, maxRank: 1, level: 1, prerequisites: [], effect: { kind: 'skill', skillId: 'deleted' } },
  ] }] };
  storeMock.getCurrent.mockReturnValue(p);
  return p;
}
describe('growth art surface wiring', () => {
  it('renders editor graph, catalog and selected hero without changing data or focus semantics', () => {
    const p = fixture(), before = JSON.stringify(p), host = document.createElement('div');
    document.body.append(host);
    renderGrowthTreeTab(host, 'promotion');
    expect(host.querySelectorAll('.growth-body .growth-node img').length).toBe(p.database.classes.length);
    expect(host.querySelectorAll('.growth-catalog-item img').length).toBe(p.database.classes.length);
    expect(host.querySelector('.growth-inspector-title img')).not.toBeNull();
    const node = host.querySelector<HTMLButtonElement>('.growth-node')!;
    const image = node.querySelector('img')!;
    expect(image.getAttribute('draggable')).toBe('false');
    image.dispatchEvent(new Event('error'));
    expect(node.querySelector('img')).toBeNull();
    expect(node.getAttribute('aria-label')).toContain(p.database.classes[0]!.name);
    node.click();
    expect(host.querySelector('.growth-node')?.getAttribute('aria-pressed')).toBe('true');
    host.replaceChildren(); renderGrowthTreeTab(host, 'skill');
    expect(host.querySelectorAll('.growth-body .growth-node img')).toHaveLength(2);
    expect(host.querySelector('.growth-node.is-invalid img')).not.toBeNull();
    expect(host.querySelector('.growth-catalog-item img')).not.toBeNull();
    expect(host.querySelector('.growth-inspector-title img')).not.toBeNull();
    expect(JSON.stringify(p)).toBe(before);
  });
  it('replaces a failed image with a readable badge and handles unresolved URLs', () => {
    const art = growthArt('/missing.png', '별', 'test-art');
    art.querySelector('img')!.dispatchEvent(new Event('error'));
    expect(art.querySelector('img')).toBeNull();
    expect(art.textContent).toBe('별');
    expect(growthArt(null, '+', 'test-art').textContent).toBe('+');
  });
  it('uses the same registered art through the shipped menu icon and inline-asset contracts', () => {
    const p = fixture(), actor = p.database.actors[0]!, session = startSession(p);
    const options = { project: p, session, skillActorId: actor.id, selectedCommand: 'skills' as const, slots: [], waitModeEnabled: false };
    const detail = createGrowthMenu({ ...options, growthTab: 'tree' });
    expect(detail.entries[0]!.icon?.resourceId).toBe(nodeGrowthArt(p, p.growth!.skillTrees[0]!.nodes[0]!));
    const path = resolveAssetResourceUrl(detail.entries[0]!.icon!.resourceId)!;
    const inline = 'data:image/png;base64,dGVzdA==';
    registerInlineAssets({ [path.slice(1)]: inline });
    const panel = renderStatusMenuDetailPanel(p, detail);
    expect(panel.querySelector<HTMLElement>('[data-testid="growth-menu-art-node-defense"]')!.style.backgroundImage).toContain(inline);
    expect(detail.entries[1]!.disabled).toBe(true);
    expect(detail.entries[1]!.icon?.resourceId).toBe('cc0-jetrel-skill-book');
    const klass = p.database.classes.find(c => c.id === actor.classId)!;
    const target = { ...structuredClone(klass), id: 'next', name: '궁수' };
    p.database.classes.push(target); klass.promotions = [{ toClassId: target.id, requires: {} }];
    const promotion = createGrowthMenu({ ...options, growthTab: 'promotion' });
    expect(promotion.entries[0]!.icon?.resourceId).toBe(classGrowthArt(p, target));
    expect(renderStatusMenuDetailPanel(p, promotion).querySelector('[data-testid="growth-menu-art-class-next"]')).not.toBeNull();
  });
});
