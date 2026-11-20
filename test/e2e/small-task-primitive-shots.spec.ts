// SHOTS_CASES points to a JSON array of { fixture, setup?, target, primitive, args, label }.
// fixture: "blank" (empty tool project), "built" (small-jobs snapshot), or "maou".
// target: { kind:"map", mapId? }, { kind:"event", mapId?, eventId, pageId? }, or
// { kind:"dbEntry", collection, id }. Without mapId, use the project's start map.
// setup: { mapName?, events?: GameEvent[], database?: Partial<Project["database"]>, rect?: {x,y,w,h} }.
// A blank fixture borrows the editor's default map when mapName, events or rect is supplied.
// setup may also enable dbPriceProbe for the core-only DB evidence case (see below).
// SHOTS_OUT is the output directory. Cases produce 01-before.png through 01-undo.png.

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import type { PiAgentRequest, PiCheckpointHeavyKey } from "@/ai/piAgent/protocol";
import type { CorpusCase, FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import type { GameEvent, Project, Rect } from "@/project/types";

type ShotCase = Pick<CorpusCase, "fixture" | "target" | "primitive" | "args"> & {
  label: string;
  setup?: { mapName?: string; events?: GameEvent[]; database?: Partial<Project["database"]>; rect?: Rect; dbPriceProbe?: true };
};
type RunBody = PiAgentRequest & {
  runId: string;
  heavy?: Partial<Record<PiCheckpointHeavyKey, string>>;
  heavyBlobs?: Record<string, string>;
};

const casesFile = process.env.SHOTS_CASES;
const output = process.env.SHOTS_OUT;
const cases: ShotCase[] = casesFile && output ? JSON.parse(readFileSync(casesFile, "utf8")) : [];
const probeId = "db.items.price.shotProbe";

if (!casesFile || !output) test.skip("작은 일 동작 화면 증거", () => {});

function readOverlay(fixture: FixtureName) {
  if (fixture !== "built") return undefined;
  const file = "harness-data/assistant-capability/small-jobs/built-game.json.gz";
  return JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")).overlay;
}

for (const [index, entry] of cases.entries()) {
  test(entry.label, async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(output!, { recursive: true });
    const path = (stage: string) => join(output!, `${String(index + 1).padStart(2, "0")}-${stage}.png`);
    await page.setViewportSize({ width: 1440, height: 980 });
    await page.addInitScript(() => {
      localStorage.setItem("oprn:standard-welcome-seen", "1");
      localStorage.setItem("oprn:coachmarks-basic-v1", "1");
      localStorage.setItem("oprn:ai-config", JSON.stringify({ authMode: "chatgpt", apiKey: "",
        providerId: "openai-codex", model: "gpt-6.2-sol", liteModel: "gpt-6.2-sol" }));
    });

    if (entry.setup?.dbPriceProbe && entry.primitive === probeId) {
      // Unit 19 lands independently. Supply one test-only row through its static module in this browser.
      await page.route(/\/primitives\/units\/19-db-items-equipment\.ts(?:\?|$)/u, route => route.fulfill({
        contentType: "text/javascript",
        body: `export const UNIT = "19-db-items-equipment";
          export const PRIMITIVES = [{
            id: ${JSON.stringify(probeId)}, unit: UNIT, title: "가격 변경",
            covers: { collections: ["items"] }, targets: ["dbEntry"],
            args: { type: "object", properties: { price: { type: "integer", minimum: 0 } }, required: ["price"], additionalProperties: false },
            scope: ({ target }) => ({ kind: "dbEntries", entries: [{ collection: target.collection, id: target.id }] }),
            describe: () => "고른 물건의 가격을 바꿨어요.",
            apply: ({ project, target }, { price }) => ({
              ...project, database: { ...project.database, items: project.database.items.map(
                item => item.id === target.id ? { ...item, price } : item) }
            })
          }];`,
      }));
    }

    await page.goto("/?blankProject=1", { waitUntil: "commit" });
    const guest = page.getByTestId("login-guest");
    const canvas = page.getByTestId("editor-zoom-controls");
    const canvasTrigger = canvas.getByRole("button", { name: "이걸로 작업" });
    await expect(guest.or(canvasTrigger).first()).toBeVisible({ timeout: 120_000 });
    if (await guest.isVisible()) await guest.click();
    await expect(canvasTrigger).toBeVisible({ timeout: 60_000 });

    const { target, utilityRowIndex } = await page.evaluate(async ({ fixture, setup, target, overlay }) => {
      const { store } = await import("/src/project/store.ts");
      const { editorState } = await import("/src/editor/editorState.ts");
      const { resolveTarget } = await import("/src/editor/smallTask/primitives/corpusSchema.ts");
      const editorProject = store.getCurrent();
      let project: Project;
      if (fixture === "maou") {
        const { createMaouKonbiniFlagshipDemo } = await import("/src/project/flagship/maouKonbini.ts");
        project = createMaouKonbiniFlagshipDemo().project;
      } else if (fixture === "built") {
        const { createBlankProject } = await import("/src/project/defaults/blankProject.ts");
        project = Object.assign(createBlankProject(), overlay);
      } else {
        const { createEmptyToolProject } = await import("/src/editor/tools/emptyProject.ts");
        project = createEmptyToolProject();
        if (setup?.mapName || setup?.events || setup?.rect) {
          const id = editorProject.startMapId;
          project.maps[id] = structuredClone(editorProject.maps[id]);
          project.startMapId = id;
          project.startPos = { ...editorProject.startPos };
          project.mapTree = { mapId: id, children: [] };
        }
      }
      if (setup?.database) Object.assign(project.database, setup.database);
      if (setup?.dbPriceProbe && target.kind === "dbEntry" && target.collection === "items") {
        const item = editorProject.database.items[0];
        project.database.items.push({ ...item, id: target.id, name: "포션", price: 50 });
      }
      const mapId = target.kind === "dbEntry" ? project.startMapId : target.mapId ?? project.startMapId;
      const map = project.maps[mapId];
      if (map && setup?.mapName) map.name = setup.mapName;
      if (map && setup?.events) map.events.push(...setup.events);
      store.replaceProject(project);
      const selected = resolveTarget(store.getCurrent(), target);
      if (selected.kind === "dbEntry") {
        const { openDatabaseModal } = await import("/src/editor/panels/databaseModal.ts");
        openDatabaseModal(selected.collection);
      } else {
        editorState.set({ currentMapId: selected.mapId, layer: selected.kind === "event" ? "event" : "lower",
          selectedEventId: selected.kind === "event" ? selected.eventId : null });
        if (setup?.rect) {
          const { x, y, w, h } = setup.rect;
          editorState.set({ selection: { mapId: selected.mapId, x, y, width: w, height: h } });
        }
        if (selected.kind === "event") {
          const { openEventEditorModal } = await import("/src/editor/panels/eventEditor/modal.ts");
          openEventEditorModal(selected.mapId, selected.eventId);
          if (selected.pageId) editorState.set({ selectedEventPageId: selected.pageId });
        }
      }
      const utilityRowIndex = selected.kind === "dbEntry"
        && (selected.collection === "terrains" || selected.collection === "battleCommands")
        ? store.getCurrent().database[selected.collection]?.findIndex(row => row.id === selected.id)
        : undefined;
      return { target: selected, utilityRowIndex };
    }, { ...entry, overlay: readOverlay(entry.fixture) });

    let runs = 0;
    const blobs = new Map<string, string>();
    await page.route("**/v1/agent/run?**", async route => {
      const request = route.request();
      const buffer = request.postDataBuffer()!;
      const body = JSON.parse((request.headers()["content-encoding"] === "gzip" ? gunzipSync(buffer) : buffer).toString()) as RunBody;
      expect(body.task).toBe(entry.label);
      expect(body.smallTask?.target).toEqual(target);
      expect(body.smallTask?.selection).toEqual(target.kind !== "dbEntry" && entry.setup?.rect
        ? { rect: entry.setup.rect } : undefined);
      for (const [hash, value] of Object.entries(body.heavyBlobs ?? {})) blobs.set(hash, value);
      const heavy = Object.entries(body.heavy ?? {});
      const missing = heavy.map(([, hash]) => hash).filter(hash => !blobs.has(hash));
      if (missing.length) {
        await route.fulfill({ status: 409, json: { error: "heavy-missing", missing } });
        return;
      }
      const project = { ...body.project, ...Object.fromEntries(heavy.map(([key, hash]) => [key, JSON.parse(blobs.get(hash)!)])) };
      // The worker loop is covered by piAgentSmallTask.bun.test.ts. Here the transport uses the same primitive executor.
      const done = await page.evaluate(async ({ project, scope, id, args }) => {
        const { changedProjectKeys, slimDoneEvent } = await import("/src/ai/piAgent/protocol.ts");
        const { APPLY_SMALL_TASK_PRIMITIVE, LIST_SMALL_TASK_PRIMITIVES, runSmallTaskPrimitiveTool } =
          await import("/src/editor/tools/smallTaskPrimitiveTools.ts");
        const ctx = { project, smallTaskTarget: scope.target, smallTaskSelection: scope.selection };
        const list = await runSmallTaskPrimitiveTool(ctx, LIST_SMALL_TASK_PRIMITIVES, {});
        if (!list.data?.some(row => row.id === id)) throw new Error(`동작 목록에서 ${id}를 찾지 못했습니다.`);
        await runSmallTaskPrimitiveTool(ctx, APPLY_SMALL_TASK_PRIMITIVE, { id, args });
        return slimDoneEvent({
          type: "done", smallTask: true, project: ctx.project, changedKeys: changedProjectKeys(project, ctx.project),
          stats: { ms: 0, turns: 2, toolCalls: 2, toolErrors: 0 },
        }, project);
      }, { project, scope: body.smallTask!, id: entry.primitive, args: entry.args });
      runs++;
      await route.fulfill({
        headers: { "Content-Type": "application/x-ndjson", "X-Oprn-Run-Id": body.runId },
        body: JSON.stringify(done) + "\n",
      });
    });

    const panel = target.kind === "dbEntry" ? page.getByTestId("database-modal")
      : target.kind === "event" ? page.getByTestId("event-editor-modal") : canvas;
    let triggerHost = panel;
    if (target.kind === "dbEntry") {
      if (target.collection === "battleCommands") {
        triggerHost = panel.getByTestId(`db-battle-command-editor-${utilityRowIndex}`);
      } else if (target.collection === "terrains") {
        await panel.getByTestId(`db-terrain-preset-${utilityRowIndex}`).click();
        triggerHost = panel.getByTestId("db-terrain-hero");
      } else {
        await panel.getByTestId(`db-record-row-${target.id}`).click();
      }
    }
    const trigger = triggerHost.getByRole("button", { name: "이걸로 작업" });
    await expect(trigger).toBeVisible();
    const snapshot = () => page.evaluate(async () => {
      const { store } = await import("/src/project/store.ts");
      const { normalizationFingerprint } = await import("/src/util/structuralJson.ts");
      return normalizationFingerprint(store.getCurrent());
    });
    const before = await snapshot();
    await page.screenshot({ path: path("before") });
    await trigger.click();
    const box = page.getByRole("dialog", { name: "작은 일" });
    await expect(box).toContainText(target.label);
    await box.getByRole("textbox").fill(entry.label);
    await box.getByRole("textbox").press("Enter");
    const undo = box.getByRole("button", { name: "되돌리기" });
    await expect(undo).toBeVisible({ timeout: 90_000 });
    expect(await snapshot()).not.toBe(before);
    await page.screenshot({ path: path("after") });
    await box.screenshot({ path: path("summary") });
    await undo.click();
    await expect(box.getByRole("status")).toHaveText("되돌렸어요.");
    expect(await snapshot()).toBe(before);
    expect(runs).toBe(1);
    await page.screenshot({ path: path("undo") });
  });
}
