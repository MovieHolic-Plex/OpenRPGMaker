import type { Plugin } from "vite";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { writePlayerDeploymentManifest } from "./playerDeploymentManifest.mjs";
import { readCurrentRetainedRuntime, retainRuntime, RUNTIME_ARCHIVE_FOLDER } from "./runtimeArchive";
import { runtimeArchiveMiddleware } from "./runtimeArchiveMiddleware";

/** Build the two shipped players on first export, never serve Vite's SPA fallback. */
export function devPlayerBundlesPlugin(): Plugin {
  let pending: Promise<void> | undefined;
  let archivePending: Promise<string> | undefined;
  let outputRoot: string | undefined;
  let unwatch: (() => void) | undefined;
  return {
    name: "rpgzzu-dev-player-bundles",
    apply: "serve",
    config(config) {
      // Exclude the directory itself and every staged/committed descendant before
      // Vite constructs its watcher. Filtering our revision counter cannot stop HMR.
      if (config.server?.watch === null) return;
      return { server: { watch: { ignored: [/(?:^|[/\\])\.runtime-archive(?:[/\\]|$)/] } } };
    },
    configurePreviewServer(server) {
      server.middlewares.use(runtimeArchiveMiddleware(server.config.root));
    },
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
      const ensureArchive = (): Promise<string> => {
        archivePending ??= (async () => {
          // Revalidate on each flight: archive/default writes are deliberately
          // unwatched, so a revision-only memo could accept a replaced pointer.
          for (;;) {
            const checkingRevision = revision;
            try {
              const retained = await readCurrentRetainedRuntime({ repoRoot: root, archiveRoot: join(root, RUNTIME_ARCHIVE_FOLDER) });
              if (checkingRevision !== revision) continue;
              return retained.runtimeTarget;
            } catch (error) {
              if (!(error instanceof Error)) throw error;
              server.config.logger.warn(`[player export] Retained default cannot be reused; rebuilding: ${error.message}`);
            }
            // Verification may detect a source outside our watch revision list.
            // Never reuse an in-memory build merely because no event arrived.
            builtRevision = -1;
            await ensureBuilt();
            const retainingRevision = revision;
            const retained = await retainRuntime({ repoRoot: root, archiveRoot: join(root, RUNTIME_ARCHIVE_FOLDER), webRoot: join(playerRoot, "export-player"),
              standaloneRoot: join(playerRoot, "standalone-player"), publicRoot: join(root, "public") });
            if (retainingRevision === revision) return retained.runtimeTarget;
          }
        })().finally(() => { archivePending = undefined; });
        return archivePending;
      };
      const serveArchive = runtimeArchiveMiddleware(root, ensureArchive);
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/runtime-archive/")) return serveArchive(req, res, next);
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
      try { await Promise.all([pending, archivePending]); }
      finally { if (outputRoot) await rm(outputRoot, { recursive: true, force: true }); }
    },
  };
}
