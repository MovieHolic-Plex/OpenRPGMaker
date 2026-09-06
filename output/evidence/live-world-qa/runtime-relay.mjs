// Host-only transport adapter. Static GET bytes stay unchanged; no API/game-data mocks.
import { chromium } from "@playwright/test";
import { get } from "node:http";

const launch = chromium.launch.bind(chromium);
chromium.launch = async options => {
  const browser = await launch({
    ...options,
    args: [...(options?.args ?? []), "--disable-dev-shm-usage", "--disable-features=LocalNetworkAccessChecks"],
  });
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async options => {
    const page = await newPage(options);
    page.on("pageerror", error => console.error("RUNTIME_PAGE_ERROR", error.message));
    page.on("crash", () => console.error("RUNTIME_PAGE_CRASH"));
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== "GET" || url.hostname !== "127.0.0.1"
        || !(url.pathname === "/player.html" || /^\/(src|assets|@vite|@id|@fs|node_modules)\//.test(url.pathname))) {
        return route.fallback();
      }
      const response = await new Promise((resolve, reject) => {
        const outgoing = get(url, incoming => {
          const chunks = [];
          incoming.on("data", chunk => chunks.push(chunk));
          incoming.once("error", reject);
          incoming.once("end", () => resolve({
            status: incoming.statusCode ?? 502,
            headers: Object.fromEntries(Object.entries(incoming.headers).filter(([, value]) => typeof value === "string")),
            body: Buffer.concat(chunks),
          }));
        });
        outgoing.once("error", reject);
        outgoing.setTimeout(120_000, () => outgoing.destroy(new Error(`Static GET deadline: ${url.pathname}`)));
      });
      await route.fulfill(response);
    });
    return page;
  };
  return browser;
};
