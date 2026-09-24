// 데이터베이스 맵 탭(타일·오브젝트·장소·지역·세계)의 카드 썸네일 스케줄러.
//
// 이 갤러리의 썸네일은 그림 파일이 아니라 **맵 컴파일 결과**다. 장소 카드 한 장은
// `previewPlaceMaps` → `compileSpatialOccurrence` 를 거치고, 그 안에서 프로젝트 전체를
// 직렬화·검증한다(실측: 실프로젝트 카드 1장당 ~170 ms). 갤러리가 카드 전부를 마운트
// 렌더에서 동기로 구우면 탭 열기가 그대로 멈춘다 — 「장소」 탭 204장 = 35 초(2026-09-15 실측,
// output/evidence/db-tab-perf/before.json).
//
// 그래서 두 가지를 한다.
//  1) **미룬다** — 카드는 자리표시자로 먼저 붙고, 화면에 들어온 것부터 프레임 예산만큼 굽는다.
//  2) **기억한다** — 구운 그림은 프로젝트 세대 단위로 보관해 재렌더가 컴파일을 다시 내지 않는다.
//     (셸은 카드 선택·Escape·검색 입력마다 통째로 다시 렌더된다.)
//
// 세대 키는 `tilesets`/`maps`/`spatialAuthoring` 의 **객체 정체성**이다. 스토어 편집은
// 프로젝트를 통째로 새로 만들고(`store.update` 의 structuredClone), 저작 초안 편집은 프로젝트
// 객체는 그대로 두되 최상위 값을 전부 갈아끼운다(`editAuthoringDraft` 의 Object.assign).
// 두 경로 모두 이 세 참조가 바뀌므로 낡은 그림이 남지 않는다.
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { el } from "@/util/dom";

/** 화면 밖이어도 이만큼은 미리 구워 둔다 — 스크롤이 빈 칸을 만나지 않게. */
const PREFETCH_MARGIN_PX = 400;

type PendingThumb = {
  readonly slot: HTMLElement;
  readonly cardId: string;
  readonly build: () => HTMLElement;
};

const NO_DOCUMENT: object = {};

let generation: readonly object[] = [];
let baked = new Map<string, HTMLElement>();
const zoomSrc = new Map<string, string>();

/** 카드가 다시 비어도, 마지막으로 구운 그림 주소. 두 번 클릭 확대가 이 주소를 쓴다. */
export function spatialThumbSrc(cardId: string): string | undefined {
  return zoomSrc.get(cardId);
}
let pending: PendingThumb[] = [];
let frame = 0;
/** 대기열·리스너가 붙은 문서. 이게 바뀌면 남은 일은 전부 남의 문서 것이다. */
let host: Document | null = null;

function currentDocument(): Document | null {
  return typeof document === "undefined" ? null : document;
}

/**
 * 대기열은 프레임 뒤에 깨어난다. 그 사이 문서가 통째로 갈릴 수 있고(테스트 파일 사이의
 * 환경 교체, 모달 해체), 그러면 남은 항목은 이미 사라진 문서의 노드를 붙잡고 있다.
 * 그런 일감은 버린다 — 죽은 트리를 건드리면 남의 테스트 한가운데서 타이머가 튄다.
 */
function adoptDocument(): Document | null {
  const now = currentDocument();
  if (host !== now) {
    host = now;
    pending = [];
    frame = 0;
  }
  return host;
}

function generationOf(): readonly object[] {
  const project = visibleAuthoringProject();
  return [project.tilesets, project.maps, project.spatialAuthoring ?? NO_DOCUMENT];
}

function bakedThumbs(): Map<string, HTMLElement> {
  const next = generationOf();
  if (generation.length !== next.length || generation.some((value, index) => value !== next[index])) {
    generation = next;
    baked = new Map();
    pending = [];
  }
  return baked;
}

/**
 * 아직 붙어 있고 화면(+여유)에 걸치는가.
 *
 * 재어 볼 수 없는 자리는 **없는 자리**로 본다. `isConnected`/`getBoundingClientRect` 는
 * 죽은 문서를 붙잡고 던질 수 있는데, 타이머에서 던지면 아무도 받지 못한다.
 */
function measurable(slot: HTMLElement): "visible" | "near" | "waiting" | "gone" {
  try {
    if (slot.ownerDocument !== host) return "gone";
    if (!slot.isConnected) return "gone";
    const rect = slot.getBoundingClientRect();
    // 넓이 0 은 아직 배치되지 않았거나 숨은 카드다 — 보이는 것이 아니므로 굽지 않는다.
    if (rect.width <= 0 || rect.height <= 0) return "waiting";
    const view = slot.ownerDocument.defaultView;
    const height = view?.innerHeight ?? 0;
    const width = view?.innerWidth ?? 0;
    const within = (margin: number): boolean => rect.bottom >= -margin && rect.top <= height + margin
      && rect.right >= -margin && rect.left <= width + margin;
    if (within(0)) return "visible";
    return within(PREFETCH_MARGIN_PX) ? "near" : "waiting";
  } catch {
    return "gone";
  }
}

function reusableThumb(cardId: string): HTMLElement | undefined {
  const candidate = bakedThumbs().get(cardId);
  // The gallery and composition picker can show the same card simultaneously.
  // Moving a connected node steals the first view's image; cloning loses canvas pixels
  // and pending image-load handlers. Rebuild only that additional view instead.
  const failed = candidate?.matches('[data-preview-state="error"]')
    || candidate?.querySelector('[data-preview-state="error"]');
  if (failed) return undefined;
  if (!candidate?.isConnected) return candidate;
  // 셸이 다시 그려지는 동안 이전 그림이 아직 붙어 있으면, 새 카드는 빈 자리로 남고
  // 곧이은 두 번째 클릭의 확대가 그림을 못 집는다. 붙어 있는 그림은 복제해서 쓴다.
  return cloneAttachedThumb(candidate);
}

