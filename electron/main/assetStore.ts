/**
 * 에셋 스토어 IPC. 실제 요청·검증·캐시는 assetStoreClient 가 하고, 여기서는 Electron 쪽(토큰 암호화·브라우저 열기·알림)만 붙인다.
 */
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { app, ipcMain, safeStorage, shell, webContents } from "electron";
import { OPRN_CHANNELS } from "../shared/channels";
import { storeCatalogSchema, storeLoginSchema, storeSlugSchema, storeUploadSchema, storeUrlSchema, storeBlobSchema, storeVisibilitySchema } from "../shared/schemas";
import { AssetStoreClient, sameOriginUrl, StoreError } from "./assetStoreClient";
import type { StorePackManifest } from "../../src/assetStore/format";

let client: AssetStoreClient | null = null;
let loginSeq = 0;

/** safeStorage 가 되면 암호화해 디스크에, 안 되면(키링 없는 리눅스 등) 이번 실행 동안만 메모리에 둔다. */
function tokenVault(root: string) {
  const file = join(root, "token.bin");
  let memory: string | null = null;
  const persistent = (): boolean => {
    try { return safeStorage.isEncryptionAvailable(); } catch { return false; }
  };
  return {
    persistent,
    load(): string | null {
      if (!persistent() || !existsSync(file)) return memory;
      try { return safeStorage.decryptString(readFileSync(file)); } catch { return null; }
    },
    save(token: string | null): void {
      memory = token;
      if (token === null) { rmSync(file, { force: true }); return; }
      if (!persistent()) return;
      mkdirSync(root, { recursive: true });
      writeFileSync(file, safeStorage.encryptString(token), { mode: 0o600 });
    },
  };
}

function storeClient(): AssetStoreClient {
  if (!client) {
    const root = join(process.env.OPRN_STORE_DATA_DIR ?? app.getPath("userData"), "store");
    client = new AssetStoreClient(root, tokenVault(root), process.env.OPRN_STORE_URL);
  }
  return client;
}

function broadcast(channel: string, payload: unknown): void {
  for (const contents of webContents.getAllWebContents()) if (!contents.isDestroyed()) contents.send(channel, payload);
}

/** 렌더러에 넘길 오류. 스토어 오류는 문구·세부 사유를 그대로, 그 밖은 일반 문구로. */
function wrap<T>(work: () => Promise<T> | T): Promise<T> {
  return Promise.resolve().then(work).catch((error: unknown) => {
    if (error instanceof StoreError) throw new Error(JSON.stringify({ message: error.message, status: error.status, details: error.details }));
    if (error && typeof error === "object" && "issues" in error) throw new Error(JSON.stringify({ message: "요청 형식이 올바르지 않습니다.", status: 400, details: [] }));
    throw new Error(JSON.stringify({ message: error instanceof Error ? error.message : String(error), status: 0, details: [] }));
  });
}

async function status() {
  const store = storeClient();
  let user = null;
  if (store.loggedIn) {
    try { user = (await store.me()).user; } catch (error) { if (!(error instanceof StoreError) || error.status === 0) user = null; }
  }
  return { url: store.url, user, loggedIn: store.loggedIn, tokenPersistent: store.tokenPersistent };
}

