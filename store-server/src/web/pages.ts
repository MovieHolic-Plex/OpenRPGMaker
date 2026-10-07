import { createHmac, timingSafeEqual } from "node:crypto";
import {
  STORE_FIXED_SHEETS, STORE_ITEM_KINDS, STORE_LICENSES, STORE_TILE_SIZE,
  type StoreItemDetail, type StoreItemKind, type StoreItemStatus, type StoreItemSummary, type StoreLicense,
} from "../../../src/assetStore/format";
import type { Auth } from "../auth";
import type { StoreConfig } from "../config";
import { esc } from "../http";
import type { CatalogQuery } from "../items";
import {
  DOCS, HTML_LANG, LANG_NAMES, LANGS, docTitle, formatDate, kindLabel, licenseLabel, licenseShort, translator,
  type Lang, type MessageKey, type T,
} from "./i18n";

/** 화면 하나를 그리는 데 필요한 것: 설정·로그인·언어·지금 주소. 기준 문서 store-server/DESIGN.md. */
export interface View {
  readonly config: StoreConfig;
  readonly auth: Auth | null;
  readonly lang: Lang;
  readonly t: T;
  readonly url: URL;
}
export function makeView(config: StoreConfig, auth: Auth | null, lang: Lang, url: URL): View {
  return { config, auth, lang, t: translator(lang), url };
}

const blobUrl = (sha: string) => `/api/v1/blobs/${sha}`;

/** 익명 양식(신고)용 서명 토큰. 오늘·어제 날짜로 만든 것만 받는다. */
function formToken(config: StoreConfig, purpose: string, day = Math.floor(Date.now() / 86_400_000)): string {
  return `${day}.${createHmac("sha256", config.secret).update(`${purpose}:${day}`).digest("base64url")}`;
}
export function checkFormToken(config: StoreConfig, purpose: string, token: string): boolean {
  const [dayText] = token.split(".");
  const day = Number(dayText);
  const today = Math.floor(Date.now() / 86_400_000);
  if (!Number.isSafeInteger(day) || (day !== today && day !== today - 1)) return false;
  const expected = Buffer.from(formToken(config, purpose, day));
  const sent = Buffer.from(token);
  return expected.length === sent.length && timingSafeEqual(expected, sent);
}

/** 16칸 격자 도트 아이콘. 뜻을 돕는 곳에만 쓴다. */
const ICONS = {
  spark: "M7 1h2v4h-2zM7 11h2v4h-2zM1 7h4v2h-4zM11 7h4v2h-4zM5 5h2v2h-2zM9 5h2v2h-2zM5 9h2v2h-2zM9 9h2v2h-2z",
  note: "M6 2h8v3h-6v7h-1v1h-1v1h-3v-1h-1v-2h1v-1h3zM13 5h1v6h-1v1h-1v1h-3v-1h-1v-2h1v-1h3v-4z",
  grid: "M2 2h5v5h-5zM9 2h5v5h-5zM2 9h5v5h-5zM9 9h5v5h-5z",
  down: "M7 2h2v7h2v2h-1v1h-1v1h-2v-1h-1v-1h-1v-2h2zM2 13h12v2h-12z",
  up: "M7 1h2v1h1v1h1v1h1v2h-3v6h-2v-6h-3v-2h1v-1h1v-1h1zM2 13h12v2h-12z",
  globe: "M6 1h4v1h2v1h1v2h1v6h-1v2h-1v1h-2v1h-4v-1h-2v-1h-1v-2h-1v-6h1v-2h1v-1h2zM7 3v3h2v-3zM4 7v2h2v-2zM7 7v2h2v-2zM10 7v2h2v-2zM7 10v3h2v-3z",
  arrow: "M9 3h2v2h2v2h2v2h-2v2h-2v2h-2v-2h1v-2h-8v-2h8v-2h-1z",
  user: "M6 1h4v1h1v4h-1v1h-4v-1h-1v-4h1zM3 9h10v1h1v5h-12v-5h1z",
  check: "M12 3h2v2h-1v2h-1v2h-1v2h-1v2h-2v-1h-1v-1h-1v-1h-1v-1h-1v-2h2v1h1v1h1v-1h1v-2h1v-2h1z",
  shield: "M3 2h10v7h-1v2h-1v1h-1v1h-1v1h-2v-1h-1v-1h-1v-1h-1v-2h-1z",
  search: "M5 1h4v1h1v1h1v1h1v4h-1v1h-1v1h-1v1h-4v-1h-1v-1h-1v-1h-1v-4h1v-1h1v-1h1zM5 3v1h-1v4h1v1h4v-1h1v-4h-1v-1zM11 10h1v1h1v1h1v1h1v2h-2v-1h-1v-1h-1v-1h-1v-1h1z",
  heart: "M2 3h4v1h1v1h2v-1h1v-1h4v1h1v5h-1v1h-1v1h-1v1h-1v1h-1v1h-2v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-5h1z",
};
type IconName = keyof typeof ICONS;
const icon = (name: IconName, cls = "") => `<svg class="ico${cls ? ` ${cls}` : ""}" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" shape-rendering="crispEdges"><path fill-rule="evenodd" d="${ICONS[name]}"/></svg>`;
const kindIcon = (kind: StoreItemKind): IconName => kind === "music" || kind === "sound" ? "note" : "grid";

