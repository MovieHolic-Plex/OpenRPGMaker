import { createHmac, timingSafeEqual } from "node:crypto";
import {
  STORE_ITEM_KINDS, STORE_KIND_LABELS, STORE_LICENSE_LABELS, STORE_LICENSES,
  type StoreItemDetail, type StoreItemStatus, type StoreItemSummary,
} from "../../../src/assetStore/format";
import type { Auth } from "../auth";
import type { StoreConfig } from "../config";
import { esc } from "../http";
import type { CatalogQuery } from "../items";

const STATUS_LABELS: Record<StoreItemStatus, string> = { pending: "확인 대기", visible: "공개", hidden: "숨김", removed: "내려감" };
const HIDDEN_BY: Record<string, string> = { author: "작가가 숨김", reports: "신고 누적으로 자동 숨김", admin: "운영자가 숨김" };
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

function layout(config: StoreConfig, auth: Auth | null, title: string, body: string, options: { q?: string; scripts?: string[] } = {}): string {
  const csrf = auth?.csrf ?? "";
  const nav = auth
    ? `<a href="/upload">올리기</a><a href="/me">내 상품</a>${auth.user.role === "admin" ? `<a href="/admin">운영</a>` : ""}
       <form method="post" action="/logout" class="inline"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="link" data-testid="logout">${esc(auth.user.displayName)} · 로그아웃</button></form>`
    : `<a href="/upload">올리기</a><a class="button small" href="/login" data-testid="login-link">로그인</a>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · OPRN 에셋 스토어</title><link rel="stylesheet" href="/static/app.css"><link rel="icon" href="/static/icon.svg">
${auth?.csrf ? `<meta name="csrf" content="${esc(auth.csrf)}">` : ""}</head><body>
<header class="top"><a class="brand" href="/"><img src="/static/icon.svg" alt="" width="28" height="28"><span>OPRN <b>에셋 스토어</b></span></a>
<form class="search" action="/" method="get" role="search"><input type="search" name="q" value="${esc(options.q ?? "")}" placeholder="타일셋, 캐릭터, 음악 찾기" aria-label="찾기"></form>
<nav>${nav}</nav></header>
<main>${body}</main>
<footer><a href="/terms">이용약관</a><a href="/copyright">저작권 신고</a><a href="/privacy">개인정보</a><span>문의 ${esc(config.contactEmail)}</span></footer>
${(options.scripts ?? []).map((src) => `<script src="${esc(src)}" defer></script>`).join("")}</body></html>`;
}

function badges(item: Pick<StoreItemSummary, "grade" | "aiGenerated" | "license">): string {
  return `<span class="badges">${item.grade === "pack" ? `<span class="badge pack" title="참고문서가 들어 있어 에디터 조수가 바로 이 타일로 맵을 깔 수 있습니다">조수 사용 가능</span>` : ""}${item.aiGenerated ? `<span class="badge ai" title="AI 도구로 만든 그림·소리가 들어 있습니다">AI 생성</span>` : ""}<span class="badge license">${esc(item.license)}</span></span>`;
}

function cover(item: Pick<StoreItemSummary, "cover" | "kind" | "title">): string {
  if (item.cover) return `<img src="${blobUrl(item.cover)}" alt="${esc(item.title)} 미리보기" loading="lazy">`;
  return `<span class="cover-icon" aria-hidden="true">${item.kind === "music" || item.kind === "sound" ? "♪" : "▦"}</span>`;
}

function card(item: StoreItemSummary): string {
  return `<a class="card" href="/items/${esc(item.slug)}" data-testid="store-card" data-slug="${esc(item.slug)}">
<div class="cover">${cover(item)}</div>
<div class="card-body"><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p>
<div class="meta"><span>${esc(item.author)}</span><span>${esc(STORE_KIND_LABELS[item.kind])}</span><span>받기 ${item.downloads}</span></div>${badges(item)}</div></a>`;
}

