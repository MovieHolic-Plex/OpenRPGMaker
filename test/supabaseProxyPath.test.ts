import { describe, expect, it } from "vitest";

import { SUPABASE_PROXY_PATH, resolveBrowserSupabaseUrl } from "../src/project/supabaseProxyPath";

describe("resolveBrowserSupabaseUrl", () => {
  it("folds a plaintext backend to the same-origin proxy on an https dev page", () => {
    expect(resolveBrowserSupabaseUrl("http://dbserver:8100", { isDev: true, pageProtocol: "https:" })).toBe(
      SUPABASE_PROXY_PATH,
    );
  });

  it("keeps the absolute url on an http dev page", () => {
    expect(resolveBrowserSupabaseUrl("http://dbserver:8100", { isDev: true, pageProtocol: "http:" })).toBe(
      "http://dbserver:8100",
    );
  });

  it("keeps an https backend untouched because it is not blocked", () => {
    expect(resolveBrowserSupabaseUrl("https://db.example.com", { isDev: true, pageProtocol: "https:" })).toBe(
      "https://db.example.com",
    );
  });

  it("never rewrites in production builds, where no proxy exists", () => {
    expect(resolveBrowserSupabaseUrl("http://dbserver:8100", { isDev: false, pageProtocol: "https:" })).toBe(
      "http://dbserver:8100",
    );
  });

  it("keeps the absolute url outside a browser", () => {
    expect(resolveBrowserSupabaseUrl("http://dbserver:8100", { isDev: true, pageProtocol: undefined })).toBe(
      "http://dbserver:8100",
    );
  });

  it("strips a trailing slash", () => {
    expect(resolveBrowserSupabaseUrl("http://dbserver:8100/", { isDev: true, pageProtocol: "http:" })).toBe(
      "http://dbserver:8100",
    );
  });
});
