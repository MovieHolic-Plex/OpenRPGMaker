// scripts/lib/vite-invocation.mjs
// Shared, pure contract for how the horror-browser capture spawns its OWN Vite dev
// server. Kept in .mjs so both the capture script and the focused regression test
// import the SAME builder — the test exercises the real invocation, not a source grep.
//
// The break (Windows, must-fix after 837b2ab2): the capture spawned vite through a
// shell (`shell:true` launched cmd.exe). `stopServer` killed only the shell, so the
// real `node .../vite/bin/vite.js --port 9830` listener survived. This builder
// targets the Node executable on the Vite JS entry directly with shell:false +
// windowsHide:true, so the ChildProcess handle IS the server process and killing the
// child actually tears the listener down on Windows and Linux alike.

import path from "node:path";

/** Fixed CLI flags the capture always passes — preserved verbatim for server semantics. */
export const VITE_FIXED_ARGS = [
  "--configLoader", "runner",
  "--host", "127.0.0.1",
];

/** Where the vite JS entry lives relative to the worktree root. */
export const VITE_ENTRY_REL = path.join("node_modules", "vite", "bin", "vite.js");

/**
 * Build the pure spawn invocation for a Vite dev server on `port`.
 *
 * @param {number} port
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {{ command: string, args: string[], options: { cwd: string, env: Record<string,string|undefined>, stdio: "ignore", shell: false, windowsHide: true } }}
 */
export function buildViteInvocation(port, { cwd = process.cwd(), env = process.env } = {}) {
  const entry = path.join(cwd, VITE_ENTRY_REL);
  return {
    command: process.execPath,
    args: [
      entry,
      ...VITE_FIXED_ARGS,
      "--port", String(port),
      "--strictPort",
    ],
    options: {
      cwd,
      env: { ...env, DEV_SERVER_NO_TLS: "1" },
      stdio: "ignore",
      shell: false,
      windowsHide: true,
    },
  };
}
