// player/scenePreload.ts
// 웹 플레이어(스토어 판본·웹 내보내기)가 화면에 띄우기 전에 받아 둘 파일 목록과 받는 일.
//
// 왜: 게임 파일은 판본 폴더에 수천 개(폴른 스타 205MB)가 있고, 예전에는 타이틀이 그림·음악보다 먼저 떴다 —
// 배경이 늦게 칠해지고 BGM 이 몇 초 뒤에 들어왔다(2026-10-23 운영 신고). 전부 받고 시작하면 205MB 를 기다린다.
// 그래서 장면 단위로 나눈다. 목록은 프로젝트 데이터에서 뽑는다(따로 적어 두는 목록 없음).
//   - 타이틀: system.titleScreen·오프닝·창 스킨 같은 system 글자 + 메뉴 효과음.
//   - 첫 맵: 엔진이 부팅 때 싣는 텍스처 목록(loadBundledAssets 를 가짜 로더로 돌려 그대로 얻는다)
//     + 그 맵(이벤트·대사 얼굴·그림·BGM·SE)과 그 맵의 타일셋, 시작 파티의 행.
//   - 나머지: 시작 맵에서 가까운 맵부터 차례로, 그다음 프로젝트 전체 — 시작한 뒤 뒤에서 받는다.
// 받기는 fetch 로 몸통까지 끝까지 읽는다. 판본 파일은 immutable 캐시라 이후 Phaser·<img>·<audio> 가 같은 주소를
// 다시 부르면 디스크 캐시에서 나온다. 같은 주소는 한 번만 받는다(진행 중인 약속을 함께 쓴다).
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { BUNDLED_IMAGE_ASSETS, loadBundledAssets } from "@/assets/bundled";
import { listBundledPlayAssetPaths } from "@/assets/bundledAssetWarmup";
import { normalizeWarmUrl } from "@/assets/imageWarmQueue";
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { PLAYER_RUNTIME_AUDIO_RESOURCE_IDS } from "@/player/playerRuntimeAudioIds";
import { monsterSfxRuntimeResourceIds } from "@/assets/monsterSfxAssets";
import { retainPreloadedAudio } from "@/player/preloadedAudio";
import { resolveMapBgm } from "@/project/mapMusic";
import type { MapId, Project } from "@/project/types";

/** 큰 바이너리·거대한 문자열은 자원 id 가 아니다 — 훑기에서 뺀다. */
const SKIPPED_KEYS = new Set(["uploaded", "dataUrl", "audioDescriptions", "monsterMetadata"]);

function collectStrings(value: unknown, out: Set<string>, key = ""): void {
  if (SKIPPED_KEYS.has(key)) return;
  if (typeof value === "string") {
    if (value.length > 0 && value.length <= 300 && !value.startsWith("data:")) out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, key);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [childKey, child] of Object.entries(value)) collectStrings(child, out, childKey);
}

const bundledPathByKey = new Map<string, string>(BUNDLED_IMAGE_ASSETS.map((asset) => [asset.textureKey, asset.path]));

/**
 * 타일셋 한 벌의 글자(이름표 수만 개)는 그 타일셋을 쓰는 맵마다 다시 훑지 않는다 — 폴른 스타는 41맵이 같은 버들항 타일셋을 써서
 * 시작 전 목록 만들기가 메인 스레드 4~5초였다(2026-10-29 실측). 타일셋 객체가 바뀌면(편집) 새 키라 다시 훑는다.
 */
const tilesetStrings = new WeakMap<object, readonly string[]>();
function collectTilesetStrings(tileset: object, out: Set<string>): void {
  let strings = tilesetStrings.get(tileset);
  if (!strings) {
    const found = new Set<string>();
    collectStrings(tileset, found);
    strings = [...found];
    tilesetStrings.set(tileset, strings);
  }
  for (const value of strings) out.add(value);
}

