import type Phaser from "phaser";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { MAP_BACKGROUND_LAYER_DEPTH } from "@/player/characterDepth";
import { ensureSceneImageTexture } from "@/player/playSceneImageTexture";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { decodeMapBackgroundFlow } from "@/project/mapBackground";
import type { MapBackgroundFit, MapBackgroundLayer } from "@/project/types";
import { store } from "@/project/store";

/**
 * 맵 배경(패럴랙스) 레이어 — RM2K3 「배경」 탭의 `map.background`.
 *
 * 계약:
 * 1. **하층 타일 아래**다({@link MAP_BACKGROUND_LAYER_DEPTH}). 비어 있는 칸이 뚫린 창이고,
 *    타일이 깔린 칸은 배경을 가린다 — 「절벽 뒤로 먼 풍경이 보인다」가 이 순서에서 나온다.
 * 2. 스프라이트는 **화면 고정**(`scrollFactor 0`)이고, 카메라 반응은 층마다 `cameraFollow`
 *    (깊이)로 따로 준다 — 0(기본) 이면 RM2K3 처럼 제자리, 1 이면 타일과 같이 움직인다. 층마다
 *    값이 다르면 시차(패럴랙스) 스크롤이다. 카메라 추적은 Phaser 가 `preRender` 에서 스크롤을
 *    확정하므로 `followupdate` 에서 한 번 더 맞춘다 — `update` 값만 쓰면 한 프레임 늦어 떨린다.
 * 3. 스크롤 속도 단위는 **논리 프레임당 px** 다 — 60Hz 기준이라 `scrollX 2` 는 초당 120px.
 *    RM 계열은 서브픽셀 단위(1/8px/프레임)라 그 숫자를 그대로 옮기면 8배 빠르다
 *    (`@/project/mapBackground` 주석).
 * 4. 반복(`loopX`/`loopY`)이 켜진 축은 그림이 무한히 타일된다. 끄면 그 축으로는 **한 장만**
 *    그려지고(그림이 화면보다 작으면 남는 자리는 카메라 배경이 비친다) 스크롤은 UV 가 아니라
 *    위치를 옮긴다 — 그림이 화면을 떠나면 빈 자리가 남는다. 그게 「반복하지 않는다」의 뜻이다.
 *
 * 목록 순서가 곧 그리는 순서다(앞이 아래). 지금은 한 장이지만 스택으로 다룬다 — 다층 저작이
 * 붙어도 렌더 경로는 그대로다.
 */

/** RM2K3 스크롤 속도는 프레임당 px — 논리 프레임은 60Hz 다(`playSceneMovement`). */
export const BACKGROUND_FRAMES_PER_SECOND = 60;
const TEXTURE_PREFIX = "__oprn_map_background_";
const SIGNATURE_SEPARATOR = "\u0000";

/** 한 장의 배경을 그리는 데 필요한 값. 저작(`MapBackground`)에서 파생된다. */
export type MapBackgroundLayerSpec = {
  readonly imageId: string;
  /** px/프레임. */
  readonly scrollX: number;
  readonly scrollY: number;
  readonly loopX: boolean;
  readonly loopY: boolean;
  /** 0..1. 지금은 항상 1(다층 저작이 붙으면 여기로 들어온다). */
  readonly opacity: number;
  /** 스크롤 속도 배율. 지금은 항상 1(흐름 배율은 이벤트 명령이 장면 단위로 건다). */
  readonly parallax: number;
  /** 카메라 따라가기 비율(깊이). 0 = 화면 고정, 1 = 타일과 같이. */
  readonly cameraFollow: number;
  /** 그림 맞추기. native = 1:1, cover = 뷰포트를 덮도록 확대. */
  readonly fit: MapBackgroundFit;
};

export type MapBackgroundLayout = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * `scrollFactor 0` 객체가 어떤 줌에서도 뷰포트를 **정확히** 덮는 배치.
 *
 * 유도: Phaser 는 화면 고정 객체를 `screen(p) = (p - halfSize)·zoom + halfSize` 로 그린다
 * (반폭 `halfSize`, 원점이 객체 좌상단). 좌상단이 화면 0 이려면 `x = halfSize·(1 - 1/zoom)`,
 * 뷰포트를 다 덮으려면 크기가 `뷰포트 / zoom` 이어야 한다. 이 보정이 없으면 배경은 배율이
 * 1 이 아닐 때 화면 한가운데만 덮고 가장자리에 맵 배경색이 드러난다.
 *
 * 반복하지 않는 축은 그림 한 장 폭까지만 그린다(`source` 필요) — 그 밖은 배경이 비친다.
 */
