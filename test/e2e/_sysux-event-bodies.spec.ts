import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";
import { openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const DIR = "output/evidence/sysux-before";
const BASE = "C:/Users/USER/Downloads/rpg-zzu-system-ux/output/evidence/sysux-before";

type BodyAudit = {
  commandId: string;
  title: string;
  visibleEnabledControls: number;
  zeroSizeOrHiddenControls: string[];
  previewSelectorExists: boolean;
  previewBodyExists: boolean;
  previewTextLines: number;
  previewRendersBeyondOneLine: boolean;
  error?: string;
};

const COMMANDS: ReadonlyArray<{ id: string; title: string; fields?: Record<string, unknown> }> = [
  { id: "m2-067-key-input-processing", title: "Key Input Processing" },
  { id: "m2-046-tint-screen", title: "Tint Screen" },
  { id: "m2-047-flash-screen", title: "Flash Screen" },
  { id: "m2-048-shake-screen", title: "Shake Screen" },
  { id: "m2-049-scroll-map", title: "Scroll Map" },
  { id: "m2-050-set-weather-effects", title: "Set Weather Effects", fields: { value: "fog", intensity: 0.8 } },
  { id: "m2-069-change-parallax-back", title: "Change Parallax Back" },
  { id: "m2-044-hide-screen", title: "Hide Screen" },
  { id: "m2-045-show-screen", title: "Show Screen" },
  { id: "m2-076-open-save-menu", title: "Open Save Menu" },
  { id: "m2-029-change-system-graphic", title: "Change System Graphic" },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});
test.setTimeout(180_000);

function sysUxProject() {
  const project = createBlankProject();
  const mapId = project.startMapId!;
  const cmds: Command[] = COMMANDS.map((c) => ({
    kind: "m2Command",
    commandId: c.id,
    fields: (c.fields ?? {}) as never,
  }));
  project.maps[mapId]!.events = [{
    id: "ev_sysux", name: "시스템/연출 M2 커맨드 점검", x: 5, y: 5,
    trigger: { kind: "action" }, commands: [],
    pages: [{ id: "p1", name: "p1", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: cmds }],
  }];
  return { project, eventId: "ev_sysux" };
}

async function auditPreview(page: Page) {
  return page.evaluate(() => {
    const lines = (node: Element | null): number => {
      if (!node) return 0;
      return node.textContent?.trim().split(/\n+/).filter(Boolean).length ?? 0;
    };
    // 요구된 셀렉터: [data-testid$="-preview"] — 제품은 event-command-preview-body 를 쓰므로 둘 다 본다.
    const legacy = document.querySelector<HTMLElement>('[data-testid$="-preview"]');
    const body = document.querySelector<HTMLElement>('[data-testid="event-command-preview-body"]');
    let beyondOneLine = false;
    if (body) {
      const visualChildren = Array.from(body.children).filter((c) => !c.classList.contains("ecp-caption"));
      const rich = visualChildren.some((c) => c.querySelector("img,canvas,svg,[data-testid^='ecp-pattern'],[data-testid='ecp-message-window']") !== null);
      beyondOneLine = rich || visualChildren.length > 1 || lines(body) > 1;
    }
    return {
      previewSelectorExists: legacy !== null,
      previewBodyExists: body !== null,
      previewTextLines: lines(body),
      previewRendersBeyondOneLine: beyondOneLine,
    };
  });
}

test("sysux before-evidence: M2 시스템/연출 커맨드 편집 바디 스캔", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1500, height: 1000 });

  const { project, eventId } = sysUxProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  // 기본 보기는 스토리보드 — cmd-list 가 보이는 목록 보기로 전환해야 편집 바디를 클릭할 수 있다.
  const listToggle = modal.getByTestId("event-view-toggle-list");
  if (await listToggle.count() && (await listToggle.getAttribute("aria-pressed")) !== "true") {
    await listToggle.click();
    await page.waitForTimeout(400);
  }

  const inspector = modal.getByTestId("event-editor-inspector");
  const items = modal.locator('[data-testid="event-command-m2Command"]');
  await expect(items).toHaveCount(COMMANDS.length);

  const audits: BodyAudit[] = [];
  for (let i = 0; i < COMMANDS.length; i++) {
    const meta = COMMANDS[i]!;
    const entry: BodyAudit = {
      commandId: meta.id,
      title: meta.title,
      visibleEnabledControls: 0,
      zeroSizeOrHiddenControls: [],
      previewSelectorExists: false,
      previewBodyExists: false,
      previewTextLines: 0,
      previewRendersBeyondOneLine: false,
    };
    try {
      const head = items.nth(i).locator(".cmd-head");
      await head.scrollIntoViewIfNeeded().catch(() => {});
      await head.click();
      const bodyEl = inspector.getByTestId("event-inspector-body");
      await expect(bodyEl).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(350);

      // full modal shot + body element shot
      await modal.screenshot({ path: `${BASE}/${meta.id}.png` });
      await bodyEl.screenshot({ path: `${BASE}/${meta.id}-body.png` });

      const dom = await page.evaluate((scopeSel) => {
        const scope = document.querySelector(scopeSel);
        const controls = scope
          ? Array.from(scope.querySelectorAll<HTMLElement>("button,input,select,textarea,[role]"))
          : [];
        const visibleEnabled = controls.filter((c) => {
          if ((c as HTMLButtonElement | HTMLInputElement).disabled) return false;
          if (c.getAttribute("aria-disabled") === "true") return false;
          const r = c.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;
          const st = getComputedStyle(c);
          return st.visibility !== "hidden" && st.display !== "none";
        });
        const bad = controls
          .filter((c) => !visibleEnabled.includes(c))
          .slice(0, 10)
          .map((c) => `${c.tagName.toLowerCase()}${c.getAttribute("data-testid") ? `[${c.getAttribute("data-testid")}]` : ""}${c.getAttribute("aria-disabled") === "true" ? "[aria-disabled]" : ""}`);
        return { count: visibleEnabled.length, bad };
      }, '[data-testid="event-editor-inspector"] [data-testid="event-inspector-body"]');

      entry.visibleEnabledControls = dom.count;
      entry.zeroSizeOrHiddenControls = dom.bad;
      Object.assign(entry, await auditPreview(page));
    } catch (err) {
      entry.error = String(err).slice(0, 300);
    }
    audits.push(entry);
  }

  await writeFile(`${DIR}/audit-report.json`, JSON.stringify({ capturedAt: new Date().toISOString(), commands: audits }, null, 2), "utf8");

  const md = [
    "# 시스템/연출 M2 커맨드 편집 바디 — BEFORE 감사",
    "",
    "| command | 보이는 활성 컨트롤 | 0크기/숨김 컨트롤 | preview([data-testid$=-preview]) | preview-body | 프리뷰 줄 수 | 프리뷰 1줄 초과 렌더 | 비고 |",
    "|---|---|---|---|---|---|---|---|",
    ...audits.map((a) =>
      `| ${a.commandId} (${a.title}) | ${a.visibleEnabledControls} | ${a.zeroSizeOrHiddenControls.length ? a.zeroSizeOrHiddenControls.join(", ") : "없음"} | ${a.previewSelectorExists} | ${a.previewBodyExists} | ${a.previewTextLines} | ${a.previewRendersBeyondOneLine} | ${a.error ?? "-"} |`
    ),
    "",
  ].join("\n");
  await writeFile(`${DIR}/audit-report.md`, md, "utf8");

  const failed = audits.filter((a) => a.error);
  if (failed.length) throw new Error(`audit errors: ${failed.map((f) => f.commandId).join(", ")}`);
});
