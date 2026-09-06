import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { serialize } from "../../src/project/io";
import type { Project } from "../../src/project/types";
import { buildFixture, movie, picture, type MediaCommand } from "../eventCommandRemediation/U04.fixture";
import {
  cancelCommand, confirmCommand, enterLocalEditor, openCommandRow, openMapCommand,
  projectObservation, readEditorProject, reimportProject,
} from "./eventCommandRemediationHarness";

test.use({ browserName: "firefox", launchOptions: { args: [] } });
const out = process.env.U04_EVIDENCE_DIR ?? ".omo/evidence/event-command-remediation/U04";
const dialog = (page: Page) => page.getByTestId("event-command-edit-dialog");
const commands = (project: Project) => project.maps.map_intro!.events[0]!.pages![0]!.commands;

type Case = { name: string; index: number; initial: MediaCommand; expected: MediaCommand };
function editorFixture() {
  const source = buildFixture();
  const cases: Case[] = [];
  for (const durationMs of [500, 0]) {
    for (const waitForPicture of [true, false, undefined]) {
      const initial = picture(waitForPicture, durationMs);
      if (waitForPicture === undefined) delete initial.waitForPicture;
      const index = cases.length === 0 ? 0 : commands(source).length;
      commands(source)[index] = initial;
      cases.push({ name: `g3-f10-${durationMs}-${waitForPicture ?? "omitted"}`, index, initial, expected: { ...initial, x: 30 } });
    }
  }
  for (const wait of [true, false]) {
    for (const skippable of [true, false]) {
      const initial = movie({ wait: !wait, skippable: !skippable });
      const index = commands(source).length;
      commands(source).push(initial);
      cases.push({ name: `g5-f2-${wait}-${skippable}`, index, initial, expected: movie({ wait, skippable }) });
    }
  }
  cases.push({ name: "g5-f2-omitted", index: 2, initial: movie(), expected: movie({ wait: false, skippable: false }) });
  return { source, cases };
}

async function checkForm(page: Page, expected: MediaCommand) {
  if (expected.kind === "showPicture") {
    for (const [field, value] of Object.entries({ x: expected.x, y: expected.y, scale: expected.scale, opacity: 50, rotation: expected.rotation, duration: expected.durationMs })) {
      assert.equal(await dialog(page).getByTestId(`show-picture-${field}-input`).inputValue(), String(value));
    }
    assert.equal(await dialog(page).getByTestId("show-picture-wait-select").inputValue(), String(expected.waitForPicture === true));
    const imageWidth = await dialog(page).getByTestId("show-picture-preview-marker").locator("img").evaluate(async node => {
      if (!(node instanceof HTMLImageElement)) throw new Error("Picture preview is not an image");
      await node.decode();
      return node.naturalWidth;
    });
    assert.equal(imageWidth, 32);
  } else {
    assert.equal(await dialog(page).getByTestId("play-movie-wait-select").inputValue(), String(expected.wait !== false));
    assert.equal(await dialog(page).getByTestId("play-movie-skippable-select").inputValue(), String(expected.skippable !== false));
  }
}

async function geometry(page: Page, name: string) {
  const result = [];
  for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await dialog(page).getByTestId("event-command-edit-ok").scrollIntoViewIfNeeded();
    const bounds = await dialog(page).evaluate(node => {
      const ok = node.querySelector('[data-testid="event-command-edit-ok"]')!.getBoundingClientRect();
      return { overflow: node.scrollWidth > node.clientWidth, confirm: { top: ok.top, bottom: ok.bottom, height: ok.height }, viewport: { width: innerWidth, height: innerHeight } };
    });
    assert.equal(bounds.overflow, false);
    assert.ok(bounds.confirm.top >= 0 && bounds.confirm.bottom <= height!);
    assert.ok(bounds.confirm.height >= 32);
    result.push(bounds);
    await page.screenshot({ path: join(out, `${name}-reopen-${width}.png`), fullPage: false });
  }
  return result;
}

