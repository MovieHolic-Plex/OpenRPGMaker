/** 렌더러가 보는 데스크톱 스토어 다리(preload `window.oprn.store`). 구현: electron/main/assetStore.ts. */
import type { GameConcept } from "../concepts/format";
import type { StoreCatalogPage, StoreItemDetail, StoreItemSummary, StoreItemStatus, StoreLocale, StorePackManifest } from "./format";

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
export interface StoreChangedEvent { readonly kind: "installed" | "uninstalled" | "auth" | "uploaded" | "visibility"; readonly slug?: string; readonly result?: string }
export interface StoreLoginStart { readonly userCode: string; readonly verificationUri: string; readonly verificationUriComplete: string; readonly expiresIn: number }
export type MyStoreItem = StoreItemSummary & { readonly status: StoreItemStatus; readonly hiddenBy: string | null };

export interface OprnStoreBridge {
  status(): Promise<StoreStatus>;
  setUrl(input: { url: string }): Promise<StoreStatus>;
  catalog(input: { q?: string; kind?: string; grade?: "" | "single" | "pack"; sort?: "" | "new" | "popular"; page?: number; lang?: StoreLocale }): Promise<StoreCatalogPage>;
  item(input: { slug: string; lang?: StoreLocale }): Promise<StoreItemDetail>;
  blob(input: { sha256: string }): Promise<Uint8Array>;
  installed(): Promise<InstalledStoreItem[]>;
  install(input: { slug: string; version?: number }): Promise<InstalledStoreItem>;
  uninstall(input: { slug: string }): Promise<boolean>;
  package(input: { slug: string }): Promise<StorePackagePayload>;
  mine(): Promise<{ user: StoreUser; items: MyStoreItem[] }>;
  login(input?: { openBrowser?: boolean }): Promise<StoreLoginStart>;
  logout(): Promise<boolean>;
  upload(input: { manifest: StorePackManifest; blobs: Record<string, Uint8Array>; targetSlug?: string }): Promise<{ slug: string; status: StoreItemStatus; version: number }>;
  /** 내 상품 숨기기(hidden: true)·다시 보이기. */
  visibility(input: { slug: string; hidden: boolean }): Promise<{ status: StoreItemStatus }>;
  /** 컨셉 피드 한 쪽(24개). cursor 는 앞 쪽의 nextCursor. 썸네일 thumb.full·card 는 blob sha256 이라 blob() 으로 받는다. */
  concepts(input: { tag?: string; q?: string; preset?: string; cursor?: string; lang?: StoreLocale }): Promise<{ items: GameConcept[]; nextCursor: string | null }>;
  /** 컨셉 상세와 비슷한 컨셉(최대 6개). 번역은 concept.locales 에 실려 오므로 화면은 localizedConcept 로 고른다. */
  concept(input: { slug: string; lang?: StoreLocale }): Promise<{ concept: GameConcept; similar: GameConcept[] }>;
  /** 「이걸로 만들었다」 세기. 실패해도 false 만 돌려준다. */
  conceptMade(input: { slug: string }): Promise<boolean>;
  onProgress(callback: (event: StoreProgressEvent) => void): () => void;
  onChanged(callback: (event: StoreChangedEvent) => void): () => void;
}
