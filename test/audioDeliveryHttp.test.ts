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
