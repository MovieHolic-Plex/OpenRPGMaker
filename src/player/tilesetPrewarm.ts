// 타일셋 이식 아틀라스 미리 굽기 — 장소 이동의 검은 화면에서 메인 스레드를 막던 첫 굽기를 앞당긴다.
//
// - 이웃 맵(지금 맵 이벤트의 장소 이동이 가리키는 맵)의 타일셋을 프레임 사이 조각으로 워커에 굽게 한다. 메인 스레드 몫은
//   계획 세우기·주소 넘기기·GPU 띠 올리기이고, 한 조각이 IDLE_SLICE_BUDGET_MS 를 넘기면 다음 프레임으로 넘긴다.
// - 미리 굽기는 GPU 올리기도 프레임마다 띠씩 나눠 한다(tilesetGpuStaging.ts) — 통째로 올리면 수백 ms 덩어리라 플레이 중 끊김이 된다.
//   착지 때 ensureTilesetTexture 는 등록만 한다.
// - 장소 이동(transferTo)은 페이드아웃과 같이 도착 맵 타일셋을 굽기 시작하고, 착지 전에 (상한 안에서) 기다린다.
// - 첫 맵은 로더에 「기다림」 파일을 넣어 에셋 로딩과 겹쳐 굽는다(holdLoaderForMapTileset).
import { hurryTilesetTexture, prepareTilesetTexture, tilesetBakeFilesKnown, tilesetBakeSourcesLoaded, tilesetTextureKey } from "@/editor/tilesetImage";
import { offthreadTilesetBakeAvailable } from "@/assets/tilesetBakeOffthread";
import { store } from "@/project/store";
import type { GameMap, MapId, Project, TilesetDef } from "@/project/types";
import type Phaser from "phaser";

/** 유휴 한 조각에서 메인 스레드가 쓰는 상한. */
export const IDLE_SLICE_BUDGET_MS = 4;
/** 이동이 굽기를 기다리는 상한 — 넘기면 예전처럼 메인 스레드에서 굽는다. */
export const TRANSFER_BAKE_WAIT_MS = 4000;

type PrewarmScene = Phaser.Scene;

function tilesetOfMap(project: Project, mapId: MapId): TilesetDef | undefined {
  const map = project.maps[mapId];
  return map ? project.tilesets[map.tilesetId] : undefined;
}

/** 이 맵에서 장소 이동으로 갈 수 있는 맵들 — 분기·전투 결과 갈래 안의 이동까지(명령 모양을 가리지 않고 훑는다). */
export function transferTargetsOfMap(map: GameMap): ReadonlySet<MapId> {
  const targets = new Set<MapId>();
  const seen = new WeakSet<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    const record = value as Record<string, unknown>;
    if (record.kind === "transfer" && typeof record.mapId === "string" && record.mapId !== map.id) targets.add(record.mapId);
    for (const key in record) {
      const child = record[key];
      if (child && typeof child === "object") visit(child);
    }
  };
  for (const event of map.events ?? []) visit(event.pages ?? (event as { commands?: unknown }).commands);
  return targets;
}

/** 장소 이동: 도착 맵 타일셋 굽기를 시작한다. 상한 안에 끝나면 착지 때 올리기만 남는다. */
export async function prepareMapTilesets(scene: PrewarmScene, project: Project, mapId: MapId): Promise<void> {
  const tileset = tilesetOfMap(project, mapId);
  if (!tileset) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    prepareTilesetTexture(scene, tileset).catch(() => false),
    new Promise<void>((done) => { timer = setTimeout(done, TRANSFER_BAKE_WAIT_MS); }),
  ]);
  if (timer !== undefined) clearTimeout(timer);
}

const queues = new WeakMap<PrewarmScene, Array<GameMap | TilesetDef>>();
const scheduled = new WeakSet<PrewarmScene>();

/**
 * 미리 굽기의 계획 세우기 조각 — 한 프레임에 한 조각(상한 IDLE_SLICE_BUDGET_MS), 프레임을 그린 직후에 돈다.
 * requestIdleCallback 은 게임 루프가 도는 동안 거의 오지 않아(헤드리스 실측: 시한 2초마다 한 번) 쓰지 않는다.
 */
function nextFrameSlice(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => { setTimeout(resolve, 0); });
    else setTimeout(resolve, 16);
  });
}
const frameSlices = { sliceBudgetMs: IDLE_SLICE_BUDGET_MS, nextSlice: nextFrameSlice };

