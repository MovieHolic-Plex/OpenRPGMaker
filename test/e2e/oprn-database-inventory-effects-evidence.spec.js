import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "@playwright/test";

const EVIDENCE_DIR = "output/evidence/database-tabs-team/T2-inventory-effects";
const TABS = [
  { label: "Skills", slug: "skills", testId: "db-tab-skills" },
  { label: "Items", slug: "items", testId: "db-tab-items" },
  { label: "Equipment", slug: "equipment", testId: "db-tab-equipment" },
  { label: "States", slug: "states", testId: "db-tab-states" },
];

test("T2 inventory/effects evidence packet", async ({ page }) => {
  test.setTimeout(90_000);
  const captureDir = join(tmpdir(), "rpg-zzu-t2-inventory-effects-evidence");
  await rm(captureDir, { force: true, recursive: true });
  await mkdir(`${captureDir}/tabs`, { recursive: true });
  const scenario = {
    acceptance: [
      "skills, items, equipment, and states render in a real browser",
      "representative edits survive Apply plus Database close/reopen",
      "exported project JSON contains the edited canonical Project.database records",
      "tab metrics and screenshots are captured for every assigned top tab",
    ],
    name: "T2 inventory/effects Database tabs",
    path: [
      "open fresh project",
      "open Database modal",
      "edit skill/item/equipment/state fields",
      "apply changes",
      "close and reopen Database",
      "capture assigned top tab screenshots and JSON state",
    ],
    route: "/?freshProject=1",
    viewports: [{ height: 800, name: "desktop", width: 1280 }],
  };

  await page.setViewportSize({ width: 1280, height: 800 });
  // DB 툴바(toolbar-database)는 expert chrome 에서만 노출된다.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await editInventoryEffects(page);
  await page.getByTestId("database-footer-apply").click();
  await page.getByTestId("database-modal-close").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();
  await openDatabase(page);

  const tabMetrics = [];
  for (const tab of TABS) {
    await switchTab(page, tab);
    const screenshot = `${captureDir}/tabs/${tab.slug}.png`;
    await page.getByTestId("database-modal").screenshot({ path: screenshot });
    tabMetrics.push({ metrics: await shellMetrics(page), screenshot: `${EVIDENCE_DIR}/tabs/${tab.slug}.png`, slug: tab.slug, testId: tab.testId });
  }

  const project = await exportedProject(page);
  const stateCapture = findEditedRecords(project);
  expect(stateCapture.skill?.effect).toMatchObject({ affects: "mp", kind: "healing", statistic: "mind" });
  expect(stateCapture.item?.healStateIds).toContain("state_poison");
  expect(stateCapture.equipment?.twoHanded).toBe(true);
  expect(stateCapture.state?.name).toBe("QA 독 상태");

  await page.close();

  await mkdir(`${EVIDENCE_DIR}/tabs`, { recursive: true });
  await writeJson(`${EVIDENCE_DIR}/scenario.json`, scenario);
  for (const tab of TABS) {
    await copyFile(`${captureDir}/tabs/${tab.slug}.png`, `${EVIDENCE_DIR}/tabs/${tab.slug}.png`);
  }
  await writeJson(`${EVIDENCE_DIR}/project-export.json`, project);
  await writeJson(`${EVIDENCE_DIR}/tab-metrics.json`, tabMetrics);
  await writeJson(`${EVIDENCE_DIR}/state-capture.json`, stateCapture);
});

async function openDatabase(page) {
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
}

async function switchTab(page, tab) {
  await page.getByTestId(tab.testId).click({ force: true });
  await expect(page.getByTestId(tab.testId)).toHaveClass(/active/);
}

async function editInventoryEffects(page) {
  await page.getByTestId("db-tab-skills").click();
  await page.getByTestId("db-field-name").fill("QA 포커스");
  await page.getByTestId("db-field-scope").selectOption("ally");
  await page.getByTestId("db-field-power").fill("44");
  await page.getByTestId("db-picker-animation").selectOption("anim_heal");
  await page.getByTestId("db-field-skill-description").fill("QA support proof");
  await page.getByTestId("db-field-skill-mp-flat").fill("6");
  await page.getByTestId("db-field-skill-success").fill("88");
  await page.getByTestId("db-field-skill-hit-rate").fill("92");
  await page.getByTestId("db-field-skill-effect-kind").selectOption("healing");
  await page.getByTestId("db-field-skill-effect-affects").selectOption("mp");

  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-field-name").fill("QA 만능약");
  await page.getByTestId("db-field-item-type").selectOption("medicine");
  await page.getByTestId("db-field-item-consumption-limit").selectOption("2");
  // 대상은 T9 이후 세그먼트 컨트롤(네이티브 radio) — 레이블 클릭으로 선택.
  await page.getByTestId("db-field-item-scope").getByText("아군 전체").click();
  await page.getByTestId("db-field-item-state-state_poison").check();
  // 회복 % 는 T9 이후 슬라이더+스테퍼 쌍 — 스테퍼(number input)에 값을 입력한다.
  await page.getByTestId("db-field-item-hp-percent-stepper").fill("15");
  await page.getByTestId("db-field-item-mp-flat").fill("8");

  await page.getByTestId("db-tab-equipment").click();
  await page.getByTestId("db-field-name").fill("QA 부적검");
  // 부위는 헤더 세그먼트(네이티브 radio) 하나뿐 — 중복이던 레거시 <select> 는 제거됐다.
  await page.locator('[data-testid="db-field-equipment-slot-option"][value="weapon"]').check();
  await page.getByTestId("db-field-equipment-description").fill("QA equipment proof");
  await page.getByTestId("db-field-equipment-attack").fill("13");
  await page.getByTestId("db-field-equipment-defense").fill("4");
  await page.getByTestId("db-field-equipment-two-handed").check();
  await page.getByTestId("db-field-equipment-actor-actor_hero").check();
  await page.getByTestId("db-field-equipment-state-state_poison").check();
  await page.getByTestId("db-picker-equipment-use-skill").selectOption({ label: "QA 포커스" });

  await page.getByTestId("db-tab-states").click();
  await page.getByTestId("db-field-name").fill("QA 독 상태");
}

async function exportedProject(page) {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export json");
  return JSON.parse(text).project;
}

async function shellMetrics(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('[data-testid="database-modal"]');
    const modalBody = document.querySelector(".database-modal-body");
    const tabs = document.querySelector(".database-modal-body .db-tabs");
    const body = document.querySelector(".database-modal-body .db-body");
    // db-manual-source/db-workbench-status 는 모던화(T5~T15)로 제거된 레거시 표면이다.
    if (!(modal instanceof HTMLElement) || !(modalBody instanceof HTMLElement) || !(tabs instanceof HTMLElement) || !(body instanceof HTMLElement)) {
      throw new Error("Database shell is missing required layout elements");
    }
    const modalRect = modal.getBoundingClientRect();
    return {
      bodyTop: Math.round(body.getBoundingClientRect().top),
      modalBodyScrollTop: Math.round(modalBody.scrollTop),
      modalHeight: Math.round(modalRect.height),
      modalWidth: Math.round(modalRect.width),
      tabsTop: Math.round(tabs.getBoundingClientRect().top),
    };
  });
}

function findEditedRecords(project) {
  return {
    equipment: project.database.equipment.find((record) => record.name === "QA 부적검"),
    item: project.database.items.find((record) => record.name === "QA 만능약"),
    skill: project.database.skills.find((record) => record.name === "QA 포커스"),
    state: project.database.states.find((record) => record.name === "QA 독 상태"),
  };
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
