// 진단 전용 스펙 — ESC 메뉴 타이포/그래픽/포트레이트 수정 후 채증 + 단언.
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";

const DIR = ".omo/evidence/runtime-menu-visual";

function project(): Project {
  const p = createBlankProject();
  p.session.inventory = {
    item_potion: 3,
    item_ether: 1,
    item_antidote: 2,
    item_hi_potion: 1,
    equip_scout_dagger: 1,
    equip_iron_sword: 1,
    equip_oak_shield: 1,
    equip_leather_armor: 1,
  };
  p.session = { ...p.session, partyActorIds: p.database.actors.slice(0, 4).map((a) => a.id) };
  // 두 번째 파티원에 faceIndex 2 를 저작해 faceIndex 반영을 라이브에서 증명한다.
  const second = p.database.actors[1];
  if (second) second.faceIndex = 2;
  return p;
}

type MenuDump = {
  readonly label: string;
  readonly count: number;
  readonly fonts: readonly { readonly testid?: string; readonly family: string; readonly size: string; readonly text: string }[];
  readonly images: readonly { readonly testid?: string; readonly cls: string; readonly url: string }[];
  readonly faces: readonly { readonly testid?: string; readonly cropX: string; readonly cropY: string; readonly sheetW: string; readonly rendering: string; readonly radius: string }[];
  readonly panelSkin: {
    readonly resource: string | null;
    readonly rootVar: string;
    readonly rootBorderImage: string;
    readonly detailBorderImage: string;
  };
};

