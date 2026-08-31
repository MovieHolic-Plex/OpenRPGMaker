// AI 가 만든 NPC·몬스터의 외형 자동 부여 증거를 실제 편집기 표면에서 촬영한다.
// 수정 전 상태는 같은 레코드의 monsterResourceId 를 store 에서 비워 재현한다 —
// 옛 툴이 저장하던 모양 그대로이므로 같은 카드로 before/after 를 비교할 수 있다.
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.SHOOT_BASE ?? "http://127.0.0.1:9880/";
const OUT = process.env.SHOOT_OUT ?? "verify-shots/ai-graphic-required";
mkdirSync(OUT, { recursive: true });

type ToolResult = { ok: boolean; summary: string; diff?: { warnings?: string[] } };

const KOREAN_ENEMIES = [
  { id: "enemy_ai_skeleton_archer", name: "해골 궁수", stats: { maxHp: 46, attack: 18 } },
  { id: "enemy_ai_cave_bat", name: "동굴 박쥐", stats: { maxHp: 28, attack: 12 } },
  { id: "enemy_ai_blue_slime", name: "푸른 슬라임", stats: { maxHp: 22, attack: 9 } },
  { id: "enemy_ai_stone_golem", name: "돌 골렘", stats: { maxHp: 88, attack: 26 } },
  { id: "enemy_ai_fire_spirit", name: "불의 정령", stats: { maxHp: 54, attack: 24 } },
  { id: "enemy_ai_red_dragon", name: "붉은 용", stats: { maxHp: 160, attack: 44 } },
];

async function runTool(page: Page, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return page.evaluate(
    ({ toolName, toolArgs }) => {
      const hook = (window as unknown as { __oprnEditorTool?: (n: string, a: Record<string, unknown>) => ToolResult })
        .__oprnEditorTool;
      if (typeof hook !== "function") throw new Error("__oprnEditorTool 훅이 없다");
      return hook(toolName, toolArgs) as ToolResult;
    },
    { toolName: name, toolArgs: args },
  );
}

async function openDatabaseTab(page: Page, tab: string): Promise<void> {
  const modal = page.getByTestId("database-modal");
  if (!(await modal.isVisible().catch(() => false))) {
    await page.getByTestId("toolbar-database").click();
    await modal.waitFor({ state: "visible", timeout: 30_000 });
  }
  await page.getByTestId(tab).evaluate((node) => (node as HTMLElement).click());
  await page.waitForTimeout(800);
}

async function selectRecord(page: Page, recordId: string): Promise<boolean> {
  const search = page.locator('#db-workspace input[type="search"], .db-ws-list input[type="search"]').first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill("");
    await search.type(recordId.replace(/^enemy_ai_|^species_ai_/, ""), { delay: 12 });
    await page.waitForTimeout(500);
  }
  const row = page.locator(`[data-testid="db-record-row-${recordId}"]`).first();
  if (!(await row.isVisible({ timeout: 4000 }).catch(() => false))) return false;
  await row.click();
  await page.waitForTimeout(450);
  return true;
}

async function shootHero(page: Page, path: string): Promise<boolean> {
  const hero = page.getByTestId("db-enemy-hero");
  if (!(await hero.isVisible().catch(() => false))) return false;
  await hero.screenshot({ path });
  return true;
}