/** 같은 프로젝트에서 같은 글자는 한 번만 해석한다(맵마다 같은 이름표·자원 id 가 되풀이된다). */
const resolvedUrls = new WeakMap<Project, Map<string, string | null>>();
function resourceUrl(id: string, project: Project): string | null {
  let cache = resolvedUrls.get(project);
  if (!cache) resolvedUrls.set(project, (cache = new Map()));
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  const url = resolveResourceUrl(id, project);
  cache.set(id, url);
  return url;
}

/** 자원 id(또는 텍스처 키) → 플레이어가 실제로 부르는 주소. 자원이 아니면 null. */
function resolveResourceUrl(id: string, project: Project): string | null {
  const bundled = bundledPathByKey.get(id);
  if (bundled) return withInlineAsset(bundled);
  let url: string | null = null;
  try {
    url = resolveAssetResourceUrl(id, { project });
  } catch {
    return null;
  }
  return url && fetchable(url) ? url : null;
}

const fetchable = (url: string): boolean => !/^(data:|blob:)/u.test(url) && url.length > 0;

function urlsFromStrings(strings: Iterable<string>, project: Project, out: Set<string>): void {
  for (const value of strings) {
    const url = resourceUrl(value, project);
    if (url) out.add(url);
  }
}

/** 엔진(PlayScene.preload)이 부팅 때 싣는 그림 주소 — 같은 함수를 가짜 로더로 돌려 그대로 받아 적는다. */
export function engineBootUrls(project: Project): Set<string> {
  const urls = new Set<string>();
  const recorder = {
    load: {
      image: (_key: unknown, url?: unknown) => {
        if (typeof url === "string" && fetchable(url)) urls.add(url);
        return recorder.load;
      },
      on: () => recorder.load,
    },
  };
  try {
    loadBundledAssets(recorder as unknown as Parameters<typeof loadBundledAssets>[0], project);
  } catch (error) {
    console.warn("[preload] 엔진 텍스처 목록을 만들지 못했습니다:", error);
  }
  return urls;
}

const TITLE_SKIPPED_SYSTEM_KEY = /battle|gameover|victory|defeat|escape|bgm|ending/i;

/** 타이틀 화면과 바로 이어지는 오프닝이 쓰는 파일. */
export function titleSceneUrls(project: Project): Set<string> {
  const strings = new Set<string>();
  const { titleScreen, opening, ...rest } = project.system;
  collectStrings(titleScreen, strings);
  collectStrings(opening, strings);
  // system 의 맨 위 글자(창 스킨·시스템 그림 등). 전투·게임 오버·기본 BGM 은 그 장면(맵 BGM 은 mapSceneUrls)에서 받는다.
  for (const [key, value] of Object.entries(rest)) if (typeof value === "string" && !TITLE_SKIPPED_SYSTEM_KEY.test(key)) strings.add(value);
  collectStrings(project.meta.oprnOpeningBook, strings);
  // 메뉴·타이틀 효과음. 맵 BGM 폴백 곡은 맵 장면이 정한다.
  for (const id of PLAYER_RUNTIME_AUDIO_RESOURCE_IDS) if (!/bgm/i.test(id)) strings.add(id);
  // 몬스터 수집 장르의 기본 UI 효과음(소스에서 고르는 소리라 프로젝트 글자에 없다).
  for (const id of monsterSfxRuntimeResourceIds(project)) strings.add(id);
  const urls = new Set<string>();
  urlsFromStrings(strings, project, urls);
  return urls;
}

