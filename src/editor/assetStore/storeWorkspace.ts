// src/editor/assetStore/storeWorkspace.ts
/**
 * 에셋 스토어 큰 화면 — 공방과 같은 body 위 오버레이. 탭 넷: 둘러보기 · 받아 둔 것 · 내 프로젝트 · 내 에셋 나누기.
 * 처음 온 사람 기준(2026-10-20 감사): 낱말은 쉬운 말로, 넣기는 단추 하나, 넣은 뒤에는 「들어간 곳」과 「되돌리기」,
 * 오류는 고칠 방법 단추와 함께. 스토어 서버와의 통신은 전부 메인 프로세스(window.oprn.store)가 한다.
 * 보안: 상품 글은 전부 textContent(translate=no) 로만 넣고 그림은 메인이 해시를 확인한 blob: 주소로만 띄운다.
 * 위키: openwiki/asset-store.md 「스토어 창 UX」.
 */
import "@/styles/database/assetStore/index.css";
import type { InstalledStoreItem, MyStoreItem, StoreLoginStart, StoreOpenLinkRequest, StoreReportReason, StoreStatus } from "@/assetStore/bridgeTypes";
import { STORE_REPORT_REASONS } from "@/assetStore/bridgeTypes";
import {
  STORE_ITEM_KINDS, STORE_KIND_NAMES, STORE_LICENSE_SHORT,
  type StoreItemDetail, type StoreItemKind, type StoreItemSummary, type StoreLicense,
} from "@/assetStore/format";
import { storeCredits, storeItemsInProject } from "@/assetStore/pack";
import { addMap } from "@/editor/actions";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectEditorMap } from "@/editor/mapSelection";
import { getLocale, t } from "@/i18n";
import { store } from "@/project/store";
import type { ResourceKind } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";
import { addStoreItemToProject, editStoreItemInProject, undoStoreItemAdd } from "./storeApply";
import { fillStoreImage, storeBridge, storeFailure, type StoreFailure } from "./storeBridge";
import { resetShare, shareView, type ShareHost } from "./storeShare";
import {
  contentsSentence, formatBytes, humanStoreError, landedLines, landedSummary, licenseSentence,
  STORE_HOME_CATEGORIES, STORE_LARGE_DOWNLOAD_BYTES, type StoreFixAction,
} from "./storeText";
import { removeStaleStoreAssets, removeStoreItem, type StoreAddSnapshot } from "./storeUndo";

type Tab = "browse" | "installed" | "project" | "upload";
const TAB_LABELS: Record<Tab, string> = { browse: "둘러보기", installed: "받아 둔 것", project: "내 프로젝트", upload: "내 에셋 나누기" };
const FIRST_RUN_KEY = "oprn:store.firstRunDone";

interface Added {
  readonly title: string;
  readonly snapshot: StoreAddSnapshot;
  readonly tilesetIds: readonly string[];
  readonly assetIds: readonly string[];
  readonly staleAssetIds: readonly string[];
  readonly lines: readonly string[];
  undone: boolean;
}

interface Busy { label: string; done: number; total: number }
interface ReportForm { slug: string; reason: StoreReportReason | ""; detail: string; sent: boolean; error: string }

interface State {
  tab: Tab;
  status: StoreStatus | null;
  error: { failure: StoreFailure; retry: (() => void) | null } | null;
  query: { q: string; kind: string; grade: "" | "pack"; sort: "" | "popular" };
  items: StoreItemSummary[];
  total: number;
  page: number;
  pageSize: number;
  loaded: boolean;
  loading: boolean;
  offline: boolean;
  selected: string | null;
  detail: StoreItemDetail | null;
  installed: InstalledStoreItem[];
  latest: Map<string, number>;
  known: Map<string, StoreItemSummary>;
  busy: Map<string, Busy>;
  login: StoreLoginStart | null;
  mine: MyStoreItem[] | null;
  added: Map<string, Added>;
  report: ReportForm | null;
  urlEditing: boolean;
  advanced: boolean;
  /** 「에디터에서 열기」 링크로 열었고 아직 확인 카드에서 고르지 않은 요청. */
  linkRequest: StoreOpenLinkRequest | null;
  /** 링크 상품을 보려면 로그인이 필요했다 — 로그인이 끝나면 이 slug 를 다시 연다. */
  resumeLink: string | null;
}

let host: HTMLElement | null = null;
let shell: { section: HTMLElement; account: HTMLElement; dynamic: HTMLElement; search: HTMLInputElement; suggest: HTMLElement } | null = null;
let disposers: (() => void)[] = [];
let observer: IntersectionObserver | null = null;
let searchTimer: number | undefined;
let catalogSeq = 0;
let suggestIndex = -1;
const state: State = {
  tab: "browse", status: null, error: null, query: { q: "", kind: "", grade: "", sort: "popular" },
  items: [], total: 0, page: 1, pageSize: 24, loaded: false, loading: false, offline: false,
  selected: null, detail: null, installed: [], latest: new Map(), known: new Map(), busy: new Map(), login: null, mine: null,
  added: new Map(), report: null, urlEditing: false, advanced: false, linkRequest: null, resumeLink: null,
};

export function isAssetStoreOpen(): boolean {
  return host !== null;
}

export function openAssetStore(tab: Tab = state.tab): void {
  closeAssetStore();
  const bridge = storeBridge();
  state.tab = tab;
  if (tab === "browse") {
    state.query.sort = "popular";
    state.selected = null;
    state.detail = null;
  }
  host = el("div", { class: "store-host", dataset: { testid: "store-host" }, on: { click: (event) => { if (event.target === host) closeAssetStore(); } } });
  if (typeof document !== "undefined") {
    if (document.querySelector('[data-testid="left-activity-bar"]')) host.style.left = "48px";
    if (document.querySelector('[data-testid="oprn-menu-bar"]')) {
      host.style.top = "48px";
      host.style.paddingTop = "16px";
    }
  }
  document.body.append(host);
  document.addEventListener("keydown", onKeydown);
  if (!bridge) {
    host.append(el("section", { class: "store", attrs: { role: "dialog", "aria-label": "에셋 스토어" }, children: [
      el("p", { class: "store-empty", text: "에셋 스토어는 OPRN 데스크톱 앱에서 열 수 있습니다." }),
      el("button", { text: "닫기", attrs: { type: "button" }, on: { click: closeAssetStore } }),
    ] }));
    return;
  }
  buildShell();
  disposers.push(bridge.onProgress((event) => {
    const busy = state.busy.get(event.slug);
    if (!busy || event.phase !== "install") return;
    busy.done = event.done;
    busy.total = event.total;
    paintProgress(event.slug);
  }));
  disposers.push(bridge.onChanged((event) => {
    if (event.kind === "auth") {
      state.login = null;
      if (event.result === "denied") toast("브라우저에서 로그인을 거절했습니다.", "info");
      if (event.result === "expired") toast("로그인 코드가 만료되었습니다. 다시 시도해 주세요.", "info");
      const resume = event.result === "approved" ? state.resumeLink : null;
      if (event.result !== undefined) state.resumeLink = null;
      void refreshStatus();
      if (resume) void openLinkDetail(resume);
    } else void refreshInstalled();
  }));
  render();
  void refreshStatus();
  void refreshInstalled();
  void loadCatalog(true);
}

export function closeAssetStore(): void {
  document.removeEventListener("keydown", onKeydown);
  for (const dispose of disposers) dispose();
  disposers = [];
  observer?.disconnect();
  observer = null;
  window.clearTimeout(searchTimer);
  searchTimer = undefined;
  state.added.clear();
  state.error = null;
  state.report = null;
  state.linkRequest = null;
  state.resumeLink = null;
  host?.remove();
  host = null;
  shell = null;
}

/**
 * 「에디터에서 열기」 링크(메인이 출처·slug·판본을 검사했다)로 스토어를 그 상품에 연다.
 * 받기·넣기는 하지 않는다 — 상세 위에 확인 카드를 띄우고, 사용자가 누를 때만 기존 넣기 경로로 간다.
 */
export function openAssetStoreForLink(request: StoreOpenLinkRequest): void {
  if (!host) openAssetStore("browse");
  else { state.tab = "browse"; state.error = null; }
  if (!storeBridge()) return;
  state.linkRequest = { slug: request.slug, ...(request.version !== undefined ? { version: request.version } : {}) };
  void openLinkDetail(request.slug);
}

