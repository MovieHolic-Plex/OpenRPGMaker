type Size = { readonly width: number; readonly height: number };
type Point = { readonly x: number; readonly y: number };

/** Field-local logical pixels. Fixed gutters keep HUD disclosure from moving a battler. */
function fitEnemyImage(field: Size, image: Size, anchor: Point): Point & { readonly fit: number } {
  const left = 16;
  const right = field.width - 16;
  const top = 32;
  const bottom = field.height - 24;
  const fit = Math.min(1, (right - left) / image.width, (bottom - top) / image.height);
  return {
    fit,
    x: Math.max(left + image.width * fit / 2, Math.min(right - image.width * fit / 2, anchor.x)),
    y: Math.max(top + image.height * fit, Math.min(bottom, anchor.y)),
  };
}

/** Called by the existing mounted field sync; owns no observer, frame or timer. */
export function fitBattleEnemy(field: HTMLElement, node: HTMLElement, authored: Point): Point {
  const requestedScale = Number(node.style.getPropertyValue("--battle-enemy-scale"));
  const width = field.clientWidth;
  const height = field.clientHeight;
  // Preserve all legacy/default geometry. Detached or hidden fields have no layout yet.
  if (requestedScale <= 1 || width <= 32 || height <= 56) return authored;
  const image = node.querySelector<HTMLImageElement>(".battle-enemy-image");
  if (!image) return authored;
  const style = getComputedStyle(image);
  const baseWidth = Number.parseFloat(style.getPropertyValue("--battle-enemy-base-width"));
  const baseHeight = Number.parseFloat(style.getPropertyValue("--battle-enemy-base-height"));
  // Only supported skins expose base dimensions; CSS may not have loaded on first mount.
  if (!(baseWidth > 0 && baseHeight > 0)) return authored;
  const groupTop = node.parentElement?.offsetTop ?? 0;
  const groupHeight = height - groupTop;
  const fitted = fitEnemyImage(
    { width, height },
    { width: baseWidth * requestedScale, height: baseHeight * requestedScale },
    { x: authored.x / 320 * width, y: groupTop + authored.y / 160 * groupHeight },
  );
  node.style.setProperty("--battle-enemy-fit", String(fitted.fit));
  return { x: fitted.x / width * 320, y: (fitted.y - groupTop) / groupHeight * 160 };
}
