import { expect, test, type Page } from "@playwright/test";
import { get } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Project } from "../../src/project/types";

// Run from this worktree with port 19035 initially unused:
// DEV_SERVER_PORT=19035 E2E_RETRIES=0 VITE_LEGACY_DB_URL= VITE_LEGACY_DB_ANON_KEY=
// VITE_LEGACY_DB_PROJECT_ID= VITE_AI_ACTIVITY_DISK_MIRROR=0 VITE_EDIT_ACTIVITY_DISK_MIRROR=0
// npm run test:e2e -- test/e2e/database-cinematics.spec.ts
// The repository's webServer starts Vite with E2E_FREEZE_DEV_SERVER=1.
// The lead must stop any previous 19035 server before this invocation because
// the shared config permits reuse. Never redirect this test to occupied 9841.
const origin = `http://127.0.0.1:${process.env.DEV_SERVER_PORT ?? "9173"}`;
const prefix = "db-cinematic-";

test.use({
  actionTimeout: 15_000,
  navigationTimeout: 90_000,
  launchOptions: {
    args: [
      "--no-sandbox",
      "--use-gl=swiftshader",
      "--disable-gpu",
      "--disable-features=LocalNetworkAccessChecks",
    ],
  },
});
// This full author/reload/native-media journey is not a performance test.
// Keep the 15s action and bounded event deadlines; allow the complete matrix
// case to finish on the shared host without exhausting its aggregate budget.
test.describe.configure({ timeout: 600_000, retries: 0 });

type SignalResult = { error?: string };
type ProbeWindow = Window & {
  cinematicSignal: Promise<SignalResult>;
  cinematicMedia: HTMLMediaElement[];
  cinematicMediaProof: { kind: string; time: number; width: number; height: number }[];
};

async function project(page: Page): Promise<Project> {
  return page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store }: typeof import("../../src/project/store") = await import(path);
    if (store.isRemotePersistenceEnabled()) throw new Error("Remote persistence must remain disabled");
    return store.getCurrent();
  });
}

/**
 * Subscribe before an asynchronous editor mutation. Resolve only on the
 * specified public project field, not on an unrelated store notification.
 * The timeout becomes an assertion result, not an unhandled rejected promise.
 */
async function armProject(
  page: Page,
  path: string[],
  expected: unknown,
  nonempty = false,
): Promise<void> {
  await page.evaluate(async ({ path, expected, nonempty }) => {
    const modulePath = "/src/project/store.ts";
    const { store }: typeof import("../../src/project/store") = await import(modulePath);
    const state = window as unknown as ProbeWindow;
    state.cinematicSignal = new Promise(resolveSignal => {
      const timer = window.setTimeout(() => {
        unsubscribe();
        resolveSignal({ error: `No project event for ${path.join(".")}` });
      }, 20_000);
      const unsubscribe = store.subscribe(next => {
        let value: unknown = next;
        for (const key of path) {
          value = value !== null && typeof value === "object" ? Reflect.get(value, key) : undefined;
        }
        const matches = nonempty
          ? typeof value === "string" && value.length > 0
          : JSON.stringify(value) === JSON.stringify(expected);
        if (!matches) return;
        clearTimeout(timer);
        unsubscribe();
        resolveSignal({});
      });
    });
  }, { path, expected, nonempty });
}

