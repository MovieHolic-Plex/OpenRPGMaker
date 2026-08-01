import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import {
  createOwnedProjectReceipt,
  requireRemoteCertificateEnvironment,
  runRemoteProjectLifecycle,
  type RemoteRequest,
  type ValidatedRemoteCertificate,
} from "./remoteProjectCertificate";
import { startNewGameFromTitle } from "./runtimeInput";

const CONFIG_KEY = "rpg-zzu:supabase-project-config";
const BOOTSTRAP_KEY = "rpg-zzu.project-e2e.bootstrap";
const DEDICATED_INPUTS = [
  "RPGZZU_E2E_REMOTE_CERTIFICATE",
  "RPGZZU_E2E_REMOTE_ISOLATION_MARKER",
  "RPGZZU_E2E_REMOTE_PROJECT_REF",
  "RPGZZU_E2E_REMOTE_URL",
  "RPGZZU_E2E_REMOTE_ANON_KEY",
] as const;
const remoteConfigured = DEDICATED_INPUTS.some((name) => process.env[name] !== undefined);
const remoteCertificateTest = test;

remoteCertificateTest.use({ screenshot: "off", trace: "off", video: "off" });

remoteCertificateTest("live remote project certificate owns its complete lifecycle", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  if (!remoteConfigured) throw new Error("environment-certificate");
  const certificate = requireRemoteCertificateEnvironment(process.env);
  const receipt = createOwnedProjectReceipt();
  const baseURL = String(testInfo.project.use.baseURL ?? "http://127.0.0.1:9173");
  const transport = async (request: RemoteRequest) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
    });
    return { status: response.status, body: await response.text() };
  };

  await runRemoteProjectLifecycle({
    certificate,
    receipt,
    transport,
    runOwnedLifecycle: async () => {
      const blankProject = createBlankProject();
      const initialPayload = serialize(blankProject);
      const proof = {
        capability: certificate.appCapability,
        expectedCanonicalPayload: initialPayload,
        expectedProjectId: receipt.projectId,
        expectedTargetUrl: certificate.url,
      };

      const firstContext = await createCertifiedContext(browser, baseURL, certificate, receipt.projectId);
      let canonicalPayload: string;
      try {
        const page = await firstContext.newPage();
        await page.goto(`/?blankProject=1&project=${encodeURIComponent(receipt.projectId)}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
        await expectExactBridge(page);

        const initialized = await page.evaluate(
          async ({ blank, ownedReceipt, remoteProof }) => window.__rpgzzuProjectE2E!.initializeRemoteFixture(
            { blankProject: blank, projectId: ownedReceipt.projectId, title: ownedReceipt.title },
            remoteProof,
          ),
          { blank: blankProject, ownedReceipt: receipt, remoteProof: proof },
        );
        expect(initialized).toMatchObject({
          kind: "authorized",
          result: { projectId: receipt.projectId },
          evidence: { effectiveTarget: { projectId: receipt.projectId, url: certificate.url } },
        });

        const flushResult = await page.evaluate(async () => window.__rpgzzuProjectE2E!.flush());
        expect(flushResult).toEqual({ kind: "saved" });
        const savedSnapshot = await page.evaluate(() => window.__rpgzzuProjectE2E!.currentProject());
        expect(savedSnapshot.effectiveTarget).toMatchObject({ projectId: receipt.projectId, url: certificate.url });
        expect(savedSnapshot.project.meta.title).toBe(receipt.title);
        canonicalPayload = savedSnapshot.canonicalPayload;
      } finally {
        await firstContext.close();
      }

      const reloadContext = await createCertifiedContext(browser, baseURL, certificate, receipt.projectId);
      try {
        const page = await reloadContext.newPage();
        await page.goto(`/?project=${encodeURIComponent(receipt.projectId)}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
        await expectExactBridge(page);

        const reloadProof = { ...proof, expectedCanonicalPayload: canonicalPayload };
        const reloaded = await page.evaluate(
          async (remoteProof) => window.__rpgzzuProjectE2E!.reloadRemote(remoteProof),
          reloadProof,
        );
        expect(reloaded).toMatchObject({
          kind: "authorized",
          result: { kind: "reloaded", projectId: receipt.projectId, title: receipt.title },
          evidence: { canonicalPayload },
        });
        const reloadedSnapshot = await page.evaluate(() => window.__rpgzzuProjectE2E!.currentProject());
        expect(reloadedSnapshot.canonicalPayload).toBe(canonicalPayload);
        expect(reloadedSnapshot.project.meta.title).toBe(receipt.title);

        await page.getByTestId("topbar-test-play").click();
        await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
        await startNewGameFromTitle(page, { timeoutMs: 30_000 });
        await expect(page.getByTestId("play-canvas")).toBeVisible({ timeout: 30_000 });
      } finally {
        await reloadContext.close();
      }

      return { canonicalPayload };
    },
  });
});

async function createCertifiedContext(
  browser: Browser,
  baseURL: string,
  certificate: ValidatedRemoteCertificate,
  projectId: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  await context.addInitScript(
    ({ bootstrapKey, capability, credentialDigest, ownedProjectId, targetUrl, anonKey, configKey }) => {
      localStorage.setItem(configKey, JSON.stringify({
        source: "custom",
        url: targetUrl,
        anonKey,
        projectId: ownedProjectId,
      }));
      const bootstrap = Object.freeze({
        capability,
        credentialDigest,
        projectId: ownedProjectId,
        targetUrl,
      });
      Reflect.set(window, Symbol.for(bootstrapKey), bootstrap);
    },
    {
      bootstrapKey: BOOTSTRAP_KEY,
      capability: certificate.appCapability,
      credentialDigest: certificate.credentialDigest,
      ownedProjectId: projectId,
      targetUrl: certificate.url,
      anonKey: certificate.anonKey,
      configKey: CONFIG_KEY,
    },
  );
  return context;
}

async function expectExactBridge(page: Page): Promise<void> {
  const methods = await page.evaluate(() => Object.keys(window.__rpgzzuProjectE2E ?? {}).sort());
  expect(methods).toEqual(["currentProject", "flush", "initializeRemoteFixture", "reloadRemote"]);
}
