// scripts/capture-horror-browser-evidence.mts
//
// Slice A: eliminate the human-maintained browser-evidence gap.
//
// Owns browser/LegacyDb/env/process orchestration ONLY. It:
//   1. reserves (spawns) its OWN Vite dev server on the worktree port — never
//      attaches to an unrelated server. `--strictPort` makes a port conflict an
//      explicit failure instead of a silent attach.
//   2. launches headless Chromium against the NORMAL editor URL with the real
//      LegacyDb-backed project deep-linked (`?project=rpg-zzu-horror-mystery-prototype-v1`).
//   3. observes the REAL UI (title screen render + live play session) and writes the
//      HorrorBrowserEvidence fields from those observations — not constants.
//   4. derives/verifies the browser-loaded project identity from the product's E2E
//      observation surface (window.__oprnProjectE2E.currentProject()) and fails if it
//      is not the target; avoids credentials in output.
//   5. guarantees cleanup of the child server AND browser on success and failure,
//      with bounded waits and NO destructive process-wide kill.
//
// Contract boundary: it does NOT change verdict semantics in
// src/testing/horrorExperienceQa.ts or scenario planning.

import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { chromium, type Browser, type Page } from "playwright";
import {
  HORROR_MYSTERY_PROJECT_ID,
} from "../src/project/examples/horrorMysteryPrototype.ts";
import type { GameMap, Project } from "../src/project/types.ts";
import { isPassable } from "../src/project/collision.ts";
import { resolveAudioSource } from "../src/player/audio/audioResources.ts";
import {
  CAPTURE_HORROR_BROWSER_EVIDENCE_NAME,
  validateHorrorBrowserEvidenceShape,
  browserEvidenceOutputPath,
  describeScreenshotArtifact,
} from "./lib/horror-browser-evidence.mjs";
import { buildViteInvocation } from "./lib/vite-invocation.mjs";
import {
  planServerOwnership,
  assertExpectedStart,
  assertObservedDigest,
  deriveRequiredStartBgm,
  assertRequiredBgmObserved,
  wasRequiredBgmRequested,
  browserScreenshotNames,
  assertScreenshotOrder,
} from "./lib/horror-capture-rules.mjs";
import { canonicalProjectDigest, evaluateBrowserCanonicalDigest } from "./lib/canonical-project-digest.mjs";

const VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_DEV_SERVER_PORT = 9815;
const BOOT_MS = 90_000;
const TITLE_MS = 90_000;
const PLAY_MS = 90_000;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Worktree-assigned port (DEV_SERVER_PORT), else a free ephemeral port. */
async function resolvePort(): Promise<number> {
  const envPort = Number(process.env.DEV_SERVER_PORT);
  if (Number.isInteger(envPort) && envPort > 0) return envPort;
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : DEFAULT_DEV_SERVER_PORT;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url: string, port: number, timeoutMs = BOOT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const probe = await fetch(url);
      if (probe.ok || probe.status < 500) return;
      lastError = new Error(`server returned HTTP ${probe.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Vite dev 서버가 ${timeoutMs}ms 안에 뜨지 않았습니다 (${url}): ${String(lastError)}`);
}

/** True when the port already serves THIS Vite dev app (vite client + app entry). */
async function servesThisApp(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return false;
    const body = await response.text();
    return body.includes("/@vite/client") && /\<script[^>]*src="\/src\/main\.[jt]s/.test(body);
  } catch {
    return false;
  }
}

interface DevServerHandle {
  readonly baseUrl: string;
  readonly server: ChildProcess | null;
  readonly reused: boolean;
}

/**
 * Reserve a Vite dev server on the worktree port.
 * - free → spawn OUR OWN, own the lifecycle.
 * - already-listening (any app) → REJECT; never reuse an occupied port (contract).
 */
async function reserveDevServer(port: number): Promise<DevServerHandle> {
  const baseUrl = `http://127.0.0.1:${port}`;
  // Contract: browser QA must NEVER reuse an already-listening arbitrary Vite server. Every capture
  // owns a freshly verified-free port and an exact spawned process from this worktree. If the port is
  // already occupied (by this app or a foreign one), planServerOwnership rejects it.
  const free = await waitForServer(baseUrl, port, 8000).then(() => false).catch(() => true);
  planServerOwnership({ kind: free ? "free" : "already-listening", servesThisApp: await servesThisApp(baseUrl).catch(() => false) });
  const invocation = buildViteInvocation(port, { cwd: process.cwd() });
  const child = spawn(invocation.command, invocation.args, invocation.options);
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null) {
      throw new Error(`worktree 포트 ${port}에 이미 다른 서버가 떠 있어 자체 dev 서버를 못 띄웁니다 (strictPort).`);
    }
    child.once("spawn", () => resolve());
    child.once("error", (error) => { throw error; });
  });
  await waitForServer(baseUrl, port);
  return { baseUrl, server: child, reused: false };
}