async function armPreview(page: Page, present: boolean): Promise<void> {
  await page.evaluate(present => {
    const state = window as unknown as ProbeWindow;
    state.cinematicSignal = new Promise(resolveSignal => {
      const observer = new MutationObserver(() => {
        const exists = document.querySelector('[data-testid="cinematic-sequence"]') !== null;
        if (exists !== present) return;
        clearTimeout(timer);
        observer.disconnect();
        resolveSignal({});
      });
      const timer = window.setTimeout(() => {
        observer.disconnect();
        resolveSignal({ error: `Preview did not become ${present ? "present" : "absent"}` });
      }, 10_000);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }, present);
}

async function signal(page: Page): Promise<void> {
  const result = await page.evaluate(() => (window as unknown as ProbeWindow).cinematicSignal);
  expect(result.error).toBeUndefined();
}

/**
 * Listen before playback is started/advanced. Stop through the actual Stop
 * control on the first native progress event. This cannot race a short WebM's
 * ended event or pass merely because the decoder emitted loadedmetadata.
 */
async function armNativeProgressAndStop(page: Page, kind: "audio" | "video"): Promise<void> {
  await page.evaluate(kind => {
    const state = window as unknown as ProbeWindow;
    state.cinematicSignal = new Promise(resolveSignal => {
      const lifetime = new AbortController();
      const timer = window.setTimeout(() => {
        lifetime.abort();
        resolveSignal({ error: `No native ${kind} progress` });
      }, 15_000);
      document.addEventListener("timeupdate", event => {
        const media = event.target;
        if (!(media instanceof HTMLMediaElement)
          || media.tagName.toLowerCase() !== kind
          || !media.closest('[data-testid="cinematic-sequence"]')
          || media.currentTime <= 0) return;
        const stop = document.querySelector<HTMLButtonElement>('[data-testid="db-cinematic-preview-stop"]');
        if (!stop || stop.disabled) {
          clearTimeout(timer);
          lifetime.abort();
          resolveSignal({ error: "Native playback has no usable Stop control" });
          return;
        }
        state.cinematicMediaProof.push({
          kind,
          time: media.currentTime,
          width: media instanceof HTMLVideoElement ? media.videoWidth : 0,
          height: media instanceof HTMLVideoElement ? media.videoHeight : 0,
        });
        clearTimeout(timer);
        lifetime.abort();
        stop.click();
        resolveSignal({});
      }, { capture: true, signal: lifetime.signal });
    });
  }, kind);
}

async function openDatabase(page: Page): Promise<void> {
  {
    await page.getByTestId("toolbar-database").click();
  }
  await expect(page.getByTestId("database-modal")).toBeVisible();
}

async function tab(page: Page, name: "opening" | "game-over" | "system"): Promise<void> {
  const button = page.getByTestId(`db-tab-${name}`);
  if (!await button.isVisible()) await page.getByTestId("db-tab-group-system").click();
  await button.click();
  await expect(button).toHaveClass(/active/);
}

async function scene(page: Page, id: string): Promise<void> {
  await page.getByTestId(`${prefix}scene-${id}`).click();
}

async function selectResource(page: Page, slot: string, id: string): Promise<void> {
  await page.getByTestId(`${prefix}${slot}-set`).click();
  await page.getByTestId(`${prefix}${slot}-dialog-search`).fill(id);
  await page.getByTestId(`${prefix}${slot}-dialog-option-${id}`).click();
  await page.getByTestId(`${prefix}${slot}-dialog-ok`).click();
}

function wav(): Buffer {
  const rate = 8000;
  const samples = rate * 8;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    bytes.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / rate) * 1500), 44 + i * 2);
  }
  return bytes;
}

async function cleanPreview(page: Page): Promise<void> {
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await expect(page.getByTestId("cinematic-sequence")).toHaveCount(0);
  await expect(page.getByTestId(`${prefix}preview-stage`).locator(".play-viewport")).toHaveCount(0);
  const media = await page.evaluate(() =>
    (window as unknown as ProbeWindow).cinematicMedia.map(media => ({
      paused: media.paused, source: media.getAttribute("src"), attached: media.isConnected,
    })));
  for (const entry of media) expect(entry).toEqual({ paused: true, source: null, attached: false });
}

