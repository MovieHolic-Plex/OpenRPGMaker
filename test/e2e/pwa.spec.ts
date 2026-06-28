import { expect, test } from "@playwright/test";

test("Given PWA opt-in When the app loads Then it exposes an installable manifest and active service worker", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  });

  await page.goto("/?enablePwa=1");

  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest: unknown = await manifestResponse.json();
  expect(stringField(manifest, "name")).toBe("RPG ZZU");
  expect(stringField(manifest, "short_name")).toBe("RPG ZZU");
  expect(stringField(manifest, "start_url")).toBe("/");
  expect(stringField(manifest, "display")).toBe("standalone");
  expect(iconList(manifest)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" }),
    ]),
  );

  const iconResponse = await page.request.get("/icons/pwa-512.png");
  expect(iconResponse.ok()).toBe(true);
  expect(iconResponse.headers()["content-type"]).toContain("image/png");

  await expect
    .poll(async () => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL.endsWith("/sw.js") ?? false))
    .toBe(true);

  await page.reload();
  await expect.poll(async () => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/sw.js") ?? false)).toBe(true);
});

type PwaIcon = {
  readonly src: string;
  readonly sizes: string;
  readonly type: string;
};

function stringField(value: unknown, field: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const candidate = value[field];
  return typeof candidate === "string" ? candidate : undefined;
}

function iconList(value: unknown): readonly PwaIcon[] {
  if (!isRecord(value)) return [];
  const icons = value["icons"];
  if (!Array.isArray(icons)) return [];
  return icons.filter(isPwaIcon);
}

function isPwaIcon(value: unknown): value is PwaIcon {
  if (!isRecord(value)) return false;
  return typeof value["src"] === "string" && typeof value["sizes"] === "string" && typeof value["type"] === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
