// opening-still:<컷>@<ms> 타이틀 배경을 그린다 — 오프닝 애니메틱 렌더러로 그 컷의 그 시각을 한 장 그려 PNG 주소로 등록한다.
// 같은 컷 내용·시각이면 다시 그리지 않는다. 그 뒤로는 resolveAssetResourceUrl 이 보통 그림처럼 이 주소를 돌려준다.
import { registerRuntimeResourceUrl, runtimeResourceUrl } from "@/assets/runtimeResourceUrls";
import { findOpeningStillScene, parseOpeningStill } from "@/project/openingStill";
import type { Project } from "@/project/types";
import { drawAnimaticFrame, loadAnimaticImages } from "./openingAnimaticRenderer";

const signatures = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

/** 그 id 의 그림이 이미 지금 컷 내용으로 그려져 있으면 true. */
export function openingStillReady(project: Project, resourceId: string): boolean {
  const parsed = parseOpeningStill(resourceId);
  const scene = parsed ? findOpeningStillScene(project, parsed.sceneId) : undefined;
  return !!scene && runtimeResourceUrl(resourceId) !== null && signatures.get(resourceId) === JSON.stringify(scene.composition);
}

/** 그림을 그려 등록하고 주소를 돌려준다. opening-still 이 아니거나 컷이 없으면 null. */
export function prepareOpeningStill(project: Project, resourceId: string | undefined): Promise<string | null> {
  const parsed = parseOpeningStill(resourceId);
  if (!resourceId || !parsed || typeof document === "undefined") return Promise.resolve(null);
  const scene = findOpeningStillScene(project, parsed.sceneId);
  if (!scene) return Promise.resolve(null);
  const signature = JSON.stringify(scene.composition);
  if (signatures.get(resourceId) === signature) return Promise.resolve(runtimeResourceUrl(resourceId));
  const key = `${resourceId}|${signature}`;
  const running = pending.get(key);
  if (running) return running;
  const promise = (async () => {
    const a = scene.composition;
    const images = await loadAnimaticImages(project, a, new AbortController().signal);
    // 두 배로 그린다: 타이틀은 화면 크기(보통 2배 이상)로 늘려 쓰므로 자막·빛 가장자리가 덜 뭉개진다. 도트는 nearest 라 그대로다.
    const k = 2;
    const canvas = document.createElement("canvas");
    canvas.width = a.width * k; canvas.height = a.height * k;
    const atMs = Math.max(0, Math.min(parsed.atMs, scene.durationMs));
    drawAnimaticFrame(canvas, a, images, atMs, { durationMs: scene.durationMs });
    const url = canvas.toDataURL("image/png");
    registerRuntimeResourceUrl(resourceId, url);
    signatures.set(resourceId, signature);
    return url;
  })().catch((error: unknown) => { console.warn("[title] opening-still 을 그리지 못했다:", resourceId, error); return null; })
    .finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