export function mapBackgroundLayout(
  camera: { readonly width: number; readonly height: number; readonly zoom: number },
  source?: { readonly width: number; readonly height: number },
  loop: { readonly x: boolean; readonly y: boolean } = { x: true, y: true },
): MapBackgroundLayout {
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
  const width = camera.width || PLAY_RESOLUTION.width;
  const height = camera.height || PLAY_RESOLUTION.height;
  const viewWidth = Math.ceil(width / zoom);
  const viewHeight = Math.ceil(height / zoom);
  return {
    x: (width / 2) * (1 - 1 / zoom),
    y: (height / 2) * (1 - 1 / zoom),
    width: loop.x || !source ? viewWidth : Math.min(viewWidth, Math.max(1, Math.floor(source.width))),
    height: loop.y || !source ? viewHeight : Math.min(viewHeight, Math.max(1, Math.floor(source.height))),
  };
}

/** 이번 프레임의 스크롤 진행. `speed` 는 프레임당 px 이므로 초당 `speed × 60` px 다. */
export function advanceMapBackgroundScroll(position: number, speed: number, deltaMs: number): number {
  if (!Number.isFinite(speed) || speed === 0 || !Number.isFinite(position)) return position;
  return position + speed * (Math.max(0, deltaMs) / 1000) * BACKGROUND_FRAMES_PER_SECOND;
}

/**
 * 그림을 뷰포트에 맞추는 배율. native 는 1, cover 는 뷰포트를 다 덮는 최소 확대/축소다.
 *
 * 왜 필요한가(2026-09-21 실측): CraftPix 레이어 아트는 1920x1080 인데 게임 논리 뷰포트는
 * 320x240 이다. 1:1 로 그리면 아트 좌상단 320x240, 즉 세로 22% 만 보이고 지면(y=646~1079)과
 * 나무(y=953~1079)는 **영원히 화면 밖**이다. 16:9 아트를 4:3 뷰포트에 cover 하면 배율이
 * 240/1080 = 0.2222 라 세로가 정확히 맞고 가로만 넘쳐(426>320) 반복으로 이어진다.
 */
export function mapBackgroundFitScale(
  fit: MapBackgroundFit,
  viewport: { readonly width: number; readonly height: number },
  source: { readonly width: number; readonly height: number },
): number {
  if (fit !== "cover") return 1;
  const sourceWidth = Math.max(1, Number(source.width) || 0);
  const sourceHeight = Math.max(1, Number(source.height) || 0);
  const viewWidth = Math.max(1, Number(viewport.width) || 0);
  const viewHeight = Math.max(1, Number(viewport.height) || 0);
  return Math.max(viewWidth / sourceWidth, viewHeight / sourceHeight);
}

/** 논리 px(저작 단위) → Phaser tilePosition 단위. 타일이 scale 배로 그려지므로 나눈다. */
export function mapBackgroundTilePosition(logicalPx: number, scale: number): number {
  return scale > 0 && Number.isFinite(scale) ? logicalPx / scale : logicalPx;
}

export function mapBackgroundTextureKey(imageId: string): string {
  return `${TEXTURE_PREFIX}${imageId.replace(/[^a-z0-9_-]/gi, "_")}`;
}

/**
 * 지금 이 맵에 그릴 배경 목록(아래→위). 이벤트 명령 「먼 배경 변경」(m2-069)이 그 맵에 대해
 * 기록돼 있으면 **첫 장의 그림을 대체한다** — 명령은 세션이 아니라 그 맵의 배경을 바꾼다.
 *
 * `mapId` 가 빈 기록(이 명령이 맵을 적기 전에 저장된 세이브)은 모든 맵에 적용한다. 값을 못 읽어
 * 배경이 통째로 사라지는 것보다 낫다.
 */