export function registerAssetStore(): void {
  const progress = (event: unknown) => broadcast(OPRN_CHANNELS.storeProgress, event);
  ipcMain.handle(OPRN_CHANNELS.storeStatus, () => wrap(status));
  ipcMain.handle(OPRN_CHANNELS.storeSetUrl, (_event, payload: unknown) => wrap(() => { storeClient().setUrl(storeUrlSchema.parse(payload).url); return status(); }));
  ipcMain.handle(OPRN_CHANNELS.storeCatalog, (_event, payload: unknown) => wrap(() => storeClient().catalog(storeCatalogSchema.parse(payload ?? {}))));
  ipcMain.handle(OPRN_CHANNELS.storeItem, (_event, payload: unknown) => wrap(() => { const input = storeSlugSchema.parse(payload); return storeClient().item(input.slug, input.lang); }));
  ipcMain.handle(OPRN_CHANNELS.storeBlob, (_event, payload: unknown) => wrap(() => storeClient().blob(storeBlobSchema.parse(payload).sha256)));
  ipcMain.handle(OPRN_CHANNELS.storeInstalled, () => wrap(() => storeClient().installed()));
  ipcMain.handle(OPRN_CHANNELS.storeInstall, (_event, payload: unknown) => wrap(async () => {
    const input = storeSlugSchema.parse(payload);
    const record = await storeClient().install(input.slug, progress, input.version);
    broadcast(OPRN_CHANNELS.storeChanged, { kind: "installed", slug: record.slug });
    return record;
  }));
  ipcMain.handle(OPRN_CHANNELS.storeUninstall, (_event, payload: unknown) => wrap(() => {
    const { slug } = storeSlugSchema.parse(payload);
    storeClient().uninstall(slug);
    broadcast(OPRN_CHANNELS.storeChanged, { kind: "uninstalled", slug });
    return true;
  }));
  ipcMain.handle(OPRN_CHANNELS.storePackage, (_event, payload: unknown) => wrap(() => storeClient().packageFor(storeSlugSchema.parse(payload).slug)));
  ipcMain.handle(OPRN_CHANNELS.storeMine, () => wrap(() => storeClient().me()));
  ipcMain.handle(OPRN_CHANNELS.storeLogout, () => wrap(async () => {
    loginSeq += 1;
    await storeClient().logout();
    broadcast(OPRN_CHANNELS.storeChanged, { kind: "auth" });
    return true;
  }));
  ipcMain.handle(OPRN_CHANNELS.storeLogin, (_event, payload: unknown) => wrap(async () => {
    const input = storeLoginSchema.parse(payload ?? {});
    const store = storeClient();
    const started = await store.startLogin("OPRN 에디터");
    const seq = ++loginSeq;
    // 서버가 준 주소를 그대로 열지 않는다: 스토어와 같은 출처의 /device 주소일 때만 브라우저로 연다.
    if (input.openBrowser !== false) {
      const verify = sameOriginUrl(started.verification_uri_complete, store.url);
      if (!verify) throw new StoreError("스토어가 알려 준 로그인 주소가 스토어 주소와 다릅니다.");
      void shell.openExternal(verify);
    }
    // 승인될 때까지 메인이 기다린다. 창을 닫거나 다시 시작하면 이전 기다림은 멈춘다.
    const deadline = Date.now() + started.expires_in * 1000;
    void (async () => {
      while (seq === loginSeq && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, started.interval) * 1000));
        if (seq !== loginSeq) return;
        const result = await store.pollLogin(started.device_code).catch(() => "pending" as const);
        if (result === "pending") continue;
        broadcast(OPRN_CHANNELS.storeChanged, { kind: "auth", result });
        return;
      }
      if (seq === loginSeq) broadcast(OPRN_CHANNELS.storeChanged, { kind: "auth", result: "expired" });
    })();
    return { userCode: started.user_code, verificationUri: started.verification_uri, verificationUriComplete: started.verification_uri_complete, expiresIn: started.expires_in };
  }));
  ipcMain.handle(OPRN_CHANNELS.storeUpload, (_event, payload: unknown) => wrap(async () => {
    const input = storeUploadSchema.parse(payload);
    const result = await storeClient().upload({ manifest: input.manifest as StorePackManifest, blobs: input.blobs, ...(input.targetSlug ? { targetSlug: input.targetSlug } : {}) }, progress);
    broadcast(OPRN_CHANNELS.storeChanged, { kind: "uploaded", slug: result.slug });
    return result;
  }));
  ipcMain.handle(OPRN_CHANNELS.storeVisibility, (_event, payload: unknown) => wrap(async () => {
    const { slug, hidden } = storeVisibilitySchema.parse(payload);
    const result = await storeClient().setVisibility(slug, hidden);
    broadcast(OPRN_CHANNELS.storeChanged, { kind: "visibility", slug, result: result.status });
    return result;
  }));
}

