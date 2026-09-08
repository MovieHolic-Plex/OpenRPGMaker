import assert from "node:assert/strict";

/** Runs after the original UNSENT/copy proof, against its retained real editor and local-only project. */
export async function verifyValidationRecoveryFields(page, output) {
  const measurements = [];
  page.setDefaultTimeout(15000);
  await page.getByTestId("event-editor-window-restore").click();
  async function diagnostic(field, selectTarget = "") {
    console.log(`recovery: ${field} ${selectTarget}`);
    await page.getByTestId("event-draft-validation-summary").click();
    const row = page.locator(`.event-draft-validation-issue[data-field="${field}"][data-select-target="${selectTarget}"]`);
    assert.equal(await row.count(), 1, `one diagnostic for ${field}/${selectTarget}`);
    await row.click();
    const focused = await page.evaluate(() => {
      const node = document.activeElement;
      return { id: node?.getAttribute("data-custom-select-for") ?? node?.getAttribute("data-testid"),
        rect: node?.getBoundingClientRect().toJSON(), width: innerWidth, height: innerHeight };
    });
    assert.equal(focused.id, field);
    const rect = focused.rect;
    assert(rect && rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0
      && rect.right <= focused.width && rect.bottom <= focused.height, `visible focused field ${field}`);
    measurements.push({ field, selectTarget, ...focused });
  }
  async function choose(testId, value) {
    const index = await page.getByTestId(testId).evaluate((select, value) => Array.from(select.options).findIndex(option => option.value === value), value);
    assert(index >= 0, `existing picker option ${testId}`);
    const trigger = page.locator(`[data-custom-select-for="${testId}"]`);
    if (await trigger.count()) {
      await trigger.click();
      await page.locator(`[data-custom-select-popover] [data-option-index="${index}"]`).click();
    } else await page.getByTestId(testId).selectOption(value);
  }
  async function current() {
    return page.evaluate(() => {
      const { store, mapId } = window.validationQa;
      const event = store.getCurrent().maps[mapId].events.find(event => event.id === "validation-qa");
      return event.pages[0];
    });
  }
  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
    console.log(`recovery viewport: ${width}x${height}`);
    await page.setViewportSize({ width, height });
    const valid = await page.evaluate(() => {
      const { store, mapId } = window.validationQa;
      if (store.remotePersistenceEnabled !== false) throw new Error("QA requires disabled remote persistence");
      const project = store.getCurrent();
      const spawn = { id: "preserved-spawn", troopId: project.database.troops[0].id,
        onKillSwitchId: project.switches[0].id, graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
          direction: "left", pattern: 2, scale: 1.5 }, area: { x: 1, y: 1, w: 2, h: 2 },
        maxAlive: 4, respawnSec: 31, chase: true, factionId: "enemy", persistKill: true, footprint: { width: 2, height: 2 }, passRows: 1 };
      const invalid = structuredClone(spawn);
      invalid.troopId = "missing-troop"; invalid.onKillSwitchId = "missing-switch";
      invalid.graphic.sprite.id = "missing-graphic"; invalid.area = { x: -1, y: -1, w: -1, h: -1 };
      store.updateMap(mapId, map => {
        const page = map.events.find(event => event.id === "validation-qa").pages[0];
        page.movement = { type: "fixed", speed: 3, frequency: 3 };
        page.commands = [{ kind: "loop", body: [{ kind: "spawnFieldEnemy", spawn: invalid }, { kind: "breakLoop" }] }];
      });
      return spawn;
    });
    for (const [field, value, picker] of [
      ["event-command-spawn-troop", valid.troopId, true], ["event-command-spawn-switch", valid.onKillSwitchId, true],
      ["event-command-spawn-graphic", valid.graphic.sprite.id, false],
      ...Object.entries(valid.area).map(([key, value]) => [`event-command-spawn-area-${key}`, String(value), false]),
    ]) {
      const before = await current();
      await diagnostic(field);
      assert.deepEqual(await current(), before, "navigation must not mutate spawn data");
      assert.equal(await page.getByTestId("event-editor-inspector").getAttribute("data-command-path"), "[0,-5,0]");
      if (field.endsWith("-h")) await page.screenshot({ path: `${output}/spawn-recovery-${width}.png` });
      if (picker) await choose(field, value);
      else { await page.getByTestId(field).fill(value); await page.getByTestId(field).press("Tab"); }
    }
    assert.deepEqual((await current()).commands[0].body[0].spawn, valid);

    const routeValid = await page.evaluate(async () => {
      const { store, mapId } = window.validationQa;
      const { defaultRouteSoundId } = await import("/src/editor/panels/eventEditor/moveRouteCommandCatalog.ts");
      const sound = defaultRouteSoundId();
      const switchId = store.getCurrent().switches[0].id;
      const moves = [{ kind: "move", dir: "up" }, { kind: "playSe", resourceId: "missing-sound-a" },
        { kind: "changeGraphic", spriteId: "missing-graphic" }, { kind: "npcTransfer", mapId: "missing-map", x: -1, y: -1, direction: "left" },
        { kind: "setSwitch", switchId: "missing-switch", value: false }, { kind: "playSe", resourceId: "missing-sound-b" }];
      store.updateMap(mapId, map => {
        map.events.find(event => event.id === "validation-qa").pages[0].movement = {
          type: "custom", speed: 4, frequency: 5, route: { moves, wait: true, repeat: false, skippable: true },
        };
      });
      return { sound, switchId, mapId };
    });
    const repairs = [
      ["event-page-move-route-sound-id", 6, routeValid.sound, false],
      ["event-page-move-route-sound-id", 2, routeValid.sound, false],
      ["event-page-move-route-graphic-id", 3, "tex_easyrpg_charset_people1", false],
      ["event-page-move-route-npc-target-map", 4, routeValid.mapId, true],
      ["event-page-move-route-npc-target-x", 4, "1", false],
      ["event-page-move-route-npc-target-y", 4, "2", false],
      ["event-page-move-route-switch-id", 5, routeValid.switchId, false],
    ];
    for (const [field, step, value, picker] of repairs) {
      const before = await current();
      await diagnostic(field, `event-page-move-route-command-${step}`);
      assert((await page.getByTestId(`event-page-move-route-command-${step}`).getAttribute("class")).split(" ").includes("selected"));
      assert.deepEqual(await current(), before, "opening/selecting a route step must be read-only");
      if (step === 6) {
        await page.screenshot({ path: `${output}/route-recovery-${width}.png`, timeout: 60_000 });
        await page.getByTestId(field).fill("cancelled-repair");
        await page.getByTestId("event-page-move-route-cancel").click();
        assert.deepEqual(await current(), before, "Cancel must preserve the page");
        await diagnostic(field, `event-page-move-route-command-${step}`);
        assert.equal(await page.getByTestId(field).inputValue(), "missing-sound-b");
      }
      if (picker) await choose(field, value);
      else await page.getByTestId(field).fill(value);
      assert.deepEqual(await current(), before, "route correction remains local until OK");
      console.log(`recovery apply: ${field} ${step}`);
      await page.evaluate(() => {
        const dialog = document.querySelector('[data-testid="event-page-move-route-dialog"]');
        if (!dialog) throw new Error("Missing route dialog before apply");
        window.validationRouteClosed = new Promise(resolve => {
          const finish = closed => { observer.disconnect(); clearTimeout(timer); resolve(closed); };
          const observer = new MutationObserver(() => { if (!dialog.isConnected) finish(true); });
          const timer = setTimeout(() => finish(false), 15_000);
          observer.observe(document.body, { childList: true, subtree: true });
        });
      });
      await page.getByTestId("event-page-move-route-ok").click({ noWaitAfter: true });
      assert.equal(await page.evaluate(() => window.validationRouteClosed), true, "Apply closes its route dialog");
    }
    const pageState = await current();
    assert.deepEqual(pageState.commands[0].body[0].spawn, valid, "route editing preserves commands");
    assert.deepEqual(pageState.movement, { type: "custom", speed: 4, frequency: 5, route: { wait: true, repeat: false, skippable: true, moves: [
      { kind: "move", dir: "up" }, { kind: "playSe", resourceId: routeValid.sound },
      { kind: "changeGraphic", spriteId: "tex_easyrpg_charset_people1" }, { kind: "npcTransfer", mapId: routeValid.mapId, x: 1, y: 2, direction: "left" },
      { kind: "setSwitch", switchId: routeValid.switchId, value: false }, { kind: "playSe", resourceId: routeValid.sound },
    ] } });
    assert.equal(await page.evaluate(async () => {
      const { validateEventDraft } = await import("/src/editor/eventDraftValidator.ts");
      const { store, mapId } = window.validationQa;
      return validateEventDraft(store.getCurrent(), mapId, "validation-qa").canCommit;
    }), true);
  }
  await page.getByTestId("event-editor-save").click();
  assert.equal(await page.getByTestId("event-editor-modal").count(), 0, "repaired event passes real Save");
  return measurements;
}
