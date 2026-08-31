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

/* 레일은 6칸 도크다(playerStatusMenuModel.ts: items·skills·equipment + 파티/기록/시스템 그룹 입구).
 * 예전 목록은 12개 명령을 전부 레일에 세운 설계였고, 지금은 뒤 9개가 그룹 트레이 안으로 접혔다.
 * 그래서 `status-menu-command-monsters` 같은 testid 는 레일에 아예 없다 — 개수 검사와
 * 라벨 검사는 도크 6칸만 본다. 접힌 명령은 FOLDED_COMMAND_GROUPS 를 타는 selectCommand 로 확인한다.
 * 라벨은 그룹 입구에 화살표(`파티 ▸`)가 붙을 수 있어 부분 일치로 본다. */
export const COMMAND_LABELS = [
  ["items", "아이템"],
  ["skills", "스킬"],
  ["equipment", "장비"],
  ["party-menu", "파티"],
  ["record-menu", "기록"],
  ["system-menu", "시스템"],
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
    const text = window.localStorage.getItem(`oprn:save-slot:${slotIndex}`);
    if (!text) throw new Error("missing save snapshot");
    return JSON.parse(text) as Awaited<ReturnType<typeof saveSnapshot>>;
  }, slot);
}

// 좌측 사이드바에 명령 12개 + 파티 4명이 안 들어가서 기록/시스템 그룹을 접었다.
// 접힌 명령은 레일에 버튼이 없고 그룹을 연 뒤 작업 영역에서 고른다 — 스펙이 그 사정을
// 알 필요는 없으므로 헬퍼가 알아서 그룹을 먼저 연다.
const FOLDED_COMMAND_GROUPS: Readonly<Record<string, string>> = {
  status: "party-menu",
  row: "party-menu",
  formation: "party-menu",
  monsters: "party-menu",
  quests: "record-menu",
  relationships: "record-menu",
  save: "system-menu",
  load: "system-menu",
  wait: "system-menu",
  "to-title": "system-menu",
};

/* 레일 순서(playerStatusMenuModel.ts 의 STATUS_MENU_RAIL_ENTRY_IDS). 좌우 방향키가 이 순서로
 * 돌고(끝에서 감김), 그룹 입구를 고르면 트레이가 미리보기로 펼쳐진다. */
const RAIL_ORDER = ["items", "skills", "equipment", "party-menu", "record-menu", "system-menu"] as const;

/*
 * 런타임 메뉴는 **키보드 전용**이다. player.css 의
 *   .player-layout.system-shell[data-play-input-owner="keyboard-only"] > * { pointer-events: none !important }
 * 가 플레이 표면 전체를 히트테스트에서 빼기 때문에 `locator.click()` 은 영원히 대기한다
 * (실측: 레일 버튼 클릭 30초 타임아웃, 트레이·상세 행도 동일). 예전 스펙이 클릭으로
 * 통과한 건 기본 선택이 이미 아이템이라 클릭 없이도 제목이 맞았던 경우뿐이다.
 * 그래서 선택은 방향키 + 확인키(z)로 한다.
 */
async function railCursor(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const rail = document.querySelector("[data-testid='status-menu-command-rail']");
    const current = rail?.querySelector("[data-testid^='status-menu-command-'][aria-current='true']");
    return current instanceof HTMLElement ? (current.dataset.testid ?? "").replace("status-menu-command-", "") : null;
  });
}

async function trayCursor(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const current = document.querySelector("[data-testid^='status-menu-group-command-'][aria-current='true']");
    return current instanceof HTMLElement ? (current.dataset.testid ?? "").replace("status-menu-group-command-", "") : null;
  });
}

/** 상세 패널에 들어가 있으면 레일로 돌아온다 — 그 상태에서 방향키를 누르면 패널 커서가 움직인다. */
async function returnToRail(page: Page): Promise<void> {
  const panel = page.getByTestId("status-menu-detail");
  for (let guard = 0; guard < 5; guard += 1) {
    if ((await page.getByTestId("status-menu-command-rail").count()) === 0) {
      await page.keyboard.press("x");
      await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();
      return;
    }
    if ((await panel.count()) === 0 || (await panel.getAttribute("aria-hidden")) === "true") return;
    await page.keyboard.press("x");
    await waitForPanelSettled(page);
  }
}

async function moveCursor(
  page: Page,
  read: () => Promise<string | null>,
  order: readonly string[],
  target: string,
): Promise<void> {
  for (let guard = 0; guard <= order.length; guard += 1) {
    const current = await read();
    if (current === target) return;
    const from = current ? order.indexOf(current) : -1;
    const to = order.indexOf(target);
    if (to < 0) throw new Error(`선택 목록에 없는 항목: ${target}`);
    // 감기는 목록이라 짧은 쪽으로 돈다.
    const forward = from < 0 || (to - from + order.length) % order.length <= (from - to + order.length) % order.length;
    await page.keyboard.press(forward ? "ArrowRight" : "ArrowLeft");
    // 고정 대기는 느린 GPU(swiftshader)에서 한 프레임을 못 기다려 커서가 밀린다 —
    // 커서가 실제로 움직일 때까지 짧게 기다린다.
    await waitForChange(page, read, current);
  }
  throw new Error(`커서를 ${target} 로 옮기지 못했다 (현재 ${await read()})`);
}

/** 값이 바뀔 때까지(최대 2초) 기다린다. 안 바뀌면 그대로 진행해 상위 루프가 판단한다. */
async function waitForChange(
  page: Page,
  read: () => Promise<string | null>,
  previous: string | null,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(25);
    if ((await read()) !== previous) return;
  }
}

export async function focusRailEntry(page: Page, railId: string): Promise<void> {
  await returnToRail(page);
  await moveCursor(page, () => railCursor(page), RAIL_ORDER, railId);
}

