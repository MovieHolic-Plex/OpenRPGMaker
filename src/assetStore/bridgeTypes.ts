/** 렌더러가 보는 데스크톱 스토어 다리(preload `window.oprn.store`). 구현: electron/main/assetStore.ts. */
import type { GameConcept } from "../concepts/format";
import type { StoreGameMeta, StoreGameMine, StoreGamePublishResult } from "./gamePublish";
import type { StoreCatalogPage, StoreItemDetail, StoreItemSummary, StoreItemStatus, StoreLocale, StorePackManifest } from "./format";

export interface StoreUser { readonly id: number; readonly email: string; readonly displayName: string; readonly role: string }
export interface StoreStatus { readonly url: string; readonly user: StoreUser | null; readonly loggedIn: boolean; readonly tokenPersistent: boolean }
export interface InstalledStoreItem {
  readonly slug: string; readonly version: number; readonly title: string; readonly kind: string; readonly grade: string;
  readonly license: string; readonly aiGenerated: boolean; readonly author: string; readonly cover: string | null;
  readonly installedAt: string; readonly storeUrl: string;
  /** 주인 초안(D2): 받을 때 확인 대기였던 내 상품. 나만 보이고 공유되지 않는다. */
  readonly draft?: boolean;
}
/** 「에디터에서 열기」 링크로 들어온 넣기 요청(메인이 출처·slug·판본을 검사한 뒤). */
export interface StoreOpenLinkRequest { readonly slug: string; readonly version?: number }
/** 메인 → 편집기 알림. request 는 「맡겨 둔 요청을 꺼내 가라」는 신호일 뿐이고, 요청 자체는 takeOpenLink 로 받는다. */
export type StoreOpenLinkEvent = { readonly kind: "request" } | { readonly kind: "error"; readonly reason: string };
export interface StorePackagePayload {
  readonly manifest: StorePackManifest; readonly blobs: Readonly<Record<string, Uint8Array>>; readonly slug: string;
  readonly version: number; readonly author: string; readonly storeUrl: string; readonly itemUrl: string;
}
export interface StoreProgressEvent { readonly slug: string; readonly phase: "install" | "upload"; readonly done: number; readonly total: number }
export interface StoreChangedEvent { readonly kind: "installed" | "uninstalled" | "auth" | "uploaded" | "visibility"; readonly slug?: string; readonly result?: string }
export interface StoreLoginStart { readonly userCode: string; readonly verificationUri: string; readonly verificationUriComplete: string; readonly expiresIn: number }
export type MyStoreItem = StoreItemSummary & { readonly status: StoreItemStatus; readonly hiddenBy: string | null };
/** 신고 사유(서버 store_reports 와 같은 다섯). */
export const STORE_REPORT_REASONS = ["copyright", "inappropriate", "broken", "spam", "other"] as const;
export type StoreReportReason = (typeof STORE_REPORT_REASONS)[number];

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
  /** 상품 신고(로그인 없이도 된다). 신고가 쌓이면 서버가 상품을 숨긴다(hidden: true). */
  report(input: { slug: string; reason: StoreReportReason; detail: string }): Promise<{ hidden: boolean }>;
  /** 「바로 플레이」 게임: 이 프로젝트(projectKey)의 게임, 다음 판본 번호, 바뀐 점을 셀 지금 판본 project.json 문자열. */
  gameMine(input: { projectKey: string }): Promise<StoreGameMine & { baselineProject: string | null }>;
  /** 판본 올리기. 번호는 서버가 정한다(1.0 → 1.1, bump major → 2.0, version 은 작가가 고른 번호). 진행은 onProgress(upload). */
  gamePublish(input: {
    projectKey: string; meta: StoreGameMeta; files: Record<string, Uint8Array>; entry: string; cover: string | null; art: string[];
    changelog: string; changes: Record<string, { added: string[]; changed: string[]; removed: string[] }>; bump: "minor" | "major"; version?: string | null;
  }): Promise<StoreGamePublishResult>;
  /** 지금 판본 바꾸기(되돌리기). */
  gameCurrent(input: { slug: string; version: string }): Promise<{ from: string | null; to: string }>;
  /** 컨셉 피드 한 쪽(24개). cursor 는 앞 쪽의 nextCursor. 썸네일 thumb.full·card 는 blob sha256 이라 blob() 으로 받는다. */
  concepts(input: { tag?: string; q?: string; preset?: string; cursor?: string; lang?: StoreLocale }): Promise<{ items: GameConcept[]; nextCursor: string | null }>;
  /** 컨셉 상세와 비슷한 컨셉(최대 6개). 번역은 concept.locales 에 실려 오므로 화면은 localizedConcept 로 고른다. */
  concept(input: { slug: string; lang?: StoreLocale }): Promise<{ concept: GameConcept; similar: GameConcept[] }>;
  /** 「이걸로 만들었다」 세기. 실패해도 false 만 돌려준다. */
  conceptMade(input: { slug: string }): Promise<boolean>;
  onProgress(callback: (event: StoreProgressEvent) => void): () => void;
  onChanged(callback: (event: StoreChangedEvent) => void): () => void;
  /** 프로젝트가 열린 편집기가 부팅할 때, 그 전에 들어와 맡겨 둔 링크 요청을 한 번 꺼낸다. 없으면 null. */
  takeOpenLink(): Promise<StoreOpenLinkRequest | null>;
  /** 「에디터에서 열기」 링크가 들어왔다(이미 열린 편집기). */
  onOpenLink(callback: (event: StoreOpenLinkEvent) => void): () => void;
}