/** 지금 주소에 다른 언어를 붙인 링크. */
function langHref(view: View, lang: Lang): string {
  const params = new URLSearchParams(view.url.search);
  params.set("lang", lang);
  return `${view.url.pathname}?${params}`;
}

function layout(view: View, title: string, body: string, options: { q?: string; scripts?: string[]; active?: string } = {}): string {
  const { t, auth, config, lang } = view;
  const csrf = auth?.csrf ?? "";
  const account = auth
    ? `<a class="nav-link" href="/me">${t("myItems")}</a>${auth.user.role === "admin" ? `<a class="nav-link" href="/admin">${t("admin")}</a>` : ""}
<form method="post" action="/logout" class="inline"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="nav-link user" data-testid="logout" title="${esc(t("logout"))}">${icon("user")}<span>${esc(auth.user.displayName)}</span></button></form>`
    : `<a class="button small" href="/login" data-testid="login-link">${t("login")}</a>`;
  const langLinks = LANGS.map((code) => `<a href="${esc(langHref(view, code))}" lang="${HTML_LANG[code]}" hreflang="${HTML_LANG[code]}"${code === lang ? ' aria-current="true"' : ""}>${LANG_NAMES[code]}</a>`);
  const langMenu = `<details class="lang-menu"><summary aria-label="${esc(t("language"))}">${icon("globe")}<span>${LANG_NAMES[lang]}</span></summary><div class="lang-list">${langLinks.join("")}</div></details>`;
  const cats = [`<a href="/?kind="${options.active === "" ? ' class="on" aria-current="page"' : ""}>${t("allAssets")}</a>`,
    ...STORE_ITEM_KINDS.filter((kind) => kind !== "pack").map((kind) => `<a href="/?kind=${kind}"${options.active === kind ? ' class="on" aria-current="page"' : ""}>${esc(kindLabel(lang, kind))}</a>`)].join("");
  return `<!doctype html><html lang="${HTML_LANG[lang]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · OPRN ${esc(t("storeName"))}</title><meta name="description" content="${esc(t("footerTag"))}">
<link rel="stylesheet" href="/static/app.css"><link rel="icon" href="/static/icon.svg">
${LANGS.map((code) => `<link rel="alternate" hreflang="${HTML_LANG[code]}" href="${esc(config.publicUrl + langHref(view, code))}">`).join("")}
${auth?.csrf ? `<meta name="csrf" content="${esc(auth.csrf)}">` : ""}</head><body>
<a class="skip" href="#main">${t("skip")}</a>
<header class="top"><div class="top-row wrap">
<a class="brand" href="/"><img src="/static/icon.svg" alt="" width="30" height="30"><span><b>OPRN</b><small>${esc(t("storeName"))}</small></span></a>
<form class="search" action="/" method="get" role="search">${icon("search", "search-ico")}<input type="search" name="q" value="${esc(options.q ?? "")}" placeholder="${esc(t("search"))}" aria-label="${esc(t("searchLabel"))}"></form>
<nav class="account"><a class="nav-link" href="/upload">${icon("up")}<span>${t("upload")}</span></a>${account}${langMenu}</nav>
</div><nav class="cats wrap" aria-label="${esc(t("categories"))}">${cats}</nav></header>
<main id="main" class="wrap">${body}</main>
<footer><div class="foot-inner wrap"><div class="foot-brand"><b>OPRN ${esc(t("storeName"))}</b><span>${esc(t("footerTag"))}</span></div>
<nav class="foot-links"><a href="/terms">${t("terms")}</a><a href="/copyright">${t("copyright")}</a><a href="/privacy">${t("privacy")}</a><span>${esc(t("contact", config.contactEmail))}</span></nav>
<nav class="foot-langs" aria-label="${esc(t("language"))}">${langLinks.join("")}</nav></div></footer>
<script src="/static/store.js" defer></script>${(options.scripts ?? []).map((src) => `<script src="${esc(src)}" defer></script>`).join("")}</body></html>`;
}

function marks(view: View, item: Pick<StoreItemSummary, "grade" | "aiGenerated">): string {
  const { t } = view;
  return `<span class="badges">${item.grade === "pack" ? `<span class="mark pack" title="${esc(t("aiReadyTitle"))}">${icon("spark")}${t("aiReady")}</span>` : ""}${item.aiGenerated ? `<span class="mark ai" title="${esc(t("aiGeneratedTitle"))}">${t("aiGenerated")}</span>` : ""}</span>`;
}

const downloadsText = (view: View, downloads: number) => downloads > 0 ? `${icon("down")}${esc(downloads === 1 ? view.t("downloadOne") : view.t("downloads", downloads))}` : esc(view.t("newArrival"));

