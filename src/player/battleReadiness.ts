import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { retroPixelFxForResource, retroPixelFxResourceId, retroPixelAnimationId } from "@/assets/retroPixelAnimations";
import type { BattleSnapshot } from "@/battle/runtime";
import { bundledRetroPixelAnimation } from "@/project/defaults/retroPixelAnimationRecords";
import type { BattleAnimationRecord, Project } from "@/project/types";

/**
 * 전투 첫 화면 준비 관문. 전투 장면 DOM 을 만든 뒤 전환 연출이 걷히기 전에, 첫 프레임에 보이는 모든 그림이
 * 디코딩될 때까지 기다린다. 예전에는 그림이 `img.src` / CSS background 로 붙은 채 바로 걷혀 느린 망에서
 * 적·배경·초상이 하나씩 늦게 떠올랐다. 상한을 넘으면 경고만 남기고 걷는다(전투를 막지 않는다).
 */
export const BATTLE_READY_TIMEOUT_MS = 6000;
/** 무대 밖 이펙트 시트는 첫 행동 전에 받으면 좋을 뿐이라, 무대 그림이 끝난 뒤 이만큼만 더 기다린다. */
export const BATTLE_EXTRA_GRACE_MS = 800;

const afterReady: Array<() => void> = [];
let afterReadyTimer = 0;

function flushAfterReady(): void {
  window.clearTimeout(afterReadyTimer);
  afterReadyTimer = 0;
  for (const run of afterReady.splice(0)) {
    try {
      run();
    } catch {
      /* 예열 실패는 전투를 막지 않는다 */
    }
  }
}

/**
 * 모든 기술 시트를 한꺼번에 데우는 일처럼 첫 프레임에 필요 없는 요청은 준비 관문이 풀린 뒤에 보낸다.
 * 먼저 보내면 같은 연결 줄에서 무대 그림보다 앞서 달려 첫 화면을 늦춘다. 관문이 없는 마운트에서도
 * 막히지 않도록 상한 뒤에는 어차피 실행한다.
 */
export function deferUntilBattleReady(run: () => void): void {
  afterReady.push(run);
  if (!afterReadyTimer) afterReadyTimer = window.setTimeout(flushAfterReady, BATTLE_READY_TIMEOUT_MS + 1000);
}

const decodeCache = new Map<string, Promise<HTMLImageElement | null>>();

/** 같은 URL 은 한 번만 받고 디코딩한다. 실패는 null 로 풀려 관문을 막지 않는다. */
export function decodeImageUrl(url: string): Promise<HTMLImageElement | null> {
  const cached = decodeCache.get(url);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("error", () => resolve(null), { once: true });
    image.addEventListener("load", () => {
      const done = (): void => resolve(image.naturalWidth > 0 ? image : null);
      if (typeof image.decode === "function") image.decode().then(done, done);
      else done();
    }, { once: true });
    image.src = url;
  });
  decodeCache.set(url, pending);
  return pending;
}

/** 이미 디코딩이 끝난(또는 끝나는 중이 아닌) 그림만 동기로 돌려준다 — 레이아웃 계산용. */
export type DecodedImageLookup = (url: string) => HTMLImageElement | undefined;

const decodedImages = new Map<string, HTMLImageElement>();
export const decodedImageLookup: DecodedImageLookup = (url) => decodedImages.get(url);

function remember(url: string, image: HTMLImageElement | null): void {
  if (image) decodedImages.set(url, image);
}

const URL_PATTERN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g;

function urlsInCss(value: string, into: Set<string>): void {
  if (!value || value === "none" || !value.includes("url(")) return;
  for (const match of value.matchAll(URL_PATTERN)) {
    const url = match[1] ?? match[2] ?? match[3];
    if (url) into.add(url);
  }
}

function resolved(url: string): string {
  try {
    return new URL(url, document.baseURI).href;
  } catch {
    return url;
  }
}

/**
 * 무대가 첫 프레임에 보여 줄 그림 URL 을 모은다: img[src], 인라인 스타일(커스텀 속성 포함)의 url(),
 * 계산된 background-image(::before/::after 포함), 노드가 들고 있는 시트 주소(data-battler-sheet-url).
 * 숨겨진(display:none) 노드의 그림은 건너뛴다.
 */
export function collectBattleStageImageUrls(root: HTMLElement): Set<string> {
  const urls = new Set<string>();
  const nodes: Element[] = [root, ...root.querySelectorAll("*")];
  for (const node of nodes) {
    if (node instanceof HTMLImageElement) {
      const src = node.currentSrc || node.src;
      if (src) urls.add(src);
    }
    if (!(node instanceof HTMLElement || node instanceof SVGElement)) continue;
    const inline = (node as HTMLElement).style;
    if (inline && inline.cssText.includes("url(")) urlsInCss(inline.cssText, urls);
    const sheetUrl = (node as HTMLElement).dataset?.battlerSheetUrl;
    if (sheetUrl) urls.add(sheetUrl);
    const style = getComputedStyle(node);
    if (style.display === "none") continue;
    urlsInCss(style.backgroundImage, urls);
    for (const pseudo of ["::before", "::after"] as const) urlsInCss(getComputedStyle(node, pseudo).backgroundImage, urls);
  }
  return new Set([...urls].map(resolved));
}