async function stopServer(server: ChildProcess | null, port: number): Promise<void> {
  if (!server || server.exitCode !== null) return;
  // Graceful child termination only — never a process-wide kill.
  server.kill("SIGTERM");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && server.exitCode === null) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (server.exitCode === null) {
    // Escalate to a hard kill of THIS child only (its pid), not a process-wide kill.
    server.kill("SIGKILL");
  }
  void port;
}

interface CollectedErrors {
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly requestFailures: readonly { readonly url: string; readonly method: string; readonly errorText: string }[];
  readonly badResponses: readonly { readonly url: string; readonly status: number }[];
  /** Count of errors that are NOT documented optional-dev-bridge / telemetry noise. */
  readonly relevantErrorCount: () => number;
}

// Optional developer bridge / telemetry that is expected to be absent or fail in a local
// dev capture — matches repo policy: "fail on every browser error except the documented
// optional developer bridge refusal". These are infra, not horror-prototype defects.
const OPTIONAL_BRIDGE_URL = /(\/__oprn\/ai-activity)|(dbserver:\d+)|(127\.0\.0\.1:17\d{3})|(localhost:17\d{3})/;
const OPTIONAL_BRIDGE_CONSOLE = /Failed to load resource: net::ERR_CONNECTION_REFUSED/;

function isOptionalBridgeUrl(url: string): boolean {
  return OPTIONAL_BRIDGE_URL.test(url);
}

function attachErrorListeners(page: Page): CollectedErrors {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: { url: string; method: string; errorText: string }[] = [];
  const badResponses: { url: string; status: number }[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => { pageErrors.push(String(error)); });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    requestFailures.push({ url: request.url(), method: request.method(), errorText: failure });
  });
  page.on("response", (response) => {
    const url = response.url();
    // Ignore known in-app diagnostic endpoints that may 404/401 in dev by design.
    if (url.includes("/__oprn/") || url.includes("/api/")) return;
    if (response.status() >= 400) badResponses.push({ url, status: response.status() });
  });
  const relevantErrorCount = (): number => {
    const relevantConsole = consoleErrors.filter((text) => !OPTIONAL_BRIDGE_CONSOLE.test(text)).length;
    const relevantRequest = requestFailures.filter((item) => !isOptionalBridgeUrl(item.url)).length;
    const relevantBad = badResponses.filter((item) => !isOptionalBridgeUrl(item.url)).length;
    return relevantConsole + pageErrors.length + relevantRequest + relevantBad;
  };
  return { consoleErrors, pageErrors, requestFailures, badResponses, relevantErrorCount };
}

async function readProjectSnapshot(page: Page): Promise<{
  projectId: string;
  project: Project;
}> {
  const snapshot = await page.evaluate((): unknown => {
    const bridge = (window as unknown as { __oprnProjectE2E?: { currentProject: () => unknown } }).__oprnProjectE2E;
    return bridge ? bridge.currentProject() : null;
  });
  assert(snapshot && typeof snapshot === "object", "window.__oprnProjectE2E가 없습니다 — 에디터가 아직 편집 모드로 마운트되지 않았습니다.");
  if (!("effectiveTarget" in snapshot) || !("project" in snapshot)) {
    throw new Error("snapshot에 effectiveTarget/project가 없습니다.");
  }
  const effectiveTarget = snapshot.effectiveTarget;
  const project = snapshot.project;
  const projectId = effectiveTarget && typeof effectiveTarget === "object" && "projectId" in effectiveTarget && typeof effectiveTarget.projectId === "string"
    ? effectiveTarget.projectId
    : "";
  assert(project && typeof project === "object" && "startMapId" in project && typeof project.startMapId === "string", "snapshot에 startMapId가 없습니다.");
  const startPos = project?.startPos;
  assert(startPos && typeof startPos === "object" && typeof startPos.x === "number" && typeof startPos.y === "number", "snapshot에 startPos가 없습니다.");
  return { projectId, project: project as Project };
}

async function observeTitleScreen(page: Page): Promise<{ resourceId: string; imageLoaded: boolean }> {
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: TITLE_MS });
  const observed = await page.evaluate(async (): Promise<{ resourceId: string; imageLoaded: boolean }> => {
    const title = document.querySelector<HTMLElement>('[data-testid="title-screen"]');
    if (!title) throw new Error("title-screen 노드가 없습니다.");
    const resourceId = title.dataset.titleResource ?? "";
    // 리소스 이미지가 실제로 로드됐는지 관찰: CSS background-image URL 을 뽑아 Image 로 확인.
    const style = getComputedStyle(title);
    const match = /url\(["']?(.*?)["']?\)/.exec(style.backgroundImage ?? "");
    let imageLoaded = false;
    if (match?.[1]) {
      try {
        imageLoaded = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = match[1];
        });
      } catch {
        imageLoaded = false;
      }
    }
    return { resourceId, imageLoaded };
  });
  return observed;
}

