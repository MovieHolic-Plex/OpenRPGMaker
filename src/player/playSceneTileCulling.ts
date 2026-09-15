import { TILE_SIZE } from "@/assets/bundled";

/**
 * 화면 밖 타일 숨기기.
 *
 * 왜: Phaser 의 Container 와 root display list 에는 **절두체 컬링이 없다**
 * (`cull()` 호출자는 TilemapLayer{WebGL,Canvas}Renderer 둘뿐이고 이 프로젝트는
 * Tilemap 을 쓰지 않는다). 100×100 맵은 타일 GameObject 가 1만~2.1만개인데 320×240
 * 화면에 실제로 보이는 것은 20×15 = 300칸 남짓이다. 나머지 97% 도 매 프레임 렌더러의
 * 쿼드 배치에 들어간다.
 *
 * 왜 이 방식인가: 타일을 청크 컨테이너로 묶으면 컨테이너 단위로 끌 수 있어 더 싸지만,
 * 컨테이너 자식은 **그 컨테이너 안에서만** depth 정렬된다. 농지·설치물 오버레이와 솔리드
 * upper 가구(root y-sort)가 같은 tileLayer 안에서 타일과 depth 로 섞여 있어서 청크를
 * 끼우면 그림 순서가 깨진다. 개별 오브젝트의 visible 만 건드리면 depth 규칙은 그대로다.
 *
 * 비용: 카메라가 **타일 경계를 넘을 때만** 다시 계산한다(걸음마다 8~16프레임에 한 번).
 */

export interface CullableImage {
  visible?: boolean;
  /** Phaser GameObject 는 파괴되면 active=false 가 된다. 증분 재렌더 경로에서
   *  파괴된 객체가 추적 목록에 남아 setVisible 을 부르면 런타임 에러가 나므로 건너뛴다. */
  active?: boolean;
  setVisible?(value: boolean): unknown;
}

/**
 * 추적 목록은 **평행 배열**이다. 100×100 맵의 타일이 1만~2.1만개라 칸마다
 * `{image, x, y}` 를 만들면 맵을 그릴 때마다 그만큼의 짧은 수명 객체가 생긴다
 * (실측 renderTiles +4.0ms/호출). 좌표는 숫자 배열에 그대로 담는다.
 */
interface CullableTiles {
  readonly images: CullableImage[];
  readonly xs: number[];
  readonly ys: number[];
}

interface TileWindow {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** 화면 경계 바깥으로 두는 여유 타일 수. 큰 스프라이트·반 칸 오프셋을 감싼다. */
const CULL_MARGIN_TILES = 2;

const cullableTiles = new WeakMap<object, CullableTiles>();
const appliedWindows = new WeakMap<object, TileWindow>();

/**
 * renderTiles 가 타일을 다시 만들기 전에, 그리고 씬이 내려갈 때 호출한다.
 * 직전 짝 기억은 host 가 같든 다르든 언제나 버린다 — 그냥 캐시라 버려도 답이 같고,
 * 남겨 두면 내려간 씬과 타일 GameObject 1만~2.1만개를 모듈 스코프가 붙잡는다.
 */
export function resetCullableTiles(host: object): void {
  cullableTiles.delete(host);
  appliedWindows.delete(host);
  lastTrackedHost = null;
  lastTrackedTiles = null;
}

// 한 번의 renderTiles 는 타일 1만~2.1만개를 **같은 host** 로 추적한다. 칸마다 WeakMap 을
// 조회하지 않도록 직전 짝을 기억한다 — 맵을 그리는 동안 항상 적중한다.
//
// 이 두 변수는 WeakMap 이 아니라 강한 참조다. 그래서 씬이 내려갈 때 반드시
// resetCullableTiles 로 풀어야 한다(PlayScene 의 shutdown/destroy 훅).
let lastTrackedHost: object | null = null;
let lastTrackedTiles: CullableTiles | null = null;

export function trackCullableTile(host: object, image: CullableImage, x: number, y: number): void {
  if (typeof image.setVisible !== "function") return;
  let tiles = lastTrackedHost === host ? lastTrackedTiles : null;
  if (!tiles) {
    tiles = cullableTiles.get(host) ?? { images: [], xs: [], ys: [] };
    cullableTiles.set(host, tiles);
    lastTrackedHost = host;
    lastTrackedTiles = tiles;
  }
  tiles.images.push(image);
  tiles.xs.push(x);
  tiles.ys.push(y);
}

export interface CullViewport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * 카메라가 보는 영역 밖 타일을 숨긴다. viewport 는 월드 픽셀(카메라 worldView).
 * 창이 직전과 같으면 아무것도 하지 않는다.
 */
export function syncTileCulling(host: object, viewport: CullViewport | undefined): void {
  const tiles = cullableTiles.get(host);
  if (!tiles || tiles.images.length === 0) return;
  if (!viewport || !Number.isFinite(viewport.width) || viewport.width <= 0) return;
  if (!Number.isFinite(viewport.height) || viewport.height <= 0) return;
  const next: TileWindow = {
    minX: Math.floor(viewport.x / TILE_SIZE) - CULL_MARGIN_TILES,
    minY: Math.floor(viewport.y / TILE_SIZE) - CULL_MARGIN_TILES,
    maxX: Math.floor((viewport.x + viewport.width) / TILE_SIZE) + CULL_MARGIN_TILES,
    maxY: Math.floor((viewport.y + viewport.height) / TILE_SIZE) + CULL_MARGIN_TILES,
  };
  const applied = appliedWindows.get(host);
  if (applied && sameWindow(applied, next)) return;
  appliedWindows.set(host, next);
  const { images, xs, ys } = tiles;
  for (let index = 0; index < images.length; index += 1) {
    const x = xs[index];
    const y = ys[index];
    const visible = x >= next.minX && x <= next.maxX && y >= next.minY && y <= next.maxY;
    const image = images[index];
    if (image.active === false) continue;
    if (image.visible === visible) continue;
    image.setVisible?.(visible);
  }
}

function sameWindow(left: TileWindow, right: TileWindow): boolean {
  return (
    left.minX === right.minX &&
    left.minY === right.minY &&
    left.maxX === right.maxX &&
    left.maxY === right.maxY
  );
}