/** 링크 상품 상세. 공개되지 않은 상품(주인 초안)이 로그인 없이 안 보이면 기존 기기 코드 로그인을 열고, 끝나면 이어서 연다. */
async function openLinkDetail(slug: string): Promise<void> {
  const bridge = storeBridge();
  if (!bridge) return;
  state.selected = slug;
  state.detail = null;
  state.report = null;
  render();
  try {
    const detail = await bridge.item({ slug, lang: getLocale() });
    if (state.selected !== slug) return;
    state.detail = detail;
    state.latest.set(slug, detail.latestVersion);
  } catch (error) {
    const failure = storeFailure(error);
    const loggedIn = (await bridge.status().catch(() => null))?.loggedIn ?? false;
    if (!loggedIn && [401, 403, 404].includes(failure.status)) {
      state.resumeLink = slug;
      toast("이 에셋은 로그인해야 보여요. 브라우저에서 로그인하면 이어서 열게요.", "info");
      void startLogin();
      return;
    }
    setError(error, () => void openLinkDetail(slug));
  }
  render();
  host?.querySelector<HTMLElement>('[data-testid="store-detail-title"]')?.focus({ preventScroll: true });
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
}

/** Esc 는 바깥으로 한 겹씩: 추천 → 신고 양식 → 상품 → 스토어. 「/」 는 찾기 칸으로. */
function onKeydown(event: KeyboardEvent): void {
  if (!host) return;
  if (event.key === "/" && !isTyping(event.target)) {
    event.preventDefault();
    shell?.search.focus();
    return;
  }
  if (event.key !== "Escape" || event.isComposing) return;
  event.preventDefault();
  if (shell && !shell.suggest.hidden) { hideSuggest(); return; }
  if (state.login) { state.login = null; state.resumeLink = null; render(); return; }
  if (state.report) { state.report = null; render(); return; }
  if (state.selected) { closeDetail(); return; }
  closeAssetStore();
}

function setError(error: unknown, retry: (() => void) | null): void {
  state.error = { failure: storeFailure(error), retry };
}

async function guard<T>(work: () => Promise<T>, retry: (() => void) | null = null): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    setError(error, retry);
    render();
    return null;
  }
}

async function refreshStatus(): Promise<void> {
  const status = await guard(() => storeBridge()!.status());
  if (status) state.status = status;
  if (status?.loggedIn && state.tab === "upload") void refreshMine();
  render();
}

async function refreshInstalled(): Promise<void> {
  const installed = await guard(() => storeBridge()!.installed());
  if (installed) state.installed = installed;
  render();
}

async function refreshMine(): Promise<void> {
  const mine = await guard(() => storeBridge()!.mine());
  state.mine = mine?.items ?? null;
  render();
}

/** 목록 불러오기. reset 이면 첫 쪽부터, 아니면 다음 쪽을 이어 붙인다(끝까지 내리면 자동). 늦게 온 옛 응답은 버린다. */
async function loadCatalog(reset: boolean): Promise<void> {
  if (!reset && (state.loading || state.items.length >= state.total)) return;
  const seq = ++catalogSeq;
  const page = reset ? 1 : state.page + 1;
  state.loading = true;
  if (reset) render();
  else paintMoreState();
  const { q, kind, grade, sort } = state.query;
  try {
    const catalog = await storeBridge()!.catalog({ q: q.trim(), kind, grade, sort, page, lang: getLocale() });
    if (seq !== catalogSeq) return;
    state.items = reset ? catalog.items : [...state.items, ...catalog.items.filter((item) => !state.items.some((old) => old.slug === item.slug))];
    state.total = catalog.total;
    state.page = catalog.page;
    state.pageSize = catalog.pageSize;
    state.loaded = true;
    state.offline = false;
    if (state.error && state.error.retry === retryCatalog) state.error = null;
    for (const item of catalog.items) {
      state.latest.set(item.slug, item.latestVersion);
      state.known.set(item.slug, item);
    }
  } catch (error) {
    if (seq !== catalogSeq) return;
    const failure = storeFailure(error);
    state.offline = failure.status === 0;
    if (!state.offline) state.error = { failure, retry: retryCatalog };
  } finally {
    if (seq === catalogSeq) state.loading = false;
  }
  if (seq === catalogSeq) render();
}
const retryCatalog = (): void => { state.error = null; void loadCatalog(true); };

async function openDetail(slug: string): Promise<void> {
  state.selected = slug;
  state.detail = null;
  state.report = null;
  render();
  const detail = await guard(() => storeBridge()!.item({ slug, lang: getLocale() }), () => void openDetail(slug));
  if (detail && state.selected === slug) {
    state.detail = detail;
    state.latest.set(slug, detail.latestVersion);
  }
  render();
  host?.querySelector<HTMLElement>('[data-testid="store-detail-title"]')?.focus({ preventScroll: true });
}

function closeDetail(): void {
  const slug = state.selected;
  state.selected = null;
  state.detail = null;
  state.report = null;
  render();
  if (slug) host?.querySelector<HTMLElement>(`[data-testid="store-card-${CSS.escape(slug)}"]`)?.focus({ preventScroll: true });
}

function setQuery(patch: Partial<State["query"]>): void {
  Object.assign(state.query, patch);
  state.tab = "browse";
  state.selected = null;
  state.detail = null;
  void loadCatalog(true);
}

/**
 * 한 번 누르면 받기 → 프로젝트에 넣기까지. 큰 파일·버전 바꾸기는 먼저 묻는다.
 * version 을 주면(「에디터에서 열기」 링크) 그 판본을 받는다. fromLink 면 확인 카드가 이미 크기를 보여 줬으니 크기는 다시 묻지 않는다.
 */
async function addToProject(slug: string, title: string, version?: number, fromLink = false): Promise<void> {
  const bridge = storeBridge()!;
  const info = installState(slug);
  const latest = version ?? state.latest.get(slug);
  if (info.inProject !== null && latest !== undefined && latest !== info.inProject && (version !== undefined || latest > info.inProject)
    && !window.confirm(t(`「${title}」을 버전 ${latest}(으)로 바꿔요. 맵에 이미 칠한 타일과 캐릭터는 그대로 남아요. 계속할까요?`))) return;
  const bytes = state.detail?.slug === slug ? versionBytes(state.detail, version) : 0;
  if (!fromLink && !info.installed && bytes > STORE_LARGE_DOWNLOAD_BYTES
    && !window.confirm(t(`「${title}」은 ${formatBytes(bytes)}로 큰 편이에요. 받을까요?`))) return;
  const needInstall = !info.installed || (version !== undefined ? info.installed.version !== version : info.update);
  state.error = null;
  state.busy.set(slug, { label: needInstall ? "받는 중…" : "내 프로젝트에 넣는 중…", done: 0, total: 0 });
  render();
  try {
    if (needInstall) await bridge.install({ slug, ...(version !== undefined ? { version } : {}) });
    const busy = state.busy.get(slug);
    if (busy) { busy.label = "내 프로젝트에 넣는 중…"; busy.done = busy.total = 0; paintProgress(slug); }
    const result = await addStoreItemToProject(slug);
    const project = store.getCurrent();
    state.added.set(slug, {
      title: result.title, snapshot: result.snapshot, tilesetIds: result.tilesetIds, assetIds: result.assetIds,
      staleAssetIds: result.staleAssetIds, lines: landedLines(landedSummary(project, result.assetIds, result.tilesetIds)), undone: false,
    });
    toast(`내 프로젝트에 넣었어요: ${title}`, "ok");
    void refreshInstalled();
  } catch (error) {
    setError(error, () => void addToProject(slug, title, version, fromLink));
  }
  state.busy.delete(slug);
  render();
}

/** 이 컴퓨터에 받아 둔 파일만 지운다(프로젝트에 넣은 것은 그대로). */
async function uninstall(slug: string): Promise<void> {
  if (await guard(() => storeBridge()!.uninstall({ slug }))) await refreshInstalled();
}

async function installOnly(slug: string): Promise<void> {
  state.busy.set(slug, { label: "받는 중…", done: 0, total: 0 });
  render();
  const record = await guard(() => storeBridge()!.install({ slug }), () => void installOnly(slug));
  state.busy.delete(slug);
  if (record) await refreshInstalled(); else render();
}

function undoAdd(slug: string): void {
  const added = state.added.get(slug);
  if (!added) return;
  const result = undoStoreItemAdd(added.title, added.snapshot);
  if (!result.ok) {
    state.error = { failure: { message: `${result.usedBy.join(", ")}에서 쓰고 있어 되돌리지 않았어요.`, status: 0, details: ["그곳에서 먼저 지우거나, 편집기에서 Ctrl+Z 로 그 작업부터 되돌린 뒤 다시 눌러 주세요."] }, retry: null };
    render();
    return;
  }
  added.undone = true;
  toast(`되돌렸어요: ${added.title}`, "ok");
  render();
}

