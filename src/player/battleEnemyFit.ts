type Size = { readonly width: number; readonly height: number };
type Point = { readonly x: number; readonly y: number };

/** Field-local gutters (logical px). Fixed so HUD disclosure never moves a battler. */
const GUTTER = { side: 16, top: 32, bottom: 24 } as const;

/** Field-local logical pixels. Fixed gutters keep HUD disclosure from moving a battler. */
export function fitEnemyImage(field: Size, image: Size, anchor: Point, top: number = GUTTER.top): Point & { readonly fit: number } {
  const left = GUTTER.side;
  const right = field.width - GUTTER.side;
  const bottom = field.height - GUTTER.bottom;
  // Shrink around the authored feet rather than pushing every large sprite to
  // the same bottom/centre. Formation spacing and row depth must survive fitting.
  const minimumFit = Math.min(1, 32 / Math.max(image.width, image.height),
    (right - left) / image.width, (bottom - top) / image.height);
  const x = Math.max(left + image.width * minimumFit / 2,
    Math.min(right - image.width * minimumFit / 2, anchor.x));
  const y = Math.max(top + image.height * minimumFit, Math.min(bottom, anchor.y));
  const fit = Math.max(0, Math.min(1,
    2 * Math.min(x - left, right - x) / image.width,
    (y - top) / image.height));
  return {
    fit,
    x,
    y,
  };
}

type Measured = { readonly width: number; readonly height: number; readonly groupTop: number; readonly groupHeight: number; readonly box: Size; readonly bigBoss: boolean };

/** 필드 논리 크기와 요청 상자(기본 치수 × 배율). 레이아웃·스킨 CSS 가 아직 없으면 undefined. */
function measure(field: HTMLElement, node: HTMLElement, requestedScale: number): Measured | undefined {
  const width = field.clientWidth;
  const height = field.clientHeight;
  // Preserve all legacy/default geometry. Detached or hidden fields have no layout yet.
  if (width <= 32 || height <= 56) return undefined;
  const image = node.querySelector<HTMLImageElement>(".battle-enemy-image");
  if (!image) return undefined;
  const style = getComputedStyle(image);
  const baseWidth = Number.parseFloat(style.getPropertyValue("--battle-enemy-base-width"));
  const baseHeight = Number.parseFloat(style.getPropertyValue("--battle-enemy-base-height"));
  // Only supported skins expose base dimensions; CSS may not have loaded on first mount.
  if (!(baseWidth > 0 && baseHeight > 0)) return undefined;
  const groupTop = node.parentElement?.offsetTop ?? 0;
  const bigBoss = field.closest<HTMLElement>(".battle-scene")?.dataset.battleBigBoss === "true";
  return { width, height, groupTop, groupHeight: height - groupTop, box: { width: baseWidth * requestedScale, height: baseHeight * requestedScale }, bigBoss };
}

const bigCell = (node: HTMLElement): boolean => (Number(node.dataset.pixelEnemyCell) || 0) > 96;

/**
 * 큰 도트 시트(칸 128 이상)의 위 한계와 발 y(필드 px). 저작 발 위치에서 위 여백까지로는 모자라
 * (1440×900 실측: 칸 192·256 이 모두 같은 131 무대 px 로 눌렸고 머리가 전장 위 안내 창 뒤로 들어갔다)
 * 위 한계를 적 무리 상자 위끝(안내 창 아래)으로 두고, 통째로 들어갈 만큼만 발을 아래로 내린다 —
 * 전장 아래 여백과 이름표 바닥(plateFloor, 저작 단위)을 넘지 않는다.
 * 큰 보스 전투(씬 data-battle-big-boss)는 스킨이 무대 위 여백을 윗창 자리까지 줄였으므로 위 여백(32)을 두지 않고 그 위끝까지 쓴다.
 */