export function home(config: StoreConfig, auth: Auth | null, query: CatalogQuery, page: { items: StoreItemSummary[]; total: number; page: number; pageSize: number }): string {
  const link = (patch: Partial<CatalogQuery>) => {
    const next = { ...query, page: 1, ...patch };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value && !(key === "page" && value === 1)) params.set(key, String(value));
    const text = params.toString();
    return text ? `/?${text}` : "/";
  };
  const chip = (label: string, patch: Partial<CatalogQuery>, active: boolean) => `<a class="chip${active ? " on" : ""}" href="${esc(link(patch))}">${esc(label)}</a>`;
  const kinds = [chip("전체", { kind: "" }, !query.kind), ...STORE_ITEM_KINDS.map((kind) => chip(STORE_KIND_LABELS[kind], { kind }, query.kind === kind))].join("");
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize));
  const pager = pages > 1 ? `<nav class="pager">${page.page > 1 ? `<a href="${esc(link({ page: page.page - 1 }))}">← 이전</a>` : ""}<span>${page.page} / ${pages}</span>${page.page < pages ? `<a href="${esc(link({ page: page.page + 1 }))}">다음 →</a>` : ""}</nav>` : "";
  const body = `<section class="hero"><h1>에디터에서 바로 받는 RPG 에셋</h1>
<p>타일셋·캐릭터·음악을 OPRN 앱 안에서 받아 프로젝트에 넣습니다. <b>조수 사용 가능</b> 표시가 있는 팩은 참고문서가 들어 있어 AI 조수가 그 타일로 바로 맵을 깝니다.</p></section>
<section class="filters"><div class="chips">${kinds}</div><div class="chips">
${chip("조수 사용 가능만", { grade: query.grade === "pack" ? "" : "pack" }, query.grade === "pack")}
${chip("최신", { sort: "" }, query.sort !== "popular")}${chip("인기", { sort: "popular" }, query.sort === "popular")}</div></section>
${query.q ? `<p class="result-line">「${esc(query.q)}」 결과 ${page.total}개</p>` : ""}
${page.items.length > 0 ? `<section class="grid" data-testid="store-grid">${page.items.map(card).join("")}</section>` : `<p class="empty">아직 보여 줄 에셋이 없습니다.</p>`}
${pager}`;
  return layout(config, auth, "둘러보기", body, { q: query.q ?? "" });
}