async function step(label: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
    console.log(`ok   ${label}`);
  } catch (cause) {
    console.log(`FAIL ${label}: ${cause instanceof Error ? cause.message.split("\n")[0] : String(cause)}`);
  }
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(30_000);
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:coachmarks-basic-v1", "seen");
});
await page.goto(`${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
await page.waitForTimeout(2500);

const evidence: Record<string, unknown> = {};

// 1) 툴로 한국어 이름 적을 만든다. monsterResourceId 는 주지 않는다.
const toolResults: { id: string; name: string; summary: string; warnings: string[] }[] = [];
for (const record of KOREAN_ENEMIES) {
  const result = await runTool(page, "upsert_enemy", { enemy: record });
  toolResults.push({ id: record.id, name: record.name, summary: result.summary, warnings: result.diff?.warnings ?? [] });
}
evidence.enemyToolResults = toolResults;

const speciesResult = await runTool(page, "define_monster_species", {
  species: { id: "species_ai_blue_slime", name: "푸른 슬라임", captureRate: 0.6 },
});
evidence.speciesResult = { summary: speciesResult.summary, warnings: speciesResult.diff?.warnings ?? [] };

const mapId = await page.evaluate(() => {
  const store = (window as unknown as { __oprnEditorStore: { getCurrent(): { startMapId: string } } }).__oprnEditorStore;
  return store.getCurrent().startMapId;
});
const npcResult = await runTool(page, "upsert_event", {
  mapId,
  event: {
    id: "ev_ai_talker",
    x: 6,
    y: 6,
    trigger: { kind: "action" },
    pages: [{ conditions: [], commands: [{ kind: "text", body: "이 마을은 처음이신가요?" }] }],
  },
});
evidence.npcResult = { summary: npcResult.summary, warnings: npcResult.diff?.warnings ?? [] };

evidence.assignedGraphics = await page.evaluate(() => {
  const store = (window as unknown as {
    __oprnEditorStore: {
      getCurrent(): {
        startMapId: string;
        maps: Record<string, { events: { id: string; pages?: { graphic?: { sprite?: { id?: string }; transparent?: boolean } }[] }[] }>;
        database: {
          enemies: { id: string; name: string; monsterResourceId?: string }[];
          monsterSpecies?: { id: string; name: string; graphic: { monsterResourceId?: string } }[];
        };
      };
    };
  }).__oprnEditorStore;
  const project = store.getCurrent();
  const talker = project.maps[project.startMapId]?.events.find((event) => event.id === "ev_ai_talker");
  return {
    enemies: project.database.enemies
      .filter((enemy) => enemy.id.startsWith("enemy_ai_"))
      .map((enemy) => ({ id: enemy.id, name: enemy.name, monsterResourceId: enemy.monsterResourceId ?? null })),
    species: (project.database.monsterSpecies ?? [])
      .filter((species) => species.id.startsWith("species_ai_"))
      .map((species) => ({ id: species.id, name: species.name, monsterResourceId: species.graphic.monsterResourceId ?? null })),
    npcSprite: talker?.pages?.[0]?.graphic?.sprite?.id ?? null,
    npcTransparent: talker?.pages?.[0]?.graphic?.transparent ?? null,
  };
});

// 2) 같은 카드로 before/after. before 는 store 에서 외형을 비워 옛 저장 상태를 재현한다.
await openDatabaseTab(page, "db-tab-enemies");
await step("select skeleton archer", async () => {
  if (!(await selectRecord(page, "enemy_ai_skeleton_archer"))) throw new Error("행을 찾지 못했다");
});
await step("01 before hero (graphic cleared)", async () => {
  await page.evaluate(() => {
    const store = (window as unknown as {
      __oprnEditorStore: { update(mutator: (draft: unknown) => void): void };
    }).__oprnEditorStore;
    store.update((draft) => {
      const database = (draft as { database: { enemies: { id: string; monsterResourceId?: string }[] } }).database;
      const enemy = database.enemies.find((entry) => entry.id === "enemy_ai_skeleton_archer");
      if (enemy) delete enemy.monsterResourceId;
    });
  });
  await page.waitForTimeout(900);
  if (!(await shootHero(page, `${OUT}/01-before-hero-no-graphic.png`))) throw new Error("hero 없음");
});
await step("02 after hero (tool refilled)", async () => {
  const again = await runTool(page, "upsert_enemy", { enemy: { id: "enemy_ai_skeleton_archer", name: "해골 궁수" } });
  evidence.refillWarnings = again.diff?.warnings ?? [];
  await page.waitForTimeout(1000);
  if (!(await shootHero(page, `${OUT}/02-after-hero-autofilled.png`))) throw new Error("hero 없음");
});

// 3) 종류별 카드 + 목록 전경.
for (const [index, record] of KOREAN_ENEMIES.entries()) {
  await step(`03-${index + 1} hero ${record.id}`, async () => {
    if (!(await selectRecord(page, record.id))) throw new Error("행을 찾지 못했다");
    if (!(await shootHero(page, `${OUT}/03-${index + 1}-hero-${record.id}.png`))) throw new Error("hero 없음");
  });
}
await step("04 enemy list", async () => {
  const search = page.locator('#db-workspace input[type="search"], .db-ws-list input[type="search"]').first();
  if (await search.isVisible().catch(() => false)) await search.fill("");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/04-enemy-list.png` });
});

await step("05 species tab", async () => {
  await openDatabaseTab(page, "db-tab-monster-species");
  await page.locator('[data-testid^="db-record-row-species_ai_"]').first().click({ timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/05-species-autofilled.png` });
});

await step("06 map npc", async () => {
  await page.getByTestId("database-modal-close").click();
  await page.getByTestId("database-modal").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => undefined);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);

  // 100x100 시작 맵은 NPC 한 칸이 화면 밖으로 밀린다 — 전체가 보이는 작은 실내 맵에 배치한다.
  const smallMapId = await page.evaluate(() => {
    const store = (window as unknown as {
      __oprnEditorStore: { getCurrent(): { maps: Record<string, { id: string; width: number; height: number }> } };
    }).__oprnEditorStore;
    const maps = Object.values(store.getCurrent().maps);
    const small = maps.filter((map) => map.width <= 20 && map.height <= 15).sort((a, b) => a.width * a.height - b.width * b.height);
    return small[0]?.id ?? null;
  });
  if (!smallMapId) throw new Error("작은 맵이 없다");

  const inner = await runTool(page, "upsert_event", {
    mapId: smallMapId,
    event: {
      id: "ev_ai_talker_indoor",
      x: 6,
      y: 5,
      trigger: { kind: "action" },
      pages: [{ conditions: [], commands: [{ kind: "text", body: "이 마을은 처음이신가요?" }] }],
    },
  });
  evidence.indoorNpcResult = { mapId: smallMapId, summary: inner.summary, warnings: inner.diff?.warnings ?? [] };
  evidence.indoorNpcSprite = await page.evaluate((id: string) => {
    const store = (window as unknown as {
      __oprnEditorStore: { getCurrent(): { maps: Record<string, { events: { id: string; pages?: { graphic?: { sprite?: { id?: string }; transparent?: boolean } }[] }[] }> } };
    }).__oprnEditorStore;
    const page0 = store.getCurrent().maps[id]?.events.find((event) => event.id === "ev_ai_talker_indoor")?.pages?.[0];
    return { sprite: page0?.graphic?.sprite?.id ?? null, transparent: page0?.graphic?.transparent ?? null };
  }, smallMapId);

  await page.getByTestId(`map-tree-node-${smallMapId}`).click({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/06-map-npc-visible.png` });
  const canvas = page.getByTestId("edit-canvas");
  if (await canvas.isVisible().catch(() => false)) {
    await canvas.screenshot({ path: `${OUT}/07-map-npc-canvas.png` });
  }
});

writeFileSync(`${OUT}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence.assignedGraphics, null, 2));
await browser.close();