function removeFromProject(slug: string, title: string): void {
  if (!window.confirm(t(`「${title}」을 내 프로젝트에서 빼요. 받아 둔 파일은 남아서 언제든 다시 넣을 수 있어요. 계속할까요?`))) return;
  const result = editStoreItemInProject(`스토어 에셋 빼기: ${title}`, (project) => removeStoreItem(project, slug));
  if (!result.ok) {
    state.error = { failure: { message: `${result.usedBy.join(", ")}에서 쓰고 있어 빼지 않았어요.`, status: 0, details: ["그 맵이나 데이터에서 이 에셋을 먼저 바꾼 뒤 다시 눌러 주세요."] }, retry: null };
  } else {
    state.added.delete(slug);
    toast(`내 프로젝트에서 뺐어요: ${title}`, "ok");
  }
  render();
}

function cleanStale(slug: string, title: string, staleIds: readonly string[]): void {
  const result = editStoreItemInProject(`스토어 옛 버전 정리: ${title}`, (project) => removeStaleStoreAssets(project, staleIds));
  if (!result.ok) state.error = { failure: { message: `${result.usedBy.join(", ")}에서 옛 버전 파일을 쓰고 있어 정리하지 않았어요.`, status: 0, details: [] }, retry: null };
  else toast(`옛 버전에만 있던 파일 ${staleIds.length}개를 정리했어요.`, "ok");
  const added = state.added.get(slug);
  if (added) state.added.set(slug, { ...added, staleAssetIds: [] });
  render();
}

/** 넣은 타일셋으로 새 맵을 만들어 연다 — 팔레트는 지금 맵의 타일셋을 보여 주기 때문이다(그래야 바로 칠해 볼 수 있다). */
function openInPalette(tilesetId: string, title: string): void {
  recordProjectSnapshot("스토어 타일로 새 맵");
  const mapId = addMap(title, 20, 15, tilesetId);
  if (!mapId) return;
  closeAssetStore();
  selectEditorMap(mapId);
  const tools = document.querySelector<HTMLElement>('[data-testid="sidebar-tools"]');
  if (tools && tools.getAttribute("aria-pressed") !== "true") tools.click();
  toast(`「${title}」 타일로 새 맵을 열었어요. 왼쪽 팔레트에서 골라 칠해 보세요.`, "ok");
}

const RESOURCE_KIND_OF: Record<string, ResourceKind> = { charset: "charset", faceset: "faceset", music: "music", sound: "sound", picture: "picture", battle: "battle", battleCharset: "battleCharset", backdrop: "backdrop", monster: "monster" };

function openResources(assetIds: readonly string[]): void {
  const kind = assetIds.map((id) => store.getCurrent().assets.uploaded[id]?.kind ?? "").map((k) => RESOURCE_KIND_OF[k]).find(Boolean);
  closeAssetStore();
  void import("@/editor/panels/resourceModal").then(({ openResourceModal }) => openResourceModal(kind));
}

async function sendReport(): Promise<void> {
  const report = state.report;
  const bridge = storeBridge();
  if (!report || !bridge || !report.reason) return;
  if (typeof bridge.report !== "function") { report.error = "이 버전의 앱은 신고를 보낼 수 없어요. 스토어 웹 페이지에서 신고해 주세요."; render(); return; }
  try {
    await bridge.report({ slug: report.slug, reason: report.reason, detail: report.detail.trim() });
    report.sent = true;
    report.error = "";
  } catch (error) {
    report.error = humanStoreError(storeFailure(error)).title;
  }
  render();
}

async function startLogin(): Promise<void> {
  const started = await guard(() => storeBridge()!.login({}), () => void startLogin());
  if (started) state.login = started;
  render();
}

async function logout(): Promise<void> {
  await guard(() => storeBridge()!.logout());
  state.mine = null;
  await refreshStatus();
}

function switchTab(tab: Tab): void {
  const reload = tab === "browse" && state.tab !== "browse" && !state.loaded;
  state.tab = tab;
  if (reload) void loadCatalog(true);
  if (tab === "upload" && state.status?.loggedIn && state.mine === null) void refreshMine();
  render();
}

async function runFix(action: StoreFixAction): Promise<void> {
  const current = state.error;
  state.error = null;
  switch (action) {
    case "retry": if (current?.retry) current.retry(); else render(); return;
    case "cached": switchTab("installed"); return;
    case "login": void startLogin(); return;
    case "report": if (state.selected) state.report = { slug: state.selected, reason: "broken", detail: current?.failure.message ?? "", sent: false, error: "" }; render(); return;
    case "openProject": {
      const { openProjectFolder } = await import("@/editor/projectFolderActions");
      const opened = await openProjectFolder().catch(() => false);
      if (opened) window.location.reload(); else render();
      return;
    }
    case "dismiss": render(); return;
  }
}

// ── 그리기 ─────────────────────────────────────────────────────────────

const FIX_LABELS: Record<StoreFixAction, string> = {
  retry: "다시 시도", cached: "받아 둔 것 보기", report: "신고하기", openProject: "프로젝트 열기", login: "로그인", dismiss: "닫기",
};

function errorBanner(failure: StoreFailure, retry: (() => void) | null, onFix: (action: StoreFixAction) => void): HTMLElement {
  const human = humanStoreError(failure);
  const actions = human.actions.filter((action) => (action !== "retry" || retry !== null) && (action !== "report" || state.selected !== null));
  return el("div", { class: "store-error", attrs: { role: "alert" }, dataset: { testid: "store-error" }, children: [
    el("strong", { class: "store-error-title", text: human.title }),
    ...(human.hint ? [el("p", { class: "store-error-hint", text: human.hint })] : []),
    ...(failure.details.length > 0 && !human.detail ? [el("ul", { attrs: { translate: "no" }, children: failure.details.slice(0, 8).map((detail) => el("li", { text: detail })) })] : []),
    el("div", { class: "store-error-actions", children: actions.map((action, index) => el("button", {
      class: index === 0 && action !== "dismiss" ? "store-button small" : "store-button ghost small", text: FIX_LABELS[action], attrs: { type: "button" },
      dataset: { testid: `store-error-${action}` }, on: { click: () => onFix(action) },
    })) }),
    ...(human.detail ? [el("details", { class: "store-error-more", children: [el("summary", { text: "자세히" }), el("pre", { attrs: { translate: "no" }, text: human.detail.slice(0, 2000) })] })] : []),
  ] });
}

/** 머리(찾기 칸 포함)는 열 때 한 번만 만든다 — 다시 그리면 한글 입력(IME) 조합이 끊긴다. */
function buildShell(): void {
  const search = el("input", {
    class: "store-search", attrs: { type: "search", placeholder: "무엇을 찾나요? 예: 마을, 숲, 전투 음악", value: state.query.q, "aria-label": "찾기", autocomplete: "off", role: "combobox", "aria-expanded": "false", "aria-controls": "store-suggest", "aria-autocomplete": "list" },
    dataset: { testid: "store-search", focusKey: "search" },
  }) as HTMLInputElement;
  const suggest = el("ul", { class: "store-suggest", attrs: { id: "store-suggest", role: "listbox", "aria-label": "찾기 추천" }, dataset: { testid: "store-suggest" } });
  suggest.hidden = true;
  const clear = el("button", { class: "store-search-clear", text: "×", attrs: { type: "button", "aria-label": "찾는 말 지우기" }, dataset: { testid: "store-search-clear" }, on: { click: () => {
    search.value = "";
    hideSuggest();
    if (state.query.q) setQuery({ q: "" });
    search.focus();
  } } });
  search.addEventListener("input", (event) => {
    if ((event as InputEvent).isComposing) { showSuggest(); return; }
    scheduleSearch();
  });
  search.addEventListener("compositionend", () => scheduleSearch());
  search.addEventListener("focus", () => { if (search.value.trim()) showSuggest(); });
  search.addEventListener("blur", () => setTimeout(hideSuggest, 150));
  search.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    const options = [...suggest.querySelectorAll<HTMLElement>('[role="option"]')];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggest.hidden) showSuggest();
      if (options.length === 0) return;
      event.preventDefault();
      suggestIndex = (suggestIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      paintSuggestActive();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = suggestIndex >= 0 ? options[suggestIndex] : undefined;
      if (chosen) { chosen.click(); return; }
      window.clearTimeout(searchTimer);
      hideSuggest();
      setQuery({ q: search.value });
    }
  });
  const account = el("div", { class: "store-account" });
  const dynamic = el("div", { class: "store-dynamic" });
  const section = el("section", {
    class: "store", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "에셋 스토어" }, dataset: { testid: "store", tab: state.tab },
    children: [
      el("header", { class: "store-head", children: [
        el("h2", { class: "store-title", children: [el("span", { class: "store-mark", attrs: { "aria-hidden": "true" } }), el("span", { class: "store-title-text", children: [el("b", { text: "OPRN", attrs: { translate: "no" } }), el("small", { text: "에셋 스토어" })] })] }),
        el("div", { class: "store-search-wrap", children: [search, clear, suggest] }),
        account,
        el("button", { class: "store-close", text: "닫기", attrs: { type: "button", "aria-label": "스토어 닫기" }, dataset: { testid: "store-close" }, on: { click: closeAssetStore } }),
      ] }),
      dynamic,
    ],
  });
  host!.append(section);
  shell = { section, account, dynamic, search, suggest };
}

