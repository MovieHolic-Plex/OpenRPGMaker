import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

export default defineConfig({
  ...base,
  testDir: new URL("../../test/e2e", import.meta.url).pathname,
  projects: [{ name: "firefox", use: { browserName: "firefox" } }],
  retries: 0,
});