test("green: esc menu uses the runtime pixel font, renders authored graphics, crops the portrait correctly", async ({ page }) => {
  mkdirSync(DIR, { recursive: true });
  const consoleLines: string[] = [];
  const failedAssets: string[] = [];
  page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`));
  page.on("requestfailed", (r) => {
    const url = r.url();
    if (/\.(png|webp|jpg|jpeg|gif)(\?|$)/i.test(url)) failedAssets.push(`${r.failure()?.errorText ?? "?"} ${url}`);
  });
  page.on("response", (r) => {
    const url = r.url();
    if (r.status() >= 400 && /\.(png|webp|jpg|jpeg|gif)(\?|$)/i.test(url)) failedAssets.push(`HTTP${r.status()} ${url}`);
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, project(), "/?e2eVitals=1");
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1200);

  await page.keyboard.press("Escape");
  if ((await page.getByTestId("main-menu").count()) === 0) await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(400);
  await page.getByTestId("main-menu").screenshot({ path: `${DIR}/green-02-esc-main.png` });

  const dump = async (label: string): Promise<MenuDump> => page.evaluate((lbl) => {
    const menu = document.querySelector("[data-testid='main-menu']");
    if (!(menu instanceof HTMLElement)) throw new Error("no menu");
    const fonts: MenuDump["fonts"][number][] = [];
    const images: MenuDump["images"][number][] = [];
    const faces: MenuDump["faces"][number][] = [];
    for (const n of Array.from(menu.querySelectorAll<HTMLElement>("*"))) {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(n);
      const ownText = Array.from(n.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? "").trim().length > 0);
      if (ownText) fonts.push({ testid: n.dataset.testid, family: cs.fontFamily, size: cs.fontSize, text: (n.textContent ?? "").trim().slice(0, 24) });
      const bg = cs.backgroundImage;
      if (bg !== "none" && bg.includes("url(")) images.push({ testid: n.dataset.testid, cls: n.className.toString().slice(0, 70), url: bg.slice(0, 200) });
      if (n instanceof HTMLImageElement && n.currentSrc) images.push({ testid: n.dataset.testid, cls: n.className.toString().slice(0, 70), url: n.currentSrc });
      if (n.classList.contains("status-menu-face")) {
        faces.push({
          testid: n.dataset.testid,
          cropX: cs.getPropertyValue("--crop-x").trim(),
          cropY: cs.getPropertyValue("--crop-y").trim(),
          sheetW: cs.getPropertyValue("--crop-sheet-width").trim(),
          rendering: cs.imageRendering,
          radius: cs.borderRadius,
        });
      }
    }
    const menuStyle = getComputedStyle(menu);
    const detail = menu.querySelector("[data-testid='status-menu-detail']");
    return {
      label: lbl,
      count: menu.querySelectorAll("*").length,
      fonts,
      images,
      faces,
      panelSkin: {
        resource: menu.dataset.systemResource ?? null,
        // 루트에는 변수만 남아야 한다 — 24 fill 을 루트에 걸면 스킨 중앙 타일이
        // 플레이 스테이지 전체를 덮는다(systemGraphics.ts:100-106).
        rootVar: menuStyle.getPropertyValue("--runtime-window-skin").trim(),
        rootBorderImage: menu.style.borderImageSource ?? "",
        // 상속된 스킨을 상자가 실제로 칠하는가.
        detailBorderImage: detail instanceof HTMLElement ? getComputedStyle(detail).borderImageSource.slice(0, 200) : "",
      },
    };
  }, label);

  const dumps: MenuDump[] = [await dump("main")];
  for (const cmd of ["items", "equipment", "skills"] as const) {
    const b = page.getByTestId(`status-menu-command-${cmd}`);
    if (await b.count()) await b.click();
    await page.waitForTimeout(350);
    await page.getByTestId("main-menu").screenshot({ path: `${DIR}/green-03-esc-${cmd}.png` });
    dumps.push(await dump(cmd));
  }

  writeFileSync(`${DIR}/green-menu-dump.json`, JSON.stringify(dumps, null, 2));
  writeFileSync(`${DIR}/green-console.txt`, consoleLines.join("\n"));
  writeFileSync(`${DIR}/green-failed-assets.txt`, failedAssets.join("\n"));

  const PIXEL = /Galmuri11/;
  const SYMBOL_OK = /Segoe UI Symbol|Apple Symbols|DejaVu Sans/;

  // C1: 메뉴 안의 모든 텍스트 노드가 런타임 픽셀 폰트를 쓴다 (심볼 글리프 슬롯만 예외).
  const wrongFont = dumps.flatMap((d) => d.fonts
    .filter((f) => !PIXEL.test(f.family) && !SYMBOL_OK.test(f.family))
    .map((f) => `${d.label} ${f.testid ?? "?"} "${f.text}" -> ${f.family}`));
  expect(wrongFont, `text nodes not on the runtime pixel font:\n${wrongFont.join("\n")}`).toEqual([]);

  // C1b: 8px 미만 글자 없음.
  const tooSmall = dumps.flatMap((d) => d.fonts
    .filter((f) => Number.parseFloat(f.size) < 8)
    .map((f) => `${d.label} ${f.testid ?? "?"} "${f.text}" -> ${f.size}`));
  expect(tooSmall, `text nodes below 8px:\n${tooSmall.join("\n")}`).toEqual([]);

  // C2: 아이템/장비 목록이 실제 저작 아이콘을 그린다.
  const itemsDump = dumps.find((d) => d.label === "items");
  const itemIcons = itemsDump?.images.filter((i) => (i.testid ?? "").startsWith("status-menu-entry-icon-item-")) ?? [];
  expect(itemIcons.length, `item rows rendered no authored icon: ${JSON.stringify(itemsDump?.images ?? [])}`).toBeGreaterThan(0);

  const equipDump = dumps.find((d) => d.label === "equipment");
  const equipIcons = equipDump?.images.filter((i) => (i.testid ?? "").startsWith("status-menu-entry-icon-")) ?? [];
  expect(equipIcons.length, `equipment rows rendered no authored icon: ${JSON.stringify(equipDump?.images ?? [])}`).toBeGreaterThan(0);

  // C2b: 아이콘 URL 이 실제로 200 을 준다.
  const probe = [...itemIcons, ...equipIcons].slice(0, 4).map((i) => (/url\("?([^")]+)"?\)/.exec(i.url) ?? [])[1]).filter(Boolean) as string[];
  expect(probe.length, "no resolvable icon URL to probe").toBeGreaterThan(0);
  for (const url of probe) {
    const res = await page.request.get(url);
    expect(res.status(), `icon asset ${url}`).toBe(200);
  }

  // C3: 파티 포트레이트 크롭 — faceIndex 2 인 두 번째 파티원은 column 2 (=-44px) 를 봐야 한다.
  // 상자가 22px 이므로 시트는 22*4 = 88px 로 잡힌다.
  const faces = dumps[0]!.faces;
  expect(faces.length, "no party face nodes").toBeGreaterThan(1);
  const second = faces.find((f) => f.testid === "status-menu-face-1");
  expect(second, "missing status-menu-face-1").toBeTruthy();
  expect(second!.cropX).toBe("-44px");
  expect(second!.sheetW).toBe("88px");
  for (const face of faces) {
    expect(face.rendering, `face ${face.testid} must render pixelated`).toBe("pixelated");
    expect(face.radius, `face ${face.testid} must not be circle-cropped`).not.toBe("50%");
  }

  // C3b: 저작된 시스템 스킨이 ESC 표면에 도달하고, 루트는 칠하지 않는다.
  const skin = dumps[0]!.panelSkin;
  expect(skin.resource, "panel lost data-system-resource").toBeTruthy();
  expect(skin.rootVar, "authored windowskin never reached the ESC panel as a variable").toContain("url");
  expect(skin.rootBorderImage, "root must NOT paint border-image (24 fill floods the stage)").toBe("");
  expect(skin.detailBorderImage, "the detail panel does not paint the authored windowskin").toContain("url");

  // 그래픽 요청 실패 없음.
  expect(failedAssets, `broken image requests:\n${failedAssets.join("\n")}`).toEqual([]);
});