function bigSheetFoot(m: Measured, authoredY: number, plateFloor: number | undefined): { readonly top: number; readonly y: number } {
  const top = Math.max(m.bigBoss ? 0 : GUTTER.top, m.groupTop);
  const floor = plateFloor === undefined ? Infinity : m.groupTop + plateFloor / 160 * m.groupHeight;
  const lowest = Math.min(m.height - GUTTER.bottom, floor);
  const authoredPx = m.groupTop + authoredY / 160 * m.groupHeight;
  return { top, y: Math.min(lowest, Math.max(authoredPx, top + m.box.height)) };
}

/**
 * Called by the existing mounted field sync; owns no observer, frame or timer.
 * `plateFloor` = 이름표가 전장 아래로 잘리지 않는 발 y 상한(저작 단위, battleFieldDom enemyPlateFloors). 큰 시트만 쓴다.
 */
export function fitBattleEnemy(field: HTMLElement, node: HTMLElement, authored: Point, plateFloor?: number): Point {
  const requestedScale = Number(node.style.getPropertyValue("--battle-enemy-scale"));
  // 확대하지 않는 적(대부분)은 레이아웃을 읽지 않고 돌아간다. clientWidth 는 방금 쓴 DOM 때문에 동기
  // 레이아웃을 강제한다 — 전투 진입 한 번에 적마다 한 번씩이었다(브라우저 실측 작업 51–110ms 의 주범).
  // 예외: 큰 도트 시트(칸 128·192·256, 상자 = 칸×2)는 100% 에서도 전장보다 클 수 있어 늘 잰다.
  // 칸 96 이하 상자(×배율)는 예전처럼 재지 않는다.
  const cell = Number(node.dataset.pixelEnemyCell) || 0;
  if (!(requestedScale > 1) && !(cell * requestedScale > 96)) return authored;
  const m = measure(field, node, requestedScale);
  if (!m) return authored;
  let anchorY = m.groupTop + authored.y / 160 * m.groupHeight;
  let top: number = GUTTER.top;
  if (bigCell(node)) ({ top, y: anchorY } = bigSheetFoot(m, authored.y, plateFloor));
  const fitted = fitEnemyImage({ width: m.width, height: m.height }, m.box, { x: authored.x / 320 * m.width, y: anchorY }, top);
  node.style.setProperty("--battle-enemy-fit", String(fitted.fit));
  return { x: fitted.x / m.width * 320, y: (fitted.y - m.groupTop) / m.groupHeight * 160 };
}

/**
 * 도트 측면 진형용(진형 벌리기 전): 큰 시트 적의 자리를 맞춤 뒤 실제로 설 곳(발을 내린 y, 상자가 왼쪽 여백 안에 드는 x)으로 옮기고
 * 맞춤 배율을 미리 노드에 쓴다 — 진형이 맞춤 전 상자(칸×2)나 저작 발 위치로 벌리면 내려선 보스가 앞줄 적을 덮었다(1440×900 실측).
 * 뒤의 fitBattleEnemy 가 같은 자리에서 같은 값을 다시 낸다. 큰 시트가 아니거나 레이아웃이 없으면 undefined.
 * 결과는 저작 단위: 자리, 맞춘 상자 반폭(half), 그 상자를 왼쪽 여백에 붙인 x(leftmost).
 */
export function bigSheetSeat(field: HTMLElement, node: HTMLElement, seat: Point, plateFloor?: number): (Point & { readonly half: number; readonly leftmost: number }) | undefined {
  if (!bigCell(node)) return undefined;
  const m = measure(field, node, Number(node.style.getPropertyValue("--battle-enemy-scale")) || 1);
  if (!m) return undefined;
  const foot = bigSheetFoot(m, seat.y, plateFloor);
  const fit = Math.max(0, Math.min(1, (foot.y - foot.top) / m.box.height, (m.width - 2 * GUTTER.side) / m.box.width));
  const half = m.box.width * fit / 2;
  const x = Math.min(m.width - GUTTER.side - half, Math.max(seat.x / 320 * m.width, GUTTER.side + half));
  node.style.setProperty("--battle-enemy-fit", String(fit));
  const unit = m.width / 320;
  return { x: x / unit, y: (foot.y - m.groupTop) / m.groupHeight * 160, half: half / unit, leftmost: (GUTTER.side + half) / unit };
}