function cover(item: Pick<StoreItemSummary, "cover" | "kind" | "title">, eager = false): string {
  if (item.cover) return `<img src="${blobUrl(item.cover)}" alt="${esc(item.title)}"${eager ? "" : ' loading="lazy"'} decoding="async">`;
  return `<span class="cover-icon" aria-hidden="true">${icon(kindIcon(item.kind))}</span>`;
}

function card(view: View, item: StoreItemSummary): string {
  const { t, lang } = view;
  return `<a class="card" href="/items/${esc(item.slug)}" data-testid="store-card" data-slug="${esc(item.slug)}">
<div class="cover">${cover(item)}${item.grade === "pack" ? `<span class="mark pack on-cover" title="${esc(t("aiReadyTitle"))}">${icon("spark")}${t("aiReady")}</span>` : ""}</div>
<div class="card-body"><h3>${esc(item.title)}</h3>
<p class="card-meta"><span>${esc(item.author)}</span><span>${esc(kindLabel(lang, item.kind))}</span>${item.aiGenerated ? `<span class="ai-text">${t("aiGenerated")}</span>` : ""}</p>
<p class="card-foot"><span class="price">${t("free")}</span><span class="dl">${downloadsText(view, item.downloads)}</span></p></div></a>`;
}

const grid = (view: View, items: StoreItemSummary[], testid = "store-grid") => `<div class="grid" data-testid="${testid}">${items.map((item) => card(view, item)).join("")}</div>`;
const emptyBox = (text: string, action = "") => `<div class="empty"><span class="cover-icon">${icon("grid")}</span><p>${text}</p>${action}</div>`;

export interface Shelf { readonly title: MessageKey; readonly href: string; readonly items: StoreItemSummary[] }
export interface HomeData {
  readonly total: number;
  readonly kinds: { kind: StoreItemKind; count: number; cover: string | null }[];
  readonly featured: StoreItemSummary[];
  readonly shelves: Shelf[];
}

export function home(view: View, data: HomeData): string {
  const { t, lang } = view;
  const slides = data.featured.map((item, index) => `<article class="slide${index === 0 ? " is-on" : ""}" data-slide="${index}"${index === 0 ? "" : " hidden"}>
<a class="slide-art" href="/items/${esc(item.slug)}" tabindex="-1" aria-hidden="true">${cover(item, index === 0)}</a>
<div class="slide-copy"><p class="eyebrow">${t("heroEyebrow")} · ${esc(kindLabel(lang, item.kind))}</p><h2><a href="/items/${esc(item.slug)}">${esc(item.title)}</a></h2>
<p class="slide-sum">${esc(item.summary)}</p>${marks(view, item)}
<p class="slide-actions"><a class="button" href="/items/${esc(item.slug)}">${t("viewItem")}${icon("arrow")}</a><span class="price big">${t("free")}</span></p></div></article>`).join("");
  const thumbs = data.featured.length > 1 ? `<div class="slide-thumbs">${data.featured.map((item, index) => `<button type="button" class="slide-thumb${index === 0 ? " is-on" : ""}" data-go="${index}" aria-label="${esc(item.title)}"${index === 0 ? ' aria-current="true"' : ""}>${cover(item)}<span>${esc(item.title)}</span></button>`).join("")}</div>` : "";
  const hero = data.featured.length > 0 ? `<section class="hero" data-carousel aria-roledescription="carousel" aria-label="${esc(t("heroEyebrow"))}">${slides}${thumbs}</section>` : "";
  const intro = `<section class="intro"><div class="intro-copy"><h1>${t("heroTitle")}</h1><p>${t("heroLead")}</p></div>
<ul class="intro-facts"><li>${icon("grid")}<span>${esc(t("totalAssets", data.total))}</span></li><li>${icon("heart")}<span>${t("allFree")}</span></li><li>${icon("spark")}<span>${t("aiReady")}</span></li></ul></section>`;
  const kinds = data.kinds.length > 0 ? `<section class="block"><div class="block-head"><h2>${t("categories")}</h2><a class="see-all" href="/?kind=">${t("seeAll")}${icon("arrow")}</a></div><div class="cat-tiles">${data.kinds.map((k) => `<a class="cat-tile" href="/?kind=${k.kind}">
<span class="cat-art">${k.cover ? `<img src="${blobUrl(k.cover)}" alt="" loading="lazy">` : `<span class="cover-icon">${icon(kindIcon(k.kind))}</span>`}</span>
<span class="cat-label"><b>${esc(kindLabel(lang, k.kind))}</b><small>${esc(t("items", k.count))}</small></span></a>`).join("")}</div></section>` : "";
  const shelves = data.shelves.filter((shelf) => shelf.items.length > 0).map((shelf) => `<section class="block shelf"><div class="block-head"><h2>${t(shelf.title)}</h2><a class="see-all" href="${esc(shelf.href)}">${t("seeAll")}${icon("arrow")}</a></div>${grid(view, shelf.items, "store-shelf")}</section>`).join("");
  const creator = `<section class="creator"><div><h2>${t("creatorTitle")}</h2><p>${t("creatorLead")}</p>
<ul><li>${icon("shield")}<span>${t("creatorPoint1")}</span></li><li>${icon("check")}<span>${t("creatorPoint2")}</span></li><li>${icon("heart")}<span>${t("creatorPoint3")}</span></li></ul></div>
<a class="button" href="/upload">${icon("up")}${t("startUpload")}</a></section>`;
  const empty = data.total === 0 ? emptyBox(t("emptyAll")) : "";
  return layout(view, t("storeName"), `${hero}${intro}${kinds}${shelves}${empty}${creator}`);
}

