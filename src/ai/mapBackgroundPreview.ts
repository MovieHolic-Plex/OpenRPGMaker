import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { GameMap, Project } from "@/project/types";

/**
 * 맵 배경(파노라마) 정지 화면 — 빈 칸 뒤로 비치는 먼 풍경을 미리보기에도 그린다. 카메라 따라가기·스크롤은 첫 프레임(0) 기준.
 * 왜(2026-10-22 배경 조수 시험): show_map_region 이 배경을 그리지 않아 조수가 깐 하늘·바다를 눈으로 검수할 수 없었다(생성 도구만 첫 화면을 첨부).
 * 그린 층 수를 돌려준다. 그림을 못 읽은 층은 건너뛰고 그 사실을 문장으로 남긴다.
 */
export async function drawMapBackgroundPreview(context: CanvasRenderingContext2D, map: GameMap, project: Project, drawSize: number, tileSize: number,
  width: number, height: number, notes: string[]): Promise<number> {
  const bg = map.background;
  const ids = [bg?.imageId, ...(bg?.layers ?? []).map((layer) => layer.imageId)];
  const fits = [bg?.fit, ...(bg?.layers ?? []).map((layer) => layer.fit)];
  const loops = [[bg?.loopX !== false, bg?.loopY !== false], ...(bg?.layers ?? []).map((layer) => [layer.loopX !== false, layer.loopY !== false])];
  let drawn = 0;
  for (const [i, raw] of ids.entries()) {
    const id = (raw ?? "").trim();
    if (!id) continue;
    const url = resolveAssetResourceUrl(id, { project });
    if (!url) { notes.push(`배경 그림 ${id} 을 찾지 못했다`); continue; }
    let image: HTMLImageElement;
    try {
      image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => resolve(img); img.onerror = () => reject(new Error("load")); img.src = url; });
    } catch { notes.push(`배경 그림 ${id} 을 읽지 못했다`); continue; }
    const iw = image.naturalWidth, ih = image.naturalHeight;
    if (!iw || !ih) continue;
    if (fits[i] === "cover") {
      const scale = Math.max(width / iw, height / ih);
      context.drawImage(image, (width - iw * scale) / 2, (height - ih * scale) / 2, iw * scale, ih * scale);
    } else {
      const scale = drawSize / tileSize, w = iw * scale, h = ih * scale;
      const [loopX, loopY] = loops[i]!;
      for (let y = 0; y < (loopY ? height : 1); y += h) for (let x = 0; x < (loopX ? width : 1); x += w) context.drawImage(image, x, y, w, h);
    }
    drawn++;
  }
  return drawn;
}