export function item(config: StoreConfig, auth: Auth | null, detail: StoreItemDetail & { authorId: number; hiddenBy: string | null }, reported: boolean): string {
  const mine = auth !== null && auth.user.id === detail.authorId;
  const notice = detail.status !== "visible"
    ? `<p class="notice ${esc(detail.status)}" data-testid="status-notice">${esc(STATUS_LABELS[detail.status])}${detail.status === "pending" ? " — 새 작가의 첫 공개는 운영자가 한 번 확인합니다. 확인 전에는 목록에 보이지 않습니다." : detail.hiddenBy ? ` — ${esc(HIDDEN_BY[detail.hiddenBy] ?? "")}` : ""}</p>`
    : "";
  const gallery = detail.previews.length > 0
    ? `<div class="gallery">${detail.previews.map((sha, index) => `<figure class="${index === 0 ? "main" : "thumb"}"><img src="${blobUrl(sha)}" alt="${esc(detail.title)} 미리보기 ${index + 1}"></figure>`).join("")}</div>`
    : `<div class="gallery"><figure class="main audio"><span class="cover-icon">♪</span></figure></div>`;
  const versions = detail.versions.map((v) => `<li><b>판본 ${v.version}</b> <span>${esc(v.createdAt.slice(0, 10))}</span> <span>${(v.bytes / 1024 / 1024).toFixed(2)}MB</span></li>`).join("");
  const report = detail.status === "visible" || detail.status === "hidden"
    ? `<details class="report"><summary>신고하기</summary><form method="post" action="/items/${esc(detail.slug)}/report">
<input type="hidden" name="token" value="${esc(formToken(config, `report:${detail.slug}`))}">
<label>사유 <select name="reason" required><option value="copyright">저작권 침해</option><option value="inappropriate">부적절한 내용</option><option value="broken">파일이 깨짐</option><option value="spam">스팸·광고</option><option value="other">기타</option></select></label>
<label>자세히 <textarea name="detail" maxlength="2000" rows="3" placeholder="저작권 침해라면 원작 주소를 적어 주세요."></textarea></label>
<button class="button small">신고 보내기</button><p class="fine">권리자의 정식 게시중단 요청은 <a href="/copyright">저작권 신고</a> 절차를 따라 주세요.</p></form></details>`
    : "";
  const body = `${notice}${reported ? `<p class="notice ok" data-testid="report-done">신고를 받았습니다. 고맙습니다.</p>` : ""}
<article class="detail">${gallery}<aside class="info">
<p class="kind">${esc(STORE_KIND_LABELS[detail.kind])}</p><h1 data-testid="item-title">${esc(detail.title)}</h1>
<p class="by">${esc(detail.author)} · 받기 ${detail.downloads}</p>${badges(detail)}
<p class="summary">${esc(detail.summary)}</p>
<dl class="facts"><dt>라이선스</dt><dd>${esc(STORE_LICENSE_LABELS[detail.license])}</dd>
<dt>들어 있는 것</dt><dd>타일셋 ${detail.counts.tilesets} · 에셋 ${detail.counts.assets} · 참고문서 ${detail.counts.referenceDocuments}</dd>
<dt>최신 판본</dt><dd>${detail.latestVersion}</dd></dl>
<div class="get"><h2>에디터에서 받기</h2><p>OPRN 앱의 왼쪽 막대 <b>「스토어」</b>에서 이 이름을 찾아 <b>받기</b> → <b>이 프로젝트에 넣기</b>를 누릅니다. 받은 에셋은 프로젝트 안에 저장되어 스토어 없이도 게임이 돌아갑니다.</p><code>${esc(detail.slug)}</code></div>
${mine ? `<p class="fine">내 상품입니다. 새 판본은 에디터에서 같은 상품으로 다시 올리면 됩니다.</p>` : ""}
</aside></article>
<section class="text-block"><h2>설명</h2><div class="pre">${esc(detail.description || detail.summary)}</div></section>
${detail.credits ? `<section class="text-block"><h2>크레딧 표기</h2><div class="pre" data-testid="item-credits">${esc(detail.credits)}</div><p class="fine">에디터가 게임의 타이틀 「크레딧」 창에 이 문장을 자동으로 넣습니다.</p></section>` : ""}
<section class="text-block"><h2>판본</h2><ul class="versions">${versions}</ul></section>${report}`;
  return layout(config, auth, detail.title, body);
}