export interface BrowsePage { readonly items: StoreItemSummary[]; readonly total: number; readonly page: number; readonly pageSize: number }

export function browse(view: View, query: CatalogQuery, page: BrowsePage, kinds: { kind: StoreItemKind; count: number }[]): string {
  const { t, lang } = view;
  const link = (patch: Partial<CatalogQuery>) => {
    const next: Record<string, unknown> = { kind: query.kind, q: query.q, grade: query.grade, sort: query.sort, page: 1, ...patch };
    const params = new URLSearchParams();
    for (const key of ["q", "kind", "grade", "sort", "page"]) {
      const value = next[key];
      if (value && !(key === "page" && value === 1)) params.set(key, String(value));
    }
    const text = params.toString();
    return text ? `/?${text}` : "/?kind=";
  };
  const total = kinds.reduce((sum, k) => sum + k.count, 0);
  const kindLinks = [`<li><a href="${esc(link({ kind: "" }))}"${!query.kind ? ' class="on" aria-current="true"' : ""}><span>${t("all")}</span><small>${total}</small></a></li>`,
    ...kinds.map((k) => `<li><a href="${esc(link({ kind: k.kind }))}"${query.kind === k.kind ? ' class="on" aria-current="true"' : ""}><span>${esc(kindLabel(lang, k.kind))}</span><small>${k.count}</small></a></li>`)].join("");
  const packOn = query.grade === "pack";
  const toggle = `<a class="toggle${packOn ? " on" : ""}" href="${esc(link({ grade: packOn ? "" : "pack" }))}" aria-pressed="${packOn}"><span class="knob" aria-hidden="true"></span><span>${t("onlyAiReady")}</span></a>`;
  const popular = query.sort === "popular";
  const sortLink = (on: boolean, sort: string, label: MessageKey) => `<a class="chip${on ? " on" : ""}" href="${esc(link({ sort }))}"${on ? ' aria-current="true"' : ""}>${t(label)}</a>`;
  const heading = query.q ? t("resultsFor", query.q) : query.kind && (STORE_ITEM_KINDS as readonly string[]).includes(query.kind) ? kindLabel(lang, query.kind as StoreItemKind) : t("allAssets");
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize));
  const pager = pages > 1 ? `<nav class="pager">${page.page > 1 ? `<a class="button ghost small" href="${esc(link({ page: page.page - 1 }))}">${t("prev")}</a>` : ""}<span>${page.page} / ${pages}</span>${page.page < pages ? `<a class="button ghost small" href="${esc(link({ page: page.page + 1 }))}">${t("next")}</a>` : ""}</nav>` : "";
  const results = page.items.length > 0 ? grid(view, page.items) : emptyBox(t("emptyFiltered"), `<a class="button ghost" href="/">${t("backHome")}</a>`);
  const body = `<div class="browse"><aside class="side" aria-label="${esc(t("filters"))}"><h2>${t("kindHeading")}</h2><ul class="side-kinds">${kindLinks}</ul><h2>${t("filters")}</h2>${toggle}</aside>
<section class="results" id="shelf"><div class="results-head"><div><h1>${esc(heading)}</h1><p class="result-line">${esc(t("items", page.total))}</p></div><div class="chips" aria-label="${esc(t("sort"))}">${sortLink(!popular, "", "sortNew")}${sortLink(popular, "popular", "sortPopular")}</div></div>
${results}${pager}</section></div>`;
  return layout(view, heading, body, { q: query.q ?? "", active: query.kind ?? "" });
}

export interface InsideAsset { readonly name: string; readonly blob: string; readonly mime: string }
export interface ItemExtras { readonly inside: InsideAsset[]; readonly insideTotal: number; readonly related: StoreItemSummary[] }

const STATUS_KEYS = { pending: "statusPending", visible: "statusVisible", hidden: "statusHidden", removed: "statusRemoved" } as const;
const statusLabel = (view: View, status: StoreItemStatus) => view.t(STATUS_KEYS[status]);
function hiddenByLabel(view: View, hiddenBy: string | null): string {
  if (hiddenBy === "author") return view.t("hiddenByAuthor");
  if (hiddenBy === "reports") return view.t("hiddenByReports");
  if (hiddenBy === "admin") return view.t("hiddenByAdmin");
  return "";
}
function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
const REASON_KEYS = { copyright: "reasonCopyright", inappropriate: "reasonInappropriate", broken: "reasonBroken", spam: "reasonSpam", other: "reasonOther" } as const;

