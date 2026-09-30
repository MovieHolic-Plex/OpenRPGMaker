import { awaitGraftedTilesetImageUrl } from "@/assets/tileGraftImageCache";
import { tilesetBaseImageUrl } from "@/editor/tilesetImage";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import { keyedTilesetImage } from "@/ai/toolImageCanvas";
import type { ActivityVisual, ActivityVisualRef } from "@/ai/activityVisual";
import { readActivityMedia, saveActivityMediaBlob, setActivityMediaPreparer } from "@/ai/activityMediaArchive";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { charsetFrameSource, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import { registerModal } from "@/editor/ui/modalStack";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

const phases = { before: "변경 전", draft: "초안", read: "확인한 모습", failed: "실패 시점" };
const readable = (text: string): string => text.replace(/\(map_[\w-]+\)/g, "").replace(/\bdirt\b/g, "흙길").replace(/\bsand\b/g, "모래길").replace(/\bequipment\b/g, "장비");
async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image(); image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { image.src = ""; reject(new Error("image timeout")); }, 8000);
    image.onload = () => { clearTimeout(timer); resolve(); }; image.onerror = () => { clearTimeout(timer); reject(new Error("image unavailable")); }; image.src = url;
  });
  return image;
}
const pending = new Map<string, Promise<Blob | undefined>>();
const rasterLanes: Promise<unknown>[] = [Promise.resolve(), Promise.resolve(), Promise.resolve()];
let nextLane = 0;
function rasterQueued(visual: ActivityVisual): Promise<Blob | undefined> {
  const lane = nextLane++ % rasterLanes.length;
  const job = rasterLanes[lane]!.then(() => raster(visual));
  rasterLanes[lane] = job.catch(() => undefined);
  return job;
}
async function raster(visual: ActivityVisual): Promise<Blob | undefined> {
  let canvas: HTMLCanvasElement;
  if (visual.kind === "map" && visual.map && visual.tileset) {
    // Both map and tileset are execution snapshots, never the current editor project.
    let atlas: HTMLImageElement | HTMLCanvasElement | undefined;
    if (visual.tileset.image.type === "uploaded" || visual.tileset.tileGrafts?.length) {
      let url = visual.tileset.image.type === "uploaded" ? visual.uploaded || (visual.uploadedAsset && uploadedAssetUrl(visual.uploadedAsset)) : tilesetBaseImageUrl(visual.tileset);
      if (!url) throw new Error("Uploaded atlas snapshot unavailable");
      if (visual.tileset.tileGrafts?.length) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try { url = await awaitGraftedTilesetImageUrl(visual.tileset, url, controller.signal) ?? undefined; }
        finally { clearTimeout(timer); }
        if (!url) throw new Error("Graft atlas snapshot unavailable");
      }
      const image = await loadImage(url);
      atlas = keyedTilesetImage(visual.tileset, image);
    }
    canvas = await renderRegionSnapshot({ tilesets: { [visual.tileset.id]: visual.tileset } } as Project, visual.map, { x: 0, y: 0, width: visual.map.width, height: visual.map.height }, { targetWidth: 960, image: atlas });
  } else {
    const url = visual.uploaded || (visual.uploadedAsset && uploadedAssetUrl(visual.uploadedAsset)) || resolveAssetResourceUrl(visual.resourceId);
    if (!url || visual.kind === "record") return undefined;
    const image = await loadImage(url);
    const frame = visual.pattern === undefined ? { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight } : charsetFrameSource(decodeCharsetFrameIndex(visual.pattern));
    if (!frame.width || !frame.height) return undefined;
    const scale = Math.min(4, 640 / Math.max(frame.width, frame.height));
    canvas = document.createElement("canvas"); canvas.width = Math.ceil(frame.width * scale); canvas.height = Math.ceil(frame.height * scale);
    const ctx = canvas.getContext("2d"); if (!ctx) return undefined;
    ctx.imageSmoothingEnabled = false;
    if (visual.hue) ctx.filter = `hue-rotate(${visual.hue}deg)`;
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, canvas.width, canvas.height);
    // Standard asset chroma key; preserve all other authored colors.
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) if (pixels.data[i]! > 240 && pixels.data[i + 1]! < 20 && pixels.data[i + 2]! > 240) pixels.data[i + 3] = 0;
    ctx.putImageData(pixels, 0, 0);
  }
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob ?? undefined), "image/png"));
}
function prepare(id: string, visual?: ActivityVisual): Promise<Blob | undefined> {
  const existing = pending.get(id); if (existing) return existing;
  const promise = (async () => {
    const saved = await readActivityMedia(id);
    if (saved?.blob) return saved.blob;
    const source = saved?.visual ?? visual;
    if (!source) return undefined;
    const blob = await rasterQueued(source);
    if (blob) await saveActivityMediaBlob(id, blob);
    return blob;
  })().catch(() => undefined);
  pending.set(id, promise);
  void promise.finally(() => pending.delete(id));
  return promise;
}
// Capture even when the user hides the feed. Saved history never resolves from live project state.
setActivityMediaPreparer((id, visual) => { void prepare(id, visual); });
type MountedImageUrl = { readonly url: string; readonly createdAt: number; mounted: boolean };
const imageUrls = new Map<HTMLImageElement, MountedImageUrl>();
let imageObserver: MutationObserver | undefined;
/** 한 번도 붙지 않은 그림을 기다려 주는 시간. 그 뒤에도 안 붙으면 버려진 것으로 보고 푼다. */
const UNMOUNTED_IMAGE_GRACE_MS = 30_000;
/**
 * 떨어진 그림의 Blob URL 을 푼다 — 단, 아직 읽는 중이거나 한 번도 문서에 붙지 않은 그림은 두고 본다.
 *
 * 2026-09-23 도그푸딩: 생성 중 콘솔에 `blob:… net::ERR_FILE_NOT_FOUND` 가 ~200건 찍혔다. 활동 보기는
 * 기록이 들어올 때마다 행을 갈아 끼우는데(상태·요약이 바뀌면 새 행), 옛 행의 그림이 아직 읽는 중일 때
 * 관찰자가 URL 을 풀어 읽기가 실패했다. 카드를 로그에 붙이기 전에 그림이 먼저 준비된 경우도
 * 「안 붙음 = 떨어짐」으로 보고 풀어, 붙고 나서 빈 칸이 됐다.
 */