export function upload(config: StoreConfig, auth: Auth): string {
  const kinds = STORE_ITEM_KINDS.filter((kind) => kind !== "pack").map((kind) => `<option value="${kind}">${esc(STORE_KIND_LABELS[kind])}</option>`).join("");
  const licenses = STORE_LICENSES.map((license, index) => `<label class="radio"><input type="radio" name="license" value="${license}" ${index === 3 ? "checked" : ""}> ${esc(STORE_LICENSE_LABELS[license])}</label>`).join("");
  const body = `<section class="narrow"><h1>파일 하나 올리기</h1>
<p class="lead">PNG 그림 한 장이나 음원 하나를 올립니다. 타일셋에 <b>참고문서</b>까지 넣은 완성 팩은 OPRN 앱의 「스토어 → 올리기」에서 올리세요 — 「조수 사용 가능」 표시가 붙습니다.</p>
<form id="upload-form" class="stack" data-testid="upload-form">
<label>파일 <input type="file" name="file" accept=".png,.ogg,.mp3,.wav,.m4a" required data-testid="upload-file"></label>
<label>종류 <select name="kind" required data-testid="upload-kind">${kinds}</select></label>
<label class="tile-size">칸 크기(타일셋) <select name="tileSize"><option value="16">16px</option><option value="32">32px</option><option value="48">48px</option></select></label>
<label>제목 <input name="title" required minlength="2" maxlength="80" data-testid="upload-title"></label>
<label>한 줄 소개 <input name="summary" maxlength="160"></label>
<label>설명 <textarea name="description" rows="4" maxlength="8000"></textarea></label>
<label>태그(쉼표로 구분) <input name="tags" placeholder="숲, 마을, 16px"></label>
<fieldset><legend>라이선스</legend>${licenses}</fieldset>
<fieldset><legend>AI 생성 여부 (필수)</legend><label class="radio"><input type="radio" name="ai" value="yes" required> AI 도구로 만든 부분이 있다</label><label class="radio"><input type="radio" name="ai" value="no"> 전부 직접 만들었다</label></fieldset>
<label>크레딧 표기 <input name="credits" maxlength="400" placeholder="그림: 이름 (사이트)"></label>
<label class="check"><input type="checkbox" name="agree" required data-testid="upload-agree"> 이 파일의 권리를 내가 가지고 있고 <a href="/terms" target="_blank">이용약관</a>에 동의합니다.</label>
<button class="button" data-testid="upload-submit">올리기</button>
<p class="upload-status" id="upload-status" role="status" data-testid="upload-status"></p></form></section>`;
  return layout(config, auth, "올리기", body, { scripts: ["/static/upload.js"] });
}

export function me(config: StoreConfig, auth: Auth, items: (StoreItemSummary & { status: StoreItemStatus; hiddenBy: string | null })[]): string {
  const rows = items.map((it) => `<tr><td><a href="/items/${esc(it.slug)}">${esc(it.title)}</a></td><td><span class="status ${esc(it.status)}">${esc(STATUS_LABELS[it.status])}</span>${it.hiddenBy ? `<small>${esc(HIDDEN_BY[it.hiddenBy] ?? "")}</small>` : ""}</td><td>${it.latestVersion}</td><td>${it.downloads}</td><td>
${it.status === "visible" || (it.status === "hidden" && it.hiddenBy === "author") ? `<form method="post" action="/items/${esc(it.slug)}/visibility" class="inline"><input type="hidden" name="csrf" value="${esc(auth.csrf ?? "")}"><input type="hidden" name="hidden" value="${it.status === "visible" ? "1" : "0"}"><button class="link">${it.status === "visible" ? "숨기기" : "다시 공개"}</button></form>` : ""}</td></tr>`).join("");
  const body = `<section><h1>내 상품</h1>${items.length > 0 ? `<table class="table"><thead><tr><th>제목</th><th>상태</th><th>판본</th><th>받기</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="empty">아직 올린 상품이 없습니다. <a href="/upload">올리기</a></p>`}</section>`;
  return layout(config, auth, "내 상품", body);
}