export function item(view: View, detail: StoreItemDetail & { authorId: number; hiddenBy: string | null }, reported: boolean, extras: ItemExtras): string {
  const { t, lang, auth, config } = view;
  const mine = auth !== null && auth.user.id === detail.authorId;
  const notice = detail.status !== "visible"
    ? `<p class="notice ${esc(detail.status)}" data-testid="status-notice"><b>${esc(statusLabel(view, detail.status))}</b> — ${esc(detail.status === "pending" ? t("pendingNote") : hiddenByLabel(view, detail.hiddenBy))}</p>`
    : "";
  const gallery = detail.previews.length > 0
    ? `<div class="gallery" data-gallery><figure class="main"><img src="${blobUrl(detail.previews[0]!)}" alt="${esc(t("preview", detail.title, 1))}" data-main></figure>
${detail.previews.length > 1 ? `<div class="thumbs">${detail.previews.map((sha, index) => `<a href="${blobUrl(sha)}" class="thumb${index === 0 ? " is-on" : ""}" data-src="${blobUrl(sha)}" data-alt="${esc(t("preview", detail.title, index + 1))}"><img src="${blobUrl(sha)}" alt="${esc(t("preview", detail.title, index + 1))}" loading="lazy"></a>`).join("")}</div>` : ""}</div>`
    : `<div class="gallery"><figure class="main audio"><span class="cover-icon">${icon(kindIcon(detail.kind))}</span></figure></div>`;
  const latest = detail.versions[0];
  const images = extras.inside.filter((asset) => asset.mime.startsWith("image/"));
  const sounds = extras.inside.filter((asset) => asset.mime.startsWith("audio/"));
  const inside = extras.inside.length > 0 ? `<section class="block"><div class="block-head"><h2>${t("insideTitle")}</h2><span class="result-line">${esc(t("items", extras.insideTotal))}</span></div>
${images.length > 0 ? `<div class="inside">${images.map((asset) => `<figure title="${esc(asset.name)}"><img src="${blobUrl(asset.blob)}" alt="${esc(asset.name)}" loading="lazy" decoding="async">${lang === "ko" ? `<figcaption>${esc(asset.name)}</figcaption>` : ""}</figure>`).join("")}</div>` : ""}
${sounds.length > 0 ? `<ul class="inside-audio">${sounds.map((asset) => `<li><span>${icon("note")}${esc(asset.name)}</span><audio controls preload="none" src="${blobUrl(asset.blob)}"></audio></li>`).join("")}</ul>` : ""}
${extras.insideTotal > extras.inside.length ? `<p class="result-line more">${esc(t("insideMore", extras.insideTotal - extras.inside.length))}</p>` : ""}</section>` : "";
  const reasons = (Object.keys(REASON_KEYS) as (keyof typeof REASON_KEYS)[]).map((reason) => `<option value="${reason}">${t(REASON_KEYS[reason])}</option>`).join("");
  const report = detail.status === "visible" || detail.status === "hidden"
    ? `<details class="report"><summary>${t("report")}</summary><form method="post" action="/items/${esc(detail.slug)}/report">
<input type="hidden" name="token" value="${esc(formToken(config, `report:${detail.slug}`))}">
<label>${t("reportReason")} <select name="reason" required>${reasons}</select></label>
<label>${t("reportDetail")} <textarea name="detail" maxlength="2000" rows="3" placeholder="${esc(t("reportPlaceholder"))}"></textarea></label>
<button class="button small">${t("reportSend")}</button><p class="fine">${t("reportFine", `<a href="/copyright">${t("copyright")}</a>`)}</p></form></details>`
    : "";
  const languages = detail.languages ?? [];
  const facts = `<dl class="facts"><div><dt>${t("license")}</dt><dd>${esc(licenseLabel(lang, detail.license))}</dd></div>
<div><dt>${t("contents")}</dt><dd>${esc(t("contentsCount", detail.counts.tilesets, detail.counts.assets, detail.counts.referenceDocuments))}</dd></div>
<div><dt>${t("version")}</dt><dd>${detail.latestVersion}</dd></div>
${latest ? `<div><dt>${t("updated")}</dt><dd>${esc(formatDate(lang, latest.createdAt))}</dd></div><div><dt>${t("size")}</dt><dd>${fileSize(latest.bytes)}</dd></div>` : ""}
${languages.length > 0 ? `<div><dt>${t("languages")}</dt><dd>${languages.map((code) => esc(LANG_NAMES[code])).join(" · ")}</dd></div>` : ""}</dl>`;
  // 태그는 작가가 쓴 낱말이다. 다른 언어 화면에서는 한글 태그를 빼고 보인다.
  const shownTags = lang === "ko" ? detail.tags : detail.tags.filter((tag) => !/[\uAC00-\uD7A3]/.test(tag));
  const tags = shownTags.length > 0 ? `<p class="tags">${shownTags.map((tag) => `<a href="/?q=${encodeURIComponent(tag)}">#${esc(tag)}</a>`).join("")}</p>` : "";
  const body = `${notice}${reported ? `<p class="notice ok" data-testid="report-done">${t("reportDone")}</p>` : ""}
<nav class="crumbs" aria-label="breadcrumb"><a href="/">${t("breadcrumbStore")}</a><span aria-hidden="true">/</span><a href="/?kind=${detail.kind}">${esc(kindLabel(lang, detail.kind))}</a></nav>
<article class="detail">${gallery}<aside class="info">
<p class="kind">${esc(kindLabel(lang, detail.kind))}</p><h1 data-testid="item-title">${esc(detail.title)}</h1>
<p class="by">${esc(t("by", detail.author))} · ${downloadsText(view, detail.downloads)}</p>${marks(view, detail)}
<p class="summary">${esc(detail.summary)}</p>
<div class="get"><div class="get-head"><span class="price big">${t("free")}</span><span class="license-pill">${esc(licenseShort(detail.license as StoreLicense))}</span></div>
<h2>${t("getInEditor")}</h2><ol><li>${t("step1")}</li><li>${t("step2")}</li><li>${t("step3")}</li></ol><p class="fine">${t("getNote")}</p>
<p class="copy-id"><span>${t("copyId")}</span><code>${esc(detail.slug)}</code></p></div>
${facts}${tags}${mine ? `<p class="fine">${t("mine")}</p>` : ""}
</aside></article>
<section class="block text-block"><div class="block-head"><h2>${t("description")}</h2></div><div class="pre">${esc(detail.description || detail.summary)}</div></section>
${inside}
${detail.credits ? `<section class="block text-block"><div class="block-head"><h2>${t("creditsTitle")}</h2></div><div class="pre" data-testid="item-credits">${esc(detail.credits)}</div><p class="fine">${t("creditsNote")}</p></section>` : ""}
<section class="block text-block"><div class="block-head"><h2>${t("versionsTitle")}</h2></div><ul class="versions">${detail.versions.map((v) => `<li><b>${esc(t("versionN", v.version))}</b><span>${esc(formatDate(lang, v.createdAt))}</span><span>${fileSize(v.bytes)}</span></li>`).join("")}</ul></section>
${report}
${extras.related.length > 0 ? `<section class="block shelf"><div class="block-head"><h2>${t("related")}</h2><a class="see-all" href="/?kind=${detail.kind}">${t("seeAll")}${icon("arrow")}</a></div>${grid(view, extras.related, "store-related")}</section>` : ""}`;
  return layout(view, detail.title, body, { active: detail.kind });
}

