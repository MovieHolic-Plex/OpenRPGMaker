// player/preloadPacks.ts
// 스토어 판본의 그림 묶음(packs/pNNN.json)을 받아 Cache Storage 에 풀고, 판본 범위 서비스 워커(preload-sw.js)가 그 캐시에서 준다.
// 형식·보안 규칙은 project/storeGamePacks.ts. 서비스 워커를 못 쓰는 곳(사파리 일부·사생활 창)은 false 를 돌려주고,
// 부르는 쪽(exportEntry.ts)이 그 파일들을 낱개로 받는다.
import { PACK_IMAGE_PATH, PRELOAD_SW_NAME } from "@/project/storeGamePacks";
import { fetchBlobWithRetry, markUrlsReady } from "@/player/scenePreload";

export interface PreloadPack { readonly path: string; readonly files: readonly string[] }

const MIME: Readonly<Record<string, string>> = { png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif" };

/** 판본 폴더 범위 서비스 워커를 켜고 이 문서를 맡을 때까지 기다린다(최대 4초). 못 켜면 false. */
export async function startPackServiceWorker(base: URL): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || typeof caches === "undefined") return false;
    const registration = await navigator.serviceWorker.register(new URL(PRELOAD_SW_NAME, base).href, { scope: new URL("./", base).pathname });
    if (navigator.serviceWorker.controller) return true;
    await Promise.race([
      new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true })),
      new Promise<void>((resolve) => setTimeout(resolve, 4000)),
    ]);
    void registration;
    return navigator.serviceWorker.controller !== null;
  } catch (error) {
    console.warn("[preload] 서비스 워커를 켜지 못해 낱개로 받습니다:", error);
    return false;
  }
}

/** 같은 게임의 옛 판본 묶음 캐시를 지운다(판본마다 수십 MB). */
export async function dropOtherVersionPackCaches(base: URL): Promise<void> {
  try {
    const scope = new URL("./", base).pathname; // /<slug>/<판본>/
    const game = scope.replace(/[^/]+\/$/u, ""); // /<slug>/
    for (const name of await caches.keys()) {
      if (name.startsWith(`oprn-pack:${game}`) && name !== `oprn-pack:${scope}`) await caches.delete(name);
    }
  } catch { /* 캐시를 못 쓰면 그만 */ }
}

function decodeBase64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * 묶음들을 차례로(동시에 몇 개씩) 받아 풀어 캐시에 넣는다. 묶음 하나가 끝날 때마다 그 안 주소를 «받음» 으로 적는다.
 * 실패한 묶음의 파일 주소를 돌려준다(부르는 쪽이 낱개로 받는다).
 */
export async function loadPacks(base: URL, packs: readonly PreloadPack[], options: { readonly concurrency?: number } = {}): Promise<string[]> {
  const cache = await caches.open(`oprn-pack:${new URL("./", base).pathname}`);
  const queue = [...packs];
  const failed: string[] = [];
  const worker = async (): Promise<void> => {
    for (let pack = queue.shift(); pack; pack = queue.shift()) {
      const urls = pack.files.filter((path) => PACK_IMAGE_PATH.test(path)).map((path) => new URL(path, base).href);
      try {
        const blob = await fetchBlobWithRetry(new URL(pack.path, base).href, "low");
        if (!blob) throw new Error("묶음이 없습니다");
        const body = JSON.parse(await blob.text()) as { v?: unknown; files?: unknown };
        if (body.v !== 1 || !Array.isArray(body.files)) throw new Error("묶음 형식이 아닙니다");
        const listed = new Set(pack.files);
        const puts: Promise<void>[] = [];
        for (const item of body.files) {
          if (!Array.isArray(item) || typeof item[0] !== "string" || typeof item[1] !== "string") continue;
          const path = item[0];
          // 목록에 적힌 그림 경로만(작가가 묶음 안에 다른 경로·형식을 끼워 넣어도 캐시에 들이지 않는다). 형식은 확장자로만 정한다.
          if (!listed.has(path) || !PACK_IMAGE_PATH.test(path) || path.includes("..")) continue;
          const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
          const url = new URL(path, base);
          if (url.origin !== base.origin) continue;
          const response = new Response(decodeBase64(item[1]) as BlobPart, { headers: { "content-type": MIME[ext] ?? "application/octet-stream", "x-content-type-options": "nosniff" } });
          puts.push(cache.put(url.origin + url.pathname, response));
        }
        await Promise.all(puts);
        markUrlsReady(urls);
      } catch (error) {
        console.warn("[preload] 묶음을 풀지 못해 낱개로 받습니다:", pack.path, error);
        failed.push(...urls);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 3) }, worker));
  return failed;
}