/** 그룹 트레이 안의 명령 순서(playerStatusMenuModel.ts 의 RAIL_GROUPS). */
const GROUP_COMMAND_ORDER: Readonly<Record<string, readonly string[]>> = {
  "party-menu": ["status", "row", "formation", "monsters"],
  "record-menu": ["quests", "relationships", "life-ledger"],
  "system-menu": ["save", "load", "wait", "to-title"],
};

/** 확인/취소 뒤 상세 패널이 다시 그려질 틈을 준다(두 프레임 정도). */
async function waitForPanelSettled(page: Page): Promise<void> {
  await page.waitForTimeout(80);
}

export async function selectCommand(page: Page, commandId: string, title: string): Promise<void> {
  if ((await page.getByTestId("status-menu-command-rail").count()) === 0) {
    await page.keyboard.press("x");
    await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();
  }
  await returnToRail(page);
  const groupEntryId = FOLDED_COMMAND_GROUPS[commandId];
  await moveCursor(page, () => railCursor(page), RAIL_ORDER, groupEntryId ?? commandId);
  await page.keyboard.press("z");
  await waitForPanelSettled(page);
  if (groupEntryId) {
    const trayOrder = GROUP_COMMAND_ORDER[groupEntryId];
    await moveCursor(page, () => trayCursor(page), trayOrder, commandId);
    await page.keyboard.press("z");
    await waitForPanelSettled(page);
  }
  await expect(page.getByTestId("status-menu-detail-title")).toHaveText(title);
  await enterDetailPanel(page);
}

/**
 * 레일에서 명령을 고르면 상세 패널은 **미리보기**로만 뜬다 — main 모드에서는
 * `aria-hidden`+`inert` 라 안의 행이 보이지도, 눌리지도 않는다(playerStatusMenu.ts).
 * 확인 키로 패널에 들어가야 행 조작이 가능하다. 이 단계를 빼면 스펙이
 * `status-menu-item-item_potion` 같은 행에서 "element is not visible" 로 타임아웃한다.
 */
export async function enterDetailPanel(page: Page): Promise<void> {
  const panel = page.getByTestId("status-menu-detail");
  if ((await panel.getAttribute("aria-hidden")) === "true") {
    await page.keyboard.press("z");
  }
  await expect(panel).toBeVisible();
}

/** 상세 패널 안에서 원하는 행으로 커서를 옮기고 확인키를 누른다(클릭은 히트테스트가 없어 안 된다). */
export async function chooseDetailRow(page: Page, testId: string): Promise<void> {
  const rows = await page.evaluate(() => {
    const panel = document.querySelector("[data-testid='status-menu-detail']");
    return Array.from(panel?.querySelectorAll("[data-testid]") ?? [])
      .filter((node) => node instanceof HTMLElement && node.matches("button, [role='menuitem'], [role='option']"))
      .map((node) => (node as HTMLElement).dataset.testid ?? "");
  });
  if (!rows.includes(testId)) throw new Error(`상세 패널에 ${testId} 가 없다 (있는 행: ${rows.join(", ")})`);
  const read = async (): Promise<string | null> =>
    page.evaluate(() => {
      const panel = document.querySelector("[data-testid='status-menu-detail']");
      const current = panel?.querySelector("[data-testid][aria-current='true']");
      return current instanceof HTMLElement ? (current.dataset.testid ?? null) : null;
    });
  for (let guard = 0; guard <= rows.length; guard += 1) {
    const current = await read();
    if (current === testId) break;
    await page.keyboard.press("ArrowDown");
    await waitForChange(page, read, current);
  }
  if ((await read()) !== testId) throw new Error(`상세 커서를 ${testId} 로 옮기지 못했다`);
  await page.keyboard.press("z");
  await waitForPanelSettled(page);
}

export async function screenshotMenu(page: Page, path: string): Promise<void> {
  await page.getByTestId("main-menu").screenshot({ path });
}

export async function openTestPlayWindow(page: Page): Promise<void> {
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15000 });
  // 실행 버튼(mode-play)이 있는 클래식 툴바는 **전문가 모드에서만** 렌더된다
  // (menu.ts: showClassic = mode !== "edit" || chrome.classicToolbar).
  // UI 모드를 지정하지 않은 스펙은 기본 모드로 떠서 이 버튼이 아예 없었고,
  // click() 이 보이지 않는 요소를 기다리다 타임아웃했다. 두 모드 모두에서 동작하게 한다.
  const modeButton = page.getByTestId("mode-play");
  if (await modeButton.count() > 0 && await modeButton.isVisible()) {
    await modeButton.click();
  } else {
    // 기본 모드 경로: 메뉴 바 게임 → 테스트 플레이 창.
    await page.getByTestId("menu-game").click();
    await page.getByTestId("menu-game-play").click();
  }
  const modal = page.getByTestId("test-play-window");
  await page.waitForTimeout(250);
  if (!(await modal.isVisible())) await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:test-play-window")));
  await expect(modal).toBeVisible({ timeout: 10000 });
  // 테스트 플레이 창은 자동 시작이 기본값이다(testPlayModal.ts 의 test-play-auto-start,
  // "편집→테스트 왕복에서 타이틀 걷기를 없앤다"). 그래서 타이틀 화면만 기다리면
  // 자동 시작이 켜진 기본 경로에서 영원히 못 만난다 — 창이 이미 플레이로 들어갔기 때문이다.
  // 둘 중 무엇이 떠도 "창이 열렸다"로 본다.
  await expect(
    modal.getByTestId("title-screen").or(modal.getByTestId("play-stage")),
  ).toBeVisible({ timeout: 15000 });
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
