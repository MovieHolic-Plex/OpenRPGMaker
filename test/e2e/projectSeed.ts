import { expect, type Page } from "@playwright/test";
import { gotoWithRetry } from "../../scripts/lib/goto-retry.mjs";

// Playwright 는 init script 인자를 CDP 로 보낸다. 빈 프로젝트의 타일셋 사전은 약 74MB 라
// 그 전송이 브라우저를 닫는다. 큰 타일셋만 빼고 넘기면, 로드 정규화(ensureBundledTilesets)가
// 빠진 번들 타일셋을 다시 채운다. 1MB 이하 타일셋(스펙이 직접 넣은 것)은 그대로 둔다.
const TILESET_INIT_SCRIPT_LIMIT = 1_000_000;
const SEED_INIT_SCRIPT_LIMIT = 6_000_000;

export async function seedProjectForEditor(page: Page, project: unknown, path = "/"): Promise<void> {
  const seed = projectSeedArgument(project);
  await page.addInitScript((payload) => {
    window.__OPRN_E2E_PROJECT__ = payload;
    // 시드의 역할은 프로젝트 주입뿐 — 앞선 init 스크립트(beforeEach)가 정한 UI 모드는 보존한다.
    const uiMode = window.localStorage.getItem("oprn:editor-ui-mode");
    window.localStorage.clear();
    if (uiMode !== null) window.localStorage.setItem("oprn:editor-ui-mode", uiMode);
  }, seed);
  await gotoWithRetry(page, path);
  // 큰 타일셋을 빼면 부팅 정규화가 번들 타일셋을 다시 만든다. 그 첫 화면은 15초를 넘긴다.
  const defaultBootMs = seed === project ? 15_000 : 60_000;
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: Number(process.env.E2E_BOOT_TIMEOUT_MS ?? defaultBootMs) });
}

function projectSeedArgument(project: unknown): unknown {
  if (!isRecord(project) || !isRecord(project.tilesets)) return project;
  const encoded = JSON.stringify(project.tilesets);
  if (encoded.length <= SEED_INIT_SCRIPT_LIMIT) return project;
  const tilesets: Record<string, unknown> = {};
  let total = 0;
  for (const [id, tileset] of Object.entries(project.tilesets)) {
    const size = JSON.stringify(tileset)?.length ?? Number.POSITIVE_INFINITY;
    if (size > TILESET_INIT_SCRIPT_LIMIT || total + size > SEED_INIT_SCRIPT_LIMIT) continue;
    tilesets[id] = tileset;
    total += size;
  }
  return { ...project, tilesets };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
