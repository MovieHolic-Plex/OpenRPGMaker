// 데이터베이스 29개 탭 "모던 에디터" 적합성 게이트.
//
// 스크린샷은 사람 눈으로만 판정할 수 있어 29 탭 회귀를 못 막는다. 이 스크립트는 감사에서
// 반복해서 나온 결함들을 브라우저에서 **측정 가능한 술어**로 바꾼다:
//   clipped   : overflow:hidden 컨테이너가 자기 내용을 잘라먹는가 (분류/상태/몬스터 종족 P0)
//   overlap   : 같은 부모의 형제 박스가 서로 겹치는가 (분류 legend 충돌 P0)
//   fullBleed : 툴바 버튼이 패널 폭을 통째로 먹는가 (스위치/변수 P0 — .btn.small{flex:1})
//   deadSpace : 본문 면적 중 아무 콘텐츠도 없는 비율 (밀도 축 H)
//   canon     : 정규 워크스페이스 클래스(.db-record-workspace 등)를 쓰는가 (축 A)
//   search    : 목록 창에 검색이 있는가 (축 B)
//   emptyState: 레코드 0 일 때 제대로 된 빈 상태가 있는가 (축 D)
//   textClip  : 글자가 말줄임되거나 overflow:hidden 조상 밖으로 나가 안 보이는가 (2026-09-03)
//
//   node scripts/audit-db-conformance.mjs                       # 전체
//   AUDIT_ONLY=switches,variables node scripts/audit-db-conformance.mjs
//   AUDIT_BASELINE=verify-shots/db-modernize/conformance-before.json node scripts/audit-db-conformance.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { gotoWithRetry } from "./lib/goto-retry.mjs";

const BASE = process.env.AUDIT_BASE ?? "http://127.0.0.1:9173/";
const UI_MODE = process.env.AUDIT_UI_MODE ?? "expert";
const OUT = process.env.AUDIT_OUT ?? "verify-shots/db-modernize/conformance.json";
const ONLY = process.env.AUDIT_ONLY ? process.env.AUDIT_ONLY.split(",") : null;
const BASELINE = process.env.AUDIT_BASELINE ?? null;
const WIDTH = Number(process.env.AUDIT_W ?? 1680);
const HEIGHT = Number(process.env.AUDIT_H ?? 1050);

// 정본은 src/editor/panels/database.ts 의 DatabaseTab 유니온 + TABS 등록 목록이다.
// `factions`(진영)는 등록된 탭인데 이 목록에서 빠져 있었다 — 그래서 게이트를 한 번도
// 통과한 적이 없고, ARIA·대비 결함이 회귀 감시 밖에 있었다(2026-09-01 발견).
// shoot-db-tabs.mjs 는 같은 누락을 2026-08-30 에 자기 목록에서만 고쳤다.
export const DB_TAB_SLUGS = [
  "overview", "actors", "classes", "skills", "items", "equipment", "enemies",
  "monster-species", "troops", "factions", "elements", "states", "animations", "battle-screen",
  "battle-commands", "terrain", "crops", "characters", "life-crafting", "daily-weather",
  "farm-animals", "farm-spatial", "life-collections", "tilesets", "structure-kits",
  "common-events", "system", "terms", "switches", "variables",
];

const testIdFor = (slug) => `db-tab-${slug}`;

