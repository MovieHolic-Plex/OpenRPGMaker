import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const shotDir = resolve(root, "verify-shots/tileset-ux-audit");
mkdirSync(shotDir, { recursive: true });

const notes = [];
const shots = [];

function note(id, severity, text, extra = {}) {
  notes.push({ id, severity, text, ...extra });
  console.log(`[${severity}] ${id}: ${text}`);
}

async function shot(page, name) {
  const path = resolve(shotDir, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  shots.push(path);
  console.log("shot", name);
}

async function geom(page, selector) {
  return page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      text: (el.innerText || "").slice(0, 240),
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      overflow: cs.overflow,
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      clip: cs.clipPath || cs.clip,
      visibility: cs.visibility,
      display: cs.display,
      opacity: cs.opacity,
      color: cs.color,
      bg: cs.backgroundColor,
      fontSize: cs.fontSize,
      scrollW: el.scrollWidth,
      scrollH: el.scrollHeight,
      clientW: el.clientWidth,
      clientH: el.clientHeight,
    };
  });
}

async function overflow(page, selector) {
  return page.locator(selector).first().evaluate((el) => ({
    overflowX: el.scrollWidth - el.clientWidth,
    overflowY: el.scrollHeight - el.clientHeight,
    clientW: el.clientWidth,
    clientH: el.clientHeight,
    scrollW: el.scrollWidth,
    scrollH: el.scrollHeight,
  }));
}

async function openTileset(page) {
  await page.goto("http://127.0.0.1:9841/?freshProject=1", { waitUntil: "domcontentloaded" });
  await page.getByTestId("authoring-task-data").click();
  await page.getByTestId("db-tab-group-world").waitFor({ state: "attached" });
  await page.getByTestId("db-tab-group-world").click();
  await page.waitForTimeout(250);
  await page.getByTestId("db-tab-tilesets").click({ force: true });
  await page.getByTestId("tileset-passage-blocked").waitFor();
}

