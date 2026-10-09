import { mkdtemp, mkdir, copyFile, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createServer, preview } from "vite";
import { audioDeliveryPlugin } from "../scripts/lib/audioDelivery";

it.each(["dev", "preview"])("serves real media bytes/ranges and missing-media 404s through Vite %s", async mode => {
  const root = await mkdtemp(join(tmpdir(), "audio-delivery-"));
  const bytes = await readFile("public/assets/cc0/audio/ui-confirm.wav");
  for (const directory of ["public", "dist"]) {
    await mkdir(join(root, directory, "assets"), { recursive: true });
    await copyFile("public/assets/cc0/audio/ui-confirm.wav", join(root, directory, "assets/valid.wav"));
  }
  await writeFile(join(root, "index.html"), "<!doctype html><title>SPA shell</title>");
  await copyFile(join(root, "index.html"), join(root, "dist/index.html"));
  const config = { configFile: false as const, root, cacheDir: join(root, ".cache"), logLevel: "silent" as const,
    optimizeDeps: { noDiscovery: true, include: [] }, plugins: [audioDeliveryPlugin()] };
  const server = mode === "dev"
    ? await createServer({ ...config, server: { host: "127.0.0.1", port: 0 } })
    : await preview({ ...config, preview: { host: "127.0.0.1", port: 0 } });
  try {
    if ("listen" in server) await server.listen(0);
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Missing isolated TCP server");
    const origin = `http://127.0.0.1:${address.port}`;
    const request = (path: string, init?: RequestInit) => fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
    const response = await request("/assets/valid.wav");
    expect(response.headers.get("content-type")).toMatch(/^audio\//);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    const range = await request("/assets/valid.wav", { headers: { Range: "bytes=0-31" } });
    expect(range.status).toBe(206);
    expect(Buffer.from(await range.arrayBuffer())).toEqual(bytes.subarray(0, 32));
    for (const method of ["GET", "HEAD"]) {
      const absent = await request("/assets/absent.mp3?cache=1", { method });
      expect(absent.status).toBe(404);
      expect(absent.headers.get("content-type")).not.toMatch(/text\/html/);
    }
    expect((await request("/ordinary-spa-route")).status).toBe(200);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
}, 20000);

// 에디터에서 팩을 설치하면 파일은 public/ 으로 들어가지만 preview 는 dist/ 를 서빙한다.
// 폴백이 없으면 재빌드 전까지 새로 받은 281곡이 전부 404 다.
it("preview 는 dist 에 없는 카탈로그 파일을 public 에서 서빙한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "audio-preview-fallback-"));
  const bytes = await readFile("public/assets/cc0/audio/ui-confirm.wav");
  await mkdir(join(root, "public/assets/cc0/audio/catalog"), { recursive: true });
  await mkdir(join(root, "dist/assets"), { recursive: true });
  // public 에만 둔다 — 설치 직후 재빌드 전 상태를 그대로 재현한다.
  await copyFile("public/assets/cc0/audio/ui-confirm.wav", join(root, "public/assets/cc0/audio/catalog/late.wav"));
  await writeFile(join(root, "index.html"), "<!doctype html><title>SPA shell</title>");
  await copyFile(join(root, "index.html"), join(root, "dist/index.html"));
  const server = await preview({ configFile: false, root, cacheDir: join(root, ".cache"), logLevel: "silent",
    optimizeDeps: { noDiscovery: true, include: [] }, plugins: [audioDeliveryPlugin()],
    preview: { host: "127.0.0.1", port: 0 } });
  try {
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Missing isolated TCP server");
    const request = (path: string, init?: RequestInit) =>
      fetch(`http://127.0.0.1:${address.port}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
    const response = await request("/assets/cc0/audio/catalog/late.wav");
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    // 폴백은 기본 정적 미들웨어를 안 거치므로 Range 를 직접 지켜야 한다.
    const range = await request("/assets/cc0/audio/catalog/late.wav", { headers: { Range: "bytes=0-31" } });
    expect(range.status).toBe(206);
    expect(Buffer.from(await range.arrayBuffer())).toEqual(bytes.subarray(0, 32));
    const suffix = await request("/assets/cc0/audio/catalog/late.wav", { headers: { Range: "bytes=-32" } });
    expect(suffix.status).toBe(206);
    expect(Buffer.from(await suffix.arrayBuffer())).toEqual(bytes.subarray(-32));
    const head = await request("/assets/cc0/audio/catalog/late.wav", { method: "HEAD" });
    expect(head.headers.get("content-length")).toBe(String(bytes.length));
    expect(await head.text()).toBe("");
    for (const value of [`bytes=${bytes.length}-`, "bytes=-0"]) {
      const invalid = await request("/assets/cc0/audio/catalog/late.wav", { headers: { Range: value } });
      expect(invalid.status).toBe(416);
      expect(invalid.headers.get("content-range")).toBe(`bytes */${bytes.length}`);
      expect(await invalid.text()).toBe("");
    }
    expect((await request("/assets/cc0/audio/catalog/absent.mp3")).status).toBe(404);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
}, 20000);
