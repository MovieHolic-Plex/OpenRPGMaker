// Pi 워커의 스토어 읽기(src/assetStore/storeAccess.ts). 편집기가 요청에 실은 주소로 데스크톱과 같은 AssetStoreClient 를 만든다 —
// 로그인 없이 공개 목록·매니페스트·파일만 읽고, 받은 파일은 sha256·형식을 확인해 워커 캐시에 둔다.
import { homedir } from "node:os";
import { join } from "node:path";
import { AssetStoreClient } from "../../electron/main/assetStoreClient.ts";
import { setWorkerStoreAccess, type StoreReadAccess } from "../../src/assetStore/storeAccess.ts";

const clients = new Map<string, AssetStoreClient>();
const noToken = { load: () => null, save: () => undefined, persistent: () => false };

function clientFor(url: string): AssetStoreClient {
  let client = clients.get(url);
  if (!client) {
    const root = process.env.OPRN_STORE_WORKER_CACHE || join(homedir(), ".oprn", "store-worker-cache");
    client = new AssetStoreClient(root, noToken, url);
    clients.set(url, client);
  }
  return client;
}

/** 실행마다 부른다. 주소가 http(s) 가 아니면 스토어를 끈다. */
export function configureWorkerStore(hint: { url?: unknown; autoInstall?: unknown } | undefined): void {
  const url = typeof hint?.url === "string" && /^https?:\/\/[^\s]+$/u.test(hint.url) ? hint.url.replace(/\/+$/u, "") : "";
  if (!url) { setWorkerStoreAccess(null); return; }
  const client = clientFor(url);
  const access: StoreReadAccess = {
    url, autoInstall: hint?.autoInstall === true,
    catalog: (input) => client.catalog(input),
    item: (slug) => client.item(slug),
    manifest: (slug, version) => client.manifest(slug, version),
    blob: (sha) => client.blob(sha),
  };
  setWorkerStoreAccess(access);
}
