import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";
import { openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const DIR = "output/evidence/sysux-after";
const BASE = "C:/Users/USER/Downloads/rpg-zzu-system-ux/output/evidence/sysux-after";

type SpecCheck = { testid: string; present: boolean; width: number; height: number };
type BodyAudit = {
  commandId: string;
  title: string;
  visibleEnabledControls: number;
  deadControls: number;
  zeroSizeOrHiddenControls: string[];
  specChecks: SpecCheck[];
  specOk: boolean;
  previewTextLines: number;
  previewRendersBeyondOneLine: boolean;
  error?: string;
};

const COMMANDS: ReadonlyArray<{ id: string; title: string; fields?: Record<string, unknown> }> = [
  { id: "m2-067-key-input-processing", title: "Key Input Processing" },
  { id: "m2-046-tint-screen", title: "Tint Screen", fields: { color: "#4040ff", duration: 600 } },
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

test("sysux after-evidence: M2 시스템/연출 커맨드 편집 바디 스캔", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1500, height: 1000 });

  const { project, eventId } = sysUxProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  const listToggle = modal.getByTestId("event-view-toggle-list");
  if (await listToggle.count() && (await listToggle.getAttribute("aria-pressed")) !== "true") {
    await listToggle.click();
    await page.waitForTimeout(400);
  }

  const inspector = modal.getByTestId("event-editor-inspector");
  const items = modal.locator('[data-testid="event-command-m2Command"]');
  await expect(items).toHaveCount(COMMANDS.length);

  // 스펙 필수 testid — 커맨드별로 검사
  const SPEC_TESTIDS: Record<string, string[]> = {
    "m2-046-tint-screen": ["tint-screen-preview-stage", "tint-screen-preview-swatch"],
    "m2-050-set-weather-effects": [
      "set-weather-effects-preview-stage",
      "set-weather-effects-preview-overlay",
      "set-weather-effects-preview-fog-far",
      "set-weather-effects-preview-fog-near",
      "set-weather-effects-kind-fog-dot",
      "set-weather-effects-intensity-slider",
    ],
    "m2-069-change-parallax-back": ["change-parallax-back-preview-image"],
    "m2-067-key-input-processing": [
      "key-input-processing-keycaps",
      "key-input-processing-preview-target",
      "key-input-processing-preview-wait",
      ...["1","2","3","4","5","6","7","digits"].map((c) => `key-input-processing-keycap-${c}`),
    ],
  };

  const audits: BodyAudit[] = [];
  for (let i = 0; i < COMMANDS.length; i++) {
    const meta = COMMANDS[i]!;
    const entry: BodyAudit = {
      commandId: meta.id,
      title: meta.title,
      visibleEnabledControls: 0,
      deadControls: 0,
      zeroSizeOrHiddenControls: [],
      specChecks: [],
      specOk: false,
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
      entry.deadControls = dom.bad.length;

      // spec testid 존재 + 0보다 큰 박스
      entry.specChecks = await page.evaluate((ids: string[]) =>
        ids.map((id) => {
          const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
          const r = el?.getBoundingClientRect();
          return { testid: id, present: el !== null, width: r ? Math.round(r.width) : 0, height: r ? Math.round(r.height) : 0 };
        }),
      SPEC_TESTIDS[meta.id] ?? []);
      entry.specOk = entry.specChecks.every((s) => s.present && s.width > 0 && s.height > 0);

      // 프리뷰 리치 렌더 여부
      const rich = await page.evaluate(() => {
        const body = document.querySelector<HTMLElement>('[data-testid="event-command-preview-body"]');
        if (!body) return { lines: 0, beyond: false };
        const lines = body.textContent?.trim().split(/\n+/).filter(Boolean).length ?? 0;
        const visualChildren = Array.from(body.children).filter((c) => !c.classList.contains("ecp-caption"));
        const hasRich = visualChildren.some((c) => c.querySelector("img,canvas,svg,[data-testid^='ecp-pattern'],[data-testid='ecp-message-window']") !== null);
        return { lines, beyond: hasRich || visualChildren.length > 1 || lines > 1 };
      });
      entry.previewTextLines = rich.lines;
      entry.previewRendersBeyondOneLine = rich.beyond;
    } catch (err) {
      entry.error = String(err).slice(0, 300);
    }
    audits.push(entry);
  }

  await writeFile(`${DIR}/audit-report.json`, JSON.stringify({ capturedAt: new Date().toISOString(), commands: audits }, null, 2), "utf8");

  const md = [
    "# 시스템/연출 M2 커맨드 편집 바디 — AFTER 감사",
    "",
    "| command | 활성 컨트롤 | 죽은 컨트롤 | 스펙 testid OK | preview 줄수 | 비고 |",
    "|---|---|---|---|---|---|",
    ...audits.map((a) =>
      `| ${a.commandId} (${a.title}) | ${a.visibleEnabledControls} | ${a.deadControls} | ${a.specOk ? "OK" : a.specChecks.filter((s) => !s.present || s.width <= 0).map((s) => s.testid).join(",")} | ${a.previewTextLines}${a.previewRendersBeyondOneLine ? "(rich)" : ""} | ${a.error ?? "-"} |`
    ),
    "",
  ].join("\n");
  await writeFile(`${DIR}/audit-report.md`, md, "utf8");

  const failed = audits.filter((a) => a.error);
  if (failed.length) throw new Error(`audit errors: ${failed.map((f) => f.commandId).join(", ")}`);

  // 게이트: 모든 커맨드에서 죽은 컨트롤 0 + (대상 커맨드는) 스펙 testid 전부 존재·비제로
  for (const a of audits) {
    expect(a.deadControls, `${a.commandId} dead controls`).toBe(0);
    if ((SPEC_TESTIDS[a.commandId] ?? []).length) {
      for (const s of a.specChecks) {
        expect(s.present, `${a.commandId} missing [${s.testid}]`).toBe(true);
        expect(s.width, `${a.commandId} [${s.testid}] width`).toBeGreaterThan(0);
        expect(s.height, `${a.commandId} [${s.testid}] height`).toBeGreaterThan(0);
      }
    }
  }
});
