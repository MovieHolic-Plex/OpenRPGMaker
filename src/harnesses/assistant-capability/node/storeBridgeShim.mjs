// 브라우저 편집기(oprn-serve 호스트)에 데스크톱 스토어 다리(window.oprn.store)를 붙이는 시험용 받침.
//
// 왜: 조수 스토어 길(store_find_music → 카드/자동 넣기 → set_game_audio)은 데스크톱 다리가 있어야 시작된다 — 편집기가 그 다리에서
// 스토어 주소를 읽어 실행 요청에 싣고(src/editor/assetStore/storeHint.ts), 카드의 「넣기」가 다리로 받는다. 시험 드라이버는
// 브라우저 편집기를 쓰므로 Node 쪽에서 스토어(예: 스테이징)를 읽는 작은 다리를 Playwright exposeFunction 으로 붙인다.
// 읽기만 한다(목록·상품·매니페스트·파일). 로그인·올리기는 없다. 받은 파일은 sha256 을 확인한다.
import { createHash } from 'node:crypto';

export function nodeStoreBridge(storeUrl) {
  const base = String(storeUrl).replace(/\/+$/u, '');
  const installed = new Map(); // slug -> { record, manifest, blobs: Map<sha, Buffer> }
  const blobCache = new Map();
  const json = async path => {
    const response = await fetch(base + path, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
    const text = await response.text();
    if (!response.ok) throw Error(JSON.stringify({ message: `스토어 오류 ${response.status}: ${text.slice(0, 160)}`, status: response.status }));
    return JSON.parse(text);
  };
  const blob = async sha => {
    if (!/^[0-9a-f]{64}$/u.test(sha)) throw Error('bad sha');
    if (blobCache.has(sha)) return blobCache.get(sha);
    const response = await fetch(`${base}/api/v1/blobs/${sha}`, { redirect: 'follow', signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw Error(JSON.stringify({ message: `파일을 받지 못했습니다(${response.status}).`, status: response.status }));
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== sha) throw Error('받은 파일의 해시가 맞지 않습니다.');
    blobCache.set(sha, bytes);
    return bytes;
  };
  const query = input => new URLSearchParams(Object.entries(input ?? {}).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)]));
  const methods = {
    status: async () => ({ url: base, user: null, loggedIn: false, tokenPersistent: false }),
    catalog: async input => json(`/api/v1/items?${query(input)}`),
    item: async input => json(`/api/v1/items/${encodeURIComponent(input.slug)}${input.lang ? `?lang=${encodeURIComponent(input.lang)}` : ''}`),
    blob: async input => (await blob(input.sha256)).toString('base64'),
    manifest: async input => json(`/api/v1/items/${encodeURIComponent(input.slug)}/versions/${Number(input.version)}/manifest`),
    installed: async () => [...installed.values()].map(entry => entry.record),
    install: async input => {
      const item = await json(`/api/v1/items/${encodeURIComponent(input.slug)}`);
      const version = input.version ?? item.latestVersion;
      const manifest = await json(`/api/v1/items/${encodeURIComponent(input.slug)}/versions/${version}/manifest`);
      for (const ref of manifest.blobs) await blob(ref.sha256);
      const record = { slug: input.slug, version, title: item.title, kind: item.kind, grade: item.grade, license: item.license, aiGenerated: item.aiGenerated,
        author: item.author, cover: item.cover, installedAt: new Date().toISOString(), storeUrl: base };
      installed.set(input.slug, { record, manifest });
      return record;
    },
    uninstall: async input => installed.delete(input.slug),
    package: async input => {
      const entry = installed.get(input.slug);
      if (!entry) throw Error(JSON.stringify({ message: '받지 않은 상품입니다.', status: 0 }));
      const blobs = {};
      for (const ref of entry.manifest.blobs) blobs[ref.sha256] = (await blob(ref.sha256)).toString('base64');
      return { manifest: entry.manifest, blobs, slug: input.slug, version: entry.record.version, author: entry.record.author, storeUrl: base, itemUrl: `${base}/items/${encodeURIComponent(input.slug)}` };
    },
  };
  return async (method, payload) => {
    const run = methods[method];
    if (!run) throw Error(JSON.stringify({ message: `시험 다리에 없는 기능: ${method}`, status: 0 }));
    return run(payload ?? {});
  };
}

/** page 에 window.oprn.store 를 붙인다. 호스트 다리(electron/browser/bridge.ts)가 window.oprn 을 만들 때 store 를 끼워 넣는다. */
export async function installStoreBridge(page, storeUrl, { autoInstall = false } = {}) {
  const call = nodeStoreBridge(storeUrl);
  await page.exposeFunction('__oprnStoreCall', (method, payload) => call(method, payload));
  await page.addInitScript(auto => {
    localStorage.setItem('oprn:store-auto-install', auto ? '1' : '0');
    const toBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const call = (method, payload) => window.__oprnStoreCall(method, payload);
    const store = {
      status: () => call('status'), setUrl: () => call('status'), catalog: input => call('catalog', input), item: input => call('item', input),
      blob: async input => toBytes(await call('blob', input)), manifest: input => call('manifest', input), installed: () => call('installed'), install: input => call('install', input),
      uninstall: input => call('uninstall', input),
      package: async input => { const pkg = await call('package', input); return { ...pkg, blobs: Object.fromEntries(Object.entries(pkg.blobs).map(([sha, b64]) => [sha, toBytes(b64)])) }; },
      mine: () => Promise.reject(Error('로그인하지 않았습니다.')), login: () => Promise.reject(Error('시험 다리는 로그인하지 않는다')), logout: async () => true,
      upload: () => Promise.reject(Error('시험 다리는 올리지 않는다')), visibility: () => Promise.reject(Error('시험 다리는 올리지 않는다')),
      concepts: async () => ({ items: [], nextCursor: null }), concept: () => Promise.reject(Error('none')), conceptMade: async () => false,
      onProgress: () => () => {}, onChanged: () => () => {},
    };
    let held;
    Object.defineProperty(window, 'oprn', { configurable: true, get: () => held, set: value => { held = value && typeof value === 'object' ? Object.assign(value, { store }) : value; } });
  }, autoInstall);
}