/** 한 맵이 화면에 나오는 데 쓰는 파일(엔진 텍스처는 engineBootUrls 가 맡는다). */
export function mapSceneUrls(project: Project, mapId: MapId): Set<string> {
  const map = project.maps[mapId];
  const urls = new Set<string>();
  if (!map) return urls;
  const strings = new Set<string>();
  collectStrings(map, strings);
  const actors = new Map(project.database.actors.map((actor) => [actor.id, actor]));
  for (const value of [...strings]) {
    const tileset = project.tilesets[value];
    if (tileset) collectTilesetStrings(tileset, strings);
    // 대사의 화자(배우 id)는 그 배우의 얼굴·걷기 그림으로 그린다.
    const actor = actors.get(value);
    if (actor) for (const id of [actor.faceResourceId, actor.characterResourceId]) if (id) strings.add(id);
  }
  // 맵 BGM 은 부모 맵·프로젝트 기본·폴백 곡까지 이어 받는다 — 런타임과 같은 함수로 정한다.
  try {
    const bgm = resolveMapBgm(project, mapId);
    if (bgm.kind === "play") strings.add(bgm.resourceId);
  } catch { /* 맵 트리가 낡았으면 맵 글자만 쓴다 */ }
  urlsFromStrings(strings, project, urls);
  return urls;
}

/** 시작 파티의 얼굴·걷기 그림. */
function startPartyUrls(project: Project): Set<string> {
  const strings = new Set<string>();
  const party = new Set(project.session?.partyActorIds ?? []);
  for (const actor of project.database.actors) if (party.has(actor.id)) collectStrings(actor, strings);
  const urls = new Set<string>();
  urlsFromStrings(strings, project, urls);
  return urls;
}

/** 타이틀이 뜨자마자 플레이어가 미리 데우는 그림(bundledAssetWarmup — 칩셋·캐릭터·조사 아이콘). 같은 주소로 맞춘다. */
function titleWarmupUrls(project: Project): Set<string> {
  const urls = new Set<string>();
  try {
    for (const path of listBundledPlayAssetPaths(project)) {
      const url = normalizeWarmUrl(path);
      if (fetchable(url)) urls.add(url);
    }
  } catch (error) {
    console.warn("[preload] 타이틀 워밍 목록을 만들지 못했습니다:", error);
  }
  return urls;
}

/** 타이틀을 띄우기 전에 다 받아 둘 것: 타이틀·오프닝 + 첫 맵(엔진 텍스처 포함) + 시작 파티. */
export function firstPlayableUrls(project: Project): string[] {
  const urls = new Set<string>([
    ...titleSceneUrls(project), ...engineBootUrls(project), ...mapSceneUrls(project, project.startMapId), ...startPartyUrls(project),
  ]);
  return [...urls];
}

/** 시작 맵에서 가까운 차례(맵 글자 속 다른 맵 id 를 이웃으로 본다). */
export function mapsByDistance(project: Project, startMapId: MapId): MapId[] {
  const order: MapId[] = [];
  const seen = new Set<MapId>();
  const queue: MapId[] = project.maps[startMapId] ? [startMapId] : [];
  for (const id of queue) seen.add(id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    const strings = new Set<string>();
    collectStrings(project.maps[id], strings);
    for (const value of strings) {
      if (!seen.has(value) && project.maps[value]) {
        seen.add(value);
        queue.push(value);
      }
    }
  }
  for (const id of Object.keys(project.maps)) if (!seen.has(id)) order.push(id);
  return order;
}

/** 시작한 뒤 뒤에서 받을 것: 가까운 맵부터, 그다음 프로젝트 전체(전투·메뉴·엔딩). */
export function backgroundUrls(project: Project, startMapId: MapId): string[] {
  // 플레이어가 타이틀에서 따로 데우던 그림(메뉴 아이콘 수백 장 등)도 여기서 받는다 — 웹 판본에서는 그 데우기를 끈다(player.ts).
  const urls = new Set<string>(titleWarmupUrls(project));
  for (const mapId of mapsByDistance(project, startMapId)) for (const url of mapSceneUrls(project, mapId)) urls.add(url);
  const strings = new Set<string>();
  collectStrings({ ...project, maps: {}, resourceProfiles: [], tilesets: {} }, strings);
  urlsFromStrings(strings, project, urls);
  return [...urls];
}

export interface PreloadProgress {
  readonly doneFiles: number;
  readonly totalFiles: number;
  readonly bytes: number;
}