const sheetSize = (kind: "charset" | "battleCharset"): { width: number; height: number } => ({ width: STORE_FIXED_SHEETS[kind]!.width, height: STORE_FIXED_SHEETS[kind]!.height });

export function upload(view: View): string {
  const { t, lang } = view;
  const kinds = STORE_ITEM_KINDS.filter((kind) => kind !== "pack").map((kind) => `<option value="${kind}">${esc(kindLabel(lang, kind))}</option>`).join("");
  const licenses = STORE_LICENSES.map((license, index) => `<label class="radio"><input type="radio" name="license" value="${license}" ${index === 3 ? "checked" : ""}> ${esc(licenseLabel(lang, license))}</label>`).join("");
  const msgs: Record<string, string> = { choose: t("upChoose"), hashing: t("upHashing"), sending: t("upSending"), creating: t("upCreating"), done: t("upDone"), pending: t("upPending"), view: t("upView"), badsize: t("upBadSize", "{0}", "{1}") };
  // 종류별 규격. 크기 판정은 서버(storeImageSizeProblem)가 하고, 화면은 올리기 전에 같은 규칙으로 먼저 알려 준다.
  const specs: Record<string, { text: string; width?: number; height?: number; tile?: number }> = {
    tileset: { text: t("specTileset"), tile: STORE_TILE_SIZE },
    character: { text: t("specCharacter"), ...sheetSize("charset") },
    battler: { text: t("specBattler"), ...sheetSize("battleCharset") },
    face: { text: t("specFace") },
    picture: { text: t("specPicture") },
    music: { text: t("specAudio") },
    sound: { text: t("specAudio") },
  };
  const body = `<section class="narrow panel"><h1>${t("uploadTitle")}</h1>
<p class="lead">${t("uploadLead")}</p>
<form id="upload-form" class="stack" data-testid="upload-form" data-specs="${esc(JSON.stringify(specs))}" ${Object.entries(msgs).map(([key, value]) => `data-msg-${key}="${esc(value)}"`).join(" ")}>
<label>${t("fieldFile")} <input type="file" name="file" accept=".png,.ogg,.mp3,.wav,.m4a" required data-testid="upload-file"></label>
<label>${t("fieldKind")} <select name="kind" required data-testid="upload-kind">${kinds}</select></label>
<p class="field-hint" id="upload-spec" data-testid="upload-spec"></p>
<label>${t("fieldTitle")} <input name="title" required minlength="2" maxlength="80" data-testid="upload-title"></label>
<label>${t("fieldSummary")} <input name="summary" maxlength="160"></label>
<label>${t("fieldDescription")} <textarea name="description" rows="4" maxlength="8000"></textarea></label>
<label>${t("fieldTags")} <input name="tags" placeholder="${esc(t("tagsPlaceholder"))}"></label>
<fieldset><legend>${t("license")}</legend>${licenses}</fieldset>
<fieldset><legend>${t("fieldAi")}</legend><label class="radio"><input type="radio" name="ai" value="yes" required> ${t("aiYes")}</label><label class="radio"><input type="radio" name="ai" value="no"> ${t("aiNo")}</label></fieldset>
<label>${t("fieldCredits")} <input name="credits" maxlength="400" placeholder="${esc(t("creditsPlaceholder"))}"></label>
<label class="check"><input type="checkbox" name="agree" required data-testid="upload-agree"> <span>${t("agree", `<a href="/terms" target="_blank">${t("terms")}</a>`)}</span></label>
<button class="button" data-testid="upload-submit">${t("uploadSubmit")}</button>
<p class="upload-status" id="upload-status" role="status" data-testid="upload-status"></p></form></section>`;
  return layout(view, t("uploadTitle"), body, { scripts: ["/static/upload.js"] });
}