for (const matrix of [
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const) {
  test(`${matrix.width}x${matrix.height}: cinematic authoring and restored preview`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("dialog", async dialog => {
      if (dialog.type() === "beforeunload") await dialog.accept();
      else {
        errors.push(`Unexpected browser dialog: ${dialog.type()}`);
        await dialog.dismiss();
      }
    });
    page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
    page.on("console", message => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    page.on("requestfailed", request => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));

    // Raw Node HTTP preserves encoded bytes, HTTP status and headers. Only
    // GETs to this owned server are forwarded; nothing is mocked successful.
    await page.route(url => url.origin === origin, async route => {
      const request = route.request();
      if (request.method() !== "GET") return route.continue();
      const response = await new Promise<{ status: number; headers: Record<string, string>; body: Buffer }>((resolveResponse, reject) => {
        const transport = get(request.url(), { headers: request.headers() }, incoming => {
          const chunks: Buffer[] = [];
          incoming.on("data", chunk => chunks.push(Buffer.from(chunk)));
          incoming.on("error", reject);
          incoming.on("end", () => {
            const headers: Record<string, string> = {};
            for (const [key, value] of Object.entries(incoming.headers)) {
              if (value !== undefined) headers[key] = Array.isArray(value) ? value.join(", ") : value;
            }
            resolveResponse({ status: incoming.statusCode ?? 500, headers, body: Buffer.concat(chunks) });
          });
        });
        transport.on("error", reject);
        transport.setTimeout(30_000, () => transport.destroy(new Error("Owned-server GET timed out")));
      });
      await route.fulfill(response);
    });
    // A blank project is local-only. Fail closed if any app path attempts a
    // remote project write, rather than sending it to a user's LegacyDb row.
    await page.route(url => /\/rest\/v1\//.test(url.pathname), async route => {
      if (["POST", "PATCH", "PUT", "DELETE"].includes(route.request().method())) {
        errors.push(`Forbidden remote project write: ${route.request().url()}`);
        await route.abort("blockedbyclient");
      } else await route.fallback();
    });
    await page.setViewportSize({ width: matrix.width, height: matrix.height });
    await page.addInitScript(mode => {
      const state = window as unknown as ProbeWindow;
      state.cinematicMedia = [];
      state.cinematicMediaProof = [];
      document.addEventListener("loadedmetadata", event => {
        const media = event.target;
        if (media instanceof HTMLMediaElement && media.closest('[data-testid="cinematic-sequence"]')
          && !state.cinematicMedia.includes(media)) state.cinematicMedia.push(media);
      }, true);
    }, matrix.mode);

    try {
      await page.goto(`${origin}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
      await project(page);
      expect(await page.evaluate(async () => {
        const { projectRepository } = await import("/src/project/persistence/repository.ts");
        return projectRepository().kind;
      }), "이 격리 편집기 테스트는 브리지 없는 기본(메모리) 저장소여야 한다").toBe("memory");
      await openDatabase(page);
      const untouched = await project(page);
      await tab(page, "opening");
      await tab(page, "game-over");
      expect((await project(page)).system).toEqual(untouched.system);
      await tab(page, "system");
      await expect(page.getByTestId("db-title-workbench")).toHaveCount(1);
      await tab(page, "opening");

      await page.getByTestId(`${prefix}enabled`).check();
      await page.getByTestId(`${prefix}skippable`).uncheck();
      await page.getByTestId(`${prefix}add`).click();
      const narration = page.getByTestId(`${prefix}narration`);
      await narration.fill("First authored text");
      await narration.press("End");
      await narration.pressSequentially(" + caret");
      await expect(narration).toBeFocused();
      await expect(narration).toHaveValue("First authored text + caret");
      const textId = (await project(page)).system.opening!.scenes[0].id;

      const gifBytes = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
      const gifPath = info.outputPath("authoring-image.gif");
      const audioPath = info.outputPath("authoring-voice.wav");
      await writeFile(gifPath, gifBytes);
      await writeFile(audioPath, wav());
      const moviePath = resolve("test/fixtures/cinematics/contract.webm");
      await page.getByTestId(`${prefix}add`).click();
      await page.getByTestId(`${prefix}narration`).fill("Second authored image");
      await page.getByTestId(`${prefix}kind`).selectOption("image");
      expect((await project(page)).system.opening!.scenes[1].kind).toBe("text");
      await armProject(page, ["system", "opening", "scenes", "1", "kind"], "image");
      await page.getByTestId(`${prefix}resource-upload`).setInputFiles(gifPath);
      await signal(page);
      await expect(page.getByTestId(`${prefix}kind`)).toHaveValue("image");
      await page.getByTestId(`${prefix}motion`).selectOption("pan");
      await armProject(page, ["system", "opening", "scenes", "1", "narrationAudioResourceId"], null, true);
      await page.getByTestId(`${prefix}voice-upload`).setInputFiles(audioPath);
      await signal(page);

      await page.getByTestId(`${prefix}add`).click();
      await page.getByTestId(`${prefix}narration`).fill("Third authored video");
      await page.getByTestId(`${prefix}kind`).selectOption("video");
      await armProject(page, ["system", "opening", "scenes", "2", "kind"], "video");
      await page.getByTestId(`${prefix}resource-upload`).setInputFiles(moviePath);
      await signal(page);
      let authored = await project(page);
      const image = authored.system.opening!.scenes[1];
      const video = authored.system.opening!.scenes[2];
      expect(image.kind).toBe("image");
      expect(video.kind).toBe("video");
      if (image.kind !== "image" || video.kind !== "video") throw new Error("Missing authored variants");
      expect(video).not.toHaveProperty("motion");
      expect(Buffer.from(authored.assets.uploaded[image.resourceId].dataUrl.split(",")[1], "base64")).toEqual(gifBytes);
      expect(Buffer.from(authored.assets.uploaded[video.resourceId].dataUrl.split(",")[1], "base64")).toEqual(await readFile(moviePath));
      expect(Buffer.from(authored.assets.uploaded[image.narrationAudioResourceId!].dataUrl.split(",")[1], "base64")).toEqual(wav());
      for (const id of [image.resourceId, video.resourceId, image.narrationAudioResourceId!]) {
        expect(authored.resourceProfiles.filter(profile => profile.assetId === id)).toHaveLength(1);
      }

      // Real resource selection, not direct ID writes, on both shared tabs.
      await tab(page, "game-over");
      await page.getByTestId(`${prefix}enabled`).check();
      await page.getByTestId(`${prefix}skippable`).uncheck();
      await page.getByTestId(`${prefix}add`).click();
      await page.getByTestId(`${prefix}narration`).fill("The final scene");
      await page.getByTestId(`${prefix}kind`).selectOption("image");
      await selectResource(page, "resource", image.resourceId);
      await selectResource(page, "voice", image.narrationAudioResourceId!);
      await selectResource(page, "background", image.resourceId);
      for (const [key, value] of Object.entries({
        title: "End of the test journey", message: "A new attempt awaits.",
        retryLabel: "Try this test again", titleLabel: "Return to test title",
      })) await page.getByTestId(`${prefix}game-over-${key}`).fill(value);
      await page.getByTestId(`${prefix}game-over-retryLabel`).fill("");
      expect((await project(page)).system.gameOver).not.toHaveProperty("retryLabel");
      await page.getByTestId(`${prefix}game-over-retryLabel`).fill("Try this test again");
      await page.getByTestId(`${prefix}enabled`).uncheck();
      expect((await project(page)).system.gameOver!.sequence!.scenes[0]).toMatchObject({
        kind: "image", resourceId: image.resourceId, narration: "The final scene",
      });
      await page.screenshot({ path: info.outputPath("game-over-authoring.png") });

      await tab(page, "opening");
      await scene(page, video.id);
      await page.getByTestId(`${prefix}up`).click();
      expect((await project(page)).system.opening!.scenes.map(scene => scene.id))
        .toEqual([textId, video.id, image.id]);
      await armProject(page, ["system", "opening", "scenes", "1", "id"], image.id);
      await page.getByTestId(`${prefix}up`).focus();
      await page.keyboard.press("Control+z");
      await signal(page);
      await armProject(page, ["system", "opening", "scenes", "1", "id"], video.id);
      await page.getByTestId(`${prefix}preview-start`).focus();
      await page.keyboard.press("Control+y");
      await signal(page);
      await scene(page, video.id);
      await page.getByTestId(`${prefix}down`).click();
      await page.getByTestId(`${prefix}enabled`).uncheck();
      authored = await project(page);
      expect(authored.system.opening!.scenes.map(scene => scene.kind)).toEqual(["text", "image", "video"]);
      expect(authored.system.opening!.skippable).toBe(false);
      expect(authored.system.opening!.enabled).toBe(false);

      // Read and roundtrip the real public codec. No hand-constructed wire
      // fixture and no LegacyDb save claim: this is JSON serialization/reload.
      const roundtrip = await page.evaluate(async () => {
        const storePath = "/src/project/store.ts";
        const codecPath = "/src/project/io.ts";
        const { store }: typeof import("../../src/project/store") = await import(storePath);
        const { serialize, deserialize }: typeof import("../../src/project/io") = await import(codecPath);
        const raw = serialize(store.getCurrent());
        const restored = deserialize(raw);
        return { raw, opening: restored.system.opening, gameOver: restored.system.gameOver };
      });
      // Object-key order is not authored data; array order and every value are.
      expect(roundtrip.opening).toEqual(authored.system.opening);
      expect(roundtrip.gameOver).toEqual(authored.system.gameOver);
      const wire = roundtrip.raw;
      await writeFile(info.outputPath("authored-project.json"), wire);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
      await page.evaluate(async raw => {
        const storePath = "/src/project/store.ts";
        const codecPath = "/src/project/io.ts";
        const { store }: typeof import("../../src/project/store") = await import(storePath);
        const { deserialize }: typeof import("../../src/project/io") = await import(codecPath);
        if (store.isRemotePersistenceEnabled()) throw new Error("Reload left local-only mode");
        store.replaceProject(deserialize(raw));
      }, wire);
      await openDatabase(page);
      await tab(page, "opening");
      expect((await project(page)).system.opening).toEqual(authored.system.opening);
      await expect(page.getByTestId(`${prefix}enabled`)).not.toBeChecked();
      await expect(page.getByTestId(`${prefix}skippable`)).not.toBeChecked();
      for (const entry of authored.system.opening!.scenes) {
        await scene(page, entry.id);
        await expect(page.getByTestId(`${prefix}kind`)).toHaveValue(entry.kind);
        await expect(page.getByTestId(`${prefix}narration`)).toHaveValue(entry.narration);
      }
      await scene(page, image.id);
      await expect(page.getByTestId(`${prefix}motion`)).toHaveValue("pan");
      await page.screenshot({ path: info.outputPath("opening-restored.png") });
      await tab(page, "game-over");
      expect((await project(page)).system.gameOver).toEqual(authored.system.gameOver);
      await expect(page.getByTestId(`${prefix}game-over-title`)).toHaveValue("End of the test journey");
      await expect(page.getByTestId(`${prefix}game-over-message`)).toHaveValue("A new attempt awaits.");
      await expect(page.getByTestId(`${prefix}game-over-retryLabel`)).toHaveValue("Try this test again");
      await expect(page.getByTestId(`${prefix}game-over-titleLabel`)).toHaveValue("Return to test title");

      await tab(page, "opening");
      const beforePreview = (await project(page)).system;
      await armPreview(page, true);
      await page.getByTestId(`${prefix}preview-start`).click();
      await signal(page);
      const bounds = await page.getByTestId(`${prefix}preview-stage`).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(matrix.height);
      await page.screenshot({ path: info.outputPath("sequence-preview.png") });
      await armPreview(page, false);
      await page.keyboard.press("Escape");
      await signal(page);
      await cleanPreview(page);
      await expect(page.getByTestId(`${prefix}preview-start`)).toBeFocused();
      expect((await project(page)).system).toEqual(beforePreview);

      await armPreview(page, true);
      await page.getByTestId(`${prefix}preview-start`).click();
      await signal(page);
      await armNativeProgressAndStop(page, "audio");
      await page.keyboard.press("Enter");
      await signal(page);
      await cleanPreview(page);

      // Put the video first via authoring controls, then prove decoded native
      // progress and synchronous Stop cleanup without depending on clip length.
      await scene(page, video.id);
      await page.getByTestId(`${prefix}up`).click();
      await page.getByTestId(`${prefix}up`).click();
      await armNativeProgressAndStop(page, "video");
      await page.getByTestId(`${prefix}preview-start`).click();
      await signal(page);
      await cleanPreview(page);
      const proof = await page.evaluate(() => (window as unknown as ProbeWindow).cinematicMediaProof);
      expect(proof.map(entry => entry.kind)).toEqual(["audio", "video"]);
      expect(proof.every(entry => entry.time > 0)).toBe(true);
      expect(proof[1].width).toBeGreaterThan(0);
      expect(proof[1].height).toBeGreaterThan(0);

      await tab(page, "game-over");
      await armPreview(page, true);
      await page.getByTestId(`${prefix}preview-start`).click();
      await signal(page);
      await armPreview(page, false);
      await tab(page, "opening");
      await signal(page);
      await cleanPreview(page);
      await writeFile(info.outputPath("native-media-and-geometry.json"), JSON.stringify({ matrix, bounds, proof }, null, 2));
    } finally {
      let fixtureMessage: string | undefined;
      let fixtureState: unknown;
      try {
        fixtureState = await page.evaluate(async () => {
          const path = "/src/project/store.ts";
          const { store }: typeof import("../../src/project/store") = await import(path);
          if (store.isRemotePersistenceEnabled()) throw new Error("Unexpected remote persistence");
          await store.flush();
          return store.getAutoSaveState();
        });
        if (fixtureState && typeof fixtureState === "object"
          && Reflect.get(fixtureState, "kind") === "error"
          && Reflect.get(fixtureState, "code") === "session-not-persisted") {
          const message = Reflect.get(fixtureState, "message");
          if (typeof message === "string") fixtureMessage = message;
        }
      } catch (error) {
        errors.push(`Fixture state inspection failed: ${String(error)}`);
      }
      // The real blank-project contract deliberately reports non-persistence.
      // Retain every raw diagnostic, and recognize only the matching coded
      // zero-retry autosave warning; every other error still fails the test.
      const expectedFixtureWarnings = fixtureMessage
        ? errors.filter(error => error.startsWith("console: [autosave]")
          && error.includes(fixtureMessage) && error.includes("retryCount: 0"))
        : [];
      const unexpectedErrors = errors.filter(error => !expectedFixtureWarnings.includes(error));
      await writeFile(info.outputPath("errors.json"), JSON.stringify(errors, null, 2));
      await writeFile(info.outputPath("fixture-diagnostics.json"), JSON.stringify({
        fixtureState, expectedFixtureWarnings, unexpectedErrors,
      }, null, 2));
      await info.attach("browser-errors", { body: JSON.stringify(errors), contentType: "application/json" });
      // Keep console failures without replacing the original failing UI action.
      expect.soft(unexpectedErrors, "Unexpected browser errors and forbidden remote writes").toEqual([]);
    }
  });
}