export function resolveMapBackgroundLayers(
  scene: Pick<PlaySceneContext, "map" | "session">,
): MapBackgroundLayerSpec[] {
  const background = scene.map?.background;
  const override = scene.session?.m2Runtime?.map?.["parallax_override"];
  const overrideId = (override?.value ?? "").trim();
  const overrideMapId = (override?.mapId ?? "").trim();
  const overridden = overrideId !== "" && (overrideMapId === "" || overrideMapId === scene.map?.id);
  const imageId = overridden ? overrideId : (background?.imageId ?? "").trim();
  if (!imageId) return [];
  const base: MapBackgroundLayerSpec = {
    imageId,
    scrollX: background?.scrollX ?? 0,
    scrollY: background?.scrollY ?? 0,
    // 저작이 없으면 반복한다 — 반복이 기본값이고 저장은 «끈 것» 만 적는다.
    loopX: background?.loopX !== false,
    loopY: background?.loopY !== false,
    opacity: 1,
    parallax: 1,
    cameraFollow: background?.cameraFollow ?? 0,
    fit: background?.fit ?? "native",
  };
  // 추가 레이어(앞이 아래). 명령의 「먼 배경 변경」이 첫 장을 대체할 뿐 추가 레이어는 그대로 유지한다 —
  // 구름과 산을 명령이 지우면 같은 자리가 빈 것이 되어 일부가 어색하게 보이게 된다.
  const extra = (background?.layers ?? []).map((layer) => layerSpecFromAuthoring(layer));
  return [base, ...extra];
}

function layerSpecFromAuthoring(layer: MapBackgroundLayer): MapBackgroundLayerSpec {
  return {
    imageId: layer.imageId,
    scrollX: layer.scrollX ?? 0,
    scrollY: layer.scrollY ?? 0,
    loopX: layer.loopX !== false,
    loopY: layer.loopY !== false,
    opacity: 1,
    parallax: 1,
    cameraFollow: layer.cameraFollow ?? 0,
    fit: layer.fit ?? "native",
  };
}

/** 적용·로드 중 판정에 쓰는 서명 — 그림 id 목록이면 충분하다. */
export function mapBackgroundSignature(specs: readonly MapBackgroundLayerSpec[]): string {
  return specs.map((spec) => spec.imageId).join(SIGNATURE_SEPARATOR);
}

/**
 * 현재 맵의 배경을 스프라이트 스택에 반영한다. 맵을 실을 때(`loadMap`)마다 부르고, 그림이 아직
 * 안 실렸으면 로드를 걸어 두었다가 완료되면 그때 붙인다. 배경 저작이 없으면 감춘다.
 */
export function syncMapBackgroundLayers(scene: PlaySceneContext): void {
  // 맵에 막 들어왔다 — 깊이의 기준점을 새로 잡는다(첫 배치에서 그때 카메라 위치로).
  scene.mapBackgroundCameraAnchor = undefined;
  syncMapBackgroundStack(scene);
}

function syncMapBackgroundStack(scene: PlaySceneContext): void {
  const specs = resolveMapBackgroundLayers(scene);
  const signature = mapBackgroundSignature(specs);
  if (specs.length === 0) {
    hideMapBackgroundSprites(scene);
    scene.mapBackgroundAppliedSignature = "";
    scene.mapBackgroundPendingSignature = undefined;
    return;
  }
  if (scene.mapBackgroundAppliedSignature === signature && (scene.mapBackgroundSprites?.length ?? 0) === specs.length) {
    layoutMapBackgroundStack(scene, specs);
    return;
  }
  const missing = specs.filter((spec) => !scene.textures.exists(mapBackgroundTextureKey(spec.imageId)));
  if (missing.length === 0) {
    applyMapBackgroundSpecs(scene, specs, signature);
    return;
  }
  // 같은 목록의 로드가 이미 떠 있으면 다시 걸지 않는다(같은 키를 두 번 큐에 넣으면 로더가 거부한다).
  if (scene.mapBackgroundPendingSignature === signature) return;
  const requestedMap = scene.map;
  const token = (scene.mapBackgroundToken ?? 0) + 1;
  scene.mapBackgroundToken = token;
  scene.mapBackgroundPendingSignature = signature;
  const loadable: Array<{ spec: MapBackgroundLayerSpec; url: string }> = [];
  for (const spec of missing) {
    const url = resolveAssetResourceUrl(spec.imageId, { project: store.getCurrent() });
    if (url) loadable.push({ spec, url });
    // 저작 경고다 — 로드 게이트가 저작 참조는 보지만 세션 오버라이드는 보지 않는다.
    else console.warn(`[player] map background not found: ${spec.imageId}`);
  }
  if (loadable.length === 0) {
    // 실패도 «정착» 이다 — 정착으로 적지 않으면 매 프레임 다시 시도한다.
    hideMapBackgroundSprites(scene);
    scene.mapBackgroundAppliedSignature = signature;
    scene.mapBackgroundPendingSignature = undefined;
    return;
  }
  void Promise.all(
    loadable.map((entry) => ensureSceneImageTexture(scene, mapBackgroundTextureKey(entry.spec.imageId), entry.url)),
  ).then(() => {
    // 그사이 맵이 바뀌었거나 배경이 교체됐으면 이 결과는 버린다.
    if (scene.mapBackgroundToken !== token || scene.map !== requestedMap) return;
    scene.mapBackgroundPendingSignature = undefined;
    const ready = specs.filter((spec) => scene.textures.exists(mapBackgroundTextureKey(spec.imageId)));
    if (ready.length === 0) {
      hideMapBackgroundSprites(scene);
      scene.mapBackgroundAppliedSignature = signature;
      return;
    }
    applyMapBackgroundSpecs(scene, ready, signature);
  });
}