const browser = await chromium.launch({ headless: false, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(20000);

try {
  await openTileset(page);
  await shot(page, "01-passage-landing");

  const visibleTestids = await page.evaluate(() =>
    [...document.querySelectorAll("[data-testid]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((el) => el.getAttribute("data-testid"))
      .filter((id) => id && (id.startsWith("tileset-") || id.startsWith("db-tab-tileset"))),
  );
  console.log("visible tileset testids", visibleTestids.join(", "));

  const tools = await geom(page, '[data-testid="tileset-rule-passage"]');
  const hint = await geom(page, ".tileset-passage-paint-hint");
  const legend = await page.locator('[data-testid="tileset-rule-passage"] legend').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { text: el.textContent, w: r.width, h: r.height, clip: cs.clip, overflow: cs.overflow, fontSize: cs.fontSize };
  });
  console.log("tools", tools);
  console.log("hint", hint);
  console.log("legend", legend);
  if (legend.h < 4 || legend.w < 4) note("passage-legend-clipped", "high", "붓 fieldset legend 가 잘려 안 보인다", legend);
  if (hint.h > 4 && legend.text && hint.text.includes("클릭")) {
    note("passage-hint-duplicate", "med", "legend와 힌트가 같은 말을 두 번 한다", { legend: legend.text, hint: hint.text });
  }

  const toolboxOverflow = await overflow(page, ".tileset-db-tools");
  console.log("toolbox overflow", toolboxOverflow);
  if (toolboxOverflow.overflowX > 8) note("passage-tools-overflow-x", "high", "통행 툴바가 가로로 넘친다", toolboxOverflow);

  const inspectorOverflow = await overflow(page, '[data-testid="tileset-selected-tile-panel"]');
  console.log("inspector overflow", inspectorOverflow);
  if (inspectorOverflow.overflowY > 40) note("passage-inspector-scroll", "med", "통행 인스펙터가 길어 스크롤이 필요하다", inspectorOverflow);

  const grassBefore = await page.locator('[data-testid="tileset-db-cell-240"]').getAttribute("class");
  await page.getByTestId("tileset-passage-blocked").click();
  const grassAfterBrush = await page.locator('[data-testid="tileset-db-cell-240"]').getAttribute("class");
  if (grassBefore !== grassAfterBrush) {
    note("brush-paints-selected", "high", "막힘 붓만 눌렀는데 잔디 칸 클래스가 바뀌었다", { grassBefore, grassAfterBrush });
  } else {
    note("brush-select-only", "ok", "막힘 붓만 눌러도 잔디는 그대로다");
  }

  await page.locator('[data-testid="tileset-db-cell-240"]').click();
  const grassPainted = await page.locator('[data-testid="tileset-db-cell-240"]').getAttribute("class");
  console.log("grass painted", grassPainted);
  if (!grassPainted?.includes("mark-x")) note("paint-click-failed", "high", "잔디를 눌렀는데 막힘 X가 안 찍혔다", { grassPainted });
  await shot(page, "02-passage-blocked-grass");

  await page.getByTestId("tileset-passage-star").click();
  await page.locator('[data-testid="tileset-db-cell-241"]').click();
  const starClass = await page.locator('[data-testid="tileset-db-cell-241"]').getAttribute("class");
  if (!starClass?.includes("mark-star")) note("star-paint-failed", "high", "위표시 칠이 안 먹었다", { starClass });
  else note("star-paint-ok", "ok", "위표시 붓으로 옆 칸에 ★가 찍힌다");

  await page.getByTestId("tileset-passage-open").click();
  await page.locator('[data-testid="tileset-db-cell-240"]').click();
  const grassOpen = await page.locator('[data-testid="tileset-db-cell-240"]').getAttribute("class");
  if (grassOpen?.includes("mark-x")) note("open-paint-failed", "high", "통과 붓으로 잔디 X가 안 지워졌다", { grassOpen });

  const box = await page.locator('[data-testid="tileset-db-cell-270"]').boundingBox();
  const box2 = await page.locator('[data-testid="tileset-db-cell-273"]').boundingBox();
  if (box && box2) {
    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box2.x + 4, box2.y + 4, { steps: 8 });
    await page.mouse.up();
  }
  await shot(page, "03-passage-drag");

  await page.getByTestId("tileset-layer-filter-upper").click();
  await shot(page, "04-passage-layer-upper");
  await page.getByTestId("tileset-layer-filter-all").click();
  await page.getByTestId("tileset-preview-scale-4").click();
  await shot(page, "05-passage-scale-4");
  await page.getByTestId("tileset-preview-scale-2").click();

  await page.getByTestId("tileset-layer-auto").click();
  await page.getByTestId("tileset-layer-lower").click();
  await page.getByTestId("tileset-layer-upper").click();
  await page.getByTestId("tileset-layer-auto").click();
  note("layer-buttons-ok", "ok", "레이어 자동/하위/상위 버튼이 눌린다");

  const labelVisible = await page.getByTestId("tileset-field-ai-label").isVisible().catch(() => false);
  if (labelVisible) note("passage-label-clutter", "med", "통행 면에 라벨 입력칸이 그대로 있어 통행 작업과 섞인다");

  const details = page.getByTestId("tileset-passage-compass-details");
  await details.locator("summary").click();
  const compassOpenBefore = await details.evaluate((el) => el.hasAttribute("open") || el.open);
  await page.getByTestId("tileset-knowledge-passage-up").click({ force: true });
  const compassOpenAfter = await details.evaluate((el) => el.hasAttribute("open") || el.open);
  console.log("compass open before/after up click", compassOpenBefore, compassOpenAfter);
  if (compassOpenBefore && !compassOpenAfter) {
    note("compass-closes-on-click", "high", "방향별 통행을 눌러도 다시 접혀서 연속으로 방향을 못 고친다");
  }
  await shot(page, "06-passage-compass");
  await details.locator("summary").click({ force: true }).catch(() => {});
  await page.getByTestId("tileset-knowledge-passage-left").click({ force: true });
  const compassAfter = await page.getByTestId("tileset-knowledge-passage-up").getAttribute("class");
  console.log("compass up class", compassAfter);

  const fullSheet = page.getByTestId("tileset-settings-open");
  if (await fullSheet.count()) {
    await fullSheet.click();
    await page.getByTestId("tileset-settings-modal").waitFor();
    await shot(page, "07-passage-fullsheet");
    const modalText = await page.locator(".tileset-settings-window").innerText();
    if (modalText.includes("클릭하면 O → X → ★")) {
      note("fullsheet-cycle-vs-brush", "high", "전체창은 칸마다 O→X→★ 순환인데 본문은 붓이다. 같은 일을 두 방식으로 한다");
    }
    await page.getByTestId("tileset-settings-close").click();
  } else {
    note("fullsheet-missing", "med", "통행 면에서 전체창 버튼이 없다");
  }

  const innerTabs = await page.evaluate(() =>
    [...document.querySelectorAll("[data-testid^='tileset-section-tab']")].map((el) => ({
      id: el.getAttribute("data-testid"),
      text: el.textContent,
      hidden: el.hasAttribute("hidden") || getComputedStyle(el).display === "none",
    })),
  );
  console.log("inner tabs", innerTabs);

  await page.getByTestId("db-tab-tileset-autotile").click({ force: true });
  await page.getByTestId("tileset-autotile-editor").waitFor();
  await shot(page, "08-autotile-landing");

  const autoTestids = await page.evaluate(() =>
    [...document.querySelectorAll("[data-testid]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((el) => el.getAttribute("data-testid"))
      .filter((id) => id && id.startsWith("tileset-")),
  );
  console.log("autotile visible", autoTestids.join(", "));

  const sidebar = await overflow(page, ".tileset-autotile-sidebar, .tileset-db-edit-sidebar");
  console.log("autotile sidebar overflow", sidebar);
  if (sidebar.overflowY > 80) note("autotile-sidebar-scroll", "high", "오토타일 사이드바가 길어서 격자가 스크롤 아래로 밀린다", sidebar);

  const toolbar = await geom(page, '[data-testid="tileset-autotile-toolbar"]');
  const toolbarOverflow = await overflow(page, '[data-testid="tileset-autotile-toolbar"]');
  console.log("autotile toolbar", toolbar, toolbarOverflow);
  if (toolbarOverflow.overflowX > 8) note("autotile-toolbar-overflow", "high", "형식 카드가 가로로 넘친다", toolbarOverflow);

  const cards = await page.locator(".tileset-autotile-layout-card").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const strong = el.querySelector("strong")?.getBoundingClientRect();
      const span = el.querySelector("span")?.getBoundingClientRect();
      return {
        text: el.innerText.replace(/\s+/g, " ").trim(),
        w: Math.round(r.width),
        h: Math.round(r.height),
        strongH: strong ? Math.round(strong.height) : 0,
        blurbH: span ? Math.round(span.height) : 0,
        blurbClip: span ? getComputedStyle(span).overflow : "",
      };
    }),
  );
  console.log("layout cards", cards);
  if (cards.some((c) => c.h < 40 || c.blurbH < 8)) {
    note("layout-cards-cramped", "high", "9칸/11칸 카드가 너무 낮아 설명 글이 안 보인다", { cards });
  }

  const previewTitle = await page.locator(".tileset-db-preview-title").innerText().catch(() => "");
  const hintText = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("preview title", previewTitle, "hint", hintText);
  if (previewTitle && hintText && previewTitle === hintText) {
    note("autotile-hint-duplicate", "med", "시트 제목과 툴바 힌트가 같은 문장이다");
  }

  await page.getByTestId("tileset-autotile-layout-cells-9").click();
  const hint9 = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("hint after 9", hint9);
  await shot(page, "09-autotile-pick-9");

  await page.locator('[data-testid="tileset-db-cell-33"]').hover();
  await page.waitForTimeout(150);
  const hoverCount = await page.locator(".autotile-hover").count();
  console.log("hover cells", hoverCount);
  if (hoverCount < 3) note("hover-preview-weak", "med", `9칸 호버 미리보기가 ${hoverCount}칸만 강조된다`);
  await shot(page, "10-autotile-hover-9");

  await page.locator('[data-testid="tileset-db-cell-33"]').click();
  const afterCreate = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("after create 9", afterCreate);
  await shot(page, "11-autotile-created-9");

  await page.getByTestId("tileset-autotile-layout-cells-11").click();
  await page.locator('[data-testid="tileset-db-cell-36"]').click();
  const after11 = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("after create 11", after11);
  await shot(page, "12-autotile-created-11");

  await page.getByTestId("tileset-autotile-more-formats").click();
  await shot(page, "13-autotile-extra-formats");
  await page.getByTestId("tileset-autotile-layout-cells-6").click();
  const hint6 = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("hint 6", hint6);
  await page.getByTestId("tileset-autotile-layout-animated-water").click();
  const hintWater = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("hint water", hintWater);
  await page.getByTestId("tileset-autotile-layout-animated-water").click();

  const dirt = page.getByTestId("tileset-autotile-group-builtin_dirt_road");
  if (await dirt.count()) {
    await dirt.click();
    await shot(page, "14-autotile-builtin-dirt");
    const composerText = await page.locator(".tileset-autotile-composer").innerText();
    console.log("dirt composer head", composerText.slice(0, 280));
    const nameDisabled = await page.getByTestId("tileset-autotile-name-builtin_dirt_road").isDisabled();
    if (nameDisabled) note("builtin-name-locked", "med", "내장 그룹 이름이 잠겨 있어 고치려면 편집 버튼이 한 단계 더 필요하다");
    const editBtn = page.getByTestId("tileset-autotile-edit-builtin");
    if (await editBtn.count()) {
      await editBtn.click();
      await shot(page, "15-autotile-edit-builtin");
    }
  }

  await page.getByTestId("tileset-autotile-passage-blocked").click();
  const blockHint = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("block passage", blockHint);
  await shot(page, "16-autotile-block-passage");
  await page.getByTestId("tileset-autotile-passage-open").click();
  await page.getByTestId("tileset-autotile-passage-star").click();
  await page.getByTestId("tileset-autotile-passage-open").click();

  const slot = page.locator('[data-testid^="tileset-autotile-slot-"]').first();
  await slot.click();
  const slotHint = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("slot hint", slotHint);
  await page.locator('[data-testid="tileset-db-cell-50"]').click();
  const afterSlot = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("after slot assign", afterSlot);
  await shot(page, "17-autotile-slot-assign");

  const pickBlock = page.getByTestId("tileset-autotile-pick-block");
  if (await pickBlock.count()) {
    await pickBlock.click();
    const pickHint = await page.getByTestId("tileset-autotile-hint").innerText();
    console.log("pick block hint", pickHint);
    await page.locator('[data-testid="tileset-db-cell-63"]').click();
    await shot(page, "18-autotile-repick-block");
  }

  await page.getByTestId("tileset-autotile-layout-custom").click();
  await shot(page, "19-autotile-custom");
  const customHint = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("custom", customHint);
  const customGroups = await page.locator('[data-testid^="tileset-autotile-group-"]').count();
  console.log("group count", customGroups);

  const advanced = page.locator('[data-testid^="tileset-autotile-advanced-"]').first();
  if (await advanced.count()) {
    await advanced.locator("summary").click();
    await shot(page, "20-autotile-advanced");
    const advOverflow = await overflow(page, ".tileset-autotile-sidebar, .tileset-db-edit-sidebar");
    if (advOverflow.overflowY > 120) {
      note("advanced-buries-grid", "high", "고급 비트마스크를 열면 사이드바가 더 길어져 격자가 사라진다", advOverflow);
    }
  }

  await page.getByTestId("tileset-autotile-seed").click();
  const seedHint = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("seed", seedHint);
  await shot(page, "21-autotile-seed");

  const composerVsList = await page.evaluate(() => {
    const list = document.querySelector('[data-testid="tileset-autotile-list"]');
    const composer = document.querySelector('[data-testid^="tileset-autotile-composer-"]');
    if (!list || !composer) return null;
    const lr = list.getBoundingClientRect();
    const cr = composer.getBoundingClientRect();
    return { listY: Math.round(lr.y), composerY: Math.round(cr.y), listH: Math.round(lr.height), composerH: Math.round(cr.height) };
  });
  console.log("composer vs list", composerVsList);
  if (composerVsList && composerVsList.listY < composerVsList.composerY) {
    note("composer-below-list", "high", "그룹 칩 목록이 격자보다 위에 있어, 실제로 편집하는 격자가 스크롤 아래다", composerVsList);
  }

  const groupChipW = await page.locator(".tileset-autotile-group-chip").first().evaluate((el) => {
    const name = el.querySelector(".tileset-autotile-group-name");
    return {
      chipW: Math.round(el.getBoundingClientRect().width),
      name: name?.textContent,
      nameOverflow: name ? name.scrollWidth - name.clientWidth : 0,
    };
  }).catch(() => null);
  console.log("group chip", groupChipW);

  await page.getByTestId("tileset-layer-filter-lower").click();
  await page.getByTestId("tileset-preview-scale-3").click();
  await shot(page, "22-autotile-scale-filter");

  const scrollBtns = await page.locator(".tileset-db-preview-scale button.scroll").count();
  console.log("scroll buttons", scrollBtns);
  if (scrollBtns === 0) note("autotile-no-scroll-btns", "low", "오토타일 시트에 화살표 스크롤이 없다");
  else {
    await page.locator(".tileset-db-preview-scale button.scroll").first().click();
  }

  const sectionTabs = await page.locator('[data-testid^="tileset-section-tab"]').all();
  for (const tab of sectionTabs) {
    const id = await tab.getAttribute("data-testid");
    const vis = await tab.isVisible();
    console.log("section tab", id, vis);
  }
  const composeTab = page.getByTestId("tileset-section-tab-compose");
  if (await composeTab.count()) {
    await page.getByTestId("db-tab-tilesets").click({ force: true });
    await page.getByTestId("tileset-passage-blocked").waitFor();
    if (await composeTab.isVisible()) {
      await composeTab.click();
      await shot(page, "23-inner-compose-tab");
      note("inner-compose-duplicate", "med", "세계 폴더의 오토타일 설정과 안쪽 구성 탭이 같은 면을 두 길로 연다");
    }
  }

  await page.setViewportSize({ width: 1100, height: 720 });
  await page.getByTestId("db-tab-tilesets").click({ force: true });
  await shot(page, "24-passage-narrow");
  const narrowTools = await overflow(page, ".tileset-db-tools");
  if (narrowTools.overflowX > 8) note("passage-narrow-overflow", "high", "좁은 창에서 통행 붓이 잘린다", narrowTools);
  await page.getByTestId("db-tab-tileset-autotile").click({ force: true });
  await shot(page, "25-autotile-narrow");
  const narrowCards = await overflow(page, '[data-testid="tileset-autotile-toolbar"]');
  if (narrowCards.overflowX > 8) note("autotile-narrow-overflow", "high", "좁은 창에서 형식 카드가 잘린다", narrowCards);

} catch (err) {
  note("audit-crash", "high", String(err?.stack || err));
  await shot(page, "99-crash").catch(() => {});
} finally {
  const out = { notes, shots };
  writeFileSync(resolve(shotDir, "NOTES.json"), JSON.stringify(out, null, 2));
  console.log("\n==== SUMMARY ====");
  for (const n of notes) console.log(`${n.severity}\t${n.id}\t${n.text}`);
  await browser.close();
}