/** 지금 맵의 이웃 맵 타일셋을 프레임 사이 조각으로 워커에 굽게 한다(맵에 들어설 때마다 부른다). */
export function scheduleNeighborTilesetPrewarm(scene: PrewarmScene, map: GameMap): void {
  const queue = queues.get(scene) ?? [];
  // 이벤트 훑기도 다음 프레임으로 미룬다 — 맵 들어서기(검은 화면 아래)에 일을 더하지 않는다.
  queue.push(map);
  queues.set(scene, queue);
  if (scheduled.has(scene)) return;
  scheduled.add(scene);
  void (async () => {
    // 한 프레임에 한 조각만 메인 스레드를 쓴다(워커 합성은 그동안 따로 돈다). 타일셋은 하나씩 차례로.
    const seen = new Set<string>();
    while (queue.length > 0) {
      await nextFrameSlice();
      if (!scene.sys || scene.sys.isActive() === false) { queue.length = 0; break; }
      const next = queue.shift()!;
      if ("events" in next) {
        const project = store.getCurrent();
        for (const mapId of transferTargetsOfMap(next)) {
          const tileset = tilesetOfMap(project, mapId);
          if (tileset && !seen.has(tileset.id)) { seen.add(tileset.id); queue.push(tileset); }
        }
        continue;
      }
      await prepareTilesetTexture(scene, next, frameSlices).catch(() => false);
    }
    scheduled.delete(scene);
  })();
}

/** 첫 맵 로딩이 굽기를 기다리는 상한 — 넘기면 create 가 예전처럼 메인 스레드에서 굽는다. */
export const BOOT_BAKE_HOLD_MAX_MS = 8000;
/**
 * 다른 에셋이 다 실린 뒤 워커를 더 기다리는 상한. 워커는 소스 그림을 따로 받아 푸므로 바쁜 기계에서는 로딩보다 늦게 끝난다 —
 * 그때 오래 붙잡으면 첫 그림이 예전(메인 스레드 굽기 0.6~1.3초)보다 늦어진다(2026-10-30 부하 100 실측). 넘기면 create 가 굽는다.
 */
export const BOOT_BAKE_HOLD_AFTER_LOAD_MS = 500;
/** 로딩 화면 동안의 조각 상한 — 플레이 중이 아니라 진행 막대만 돌므로 유휴 조각보다 크게 쓴다. */
const LOADING_SLICE_BUDGET_MS = 12;

/**
 * 첫 맵: 그 맵 타일셋의 이식 아틀라스를 에셋 로딩과 겹쳐 굽고(워커) GPU 에 띠씩 올린다. 로더에 「기다림」 파일을 하나 넣어
 * 다 될 때까지 create 를 미룬다 — 예전에는 create 안에서 메인 스레드가 0.5~1.1초 굽고 올리느라 첫 화면이 멈춰 있었다.
 * 소스 그림판이 다 실리면 시작하고, 다른 파일이 다 끝났으면 남은 일을 서둘러 끝낸다. 워커를 못 쓰면 아무것도 하지 않는다.
 */
export function holdLoaderForMapTileset(scene: PrewarmScene, project: Project, mapId: MapId, runtime: typeof Phaser): void {
  const tileset = tilesetOfMap(project, mapId);
  if (!tileset || (tileset.tileGrafts?.length ?? 0) === 0 || !offthreadTilesetBakeAvailable()) return;
  const textureKey = tilesetTextureKey(tileset);
  if (scene.textures.exists(textureKey)) return;
  const loader = scene.load;
  // 그림 파일 주소를 다 알면 그림판이 실리기를 기다리지 않고 곧바로 워커가 받아 굽는다(로딩과 나란히).
  const fromFiles = tilesetBakeFilesKnown(tileset);
  const slices = { sliceBudgetMs: LOADING_SLICE_BUDGET_MS, nextSlice: nextFrameSlice, fromFiles };
  let job: Promise<boolean> | null = null;
  let settled = false;
  const start = (): void => {
    job = prepareTilesetTexture(scene, tileset, slices).catch(() => false).finally(() => { settled = true; });
  };
  if (fromFiles) start();
  const wait = async (): Promise<void> => {
    const deadline = performance.now() + BOOT_BAKE_HOLD_MAX_MS;
    let othersDoneAt: number | null = null;
    while (!settled && performance.now() < deadline) {
      if (!job && tilesetBakeSourcesLoaded(scene, tileset)) start();
      // 이 파일 말고는 다 끝났다: 소스가 끝내 없으면 기다리지 않고, 굽는 중이면 서두른다.
      const othersDone = loader.list.size === 0 && loader.inflight.size <= 1;
      if (othersDone && !job) return;
      if (othersDone) {
        othersDoneAt ??= performance.now();
        if (performance.now() - othersDoneAt > BOOT_BAKE_HOLD_AFTER_LOAD_MS) return;
        hurryTilesetTexture(tileset);
      }
      await nextFrameSlice();
    }
  };
  class TilesetBakeHold extends runtime.Loader.File {
    constructor() {
      super(loader, { type: "oprn-tileset-bake", cache: false, key: `oprn-tileset-bake:${textureKey}`, url: "about:blank" });
    }
    override load(): void {
      void wait().finally(() => { this.loader.nextFile(this, true); });
    }
  }
  loader.addFile(new TilesetBakeHold());
}
