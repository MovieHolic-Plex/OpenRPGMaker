// 필드의 pixelfx 코드 효과(2026-10-31). 두 가지를 그린다.
//
// 1. 이벤트 페이지 상시 효과(EventPage.pixelFx) — 횃불·모닥불·반딧불·폭포·날씨. 반복 효과는 순수 함수(draw(t))라
//    같은 그림 열쇠(효과·색·뒤집기·씨앗)면 맵의 모든 이벤트가 렌더러 하나와 캔버스 텍스처 한 벌을 나눠 쓴다(SharedLoop) —
//    횃불 20개도 그리기는 한 번이다. 효과 프레임이 바뀔 때만 다시 그리고(큰 효과는 15fps), 틱마다 그리기 예산을 넘으면
//    남은 공유 효과는 앞 장을 한 틱 더 보인다. 한 주기를 통째로 굽는 방식은 반딧불(12초·320×180)이 수백 MB 라 버렸다.
// 2. 한 번 효과(이벤트 명령 「애니메이션 표시」가 pixelFx 전투 애니메이션 레코드를 가리킬 때) — 시뮬레이션이라 굽지 않고
//    효과 fps 로 CanvasTexture 하나에 그린다. 동시에 MAX_ONE_SHOTS 개까지, 넘치면 가장 오래된 것을 끝낸다.
//
// 층: 효과의 뒤 층(drawBack)은 앵커 캐릭터 바로 뒤(depth −0.5), 앞 층은 바로 앞(+0.5)이라 다른 캐릭터와 y 정렬된다.
// 빛(light 버퍼)은 불투명 검정 바탕 텍스처를 ADD 로 겹친다 — 원본 composite 의 「빛을 더한다」와 같은 결과다.
// 화면 밖(카메라 시야 + 효과 상자)이면 숨기고 굽지도 그리지도 않는다.
import type Phaser from "phaser";
import { characterDepth, characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { runtimeMapWorldScale } from "@/player/runtimeViewScale";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { loadedPixelFxModule, loadPixelFxModule } from "@/pixelfx/modules";
import { PixelFxRenderer, type PixelFxLayout } from "@/pixelfx/renderer";
import { normalizeEventPixelFx, normalizePixelFxSpec, pixelFxRenderKey } from "@/project/pixelFxSpec";
import { runtimeEventViewById } from "@/project/runtimeEventState";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import type { EventPixelFx, PixelFxSpec, ShowAnimationTarget } from "@/project/types";

/** 「통째로 뒤」 층: 바닥 위, 모든 캐릭터 아래(characterDepth below = 100k). */
const BACK_LAYER_DEPTH = 99_000;
/** 「통째로 앞」 층: ★ 상층(250k)과 같은 줄 캐릭터 위, 입자(350k) 아래 — 날씨·안개. */
const FRONT_LAYER_DEPTH = 340_000;
const MAX_ONE_SHOTS = 12;
/** 한 틱에 공유 반복 효과를 다시 그릴 시간 예산(ms). 넘으면 나머지는 다음 틱(앞 장을 한 틱 더). 첫 효과는 늘 그린다. */
const LOOP_BUDGET_MS = 4;
/** 이 넓이(게임 화소)를 넘는 반복 효과는 15fps 로 다시 그린다(날씨·반딧불·폭포). */
const BIG_LOOP_AREA = 128 * 128;
const FRAME_CACHE_PER_LOOP = 24 * 1024 * 1024;
const FRAME_CACHE_TOTAL = 64 * 1024 * 1024;
const LOAD_HIGH_MS = 6;
const FADE_MS = 300;
const PAGE_RECHECK_MS = 300;

type Kind = "color" | "light";
type SpriteSet = Partial<Record<`${"back" | "front"}${"Color" | "Light"}`, Phaser.GameObjects.Image>>;

/** 같은 그림 열쇠의 반복 효과 — 렌더러·텍스처 한 벌을 그 효과를 단 모든 이벤트가 나눠 쓴다. */
interface SharedLoop {
  readonly live: LiveFx;
  readonly layers: readonly ("back" | "front")[];
  /** 다시 그리는 fps(효과 fps, 큰 효과는 15). */
  readonly fps: number;
  /** 이번 틱에 화면 안 인스턴스가 있었나(없으면 그리지 않는다). */
  wanted: boolean;
  users: number;
  /**
   * 그린 장 보관(작은 효과만): 효과 프레임 번호 → 텍스처별 화소 사본. 한 주기를 다 그리고 나면 다시 그리지 않고 사본만 올린다.
   * 한 효과 FRAME_CACHE_PER_LOOP, 장면 전체 FRAME_CACHE_TOTAL 바이트까지. 넘는 효과(반딧불·폭포·날씨)는 늘 그린다.
   */
  cache?: Map<number, CachedFrame>;
  readonly cacheBytes: number;
}

interface CachedFrame {
  readonly data: Partial<Record<`${"back" | "front"}-${Kind}`, Uint8ClampedArray>>;
  readonly painted: LiveFx["painted"];
}

interface AmbientFx {
  readonly eventId: string;
  readonly spec: EventPixelFx;
  readonly key: string;
  loop?: SharedLoop;
  /** 한 번 효과를 페이지 상시로 단 경우(끝나면 다시 튼다). */
  live?: LiveFx;
  sprites: SpriteSet;
  x: number;
  y: number;
  depth: number;
  fadeOutAt?: number;
}

interface LiveFx {
  renderer: PixelFxRenderer;
  readonly spec: PixelFxSpec;
  readonly textures: Partial<Record<`${"back" | "front"}-${Kind}`, Phaser.Textures.CanvasTexture>>;
  readonly images: Partial<Record<`${"back" | "front"}-${Kind}`, ImageData>>;
  shownFrame: number;
  /** 마지막으로 그린 장에서 층·종류별로 칠한 화소가 있었나(없으면 스프라이트를 숨긴다). */
  painted: Partial<Record<`${"back" | "front"}-${Kind}`, boolean>>;
}

interface OneShot {
  readonly live: LiveFx;
  readonly target: ShowAnimationTarget;
  readonly eventId: string | undefined;
  sprites: SpriteSet;
  readonly resolve: () => void;
  at: { x: number; y: number; depth: number };
  stopAtMs: number;
  elapsedMs: number;
}

interface SceneFxState {
  mapId: string;
  ambientIds: string[];
  ambient: Map<string, AmbientFx>;
  loops: Map<string, SharedLoop>;
  cacheBytes: number;
  /** 최근 틱 비용 이동 평균(ms). LOAD_HIGH_MS 를 넘으면 한 번 효과를 반 fps 로 그린다. */
  loadMs: number;
  oneShots: OneShot[];
  nextCheck: number;
  clock: number;
  serial: number;
  /** 성능 계기(마지막 틱): 그린 프레임 수·걸린 ms. window.__oprnPixelFxStats 로 본다. */
  stats: { draws: number; ms: number; paintMs: number; uploadMs: number; ambient: number; oneShots: number; visible: number; sharedLoops: number; deferred: number };
}

const states = new WeakMap<PlaySceneContext, SceneFxState>();
let textureSerial = 0;

function stateFor(scene: PlaySceneContext): SceneFxState {
  let state = states.get(scene);
  if (!state) {
    state = {
      mapId: "", ambientIds: [], ambient: new Map(), loops: new Map(), cacheBytes: 0, loadMs: 0, oneShots: [], nextCheck: 0, clock: 0, serial: 0,
      stats: { draws: 0, ms: 0, paintMs: 0, uploadMs: 0, ambient: 0, oneShots: 0, visible: 0, sharedLoops: 0, deferred: 0 },
    };
    states.set(scene, state);
    const created = state;
    scene.events?.once?.("shutdown", () => disposeAll(scene, created));
  }
  return state;
}

/** 매 틱(PlayScene.update). 이벤트 페이지 상시 효과를 맞추고, 반복은 구운 프레임으로·한 번 효과는 그려서 띄운다. */
export function updatePixelFx(scene: PlaySceneContext, deltaMs: number): void {
  const map = scene.map;
  if (!map || !scene.session || !scene.add) return;
  const state = stateFor(scene);
  const started = performance.now();
  state.stats.draws = 0;
  state.stats.paintMs = 0;
  state.stats.uploadMs = 0;
  state.clock += deltaMs;
  if (state.mapId !== map.id) {
    for (const fx of state.ambient.values()) releaseAmbient(scene, state, fx);
    state.ambient.clear();
    state.mapId = map.id;
    state.ambientIds = map.events.filter((event) => event.pages?.some((page) => page.pixelFx)).map((event) => event.id);
    state.nextCheck = 0;
  }
  if (state.ambientIds.length > 0 && state.clock >= state.nextCheck) {
    state.nextCheck = state.clock + PAGE_RECHECK_MS;
    syncAmbientPages(scene, state);
  }
  const view = scene.cameras?.main?.worldView;
  const scale = runtimeMapWorldScale(scene);
  let visible = 0;
  for (const loop of state.loops.values()) loop.wanted = false;
  const shown: AmbientFx[] = [];
  for (const [id, fx] of state.ambient) {
    // 이벤트 스프라이트를 따라간다(움직이는 NPC 의 오라·상태 효과). 「화면」 층은 카메라를 따라 화면을 덮는다.
    const screenScale = fx.spec.layer === "screen" ? anchorScreen(fx, view, scale) : 0;
    if (!screenScale) anchorEvent(scene, fx);
    if (fx.fadeOutAt !== undefined && state.clock - fx.fadeOutAt >= FADE_MS) {
      releaseAmbient(scene, state, fx);
      state.ambient.delete(id);
      continue;
    }
    const alpha = fx.fadeOutAt !== undefined ? 1 - (state.clock - fx.fadeOutAt) / FADE_MS : 1;
    const s = screenScale || scale * (fx.spec.scale ?? 1);
    if (fx.live) {
      visible += drawLive(scene, fx.live, fx.sprites, fx, s, alpha, deltaMs, view, state) ? 1 : 0;
      if (fx.live.renderer.done()) fx.live.renderer = new PixelFxRenderer(loadedPixelFxModule(fx.spec.effectId)!, fx.spec);
      continue;
    }
    const loop = fx.loop;
    if (!loop) continue;
    if (!onScreen(view, fx.x, fx.y, loop.live.renderer.layout, s, fx.spec)) { hideSprites(fx.sprites); continue; }
    visible += 1;
    loop.wanted = true;
    shown.push(fx);
  }
  // 공유 반복 효과: 화면에 보이는 것만, 효과 프레임이 바뀐 것만 다시 그린다. 예산을 넘으면 나머지는 다음 틱.
  let deferred = 0;
  const loopStarted = performance.now();
  let first = true;
  for (const loop of state.loops.values()) {
    if (!loop.wanted) continue;
    const renderer = loop.live.renderer;
    const frame = Math.floor((state.clock / 1000) * renderer.speed * loop.fps) % Math.max(1, Math.round(renderer.durationSec * loop.fps));
    if (frame === loop.live.shownFrame) continue;
    if (!first && performance.now() - loopStarted > LOOP_BUDGET_MS) { deferred += 1; continue; }
    first = false;
    const cached = loop.cache?.get(frame);
    if (cached) { const t0 = performance.now(); uploadCached(loop.live, cached); state.stats.uploadMs += performance.now() - t0; }
    else {
      renderer.seek(frame / loop.fps);
      paintLive(loop.live, loop.layers, loop.layers.length === 1, state);
      if (loop.cache) loop.cache.set(frame, snapshotLive(loop.live));
    }
    loop.live.shownFrame = frame;
  }
  for (const fx of shown) {
    const alpha = fx.fadeOutAt !== undefined ? 1 - (state.clock - fx.fadeOutAt) / FADE_MS : 1;
    const screenScale = fx.spec.layer === "screen" ? anchorScreen(fx, view, scale) : 0;
    showLive(scene, fx.loop!.live, fx.sprites, fx, screenScale || scale * (fx.spec.scale ?? 1), alpha);
  }
  state.stats.deferred = deferred;
  for (const shot of [...state.oneShots]) {
    shot.elapsedMs += deltaMs;
    // 대상을 따라간다. 대상이 사라지면(지워진 이벤트) 마지막 자리에 남는다.
    const anchor = resolveTarget(scene, shot.target, shot.eventId);
    if (anchor) shot.at = anchor;
    if (shot.elapsedMs >= shot.stopAtMs) shot.live.renderer.stop();
    const at = { ...shot.at, spec: shot.live.spec };
    visible += drawLive(scene, shot.live, shot.sprites, at, scale * (shot.live.spec.scale ?? 1), 1, deltaMs, view, state) ? 1 : 0;
    if (shot.live.renderer.done()) finishOneShot(scene, state, shot);
  }
  state.stats.ms = performance.now() - started;
  state.loadMs = state.loadMs * 0.9 + state.stats.ms * 0.1;
  state.stats.ambient = state.ambient.size;
  state.stats.oneShots = state.oneShots.length;
  state.stats.visible = visible;
  state.stats.sharedLoops = state.loops.size;
  if (typeof window !== "undefined") (window as unknown as { __oprnPixelFxStats?: unknown }).__oprnPixelFxStats = state.stats;
}

function syncAmbientPages(scene: PlaySceneContext, state: SceneFxState): void {
  const project = store.getCurrent();
  const map = scene.map;
  for (const id of state.ambientIds) {
    const view = runtimeEventViewById(project, map, scene.session, scene.eventPositions, id);
    const spec = normalizeEventPixelFx(view?.page?.pixelFx);
    const existing = state.ambient.get(id);
    const key = spec ? `${pixelFxRenderKey(spec)}|${spec.layer ?? "auto"}|${spec.scale ?? 1}|${spec.offsetX ?? 0},${spec.offsetY ?? 0}|${spec.speed ?? 1}` : "";
    if (existing && existing.key === key && existing.fadeOutAt === undefined) continue;
    if (existing && existing.fadeOutAt === undefined) existing.fadeOutAt = state.clock;
    if (!spec || !view) continue;
    if (existing) { state.ambient.delete(id); releaseAmbient(scene, state, existing); }
    const fx: AmbientFx = { eventId: id, spec, key, sprites: {}, x: 0, y: 0, depth: 0 };
    state.ambient.set(id, fx);
    const mod = loadedPixelFxModule(spec.effectId);
    if (mod) attachAmbient(scene, state, fx);
    else void loadPixelFxModule(spec.effectId).then((loaded) => { if (loaded && state.ambient.get(id) === fx) attachAmbient(scene, state, fx); });
  }
}

function attachAmbient(scene: PlaySceneContext, state: SceneFxState, fx: AmbientFx): void {
  const mod = loadedPixelFxModule(fx.spec.effectId);
  if (!mod) return;
  if (!mod.meta.loop) {
    const renderer = new PixelFxRenderer(mod, fx.spec);
    fx.live = createLive(scene, renderer, fx.spec, layersFor(fx.spec, renderer));
    return;
  }
  const loopKey = `${pixelFxRenderKey(fx.spec)}|${fx.spec.layer ?? "auto"}|${fx.spec.speed ?? 1}`;
  let loop = state.loops.get(loopKey);
  if (!loop) {
    const renderer = new PixelFxRenderer(mod, fx.spec);
    const layers = layersFor(fx.spec, renderer);
    const big = renderer.layout.width * renderer.layout.height > BIG_LOOP_AREA;
    const fps = big ? Math.min(15, renderer.fps) : renderer.fps;
    const live = createLive(scene, renderer, fx.spec, layers);
    // 한 주기 사본 크기 = 장 수 × 텍스처 수 × 넓이 × 4. 한도 안이면 예약하고 보관한다.
    const bytes = Math.round(renderer.durationSec * fps) * Object.keys(live.images).length * renderer.layout.width * renderer.layout.height * 4;
    const cacheable = bytes <= FRAME_CACHE_PER_LOOP && state.cacheBytes + bytes <= FRAME_CACHE_TOTAL;
    if (cacheable) state.cacheBytes += bytes;
    loop = { live, layers, fps, wanted: false, users: 0, cacheBytes: cacheable ? bytes : 0, ...(cacheable ? { cache: new Map() } : {}) };
    state.loops.set(loopKey, loop);
  }
  loop.users += 1;
  fx.loop = loop;
}

/** 상시 효과 하나를 뗀다. 공유 반복 효과를 쓰는 이벤트가 없어지면 그 텍스처도 지운다. */
function releaseAmbient(scene: PlaySceneContext, state: SceneFxState, fx: AmbientFx): void {
  destroySprites(fx.sprites);
  fx.sprites = {};
  if (fx.live) destroyLive(scene, fx.live);
  const loop = fx.loop;
  if (!loop) return;
  fx.loop = undefined;
  loop.users -= 1;
  if (loop.users > 0) return;
  destroyLive(scene, loop.live);
  state.cacheBytes -= loop.cacheBytes;
  for (const [key, value] of state.loops) if (value === loop) state.loops.delete(key);
}

/** "auto" 는 뒤·앞 두 층, back/front 는 한 층에 통째로(그 층 이름이 depth 를 정한다). */
function layersFor(spec: EventPixelFx | PixelFxSpec, renderer: PixelFxRenderer): readonly ("back" | "front")[] {
  const layer = (spec as EventPixelFx).layer;
  if (layer === "back") return ["back"];
  if (layer === "front" || layer === "screen") return ["front"];
  // 뒤 층이 없는 효과는 앞 층 한 장이면 된다 — 그리기·텍스처 올리기가 반이다.
  return renderer.hasBackLayer ? ["back", "front"] : ["front"];
}

function placeSprite(
  sprite: Phaser.GameObjects.Image,
  at: { x: number; y: number; depth: number; spec: EventPixelFx | PixelFxSpec },
  layer: "back" | "front",
  s: number,
  alpha: number,
): void {
  const mode = (at.spec as EventPixelFx).layer;
  const depth = mode === "back" ? BACK_LAYER_DEPTH : mode === "front" || mode === "screen" ? FRONT_LAYER_DEPTH : at.depth + (layer === "back" ? -0.5 : 0.5);
  sprite
    .setVisible(true)
    .setPosition(at.x + (at.spec.offsetX ?? 0) * s, at.y + (at.spec.offsetY ?? 0) * s)
    .setScale(s)
    .setAlpha(alpha)
    .setDepth(depth);
}

function createLive(scene: PlaySceneContext, renderer: PixelFxRenderer, spec: PixelFxSpec, layers: readonly ("back" | "front")[]): LiveFx {
  const { width, height } = renderer.layout;
  const live: LiveFx = { renderer, spec, textures: {}, images: {}, shownFrame: -1, painted: {} };
  for (const layer of layers) {
    for (const kind of ["color", "light"] as const) {
      const key = `__oprn_pfx_live_${++textureSerial}`;
      const texture = scene.textures.createCanvas(key, width, height);
      if (!texture) continue;
      live.textures[`${layer}-${kind}`] = texture;
      live.images[`${layer}-${kind}`] = new ImageData(width, height);
    }
  }
  return live;
}

function drawLive(
  scene: PlaySceneContext,
  live: LiveFx,
  sprites: SpriteSet,
  at: { x: number; y: number; depth: number; spec: EventPixelFx | PixelFxSpec },
  s: number,
  alpha: number,
  deltaMs: number,
  view: Phaser.Geom.Rectangle | undefined,
  state: SceneFxState,
): boolean {
  live.renderer.advance(deltaMs / 1000);
  if (!onScreen(view, at.x, at.y, live.renderer.layout, s, at.spec)) { hideSprites(sprites); return false; }
  // 효과 fps(대개 30)로만 다시 그린다 — 60Hz 화면에서 그리기·텍스처 올리기가 반이다. 틱 비용이 높으면 반 fps.
  const fps = state.loadMs > LOAD_HIGH_MS ? live.renderer.fps / 2 : live.renderer.fps;
  const frame = Math.floor(live.renderer.time * fps);
  if (frame !== live.shownFrame) {
    live.shownFrame = frame;
    const layers = (["back", "front"] as const).filter((layer) => live.textures[`${layer}-color`]);
    const single = Boolean((at.spec as EventPixelFx).layer && (at.spec as EventPixelFx).layer !== "auto");
    paintLive(live, layers, single || layers.length === 1, state);
  }
  showLive(scene, live, sprites, at, s, alpha);
  return true;
}

/** 지금 장면을 라이브 텍스처에 그린다. whole = 층 하나에 효과 전체(뒤·앞 합쳐). 빈 층은 텍스처를 올리지 않는다. */
function paintLive(live: LiveFx, layers: readonly ("back" | "front")[], whole: boolean, state: SceneFxState): void {
  for (const layer of layers) {
    const colorTex = live.textures[`${layer}-color`];
    if (!colorTex) continue;
    const color = live.images[`${layer}-color`]!;
    const light = live.images[`${layer}-light`] ?? null;
    const t0 = performance.now();
    const painted = live.renderer.paint(whole ? "all" : layer, color, light);
    const t1 = performance.now();
    state.stats.draws += 1;
    state.stats.paintMs += t1 - t0;
    if (painted.color || live.painted[`${layer}-color`]) { colorTex.context.putImageData(color, 0, 0); colorTex.refresh(); }
    const lightTex = live.textures[`${layer}-light`];
    if (lightTex && light && (painted.light || live.painted[`${layer}-light`])) { lightTex.context.putImageData(light, 0, 0); lightTex.refresh(); }
    state.stats.uploadMs += performance.now() - t1;
    live.painted[`${layer}-color`] = painted.color;
    live.painted[`${layer}-light`] = painted.light;
  }
}

function snapshotLive(live: LiveFx): CachedFrame {
  const data: CachedFrame["data"] = {};
  for (const [key, image] of Object.entries(live.images) as [keyof CachedFrame["data"], ImageData][]) {
    if (live.painted[key]) data[key] = image.data.slice();
  }
  return { data, painted: { ...live.painted } };
}

/** 보관한 장을 텍스처에 올린다(그리기 없이). 앞 장에 칠한 것이 있었는데 이번 장이 비었으면 비운 화소를 올린다. */
function uploadCached(live: LiveFx, cached: CachedFrame): void {
  for (const [key, tex] of Object.entries(live.textures) as [keyof CachedFrame["data"], Phaser.Textures.CanvasTexture][]) {
    const was = live.painted[key];
    const now = cached.painted[key];
    if (!was && !now) continue;
    const image = live.images[key]!;
    const data = cached.data[key];
    if (data) image.data.set(data);
    else image.data.fill(0);
    tex.context.putImageData(image, 0, 0);
    tex.refresh();
  }
  Object.assign(live.painted, cached.painted);
}

/** 라이브(또는 공유) 텍스처를 인스턴스 스프라이트로 보인다. 칠한 화소가 없는 층·종류는 숨긴다. */
function showLive(
  scene: PlaySceneContext,
  live: LiveFx,
  sprites: SpriteSet,
  at: { x: number; y: number; depth: number; spec: EventPixelFx | PixelFxSpec },
  s: number,
  alpha: number,
): void {
  const layout = live.renderer.layout;
  for (const layer of ["back", "front"] as const) {
    for (const kind of ["color", "light"] as const) {
      const slot = `${layer}${kind === "color" ? "Color" : "Light"}` as const;
      const tex = live.textures[`${layer}-${kind}`];
      let sprite = sprites[slot];
      if (!tex || !live.painted[`${layer}-${kind}`]) { sprite?.setVisible(false); continue; }
      if (!sprite) {
        sprite = scene.add.image(0, 0, tex.key).setOrigin(layout.anchorX / layout.width, layout.anchorY / layout.height);
        if (kind === "light") sprite.setBlendMode("ADD");
        sprites[slot] = sprite;
      }
      placeSprite(sprite, at, layer, s, alpha);
    }
  }
}

function destroyLive(scene: PlaySceneContext, live: LiveFx): void {
  for (const tex of Object.values(live.textures)) if (tex && scene.textures.exists(tex.key)) scene.textures.remove(tex.key);
}

function onScreen(view: Phaser.Geom.Rectangle | undefined, x: number, y: number, layout: PixelFxLayout, s: number, spec: PixelFxSpec): boolean {
  if (!view) return true;
  const left = x + ((spec.offsetX ?? 0) - layout.anchorX) * s;
  const top = y + ((spec.offsetY ?? 0) - layout.anchorY) * s;
  return left < view.right && left + layout.width * s > view.x && top < view.bottom && top + layout.height * s > view.y;
}

function hideSprites(sprites: SpriteSet): void {
  for (const sprite of Object.values(sprites)) sprite?.setVisible(false);
}

function destroySprites(sprites: SpriteSet): void {
  for (const sprite of Object.values(sprites)) sprite?.destroy();
}

/**
 * 「화면」 층(날씨·반딧불·오로라 같은 장면 효과): 카메라 시야 가운데 아래에 원점을 두고, 시야를 덮는 가장 작은 정수배로 키운다.
 * 돌려주는 값은 월드 배율(0 = 시야를 모름 → 이벤트 자리에 둔다). 효과 자체의 offset 은 그 배율로 민다.
 */
function anchorScreen(fx: AmbientFx, view: Phaser.Geom.Rectangle | undefined, worldScale: number): number {
  const layout = fx.loop?.live.renderer.layout ?? fx.live?.renderer.layout;
  if (!view || !layout) return 0;
  const s = Math.max(1, Math.ceil(Math.max(view.width / (layout.width * worldScale), view.height / (layout.height * worldScale)))) * worldScale;
  fx.x = view.centerX - (layout.width / 2 - layout.anchorX) * s;
  fx.y = view.bottom - (layout.height - layout.anchorY) * s;
  fx.depth = FRONT_LAYER_DEPTH;
  return s;
}

function anchorEvent(scene: PlaySceneContext, fx: AmbientFx): void {
  const anchor = resolveTarget(scene, { eventId: fx.eventId }, fx.eventId);
  if (!anchor) return;
  fx.x = anchor.x;
  fx.y = anchor.y;
  fx.depth = anchor.depth;
}

/** 앵커: 캐릭터는 발(스프라이트 원점), 칸은 칸 바닥 가운데. depth 는 그 캐릭터(또는 같은 줄 캐릭터)의 y 정렬 값. */
function resolveTarget(
  scene: PlaySceneContext,
  target: ShowAnimationTarget,
  currentEventId: string | undefined,
): { x: number; y: number; depth: number } | undefined {
  const size = mapTileSize(scene.map);
  if (target === "player") {
    const p = scene.player;
    return p ? { x: p.x, y: p.y, depth: p.depth } : undefined;
  }
  if ("eventId" in target) {
    const eventId = target.eventId || currentEventId;
    if (!eventId) return undefined;
    const sprite = scene.eventSprites.get(eventId);
    if (sprite?.active) return { x: sprite.x, y: sprite.y, depth: sprite.depth };
    const view = runtimeEventViewById(store.getCurrent(), scene.map, scene.session, scene.eventPositions, eventId);
    if (!view) return undefined;
    const y = characterSpriteY(view.y, size);
    return { x: footprintSpriteX(view.x, view.footprint, size), y, depth: characterDepth(view.priority, y) };
  }
  const y = characterSpriteY(target.y, size);
  return { x: characterSpriteX(target.x, size), y, depth: characterDepth("same", y) };
}

/**
 * 한 번 효과를 튼다(「애니메이션 표시」 → pixelFx 레코드). 끝나면 풀리는 Promise — 명령의 「끝날 때까지 기다림」이 이것을 기다린다.
 * 반복 효과를 한 번으로 틀면 한 주기 뒤 서서히 끈다.
 */
export function playFieldPixelFx(
  scene: PlaySceneContext,
  rawSpec: PixelFxSpec,
  target: ShowAnimationTarget,
  currentEventId: string | undefined,
): Promise<void> {
  const spec = normalizePixelFxSpec(rawSpec);
  if (!spec || !scene.add) return Promise.resolve();
  return loadPixelFxModule(spec.effectId).then((mod) => new Promise<void>((resolve) => {
    if (!mod || !scene.sys?.isActive?.()) { resolve(); return; }
    const state = stateFor(scene);
    while (state.oneShots.length >= MAX_ONE_SHOTS) finishOneShot(scene, state, state.oneShots[0]!);
    const renderer = new PixelFxRenderer(mod, spec);
    const live = createLive(scene, renderer, spec, layersFor(spec, renderer));
    const stopAtMs = renderer.loop ? (renderer.durationSec * 1000) / renderer.speed : Infinity;
    const at = resolveTarget(scene, target, currentEventId) ?? { x: 0, y: 0, depth: FRONT_LAYER_DEPTH };
    state.oneShots.push({ live, target, eventId: currentEventId, sprites: {}, resolve, at, stopAtMs, elapsedMs: 0 });
  }));
}

function finishOneShot(scene: PlaySceneContext, state: SceneFxState, shot: OneShot): void {
  const index = state.oneShots.indexOf(shot);
  if (index >= 0) state.oneShots.splice(index, 1);
  destroySprites(shot.sprites);
  destroyLive(scene, shot.live);
  shot.resolve();
}

function disposeAll(scene: PlaySceneContext, state: SceneFxState): void {
  for (const fx of state.ambient.values()) releaseAmbient(scene, state, fx);
  for (const shot of [...state.oneShots]) finishOneShot(scene, state, shot);
  for (const loop of state.loops.values()) destroyLive(scene, loop.live);
  state.ambient.clear();
  state.loops.clear();
  state.cacheBytes = 0;
  states.delete(scene);
}
