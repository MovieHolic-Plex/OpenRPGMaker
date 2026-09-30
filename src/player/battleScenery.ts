import { BATTLE_SCENERY_CATALOG, BATTLE_SCENERY_LAYERS, resolveSceneryBiome, type BattleSceneryBiome } from "@/assets/battleSceneryCatalog";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { getBattleSkin, resolveSkinId } from "@/battle/skins/registry";
import { clearBattleBackdropMotion } from "@/player/battleBackdropMotion";
import type { Project } from "@/project/types";

type SceneryState = { key: string; dispose: () => void };
const scenes = new WeakMap<HTMLElement, SceneryState>();

// 지형별 네 층 로드 약속. 전투 진입 커버 동안 미리 부르고(preloadBattleScenery), 그리기는 같은 약속을 기다린다.
// 예전에는 전투 DOM 이 생긴 뒤에야 부르기 시작해, 첫 1~2초 동안 런타임이 고른 단일 배경(다른 그림)이 보이다가
// 겹 배경으로 바뀌었다 — 사용자 신고 「전투 도중에 배경이 바뀐다」.
const layerLoads = new Map<BattleSceneryBiome, Promise<boolean>>();
const readyBiomes = new Set<BattleSceneryBiome>();

function loadSceneryLayers(biome: BattleSceneryBiome): Promise<boolean> {
  const pending = layerLoads.get(biome);
  if (pending) return pending;
  const entry = BATTLE_SCENERY_CATALOG.find((item) => item.biome === biome)!;
  const load = Promise.all(BATTLE_SCENERY_LAYERS.map((layer) => new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => { void image.decode().catch(() => undefined).then(() => resolve(true)); };
    image.onerror = () => resolve(false);
    image.src = `/${entry.layers[layer]}`;
  }))).then((results) => {
    const ok = results.every(Boolean);
    if (ok) readyBiomes.add(biome);
    else layerLoads.delete(biome); // 실패는 다음 전투에서 다시 시도한다.
    return ok;
  });
  layerLoads.set(biome, load);
  return load;
}

function usesLayeredScenery(project: Project): boolean {
  return getBattleSkin(resolveSkinId(project.system.battleUiStyle)).scenery === "layered"
    && project.system.battleBackdrop !== "field" && project.system.battlePresentation !== "onField";
}

/** 전투 진입 커버 동안 이 전투의 겹 배경 네 장을 미리 읽어 둔다. 첫 화면부터 겹 배경이 깔리게 한다. */
export function preloadBattleScenery(project: Project, resourceId?: string): void {
  if (!usesLayeredScenery(project)) return;
  // 전투 DOM 과 같은 id 로 지형을 고른다(battleFieldDom effectiveBackdropId: 트룹/시스템 배경 → 스킨 기본 배경).
  const effectiveId = resourceId ?? getBattleSkin(resolveSkinId(project.system.battleUiStyle)).defaultBackdropResourceId;
  const biome = resolveSceneryBiome(project, { backdropResourceId: effectiveId });
  if (biome) void loadSceneryLayers(biome);
}

export function clearBattleScenery(backdrop: HTMLElement): void {
  scenes.get(backdrop)?.dispose();
}

