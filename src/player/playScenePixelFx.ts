// 필드의 pixelfx 코드 효과(2026-10-31). 두 가지를 그린다.
//
// 1. 이벤트 페이지 상시 효과(EventPage.pixelFx) — 횃불·모닥불·반딧불·폭포·날씨. 반복 효과는 순수 함수(draw(t))라
//    한 주기의 프레임을 처음 보일 때 한 장씩 텍스처로 구워 두고(LoopBank), 같은 효과·같은 색이면 맵의 모든 이벤트가 나눠 쓴다.
//    한 주기가 지나면 프레임당 그리기 비용은 0 이고 스프라이트 텍스처만 바꾼다.
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
/** 한 틱에 새로 구울 반복 프레임의 시간 예산(ms). 지금 보여야 하는 프레임은 예산과 무관하게 굽는다. */
const BAKE_BUDGET_MS = 4;
const FADE_MS = 300;
const PAGE_RECHECK_MS = 300;

type Kind = "color" | "light";
type SpriteSet = Partial<Record<`${"back" | "front"}${"Color" | "Light"}`, Phaser.GameObjects.Image>>;

interface BankFrame {
  /** 층 → 텍스처 열쇠(그 층이 비었으면 없음). */
  readonly keys: Partial<Record<`${"back" | "front"}-${Kind}`, string>>;
}

/** 반복 효과 한 주기의 구운 프레임들. 같은 그림 열쇠(pixelFxRenderKey)면 공유한다. */
interface LoopBank {
  readonly id: number;
  readonly renderer: PixelFxRenderer;
  readonly layout: PixelFxLayout;
  readonly frames: (BankFrame | undefined)[];
  readonly layers: readonly ("back" | "front")[];
  readonly textureKeys: string[];
}

interface AmbientFx {
  readonly eventId: string;
  readonly spec: EventPixelFx;
  readonly key: string;
  bank?: LoopBank;
  /** 한 번 효과를 페이지 상시로 단 경우(끝나면 다시 튼다). */
  live?: LiveFx;
  readonly phase: number;
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
  banks: Map<string, LoopBank>;
  oneShots: OneShot[];
  nextCheck: number;
  clock: number;
  serial: number;
  /** 성능 계기(마지막 틱): 그린 프레임 수·걸린 ms. window.__oprnPixelFxStats 로 본다. */
  stats: { draws: number; ms: number; ambient: number; oneShots: number; visible: number; bankedFrames: number };
}

const states = new WeakMap<PlaySceneContext, SceneFxState>();
let textureSerial = 0;