function scheduleSearch(): void {
  showSuggest();
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    searchTimer = undefined;
    const q = shell?.search.value ?? "";
    if (q.trim() !== state.query.q.trim()) setQuery({ q });
  }, 280);
}

interface Suggestion { readonly label: string; readonly hint: string; readonly run: () => void }

/** 찾는 말에 맞는 종류·이미 본 상품 이름·태그를 최대 7개. 서버를 다시 부르지 않는다. */
function suggestions(text: string): Suggestion[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const out: Suggestion[] = [];
  for (const category of STORE_HOME_CATEGORIES) {
    const names = [category.label, STORE_KIND_NAMES[category.kind][getLocale()], t(category.label)].map((name) => name.toLowerCase());
    if (names.some((name) => name.includes(q))) out.push({ label: t(category.label), hint: t("종류 전부 보기"), run: () => { if (shell) shell.search.value = ""; setQuery({ q: "", kind: category.kind }); } });
  }
  const tags = new Set<string>();
  for (const item of state.known.values()) {
    if (item.title.toLowerCase().includes(q)) out.push({ label: item.title, hint: t(STORE_KIND_NAMES[item.kind][getLocale()]), run: () => void openDetail(item.slug) });
    for (const tag of item.tags) if (tag.toLowerCase().includes(q)) tags.add(tag);
  }
  for (const tag of tags) out.push({ label: `#${tag}`, hint: t("태그로 찾기"), run: () => { if (shell) shell.search.value = tag; setQuery({ q: tag }); } });
  return out.slice(0, 7);
}

function showSuggest(): void {
  if (!shell) return;
  const list = suggestions(shell.search.value);
  clearChildren(shell.suggest);
  suggestIndex = -1;
  for (const [index, item] of list.entries()) {
    shell.suggest.append(el("li", {
      class: "store-suggest-item", attrs: { role: "option", id: `store-suggest-${index}`, "aria-selected": "false" }, dataset: { testid: "store-suggest-item" },
      children: [el("span", { class: "store-suggest-label", attrs: { translate: "no" }, text: item.label }), el("small", { attrs: { translate: "no" }, text: item.hint })],
      on: { mousedown: (event) => event.preventDefault(), click: () => { hideSuggest(); item.run(); } },
    }));
  }
  shell.suggest.hidden = list.length === 0;
  shell.search.setAttribute("aria-expanded", String(list.length > 0));
}

function hideSuggest(): void {
  if (!shell) return;
  shell.suggest.hidden = true;
  shell.search.setAttribute("aria-expanded", "false");
  shell.search.removeAttribute("aria-activedescendant");
  suggestIndex = -1;
}

function paintSuggestActive(): void {
  if (!shell) return;
  for (const [index, option] of [...shell.suggest.querySelectorAll<HTMLElement>('[role="option"]')].entries()) {
    option.setAttribute("aria-selected", String(index === suggestIndex));
    option.classList.toggle("is-active", index === suggestIndex);
  }
  if (suggestIndex >= 0) shell.search.setAttribute("aria-activedescendant", `store-suggest-${suggestIndex}`);
}

function render(): void {
  if (!host || !shell) return;
  const main = host.querySelector(".store-main");
  const scroll = main?.scrollTop ?? 0;
  const focusedName = document.activeElement instanceof HTMLElement && shell.dynamic.contains(document.activeElement) ? document.activeElement.dataset.focusKey ?? null : null;
  shell.section.dataset.tab = state.tab;
  renderAccount();
  observer?.disconnect();
  observer = null;
  clearChildren(shell.dynamic);
  const detailOpen = state.tab === "browse" && state.selected !== null;
  shell.dynamic.append(
    ...(firstRunVisible() ? [firstRunHint()] : []),
    ...(state.error ? [errorBanner(state.error.failure, state.error.retry, (action) => void runFix(action))] : []),
    el("div", { class: "store-body" + (detailOpen ? " has-detail" : ""), children: [
      sidebar(),
      el("div", { class: "store-main", children: [body()] }),
      ...(detailOpen ? [el("div", { class: "store-detail-scrim", attrs: { "aria-hidden": "true" }, on: { click: closeDetail } }), detailView()] : []),
    ] }),
    footer(),
  );
  const nextMain = host.querySelector(".store-main");
  if (nextMain) nextMain.scrollTop = scroll;
  if (focusedName) host.querySelector<HTMLElement>(`[data-focus-key="${focusedName}"]`)?.focus();
  if (state.login) shell.dynamic.append(loginOverlay(state.login));
  watchMore();
  installDelayedTooltips(host);
}

function renderAccount(): void {
  if (!shell) return;
  const user = state.status?.user;
  clearChildren(shell.account);
  shell.account.append(...(user
    ? [el("span", { class: "store-user", dataset: { testid: "store-user" }, attrs: { translate: "no" }, text: user.displayName }), el("button", { class: "store-link", text: "로그아웃", attrs: { type: "button" }, on: { click: () => void logout() } })]
    : [el("button", { class: "store-button ghost small", text: "로그인", attrs: { type: "button", title: "둘러보기와 넣기는 로그인 없이 돼요. 내 에셋을 나눌 때만 필요해요." }, dataset: { testid: "store-login" }, on: { click: () => void startLogin() } })]));
}

function firstRunVisible(): boolean {
  try { return localStorage.getItem(FIRST_RUN_KEY) !== "1"; } catch { return false; }
}

function firstRunHint(): HTMLElement {
  const done = (): void => { try { localStorage.setItem(FIRST_RUN_KEY, "1"); } catch { /* 저장 못 하면 다음에 또 보인다 */ } render(); };
  return el("div", { class: "store-first-run", attrs: { role: "note" }, dataset: { testid: "store-first-run" }, children: [
    el("ol", { children: [
      el("li", { text: "마음에 드는 것을 누르면 크게 보여요." }),
      el("li", { text: "「내 프로젝트에 넣기」 한 번이면 팔레트·캐릭터 목록에 들어가요." }),
      el("li", { text: "마음이 바뀌면 「되돌리기」로 바로 뺄 수 있어요." }),
    ] }),
    el("button", { class: "store-button ghost small", text: "알겠어요", attrs: { type: "button" }, dataset: { testid: "store-first-run-close" }, on: { click: done } }),
  ] });
}

function sidebar(): HTMLElement {
  const tabCount = (tab: Tab): string => tab === "installed" && state.installed.length > 0 ? String(state.installed.length)
    : tab === "project" ? String(storeItemsInProject(store.getCurrent()).length || "") : "";
  const tabs = el("nav", { class: "store-tabs", attrs: { role: "tablist", "aria-label": "스토어 화면" }, children: (Object.keys(TAB_LABELS) as Tab[]).map((tab) => el("button", {
    class: "store-tab" + (tab === state.tab ? " is-active" : ""), attrs: { type: "button", role: "tab", "aria-selected": String(tab === state.tab) },
    dataset: { testid: `store-tab-${tab}`, tab },
    children: [el("span", { class: `store-tab-icon is-${tab}`, attrs: { "aria-hidden": "true" } }), el("span", { class: "store-tab-label", text: TAB_LABELS[tab] }), el("span", { class: "store-tab-count", text: tabCount(tab) })],
    on: { click: () => switchTab(tab) },
  })) });
  if (state.tab !== "browse") return el("aside", { class: "store-side", children: [tabs] });
  const kindRow = (label: string, active: boolean, onClick: () => void, testid?: string) => el("button", {
    class: "store-side-row" + (active ? " is-on" : ""), text: label, attrs: { type: "button", "aria-pressed": String(active) }, ...(testid ? { dataset: { testid } } : {}),
    on: { click: onClick },
  });
  const packOn = state.query.grade === "pack";
  return el("aside", { class: "store-side", children: [
    tabs,
    el("h3", { class: "store-side-head", text: "종류" }),
    el("div", { class: "store-side-list", children: [
      kindRow("모든 종류", !state.query.kind, () => setQuery({ kind: "" })),
      ...STORE_ITEM_KINDS.map((kind) => kindRow(kindName(kind), state.query.kind === kind, () => setQuery({ kind }), `store-kind-${kind}`)),
    ] }),
    el("h3", { class: "store-side-head", text: "거르기" }),
    el("button", {
      class: "store-toggle" + (packOn ? " is-on" : ""), attrs: { type: "button", "aria-pressed": String(packOn), title: PACK_TITLE }, dataset: { testid: "store-filter-pack" },
      children: [el("span", { class: "store-knob", attrs: { "aria-hidden": "true" } }), el("span", { text: "조수가 바로 쓰는 것만" })],
      on: { click: () => setQuery({ grade: packOn ? "" : "pack" }) },
    }),
  ] });
}