export function me(view: View, items: (StoreItemSummary & { status: StoreItemStatus; hiddenBy: string | null })[]): string {
  const { t, auth } = view;
  const rows = items.map((it) => `<tr><td><a class="row-title" href="/items/${esc(it.slug)}"><span class="cover small">${cover(it)}</span>${esc(it.title)}</a></td><td><span class="status ${esc(it.status)}">${esc(statusLabel(view, it.status))}</span>${it.hiddenBy ? `<small>${esc(hiddenByLabel(view, it.hiddenBy))}</small>` : ""}</td><td>${it.latestVersion}</td><td>${it.downloads}</td><td>
${it.status === "visible" || (it.status === "hidden" && it.hiddenBy === "author") ? `<form method="post" action="/items/${esc(it.slug)}/visibility" class="inline"><input type="hidden" name="csrf" value="${esc(auth?.csrf ?? "")}"><input type="hidden" name="hidden" value="${it.status === "visible" ? "1" : "0"}"><button class="link">${it.status === "visible" ? t("hide") : t("unhide")}</button></form>` : ""}</td></tr>`).join("");
  const body = `<section class="page"><div class="block-head"><h1>${t("meTitle")}</h1><a class="button small" href="/upload">${icon("up")}${t("upload")}</a></div>${items.length > 0
    ? `<div class="table-wrap"><table class="table"><thead><tr><th>${t("colTitle")}</th><th>${t("colStatus")}</th><th>${t("colVersion")}</th><th>${t("colDownloads")}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : emptyBox(t("meEmpty"), `<a class="button" href="/upload">${t("startUpload")}</a>`)}</section>`;
  return layout(view, t("meTitle"), body);
}

export function admin(view: View, queue: { pending: StoreItemSummary[]; reported: (StoreItemSummary & { status: string; reports: { reason: string; detail: string; createdAt: string }[] })[] }): string {
  const { t, auth, lang } = view;
  const action = (slug: string, status: string, label: string, cls = "") => `<form method="post" action="/admin/items/${esc(slug)}/status" class="inline"><input type="hidden" name="csrf" value="${esc(auth?.csrf ?? "")}"><input type="hidden" name="status" value="${status}"><button class="button small ${cls}" data-testid="admin-${status}-${esc(slug)}">${esc(label)}</button></form>`;
  const pending = queue.pending.map((it) => `<li class="queue-item"><div class="cover small">${cover(it)}</div><div><a href="/items/${esc(it.slug)}">${esc(it.title)}</a><p>${esc(it.author)} · ${esc(kindLabel(lang, it.kind))} ${marks(view, it)}</p></div><div class="actions">${action(it.slug, "visible", t("approve"))}${action(it.slug, "removed", t("remove"), "danger")}</div></li>`).join("");
  const reported = queue.reported.map((it) => `<li class="queue-item"><div class="cover small">${cover(it)}</div><div><a href="/items/${esc(it.slug)}">${esc(it.title)}</a> <span class="status ${esc(it.status)}">${esc(statusLabel(view, it.status as StoreItemStatus))}</span>
<ul class="reports">${it.reports.map((r) => `<li><b>${esc(r.reason)}</b> ${esc(r.detail)} <small>${esc(formatDate(lang, r.createdAt))}</small></li>`).join("")}</ul></div>
<div class="actions">${action(it.slug, "visible", t("keepPublic"))}${action(it.slug, "hidden", t("keepHidden"))}${action(it.slug, "removed", t("remove"), "danger")}</div></li>`).join("");
  const body = `<section class="page"><h1>${t("adminTitle")}</h1><h2>${esc(t("adminPending", queue.pending.length))}</h2><ul class="queue" data-testid="admin-pending">${pending || `<li class="empty">${t("none")}</li>`}</ul>
