// AI 가 만든 NPC·몬스터의 외형 자동 부여 증거를 실제 편집기 표면에서 촬영한다.
// 수정 전 상태는 툴을 우회해 store 에 직접 써서 재현한다(옛 툴이 저장하던 모양 그대로).
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.SHOOT_BASE ?? "http://127.0.0.1:9880/";
const OUT = "verify-shots/ai-graphic-required";
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
  await page.waitForTimeout(700);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(60_000);
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:coachmarks-basic-v1", "seen");
});
await page.goto(`${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });

const evidence: Record<string, unknown> = {};

// 수정 전: 툴을 우회해 외형 없는 적을 그대로 저장한다.
await page.evaluate((records) => {
  const store = (window as unknown as {
    __oprnEditorStore: { update(mutator: (draft: Record<string, never>) => void): void };
  }).__oprnEditorStore;
  store.update((draft) => {
    const database = (draft as unknown as { database: { enemies: unknown[] } }).database;
    for (const record of records) {
      database.enemies.push({
        id: `${record.id}_before`,
        name: record.name,
        graphicHue: 0,
        transparent: false,
        flying: false,
        criticalHit: { enabled: false, oneIn: 30 },
        attackOptions: { normalAttacksMiss: false },
        skillIds: [],
        stats: { maxHp: record.stats.maxHp, maxMp: 0, attack: record.stats.attack, defense: 8, mind: 8, agility: 8 },
        rewards: { exp: 5, gold: 5, dropRatePercent: 0 },
        actions: [],
        stateRates: { state_death: "C" },
        elementRates: {},
      });
    }
  });
}, KOREAN_ENEMIES);

await openDatabaseTab(page, "db-tab-enemies");
await page.screenshot({ path: `${OUT}/01-before-no-graphic.png` });

// 수정 후: 같은 이름을 툴로 만든다. monsterResourceId 는 주지 않는다.
const toolResults: { id: string; name: string; summary: string; warnings: string[] }[] = [];
for (const record of KOREAN_ENEMIES) {
  const result = await runTool(page, "upsert_enemy", { enemy: record });
  toolResults.push({
    id: record.id,
    name: record.name,
    summary: result.summary,
    warnings: result.diff?.warnings ?? [],
  });
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

await openDatabaseTab(page, "db-tab-enemies");
await page.screenshot({ path: `${OUT}/02-after-autofilled-list.png` });

for (const [index, record] of KOREAN_ENEMIES.entries()) {
  const row = page.locator(`[data-testid="db-list-item-${record.id}"], [data-record-id="${record.id}"]`).first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForTimeout(500);
    const hero = page.getByTestId("db-enemy-hero");
    if (await hero.isVisible().catch(() => false)) {
      await hero.screenshot({ path: `${OUT}/03-${index + 1}-hero-${record.id}.png` });
    }
  }
}

await openDatabaseTab(page, "db-tab-monster-species");
await page.screenshot({ path: `${OUT}/04-species-autofilled.png` });

const closeButton = page.getByTestId("database-close");
if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/05-map-npc-visible.png` });

writeFileSync(`${OUT}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