/** 페이지 안에서 도는 측정기. 순수 DOM 계산이라 앱 코드에 의존하지 않는다. */
function measureInPage() {
  const body = document.querySelector(".database-modal-body .db-body");
  if (!(body instanceof HTMLElement)) return { error: "no .db-body" };

  const bodyRect = body.getBoundingClientRect();
  const area = Math.max(1, bodyRect.width * bodyRect.height);
  const all = Array.from(body.querySelectorAll("*")).filter((n) => n instanceof HTMLElement);

  const visible = (node) => {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const describe = (node) => {
    const id = node.dataset?.testid ? `[${node.dataset.testid}]` : "";
    const cls = String(node.className || "").split(" ").filter(Boolean).slice(0, 2).join(".");
    return `${node.tagName.toLowerCase()}${cls ? "." + cls : ""}${id}`;
  };

  // ---- clipped: overflow 가 hidden/clip 인데 내용이 넘치는 박스 -------------
  const clipped = [];
  for (const node of all) {
    if (!visible(node)) continue;
    // 시각적으로 숨긴 라벨(sr-only: 1×1 + clip:rect) 은 화면 독자용이라 "잘라먹는" 상자가 아니다.
    // v2 가 이름 입력을 제목으로 쓰면서 라벨을 이렇게 숨긴다(actors/items/states/animations 실측).
    const box = node.getBoundingClientRect();
    if (box.width <= 1 && box.height <= 1) continue;
    const style = getComputedStyle(node);
    const hiddenY = style.overflowY === "hidden" || style.overflowY === "clip";
    const hiddenX = style.overflowX === "hidden" || style.overflowX === "clip";
    if (!hiddenY && !hiddenX) continue;
    const overY = hiddenY ? node.scrollHeight - node.clientHeight : 0;
    const overX = hiddenX ? node.scrollWidth - node.clientWidth : 0;
    if (overY > 8 || overX > 8) {
      clipped.push({ node: describe(node), overY: Math.round(overY), overX: Math.round(overX) });
    }
  }

  // ---- overlap: 같은 부모의 형제 두 박스가 실제로 겹침 ---------------------
  // position:absolute/fixed/sticky 와 겹침을 의도한 장식(::before 대체 span 등)은 제외.
  const overlaps = [];
  const parents = new Set(all.map((n) => n.parentElement).filter(Boolean));
  for (const parent of parents) {
    const kids = Array.from(parent.children).filter(
      (k) => k instanceof HTMLElement && visible(k) && getComputedStyle(k).position === "static",
    );
    for (let i = 0; i < kids.length; i += 1) {
      for (let j = i + 1; j < kids.length; j += 1) {
        const a = kids[i].getBoundingClientRect();
        const b = kids[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 4 && oy > 4) {
          overlaps.push({ a: describe(kids[i]), b: describe(kids[j]), ox: Math.round(ox), oy: Math.round(oy) });
        }
      }
    }
  }

  // ---- fullBleed: 패널 폭을 거의 다 먹는 버튼 -----------------------------
  const fullBleed = [];
  for (const btn of body.querySelectorAll("button")) {
    if (!(btn instanceof HTMLElement) || !visible(btn)) continue;
    // 레코드 행/갤러리 카드/탭 스트립은 폭을 다 쓰는 게 정상이다 — 액션 버튼만 본다.
    if (btn.closest(".db-list-row, .db-gallery-card, [role='tablist'], .db-list, .db-gallery")) continue;
    if (btn.classList.contains("db-list-row") || btn.classList.contains("db-gallery-card")) continue;
    if (btn.getAttribute("role") === "tab") continue;
    const parent = btn.parentElement;
    if (!parent) continue;
    const pr = parent.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    if (pr.width < 240) continue;              // 좁은 툴바에서 꽉 차는 건 정상
    if (br.width >= pr.width * 0.9 && br.width > 420) {
      fullBleed.push({ node: describe(btn), text: (btn.textContent || "").trim().slice(0, 24), w: Math.round(br.width) });
    }
  }

  // ---- textClip: 글자가 잘리는 요소 --------------------------------------
  // 위 clipped 는 "overflow:hidden 상자가 자기 내용을 잘라먹는가" 만 본다. 사용자가 실제로
  // 겪는 "글자가 잘린다" 는 두 갈래가 더 있다(2026-09-03 실측: 몬스터 «이동 간격(…», 전투
  // 애니메이션 타이밍 표 «사운드…», 상태 «해제 조건» 셀렉트가 행 아래로 잘림):
  //   (a) ellipsis — text-overflow 로 말줄임된 텍스트 요소. 라벨·표 헤더가 여기서 잘린다.
  //   (b) ancestorClip — 요소 상자가 가장 가까운 overflow:hidden|clip 조상 밖으로 나가
  //       그만큼 안 보인다. 셀렉트·입력 같은 폼 컨트롤도 여기서 잡는다.
  // 스크롤 컨테이너(overflow:auto|scroll)는 잘림이 아니라 스크롤이므로 세지 않는다.
  const textClip = [];
  const hasOwnText = (node) =>
    Array.from(node.childNodes).some((child) => child.nodeType === 3 && (child.textContent || "").trim().length > 0);
  const clipAncestor = (node) => {
    let cursor = node.parentElement;
    while (cursor && cursor !== body) {
      const style = getComputedStyle(cursor);
      // 스크롤 컨테이너를 먼저 만나면 그 안의 내용은 스크롤로 닿는다 — 잘림이 아니다.
      // (상세 창은 overflow:hidden 인데 그 자식 폼이 실제 스크롤러인 구조가 많다.)
      if (/(auto|scroll)/.test(style.overflowX) || /(auto|scroll)/.test(style.overflowY)) return null;
      const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
      const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
      if (clipsX || clipsY) return { node: cursor, clipsX, clipsY };
      cursor = cursor.parentElement;
    }
    return null;
  };
  for (const node of all) {
    if (!visible(node)) continue;
    const tag = node.tagName;
    const isControl = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
    const style = getComputedStyle(node);
    // (a) 말줄임 — 폼 컨트롤은 제 값을 스크롤하므로 제외.
    if (!isControl && hasOwnText(node) && style.textOverflow === "ellipsis" && style.whiteSpace === "nowrap") {
      const over = node.scrollWidth - node.clientWidth;
      if (over > 1) {
        textClip.push({ kind: "ellipsis", node: describe(node), text: (node.textContent || "").trim().slice(0, 24), over: Math.round(over) });
        continue;
      }
    }
    // (b) 조상 클립 — 글자를 가진 요소와 폼 컨트롤만 본다(장식 상자는 제외).
    if (!isControl && !hasOwnText(node)) continue;
    if (style.position === "absolute" || style.position === "fixed") continue;
    const clip = clipAncestor(node);
    if (!clip) continue;
    const r = node.getBoundingClientRect();
    const c = clip.node.getBoundingClientRect();
    const overRight = clip.clipsX ? r.right - c.right : 0;
    const overBottom = clip.clipsY ? r.bottom - c.bottom : 0;
    const overLeft = clip.clipsX ? c.left - r.left : 0;
    const overTop = clip.clipsY ? c.top - r.top : 0;
    const worst = Math.max(overRight, overBottom, overLeft, overTop);
    if (worst > 2) {
      textClip.push({
        kind: "ancestor",
        node: describe(node),
        by: describe(clip.node),
        text: isControl ? `<${tag.toLowerCase()}>` : (node.textContent || "").trim().slice(0, 24),
        over: Math.round(worst),
      });
    }
  }

  // ---- deadSpace: 잎 노드 박스가 덮지 않는 면적 비율 -----------------------
  // 32px 그리드로 러프하게 샘플링한다(정확한 기하 합집합은 과하다).
  //
  // 본문 전체와 **상세 창만** 따로 잰다. 레코드가 6 개뿐인 탭이라면 목록 아래가 비는
  // 건 결함이 아니다 — 진짜 결함은 인스펙터가 텅 빈 경우(속성 67%, 생활 기술 87%)라
  // 위반 판정은 상세 창 수치로 한다.
  const leaves = all.filter((n) => visible(n) && n.children.length === 0);
  const deadRatio = (host) => {
    const hostRect = host.getBoundingClientRect();
    if (hostRect.width < 8 || hostRect.height < 8) return 0;
    const cell = 32;
    const cols = Math.ceil(hostRect.width / cell);
    const rows = Math.ceil(hostRect.height / cell);
    const covered = new Uint8Array(cols * rows);
    for (const leaf of leaves) {
      const r = leaf.getBoundingClientRect();
      if (r.right < hostRect.left || r.left > hostRect.right) continue;
      if (r.bottom < hostRect.top || r.top > hostRect.bottom) continue;
      const c0 = Math.max(0, Math.floor((r.left - hostRect.left) / cell));
      const c1 = Math.min(cols - 1, Math.floor((r.right - hostRect.left) / cell));
      const r0 = Math.max(0, Math.floor((r.top - hostRect.top) / cell));
      const r1 = Math.min(rows - 1, Math.floor((r.bottom - hostRect.top) / cell));
      for (let rr = r0; rr <= r1; rr += 1) for (let cc = c0; cc <= c1; cc += 1) covered[rr * cols + cc] = 1;
    }
    let coveredCells = 0;
    for (let i = 0; i < covered.length; i += 1) coveredCells += covered[i];
    return Number((1 - coveredCells / Math.max(1, cols * rows)).toFixed(3));
  };

  const deadSpace = deadRatio(body);
  const detailHost = body.querySelector(".db-ws-detail, .db-detail-pane, .oprn-record-detail-pane");
  const detailDead = detailHost instanceof HTMLElement ? deadRatio(detailHost) : deadSpace;

  // ---- 정규 구조 / 검색 / 빈 상태 -----------------------------------------
  const canon = Boolean(body.querySelector(".db-record-workspace, .db-workspace"));
  const listPane = body.querySelector(".db-list-pane, .oprn-record-list-pane");
  const search = Boolean(body.querySelector('.db-search input, input[type="search"]'));
  const rowCount = body.querySelectorAll(".db-list-row, .db-gallery-card").length;
  const emptyState = Boolean(body.querySelector(".empty-state"));

  return {
    bodySize: [Math.round(bodyRect.width), Math.round(bodyRect.height)],
    scrollOverflow: body.scrollHeight - body.clientHeight,
    canon,
    hasListPane: Boolean(listPane),
    search,
    rowCount,
    emptyState,
    deadSpace,
    detailDead,
    clipped: clipped.slice(0, 12),
    clippedCount: clipped.length,
    overlaps: overlaps.slice(0, 12),
    overlapCount: overlaps.length,
    fullBleed: fullBleed.slice(0, 8),
    fullBleedCount: fullBleed.length,
    textClip: textClip.slice(0, 16),
    textClipCount: textClip.length,
    nodeCount: all.length,
  };
}

/** 측정값 -> 위반 목록. 여기가 "모던 기준" 의 실제 정의다. */
function violationsFor(m) {
  const out = [];
  if (m.error) return [`measure failed: ${m.error}`];
  if (m.clippedCount > 0) out.push(`clipped:${m.clippedCount}`);
  if (m.overlapCount > 0) out.push(`overlap:${m.overlapCount}`);
  if (m.fullBleedCount > 0) out.push(`fullBleed:${m.fullBleedCount}`);
  if (m.textClipCount > 0) out.push(`textClip:${m.textClipCount}`);
  // 위반 판정은 인스펙터 여백으로 한다 — 목록 아래 여백은 레코드 수 문제라 결함이 아니다.
  if (m.detailDead > 0.55) out.push(`detailDead:${(m.detailDead * 100).toFixed(0)}%`);
  if (m.hasListPane && !m.search) out.push("listWithoutSearch");
  if (m.hasListPane && m.rowCount === 0 && !m.emptyState) out.push("emptyWithoutState");
  return out;
}

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(60_000);
  await page.addInitScript((mode) => localStorage.setItem("oprn:editor-ui-mode", mode), UI_MODE);

  let booted = false;
  let lastError;
  for (let attempt = 1; attempt <= 5 && !booted; attempt += 1) {
    try {
      await gotoWithRetry(page, `${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000, attempts: 3 });
      await page.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 45_000 });
      booted = true;
    } catch (err) {
      lastError = err;
      console.log(`boot attempt ${attempt} failed: ${String(err).slice(0, 110)}`);
      await page.waitForTimeout(1500);
    }
  }
  if (!booted) throw lastError;

  await page.getByTestId("toolbar-database").click();
  await page.waitForSelector('[data-testid="database-modal"]', { state: "visible", timeout: 30_000 });
  await page.waitForTimeout(700);

  const results = {};
  for (const slug of DB_TAB_SLUGS) {
    if (ONLY && !ONLY.includes(slug)) continue;
    const ok = await page.evaluate((id) => {
      const node = document.querySelector(`[data-testid="${id}"]`);
      if (!(node instanceof HTMLElement)) return false;
      node.scrollIntoView({ block: "nearest" });
      node.click();
      return true;
    }, testIdFor(slug));
    if (!ok) { results[slug] = { error: "tab button missing" }; continue; }
    await page.waitForTimeout(550);
    const measured = await page.evaluate(measureInPage);
    measured.violations = violationsFor(measured);
    results[slug] = measured;
  }

  await browser.close();

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(results, null, 2));

  const base = BASELINE && existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : null;
  let total = 0;
  let clean = 0;
  console.log(`\n${"tab".padEnd(18)} ${"body".padEnd(5)} ${"insp".padEnd(5)} clip ovl bleed text  violations${base ? "   (vs baseline)" : ""}`);
  console.log("-".repeat(base ? 98 : 80));
  for (const [slug, m] of Object.entries(results)) {
    total += 1;
    const v = m.violations ?? ["error"];
    if (v.length === 0) clean += 1;
    let delta = "";
    if (base?.[slug]) {
      const before = (base[slug].violations ?? []).length;
      const diff = v.length - before;
      delta = diff === 0 ? `  =${before}` : diff < 0 ? `  ${before}->${v.length} BETTER` : `  ${before}->${v.length} WORSE`;
    }
    console.log(
      `${slug.padEnd(18)} ${String(((m.deadSpace ?? 0) * 100).toFixed(0) + "%").padEnd(5)} ${String(((m.detailDead ?? 0) * 100).toFixed(0) + "%").padEnd(5)} ` +
      `${String(m.clippedCount ?? "-").padStart(4)} ${String(m.overlapCount ?? "-").padStart(3)} ` +
      `${String(m.fullBleedCount ?? "-").padStart(5)} ${String(m.textClipCount ?? "-").padStart(4)}  ${v.join(" ") || "clean"}${delta}`,
    );
  }
  console.log("-".repeat(base ? 98 : 80));
  console.log(`clean ${clean}/${total} -> ${OUT}`);
}

await main();