type Entry = { promise: Promise<number>; done: boolean };
const entries = new Map<string, Entry>();
/**
 * 첫 화면의 소리는 받은 바이트를 그대로 쥐고 있다가 blob 주소로 건넨다. 큰 소리 파일(타이틀 WAV 44MB)은
 * 브라우저 HTTP 캐시가 담지 않을 수 있어(항목 크기 상한·시크릿 창), 캐시만 믿으면 타이틀에서 다시 받는다(2026-10-23 실측).
 */
const AUDIO_FILE = /\.(wav|mp3|ogg|opus|m4a|flac)(?:$|\?)/i;



/** 받은 적 있는(또는 받는 중인) 주소인가. */
export function isUrlReady(url: string): boolean {
  return entries.get(url)?.done === true;
}

/**
 * 한 파일을 몸통 끝까지 읽는다. 바이트가 STALL_MS 동안 하나도 오지 않으면 끊고 다시 받는다(최대 ATTEMPTS 번).
 * 왜: 운영(Cloudflare 엣지)에서 한 연결에 몰린 h2/h3 요청 몇 개가 20~60초씩 멈췄고, 불러오기 화면이 그대로 섰다(2026-10-23 실측).
 * 새로 받으면 브라우저가 다른 흐름으로 다시 요청한다.
 */
const STALL_MS = 12_000;
const ATTEMPTS = 4;

async function readWithStallGuard(url: string, priority: "high" | "low", onBytes: (bytes: number) => void, keep: boolean): Promise<{ total: number; blob: Blob | null } | null> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (): void => { clearTimeout(timer); timer = setTimeout(() => controller.abort(new Error("stalled")), STALL_MS); };
    let counted = 0;
    try {
      arm();
      // 다시 받을 때는 캐시를 거치지 않게 하지 않는다 — 판본 파일은 바뀌지 않으므로 캐시에 있으면 그게 가장 빠르다.
      const response = await fetch(url, { priority, signal: controller.signal } as RequestInit);
      if (!response.ok || !response.body) {
        clearTimeout(timer);
        await response.body?.cancel().catch(() => undefined);
        // 없는 파일(404)은 기다려도 오지 않는다 — 넘어간다(런타임이 자리표시로 그린다). 5xx 는 다시 받는다.
        if (response.status >= 500) { lastError = new Error(`HTTP ${response.status}`); continue; }
        return null;
      }
      const chunks: Uint8Array[] = [];
      const reader = response.body.getReader();
      for (;;) {
        arm();
        const { done, value } = await reader.read();
        if (done) break;
        counted += value.byteLength;
        if (keep) chunks.push(value);
        onBytes(value.byteLength);
      }
      clearTimeout(timer);
      return { total: counted, blob: keep ? new Blob(chunks as BlobPart[], { type: response.headers.get("content-type") ?? "" }) : null };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      // 받다 만 바이트는 진행에서 뺀다(다시 받으며 다시 센다).
      if (counted > 0) onBytes(-counted);
      console.warn(`[preload] 다시 받습니다(${attempt + 1}/${ATTEMPTS}):`, url, error);
    }
  }
  throw lastError ?? new Error("preload failed");
}

/** 한 파일을 몸통까지 받아 Blob 으로(멈추면 다시 받는다). 없으면 null. 묶음(preloadPacks.ts)이 쓴다. */
export async function fetchBlobWithRetry(url: string, priority: "high" | "low", onBytes: (bytes: number) => void = () => undefined): Promise<Blob | null> {
  return (await readWithStallGuard(url, priority, onBytes, true))?.blob ?? null;
}

/** 다른 길(묶음)로 이미 캐시에 넣은 주소를 «받음» 으로 적는다 — 맵 이동 대기·뒤 받기가 다시 받지 않게. */
export function markUrlsReady(urls: Iterable<string>): void {
  for (const url of urls) if (!entries.get(url)?.done) entries.set(url, { promise: Promise.resolve(0), done: true });
}

