// 이벤트 에디터 UI/UX 적대적 프로브.
//
// 감사(2026-08-27)에서 확인된 결함들을 실제 브라우저에서 다시 측정하고, 하나라도 남아 있으면
// 종료 코드 1 로 떨어진다. 기준선(origin/main)에서 RED, 수정 후 GREEN 이 되는 것이 계약이다.
//
//   node scripts/qa-event-editor-ux.mjs --label red
//
// QA_BASE_URL 로 dev 서버 주소를 준다(워크트리 기본 포트는 .env.local 의 DEV_SERVER_PORT).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const label = (() => {
  const i = process.argv.indexOf("--label");
  return i > 0 ? (process.argv[i + 1] ?? "run") : "run";
})();
const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:9828";
const evidenceDir = `.omo/evidence/event-editor-ux/${label}`;
await mkdir(evidenceDir, { recursive: true });

const INDIGO = "rgb(74, 87, 214)";
const results = [];
const record = (id, title, pass, detail) => {
  results.push({ id, title, pass: pass === true, detail });
  console.log(`${pass === true ? "PASS" : "FAIL"} ${id} ${title} :: ${JSON.stringify(detail).slice(0, 400)}`);
};
const rgCount = (pattern, paths) => {
  try {
    const out = execFileSync("rg", ["-n", "--no-heading", pattern, ...paths], { encoding: "utf8" });
    return out.trim() ? out.trim().split("\n") : [];
  } catch {
    return [];
  }
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem("oprn:editor-session-id", "ee-ux-probe");
  window.localStorage.setItem("oprn:editor-ui-mode", "expert");
});
const page = await context.newPage();
const pageErrors = [];
page.on("console", (m) => { if (m.type() === "error") pageErrors.push(`console: ${m.text().slice(0, 200)}`); });
page.on("pageerror", (e) => pageErrors.push(`pageerror: ${String(e).slice(0, 200)}`));