function footer(): HTMLElement {
  const url = state.status?.url ?? "";
  if (state.urlEditing) {
    const input = el("input", { class: "store-url-input", attrs: { value: url, "aria-label": "스토어 주소" }, dataset: { testid: "store-url-input" } }) as HTMLInputElement;
    return el("footer", { class: "store-foot", children: [
      el("span", { text: "스토어 주소(팀·학교 스토어를 쓸 때만 바꾸세요):" }), input,
      el("button", { class: "store-button small", text: "저장", attrs: { type: "button" }, on: { click: async () => {
        const status = await guard(() => storeBridge()!.setUrl({ url: input.value.trim() }));
        if (status) { state.status = status; state.urlEditing = false; state.items = []; state.known.clear(); state.installed = []; void loadCatalog(true); void refreshInstalled(); }
        render();
      } } }),
      el("button", { class: "store-link", text: "취소", attrs: { type: "button" }, on: { click: () => { state.urlEditing = false; render(); } } })] });
  }
  return el("footer", { class: "store-foot", children: [
    el("span", { text: "모든 에셋은 무료예요. 크레딧은 게임에 자동으로 들어가요." }),
    el("button", { class: "store-link store-foot-advanced", text: "스토어 주소 바꾸기", attrs: { type: "button", title: url }, dataset: { testid: "store-url-edit" }, on: { click: () => { state.urlEditing = true; render(); } } }),
  ] });
}

function body(): HTMLElement {
  switch (state.tab) {
    case "browse": return browseView();
    case "installed": return installedView();
    case "project": return projectView();
    case "upload": return shareView(shareHost);
  }
}

const shareHost: ShareHost = {
  render: () => render(),
  status: () => state.status,
  mine: () => state.mine,
  startLogin: () => void startLogin(),
  refreshMine: () => void refreshMine(),
  openItem: (slug) => { state.tab = "browse"; resetShare(); void openDetail(slug); },
  errorBanner: (failure, retry) => errorBanner(failure, retry, (action) => { if (action === "retry" && retry) retry(); else if (action === "login") void startLogin(); else render(); }),
};

const PACK_TITLE = "깔기 안내(참고문서)가 들어 있어 조수가 이 타일로 바로 맵을 칠해요";
const DRAFT_LABEL = "초안 · 나만 보임 · 공유 안 됨";
const DRAFT_TITLE = "스토어 확인을 기다리는 내 에셋이에요. 내 편집기에서만 쓸 수 있고, 다른 사람에게는 보이지 않아요.";

/** 주인 초안(D2) 표시. 받은 기록(draft)이나 상품 상세(status pending)로 정한다. */
function draftBadge(): HTMLElement {
  return el("span", { class: "store-badge draft", text: DRAFT_LABEL, attrs: { title: DRAFT_TITLE }, dataset: { testid: "store-draft-badge" } });
}

/** 그 판본의 크기(바이트). 판본을 안 주면 최신. 모르면 0. */
function versionBytes(detail: StoreItemDetail, version?: number): number {
  const entry = version === undefined ? detail.versions[0] : detail.versions.find((item) => item.version === version);
  return entry?.bytes ?? 0;
}

/** 「에디터에서 열기」 링크 확인 카드. 단추 하나로 기존 넣기 경로(받기 → 넣기)를 탄다. 조용히 넣지 않는다. */
function linkConfirmCard(detail: StoreItemDetail, request: StoreOpenLinkRequest): HTMLElement {
  const version = request.version ?? detail.latestVersion;
  const known = detail.versions.length === 0 || detail.versions.some((item) => item.version === version);
  const dismiss = (): void => { state.linkRequest = null; render(); };
  if (!known) {
    return el("div", { class: "store-link-confirm", attrs: { role: "alert" }, dataset: { testid: "store-link-confirm", state: "missing" }, children: [
      el("strong", { text: `링크의 버전 ${version}을(를) 스토어에서 찾지 못했어요.` }),
      el("div", { class: "store-actions", children: [el("button", { class: "store-button ghost small", text: "닫기", attrs: { type: "button" }, on: { click: dismiss } })] }),
    ] });
  }
  const bytes = versionBytes(detail, request.version);
  return el("div", { class: "store-link-confirm", attrs: { role: "group", "aria-label": "스토어 링크" }, dataset: { testid: "store-link-confirm", state: "ask" }, children: [
    el("strong", { attrs: DATA, text: t(`스토어에서 「${detail.title}」 v${version} 을 받아 이 프로젝트에 넣을까요?`) }),
    ...(bytes > 0 ? [el("p", { class: "store-hint", text: `크기 ${formatBytes(bytes)}` })] : []),
    ...(detail.status === "pending" ? [el("p", { class: "store-hint", children: [draftBadge(), " ", "내 편집기에서만 쓰고, 다시 올리거나 나눌 수 없어요."] })] : []),
    el("div", { class: "store-actions", children: [
      el("button", { class: "store-button", text: "받아서 넣기", attrs: { type: "button" }, dataset: { testid: "store-link-add" }, on: { click: () => {
        state.linkRequest = null;
        void addToProject(detail.slug, detail.title, request.version, true);
      } } }),
      el("button", { class: "store-link", text: "취소", attrs: { type: "button" }, dataset: { testid: "store-link-cancel" }, on: { click: dismiss } }),
    ] }),
  ] });
}

function badges(item: Pick<StoreItemSummary, "grade" | "aiGenerated">): HTMLElement {
  return el("span", { class: "store-badges", children: [
    ...(item.grade === "pack" ? [el("span", { class: "store-badge pack", text: "조수 사용 가능", attrs: { title: PACK_TITLE } })] : []),
    ...(item.aiGenerated ? [el("span", { class: "store-badge ai", text: "AI 생성" })] : []),
  ] });
}

/** 종류 이름은 공용 표에서 화면 언어로 고른다(번역 카탈로그의 짧은 낱말 「음악」=Audio 같은 다른 뜻을 피한다). */
const kindName = (kind: StoreItemKind): string => STORE_KIND_NAMES[kind][getLocale()];

/** 받기 수가 0인 상품에 「받기 0」을 붙이면 인기 없는 물건처럼 보인다 — 새 상품이라고 쓴다. */
const downloadsText = (downloads: number) => downloads > 0 ? `받기 ${downloads}` : "새로 올라옴";

/** 서버가 고른 언어로 온 상품 글(제목·소개·작가)은 데이터다 — 편집기 번역기가 다시 손대지 않게 한다. */
const DATA = { translate: "no" } as const;

function cover(sha: string | null, kind: string, alt: string): HTMLElement {
  if (!sha) return el("span", { class: "store-cover-icon" + (kind === "music" || kind === "sound" ? " is-sound" : ""), attrs: { "aria-hidden": "true" } });
  return fillStoreImage(el("img", { attrs: { alt, loading: "lazy", decoding: "async" } }) as HTMLImageElement, sha);
}

function installState(slug: string): { installed: InstalledStoreItem | null; inProject: number | null; update: boolean } {
  const installed = state.installed.find((item) => item.slug === slug) ?? null;
  const inProject = storeItemsInProject(store.getCurrent()).find((item) => item.slug === slug)?.version ?? null;
  const latest = state.latest.get(slug);
  return { installed, inProject, update: installed !== null && latest !== undefined && latest > installed.version };
}