function releaseImage(image: HTMLImageElement, now = Date.now()): void {
  const entry = imageUrls.get(image);
  if (!entry) return;
  if (image.isConnected) { entry.mounted = true; return; }
  if (!image.complete) return;
  if (!entry.mounted && now - entry.createdAt < UNMOUNTED_IMAGE_GRACE_MS) return;
  URL.revokeObjectURL(entry.url); dropImageUrl(image);
}
/** 그림 하나를 목록에서 뺀다. 더 감시할 그림이 없으면 body 전역 관찰자도 끈다(다음 attachImage 가 다시 만든다). */
function dropImageUrl(image: HTMLImageElement): void {
  imageUrls.delete(image);
  if (imageUrls.size === 0) disposeActivityImageObserver();
}
/** body 전역 MutationObserver 를 끊는다. 그림이 하나도 없을 때 자동 호출되고, 테스트·정리 경로도 부를 수 있다. */
export function disposeActivityImageObserver(): void {
  imageObserver?.disconnect();
  imageObserver = undefined;
}
export function releaseDetachedActivityImages(now = Date.now()): void {
  for (const image of imageUrls.keys()) releaseImage(image, now);
}
/** 테스트용 — 아직 풀지 않은 그림 URL 수. */
export function retainedActivityImageUrlCount(): number { return imageUrls.size; }
let orphanTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleOrphanSweep(): void {
  if (orphanTimer !== undefined) return;
  orphanTimer = setTimeout(() => {
    orphanTimer = undefined;
    releaseDetachedActivityImages();
    if ([...imageUrls.values()].some(entry => !entry.mounted && Date.now() - entry.createdAt < UNMOUNTED_IMAGE_GRACE_MS)) scheduleOrphanSweep();
  }, UNMOUNTED_IMAGE_GRACE_MS);
}
function visitActivityImages(node: Node, visit: (image: HTMLImageElement) => void): void {
  if (node.nodeType !== 1) return;
  const element = node as Element;
  if (element.tagName === "IMG") visit(element as HTMLImageElement);
  for (const image of element.querySelectorAll<HTMLImageElement>("img")) visit(image);
}
function releaseRemovedImages(records: MutationRecord[]): void {
  for (const record of records) {
    // A mount and removal may both occur before this callback.
    for (const node of record.addedNodes) visitActivityImages(node, image => {
      const entry = imageUrls.get(image);
      if (entry) entry.mounted = true;
    });
    for (const node of record.removedNodes) visitActivityImages(node, image => {
      const entry = imageUrls.get(image);
      if (entry) { entry.mounted = true; releaseImage(image); }
    });
  }
}
export function attachImage(surface: HTMLElement, blob: Blob, title: string): void {
  const url = URL.createObjectURL(blob);
  const image = document.createElement("img"); image.alt = title; image.decoding = "async";
  imageUrls.set(image, { url, createdAt: Date.now(), mounted: false });
  image.addEventListener("load", () => { surface.dataset.ready = "true"; queueMicrotask(() => releaseImage(image)); }, { once: true });
  image.addEventListener("error", () => { surface.textContent = "이미지를 불러오지 못했어요"; URL.revokeObjectURL(url); dropImageUrl(image); }, { once: true });
  image.src = url;
  surface.replaceChildren(image);
  // Revoking on load can leave offscreen/async decoded images blank when scrolled back.
  // Keep the URL for the element's entire mounted lifetime, release on removal.
  if (!imageObserver) { imageObserver = new MutationObserver(releaseRemovedImages); imageObserver.observe(document.body, { childList: true, subtree: true }); }
  queueMicrotask(() => releaseImage(image));
  scheduleOrphanSweep();
}