try {
  await page.goto(`${baseUrl}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(8000);
  const editor = await openEventEditor(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${evidenceDir}/01-editor-1440.png` });

  // C1 — 액센트 단일화: 툴바 프라이머리와 푸터 프라이머리가 같은 인디고여야 한다.
  const accent = await editor.evaluate(() => {
    const read = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    };
    return {
      toolbarAdd: read("[data-testid='event-command-toolbar-add']"),
      footerSave: read("[data-testid='event-editor-save']"),
    };
  });
  // 범위: 이벤트 에디터 시트의 **직살** 황동색만 본다. `var(--warning, #d9a441)` 은 경고색 폴백이라
  // 이 주장(액센트는 하나)과 무관하고, --warning 이 토큰으로 정의돼 있어 폴백이 렌더링되지 않는다.
  // 2026-09-11 Task 13: 세대 파일(event-editor.css / mockup / balanced / modernize / modern/) 이 구성 요소 버킷으로 접혀
  // 이벤트 시트 디렉터리 전체를 본다. `var(--mk-accent, #d9a441)` 도 토큰 폴백이라(옛 blocks.css 출신, 옛 목록 밖) 직살이 아니다.
  const brass = rgCount("#d9a441", ["src/styles/event"]).filter(
    (line) => !line.includes("var(--warning") && !line.includes("var(--mk-accent, #d9a441)"),
  );
  const accentVars = await editor.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const scope = document.querySelector(".event-editor");
    const scoped = scope ? getComputedStyle(scope) : root;
    return {
      mkAccent: scoped.getPropertyValue("--mk-accent").trim(),
      commandOrange: scoped.getPropertyValue("--oprn-command-orange").trim(),
      accent: root.getPropertyValue("--accent").trim(),
    };
  });
  record(
    "C1",
    "단일 인디고 액센트",
    accent.toolbarAdd?.bg === INDIGO
      && accent.footerSave?.bg === INDIGO
      && brass.length === 0
      && accentVars.mkAccent.toLowerCase() !== "#d9a441",
    { accent, accentVars, brassHits: brass },
  );

  // C2 — 툴바 중복 제거 + 라벨 완전어.
  const toolbar = await editor.evaluate(() => {
    const bar = document.querySelector(".event-editor-command-toolbar");
    if (!bar) return null;
    const buttons = [...bar.querySelectorAll("button")].map((el) => ({
      testid: el.dataset.testid ?? "",
      text: (el.textContent ?? "").trim(),
      title: el.getAttribute("title") ?? "",
    }));
    return { buttons, overflow: bar.scrollWidth > bar.clientWidth + 1, scrollWidth: bar.scrollWidth, clientWidth: bar.clientWidth };
  });
  const ids = (toolbar?.buttons ?? []).map((b) => b.testid);
  const dupAdd = ids.filter((id) => id === "event-command-quick-next").length;
  const dupStory = ids.filter((id) => id === "event-command-quick-storyboard").length;
  const slicedLabels = (toolbar?.buttons ?? []).filter((b) => /(^|\s)(다시|다음|AI)$/.test(b.text) && b.title.split(" ").length > 1);
  record("C2", "툴바 중복 컨트롤 없음 + 라벨 완전어", dupAdd === 0 && dupStory === 0 && slicedLabels.length === 0, {
    duplicateAddButtons: dupAdd,
    duplicateStoryboardButtons: dupStory,
    slicedLabels: slicedLabels.map((b) => `${b.text} <- ${b.title}`),
    labels: (toolbar?.buttons ?? []).map((b) => b.text),
  });

  // C5(a) — 좌측 레일 요약에 raw enum 이 없어야 한다.
  const railText = await editor.evaluate(() => {
    const col = document.querySelector(".event-editor-settings-column");
    return col ? (col.innerText ?? "") : "";
  });
  const rawEnum = /\b(fixed|random|approach|custom)\b/.exec(railText);
  record("C5a", "레일 요약에 raw enum 없음", rawEnum === null, { match: rawEnum?.[0] ?? null, railSample: railText.replace(/\s+/g, " ").slice(0, 160) });

  // C6 — 이벤트 이름 입력 포커스 링.
  const focusRing = await page.evaluate(() => {
    const input = document.querySelector("[data-testid='event-editor-name']");
    if (!(input instanceof HTMLElement)) return null;
    input.focus();
    const cs = getComputedStyle(input);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  const ringWidth = Number.parseFloat(focusRing?.outlineWidth ?? "0");
  const hasRing = (focusRing?.outlineStyle !== "none" && ringWidth >= 2)
    || (focusRing?.boxShadow !== "none" && (focusRing?.boxShadow ?? "").length > 0);
  record("C6", "이벤트 이름 입력 포커스 링", hasRing, focusRing);
  await page.screenshot({ path: `${evidenceDir}/02-focus-name.png` });

  // 명령 하나 삽입 — 인스펙터 검증용.
  await editor.getByRole("button", { name: /말하기/ }).first().click();
  const sayDialog = page.getByTestId("event-command-edit-dialog");
  await sayDialog.waitFor({ state: "visible" });
  const ta = sayDialog.locator("textarea").first();
  if (await ta.count()) await ta.fill("촌장: 우물이 말라붙었네. 도와주겠나?");
  await sayDialog.getByTestId("event-command-edit-ok").click();
  await sayDialog.waitFor({ state: "detached" });
  const listToggle = editor.getByTestId("event-view-toggle-list");
  if (await listToggle.count()) await listToggle.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${evidenceDir}/03-list.png` });

  // C4 — 단일 클릭은 인스펙터를 채우고 모달을 열지 않는다. 더블 클릭은 모달을 연다.
  const head = editor.locator(".cmd-item .cmd-head").first();
  await head.click();
  await page.waitForTimeout(700);
  const dialogAfterSingle = await page.getByTestId("event-command-edit-dialog").isVisible().catch(() => false);
  const inspector = await editor.evaluate(() => {
    const el = document.querySelector("[data-testid='event-editor-inspector']");
    if (!(el instanceof HTMLElement)) return null;
    const r = el.getBoundingClientRect();
    return {
      hidden: el.hidden,
      width: Math.round(r.width),
      height: Math.round(r.height),
      hasBody: Boolean(el.querySelector("[data-testid='event-inspector-body']")),
      text: (el.innerText ?? "").replace(/\s+/g, " ").slice(0, 80),
    };
  });
  await page.screenshot({ path: `${evidenceDir}/04-single-click.png` });
  record("C4a", "단일 클릭 = 인스펙터 표시, 모달 없음", inspector?.hidden === false && (inspector?.width ?? 0) > 0 && inspector?.hasBody === true && dialogAfterSingle === false, { inspector, dialogOpened: dialogAfterSingle });

  if (dialogAfterSingle) {
    await page.getByTestId("event-command-edit-cancel").click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await head.dblclick();
  const dialogAfterDouble = await page.getByTestId("event-command-edit-dialog").isVisible().catch(() => false);
  record("C4b", "더블 클릭 = 편집 모달", dialogAfterDouble === true, { dialogOpened: dialogAfterDouble });
  if (dialogAfterDouble) {
    await page.screenshot({ path: `${evidenceDir}/05-dblclick-dialog.png` });
    await page.getByTestId("event-command-edit-cancel").click().catch(() => {});
    await page.waitForTimeout(400);
  }

  // L1 — 인스펙터가 열린 1440 레이아웃: 세 칼럼이 겹치지도, 죽은 띠를 남기지도 않는다.
  const wide = await editor.evaluate(() => {
    const box = (sel) => {
      const node = document.querySelector(sel);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
    };
    return {
      settings: box(".event-editor-settings-column"),
      commands: box(".event-editor-commands-column"),
      inspector: box("[data-testid=event-editor-inspector]"),
    };
  });
  const gapSettingsToCommands = wide.commands && wide.settings ? wide.commands.left - wide.settings.right : null;
  const gapCommandsToInspector = wide.inspector && wide.commands ? wide.inspector.left - wide.commands.right : null;
  record(
    "L1",
    "1440 인스펙터 열림 — 죽은 띠·겹침 없음",
    wide.commands !== null
      && wide.inspector !== null
      && (wide.commands?.width ?? 0) >= 520
      && (wide.inspector?.width ?? 0) >= 320
      && (wide.inspector?.width ?? 0) <= 460
      && gapSettingsToCommands !== null && gapSettingsToCommands <= 16 && gapSettingsToCommands >= -1
      && gapCommandsToInspector !== null && gapCommandsToInspector <= 16 && gapCommandsToInspector >= -1,
    { ...wide, gapSettingsToCommands, gapCommandsToInspector },
  );

  // L3 — 인스펙터는 같은 명령을 두 번 미리보지 않는다.
  const inspectorPreviews = await editor.evaluate(() => {
    const insp = document.querySelector("[data-testid=event-editor-inspector]");
    if (!insp) return null;
    // 프리뷰 하나는 루트(event-command-preview-body) 안에 .ecp-stage 를 품는다 — 중복 계수하지 않도록
    // 조상이 또 프리뷰인 노드는 세지 않고 **최상위 프리뷰 루트**만 센다.
    const SEL = "[data-testid=event-command-preview-body], [data-testid=event-inspector-preview], [data-testid=event-command-text-live-preview], .page3-preview-stage, .ecp-stage";
    const all = [...insp.querySelectorAll(SEL)];
    const roots = all.filter((node) => !all.some((other) => other !== node && other.contains(node)));
    return {
      stageCount: roots.length,
      roots: roots.map((node) => node.dataset?.testid ?? String(node.className ?? "").split(" ")[0]),
      titleOccurrences: ((insp.innerText ?? "").match(/문장 표시/gu) ?? []).length,
    };
  });
  record("L3", "인스펙터 프리뷰 중복 없음", (inspectorPreviews?.stageCount ?? 99) <= 1, inspectorPreviews);

  // C5(b) — 오디오 명령 다이얼로그에 이미지 well 과 거짓 문구가 없어야 한다.
  await editor.getByTestId("event-command-toolbar-add").click();
  const picker = page.getByTestId("event-command-picker");
  await picker.waitFor({ state: "visible" });
  const search = picker.locator("input").first();
  await search.fill("BGM");
  await page.waitForTimeout(700);
  const bgmRow = picker
    .locator(".event-command-picker-command-wrap > .event-command-picker-command", { hasText: "시스템 BGM 변경" })
    .first();
  await bgmRow.scrollIntoViewIfNeeded();
  await bgmRow.click();
  const bgmDialog = page.getByTestId("event-command-edit-dialog");
  await bgmDialog.waitFor({ state: "visible" });
  await page.waitForTimeout(700);
  await bgmDialog.screenshot({ path: `${evidenceDir}/06-bgm-dialog.png` });
  const bgm = await bgmDialog.evaluate((el) => {
    const win = el.querySelector(".event-subdialog-window");
    const r = (win ?? el).getBoundingClientRect();
    return { text: (el.innerText ?? "").replace(/\s+/g, " "), w: Math.round(r.width), h: Math.round(r.height) };
  });
  record("C5b", "오디오 명령 다이얼로그 정직성", !bgm.text.includes("그림을 고르세요") && !bgm.text.includes("값을 고르면 바로 반영됩니다"), {
    hasImageWellCopy: bgm.text.includes("그림을 고르세요"),
    hasLyingCopy: bgm.text.includes("값을 고르면 바로 반영됩니다"),
    dialog: { w: bgm.w, h: bgm.h },
  });
  await bgmDialog.getByTestId("event-command-edit-cancel").click().catch(() => {});
  await page.waitForTimeout(400);

  // C5(c) — 네이티브 alert/confirm 금지(에디터는 showConfirm/토스트를 쓴다).
  const natives = rgCount("window\\.(alert|confirm)\\(", ["src/editor/panels/eventEditor"]);
  record("C5c", "네이티브 alert/confirm 없음", natives.length === 0, { hits: natives });

  // C3 — 1024x768 에서 툴바가 잘리지 않는다.
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${evidenceDir}/07-editor-1024.png` });
  const narrow = await editor.evaluate(() => {
    const bar = document.querySelector(".event-editor-command-toolbar");
    const col = document.querySelector(".event-editor-commands-column");
    const add = document.querySelector("[data-testid='event-command-toolbar-add']");
    if (!bar || !col || !add) return null;
    const b = bar.getBoundingClientRect();
    const c = col.getBoundingClientRect();
    const a = add.getBoundingClientRect();
    return {
      add: { left: Math.round(a.left), right: Math.round(a.right), width: Math.round(a.width) },
      column: { left: Math.round(c.left), right: Math.round(c.right) },
      toolbarOverflow: bar.scrollWidth > bar.clientWidth + 1,
      toolbarScroll: { scrollWidth: bar.scrollWidth, clientWidth: bar.clientWidth },
      barBottomInsideColumn: b.bottom <= c.bottom + 1,
    };
  });
  const c3 = narrow !== null
    && narrow.add.left >= narrow.column.left - 1
    && narrow.add.right <= narrow.column.right + 1
    && narrow.add.width >= 60
    && narrow.toolbarOverflow === false;
  record("C3", "1024px 툴바 클리핑 없음", c3, narrow);

  // L2 — 1024 에서 인스펙터가 명령 열을 가리지 않는다(실제 히트 테스트).
  const hit = await editor.evaluate(() => {
    const insp = document.querySelector("[data-testid=event-editor-inspector]");
    const col = document.querySelector(".event-editor-commands-column");
    const add = document.querySelector("[data-testid=event-command-toolbar-add]");
    const row = document.querySelector(".cmd-item .cmd-head");
    const rect = (node) => (node ? node.getBoundingClientRect() : null);
    const ir = rect(insp);
    const cr = rect(col);
    const ar = rect(add);
    const rr = rect(row);
    const describe = (node) => {
      if (!node) return null;
      const inCommands = Boolean(col && col.contains(node));
      const inInspector = Boolean(insp && insp.contains(node));
      return { testid: node.dataset?.testid ?? null, cls: String(node.className ?? "").slice(0, 40), inCommands, inInspector };
    };
    return {
      inspectorVisible: Boolean(insp && !insp.hidden && ir && ir.width > 0),
      commandsWidth: cr ? Math.round(cr.width) : 0,
      overlap: ir && cr ? Math.round(Math.min(ir.right, cr.right) - Math.max(ir.left, cr.left)) : null,
      addHit: ar ? describe(document.elementFromPoint(ar.left + ar.width / 2, ar.top + ar.height / 2)) : null,
      rowHit: rr ? describe(document.elementFromPoint(rr.left + Math.min(40, rr.width / 2), rr.top + rr.height / 2)) : null,
    };
  });
  record(
    "L2",
    "1024 인스펙터가 명령 열을 가리지 않음",
    hit?.inspectorVisible === true
      && (hit?.commandsWidth ?? 0) >= 320
      && (hit?.overlap ?? 99) <= 1
      && hit?.addHit?.inCommands === true
      && hit?.rowHit?.inCommands === true,
    hit,
  );


  // ── 문법 기준 C7~C12 (2026-09-03 제안서 §14). 1440 으로 돌아와 목록 보기·선택 없음 상태에서 잰다.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(700);
  await page.getByTestId("event-inspector-close").click({ force: true }).catch(() => {});
  await page.getByTestId("event-view-toggle-list").click().catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${evidenceDir}/08-grammar-1440.png` });
  const grammar = await editor.evaluate(() => {
    const root = document.querySelector(".event-editor-modal-window") ?? document.querySelector("[data-testid=event-editor-modal]");
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && el.closest("[hidden]") === null;
    };
    const all = [...root.querySelectorAll("*")].filter(vis);
    const buttons = all.filter((e) => e.matches("button"));
    const sig = (b) => {
      const cs = getComputedStyle(b);
      return [cs.backgroundColor, cs.color, cs.borderTopWidth + " " + cs.borderTopColor, cs.borderRadius, cs.fontSize, cs.fontWeight, Math.round(b.getBoundingClientRect().height)].join("|");
    };
    const signatures = new Map();
    for (const b of buttons) {
      const key = sig(b);
      signatures.set(key, [...(signatures.get(key) ?? []), String(b.className).slice(0, 48)]);
    }
    const fontSizes = new Map();
    const offSizeSamples = [];
    const offRadiusSamples = [];
    const textColorsBelow = [];
    const lum = (rgb) => {
      const m = rgb.match(/[\d.]+/g);
      if (!m) return null;
      const [r, g, b] = m.slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const opaqueBg = (el) => {
      let n = el;
      while (n && n !== document.documentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg && bg !== "transparent" && !/^rgba\(.*,\s*0(\.\d+)?\)$/.test(bg)) return bg;
        n = n.parentElement;
      }
      return "rgb(255, 255, 255)";
    };
    const ratio = (fg, bg) => {
      const a = lum(fg); const b = lum(bg);
      if (a == null || b == null) return null;
      const [hi, lo] = a > b ? [a, b] : [b, a];
      return (hi + 0.05) / (lo + 0.05);
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim()) continue;
      const parent = node.parentElement;
      if (!parent || !vis(parent)) continue;
      const cs = getComputedStyle(parent);
      fontSizes.set(cs.fontSize, (fontSizes.get(cs.fontSize) ?? 0) + 1);
      if (!["12px", "13px", "14px", "15px", "18px"].includes(cs.fontSize)) offSizeSamples.push(`${cs.fontSize} ${parent.tagName.toLowerCase()}.${String(parent.className).split(" ").slice(0, 2).join(".")}`);
      const r = ratio(cs.color, opaqueBg(parent));
      if (r != null && r < 4.5) textColorsBelow.push({ text: node.textContent.trim().slice(0, 24), cls: String(parent.className).slice(0, 40), ratio: Math.round(r * 100) / 100, fontSize: cs.fontSize });
    }
    const radii = new Map();
    for (const e of all) {
      const r = getComputedStyle(e).borderRadius;
      if (r && r !== "0px") {
        radii.set(r, (radii.get(r) ?? 0) + 1);
        if (!["6px", "4px", "50%"].includes(r)) offRadiusSamples.push(`${r} ${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 2).join(".")}`);
      }
    }
    // 이모지·글리프 아이콘: 버튼 텍스트에 기호 블록 문자가 있고 SVG 자식이 없다.
    const glyphRe = /[←-⇿⌀-⏿■-➿⬀-⯿\u{1F000}-\u{1FAFF}]/u;
    // kbd 안의 단축키 표기(↵ 등)는 아이콘이 아니라 글자다 — 제외한다.
    const textOutsideKbd = (b) => [...b.querySelectorAll("*")].concat([b]).filter((e) => e.tagName !== "KBD" && !e.closest("kbd")).map((e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("")).join("");
    const glyphButtons = buttons.filter((b) => glyphRe.test(textOutsideKbd(b)) && !b.querySelector("svg")).map((b) => ({ text: (b.textContent ?? "").trim().slice(0, 16), cls: String(b.className).slice(0, 40) }));
    return {
      signatureCount: signatures.size,
      signatures: [...signatures.entries()].map(([k, v]) => ({ sig: k, count: v.length, sample: v[0] })),
      fontSizes: [...fontSizes.entries()],
      offSizeSamples: [...new Set(offSizeSamples)].slice(0, 20),
      radii: [...radii.entries()],
      offRadiusSamples: [...new Set(offRadiusSamples)].slice(0, 30),
      lowContrast: textColorsBelow,
      glyphButtons,
      svgIcons: root.querySelectorAll("svg").length,
    };
  });
  const allowedSizes = new Set(["12px", "13px", "14px", "15px", "18px"]);
  const offSizes = grammar.fontSizes.filter(([size]) => !allowedSizes.has(size));
  const allowedRadii = new Set(["6px", "4px", "50%"]);
  const offRadii = grammar.radii.filter(([radius]) => !allowedRadii.has(radius));
  record("C7", "버튼 스타일 시그니처 ≤ 12", grammar.signatureCount <= 12, { count: grammar.signatureCount, signatures: grammar.signatures.slice(0, 30) });
  record("C8", "글자 크기는 12·13·14·15·18 만 (14 = 읽는 글자)", offSizes.length === 0, { offSizes, samples: grammar.offSizeSamples, all: grammar.fontSizes });
  record("C9", "라운딩은 6·4px 과 50% 만", offRadii.length === 0, { offRadii, samples: grammar.offRadiusSamples, all: grammar.radii });
  record("C10", "이모지·글리프 아이콘 버튼 없음", grammar.glyphButtons.length === 0, { glyphButtons: grammar.glyphButtons.slice(0, 12), svgIcons: grammar.svgIcons });
  record("C11", "대비 4.5:1 미만 텍스트 없음", grammar.lowContrast.length === 0, { count: grammar.lowContrast.length, sample: grammar.lowContrast.slice(0, 12) });

  // C12 — 툴바 팝오버는 바깥을 누르면 닫힌다.
  const popoverSummary = editor.locator("[data-testid=event-command-edit-menu] > summary");
  let popover = null;
  if (await popoverSummary.count()) {
    await popoverSummary.click();
    await page.waitForTimeout(250);
    const openAfterClick = await editor.evaluate(() => document.querySelector("[data-testid=event-command-edit-menu]")?.open ?? null);
    const list = editor.locator(".cmd-list").first();
    const box = await list.boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height - 12);
    await page.waitForTimeout(300);
    const openAfterOutside = await editor.evaluate(() => document.querySelector("[data-testid=event-command-edit-menu]")?.open ?? null);
    popover = { openAfterClick, openAfterOutside };
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(200);
  }
  record("C12", "툴바 팝오버가 바깥 클릭에 닫힘", popover?.openAfterClick === true && popover?.openAfterOutside === false, popover);


  // ── 가독성 기준 C13~C16 (2026-09-03 후속 «가독성이 여전히 떨어진다»). 목록 보기 · 선택 없음 · 1440.
  //    읽는 글자(명령 요약)는 14px 이상, 대비 7:1 이상이 대부분, 행마다 상자를 두르지 않고,
  //    분기 구조는 들여쓰기 폭과 마커 줄의 글자 무게로 읽힌다.
  // 읽기 측정은 명령이 하나뿐인 게이트 기본 이벤트로는 뜻이 없다(첫 실측: 행 1 · 마커 0 · 글자 39).
  // 지금 열려 있는 이벤트(모달 dataset 의 mapId/eventId)에 선택지·조건 분기가 든 13줄을 더 심는다 —
  // 모달이 store 를 구독하므로 그 자리에서 다시 그려진다. 닫고 다시 여는 길은 「취소(삭제)」 확인창에 막혔다.
  // C12 의 마지막 Escape 는 팝오버가 이미 닫힌 뒤라 편집기 층에 닿아 「적용하지 않은 변경」 확인창을 띄운다 —
  // 「계속 편집」으로 물리고 잰다(확인창은 지표엔 영향 없지만 증거 사진을 가린다).
  await page.getByTestId("app-modal-cancel").click({ timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(300);
  const injected = await page.evaluate(() => {
    const store = window.__oprnEditorStore;
    const modal = document.querySelector("[data-testid=event-editor-modal]");
    if (!store || !modal) return { ok: false, reason: "no store/modal" };
    const { mapId, eventId } = modal.dataset;
    const project = store.getCurrent();
    let switchId = null; let variableId = null; let itemIds = []; let otherMapId = null;
    const walk = (cmds) => {
      for (const c of cmds ?? []) {
        if (!c) continue;
        if (c.kind === "setSwitch" && !switchId) switchId = c.switchId;
        if (c.kind === "setVariable" && !variableId) variableId = c.variableId;
        if (c.kind === "shop" && !itemIds.length && Array.isArray(c.itemIds)) itemIds = c.itemIds.slice(0, 4);
        if (c.kind === "fork") { if (c.condition?.kind === "switch" && !switchId) switchId = c.condition.switchId; walk(c.then); walk(c.else); }
        if (c.kind === "choices") for (const o of c.options ?? []) walk(o.branch);
      }
    };
    for (const m of Object.values(project.maps)) {
      if (m.id !== mapId && !otherMapId) otherMapId = m.id ?? null;
      for (const ev of m.events ?? []) { for (const p of ev.pages ?? []) walk(p.commands); walk(ev.commands); }
    }
    if (!otherMapId) otherMapId = Object.keys(project.maps).find((id) => id !== mapId) ?? mapId;
    const speaker = "대장장이 하몬";
    const extra = [
      { kind: "choices", prompt: "무엇을 하겨나?", options: [
        { text: "철광석을 판다", branch: [{ kind: "changeGold", op: "+=", amount: 120 }, { kind: "text", speaker, body: "좋은 물건이군. 120G 를 주지." }] },
        { text: "무기를 산다", branch: [{ kind: "shop", itemIds, allowSell: true }] },
        { text: "그냥 구경한다", branch: [{ kind: "text", body: "하몬은 다시 망치를 들었다." }] },
      ] },
      { kind: "fork", condition: { kind: "switch", switchId, value: true },
        then: [{ kind: "text", speaker, body: "축제 준비는 잘 되고 있나? 광장에 등불을 달아야 해." }],
        else: [{ kind: "setSwitch", switchId, value: true }, { kind: "text", speaker, body: "다음에 오면 축제 이야기를 해 주지." }] },
      { kind: "setVariable", variableId, op: "+=", value: 1 },
      { kind: "moveEvent", eventId, route: { moves: [{ kind: "move", dir: "left" }, { kind: "move", dir: "left" }, { kind: "turn", dir: "down" }, { kind: "wait" }], repeat: false, wait: true } },
      { kind: "wait", ms: 600 },
      { kind: "transfer", mapId: otherMapId, x: 4, y: 6 },
    ];
    let where = null;
    store.update((draft) => {
      const ev = draft.maps[mapId]?.events.find((e) => e.id === eventId);
      if (!ev) return;
      const target = ev.pages?.length ? ev.pages[0].commands : ev.commands;
      target.push(...extra);
      where = ev.pages?.length ? "pages[0]" : "commands";
    });
    return { ok: where !== null, where, mapId, eventId, added: extra.length };
  });
  await page.waitForTimeout(900);
  await page.getByTestId("event-view-toggle-list").click().catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${evidenceDir}/09-readability-1440.png` });
  const readability = await editor.evaluate(() => {
    const root = document.querySelector(".event-editor-modal-window") ?? document.querySelector("[data-testid=event-editor-modal]");
    const list = root.querySelector(".cmd-list");
    if (!list) return { missing: true };
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && el.closest("[hidden]") === null;
    };
    const lum = (rgb) => {
      const m = rgb.match(/[\d.]+/g);
      if (!m) return null;
      const [r, g, b] = m.slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const alphaOf = (rgb) => { const m = rgb.match(/[\d.]+/g); return m && m.length >= 4 ? Number(m[3]) : (rgb === "transparent" ? 0 : 1); };
    const opaqueBg = (el) => {
      let n = el;
      while (n && n !== document.documentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg && alphaOf(bg) >= 0.5) return bg;
        n = n.parentElement;
      }
      return "rgb(255, 255, 255)";
    };
    const ratio = (fg, bg) => {
      const a = lum(fg); const b = lum(bg);
      if (a == null || b == null) return null;
      const [hi, lo] = a > b ? [a, b] : [b, a];
      return (hi + 0.05) / (lo + 0.05);
    };
    // 글자 수 가중 — 한 글자가 한 표. 요약 본문이 많고 번호·배지가 적으니 「읽는 글자」가 지표를 지배한다.
    const sizeChars = new Map();
    let chars = 0;
    let charsAA7 = 0;
    const lowSamples = [];
    const walker = document.createTreeWalker(list, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent || !vis(parent)) continue;
      const cs = getComputedStyle(parent);
      const n = text.length;
      chars += n;
      sizeChars.set(cs.fontSize, (sizeChars.get(cs.fontSize) ?? 0) + n);
      const r = ratio(cs.color, opaqueBg(parent));
      if (r != null && r >= 7) charsAA7 += n;
      else if (r != null && lowSamples.length < 12) lowSamples.push({ text: text.slice(0, 20), cls: String(parent.className).slice(0, 40), ratio: Math.round(r * 100) / 100 });
    }
    const sorted = [...sizeChars.entries()].map(([k, v]) => [parseFloat(k), v]).sort((a, b) => a[0] - b[0]);
    let acc = 0; let median = 0;
    for (const [size, n] of sorted) { acc += n; if (acc >= chars / 2) { median = size; break; } }
    // 상자 밀도 — 눈에 보이는 테두리를 두른 요소(면적 200px² 이상) / 보이는 명령 행.
    const items = [...list.querySelectorAll(".cmd-item")].filter(vis);
    const boxed = [];
    for (const el of list.querySelectorAll("*")) {
      if (!vis(el)) continue;
      const cs = getComputedStyle(el);
      // 네 변이 모두 보이는 테두리만 「상자」다 — 한 변만 있는 구분선·왼쪽 막대는 세지 않는다.
      const sides = [["Top", cs.borderTopWidth, cs.borderTopColor, cs.borderTopStyle], ["Right", cs.borderRightWidth, cs.borderRightColor, cs.borderRightStyle], ["Bottom", cs.borderBottomWidth, cs.borderBottomColor, cs.borderBottomStyle], ["Left", cs.borderLeftWidth, cs.borderLeftColor, cs.borderLeftStyle]];
      if (!sides.every(([, w, c, st]) => (parseFloat(w) || 0) > 0 && alphaOf(c) >= 0.08 && st !== "none")) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 200) continue;
      boxed.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")}`);
    }
    const boxedCount = new Map();
    for (const b of boxed) boxedCount.set(b, (boxedCount.get(b) ?? 0) + 1);
    // 구조 표식 — 깊이 1 행과 깊이 0 행의 왼쪽 차이(들여쓰기 폭) · 마커 줄의 글자 무게.
    const headLeft = (depth) => {
      const item = items.find((i) => i.dataset.cmdDepth === String(depth));
      const head = item?.querySelector(":scope > .cmd-head");
      return head ? head.getBoundingClientRect().left : null;
    };
    const l0 = headLeft(0); const l1 = headLeft(1);
    const indent = l0 != null && l1 != null ? Math.round(l1 - l0) : null;
    const markers = [...list.querySelectorAll(".cmd-line-marker")].filter(vis).map((m) => {
      const cs = getComputedStyle(m);
      return { text: (m.textContent ?? "").trim().slice(0, 16), weight: Number(cs.fontWeight), size: cs.fontSize, italic: cs.fontStyle === "italic" };
    });
    return {
      chars,
      medianSize: median,
      sizeShare: sorted.map(([size, n]) => [size, Math.round((n / chars) * 1000) / 10]),
      aa7Share: chars ? Math.round((charsAA7 / chars) * 1000) / 10 : 0,
      lowSamples,
      rows: items.length,
      boxed: boxed.length,
      boxesPerRow: items.length ? Math.round((boxed.length / items.length) * 100) / 100 : null,
      boxedKinds: [...boxedCount.entries()],
      indent,
      markers,
    };
  });
  record("C13", "읽는 글자(명령 요약) 글자 수 가중 중앙값 ≥ 14px", readability.medianSize >= 14, { median: readability.medianSize, share: readability.sizeShare, chars: readability.chars, injected });
  record("C14", "명령 영역 글자의 80% 이상이 대비 7:1", readability.aa7Share >= 80, { aa7Share: readability.aa7Share, low: readability.lowSamples });
  record("C15", "행당 테두리 상자 ≤ 0.3", readability.boxesPerRow != null && readability.boxesPerRow <= 0.3, { boxesPerRow: readability.boxesPerRow, boxed: readability.boxed, rows: readability.rows, kinds: readability.boxedKinds });
  record(
    "C16",
    "분기 구조가 읽힌다 — 들여쓰기 ≥ 24px, 마커 줄은 굵기 600 이상·이탤릭 없음",
    readability.indent != null && readability.indent >= 24 && readability.markers.length > 0 && readability.markers.every((m) => m.weight >= 600 && !m.italic),
    { indent: readability.indent, markers: readability.markers },
  );

  await writeFile(`${evidenceDir}/results.json`, `${JSON.stringify({ label, baseUrl, results }, null, 2)}\n`, "utf8");
} finally {
  await context.close();
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${label.toUpperCase()} :: ${results.length - failed.length}/${results.length} PASS`);
if (failed.length > 0) {
  console.log(`FAILED: ${failed.map((r) => r.id).join(", ")}`);
  process.exit(1);
}

async function openEventEditor(page) {
  // 콜드 워크트리는 vite 변환 때문에 첫 부팅이 느리다 — 캔버스가 뜰 때까지 기다린다.
  const canvas = page.getByTestId("edit-canvas").locator("canvas").last();
  // 로직 생산적으로: locator 가시성 대기 대슱 DOM 질의로 진짜 부팅을 폴링한다(워크트리 병렬 실행 시 부팅이 느리다).
  const bootDeadline = Date.now() + 240000;
  let booted = false;
  // 공유 머신에서 net::ERR_NETWORK_CHANGED 로 모듈 로드가 통째로 죽어 빈 문서(body 0자)로 4분을 기다린 적이 있다 —
  // 45초 안에 부팅이 안 보이면 다시 읽는다.
  let lastReload = Date.now();
  while (Date.now() < bootDeadline) {
    if (Date.now() - lastReload > 45000) {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      lastReload = Date.now();
    }
    booted = await page.evaluate(() => {
      const host = document.querySelector("[data-testid=edit-canvas]");
      const c = host?.querySelector("canvas");
      const layer = document.querySelector("[data-testid=layer-event]");
      return Boolean(c && c.getBoundingClientRect().width > 200 && layer && layer.getClientRects().length > 0);
    }).catch(() => false);
    if (booted) break;
    await page.waitForTimeout(2000);
  }
  if (!booted) {
    const diag = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      bodyText: (document.body?.innerText ?? "").replace(/\s+/g, " ").slice(0, 400),
      testids: [...document.querySelectorAll("[data-testid]")].map((el) => el.dataset.testid).slice(0, 60),
      canvases: [...document.querySelectorAll("canvas")].map((c) => `${Math.round(c.getBoundingClientRect().width)}x${Math.round(c.getBoundingClientRect().height)}`),
    })).catch((error) => ({ evaluateFailed: String(error).slice(0, 200) }));
    await page.screenshot({ path: `${evidenceDir}/00-boot-failure.png` }).catch(() => {});
    console.log("BOOT_DIAGNOSTIC", JSON.stringify(diag, null, 1));
    console.log("PAGE_ERRORS", JSON.stringify(pageErrors.slice(0, 10), null, 1));
    throw new Error("editor shell did not boot (edit-canvas canvas / layer-event missing)");
  }
  const layer = page.getByTestId("layer-event");
  await layer.click();
  const tool = page.locator('[data-testid="tool-event"]:visible').first();
  if (await tool.count()) await tool.click();
  const editor = page.getByTestId("event-editor-modal");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  for (const offset of [0, 32, -32]) {
    await canvas.dblclick({ position: { x: Math.floor(box.width / 2) + offset, y: Math.floor(box.height / 2) + offset } });
    if (await editor.isVisible().catch(() => false)) break;
    const open = page.getByTestId("event-editor-open");
    if (await open.isVisible().catch(() => false)) {
      await open.click();
      break;
    }
    await page.waitForTimeout(800);
  }
  await editor.waitFor({ state: "visible", timeout: 25000 });
  return editor;
}
