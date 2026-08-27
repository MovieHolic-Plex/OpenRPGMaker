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

    const visibleBoxOf = (node: HTMLElement, rect: DOMRect | Box): Box | null => {
      const { box } = clipBoxOf(node);
      const v: Box = {
        left: Math.max(box.left, rect.left),
        top: Math.max(box.top, rect.top),
        right: Math.min(box.right, rect.right),
        bottom: Math.min(box.bottom, rect.bottom),
      };
      return v.right - v.left > 1 && v.bottom - v.top > 1 ? v : null;
    };

    const painted = Array.from(menu.querySelectorAll<HTMLElement>("*"))
      .map((node) => {
        const r = node.getBoundingClientRect();
        if (r.width <= 2 || r.height <= 2 || !opaque(getComputedStyle(node))) return null;
        const v = visibleBoxOf(node, r);
        return v ? { node, v } : null;
      })
      .filter((entry): entry is { node: HTMLElement; v: Box } => entry !== null);

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
      const scrollFold = (() => {
        for (let el = node.parentElement; el; el = el.parentElement) {
          const cs2 = getComputedStyle(el);
          if (cs2.overflowY === "auto" || cs2.overflowY === "scroll") return el.scrollHeight > el.clientHeight + 1;
          if (el === menu) break;
        }
        return false;
      })();
      const worst = Math.max(cut.left, cut.right, cut.top, cut.bottom);
      if (worst > 0.6 && !(scrollFold && cut.bottom === worst)) {
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

      const inkVisible = visibleBoxOf(node, ink);
      if (!inkVisible) continue;
      const inkVisibleArea = (inkVisible.right - inkVisible.left) * (inkVisible.bottom - inkVisible.top);

      for (const { node: other, v: r } of painted) {
        if (other === node || other.contains(node) || node.contains(other)) continue;
        const ix = Math.min(inkVisible.right, r.right) - Math.max(inkVisible.left, r.left);
        const iy = Math.min(inkVisible.bottom, r.bottom) - Math.max(inkVisible.top, r.top);
        if (ix <= 1 || iy <= 1) continue;
        const ratio = (ix * iy) / inkVisibleArea;
        if (ratio < 0.12) continue;
        const laterInDom = (node.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        const rank = stackRank(other) - stackRank(node);
        if (rank < 0 || (rank === 0 && !laterInDom)) continue;
        covered.push({
          ...describe(node),
          text,
          ratio: round(ratio),
          by: describe(other),
          byRect: { x: round(r.left), y: round(r.top), w: round(r.right - r.left), h: round(r.bottom - r.top) },
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

  const sizes = (process.env.CLIP_AUDIT_SIZES ?? "1280x900")
    .split(",")
    .map((entry) => entry.split("x").map((n) => Number.parseInt(n, 10)))
    .map(([width, height]) => ({ width: width ?? 1280, height: height ?? 900 }));
  const persist = (): void => {
    writeFileSync(`${DIR}/report-${sizes.map((s2) => `${s2.width}x${s2.height}`).join("_")}.json`, JSON.stringify(report, null, 2));
  };

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
      persist();

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
        persist();
        if (cmd === "equipment") {
          const slot = page.getByTestId("status-menu-equipment-slot-weapon");
          if (await slot.count()) {
            await slot.first().click();
            await page.waitForTimeout(360);
            await shot(page, `${tag}-equipment-candidates`);
            report[`equipment-candidates@${tag}`] = await measureTextClipping(page, `equipment-candidates@${tag}`);
            persist();
          }
        }
      }
    }
  }

  persist();

  const summary = Object.entries(report).map(([key, value]) => {
    const v = value as { clipped?: unknown[]; truncated?: unknown[]; covered?: unknown[]; error?: string };
    return `${key}: clipped=${v.clipped?.length ?? "-"} truncated=${v.truncated?.length ?? "-"} covered=${v.covered?.length ?? "-"} ${v.error ?? ""}`;
  });
  writeFileSync(`${DIR}/summary.txt`, summary.join("\n"));
  console.log(summary.join("\n"));
});
