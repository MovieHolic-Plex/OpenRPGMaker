import { readdirSync, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { Connect, Plugin } from "vite";

function missing(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

/** Delivery facts only: the existing BGM registry remains the identity authority. */
export function audioDeliveryPlugin(): Plugin {
  let publicRoot = "";
  let previewRoot = "";
  const guard = (root: string): Connect.NextHandleFunction => (request, response, next) => {
    let path: string;
    try { path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname); }
    catch { response.statusCode = 400; response.end(); return; }
    if (!path.startsWith("/assets/") || !/\.(?:mp3|wav|ogg|m4a|mid|midi|mp4|webm|ogv)$/i.test(path)) { next(); return; }
    const file = resolve(root, `.${path}`);
    if (relative(root, file).startsWith("..")) { response.statusCode = 400; response.end(); return; }
    void stat(file).then(info => {
      if (info.isFile()) { next(); return; }
      response.statusCode = 404;
      response.end();
    }, (error: unknown) => {
      if (!missing(error)) { next(error); return; }
      response.statusCode = 404;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end("Media not found. For catalog BGM run npm run bgm:install, then restart the server.");
    });
  };
  return {
    name: "audio-delivery",
    config(config) {
      const root = resolve(config.root ?? process.cwd());
      const directory = resolve(root, typeof config.publicDir === "string" ? config.publicDir : "public", "assets/cc0/audio/catalog");
      let files: string[] = [];
      if (config.publicDir !== false) {
        try { files = readdirSync(directory).filter(file => /\.(?:mp3|wav)$/i.test(file) && statSync(resolve(directory, file)).size > 0); }
        catch (error) { if (!missing(error)) throw error; }
      }
      return { define: { __OPRN_INSTALLED_BGM_FILES__: JSON.stringify(files) } };
    },
    configResolved(config) {
      publicRoot = config.publicDir;
      previewRoot = resolve(config.root, config.build.outDir);
    },
    configureServer(server) { server.middlewares.use(guard(publicRoot)); },
    configurePreviewServer(server) { server.middlewares.use(guard(previewRoot)); },
  };
}
