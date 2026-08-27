import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { startActualPlay } from "./oprnPlayerStatusMenuHelpers";

const DIR = ".omo/evidence/esc-menu-text-clip-20260828";

async function measureTextClipping(page: Page, label: string): Promise<unknown> {
  return page.evaluate((lbl) => {
    const menu = document.querySelector("[data-testid='main-menu']");
    if (!(menu instanceof HTMLElement)) return { label: lbl, missing: true };

    const describe = (node: HTMLElement): Record<string, unknown> => ({
      testid: node.dataset.testid,
      cls: node.className?.toString().slice(0, 80),
      tag: node.tagName.toLowerCase(),
    });
    const round = (value: number): number => Math.round(value * 10) / 10;

    type Box = { left: number; top: number; right: number; bottom: number };
    const clipBoxOf = (node: HTMLElement): { box: Box; clipper?: HTMLElement } => {
      let box: Box = { left: -1e6, top: -1e6, right: 1e6, bottom: 1e6 };
      let clipper: HTMLElement | undefined;
      for (let el = node.parentElement; el; el = el.parentElement) {
        const cs = getComputedStyle(el);
        const clips = cs.overflowX !== "visible" || cs.overflowY !== "visible" || cs.clipPath !== "none";
        if (!clips) continue;
        const r = el.getBoundingClientRect();
        const next: Box = {
          left: Math.max(box.left, cs.overflowX === "visible" ? box.left : r.left),
          right: Math.min(box.right, cs.overflowX === "visible" ? box.right : r.right),
          top: Math.max(box.top, cs.overflowY === "visible" ? box.top : r.top),
          bottom: Math.min(box.bottom, cs.overflowY === "visible" ? box.bottom : r.bottom),
        };
        if (next.left > box.left || next.right < box.right || next.top > box.top || next.bottom < box.bottom) {
          clipper = clipper ?? el;
        }
        box = next;
        if (el === menu) break;
      }
      return { box, clipper };
    };

    const opaque = (cs: CSSStyleDeclaration): boolean => {
      if (cs.visibility === "hidden" || cs.display === "none") return false;
      if (Number.parseFloat(cs.opacity) < 0.55) return false;
      if (cs.backdropFilter !== "none") return true;
      const bg = cs.backgroundColor;
      const alpha = bg.startsWith("rgba") ? Number.parseFloat(bg.split(",")[3] ?? "1") : bg === "transparent" ? 0 : 1;
      return alpha >= 0.55 || cs.backgroundImage !== "none";
    };

    const stackRank = (node: HTMLElement): number => {
      let rank = 0;
      for (let el: HTMLElement | null = node; el && el !== menu; el = el.parentElement) {
        const z = Number.parseInt(getComputedStyle(el).zIndex, 10);
        if (Number.isFinite(z)) rank = Math.max(rank, z);
      }
      return rank;
    };

    const painted = Array.from(menu.querySelectorAll<HTMLElement>("*")).filter((node) => {
      const r = node.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && opaque(getComputedStyle(node));
    });

    const clipped: unknown[] = [];
    const truncated: unknown[] = [];
    const covered: unknown[] = [];

    for (const node of Array.from(menu.querySelectorAll<HTMLElement>("*"))) {
      const cs = getComputedStyle(node);
      if (cs.visibility === "hidden" || cs.display === "none" || Number.parseFloat(cs.opacity) === 0) continue;
      const ownTexts = Array.from(node.childNodes).filter(
        (child) => child.nodeType === 3 && (child.textContent ?? "").trim().length > 0,
      );
      if (ownTexts.length === 0) continue;
      const text = (node.textContent ?? "").trim().slice(0, 46);

      const range = document.createRange();
      range.selectNodeContents(node);
      const ink = range.getBoundingClientRect();
      if (ink.width === 0 || ink.height === 0) continue;

      const { box, clipper } = clipBoxOf(node);
      const cut = {
        left: round(box.left - ink.left),
        right: round(ink.right - box.right),
        top: round(box.top - ink.top),
        bottom: round(ink.bottom - box.bottom),
      };
      const worst = Math.max(cut.left, cut.right, cut.top, cut.bottom);
      if (worst > 0.6) {
        clipped.push({
          ...describe(node),
          text,
          cut,
          ink: { x: round(ink.left), y: round(ink.top), w: round(ink.width), h: round(ink.height) },
          clip: { left: round(box.left), top: round(box.top), right: round(box.right), bottom: round(box.bottom) },
          clipper: clipper ? describe(clipper) : undefined,
          font: cs.fontSize,
          whiteSpace: cs.whiteSpace,
          lineClamp: cs.webkitLineClamp,
        });
      }

      const ox = node.scrollWidth - node.clientWidth;
      const oy = node.scrollHeight - node.clientHeight;
      if (ox > 1 || oy > 1) {
        truncated.push({
          ...describe(node),
          text,
          overflow: { x: ox, y: oy },
          style: `${cs.overflowX}/${cs.overflowY}/${cs.textOverflow}/${cs.whiteSpace}`,
          lineClamp: cs.webkitLineClamp,
        });
      }

      for (const other of painted) {
        if (other === node || other.contains(node) || node.contains(other)) continue;
        const r = other.getBoundingClientRect();
        const ix = Math.min(ink.right, r.right) - Math.max(ink.left, r.left);
        const iy = Math.min(ink.bottom, r.bottom) - Math.max(ink.top, r.top);
        if (ix <= 1 || iy <= 1) continue;
        const ratio = (ix * iy) / (ink.width * ink.height);
        if (ratio < 0.12) continue;
        const laterInDom = (node.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        const rank = stackRank(other) - stackRank(node);
        if (rank < 0 || (rank === 0 && !laterInDom)) continue;
        covered.push({
          ...describe(node),
          text,
          ratio: round(ratio),
          by: describe(other),
          byRect: { x: round(r.left), y: round(r.top), w: round(r.width), h: round(r.height) },
          zDelta: rank,
        });
      }
    }
    return { label: lbl, clipped, truncated, covered };
  }, label);
}

async function shot(page: Page, name: string): Promise<void> {
  const stage = page.getByTestId("play-stage");
  if (await stage.count()) await stage.first().screenshot({ path: `${DIR}/${name}.png` });
  else await page.screenshot({ path: `${DIR}/${name}.png` });
}

const GROUP_OF: Readonly<Record<string, string>> = {
  status: "party-menu",
  row: "party-menu",
  formation: "party-menu",
  quests: "record-menu",
  save: "system-menu",
  load: "system-menu",
};

async function openCommand(page: Page, cmd: string): Promise<boolean> {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(320);
  if ((await page.getByTestId("main-menu").count()) === 0) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(320);
  }
  const group = GROUP_OF[cmd];
  if (group) {
    const railGroup = page.getByTestId(`status-menu-command-${group}`);
    if (!(await railGroup.count())) return false;
    await railGroup.first().click();
    await page.waitForTimeout(220);
    const sub = page.getByTestId(`status-menu-group-command-${cmd}`);
    if (!(await sub.count())) return false;
    await sub.first().click();
  } else {
    const rail = page.getByTestId(`status-menu-command-${cmd}`);
    if (!(await rail.count())) return false;
    await rail.first().click();
  }
  await page.waitForTimeout(380);
  return true;
}