/** 매 프레임: 배경 해석이 바뀌었으면 다시 걸고, 화면 고정 배치를 맞추고, 속도만큼 민다. */
export function updateMapBackground(scene: PlaySceneContext, deltaMs: number): void {
  // 이벤트 명령 「먼 배경 변경」 은 맵을 다시 싣지 않고 배경을 바꾼다 — 해석 결과가 달라지면
  // 그 자리에서 다시 건다. 진행 중·실패로 정착한 서명은 여기서 걸리지 않으므로 매 프레임 재시도가 없다.
  const specs = resolveMapBackgroundLayers(scene);
  const signature = mapBackgroundSignature(specs);
  if (signature !== scene.mapBackgroundAppliedSignature && signature !== scene.mapBackgroundPendingSignature) {
    // 명령으로 그림만 바뀐 것이다 — 기준점은 유지해야 층이 제자리에서 튀지 않는다.
    syncMapBackgroundStack(scene);
  }
  const sprites = scene.mapBackgroundSprites;
  if (!sprites) return;
  const flow = advanceMapBackgroundFlow(scene, deltaMs);
  const count = Math.min(sprites.length, specs.length);
  for (let index = 0; index < count; index += 1) {
    const sprite = sprites[index]!;
    const spec = specs[index]!;
    if (!sprite.visible) continue;
    // 자동 흐름은 따로 누적한다 — tilePosition 에는 카메라 몫이 섞여 있어 거기서 이어 가면
    // 카메라 이동이 매 프레임 다시 더해진다.
    const offset = autoOffsetOf(sprite);
    offset.x = advanceMapBackgroundScroll(offset.x, spec.scrollX * spec.parallax * flow, deltaMs);
    offset.y = advanceMapBackgroundScroll(offset.y, spec.scrollY * spec.parallax * flow, deltaMs);
    placeMapBackgroundLayer(scene, sprite, spec);
  }
}

/**
 * 층 하나의 최종 위치 = 자동 흐름 + 카메라 스크롤 × 깊이. 단위는 **논리 px** 다 — 타일이 scale
 * 배로 그려지면 같은 화면 이동에 필요한 tilePosition 은 1/scale 이므로 환산해 쓴다.
 *
 * 카메라 몫이 왜 월드 px 그대로인가: 화면 고정 객체도 카메라 줌만큼 확대돼 그려진다. 월드 1px 은
 * 화면에서 zoom px 이고 배경 1px 도 화면에서 zoom px 이라, 깊이 1 이면 타일과 정확히 같이 간다.
 *
 * 카메라 몫은 **맵에 들어온 순간의 카메라 위치 기준**이다. 절대 스크롤을 쓰면 들어오는 자리에
 * 따라 그림이 달라진다 — 실측(2026-09-27): 30행 맵 바닥에서 시작하면 scrollY 240 × 깊이만큼 모든
 * 층이 위로 밀려 산과 호수가 화면 위로 달아나고 하늘 아랫단만 남았다. 기준점을 두면 도착 화면은
 * 저작한 그림 그대로이고, 거기서 움직인 만큼만 층마다 다르게 밀린다.
 */