export function admin(config: StoreConfig, auth: Auth, queue: { pending: StoreItemSummary[]; reported: (StoreItemSummary & { status: string; reports: { reason: string; detail: string; createdAt: string }[] })[] }): string {
  const action = (slug: string, status: string, label: string, cls = "") => `<form method="post" action="/admin/items/${esc(slug)}/status" class="inline"><input type="hidden" name="csrf" value="${esc(auth.csrf ?? "")}"><input type="hidden" name="status" value="${status}"><button class="button small ${cls}" data-testid="admin-${status}-${esc(slug)}">${esc(label)}</button></form>`;
  const pending = queue.pending.map((it) => `<li class="queue-item"><div class="cover small">${cover(it)}</div><div><a href="/items/${esc(it.slug)}">${esc(it.title)}</a><p>${esc(it.author)} · ${esc(STORE_KIND_LABELS[it.kind])} ${badges(it)}</p></div><div class="actions">${action(it.slug, "visible", "공개")}${action(it.slug, "removed", "내리기", "danger")}</div></li>`).join("");
  const reported = queue.reported.map((it) => `<li class="queue-item"><div class="cover small">${cover(it)}</div><div><a href="/items/${esc(it.slug)}">${esc(it.title)}</a> <span class="status ${esc(it.status)}">${esc(STATUS_LABELS[it.status as StoreItemStatus])}</span>
<ul class="reports">${it.reports.map((r) => `<li><b>${esc(r.reason)}</b> ${esc(r.detail)} <small>${esc(r.createdAt.slice(0, 16).replace("T", " "))}</small></li>`).join("")}</ul></div>
<div class="actions">${action(it.slug, "visible", "문제없음 · 공개")}${action(it.slug, "hidden", "숨김 유지")}${action(it.slug, "removed", "내리기", "danger")}</div></li>`).join("");
  const body = `<section><h1>운영</h1><h2>확인 대기 ${queue.pending.length}</h2><ul class="queue" data-testid="admin-pending">${pending || "<li class=empty>없음</li>"}</ul>
<h2>신고 ${queue.reported.length}</h2><ul class="queue" data-testid="admin-reported">${reported || "<li class=empty>없음</li>"}</ul></section>`;
  return layout(config, auth, "운영", body);
}

export function login(config: StoreConfig, auth: Auth | null, next: string): string {
  if (auth) return layout(config, auth, "로그인", `<section class="narrow"><h1>이미 로그인했습니다</h1><p><a href="${esc(next)}">계속하기</a></p></section>`);
  const google = config.google ? `<a class="button google" href="/auth/google?next=${encodeURIComponent(next)}" data-testid="google-login">Google 계정으로 로그인</a>` : "";
  const dev = config.devLogin ? `<form method="post" action="/auth/dev" class="stack dev" data-testid="dev-login"><p class="fine">스테이징 전용 개발 로그인입니다. 운영 서버에서는 꺼져 있습니다.</p>
<input type="hidden" name="next" value="${esc(next)}"><label>이메일 <input type="email" name="email" required data-testid="dev-email"></label><label>이름 <input name="name" maxlength="40" data-testid="dev-name"></label><button class="button" data-testid="dev-submit">로그인</button></form>` : "";
  const body = `<section class="narrow"><h1>로그인</h1><p class="lead">둘러보기와 받기는 로그인 없이 됩니다. 올리기·내 상품에만 로그인이 필요합니다.</p>${google}${dev}${!google && !dev ? `<p class="notice">아직 로그인 수단이 설정되지 않았습니다.</p>` : ""}</section>`;
  return layout(config, null, "로그인", body);
}

export function device(config: StoreConfig, auth: Auth, code: string, found: { clientName: string; status: string } | null, done: string | null): string {
  let content: string;
  if (done === "approved") content = `<p class="notice ok" data-testid="device-approved">허락했습니다. 에디터로 돌아가면 로그인이 끝나 있습니다.</p>`;
  else if (done === "denied") content = `<p class="notice">거절했습니다.</p>`;
  else if (done === "expired") content = `<p class="notice">코드가 만료되었거나 이미 쓰였습니다. 에디터에서 다시 시작해 주세요.</p>`;
  else if (code && found?.status === "pending") {
    content = `<p class="lead"><b>${esc(found.clientName)}</b>가 <b>${esc(auth.user.email)}</b> 계정으로 로그인하려고 합니다.</p>
<p>에디터 화면의 코드와 같은지 확인하세요.</p><p class="user-code" data-testid="device-code">${esc(code)}</p>
<form method="post" action="/device" class="row"><input type="hidden" name="csrf" value="${esc(auth.csrf ?? "")}"><input type="hidden" name="code" value="${esc(code)}">
<button class="button" name="decision" value="approve" data-testid="device-approve">허락</button><button class="button ghost" name="decision" value="deny">거절</button></form>`;
  } else {
    content = `${code ? `<p class="notice">코드를 찾지 못했습니다.</p>` : ""}<form method="get" action="/device" class="row"><input name="code" placeholder="ABCD-EFGH" value="${esc(code)}" aria-label="에디터 코드"><button class="button">확인</button></form>`;
  }
  return layout(config, auth, "에디터 로그인", `<section class="narrow"><h1>에디터 로그인</h1>${content}</section>`);
}

