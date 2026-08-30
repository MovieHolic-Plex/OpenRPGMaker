// 진단 스펙 — 턴 없이 두 표면을 실제 브라우저에서 렌더해 눈으로 확인한다.
//  (1) 언급 썸네일 스트립(C3): 실제 프로젝트 DB 레코드로 findEntityMentions + renderEntityMentionStrip
//  (2) 즉시 적용 비교 카드(C1): renderChangePreviewCard — 전/후 썸네일 + 되돌리기, 승인 UI 없음
// 구 (C5) 적용 완료 스트립은 제거됐다(2026-08-30) — 적용 직후 되돌리기는 컴포저 액션 행의
// `ai-composer-undo` 이고, 그 표면은 `_composer-undo-shot.spec.ts` 가 찍는다.
// dev 서버는 소스를 ES 모듈로 서브하므로 페이지 안에서 직접 import 할 수 있다.
// 실행: DEV_SERVER_PORT=9816 npx playwright test test/e2e/_ux-after-surfaces.spec.ts --project=chromium
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "verify-shots/ai-assistant-ux/probe-after";
mkdirSync(OUT, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(800);
}

test("after: 언급 썸네일 · 즉시 적용 비교 카드", async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);

  const result = await page.evaluate(async () => {
    const mentions = await import("/src/editor/panels/aiEntityMentions.ts");
    const card = await import("/src/editor/panels/aiChangePreview.ts");
    const storeMod = await import("/src/project/store.ts");
    const project = storeMod.store.getCurrent();

    const enemyNames = (project.database?.enemies ?? []).slice(0, 3).map((e: { name: string }) => e.name);
    const itemNames = (project.database?.items ?? []).slice(0, 2).map((i: { name: string }) => i.name);
    const sentence = `${enemyNames[0] ?? "적"}을 광장에 두고 ${itemNames[0] ?? "물약"}을 상자에 넣었습니다.`;
    const found = mentions.findEntityMentions(sentence, project);

    const host = document.createElement("div");
    host.id = "ux-probe-host";
    host.setAttribute(
      "style",
      "position:fixed;left:400px;top:120px;width:640px;z-index:99999;display:grid;gap:14px;"
        + "background:var(--bg-raised,#fff);border:1px solid #999;border-radius:12px;padding:16px;",
    );

    const label = (text: string): HTMLElement => {
      const node = document.createElement("div");
      node.textContent = text;
      node.setAttribute("style", "font:700 12px system-ui;color:#666;");
      return node;
    };

    host.append(label(`1) 언급 썸네일 — "${sentence}"`));
    const mentionStrip = mentions.renderEntityMentionStrip(found, project);
    if (mentionStrip) host.append(mentionStrip);
    else host.append(label("(매치 0건)"));

    // 2) 적용 완료 스트립은 2026-08-30 에 제거했다(되돌리기는 컴포저 `ai-composer-undo`).
    //    이 프로브는 남은 두 표면만 찍는다.
    host.append(label("2) 즉시 적용 비교 카드 — 전/후 + 되돌리기"));
    const mapId = project.startMapId;
    const base = project.maps[mapId];
    const lowerTiles = [...base.lowerTiles];
    for (let i = 0; i < Math.min(40, lowerTiles.length); i += 1) lowerTiles[i] = (lowerTiles[i] ?? 0) + 1;
    const after = { ...project, maps: { ...project.maps, [mapId]: { ...base, lowerTiles } } };
    host.append(
      card.renderChangePreviewCard({
        before: project,
        after,
        mapId,
        title: "집 1 · 길 12칸 · 울타리 6",
        chips: ["변경 3건"],
        onUndo: () => undefined,
      }),
    );

    document.body.append(host);
    await new Promise((resolve) => setTimeout(resolve, 700));

    const q = (sel: string): number => host.querySelectorAll(sel).length;
    return {
      sentence,
      enemyNames,
      itemNames,
      mentionCount: found.length,
      mentionNames: found.map((m: { name: string }) => m.name),
      mentionChips: q("[data-testid='ai-mention-strip'] .ai-mention-chip"),
      mentionThumbs: q("[data-testid='ai-mention-strip'] .ai-mention-chip canvas, [data-testid='ai-mention-strip'] .ai-mention-chip img"),
      composerUndo: document.querySelectorAll("[data-testid='ai-composer-undo']").length,
      appliedCardThumbs: q("[data-testid='ai-change-pair'] canvas"),
      approvalUiCount: q("[data-testid='ai-proposal-auto-approve-input'], [data-testid='ai-proposal-card'], [data-testid='ai-proposal-modal']"),
      appliedCardHasUndo: q("[data-testid='ai-change-undo']"),
    };
  });

  writeFileSync(`${OUT}/surfaces-report.json`, JSON.stringify(result, null, 2), "utf8");
  await page.screenshot({ path: `${OUT}/20-surfaces.png` });
  await page.locator("#ux-probe-host").screenshot({ path: `${OUT}/21-surfaces-crop.png` });
  console.log(JSON.stringify(result, null, 2));
});