function figure(ref: ActivityVisualRef, compact = false): HTMLElement {
  const picture = el("span", { class: "ai-media-picture", text: "미리보기 준비 중…" });
  const result = el("figure", { class: `ai-media-figure is-${ref.kind}`, children: [picture] });
  if (!compact) result.append(el("figcaption", { children: [el("span", { class: `ai-media-phase is-${ref.phase}`, text: phases[ref.phase] }), el("strong", { text: ref.title })] }));
  void (async () => {
    const record = await readActivityMedia(ref.id);
    if (!record) { picture.textContent = "보관된 이미지 없음"; return; }
    const blob = await prepare(ref.id);
    if (blob) attachImage(picture, blob, ref.title);
    else { picture.textContent = record.visual.resourceId || record.visual.kind === "map" ? "이미지를 불러오지 못했어요" : "등록된 이미지 없음"; picture.classList.add("is-unavailable"); if (record.visual.kind === "record" && record.visual.stats?.length) picture.hidden = true; }
    if (!compact) {
      const visual = record.visual;
      if (visual.stats?.length) result.append(el("dl", { class: "ai-media-stats", children: visual.stats.flatMap(([key, value]) => [el("dt", { text: key }), el("dd", { text: value })]) }));
      result.append(el("small", { class: "ai-media-caption", text: visual.caption }));
    }
  })();
  return result;
}
function openViewer(refs: readonly ActivityVisualRef[], summary: string): void {
  const origin = document.activeElement as HTMLElement | null;
  const dialog = document.createElement("dialog"); dialog.className = "ai-media-dialog"; dialog.setAttribute("aria-label", "작업 이미지 자세히 보기");
  const close = registerModal(dialog, () => { dialog.close(); dialog.remove(); origin?.focus({ preventScroll: true }); });
  const button = el("button", { text: "닫기 ×", attrs: { type: "button" }, on: { click: close } });
  dialog.append(el("header", { children: [el("div", { children: [el("strong", { text: "작업 당시의 모습" }), el("p", { text: readable(summary) })] }), button] }), el("div", { class: "ai-media-gallery", children: refs.map(ref => figure(ref)) }));
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  document.body.append(dialog); dialog.showModal(); button.focus();
}
export function createActivityMedia(refs: readonly ActivityVisualRef[], summary = "", compact = false): HTMLElement {
  const root = el("div", { class: `ai-activity-media${compact ? " is-compact" : ""}`, dataset: { testid: compact ? "ai-team-media" : "ai-activity-media" } });
  if (compact) { root.append(figure(refs.at(-1)!, true)); return root; }
  const gallery = el("div", { class: "ai-media-gallery", children: refs.map(ref => {
    const button = el("button", { class: "ai-media-open", attrs: { type: "button", "aria-label": `${ref.title} · ${phases[ref.phase]} 크게 보기` }, children: [figure(ref)], on: { click: event => { event.stopPropagation(); openViewer(refs, summary); } } });
    return button;
  }) });
  root.append(gallery);
  if (summary) root.append(el("p", { class: "ai-media-result", text: readable(summary) }));
  return root;
}