function placeMapBackgroundLayer(
  scene: PlaySceneContext,
  sprite: Phaser.GameObjects.TileSprite,
  spec: MapBackgroundLayerSpec,
): void {
  const layout = layoutMapBackground(scene, sprite, spec);
  const offset = autoOffsetOf(sprite);
  const camera = scene.cameras.main;
  if (!scene.mapBackgroundCameraAnchor && Number.isFinite(camera.scrollX) && Number.isFinite(camera.scrollY)) {
    scene.mapBackgroundCameraAnchor = { x: camera.scrollX, y: camera.scrollY };
  }
  const anchor = scene.mapBackgroundCameraAnchor;
  const logicalX = mapBackgroundLayerOffset(offset.x, camera.scrollX - (anchor?.x ?? Number.NaN), spec.cameraFollow);
  const logicalY = mapBackgroundLayerOffset(offset.y, camera.scrollY - (anchor?.y ?? Number.NaN), spec.cameraFollow);
  sprite.tilePositionX = mapBackgroundTilePosition(logicalX, sprite.tileScaleX || 1);
  sprite.tilePositionY = mapBackgroundTilePosition(logicalY, sprite.tileScaleY || 1);
  applyAxisScroll(sprite, layout, spec);
}

/** 자동 흐름 누적 + 카메라 스크롤 × 깊이. 깊이 0 이면 카메라를 전혀 보지 않는다(RM2K3 동작). */
export function mapBackgroundLayerOffset(autoOffset: number, cameraScroll: number, cameraFollow: number): number {
  if (!Number.isFinite(cameraFollow) || cameraFollow === 0 || !Number.isFinite(cameraScroll)) return autoOffset;
  return autoOffset + cameraScroll * cameraFollow;
}

/** 스프라이트별 자동 흐름 누적(논리 px). 스프라이트는 맵을 오가며 재사용되므로 스프라이트에 묶는다. */
const autoOffsets = new WeakMap<Phaser.GameObjects.TileSprite, { x: number; y: number }>();

function autoOffsetOf(sprite: Phaser.GameObjects.TileSprite): { x: number; y: number } {
  let offset = autoOffsets.get(sprite);
  if (!offset) {
    offset = { x: 0, y: 0 };
    autoOffsets.set(sprite, offset);
  }
  return offset;
}

/**
 * 이벤트 명령 「먼 배경 변경」 의 흐름 배율(1 = 저작 속도). 명령이 바뀌면 지금 배율에서 목표까지
 * 전환 시간 동안 선형으로 옮긴다 — 「회상이 시작되자 구름이 서서히 멈춘다」.
 *
 * 명령은 **그 맵에 대해** 적힌다(`parallax_override` 와 같은 규칙). 다른 맵이면 저작 속도 그대로다.
 * 장면에 아직 상태가 없으면(맵을 막 실었다·세이브를 불러왔다) 전환 없이 목표로 바로 간다.
 */
function advanceMapBackgroundFlow(scene: PlaySceneContext, deltaMs: number): number {
  const record = scene.session?.m2Runtime?.map?.["parallax_flow"];
  const recordMapId = (record?.mapId ?? "").trim();
  const applies = record !== undefined && (recordMapId === "" || recordMapId === scene.map?.id);
  const command = applies ? decodeMapBackgroundFlow(record.value) : undefined;
  const target = command ? command.percent / 100 : 1;
  const key = applies ? `${recordMapId}|${record.value}` : "";
  const state = scene.mapBackgroundFlow;
  if (!state) {
    scene.mapBackgroundFlow = { key, from: target, target, current: target, elapsedMs: 0, durationMs: 0 };
    return target;
  }
  if (state.key !== key) {
    scene.mapBackgroundFlow = {
      key,
      from: state.current,
      target,
      current: command?.durationMs ? state.current : target,
      elapsedMs: 0,
      durationMs: command?.durationMs ?? 0,
    };
    return scene.mapBackgroundFlow.current;
  }
  if (state.current !== state.target) {
    state.elapsedMs += Math.max(0, deltaMs);
    const t = state.durationMs > 0 ? Math.min(1, state.elapsedMs / state.durationMs) : 1;
    state.current = state.from + (state.target - state.from) * t;
  }
  return state.current;
}