<h2>${esc(t("adminReported", queue.reported.length))}</h2><ul class="queue" data-testid="admin-reported">${reported || `<li class="empty">${t("none")}</li>`}</ul></section>`;
  return layout(view, t("adminTitle"), body);
}

export function login(view: View, next: string): string {
  const { t, auth, config } = view;
  if (auth) return layout(view, t("loginTitle"), `<section class="narrow auth-card"><h1>${t("alreadyIn")}</h1><p><a class="button" href="${esc(next)}">${t("continue")}</a></p></section>`);
  const google = config.google ? `<a class="button google" href="/auth/google?next=${encodeURIComponent(next)}" data-testid="google-login">${t("loginGoogle")}</a>` : "";
  const dev = config.devLogin ? `<form method="post" action="/auth/dev" class="stack dev" data-testid="dev-login"><p class="fine">${t("devNote")}</p>
<input type="hidden" name="next" value="${esc(next)}"><label>${t("email")} <input type="email" name="email" required data-testid="dev-email"></label><label>${t("name")} <input name="name" maxlength="40" data-testid="dev-name"></label><button class="button" data-testid="dev-submit">${t("login")}</button></form>` : "";
  const body = `<section class="narrow auth-card"><img class="auth-mark" src="/static/icon.svg" alt="" width="48" height="48"><h1>${t("loginTitle")}</h1><p class="lead">${t("loginLead")}</p>${google}${dev}${!google && !dev ? `<p class="notice">${t("loginSoon")}</p>` : ""}</section>`;
  return layout({ ...view, auth: null }, t("loginTitle"), body);
}

export function loginLink(view: View, token: string): string {
  const { t } = view;
  const body = `<section class="narrow auth-card"><h1>${t("linkTitle")}</h1><p class="lead">${t("linkLead")}</p>
<form method="post" action="/auth/link" class="row"><input type="hidden" name="token" value="${esc(token)}"><button class="button" data-testid="link-login">${t("login")}</button></form></section>`;
  return layout({ ...view, auth: null }, t("linkTitle"), body);
}

export function device(view: View, code: string, found: { clientName: string; status: string } | null, done: string | null): string {
  const { t, auth } = view;
  let content: string;
  if (done === "approved") content = `<p class="notice ok" data-testid="device-approved">${t("deviceApproved")}</p>`;
  else if (done === "denied") content = `<p class="notice">${t("deviceDenied")}</p>`;
  else if (done === "expired") content = `<p class="notice">${t("deviceExpired")}</p>`;
  else if (code && found?.status === "pending") {
    // 앱이 밝힌 이름(clientName)은 누구나 정할 수 있어 보여 주지 않는다 — 공식 앱처럼 꾸민 낚시를 막는다.
    content = `<p class="lead">${t("deviceAsk", `<b>${esc(auth?.user.email ?? "")}</b>`)}</p>
<p class="notice">${t("deviceWarn")}</p>
<p>${t("deviceMatch")}</p><p class="user-code" data-testid="device-code">${esc(code)}</p>
<form method="post" action="/device" class="row"><input type="hidden" name="csrf" value="${esc(auth?.csrf ?? "")}"><input type="hidden" name="code" value="${esc(code)}">
<button class="button" name="decision" value="approve" data-testid="device-approve">${t("allow")}</button><button class="button ghost" name="decision" value="deny">${t("deny")}</button></form>`;
  } else {
    content = `${code ? `<p class="notice">${t("deviceNotFound")}</p>` : ""}<form method="get" action="/device" class="row"><input name="code" placeholder="ABCD-EFGH" value="${esc(code)}" aria-label="${esc(t("deviceInput"))}"><button class="button">${t("check")}</button></form>`;
  }
  return layout(view, t("deviceTitle"), `<section class="narrow auth-card"><h1>${t("deviceTitle")}</h1>${content}</section>`);
}

function doc(view: View, name: "terms" | "copyright" | "privacy"): string {
  const contact = `<a href="mailto:${esc(view.config.contactEmail)}">${esc(view.config.contactEmail)}</a>`;
  return layout(view, docTitle(view.lang, name), `<section class="narrow doc panel"><h1>${esc(docTitle(view.lang, name))}</h1>${DOCS[name][view.lang](contact)}</section>`);
}
export const terms = (view: View) => doc(view, "terms");
export const copyright = (view: View) => doc(view, "copyright");
export const privacy = (view: View) => doc(view, "privacy");

export function errorPage(view: View, status: number, message: string): string {
  const { t, lang } = view;
  // 서버 오류 문구는 한국어로 쓰여 있다. 다른 언어에서는 상태 번호만 알린다.
  const text = lang === "ko" ? message : t("errorGeneric", status);
  return layout({ ...view, auth: null }, `${status}`, `<section class="narrow auth-card"><h1>${status === 404 ? t("notFound") : t("problem")}</h1><p class="lead">${esc(text)}</p><p><a class="button" href="/">${t("backHome")}</a></p></section>`);
}