function browseView(): HTMLElement {
  const items = state.items;
  const home = !state.query.q.trim() && !state.query.kind && !state.query.grade;
  if (state.offline && items.length === 0) return offlineView();
  const featured = home ? items.find((item) => item.grade === "pack" && item.cover) ?? null : null;
  const heading = state.query.q.trim()
    ? `「${state.query.q.trim()}」 결과`
    : state.query.kind && (STORE_ITEM_KINDS as readonly string[]).includes(state.query.kind)
      ? kindName(state.query.kind as StoreItemKind)
      : state.query.sort === "popular" ? "인기 에셋" : "최신 에셋";
  const sortChip = (label: string, active: boolean, sort: "" | "popular") => el("button", {
    class: "store-chip" + (active ? " is-on" : ""), text: label, attrs: { type: "button", "aria-pressed": String(active) }, dataset: { testid: `store-sort-${sort || "new"}` }, on: { click: () => setQuery({ sort }) },
  });
  const grid = items.length > 0
    ? el("div", { class: "store-grid", dataset: { testid: "store-grid" }, children: items.map(card) })
    : state.loading || !state.loaded
      ? el("div", { class: "store-grid is-loading", attrs: { "aria-busy": "true", "aria-label": "불러오는 중" }, dataset: { testid: "store-loading" }, children: Array.from({ length: 8 }, () => el("span", { class: "store-card is-skeleton", attrs: { "aria-hidden": "true" } })) })
      : emptyResults();
  return el("div", { class: "store-browse", children: [
    ...(home ? [categoryTiles()] : []),
    ...(featured ? [hero(featured)] : []),
    el("div", { class: "store-results-head", children: [
      el("div", { children: [el("h3", { text: heading, attrs: state.query.q.trim() ? DATA : {} }), el("p", { class: "store-hint", text: `에셋 ${state.total}개` })] }),
      el("div", { class: "store-chips", children: [sortChip("인기", state.query.sort === "popular", "popular"), sortChip("최신", state.query.sort === "", "")] }),
    ] }),
    grid,
    ...(items.length > 0 && items.length < state.total ? [el("div", { class: "store-more", dataset: { testid: "store-more" }, children: [
      el("button", { class: "store-button ghost small", text: state.loading ? "불러오는 중…" : "더 보기", attrs: { type: "button", ...(state.loading ? { disabled: "" } : {}) }, on: { click: () => void loadCatalog(false) } }),
    ] })] : []),
  ] });
}

function emptyResults(): HTMLElement {
  const q = state.query.q.trim();
  return el("div", { class: "store-empty-card", dataset: { testid: "store-empty" }, children: [
    el("strong", { text: q ? "찾는 에셋이 없어요" : "아직 여기에 올라온 에셋이 없어요" }),
    el("p", { text: q ? "다른 낱말로 찾거나, 아래 종류에서 골라 보세요." : "다른 종류를 둘러보세요." }),
    el("div", { class: "store-actions", children: [
      ...(q || state.query.kind || state.query.grade ? [el("button", { class: "store-button small", text: "처음 화면으로", attrs: { type: "button" }, dataset: { testid: "store-empty-reset" }, on: { click: () => { if (shell) shell.search.value = ""; setQuery({ q: "", kind: "", grade: "" }); } } })] : []),
    ] }),
  ] });
}

function offlineView(): HTMLElement {
  const cached = state.installed.length;
  return el("div", { class: "store-empty-card store-offline", attrs: { role: "status" }, dataset: { testid: "store-offline" }, children: [
    el("strong", { text: "스토어에 연결할 수 없어요" }),
    el("p", { text: "인터넷 연결을 확인한 뒤 다시 시도해 주세요." }),
    el("p", { text: cached > 0 ? `받아 둔 에셋 ${cached}개는 인터넷 없이도 내 프로젝트에 넣을 수 있어요.` : "인터넷이 연결되면 에셋을 받아 둘 수 있어요. 받아 둔 것은 인터넷 없이도 넣을 수 있어요." }),
    el("div", { class: "store-actions", children: [
      el("button", { class: "store-button", text: state.loading ? "연결하는 중…" : "다시 시도", attrs: { type: "button", ...(state.loading ? { disabled: "" } : {}) }, dataset: { testid: "store-retry" }, on: { click: () => void loadCatalog(true) } }),
      ...(cached > 0 ? [el("button", { class: "store-button ghost", text: `받아 둔 것 보기 (${cached})`, attrs: { type: "button" }, dataset: { testid: "store-offline-cached" }, on: { click: () => switchTab("installed") } })] : []),
    ] }),
  ] });
}

/** 첫 화면 큰 칸 — 처음 온 사람이 아는 낱말로 고른다. */
function categoryTiles(): HTMLElement {
  return el("nav", { class: "store-categories", attrs: { "aria-label": "무엇을 찾나요" }, dataset: { testid: "store-categories" }, children: STORE_HOME_CATEGORIES.map((category) => el("button", {
    class: `store-category is-${category.kind}`, attrs: { type: "button" }, dataset: { testid: `store-category-${category.kind}` },
    on: { click: () => setQuery({ kind: category.kind }) },
    children: [el("span", { class: "store-category-icon", attrs: { "aria-hidden": "true" } }), el("strong", { text: category.label }), el("small", { text: category.hint })],
  })) });
}

/** 첫 화면 진열: 조수가 바로 쓰는 팩 하나를 크게. */
function hero(item: StoreItemSummary): HTMLElement {
  return el("button", { class: "store-hero", attrs: { type: "button" }, dataset: { testid: "store-hero", slug: item.slug }, on: { click: () => void openDetail(item.slug) }, children: [
    el("span", { class: "store-hero-art", children: [cover(item.cover, item.kind, item.title)] }),
    el("span", { class: "store-hero-copy", children: [
      el("span", { class: "store-kind", text: `추천 · ${kindName(item.kind)}` }),
      el("strong", { class: "store-hero-title", attrs: DATA, text: item.title }),
      el("span", { class: "store-summary", attrs: DATA, text: item.summary }),
      badges(item),
      el("span", { class: "store-hero-cta", children: [el("span", { class: "store-button", text: "자세히 보기" }), el("span", { class: "store-price", text: "무료" })] }),
    ] }),
  ] });
}

function card(item: StoreItemSummary): HTMLElement {
  const info = installState(item.slug);
  const tag = info.update ? "새 버전 있음" : info.inProject !== null ? "프로젝트에 있음" : info.installed ? "받아 둠" : null;
  return el("button", {
    class: "store-card" + (state.selected === item.slug ? " is-selected" : ""), attrs: { type: "button", "aria-haspopup": "dialog" },
    dataset: { testid: `store-card-${item.slug}`, slug: item.slug },
    on: { click: () => void openDetail(item.slug) },
    children: [
      el("span", { class: "store-cover", children: [
        cover(item.cover, item.kind, item.title),
        ...(item.grade === "pack" ? [el("span", { class: "store-badge pack on-cover", text: "조수 사용 가능", attrs: { title: PACK_TITLE } })] : []),
        ...(tag ? [el("span", { class: "store-card-state", text: tag })] : []),
      ] }),
      el("span", { class: "store-card-body", children: [
        el("strong", { class: "store-card-title", attrs: DATA, text: item.title }),
        el("span", { class: "store-card-kind", children: [el("span", { attrs: DATA, text: item.author }), kindName(item.kind), ...(item.aiGenerated ? [el("span", { class: "store-card-ai", text: "AI 생성" })] : [])] }),
        el("span", { class: "store-card-foot", children: [el("span", { class: "store-price", text: "무료" }), el("span", { text: downloadsText(item.downloads) })] }),
      ] }),
    ],
  });
}

function progressBar(slug: string, busy: Busy): HTMLElement {
  const pct = busy.total > 0 ? Math.min(100, Math.round((busy.done / busy.total) * 100)) : null;
  return el("div", { class: "store-progress", attrs: { role: "progressbar", "aria-label": busy.label, ...(pct !== null ? { "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" } : {}) }, dataset: { progress: slug, testid: "store-progress" }, children: [
    el("span", { class: "store-progress-label", text: busy.label }),
    el("span", { class: "store-progress-track", children: [el("span", { class: "store-progress-fill" + (pct === null ? " is-indeterminate" : ""), attrs: { style: `width: ${pct ?? 40}%` } })] }),
  ] });
}

/** 진행 막대만 고친다(전체 다시 그리기 없이 — 받는 동안 목록이 깜빡이지 않게). */
function paintProgress(slug: string): void {
  const busy = state.busy.get(slug);
  const bar = host?.querySelector<HTMLElement>(`[data-progress="${CSS.escape(slug)}"]`);
  if (!busy || !bar) return;
  bar.replaceWith(progressBar(slug, busy));
}

function paintMoreState(): void {
  const button = host?.querySelector<HTMLButtonElement>('[data-testid="store-more"] button');
  if (button) { button.disabled = state.loading; button.textContent = t(state.loading ? "불러오는 중…" : "더 보기"); }
}