/** 카메라 추적이 확정된 뒤(`followupdate`) 층 위치를 다시 맞춘다. 흐름은 진행하지 않는다. */
function realignMapBackgroundToCamera(scene: PlaySceneContext): void {
  const sprites = scene.mapBackgroundSprites;
  if (!sprites) return;
  const specs = resolveMapBackgroundLayers(scene);
  const count = Math.min(sprites.length, specs.length);
  for (let index = 0; index < count; index += 1) {
    const sprite = sprites[index]!;
    const spec = specs[index]!;
    if (!sprite.visible || spec.cameraFollow === 0) continue;
    placeMapBackgroundLayer(scene, sprite, spec);
  }
}

const followListenerScenes = new WeakSet<object>();

function ensureCameraFollowListener(scene: PlaySceneContext): void {
  const camera = scene.cameras?.main as (Phaser.Cameras.Scene2D.Camera & { on?: unknown }) | undefined;
  if (!camera || typeof camera.on !== "function" || followListenerScenes.has(camera)) return;
  followListenerScenes.add(camera);
  camera.on("followupdate", () => realignMapBackgroundToCamera(scene));
}

function applyMapBackgroundSpecs(
  scene: PlaySceneContext,
  specs: readonly MapBackgroundLayerSpec[],
  signature: string,
): void {
  const previous = scene.mapBackgroundSprites ?? [];
  const sprites: Phaser.GameObjects.TileSprite[] = [];
  for (const [index, spec] of specs.entries()) {
    const textureKey = mapBackgroundTextureKey(spec.imageId);
    let sprite = previous[index];
    if (!sprite) {
      sprite = scene.add.tileSprite(0, 0, PLAY_RESOLUTION.width, PLAY_RESOLUTION.height, textureKey);
      sprite.setOrigin(0, 0);
      sprite.setScrollFactor(0);
    } else if (displayTextureKey(sprite) !== textureKey) {
      // 다른 그림이 들어오면 스크롤 위상도 처음부터다 — 이전 배경의 오프셋을 물려받으면 맵을
      // 다시 실을 때마다 화면이 달라진다.
      sprite.setTexture(textureKey);
      sprite.setTilePosition(0, 0);
      autoOffsets.delete(sprite);
    }
    // depth 는 목록 순서를 따른다(앞이 아래). 같은 depth 를 쓰면 그리는 순서가 삽입 순서에 맡겨진다.
    sprite.setDepth(MAP_BACKGROUND_LAYER_DEPTH + index);
    sprite.setAlpha(spec.opacity);
    applySpriteFit(scene, sprite, spec);
    sprite.setVisible(true);
    sprites.push(sprite);
  }
  // 남는 스프라이트는 감춘다(파괴하지 않는다 — 맵을 오갈 때 재사용한다).
  for (const leftover of previous.slice(specs.length)) leftover.setVisible(false);
  scene.mapBackgroundSprites = sprites;
  scene.mapBackgroundAppliedSignature = signature;
  ensureCameraFollowListener(scene);
  layoutMapBackgroundStack(scene, specs);
}

function hideMapBackgroundSprites(scene: PlaySceneContext): void {
  for (const sprite of scene.mapBackgroundSprites ?? []) sprite.setVisible(false);
}

function layoutMapBackgroundStack(scene: PlaySceneContext, specs: readonly MapBackgroundLayerSpec[]): void {
  const sprites = scene.mapBackgroundSprites ?? [];
  const count = Math.min(sprites.length, specs.length);
  for (let index = 0; index < count; index += 1) {
    const sprite = sprites[index]!;
    if (!sprite.visible) continue;
    const spec = specs[index]!;
    placeMapBackgroundLayer(scene, sprite, spec);
  }
}

/** 배치를 맞추고 스프라이트 크기를 갱신한다(반복 축은 뷰포트, 비반복 축은 그림 한 장). */
function layoutMapBackground(
  scene: PlaySceneContext,
  sprite: Phaser.GameObjects.TileSprite,
  spec: MapBackgroundLayerSpec,
): MapBackgroundLayout {
  applySpriteFit(scene, sprite, spec);
  const source = sourceSizeOf(scene, sprite);
  // 타일이 scale 배로 그려지므로 «그림 한 장의 화면 크기» 도 그만큼이다. 비반복 축은
  // 그 크기까지만 그린다 — 1:1 로 넘기면 축소된 그림이 화면 왼쪽 일부만 채운다.
  const drawn = { width: source.width * (sprite.tileScaleX || 1), height: source.height * (sprite.tileScaleY || 1) };
  const layout = mapBackgroundLayout(scene.cameras.main, drawn, { x: spec.loopX, y: spec.loopY });
  // setSize 는 내부 채움 텍스처를 다시 그린다 — 배율·뷰포트·그림이 실제로 바뀔 때만 부른다.
  if (sprite.width !== layout.width || sprite.height !== layout.height) sprite.setSize(layout.width, layout.height);
  return layout;
}

