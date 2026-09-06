import type { Plugin } from "vite";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { writePlayerDeploymentManifest } from "./playerDeploymentManifest.mjs";

/** Build the two shipped players on first export, never serve Vite's SPA fallback. */
export function devPlayerBundlesPlugin(): Plugin {
  let pending: Promise<void> | undefined;
  let outputRoot: string | undefined;
  let unwatch: (() => void) | undefined;
  return {
    name: "rpgzzu-dev-player-bundles",
    apply: "serve",
    async configureServer(server) {
      const { root, cacheDir } = server.config;
      await mkdir(cacheDir, { recursive: true });
      // Separate servers/worktrees must not empty one another's active artifacts.
      outputRoot = await mkdtemp(join(cacheDir, "export-players-"));
      const playerRoot = outputRoot;
      let revision = 0;
      let builtRevision = -1;
      const changed = (file: string) => {
        const name = relative(root, file).split(sep).join("/");
        if (/^(src\/|public\/|scripts\/lib\/player|vite\.(player|standalone)\.config\.ts$|player\.html$|package(-lock)?\.json$)/.test(name)) revision++;
      };
      server.watcher.on("add", changed).on("change", changed).on("unlink", changed);
      unwatch = () => {
        server.watcher.off("add", changed).off("change", changed).off("unlink", changed);
      };
      const ensureBuilt = (): Promise<void> => {
        if (builtRevision === revision) return Promise.resolve();
        // One build flight for concurrent menu clicks and all three initial requests.
        pending ??= (async () => {
          while (builtRevision !== revision) {
            const current = revision;
            for (const [config, folder] of [["player", "export-player"], ["standalone", "standalone-player"]]) {
              // The in-process build API inherits Vite dev's NODE_ENV. A child gives
              // exported players production semantics without changing the editor.
              await new Promise<void>((done, fail) => {
                const child = spawn(process.execPath, [
                  resolve(root, "node_modules/vite/bin/vite.js"), "build",
                  "--configLoader", "runner", "--config", `vite.${config}.config.ts`,
                  "--outDir", join(playerRoot, folder!), "--emptyOutDir",
                ], { cwd: root, env: { ...process.env, NODE_ENV: "production" }, stdio: "inherit" });
                child.once("error", fail);
                child.once("close", (code, signal) => {
                  if (code === 0) done();
                  else fail(new Error(`${config} player build failed (${signal ?? code})`));
                });
              });
            }
            // Use exactly the production SDK writer, including source/secret/closure checks.
            await writePlayerDeploymentManifest({ artifactRoot: join(playerRoot, "export-player"), repoRoot: root });
            builtRevision = current;
          }
        })().finally(() => { pending = undefined; });
        return pending;
      };
      server.middlewares.use((req, res, next) => {
        const match = /^\/(export-player|standalone-player)\/(.*?)(?:\?.*)?$/.exec(req.url ?? "");
        if (!match) return next();
        void (async () => {
          try {
            const file = decodeURIComponent(match[2]!);
            if (!file || file.split(/[\\/]/).includes("..") || file.startsWith("/")) {
              res.statusCode = 400;
              res.end("Invalid player bundle path");
              return;
            }
            await ensureBuilt();
            const bytes = await readFile(join(playerRoot, match[1]!, file));
            const mime: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".html": "text/html" };
            res.setHeader("Content-Type", `${mime[extname(file)] ?? "application/octet-stream"}; charset=utf-8`);
            res.setHeader("Cache-Control", "no-store");
            res.end(bytes);
          } catch (error) {
            const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
            res.statusCode = missing ? 404 : 500;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            const message = error instanceof Error ? error.message : String(error);
            if (!missing) server.config.logger.error(`[player export] ${message}`);
            res.end(`Player export unavailable: ${message}`);
          }
        })();
      });
    },
    async closeBundle() {
      unwatch?.();
      try { await pending; }
      finally { if (outputRoot) await rm(outputRoot, { recursive: true, force: true }); }
    },
  };
}