/** 목록 끝이 보이면 다음 쪽을 불러온다(큰 목록을 한 번에 그리지 않는다). */
function watchMore(): void {
  const sentinel = host?.querySelector<HTMLElement>('[data-testid="store-more"]');
  const root = host?.querySelector<HTMLElement>(".store-main");
  if (!sentinel || !root || typeof IntersectionObserver === "undefined") return;
  observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) void loadCatalog(false); }, { root, rootMargin: "320px" });
  observer.observe(sentinel);
}

function actionButtons(slug: string, title: string): HTMLElement {
  const info = installState(slug);
  const busy = state.busy.get(slug);
  if (busy) return el("div", { class: "store-actions", children: [progressBar(slug, busy)] });
  const latest = state.latest.get(slug);
  const current = info.inProject !== null && (latest === undefined || latest <= info.inProject);
  const upgrade = info.inProject !== null && !current;
  return el("div", { class: "store-actions", children: [
    current
      ? el("span", { class: "store-in-project", dataset: { testid: "store-in-project" }, text: "✓ 내 프로젝트에 들어 있어요" })
      : el("button", {
        class: "store-button big", attrs: { type: "button" }, dataset: { testid: "store-add" },
        text: upgrade ? `새 버전 ${latest}(으)로 바꾸기` : "내 프로젝트에 넣기",
        on: { click: () => void addToProject(slug, title) },
      }),
    ...(!info.installed && !current ? [el("button", { class: "store-link", text: "받아 두기만", attrs: { type: "button", title: "인터넷이 없을 때 넣으려고 이 컴퓨터에만 받아 둬요" }, dataset: { testid: "store-install" }, on: { click: () => void installOnly(slug) } })] : []),
  ] });
}

function addedPanel(slug: string, added: Added): HTMLElement {
  if (added.undone) {
    return el("div", { class: "store-added is-undone", attrs: { role: "status" }, dataset: { testid: "store-added-panel", state: "undone" }, children: [
      el("strong", { text: "되돌렸어요. 내 프로젝트에서 뺐어요." }),
      el("div", { class: "store-actions", children: [el("button", { class: "store-button small", text: "다시 넣기", attrs: { type: "button" }, dataset: { testid: "store-readd" }, on: { click: () => { state.added.delete(slug); void addToProject(slug, added.title); } } })] }),
    ] });
  }
  const firstTileset = added.tilesetIds[0];
  const otherAssets = added.assetIds.filter((id) => !added.tilesetIds.some((tid) => store.getCurrent().tilesets[tid]?.image.type === "uploaded" && store.getCurrent().tilesets[tid]?.image.id === id));
  return el("div", { class: "store-added", attrs: { role: "status" }, dataset: { testid: "store-added-panel", state: "added" }, children: [
    el("strong", { text: "✓ 들어갔어요" }),
    el("ul", { class: "store-landed", children: added.lines.map((line) => el("li", { text: line })) }),
    el("div", { class: "store-actions", children: [
      ...(firstTileset ? [el("button", { class: "store-button small", text: "새 맵에서 칠해 보기", attrs: { type: "button" }, dataset: { testid: "store-open-palette" }, on: { click: () => openInPalette(firstTileset, added.title) } })] : []),
      ...(otherAssets.length > 0 ? [el("button", { class: "store-button ghost small", text: "리소스 목록에서 보기", attrs: { type: "button" }, dataset: { testid: "store-open-resources" }, on: { click: () => openResources(otherAssets) } })] : []),
      el("button", { class: "store-button ghost small", text: "되돌리기", attrs: { type: "button" }, dataset: { testid: "store-undo" }, on: { click: () => undoAdd(slug) } }),
    ] }),
    ...(added.staleAssetIds.length > 0 ? [el("p", { class: "store-hint", children: [
      `옛 버전에만 있던 파일 ${added.staleAssetIds.length}개가 남아 있어요. `,
      el("button", { class: "store-link", text: "정리하기", attrs: { type: "button" }, dataset: { testid: "store-cleanup-stale" }, on: { click: () => cleanStale(slug, added.title, added.staleAssetIds) } }),
    ] })] : []),
  ] });
}

const REPORT_LABELS: Record<StoreReportReason, string> = {
  copyright: "남의 작품을 허락 없이 올렸어요",
  inappropriate: "보기 불편하거나 부적절해요",
  broken: "받거나 넣으면 깨져요",
  spam: "광고·도배예요",
  other: "그 밖의 문제",
};

function reportView(report: ReportForm): HTMLElement {
  if (report.sent) return el("div", { class: "store-report", attrs: { role: "status" }, dataset: { testid: "store-report-sent" }, children: [el("strong", { text: "신고했어요. 운영자가 확인할게요. 고마워요." })] });
  return el("form", { class: "store-report store-form", dataset: { testid: "store-report-form" }, on: { submit: (event) => { event.preventDefault(); void sendReport(); } }, children: [
    el("fieldset", { children: [el("legend", { text: "무엇이 문제인가요?" }), ...STORE_REPORT_REASONS.map((reason) => el("label", { class: "store-radio", children: [
      el("input", { attrs: { type: "radio", name: "store-report-reason", ...(report.reason === reason ? { checked: "" } : {}) }, dataset: { testid: `store-report-${reason}` }, on: { change: () => { report.reason = reason; } } }), REPORT_LABELS[reason],
    ] }))] }),
    el("label", { children: ["더 알려 줄 것 (선택)", el("textarea", { attrs: { rows: "2", maxlength: "2000" }, text: report.detail, dataset: { focusKey: "report-detail" }, on: { input: (event) => { report.detail = (event.target as HTMLTextAreaElement).value; } } })] }),
    ...(report.error ? [el("p", { class: "store-problems", attrs: { role: "alert" }, text: report.error })] : []),
    el("div", { class: "store-actions", children: [
      el("button", { class: "store-button small", text: "신고 보내기", attrs: { type: "submit" }, dataset: { testid: "store-report-send" } }),
      el("button", { class: "store-link", text: "취소", attrs: { type: "button" }, on: { click: () => { state.report = null; render(); } } }),
    ] }),
  ] });
}

function detailView(): HTMLElement {
  const detail = state.detail;
  const close = el("button", { class: "store-detail-close", text: "닫기", attrs: { type: "button", "aria-label": "상품 닫기" }, dataset: { testid: "store-detail-close" }, on: { click: closeDetail } });
  if (!detail) return el("aside", { class: "store-detail", attrs: { "aria-busy": "true" }, dataset: { testid: "store-detail" }, children: [close, el("div", { class: "store-gallery-main is-skeleton" }), el("p", { class: "store-hint", text: "불러오는 중…" })] });
  const info = installState(detail.slug);
  const previews = detail.previews;
  const main = el("figure", { class: "store-gallery-main", dataset: { testid: "store-gallery-main" } });
  const showPreview = (index: number) => {
    clearChildren(main);
    main.append(previews.length > 0
      ? fillStoreImage(el("img", { attrs: { alt: t(`${detail.title} 미리보기 ${index + 1}`), decoding: "async" } }) as HTMLImageElement, previews[index] ?? null)
      : cover(null, detail.kind, detail.title));
    for (const [i, thumb] of [...thumbs.children].entries()) thumb.classList.toggle("is-on", i === index);
  };
  const thumbs = el("div", { class: "store-gallery-thumbs", children: previews.length > 1 ? previews.map((sha, index) => el("button", {
    class: "store-gallery-thumb", attrs: { type: "button", "aria-label": `미리보기 ${index + 1}` }, on: { click: () => showPreview(index) },
    children: [fillStoreImage(el("img", { attrs: { alt: "" } }) as HTMLImageElement, sha)],
  })) : [] });
  showPreview(0);
  const version = detail.versions[0];
  const added = state.added.get(detail.slug);
  const license: StoreLicense = detail.license;
  return el("aside", { class: "store-detail", attrs: { role: "region", "aria-label": "상품 자세히" }, dataset: { testid: "store-detail", slug: detail.slug }, children: [
    close,
    el("div", { class: "store-gallery", children: [main, thumbs] }),
    el("p", { class: "store-kind", text: kindName(detail.kind) }),
    el("h3", { class: "store-detail-title", attrs: { ...DATA, tabindex: "-1" }, dataset: { testid: "store-detail-title" }, text: detail.title }),
    el("p", { class: "store-by", children: [
      el("span", { attrs: DATA, text: detail.author }),
      el("span", { class: "store-provenance", attrs: { title: "스토어 운영자가 검토해 올렸어요. 그림의 권리는 올린 사람이 책임져요." }, dataset: { testid: "store-provenance" }, text: "커뮤니티 작품" }),
      el("span", { text: downloadsText(detail.downloads) }),
    ] }),
    badges(detail),
    ...(detail.status === "pending" || info.installed?.draft === true ? [draftBadge()] : []),
    el("p", { class: "store-summary", attrs: DATA, text: detail.summary }),
    el("div", { class: "store-get", children: [
      el("p", { class: "store-contents", dataset: { testid: "store-contents" }, text: contentsSentence(detail.kind, detail.counts) }),
      ...(state.linkRequest?.slug === detail.slug && !state.busy.has(detail.slug) ? [linkConfirmCard(detail, state.linkRequest)] : []),
      actionButtons(detail.slug, detail.title),
      ...(added ? [addedPanel(detail.slug, added)] : info.inProject !== null ? [projectNote(detail.slug, detail.title)] : []),
    ] }),
    el("dl", { class: "store-facts", children: [
      el("div", { children: [el("dt", { text: "쓰는 조건" }), el("dd", { dataset: { testid: "store-license-sentence" }, children: [licenseSentence(license, detail.author), el("small", { class: "store-license-pill", attrs: { translate: "no" }, text: STORE_LICENSE_SHORT[license] })] })] }),
      ...(detail.credits ? [el("div", { children: [el("dt", { text: "크레딧" }), el("dd", { children: [el("span", { class: "store-pre", attrs: DATA, text: detail.credits }), el("small", { text: "게임의 「크레딧」 창에 자동으로 들어가요." })] })] })] : []),
      ...(version ? [el("div", { children: [el("dt", { text: "크기" }), el("dd", { dataset: { testid: "store-size" }, text: formatBytes(version.bytes) })] })] : []),
      el("div", { children: [el("dt", { text: "버전" }), el("dd", { text: version ? `버전 ${detail.latestVersion} · ${new Date(version.createdAt).toLocaleDateString(getLocale())}` : `버전 ${detail.latestVersion}` })] }),
    ] }),
    ...(detail.description ? [el("h4", { text: "설명" }), el("p", { class: "store-pre", attrs: DATA, text: detail.description })] : []),
    state.report?.slug === detail.slug
      ? reportView(state.report)
      : el("button", { class: "store-link store-report-open", text: "이 에셋 신고하기", attrs: { type: "button" }, dataset: { testid: "store-report" }, on: { click: () => { state.report = { slug: detail.slug, reason: "", detail: "", sent: false, error: "" }; render(); } } }),
  ] });
}