function applyAxisScroll(
  sprite: Phaser.GameObjects.TileSprite,
  layout: MapBackgroundLayout,
  spec: MapBackgroundLayerSpec,
): void {
  // 양수 속도 = 그림이 왼쪽/위로 흐른다. 반복 축은 UV 를 밀고(무한 반복),
  // 비반복 축은 스프라이트를 반대로 밀어 그림이 화면을 떠나게 한다(빈 자리가 남는다).
  // tilePosition 은 Phaser 단위(논리 px / scale)라 화면 이동량으로 되돌릴 때 다시 곱한다.
  const scaleX = sprite.tileScaleX || 1;
  const scaleY = sprite.tileScaleY || 1;
  sprite.x = spec.loopX ? layout.x : layout.x - sprite.tilePositionX * scaleX;
  sprite.y = spec.loopY ? layout.y : layout.y - sprite.tilePositionY * scaleY;
}

/**
 * 스프라이트의 타일 배율을 저작 fit 에 맞춘다. 값이 같으면 건드리지 않는다(불필요한 dirty 방지).
 *
 * 뷰포트는 **카메라 기준**(width/zoom)이다 — 화면 고정 객체가 그리는 크기와 같아야 배율이 맞는다.
 * PLAY_RESOLUTION 고정값을 쓰면 배율 < 1 에서 배경이 화면을 못 덮어 가장자리가 빈다.
 */
function applySpriteFit(
  scene: PlaySceneContext,
  sprite: Phaser.GameObjects.TileSprite,
  spec: MapBackgroundLayerSpec,
): void {
  if (spec.fit !== "cover") {
    if (sprite.tileScaleX !== 1 || sprite.tileScaleY !== 1) sprite.setTileScale(1, 1);
    return;
  }
  const camera = scene.cameras.main;
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
  const scale = mapBackgroundFitScale(spec.fit, {
    width: (camera.width || PLAY_RESOLUTION.width) / zoom,
    height: (camera.height || PLAY_RESOLUTION.height) / zoom,
  }, sourceSizeOf(scene, sprite));
  if (sprite.tileScaleX !== scale || sprite.tileScaleY !== scale) sprite.setTileScale(scale, scale);
}

function sourceSizeOf(
  scene: PlaySceneContext,
  sprite: Phaser.GameObjects.TileSprite,
): { readonly width: number; readonly height: number } {
  const source = scene.textures.get(displayTextureKey(sprite)).getSourceImage() as {
    readonly width?: number;
    readonly naturalWidth?: number;
    readonly height?: number;
    readonly naturalHeight?: number;
  };
  return {
    width: Math.max(1, Number(source.naturalWidth ?? source.width ?? 0)),
    height: Math.max(1, Number(source.naturalHeight ?? source.height ?? 0)),
  };
}

/**
 * 스프라이트가 **보여 주는** 그림의 키. Phaser 3.60+ 의 TileSprite 는 `texture` 가 자기 채움 캔버스
 * (이름이 uuid, 크기가 스프라이트 크기)이고 원본 그림은 `displayTexture` 에 있다.
 *
 * 실측(2026-09-27, Phaser 3.90): `texture.key` 로 원본 크기를 읽으면 늘 320×240 이 나와 cover 배율이
 * 항상 1 이었다 — 1920×1080 레이어 아트가 좌상단 구석만 확대돼 보였고, 산·지면은 화면에 오지 않았다.
 * 같은 이유로 「다른 그림이 들어왔나」 비교도 매번 참이 되어 맵을 다시 실을 때마다 흐름 위상이 0 으로 돌아갔다.
 */
function displayTextureKey(sprite: Phaser.GameObjects.TileSprite): string {
  const display = (sprite as { displayTexture?: { key?: string } | null }).displayTexture;
  return display?.key ?? sprite.texture.key;
}