test("G3-F10 / G5-F2 real map editor Confirm/reopen/Cancel/export-import and adversarial preservation", async ({ page, baseURL }) => {
  test.setTimeout(600_000);
  page.setDefaultTimeout(10_000);
  assert.ok(baseURL);
  await mkdir(out, { recursive: true });
  const { source, cases } = editorFixture();
  const local = await enterLocalEditor(page, source, baseURL);
  let saved = source;
  const receipts = [];
  try {
    console.log("U04 editor ready; all edge cases authored in one temporary event");
    await writeFile(join(out, "editor-source.json"), serialize(source));
    await openMapCommand(page, "host", [cases[0]!.index]);
    for (const [number, entry] of cases.entries()) {
      if (number > 0) await openCommandRow(page, page.getByTestId("event-editor-modal"), [entry.index]);
      await checkForm(page, entry.initial);
      if (entry.expected.kind === "showPicture") {
        await dialog(page).getByTestId("show-picture-x-input").fill("30");
        await dialog(page).getByTestId("show-picture-y-input").focus();
      } else {
        await dialog(page).getByTestId(`play-movie-wait-select-segment-${entry.expected.wait}`).click();
        await dialog(page).getByTestId(`play-movie-skippable-select-segment-${entry.expected.skippable}`).click();
      }
      const illustrated = entry.name === "g3-f10-500-true" || entry.name === "g5-f2-false-false";
      if (illustrated) await page.screenshot({ path: join(out, `${entry.name}-confirm.png`), fullPage: false });
      const trace = await confirmCommand(page, "map", [projectObservation(["maps", "map_intro", "events", 0, "pages", 0, "commands", entry.index], entry.expected)]);
      const next = await readEditorProject(page);
      assert.deepEqual(commands(next)[entry.index], entry.expected);
      assert.deepEqual(next.maps.map_intro!.events[1], source.maps.map_intro!.events[1]);
      assert.deepEqual(next.assets, source.assets);
      assert.deepEqual(next.database, source.database);
      commands(saved).forEach((command, other) => { if (other !== entry.index) assert.deepEqual(commands(next)[other], command); });
      saved = next;
      await openCommandRow(page, page.getByTestId("event-editor-modal"), [entry.index]);
      await checkForm(page, entry.expected);
      const dimensions = illustrated ? await geometry(page, entry.name) : [];
      if (entry.expected.kind === "showPicture") {
        await dialog(page).getByTestId(`show-picture-wait-select-segment-${entry.expected.waitForPicture !== true}`).click();
        await dialog(page).getByTestId("show-picture-x-input").fill("99");
      } else {
        assert.equal(await dialog(page).getByTestId("play-movie-preview-video").getAttribute("src"), source.assets.uploaded[entry.expected.resourceId]!.dataUrl);
        await dialog(page).getByTestId(`play-movie-wait-select-segment-${!entry.expected.wait}`).click();
      }
      await cancelCommand(page, saved);
      receipts.push({ ...entry, trace, dimensions, cancelRetained: true, wrongTargetUnchanged: true, unrelatedCommandsUnchanged: true });
      console.log(`${entry.name}: Confirm/Apply/reopen/Cancel PASS`);
    }
    await page.getByTestId("event-editor-modal-close").click();
    const wire = await reimportProject(page, saved);
    await openMapCommand(page, "host", [cases[0]!.index]);
    for (const [number, entry] of cases.entries()) {
      if (number > 0) await openCommandRow(page, page.getByTestId("event-editor-modal"), [entry.index]);
      await checkForm(page, entry.expected);
      await cancelCommand(page, saved);
    }
    await page.getByTestId("event-editor-modal-close").click();
    await writeFile(join(out, "editor-project.json"), wire);
    await writeFile(join(out, "editor-cases.json"), JSON.stringify(receipts, null, 2));
    local.assertNoRemoteWrites();
    console.log("U04 editor PASS: six picture cases, four movie combinations, omitted-to-off; all reopened after real file import; no remote writes");
  } finally { await local.dispose(); }
});