const DOC = (title: string, html: string) => `<section class="narrow doc"><h1>${esc(title)}</h1>${html}</section>`;

export function terms(config: StoreConfig, auth: Auth | null): string {
  return layout(config, auth, "이용약관", DOC("이용약관", `
<p>OPRN 에셋 스토어(이하 스토어)는 OPRN 에디터 사용자가 게임 제작용 그림·소리를 나누는 무료 서비스입니다.</p>
<h2>올리는 사람</h2><ol><li>내가 권리를 가진 것만 올립니다. 다른 사람의 팩·게임에서 뽑은 그림, 상업 팩의 원본·변형물은 올릴 수 없습니다.</li>
<li>AI 도구로 만든 부분이 있으면 「AI 생성」을 표시합니다.</li><li>고른 라이선스로 다른 사용자가 쓰는 것을 허락합니다. 이미 받은 사람의 사용 권리는 상품을 숨기거나 내려도 남습니다.</li>
<li>올린 파일은 자동 검사를 거칩니다. 새 계정의 첫 3건은 운영자가 확인한 뒤 공개됩니다.</li></ol>
<h2>받는 사람</h2><ol><li>각 상품의 라이선스와 크레딧 표기를 지킵니다. 에디터는 크레딧을 게임에 자동으로 넣습니다.</li><li>「OPRN 게임 사용」 라이선스는 게임 안에서만 자유롭게 쓰고, 원본 파일을 따로 다시 배포하지 않는 조건입니다.</li></ol>
<h2>운영</h2><p>신고가 쌓이거나 약관을 어긴 상품은 숨기거나 내릴 수 있습니다. 문의: ${esc(config.contactEmail)}</p>`));
}

export function copyright(config: StoreConfig, auth: Auth | null): string {
  return layout(config, auth, "저작권 신고", DOC("저작권 신고 · 게시중단 요청", `
<p>스토어의 상품이 내 저작권을 침해한다면 아래 내용을 적어 <a href="mailto:${esc(config.contactEmail)}">${esc(config.contactEmail)}</a> 로 보내 주세요.</p>
<ol><li>침해된 원작과 권리자를 확인할 수 있는 자료(원작 주소 등)</li><li>스토어 상품 주소</li><li>연락처와 권리자 본인(또는 대리인)이라는 진술</li></ol>
<p>확인되면 상품을 내리고 파일 제공을 멈춥니다. 급한 경우 상품 화면의 「신고하기」도 함께 써 주세요 — 신고가 쌓이면 확인 전에 자동으로 숨겨집니다.</p>`));
}

export function privacy(config: StoreConfig, auth: Auth | null): string {
  return layout(config, auth, "개인정보", DOC("개인정보 처리", `
<p>로그인할 때 이메일과 표시 이름만 저장합니다. 비밀번호는 저장하지 않습니다(Google 로그인).</p>
<p>받기 수·신고는 같은 사람이 여러 번 세지 않도록 로그인 계정 또는 IP 의 해시로 구분합니다. IP 원문은 저장하지 않습니다.</p>
<p>계정 삭제 요청: ${esc(config.contactEmail)}</p>`));
}

export function errorPage(config: StoreConfig, status: number, message: string): string {
  return layout(config, null, `${status}`, `<section class="narrow"><h1>${status === 404 ? "찾을 수 없습니다" : "문제가 생겼습니다"}</h1><p class="lead">${esc(message)}</p><p><a href="/">둘러보기로</a></p></section>`);
}