async function startNewGame(page: Page): Promise<void> {
  // 타이틀 메뉴 기본 선택(0) = 새 게임. Enter 로 시작.
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const w = window as unknown as { __oprnDebug?: { readState: () => unknown } };
    try { return Boolean(w.__oprnDebug?.readState); } catch { return false; }
  }, { timeout: PLAY_MS });
}

async function observePlaySession(page: Page): Promise<{
  currentMapId: string;
  x: number;
  y: number;
  touchPadVisible: boolean;
}> {
  const state = await page.evaluate((): unknown => {
    const w = window as unknown as { __oprnDebug?: { readState: () => { currentMapId: string; x: number; y: number } } };
    const d = w.__oprnDebug;
    return d ? d.readState() : null;
  });
  const record = state as { currentMapId?: string; x?: number; y?: number };
  assert(record && typeof record.currentMapId === "string", "플레이 세션 상태를 읽지 못했습니다 (__oprnDebug.readState).");
  const touchPadVisible = await page.locator('[data-testid="touch-pad"]').count() > 0;
  return { currentMapId: record.currentMapId!, x: record.x!, y: record.y!, touchPadVisible };
}

export async function runCapture(opts: { expectedDigest?: string; expectedProject?: Project } = {}): Promise<void> {
  const { expectedDigest: authorDigest, expectedProject } = opts;
  const outputPath = browserEvidenceOutputPath();
  const evidenceDir = path.dirname(outputPath);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const { title: titleName, playStart: playStartName } = browserScreenshotNames();

  const port = await resolvePort();
  const { baseUrl, server: reservedServer, reused } = await reserveDevServer(port);
  const route = `/?project=${HORROR_MYSTERY_PROJECT_ID}`;
  const entryUrl = `${baseUrl}${route}`;

  let server: ChildProcess | null = reservedServer;
  let browser: Browser | null = null;
  try {
    // 1) Via reserveDevServer: we ALWAYS own a fresh spawned process on a verified-free port.
    //    The old reuse path is removed — an occupied port (any app) is a hard failure.
    void reused;

    // 2) Headless browser against the real editor URL.
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: VIEWPORT });
    const errors = attachErrorListeners(page);
    const requestedUrls: string[] = [];
    page.on("response", (response) => {
      const url = response.url();
      if (url.endsWith(".ogg") || url.endsWith(".mp3") || url.endsWith(".wav") || url.endsWith(".m4a")) requestedUrls.push(url);
    });

    await page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout: BOOT_MS });

    // 3) Wait for the editor to mount and pull the E2E snapshot (project identity).
    await page.waitForFunction(() => {
      const w = window as unknown as { __oprnProjectE2E?: { currentProject: () => unknown } };
      return Boolean(w.__oprnProjectE2E);
    }, { timeout: BOOT_MS });
    const snapshot = await readProjectSnapshot(page);

    // Identity verification — the enforceable Slice A gate.
    assert(
      snapshot.projectId === HORROR_MYSTERY_PROJECT_ID,
      `브라우저가 대상 프로젝트가 아닌 것을 로드했습니다: ${snapshot.projectId ?? "(없음)"} (기대: ${HORROR_MYSTERY_PROJECT_ID})`,
    );

    // Content-digest binding: compute observed digest IN-BROWSER from actual project data.
    // The expected digest is the authoritative one: when the QA orchestrator passes the
    // LegacyDb-reloaded project's digest we compare against it (cross-side binding); standalone
    // capture falls back to the in-page Node-side digest of the same project (determinism proof).
    const observedDigest = await evaluateBrowserCanonicalDigest(
      snapshot.project as unknown,
      (callback, input) => page.evaluate(callback, input),
    );
    const expectedDigest = authorDigest ?? canonicalProjectDigest(snapshot.project as unknown);
    if (expectedProject && observedDigest !== expectedDigest) {
      const browserProject = snapshot.project as unknown as Record<string, unknown>;
      const nodeProject = expectedProject as unknown as Record<string, unknown>;
      const keys = [...new Set([...Object.keys(nodeProject), ...Object.keys(browserProject)])].sort();
      const differingTopLevelKeys = keys.filter((key) =>
        canonicalProjectDigest(nodeProject[key]) !== canonicalProjectDigest(browserProject[key]),
      );
      console.error(`[capture] digest mismatch top-level keys: ${differingTopLevelKeys.join(", ") || "(none)"}`);
    }
    assertObservedDigest(observedDigest, expectedDigest);

    // 4) Real UI observation: open Test Play → title screen.
    const titleStartedAtMs = Date.now();
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("oprn:test-play-window"));
    });
    const title = await observeTitleScreen(page);
    const titlePath = path.join(evidenceDir, titleName);
    await page.screenshot({ path: titlePath });

    // 5) Touch pad absence on the desktop title surface.
    const titleTouchPadVisible = await page.locator('[data-testid="touch-pad"]').count() > 0;

    // 6) Start a new game and observe the live start map/position.
    await startNewGame(page);
    const play = await observePlaySession(page);
    const playStartAtMs = Date.now();
    assertScreenshotOrder({ titleAtMs: titleStartedAtMs, playStartAtMs });
    // Contract: assert live session exact expected startMapId/startPos x/y.
    assertExpectedStart(play, {
      mapId: snapshot.project.startMapId,
      x: snapshot.project.startPos.x,
      y: snapshot.project.startPos.y,
    });

    // 7) map start passability — computed on the browser-loaded project (not a constant)
    //    at the actual live start position.
    const liveMap = snapshot.project.maps[play.currentMapId];
    const mapStart = {
      mapId: play.currentMapId,
      x: play.x,
      y: play.y,
      passable: liveMap ? isPassable(snapshot.project, liveMap as GameMap, play.x, play.y) : false,
    };

    // Screenshots: browser-title.png = title before play; browser-play-start.png = after play.
    const playStartPath = path.join(evidenceDir, playStartName);
    await page.screenshot({ path: playStartPath });

    // Required start-map BGM observation (gallery custom BGM cc0-bgm-dungeon → cave-theme.ogg).
    const requiredBgm = deriveRequiredStartBgm({
      startMap: liveMap ?? snapshot.project.maps[snapshot.project.startMapId],
      resolveUrl: (resourceId) => {
        const map = snapshot.project.maps[play.currentMapId] ?? snapshot.project.maps[snapshot.project.startMapId];
        return resolveAudioSource(resourceId, snapshot.project as never);
      },
    });
    const playedAudio = await page.evaluate(() => {
      const observed = (window as unknown as { __oprnAudioObserved?: string[] }).__oprnAudioObserved;
      return Array.isArray(observed) ? observed : [];
    });
    assertRequiredBgmObserved(requiredBgm, { requestedUrls, played: playedAudio });

    const evidence = {
      projectId: HORROR_MYSTERY_PROJECT_ID,
      observedAt: new Date().toISOString(),
      route,
      capturedBy: CAPTURE_HORROR_BROWSER_EVIDENCE_NAME,
      title,
      desktopTouchPadVisible: titleTouchPadVisible || play.touchPadVisible,
      mapStart,
      expectedStart: { mapId: snapshot.project.startMapId, x: snapshot.project.startPos.x, y: snapshot.project.startPos.y },
      contentDigest: { observed: observedDigest, expected: expectedDigest },
      bgm: {
        requested: wasRequiredBgmRequested(requiredBgm.url, requestedUrls),
        played: playedAudio.includes(requiredBgm.resourceId),
      },
      screenshots: {
        title: describeScreenshotArtifact(titlePath),
        playStart: describeScreenshotArtifact(playStartPath),
      },
      consoleErrorCount: errors.relevantErrorCount(),
      errors: {
        console: errors.consoleErrors.slice(0, 50),
        page: errors.pageErrors.slice(0, 50),
        requestFailures: errors.requestFailures.slice(0, 50),
        badResponses: errors.badResponses.slice(0, 50),
      },
    };

    // Never persist credentials: output only the sanctioned fields.
    validateHorrorBrowserEvidenceShape(evidence);
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

    console.log(JSON.stringify({
      ok: true,
      projectId: HORROR_MYSTERY_PROJECT_ID,
      route,
      title,
      desktopTouchPadVisible: evidence.desktopTouchPadVisible,
      mapStart,
      expectedStart: evidence.expectedStart,
      contentDigest: evidence.contentDigest,
      bgm: evidence.bgm,
      consoleErrorCount: evidence.consoleErrorCount,
      screenshots: evidence.screenshots,
      reportedOn: "browser-qa.json",
    }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await stopServer(server, port);
  }
}

// Direct execution: `npm run capture:horror` / part of `npm run qa:horror`.
const runAsMain = Boolean(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (runAsMain) {
  runCapture().catch((error) => {
    console.error("[capture-horror-browser-evidence] 실패:", error);
    process.exitCode = 1;
  });
}
