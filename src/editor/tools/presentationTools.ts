import type { Project } from '@/project/types';
import type { ToolDefinition } from './types';

/** The configured artwork, rather than a model's claim that it made artwork. */
export function presentationArtIds(project: Project): string[] {
  return [...new Set([
    project.system.titleScreen?.backgroundResourceId,
    ...(project.system.opening?.enabled ? project.system.opening.scenes
      .filter(scene => scene.kind === 'image').map(scene => scene.resourceId) : []),
  ].filter((id): id is string => Boolean(id)))];
}

export function presentationArtImages(project: Project): { resourceId: string; dataUrl: string; label: string }[] {
  return presentationArtIds(project).flatMap(resourceId => {
    const asset = project.assets.uploaded[resourceId];
    const dataUrl = asset?.dataUrl;
    return asset && dataUrl && /^data:image\/(png|jpeg|webp);base64,/u.test(dataUrl)
      ? [{ resourceId, dataUrl, label: asset.name }] : [];
  });
}

export const PRESENTATION_TOOLS: readonly ToolDefinition[] = [{
  name: 'get_title_screen', mode: 'read',
  description: '현재 타이틀의 제목·배경·로고·효과·등장 순서·전환 설정을 읽는다.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  run(project) {
    return { summary: '현재 타이틀 설정입니다.', data: { titleScreen: project.system.titleScreen ?? null } };
  },
}, {
  name: 'show_title_opening', mode: 'read',
  description: '연결된 실제 타이틀·오프닝 그림과 현재 설정을 함께 본다. 생성했다는 말이나 리소스 이름만으로 검수하지 않는다.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  run(project) {
    const images = presentationArtImages(project);
    const missing = presentationArtIds(project).filter(id => !project.assets.uploaded[id]?.dataUrl && !project.assets.uploaded[id]?.ref);
    return { summary: `타이틀·오프닝 그림 ${images.length}장입니다. 이것은 원화 확인이며 실제 재생 확인은 별도입니다.`,
      data: { titleScreen: project.system.titleScreen ?? null, opening: project.system.opening ?? null,
        images: images.map(({ resourceId, label }) => ({ resourceId, label })), missing } };
  },
}];
