// project/storeGamePacks.ts
// 스토어 판본의 작은 그림을 «묶음» 으로 싣는다(2026-10-24).
//
// 왜: 판본에는 파일이 약 3,500개 있고 대부분 수 KB 그림이다. 시작한 뒤 «전부 받기» 가 바이트가 아니라 요청 수에 묶여
// 30초를 넘었다. 그림을 2MB 안팎 묶음 수십 개로 합쳐 보내면 요청이 수천 → 수십이 된다.
//
// 형식: `packs/pNNN.json` = { v: 1, files: [[경로, base64], ...] }. json 이라 스토어의 형식 검사(매직 넘버·JSON)를 그대로 지나고,
// 서버가 미리 gzip 한다(base64 의 부풀림은 gzip 뒤 거의 사라진다). 묶음에 든 파일도 판본 폴더에 낱개로 그대로 있다 —
// 서비스 워커가 없는 브라우저는 낱개로 받는다.
// 받는 쪽: 플레이어가 묶음을 풀어 Cache Storage 에 넣고, 판본 폴더 범위의 서비스 워커(preload-sw.js)가 그림 요청을 그 캐시에서 준다.
// 보안: 묶음 안 내용은 작가가 만든 것이다. 그래서 그림 확장자만 담고(여기), 플레이어도 그림 경로만 캐시에 넣으며 형식은
// 확장자로 정하고(preloadPacks.ts), 서비스 워커도 그림 확장자 요청만 캐시에서 준다 — 코드·문서는 언제나 서버에서 온다.

/** 묶음에 담는 파일: 그림만, 하나에 512KB 이하. */
export const PACK_IMAGE_PATH = /^assets\/[\w./-]+\.(?:png|webp|jpe?g|gif)$/iu;
const PACK_FILE_MAX_BYTES = 512 * 1024;
const PACK_TARGET_BYTES = 2 * 1024 * 1024;
export const PRELOAD_SW_NAME = "preload-sw.js";

export interface StoreGamePackPlan {
  /** 묶음 파일 경로 → 그 안에 든 판본 경로들(받는 차례대로). */
  readonly packs: readonly { readonly path: string; readonly files: readonly string[] }[];
}

/**
 * 묶음을 만든다. `skip` 은 불러오기 화면에서 이미 낱개로 받는 첫 화면 파일(두 번 받지 않게), `priority` 는 먼저 받을 경로 차례
 * (시작 맵에서 가까운 맵의 그림부터). 나머지는 경로 순. 같은 입력이면 같은 바이트(판본 해시가 흔들리지 않게).
 */
export function buildStoreGamePacks(
  files: ReadonlyMap<string, Uint8Array>,
  options: { readonly skip: ReadonlySet<string>; readonly priority: readonly string[] },
): { readonly plan: StoreGamePackPlan; readonly packFiles: ReadonlyMap<string, Uint8Array> } {
  const eligible = (path: string): boolean => PACK_IMAGE_PATH.test(path) && !path.includes("..") && !options.skip.has(path) && (files.get(path)?.byteLength ?? Infinity) <= PACK_FILE_MAX_BYTES;
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const path of [...options.priority, ...[...files.keys()].sort()]) {
    if (seen.has(path) || !files.has(path) || !eligible(path)) continue;
    seen.add(path);
    ordered.push(path);
  }
  const packs: { path: string; files: string[] }[] = [];
  const packFiles = new Map<string, Uint8Array>();
  let current: string[] = [];
  let size = 0;
  const flush = (): void => {
    if (current.length === 0) return;
    const path = `packs/p${String(packs.length).padStart(3, "0")}.json`;
    const body = JSON.stringify({ v: 1, files: current.map((file) => [file, toBase64(files.get(file)!)]) });
    packFiles.set(path, new TextEncoder().encode(body));
    packs.push({ path, files: current });
    current = [];
    size = 0;
  };
  for (const path of ordered) {
    current.push(path);
    size += files.get(path)!.byteLength;
    if (size >= PACK_TARGET_BYTES) flush();
  }
  flush();
  return { plan: { packs }, packFiles };
}

function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

/**
 * 판본 폴더 범위의 서비스 워커. 그림 확장자 GET 만, 플레이어가 묶음에서 풀어 둔 캐시에 있으면 그걸 주고 없으면 서버로 간다.
 * 공식 플레이어 파일이다(모든 게임에서 같은 바이트 — 스토어는 운영자가 등록한 해시만 받는다).
 */
export const PRELOAD_SW_SOURCE = `// OPRN 웹 플레이어 — 판본 묶음 캐시(그림만). project/storeGamePacks.ts
const SCOPE = new URL(self.registration.scope).pathname;
const CACHE = "oprn-pack:" + SCOPE;
const IMAGE = /\\.(?:png|webp|jpe?g|gif)$/i;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE) || !IMAGE.test(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(url.origin + url.pathname)).then((hit) => (hit ? image(hit, url.pathname) : fetch(request))).catch(() => fetch(request)));
});
// 캐시에 든 응답을 그대로 내주지 않는다 — 몸통만 꺼내 형식은 주소 확장자로, nosniff·sandbox 를 붙여 새로 만든다.
const MIME = { png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif" };
function image(hit, pathname) {
  const ext = pathname.slice(pathname.lastIndexOf(".") + 1).toLowerCase();
  return hit.arrayBuffer().then((body) => new Response(body, { headers: { "content-type": MIME[ext] || "application/octet-stream", "x-content-type-options": "nosniff", "content-security-policy": "sandbox" } }));
}
`;