function cloneAttachedThumb(node: HTMLElement): HTMLElement {
  if (node instanceof HTMLCanvasElement && node.width > 0 && node.height > 0) {
    const copy = document.createElement("canvas");
    copy.width = node.width;
    copy.height = node.height;
    copy.className = node.className;
    const context = copy.getContext("2d");
    if (context) {
      context.imageSmoothingEnabled = false;
      context.drawImage(node, 0, 0);
    }
    return copy;
  }
  if (node instanceof HTMLImageElement && (node.currentSrc || node.src)) {
    const copy = document.createElement("img");
    copy.className = node.className;
    copy.alt = "";
    copy.draggable = false;
    copy.src = node.currentSrc || node.src;
    return copy;
  }
  return node.cloneNode(true) as HTMLElement;
}

function bake(entry: PendingThumb): void {
  // 한 장이 실패해도 대기열은 계속 돌아야 한다 — 프레임 콜백에서 던지면 아무도 받지 못하고
  // 남은 카드가 영원히 자리표시자로 남는다. 실패한 카드는 빈 그림으로 자리를 채운다.
  let art: HTMLElement;
  try {
    // A shell replacement detaches the old art after queuing this slot. Recheck
    // here so ordinary rerenders still reuse it without recompiling the map.
    art = reusableThumb(entry.cardId) ?? entry.build();
  } catch {
    art = el("div", { class: "spatial-card-fallback", dataset: { thumbError: "build" } });
  }
  art.classList.add("spatial-card-thumb-art");
  const src = art instanceof HTMLImageElement
    ? (art.currentSrc || art.getAttribute("src") || "")
    : (art.querySelector("img")?.getAttribute("src") ?? "");
  if (src) zoomSrc.set(entry.cardId, src);
  bakedThumbs().set(entry.cardId, art);
  entry.slot.replaceChildren(art);
  entry.slot.dataset.thumb = "ready";
}

/**
 * 프레임 예산만큼 굽고 넘긴다. 카드 값이 천차만별이라 «프레임당 한 장» 은 양쪽에서 틀린다 —
 * 오브젝트 썸네일은 1 ms 짜리라 48장이 48프레임(실측 3.75 초)로 늘어지고, 장소 썸네일은 한 장이
 * 이미 예산을 넘는다. 예산을 쓰되 **최소 한 장**은 반드시 구워 대기열이 서지 않게 한다.
 */
const FRAME_BUDGET_MS = 8;

function drain(): void {
  frame = 0;
  // 프레임 사이에 문서가 갈렸으면 남은 일감은 남의 것이다 — 손대지 않고 버린다.
  if (!adoptDocument()) return;
  const alive: PendingThumb[] = [];
  const visible: PendingThumb[] = [];
  const near: PendingThumb[] = [];
  for (const entry of pending) {
    if (entry.slot.dataset.thumb !== "pending") continue;
    const state = measurable(entry.slot);
    if (state === "gone") continue;
    alive.push(entry);
    if (state === "visible") visible.push(entry);
    else if (state === "near") near.push(entry);
  }
  pending = alive;
  // 눈에 보이는 칸이 먼저다 — 여유분(스크롤 예비)은 그 뒤에 굽는다.
  const ready = [...visible, ...near];
  if (ready.length === 0) return;
  const started = performance.now();
  for (const entry of ready) {
    bake(entry);
    if (performance.now() - started >= FRAME_BUDGET_MS) break;
  }
  schedule();
}

function schedule(): void {
  if (frame || pending.length === 0) return;
  // rAF 가 없는 실행기(노드 측 렌더 등)에서도 대기열이 멈추면 안 된다.
  frame = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame(drain)
    : Number(setTimeout(drain, 16));
}

const listeningIn = new WeakSet<Document>();

function listen(): void {
  if (!host || listeningIn.has(host)) return;
  listeningIn.add(host);
  // 어떤 스크롤 상자가 움직이든 다시 재 본다 — 갤러리·모달·본문이 각자 스크롤한다.
  host.addEventListener("scroll", schedule, { capture: true, passive: true });
  host.defaultView?.addEventListener("resize", schedule, { passive: true });
}

/**
 * 카드 썸네일 자리를 돌려주고, 실제 굽기는 화면에 들어올 때까지 미룬다.
 * 이미 구워 둔 그림은 분리된 노드일 때 재사용한다. 다른 화면이 쓰는 그림은 옮기지 않는다.
 */
export function deferredSpatialCardThumb(card: SpatialGalleryCard, build: () => HTMLElement): HTMLElement {
  adoptDocument();
  const cached = reusableThumb(card.id);
  const slot = el("div", {
    class: "spatial-card-thumb-slot",
    dataset: { thumb: cached ? "ready" : "pending", thumbCard: card.id },
  });
  if (cached) {
    slot.append(cached);
    return slot;
  }
  pending.push({ slot, cardId: card.id, build });
  listen();
  schedule();
  return slot;
}

/** 남은 자리표시자를 전부 굽는다 — 테스트·내보내기처럼 화면 가시성이 없는 경로용. */
export function flushSpatialCardThumbs(): void {
  const queue = pending;
  pending = [];
  for (const entry of queue) {
    if (entry.slot.dataset.thumb !== "pending") continue;
    bake(entry);
  }
}

/** 테스트 격리용 — 세대 캐시와 대기열을 비운다. */
export function resetSpatialCardThumbs(): void {
  generation = [];
  baked = new Map();
  zoomSrc.clear();
  pending = [];
  host = currentDocument();
}