/**
 * 첫 전투 연출 후보의 시트 주소. 이 전투에 나온 아군·적이 쓸 수 있는 기술/직업의 이펙트(후속 포함)를
 * 모두 데운다 — 어느 것이 첫 행동이 될지는 전투가 시작돼야 알기 때문이다. 도트 측면 전투가 바꿔 그리는
 * 도트 효과(anim_px_*)도 함께 데운다.
 */
export function battleAnimationSheetUrls(snapshot: BattleSnapshot, project: Project): Set<string> {
  const urls = new Set<string>();
  const records = project.database.battleAnimations;
  const findRecord = (id: string): BattleAnimationRecord | undefined => records.find((entry) => entry.id === id) ?? bundledRetroPixelAnimation(id);
  const add = (animationId: string | undefined, depth = 0): void => {
    if (!animationId || depth > 2) return;
    const record = findRecord(animationId);
    if (!record) return;
    const url = resolveAssetResourceUrl(record.resourceId, { project });
    if (url) urls.add(resolved(url));
    const key = retroPixelFxForResource(record.resourceId);
    if (key) {
      const pixel = findRecord(retroPixelAnimationId(key));
      const pixelUrl = resolveAssetResourceUrl(pixel?.resourceId ?? retroPixelFxResourceId(key), { project });
      if (pixelUrl) urls.add(resolved(pixelUrl));
    }
    for (const followUp of record.followUps ?? []) add(followUp.animationId, depth + 1);
  };
  for (const battler of [...snapshot.actors, ...snapshot.enemies]) {
    for (const skillId of battler.skillIds) add(project.database.skills.find((entry) => entry.id === skillId)?.animationId);
    const cls = battler.classId ? project.database.classes.find((entry) => entry.id === battler.classId) : undefined;
    add(cls?.animationId);
  }
  return urls;
}

export interface BattleReadinessOptions {
  /** 무대 밖이지만 첫 행동에 필요한 그림(이펙트 시트 등). */
  readonly extraUrls?: ReadonlySet<string>;
  /** 디코딩이 끝난 직후, 첫 페인트 전에 호출된다 — 그림 크기에 의존하는 레이아웃 값을 여기서 정한다. */
  readonly settle?: (lookup: DecodedImageLookup) => void;
  readonly timeoutMs?: number;
}

/** 첫 프레임 그림을 모두 디코딩한다. 상한(기본 6초)을 넘기면 경고하고 풀린다. */
export function whenBattleStageReady(root: HTMLElement, options: BattleReadinessOptions = {}): Promise<void> {
  const timeoutMs = options.timeoutMs ?? BATTLE_READY_TIMEOUT_MS;
  const requested = new Set<string>();
  const settled = new Set<string>();
  const extras = new Set(options.extraUrls ?? []);
  const work = (async (): Promise<void> => {
    const extraWork: Promise<unknown>[] = [];
    // 그림을 디코딩하는 동안 새로 붙는 URL(시트 대체·프로브)이 있어 스캔을 몇 번 되풀이한다.
    for (let pass = 0; pass < 4; pass += 1) {
      const wanted = collectBattleStageImageUrls(root);
      const fresh = [...wanted].filter((url) => !requested.has(url));
      for (const url of fresh) requested.add(url);
      const load = async (url: string): Promise<void> => {
        remember(url, await decodeImageUrl(url));
        settled.add(url);
      };
      if (fresh.length === 0) break;
      const imageNodes = [...root.querySelectorAll("img")].filter((img) => img.src && !img.complete);
      await Promise.all([
        ...fresh.map(load),
        ...imageNodes.map((img) => img.decode().catch(() => undefined)),
      ]);
    }
    options.settle?.(decodedImageLookup);
    // 이펙트 시트는 무대 그림이 다 온 뒤에 요청한다 — 먼저 보내면 좁은 망에서 무대 그림의 대역을 나눠 먹는다.
    for (const url of extras) {
      if (requested.has(url)) continue;
      requested.add(url);
      extraWork.push((async () => { remember(url, await decodeImageUrl(url)); settled.add(url); })());
    }
    // 이펙트 시트는 짧게만 더 기다린다 — 못 받아도 전투는 시작하고 시트는 계속 받는다.
    if (extraWork.length > 0) {
      await Promise.race([
        Promise.all(extraWork),
        new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(BATTLE_EXTRA_GRACE_MS, timeoutMs))),
      ]);
    }
  })();
  let timer = 0;
  const cap = new Promise<void>((resolve) => {
    timer = window.setTimeout(() => {
      const missing = [...requested].filter((url) => !settled.has(url));
      console.warn(`[battle-ready] ${timeoutMs}ms 안에 그림 ${missing.length}장을 못 받아 그대로 시작한다`, missing.slice(0, 8));
      try {
        options.settle?.(decodedImageLookup);
      } catch {
        /* 레이아웃 보정 실패는 전투를 막지 않는다 */
      }
      resolve();
    }, timeoutMs);
  });
  return Promise.race([work, cap]).finally(() => {
    window.clearTimeout(timer);
    flushAfterReady();
  });
}
