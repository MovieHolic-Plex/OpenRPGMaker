import { expect, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

export const C001_SCREENSHOT = ".omo/ulw-loop/status-menu-fullscreen-20260628/evidence/c001-fullscreen-panels.png";
export const C002_SCREENSHOT = ".omo/ulw-loop/status-menu-fullscreen-20260628/evidence/c002-actions-use-equip-row-formation.png";
export const C003_SCREENSHOT = ".omo/ulw-loop/status-menu-fullscreen-20260628/evidence/c003-save-back-regression.png";

export const COMMAND_SCREENSHOTS = {
  items: ".omo/ulw-loop/rpg-status-menu-ko-actions/evidence/C001-items-panel.png",
  skills: ".omo/ulw-loop/rpg-status-menu-ko-actions/evidence/C001-skills-panel.png",
  equipment: ".omo/ulw-loop/rpg-status-menu-ko-actions/evidence/C001-equipment-panel.png",
  status: ".omo/ulw-loop/rpg-status-menu-ko-actions/evidence/C001-status-panel.png",
  row: ".omo/ulw-loop/rpg-status-menu-ko-actions/evidence/C001-row-panel.png",
  formation: ".omo/ulw-loop/rpg-status-menu-ko-actions/evidence/C001-formation-panel.png",
  save: ".omo/ulw-loop/rpg-status-menu-ko-actions/evidence/C001-save-panel.png",
  wait: ".omo/ulw-loop/rpg-status-menu-ko-actions/evidence/C001-wait-panel.png",
} as const;

export const COMMAND_LABELS = [
  ["items", "아이템"],
  ["skills", "스킬"],
  ["equipment", "장비"],
  ["save", "저장"],
  ["load", "로드"],
  ["status", "상태"],
  ["row", "열"],
  ["formation", "진형"],
  ["quests", "임무"],
  ["wait", "대기 ON"],
  ["to-title", "타이틀"],
] as const;

export async function startActualPlay(page: Page, project = seededStatusMenuProject(), route = "/?e2eVitals=1"): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, project, route);
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });
}

export function seededStatusMenuProject(): Project {
  const project = createBlankProject();
  project.session.inventory = {
    item_potion: 2,
    item_ether: 1,
    item_antidote: 1,
    item_wake_herb: 1,
    item_warp_scroll: 1,
    item_hi_potion: 1,
    equip_scout_dagger: 1,
    equip_iron_sword: 1,
    equip_steel_sword: 1,
    equip_short_sword: 2,
  };
  relabelItem(project, "item_warp_scroll", "귀환 두루마리", "마을로 이동");
  relabelItem(project, "item_hi_potion", "상급 회복약", "HP를 크게 회복합니다.");
  for (const actor of project.database.actors) delete actor.faceResourceId;
  // 스펙은 4인 파티(대상 선택/진형/열 조작)를 전제한다 — 블랭크 프로젝트 기본은 1인.
  project.session = {
    ...project.session,
    partyActorIds: project.database.actors.slice(0, 4).map((actor) => actor.id),
  };
  return project;
}

function relabelItem(project: Project, id: string, name: string, description: string): void {
  const item = project.database.items.find((record) => record.id === id);
  if (!item) return;
  item.name = name;
  item.description = description;
}

export async function seedDefaultProject(page: Page): Promise<void> {
  await seedProjectFromSupabaseCanonical(page, seededStatusMenuProject());
}

export function recoveryItemProject(recoveryAmount: number): Project {
  const project = seededStatusMenuProject();
  const potion = project.database.items.find((item) => item.id === "item_potion");
  if (!potion) throw new Error("missing item_potion");
  potion.name = "테스트 회복약";
  potion.description = `DB flat HP 회복 ${recoveryAmount}`;
  potion.hpRecovery = { percentMax: 0, flat: recoveryAmount };
  potion.mpRecovery = { percentMax: 0, flat: 0 };
  potion.occasion = "field";
  potion.consumable = true;
  return project;
}