/** 원래 단일 배경은 남겨 두고 네 장을 모두 읽은 뒤에만 그 위를 덮는다. */
export function syncBattleScenery(backdrop: HTMLElement, project: Project, resourceId?: string): void {
  if (!usesLayeredScenery(project) || backdrop.dataset.backdropSource === "field") {
    clearBattleScenery(backdrop);
    return;
  }
  const key = resourceId ?? "";
  if (scenes.get(backdrop)?.key === key) return;
  clearBattleScenery(backdrop);
  clearBattleBackdropMotion(backdrop);
  const resolvedBiome = resolveSceneryBiome(project, { backdropResourceId: resourceId });
  const biome = resolvedBiome ?? "plains";
  const camera = document.createElement("div");
  camera.className = "battle-scenery-camera";
  camera.dataset.biome = biome;
  camera.dataset.testid = "battle-scenery";
  camera.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  canvas.className = "battle-scenery-ambient";
  canvas.width = 640;
  canvas.height = 360;
  camera.append(canvas);
  backdrop.append(camera);
  const context = canvas.getContext("2d");
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0;
  let disposed = false;
  let connected = backdrop.isConnected;
  let time = 0;
  let previous = 0;
  const particles = Array.from({ length: biome === "snow" ? 54 : 36 }, (_, index) => ({
    x: (index * 137.51) % 640, y: (index * 83.27) % 360,
    phase: index * 2.399, depth: 1 + index % 3,
  }));
  const stop = (): void => { if (raf) cancelAnimationFrame(raf); raf = 0; previous = 0; };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    stop();
    observer.disconnect();
    document.removeEventListener("visibilitychange", reconcile);
    media.removeEventListener("change", reconcile);
    camera.remove();
    scenes.delete(backdrop);
  };
  const frame = (now: number): void => {
    raf = 0;
    if (disposed) return;
    if (!backdrop.isConnected || document.hidden || media.matches) { reconcile(); return; }
    const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
    previous = now;
    time += dt;
    if (context) drawAmbient(context, biome, particles, time, dt);
    raf = requestAnimationFrame(frame);
  };
  function reconcile(): void {
    if (disposed) return;
    if (backdrop.dataset.backdropSource === "field" || (!backdrop.isConnected && connected)) { dispose(); return; }
    connected ||= backdrop.isConnected;
    const paused = document.hidden || media.matches || !connected;
    camera.dataset.paused = String(paused);
    if (paused) {
      stop();
      if (media.matches) context?.clearRect(0, 0, 640, 360);
    } else if (!raf && context) raf = requestAnimationFrame(frame);
  }
  // 숨긴 탭에서도 전투 노드 제거를 감지해 리스너·rAF 를 즉시 해제한다.
  const observer = new MutationObserver(reconcile);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  observer.observe(backdrop, { attributes: true, attributeFilter: ["data-backdrop-source"] });
  document.addEventListener("visibilitychange", reconcile);
  media.addEventListener("change", reconcile);
  scenes.set(backdrop, { key, dispose });
  reconcile();
  if (resolvedBiome) {
    const entry = BATTLE_SCENERY_CATALOG.find((item) => item.biome === biome)!;
    const mount = (): void => {
      for (const name of BATTLE_SCENERY_LAYERS) {
        const node = document.createElement("div");
        node.className = `battle-scenery-layer battle-scenery-${name}`;
        node.style.backgroundImage = `url("/${entry.layers[name]}")`;
        camera.insertBefore(node, canvas);
      }
      camera.dataset.layers = "ready";
    };
    // 겹 배경을 못 읽었을 때만 단일 그림을 대신 깐다(battleFieldDom 이 적어 둔 url, 없으면 숲 레퍼런스).
    const paintFallback = (): void => {
      camera.dataset.layers = "fallback";
      const url = backdrop.dataset.backdropFallbackUrl
        ?? resolveAssetResourceUrl("generated-battle-reference-forest", { project });
      if (url) backdrop.style.backgroundImage = `url("${url}")`;
    };
    if (readyBiomes.has(biome)) mount();
    else {
      // 아직 네 장이 안 왔으면 다른 그림(단일 배경)을 비추지 않고 기다렸다가 페이드인한다(CSS data-layers="loading").
      camera.dataset.layers = "loading";
      void loadSceneryLayers(biome).then((ok) => {
        if (disposed) return;
        if (ok) { camera.dataset.layersFade = "in"; mount(); }
        else paintFallback();
      });
    }
  } else camera.dataset.layers = "custom";
}

type Particle = { x: number; y: number; phase: number; depth: number };

/** 논리 640×360 캔버스 한 장을 프레임마다 한 번 지우고 작은 사각 도트만 그린다. */
function drawAmbient(ctx: CanvasRenderingContext2D, biome: BattleSceneryBiome, particles: Particle[], time: number, dt: number): void {
  ctx.clearRect(0, 0, 640, 360);
  if (biome === "desert") {
    ctx.fillStyle = "rgba(255,224,158,0.035)";
    for (let y = 170; y < 310; y += 14) {
      ctx.fillRect(Math.sin(time * 0.7 + y / 24) * 2, y, 640, 2);
    }
  }
  particles.forEach((p, index) => {
    const firefly = biome === "forest" && index % 3 !== 0;
    const drop = biome === "cave" && index % 4 === 0;
    const velocityY = biome === "snow" ? 7 * p.depth : drop ? 60 : firefly ? -1 : 3;
    p.x = (p.x + dt * (biome === "desert" ? 15 : 2 + p.depth) + 640) % 640;
    p.y = (p.y + dt * velocityY + 360) % 360;
    ctx.globalAlpha = firefly ? 0.18 + 0.5 * (0.5 + 0.5 * Math.sin(time * 1.4 + p.phase))
      : biome === "snow" ? 0.2 + p.depth * 0.16 : drop ? 0.35 : 0.3;
    ctx.fillStyle = biome === "snow" ? "#eaf6ff" : firefly ? "#edf39a" : drop ? "#a7cadb"
      : biome === "forest" ? "#b6c57a" : biome === "desert" ? "#dec595" : "#d7dda8";
    const drift = Math.sin(time * 0.6 + p.phase) * (firefly ? 10 : 4);
    ctx.fillRect(Math.round((p.x + drift) / 2) * 2, Math.round(p.y / 2) * 2, 2, 2);
  });
  ctx.globalAlpha = 1;
}
