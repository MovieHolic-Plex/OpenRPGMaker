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
  const brass = rgCount("#d9a441", [
    "src/styles/editor/event-editor.css",
    "src/styles/editor/event-editor.mockup.css",
    "src/styles/editor/event-editor.balanced.css",
    "src/styles/editor/event-editor.modernize.css",
    "src/styles/editor/event-editor.modern",
  ]).filter((line) => !line.includes("var(--warning"));
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
  while (Date.now() < bootDeadline) {
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