export async function runtimeState(page: Page): Promise<{
  readonly inventory: Record<string, number>;
  readonly partyActorIds: readonly string[];
  readonly actorVitals: Record<string, { readonly hp: number; readonly mp: number; readonly maxHp: number; readonly maxMp: number }>;
  readonly actorEquipment: Record<string, { readonly weapon?: string; readonly shield?: string; readonly armor?: string; readonly helmet?: string; readonly accessory?: string }>;
  readonly actorRows: Record<string, "front" | "back">;
}> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as Awaited<ReturnType<typeof runtimeState>>;
}

export async function audioState(page: Page): Promise<{ readonly se?: { readonly resourceId: string; readonly loop: boolean } }> {
  const text = await page.getByTestId("audio-state-json").textContent();
  if (!text) throw new Error("missing audio state");
  return JSON.parse(text) as { readonly se?: { readonly resourceId: string; readonly loop: boolean } };
}

export async function saveSnapshot(page: Page, slot: 1 | 2 | 3): Promise<{
  readonly session: {
    readonly actorRows: Record<string, "front" | "back">;
    readonly partyActorIds: readonly string[];
    readonly actorEquipment: Record<string, { readonly weapon?: string; readonly shield?: string; readonly armor?: string; readonly helmet?: string; readonly accessory?: string }>;
  };
}> {
  return page.evaluate((slotIndex) => {
    const text = window.localStorage.getItem(`rpg-zzu:save-slot:${slotIndex}`);
    if (!text) throw new Error("missing save snapshot");
    return JSON.parse(text) as Awaited<ReturnType<typeof saveSnapshot>>;
  }, slot);
}

export async function selectCommand(page: Page, commandId: string, title: string): Promise<void> {
  if ((await page.getByTestId("status-menu-command-rail").count()) === 0) {
    await page.keyboard.press("X");
    await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();
  }
  await page.getByTestId(`status-menu-command-${commandId}`).click();
  await expect(page.getByTestId("status-menu-detail-title")).toHaveText(title);
}

export async function screenshotMenu(page: Page, path: string): Promise<void> {
  await page.getByTestId("main-menu").screenshot({ path });
}

export async function openTestPlayWindow(page: Page): Promise<void> {
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("mode-play").click();
  const modal = page.getByTestId("test-play-window");
  await page.waitForTimeout(250);
  if (!(await modal.isVisible())) await page.evaluate(() => window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window")));
  await expect(modal).toBeVisible({ timeout: 10000 });
  await expect(modal.getByTestId("title-screen")).toBeVisible({ timeout: 10000 });
}

export async function isMenuInsidePlayStage(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const menu = document.querySelector("[data-testid='main-menu']");
    const stage = document.querySelector("[data-testid='play-stage']");
    if (!(menu instanceof HTMLElement) || !(stage instanceof HTMLElement)) return false;
    const menuRect = menu.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const tolerance = 1;
    return (
      menuRect.left >= stageRect.left - tolerance &&
      menuRect.top >= stageRect.top - tolerance &&
      menuRect.right <= stageRect.right + tolerance &&
      menuRect.bottom <= stageRect.bottom + tolerance
    );
  });
}

export async function doesMenuFillPlayStage(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const menu = document.querySelector("[data-testid='main-menu']");
    const stage = document.querySelector("[data-testid='play-stage']");
    if (!(menu instanceof HTMLElement) || !(stage instanceof HTMLElement)) return false;
    const menuRect = menu.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const tolerance = 1;
    return (
      Math.abs(menuRect.left - stageRect.left) <= tolerance &&
      Math.abs(menuRect.top - stageRect.top) <= tolerance &&
      Math.abs(menuRect.width - stageRect.width) <= tolerance &&
      Math.abs(menuRect.height - stageRect.height) <= tolerance
    );
  });
}