/** 지난번 창에서 넣은 것(되돌리기 기록 없음): 빼기만 제공한다. */
function projectNote(slug: string, title: string): HTMLElement {
  return el("div", { class: "store-added", dataset: { testid: "store-added-panel", state: "existing" }, children: [
    el("p", { class: "store-hint", text: "이 에셋은 이미 내 프로젝트에 있어요." }),
    el("div", { class: "store-actions", children: [el("button", { class: "store-button ghost small", text: "내 프로젝트에서 빼기", attrs: { type: "button" }, dataset: { testid: "store-remove" }, on: { click: () => removeFromProject(slug, title) } })] }),
  ] });
}

/** 받은 기록·프로젝트 기록에는 원문 제목이 남는다. 지금 목록에 그 상품이 있으면 화면 언어판 제목을 쓴다. */
const localTitle = (slug: string, title: string): string => state.known.get(slug)?.title ?? title;

function installedView(): HTMLElement {
  const lead = el("p", { class: "store-hint", text: "이 컴퓨터에 받아 둔 에셋이에요. 인터넷이 없어도 어느 프로젝트에나 넣을 수 있어요." });
  if (state.installed.length === 0) return el("div", { class: "store-empty-card", dataset: { testid: "store-installed-empty" }, children: [
    el("strong", { text: "아직 받아 둔 것이 없어요" }),
    el("p", { text: "둘러보기에서 「내 프로젝트에 넣기」를 누르면 여기에도 남아요." }),
    el("button", { class: "store-button small", text: "둘러보기", attrs: { type: "button" }, on: { click: () => switchTab("browse") } }),
  ] });
  return el("div", { class: "store-rows-wrap", children: [lead, el("div", { class: "store-rows", dataset: { testid: "store-installed" }, children: state.installed.map((item) => {
    const info = installState(item.slug);
    const title = localTitle(item.slug, item.title);
    return el("div", { class: "store-row", dataset: { testid: `store-installed-${item.slug}` }, children: [
      el("span", { class: "store-cover small", children: [cover(item.cover, item.kind, item.title)] }),
      el("span", { class: "store-row-body", children: [
        el("strong", { attrs: DATA, text: title }),
        ...(item.draft === true ? [draftBadge()] : []),
        el("span", { class: "store-card-meta", children: [el("span", { attrs: DATA, text: item.author }), ` · 버전 ${item.version}`, ...(info.update ? [` · 새 버전 ${state.latest.get(item.slug)} 있음`] : []), ...(info.inProject !== null ? [" · 내 프로젝트에 있음"] : [])] }),
      ] }),
      actionButtons(item.slug, title),
      el("button", { class: "store-link", text: "이 컴퓨터에서 지우기", attrs: { type: "button" }, dataset: { testid: "store-uninstall" }, on: { click: () => void uninstall(item.slug) } }),
    ] });
  }) })] });
}

function projectView(): HTMLElement {
  const project = store.getCurrent();
  const items = storeItemsInProject(project);
  if (items.length === 0) return el("div", { class: "store-empty-card", dataset: { testid: "store-project-empty" }, children: [
    el("strong", { text: "내 프로젝트에 넣은 스토어 에셋이 아직 없어요" }),
    el("button", { class: "store-button small", text: "둘러보기", attrs: { type: "button" }, on: { click: () => switchTab("browse") } }),
  ] });
  return el("div", { class: "store-project", children: [
    el("div", { class: "store-rows", dataset: { testid: "store-project-items" }, children: items.map((item) => {
      const stale = item.assetIds.filter((id) => project.assets.uploaded[id]?.origin?.version !== item.version);
      const title = localTitle(item.slug, item.title);
      return el("div", { class: "store-row", dataset: { testid: `store-project-${item.slug}` }, children: [
        el("span", { class: "store-row-body", children: [
          el("strong", { attrs: DATA, text: title }),
          ...(state.installed.some((installed) => installed.slug === item.slug && installed.draft === true) ? [draftBadge()] : []),
          el("span", { class: "store-card-meta", children: [el("span", { attrs: DATA, text: item.origin.author }), ` · 버전 ${item.version} · ${STORE_LICENSE_SHORT[item.origin.license]}`, ...(item.origin.aiGenerated ? [" · AI 생성 포함"] : [])] }),
          ...(stale.length > 0 ? [el("span", { class: "store-card-meta", children: [`옛 버전에만 있던 파일 ${stale.length}개 `, el("button", { class: "store-link", text: "정리하기", attrs: { type: "button" }, dataset: { testid: `store-project-cleanup-${item.slug}` }, on: { click: () => cleanStale(item.slug, title, stale) } })] })] : []),
        ] }),
        el("button", { class: "store-button ghost small", text: "빼기", attrs: { type: "button" }, dataset: { testid: `store-project-remove-${item.slug}` }, on: { click: () => removeFromProject(item.slug, title) } }),
      ] });
    }) }),
    el("h4", { text: "게임 크레딧에 이렇게 들어가요" }),
    el("pre", { class: "store-credits", dataset: { testid: "store-credits" }, text: storeCredits(project) }),
    el("p", { class: "store-hint", text: "타이틀 메뉴 「크레딧」 창에 기본 저작자 표기 뒤로 붙어요. 에셋을 빼면 여기서도 빠져요." }),
  ] });
}

function loginOverlay(login: StoreLoginStart): HTMLElement {
  return el("div", { class: "store-login-overlay", dataset: { testid: "store-login-panel" }, children: [el("div", { class: "store-login-box", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "로그인" }, children: [
    el("h3", { text: "브라우저에서 로그인을 허락하세요" }),
    el("p", { text: "브라우저가 열렸어요. 스토어에 로그인한 뒤, 아래 글자가 브라우저 화면과 같은지 보고 「허락」을 누르세요." }),
    el("p", { class: "store-user-code", dataset: { testid: "store-login-code" }, attrs: { translate: "no" }, text: login.userCode }),
    el("p", { class: "store-hint", text: `브라우저가 안 열렸으면: ${login.verificationUri} 에서 코드 입력` }),
    el("button", { class: "store-button ghost", text: "취소", attrs: { type: "button" }, on: { click: () => { state.login = null; render(); } } }),
  ] })] });
}
