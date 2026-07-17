/**
 * 에디터에서 rpg-zzu-home-8pyeong 로드 후 맵 스크린샷.
 * bun scripts/screenshot-home-8pyeong.mts
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9999";
const PROJECT_ID = "rpg-zzu-home-8pyeong";
const OUT = path.resolve("output/evidence/home-8pyeong");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY ?? "";
  if (!url || !anonKey) throw new Error("missing supabase env");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // DB 설정을 이 프로젝트로 강제
  await page.addInitScript(
    ({ url, anonKey, projectId }) => {
      localStorage.setItem(
        "rpg-zzu:supabase-project-config",
        JSON.stringify({ url, anonKey, projectId, source: "custom" }),
      );
    },
    { url, anonKey, projectId: PROJECT_ID },
  );

  console.log("goto", BASE);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
  await page.waitForTimeout(2000);

  // DB 새로고침으로 원격 프로젝트 로드
  const reload = page.getByTestId("toolbar-reload-db");
  if (await reload.isVisible().catch(() => false)) {
    await reload.click();
    await page.waitForTimeout(3000);
  } else {
    // 열기 메뉴 경로
    const openBtn = page.getByTestId("toolbar-load");
    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click();
      await page.waitForTimeout(1000);
      const connect = page.getByTestId("db-config-connect");
      if (await connect.isVisible().catch(() => false)) {
        const projectField = page.locator('input[name="projectId"]');
        if (await projectField.count()) {
          await projectField.fill(PROJECT_ID);
        }
        await connect.click();
        await page.waitForTimeout(3000);
      }
    }
  }

  await page.waitForTimeout(1500);

  const probe = await page.evaluate(() => {
    const store = (window as unknown as { __rpgzzuStore?: { getCurrent: () => any } }).__rpgzzuStore;
    // fallback via export dump if available
    const pre = document.querySelector("#project-export, [data-testid='project-export']");
    return {
      title: document.title,
      status: document.querySelector("[data-testid='db-connection-status']")?.textContent ?? null,
      mapTree: document.querySelector("[data-testid='map-tree']")?.textContent?.slice(0, 200) ?? null,
      hasCanvas: !!document.querySelector("[data-testid='edit-canvas']"),
    };
  });
  console.log("probe", probe);

  await page.screenshot({ path: path.join(OUT, "01-editor-full.png"), fullPage: true });
  const canvas = page.getByTestId("edit-canvas");
  if (await canvas.count()) {
    await canvas.screenshot({ path: path.join(OUT, "02-edit-canvas.png") });
  }

  // store 강제 로드 시도 (노출 API가 있으면)
  const loaded = await page.evaluate(async (projectId) => {
    try {
      // @ts-expect-error runtime
      const storeMod = await import("/src/project/store.ts");
      const sync = await import("/src/project/supabaseProjectSync.ts");
      const cfg = {
        url: localStorage.getItem("rpg-zzu:supabase-project-config")
          ? JSON.parse(localStorage.getItem("rpg-zzu:supabase-project-config")!).url
          : "",
        anonKey: localStorage.getItem("rpg-zzu:supabase-project-config")
          ? JSON.parse(localStorage.getItem("rpg-zzu:supabase-project-config")!).anonKey
          : "",
        projectId,
      };
      const project = await sync.loadProjectFromSupabase(cfg);
      if (!project) return { ok: false, reason: "null project" };
      storeMod.store.replaceProject(project);
      const { focusProjectStartMap } = await import("/src/editor/mapSelection.ts");
      focusProjectStartMap();
      const map = project.maps[project.startMapId];
      return {
        ok: true,
        title: project.meta?.title,
        mapId: project.startMapId,
        size: map ? `${map.width}x${map.height}` : null,
        events: map?.events?.length,
        upper: map?.upperTiles?.filter((t: number) => t >= 0).length,
      };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
  }, PROJECT_ID);
  console.log("loaded", loaded);

  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "03-after-load-full.png"), fullPage: true });
  if (await canvas.count()) {
    await canvas.screenshot({ path: path.join(OUT, "04-after-load-canvas.png") });
  }

  // 줌 아웃/센터를 위해 키보드 조작 시도
  await page.keyboard.press("Home").catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "05-final-full.png"), fullPage: true });
  if (await canvas.count()) {
    await canvas.screenshot({ path: path.join(OUT, "06-final-canvas.png") });
  }

  fs.writeFileSync(path.join(OUT, "probe.json"), JSON.stringify({ probe, loaded }, null, 2));
  await browser.close();
  console.log("shots in", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
