import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";

const EVIDENCE_DIR = ".omo/evidence/runtime-warm-skin";
const EVIDENCE_JSON = `${EVIDENCE_DIR}/dialogue-surface.json`;
const EVIDENCE_PNG = `${EVIDENCE_DIR}/dialogue-surface.png`;

function project(): Project {
  const p = createBlankProject();
  p.session.inventory = {
    item_potion: 3, item_ether: 1, item_antidote: 2, item_hi_potion: 1,
    equip_scout_dagger: 1, equip_iron_sword: 1, equip_oak_shield: 1, equip_leather_armor: 1,
  };
  p.session = { ...p.session, partyActorIds: p.database.actors.slice(0, 4).map((a) => a.id) };
  return p;
}

test("verify dialogue window renders correctly under Neo둥근모 and warm skin without clipping", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const consoleLines: string[] = [];
  page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`));

  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, project(), "/?e2eVitals=1");
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page);

  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);

  // Render comprehensive dialogue surface testing text body, speaker plate, choices prompt, choice options, and gold counter
  await page.evaluate(() => {
    const stage = document.querySelector("[data-testid='play-stage']") as HTMLElement;
    const overlay = stage.querySelector(".dialogue-overlay") as HTMLElement;
    if (!overlay) throw new Error("no dialogue-overlay found");

    overlay.className = "dialogue-overlay position-bottom choices-active";
    overlay.innerHTML = `
      <div class="dialogue-box has-speaker page-ready" data-testid="dialogue-box">
        <div class="speaker speaker-nameplate" data-testid="dialogue-speaker">마을 장로 미르</div>
        <div class="dialogue-content">
          <div class="dialogue-text-column">
            <div class="body">어서 오게나, 여행자여! 따뜻한 온기가 머무는 이슬 마을이라네. 새로운 폰트와 갈색 창 스킨이 아주 잘 어울리는구먼.</div>
          </div>
        </div>
        <div class="dialogue-page-cursor" aria-hidden="true">▼</div>
      </div>
      <div class="dialogue-box choices" data-testid="dialogue-choices">
        <div class="choice-list" role="listbox" data-testid="runtime-choices">
          <div class="choice-prompt-row">무엇을 도와드릴까요?</div>
          <button class="choice-btn selected" role="option" aria-selected="true" data-testid="runtime-choice-0">마을의 전설에 대해 묻는다</button>
          <button class="choice-btn" role="option" aria-selected="false" data-testid="runtime-choice-1">종을 복원하는 방법을 찾는다</button>
          <button class="choice-btn" role="option" aria-selected="false" data-testid="runtime-choice-2">떠난다</button>
        </div>
      </div>
      <div class="dialogue-gold-window" data-testid="dialogue-gold-window">
        <span class="dialogue-gold-label">소지금</span>
        <strong class="dialogue-gold-value">1,250 G</strong>
      </div>
    `;
  });

  const dialogueBox = page.locator(".dialogue-box").first();
  await expect(dialogueBox).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(500);

  // Take screenshot of dialogue surface
  const overlay = page.locator(".dialogue-overlay");
  await overlay.screenshot({ path: EVIDENCE_PNG });

  // Scan all visible text nodes inside .dialogue-overlay
  const report = await page.evaluate(() => {
    const overlayEl = document.querySelector(".dialogue-overlay");
    if (!(overlayEl instanceof HTMLElement)) {
      return {
        unreachable: ".dialogue-overlay element not found",
        nodes: [],
      };
    }

    const nodes: Array<{
      testid?: string;
      cls: string;
      text: string;
      family: string;
      size: string;
      scrollWidth: number;
      clientWidth: number;
      scrollHeight: number;
      clientHeight: number;
      clipX: number;
      clipY: number;
    }> = [];

    const allElements = Array.from(overlayEl.querySelectorAll<HTMLElement>("*"));
    for (const el of [overlayEl, ...allElements]) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;

      const hasDirectText = Array.from(el.childNodes).some(
        (c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? "").trim().length > 0
      );
      if (!hasDirectText) continue;

      const clipX = el.scrollWidth - el.clientWidth;
      const clipY = el.scrollHeight - el.clientHeight;

      nodes.push({
        testid: el.dataset.testid,
        cls: el.className.toString().slice(0, 80),
        text: (el.textContent ?? "").trim(),
        family: cs.fontFamily,
        size: cs.fontSize,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        clipX,
        clipY,
      });
    }

    return {
      nodes,
    };
  });

  writeFileSync(EVIDENCE_JSON, JSON.stringify(report, null, 2), "utf8");

  expect(report.nodes.length).toBeGreaterThan(0);
  for (const node of report.nodes) {
    expect(node.family).toContain("NeoDunggeunmo");
    expect(node.clipX, `Node clipped horizontally: ${node.cls} - "${node.text}" (clipX: ${node.clipX})`).toBeLessThanOrEqual(1);
    expect(node.clipY, `Node clipped vertically: ${node.cls} - "${node.text}" (clipY: ${node.clipY})`).toBeLessThanOrEqual(1);
  }
});
