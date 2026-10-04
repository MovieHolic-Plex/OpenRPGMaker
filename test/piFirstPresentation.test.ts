import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { inspectFirstPresentation } from '@/ai/piAgent/firstPresentation';
import { presentationArtImages, PRESENTATION_TOOLS } from '@/editor/tools/presentationTools';

function authored() {
  const project = createBlankProject();
  for (const id of ['title-art', 'opening-art', 'detail-art']) project.assets.uploaded[id] = {
    id, name: id, kind: 'picture', dataUrl: 'data:image/png;base64,AAA=', meta: {},
  };
  project.system.titleScreen = { ...project.system.titleScreen!, title: '멈춘 시계의 기억', backgroundResourceId: 'title-art',
    backgroundFit: 'cover', logoStyle: 'gold', sequence: { logoReveal: 'rise' }, transition: { kind: 'fade' } };
  project.assets.uploaded['detail-art'] = { ...project.assets.uploaded['opening-art']!, id: 'detail-art' };
  project.system.opening = { enabled: true, skippable: true, scenes: ['opening-art', 'detail-art', 'opening-art'].map((resourceId, index) => ({ id: `opening-${index}`, kind: 'image' as const, resourceId, narration: '멈춘 시계에 기억이 남았다.', durationMs: 4000, motion: 'none' as const, direction: { transition: { kind: 'cut' as const, durationMs: 0 } } })) };
  return project;
}

describe('first creation presentation boundary', () => {
  it('rejects a renamed default title and disabled opening', () => {
    const project = createBlankProject();
    project.system.titleScreen!.title = '멈춘 시계의 기억';
    project.system.opening = { enabled: false, skippable: true, scenes: [] };
    const issues = inspectFirstPresentation(project).join('\n');
    expect(issues).toContain('작품 전용 타이틀 배경');
    expect(issues).toContain('꺼져 있거나 비어');
  });
  it('requires a linked real image, automatic bounded duration and a return path', () => {
    const project = authored();
    expect(inspectFirstPresentation(project)).toEqual([]);
    expect(presentationArtImages(project).map(image => image.resourceId)).toEqual(['title-art', 'opening-art', 'detail-art']);
    delete project.assets.uploaded['opening-art'];
    project.system.opening!.scenes[0]!.durationMs = 0;
    project.system.opening!.skippable = false;
    const issues = inspectFirstPresentation(project).join('\n');
    expect(issues).toContain('실제 그림을 검수할 수 없는');
    expect(issues).toContain('자동 진행');
    expect(issues).toContain('건너뛸');
  });
  it('does not accept text-only openings or an image name without image bytes', () => {
    const project = authored();
    project.system.opening!.scenes = [{ id: 'black-text', kind: 'text', narration: '시계를 찾는다.', durationMs: 6000 }];
    project.assets.uploaded['title-art']!.dataUrl = undefined;
    const issues = inspectFirstPresentation(project).join('\n');
    expect(issues).toContain('검은 화면의 글뿐');
    expect(issues).toContain('작품 전용 타이틀 배경');
    expect(presentationArtImages(project)).toEqual([]);
  });
  it('rejects a single zoomed image as a storyboard', () => {
    const project = authored();
    project.system.opening!.scenes = [project.system.opening!.scenes[0]!];
    expect(inspectFirstPresentation(project).join('\n')).toContain('세 컷');
  });
  it('preserves the content-addressed canonical asset contract', () => {
    const project = authored();
    for (const id of ['title-art', 'opening-art', 'detail-art']) {
      const asset = project.assets.uploaded[id]!;
      asset.dataUrl = undefined;
      asset.ref = { sha256: id === 'title-art' ? 'a'.repeat(64) : 'b'.repeat(64), mime: 'image/png', bytes: 400000, extension: 'png' };
    }
    expect(inspectFirstPresentation(project)).toEqual([]);
    // Inline bytes are unavailable here. The actual image must arrive from the browser asset bridge.
    expect(presentationArtImages(project)).toEqual([]);
    const show = PRESENTATION_TOOLS.find(tool => tool.name === 'show_title_opening')!;
    expect(show.run(project, {}).summary).toContain('원화 3장');
  });
});