test("audit: status menu text clipping with seeded content", async ({ page }) => {
  test.setTimeout(300_000);
  mkdirSync(DIR, { recursive: true });
  const report: Record<string, unknown> = {};

  await startActualPlay(page);
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(900);

  const sizes = [
    { width: 1280, height: 900 },
    { width: 960, height: 640 },
  ];

  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.waitForTimeout(600);
    const tag = `${size.width}x${size.height}`;

    for (const cmd of ["items", "skills", "equipment", "status", "row", "formation", "quests", "save"]) {
      const opened = await openCommand(page, cmd);
      if (!opened) {
        report[`${cmd}@${tag}`] = { error: "command missing" };
        continue;
      }
      await shot(page, `${tag}-${cmd}`);
      report[`${cmd}@${tag}`] = await measureTextClipping(page, `${cmd}@${tag}`);

      const drill: Record<string, string[]> = {
        items: ["status-menu-item-item_potion"],
        skills: ["status-menu-skill-actor-actor_hero"],
        equipment: ["status-menu-equipment-actor-actor_hero"],
      };
      for (const testid of drill[cmd] ?? []) {
        const target = page.getByTestId(testid);
        if (!(await target.count())) continue;
        await target.first().click();
        await page.waitForTimeout(360);
        await shot(page, `${tag}-${cmd}-drill`);
        report[`${cmd}-drill@${tag}`] = await measureTextClipping(page, `${cmd}-drill@${tag}`);
        if (cmd === "equipment") {
          const slot = page.getByTestId("status-menu-equipment-slot-weapon");
          if (await slot.count()) {
            await slot.first().click();
            await page.waitForTimeout(360);
            await shot(page, `${tag}-equipment-candidates`);
            report[`equipment-candidates@${tag}`] = await measureTextClipping(page, `equipment-candidates@${tag}`);
          }
        }
      }
    }
  }

  writeFileSync(`${DIR}/report.json`, JSON.stringify(report, null, 2));

  const summary = Object.entries(report).map(([key, value]) => {
    const v = value as { clipped?: unknown[]; truncated?: unknown[]; covered?: unknown[]; error?: string };
    return `${key}: clipped=${v.clipped?.length ?? "-"} truncated=${v.truncated?.length ?? "-"} covered=${v.covered?.length ?? "-"} ${v.error ?? ""}`;
  });
  writeFileSync(`${DIR}/summary.txt`, summary.join("\n"));
  console.log(summary.join("\n"));
});
