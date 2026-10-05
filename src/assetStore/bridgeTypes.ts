/** 렌더러가 보는 데스크톱 스토어 다리(preload `window.oprn.store`). 구현: electron/main/assetStore.ts. */
import type { StoreCatalogPage, StoreItemDetail, StoreItemSummary, StoreItemStatus, StorePackManifest } from "./format";

export interface StoreUser { readonly id: number; readonly email: string; readonly displayName: string; readonly role: string }
export interface StoreStatus { readonly url: string; readonly user: StoreUser | null; readonly loggedIn: boolean; readonly tokenPersistent: boolean }
export interface InstalledStoreItem {
  readonly slug: string; readonly version: number; readonly title: string; readonly kind: string; readonly grade: string;
  readonly license: string; readonly aiGenerated: boolean; readonly author: string; readonly cover: string | null;
  readonly installedAt: string; readonly storeUrl: string;
}
export interface StorePackagePayload {
  readonly manifest: StorePackManifest; readonly blobs: Readonly<Record<string, Uint8Array>>; readonly slug: string;
  readonly version: number; readonly author: string; readonly storeUrl: string; readonly itemUrl: string;
}
export interface StoreProgressEvent { readonly slug: string; readonly phase: "install" | "upload"; readonly done: number; readonly total: number }
export interface StoreChangedEvent { readonly kind: "installed" | "uninstalled" | "auth" | "uploaded"; readonly slug?: string; readonly result?: string }
export interface StoreLoginStart { readonly userCode: string; readonly verificationUri: string; readonly verificationUriComplete: string; readonly expiresIn: number }
export type MyStoreItem = StoreItemSummary & { readonly status: StoreItemStatus; readonly hiddenBy: string | null };

export interface OprnStoreBridge {
  status(): Promise<StoreStatus>;
  setUrl(input: { url: string }): Promise<StoreStatus>;
  catalog(input: { q?: string; kind?: string; grade?: "" | "single" | "pack"; sort?: "" | "new" | "popular"; page?: number }): Promise<StoreCatalogPage>;
  item(input: { slug: string }): Promise<StoreItemDetail>;
  blob(input: { sha256: string }): Promise<Uint8Array>;
  installed(): Promise<InstalledStoreItem[]>;
  install(input: { slug: string; version?: number }): Promise<InstalledStoreItem>;
  uninstall(input: { slug: string }): Promise<boolean>;
  package(input: { slug: string }): Promise<StorePackagePayload>;
  mine(): Promise<{ user: StoreUser; items: MyStoreItem[] }>;
  login(input?: { openBrowser?: boolean }): Promise<StoreLoginStart>;
  logout(): Promise<boolean>;
  upload(input: { manifest: StorePackManifest; blobs: Record<string, Uint8Array>; targetSlug?: string }): Promise<{ slug: string; status: StoreItemStatus; version: number }>;
  onProgress(callback: (event: StoreProgressEvent) => void): () => void;
  onChanged(callback: (event: StoreChangedEvent) => void): () => void;
}
