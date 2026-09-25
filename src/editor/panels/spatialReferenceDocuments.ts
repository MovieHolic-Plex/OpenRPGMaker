import type { TilesetReferenceCategory } from '@/project/tilesetReferences';
import { renderReferenceMarkdown } from './tilesetReferencePanel';
import { el } from '@/util/dom';

/** Same portable MD/image contract as tiles; defer long arrays until explicitly opened. */
export function spatialReferenceDocuments(categories: readonly TilesetReferenceCategory[] | undefined): HTMLElement[] {
  if (!categories?.length) return [];
  const root = el('details', { dataset: { testid: 'spatial-reference-documents' }, children: [el('summary', { text: 'AI 참고문서' })] });
  for (const category of categories) {
    const section = el('details', { children: [el('summary', { text: category.name }), el('p', { text: category.description })] });
    for (const document of category.documents) {
      const item = el('details', { children: [el('summary', { text: document.name })] });
      let rendered = false;
      item.addEventListener('toggle', () => {
        if (!(item as HTMLDetailsElement).open || rendered) return;
        rendered = true;
        item.append(renderReferenceMarkdown(document.markdown, category));
      });
      section.append(item);
    }
    for (const image of category.images) {
      const attachment = el('details', { children: [el('summary', { text: image.name }), el('p', { text: image.caption })] });
      let rendered = false;
      attachment.addEventListener('toggle', () => {
        if (!(attachment as HTMLDetailsElement).open || rendered) return;
        rendered = true;
        const img = el('img', { attrs: { src: image.dataUrl, alt: image.caption || image.name } });
        img.style.maxWidth = '100%'; img.style.imageRendering = 'pixelated';
        attachment.append(img);
      });
      section.append(attachment);
    }
    root.append(section);
  }
  return [root];
}