function fetchOne(url: string, priority: "high" | "low", onBytes: (bytes: number) => void, retain = false): Promise<number> {
  const existing = entries.get(url);
  if (existing) return existing.promise;
  const entry: Entry = { promise: Promise.resolve(0), done: false };
  entry.promise = (async () => {
    let total = 0;
    try {
      const keep = retain && AUDIO_FILE.test(url);
      const result = await readWithStallGuard(url, priority, onBytes, keep);
      if (result) {
        total = result.total;
        if (result.blob) retainPreloadedAudio(url, URL.createObjectURL(result.blob));
      }
    } catch (error) {
      // 끝내 못 받았으면 다음에 다시 받을 수 있게 지운다(화면은 멈추지 않는다 — 런타임이 그 주소를 직접 부른다).
      entries.delete(url);
      console.warn("[preload] 받지 못했습니다:", url, error);
      return 0;
    }
    entry.done = true;
    return total;
  })();
  entries.set(url, entry);
  return entry.promise;
}

/**
 * 주소들을 동시에 몇 개씩 받는다. 진행은 «파일 수» 로 센다(gzip 으로 오는 파일은 크기를 미리 알 수 없다).
 * signal 이 끊기면 새 파일을 시작하지 않는다(이미 받는 것은 캐시를 위해 끝까지 받는다).
 */
export async function preloadUrls(
  urls: readonly string[],
  options: { readonly concurrency?: number; readonly priority?: "high" | "low"; readonly onProgress?: (progress: PreloadProgress) => void; readonly signal?: AbortSignal; readonly retainAudio?: boolean } = {},
): Promise<PreloadProgress> {
  const queue = [...new Set(urls)];
  const totalFiles = queue.length;
  let doneFiles = 0;
  let bytes = 0;
  const report = (): void => options.onProgress?.({ doneFiles, totalFiles, bytes });
  report();
  const worker = async (): Promise<void> => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      if (options.signal?.aborted) return;
      await fetchOne(url, options.priority ?? "high", (chunk) => { bytes += chunk; report(); }, options.retainAudio === true);
      doneFiles += 1;
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 6) }, worker));
  return { doneFiles, totalFiles, bytes };
}

/** 맵 이동 직전: 그 맵의 파일이 다 왔는지 확인하고, 아니면 받을 때까지 기다린다. */
export async function ensureMapReady(project: Project, mapId: MapId): Promise<void> {
  const urls = [...mapSceneUrls(project, mapId)].filter((url) => !isUrlReady(url));
  if (urls.length === 0) return;
  await preloadUrls(urls, { concurrency: 6, priority: "high" });
}

let preloadActive = false;
/** 웹 판본에서만 켠다(편집기 테스트 플레이·단일 HTML 은 파일이 이미 곁에 있다). */
export function enableScenePreload(): void { preloadActive = true; }
export function scenePreloadEnabled(): boolean { return preloadActive; }

/**
 * 맵 이동의 어두운 화면에서: 새 맵 파일이 다 올 때까지 밝히지 않는다. 300ms 가 넘으면 작은 «불러오는 중» 표시를 띄운다.
 * 웹 판본에서만 기다린다(scenePreloadEnabled). 이미 받은 맵이면 바로 돌아온다.
 */
export async function holdForMapAssets(host: HTMLElement | undefined, project: Project, mapId: MapId): Promise<void> {
  if (!preloadActive) return;
  const pending = ensureMapReady(project, mapId);
  let spinner: HTMLElement | null = null;
  const timer = setTimeout(() => {
    if (!host) return;
    spinner = document.createElement("div");
    spinner.dataset.testid = "map-transfer-loading";
    spinner.setAttribute("role", "status");
    spinner.textContent = "불러오는 중…";
    spinner.style.cssText = "position:absolute;right:12px;bottom:12px;z-index:50;padding:4px 10px;border-radius:12px;background:#000a;color:#ddd;font:12px/1.4 system-ui,sans-serif;pointer-events:none;";
    host.append(spinner);
  }, 300);
  try {
    await pending;
  } finally {
    clearTimeout(timer);
    (spinner as HTMLElement | null)?.remove();
  }
}