function stateFor(scene: PlaySceneContext): SceneFxState {
  let state = states.get(scene);
  if (!state) {
    state = {
      mapId: "", ambientIds: [], ambient: new Map(), banks: new Map(), oneShots: [], nextCheck: 0, clock: 0, serial: 0,
      stats: { draws: 0, ms: 0, ambient: 0, oneShots: 0, visible: 0, bankedFrames: 0 },
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
  state.clock += deltaMs;
  if (state.mapId !== map.id) {
    for (const fx of state.ambient.values()) destroySprites(fx.sprites);
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
  for (const [id, fx] of state.ambient) {
    // 이벤트 스프라이트를 따라간다(움직이는 NPC 의 오라·상태 효과).
    anchorEvent(scene, fx);
    if (fx.fadeOutAt !== undefined && state.clock - fx.fadeOutAt >= FADE_MS) {
      destroySprites(fx.sprites);
      if (fx.live) destroyLive(scene, fx.live);
      state.ambient.delete(id);
      continue;
    }
    const alpha = fx.fadeOutAt !== undefined ? 1 - (state.clock - fx.fadeOutAt) / FADE_MS : 1;
    const s = scale * (fx.spec.scale ?? 1);
    if (fx.live) {
      visible += drawLive(scene, fx.live, fx.sprites, fx, s, alpha, deltaMs, view, state) ? 1 : 0;
      if (fx.live.renderer.done()) fx.live.renderer = new PixelFxRenderer(loadedPixelFxModule(fx.spec.effectId)!, fx.spec);
      continue;
    }
    const bank = fx.bank;
    if (!bank) continue;
    if (!onScreen(view, fx.x, fx.y, bank.layout, s, fx.spec)) { hideSprites(fx.sprites); continue; }
    visible += 1;
    const n = bank.frames.length;
    const k = Math.floor(((state.clock / 1000) * bank.renderer.speed + fx.phase) * bank.renderer.fps) % n;
    const frame = bankFrame(scene, bank, k, state);
    showBankFrame(scene, fx, frame, s, alpha);
    // 남는 예산으로 다음 프레임을 미리 굽는다 — 첫 주기의 그리기를 여러 틱에 나눈다.
    for (let ahead = 1; ahead < n && performance.now() - started < BAKE_BUDGET_MS; ahead++) {
      const next = (k + ahead) % n;
      if (!bank.frames[next]) { bankFrame(scene, bank, next, state); break; }
    }
  }
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
  state.stats.ambient = state.ambient.size;
  state.stats.oneShots = state.oneShots.length;
  state.stats.visible = visible;
  state.stats.bankedFrames = [...state.banks.values()].reduce((sum, b) => sum + b.frames.filter(Boolean).length, 0);
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
    if (existing) state.ambient.delete(id), destroySprites(existing.sprites);
    const fx: AmbientFx = {
      eventId: id, spec, key, phase: (state.serial++ * 0.37) % 1, sprites: {}, x: 0, y: 0, depth: 0,
    };
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
    fx.live = createLive(scene, new PixelFxRenderer(mod, fx.spec), fx.spec, layersFor(fx.spec));
    return;
  }
  const bankKey = `${pixelFxRenderKey(fx.spec)}|${fx.spec.layer ?? "auto"}`;
  let bank = state.banks.get(bankKey);
  if (!bank) {
    const renderer = new PixelFxRenderer(mod, fx.spec);
    bank = {
      id: ++textureSerial, renderer, layout: renderer.layout,
      frames: new Array(renderer.frameCount).fill(undefined), layers: layersFor(fx.spec), textureKeys: [],
    };
    state.banks.set(bankKey, bank);
  }
  fx.bank = bank;
}

/** "auto" 는 뒤·앞 두 층, back/front 는 한 층에 통째로(그 층 이름이 depth 를 정한다). */
function layersFor(spec: EventPixelFx | PixelFxSpec): readonly ("back" | "front")[] {
  const layer = (spec as EventPixelFx).layer;
  return layer === "back" ? ["back"] : layer === "front" ? ["front"] : ["back", "front"];
}

function bankFrame(scene: PlaySceneContext, bank: LoopBank, k: number, state: SceneFxState): BankFrame {
  const ready = bank.frames[k];
  if (ready) return ready;
  const { width, height } = bank.layout;
  bank.renderer.seek(k / bank.renderer.fps);
  const keys: BankFrame["keys"] = {};
  const color = new ImageData(width, height);
  const light = new ImageData(width, height);
  for (const layer of bank.layers) {
    // 한 층으로 통째로 놓는 효과(back/front)는 효과의 뒤·앞을 한 장에 함께 그린다.
    const painted = bank.renderer.paint(bank.layers.length === 1 ? "all" : layer, color, light);
    state.stats.draws += 1;
    if (painted.color) keys[`${layer}-color`] = addCanvasTexture(scene, bank, `${k}-${layer}-c`, color);
    if (painted.light) keys[`${layer}-light`] = addCanvasTexture(scene, bank, `${k}-${layer}-l`, light);
  }
  const frame = { keys };
  bank.frames[k] = frame;
  return frame;
}

function addCanvasTexture(scene: PlaySceneContext, bank: LoopBank, suffix: string, image: ImageData): string {
  const key = `__oprn_pfx_${bank.id}_${suffix}`;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(image, 0, 0);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  bank.textureKeys.push(key);
  return key;
}

function showBankFrame(scene: PlaySceneContext, fx: AmbientFx, frame: BankFrame, s: number, alpha: number): void {
  const layout = fx.bank!.layout;
  for (const layer of ["back", "front"] as const) {
    for (const kind of ["color", "light"] as const) {
      const slot = `${layer}${kind === "color" ? "Color" : "Light"}` as const;
      const key = frame.keys[`${layer}-${kind}`];
      let sprite = fx.sprites[slot];
      if (!key) { sprite?.setVisible(false); continue; }
      if (!sprite) {
        sprite = scene.add.image(0, 0, key).setOrigin(layout.anchorX / layout.width, layout.anchorY / layout.height);
        if (kind === "light") sprite.setBlendMode("ADD");
        fx.sprites[slot] = sprite;
      } else sprite.setTexture(key);
      placeSprite(sprite, fx, layer, s, alpha);
    }
  }
}

function placeSprite(
  sprite: Phaser.GameObjects.Image,
  at: { x: number; y: number; depth: number; spec: EventPixelFx | PixelFxSpec },
  layer: "back" | "front",
  s: number,
  alpha: number,
): void {
  const mode = (at.spec as EventPixelFx).layer;
  const depth = mode === "back" ? BACK_LAYER_DEPTH : mode === "front" ? FRONT_LAYER_DEPTH : at.depth + (layer === "back" ? -0.5 : 0.5);
  sprite
    .setVisible(true)
    .setPosition(at.x + (at.spec.offsetX ?? 0) * s, at.y + (at.spec.offsetY ?? 0) * s)
    .setScale(s)
    .setAlpha(alpha)
    .setDepth(depth);
}

function createLive(scene: PlaySceneContext, renderer: PixelFxRenderer, spec: PixelFxSpec, layers: readonly ("back" | "front")[]): LiveFx {
  const { width, height } = renderer.layout;
  const live: LiveFx = { renderer, spec, textures: {}, images: {}, shownFrame: -1 };
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
  const layout = live.renderer.layout;
  if (!onScreen(view, at.x, at.y, layout, s, at.spec)) { hideSprites(sprites); return false; }
  const frame = Math.floor(live.renderer.time * live.renderer.fps);
  const redraw = frame !== live.shownFrame;
  live.shownFrame = frame;
  for (const layer of ["back", "front"] as const) {
    const colorTex = live.textures[`${layer}-color`];
    if (!colorTex) continue;
    const color = live.images[`${layer}-color`]!;
    const light = live.images[`${layer}-light`] ?? null;
    let painted = { color: true, light: Boolean(light) };
    if (redraw) {
      const single = (at.spec as EventPixelFx).layer && (at.spec as EventPixelFx).layer !== "auto";
      painted = live.renderer.paint(single ? "all" : layer, color, light);
      state.stats.draws += 1;
      colorTex.context.putImageData(color, 0, 0);
      colorTex.refresh();
      const lightTex = live.textures[`${layer}-light`];
      if (lightTex && light) { lightTex.context.putImageData(light, 0, 0); lightTex.refresh(); }
    }
    for (const kind of ["color", "light"] as const) {
      const slot = `${layer}${kind === "color" ? "Color" : "Light"}` as const;
      const tex = live.textures[`${layer}-${kind}`];
      if (!tex) continue;
      let sprite = sprites[slot];
      if (!sprite) {
        sprite = scene.add.image(0, 0, tex.key).setOrigin(layout.anchorX / layout.width, layout.anchorY / layout.height);
        if (kind === "light") sprite.setBlendMode("ADD");
        sprites[slot] = sprite;
      }
      if (redraw && !(kind === "color" ? painted.color : painted.light)) { sprite.setVisible(false); continue; }
      if (!redraw && !sprite.visible) continue;
      placeSprite(sprite, at, layer, s, alpha);
    }
  }
  return true;
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
    const live = createLive(scene, renderer, spec, ["back", "front"]);
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
  for (const fx of state.ambient.values()) { destroySprites(fx.sprites); if (fx.live) destroyLive(scene, fx.live); }
  for (const shot of [...state.oneShots]) finishOneShot(scene, state, shot);
  for (const bank of state.banks.values()) for (const key of bank.textureKeys) if (scene.textures?.exists(key)) scene.textures.remove(key);
  state.ambient.clear();
  state.banks.clear();
  states.delete(scene);
}
