import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { buildViteInvocation } from "../scripts/lib/vite-invocation.mjs";

/**
 * The break (Windows, must-fix after 837b2ab2): `DEV_SERVER_PORT=9830 npm run
 * capture:horror` succeeded but left the Vite node listener alive. Root cause: the
 * `shell:true` spawn launched `cmd.exe`, and `stopServer` killed only the shell — the
 * surviving command line was `node ...vite/bin/vite.js --port 9830`.
 *
 * This test names that break: the invocation must run `process.execPath` on the Vite
 * JS entry directly with `shell:false` + `windowsHide:true`, so the ChildProcess
 * handle IS the real Vite server process (no cmd/sh wrapper), and killing the child
 * actually tears down the listener on every platform. It exercises the exported pure
 * builder rather than grepping the capture source.
 */
describe("capture-horror-browser-evidence vite invocation", () => {
  it("spawns the REAL node process on the vite JS entry (no cmd/sh wrapper)", () => {
    const cwd = process.cwd();
    const { command, args, options } = buildViteInvocation(9830, { cwd });

    // The ChildProcess must BE the server, not a shell around it.
    expect(command).toBe(process.execPath);
    expect(args[0]).toBe(join(cwd, "node_modules", "vite", "bin", "vite.js"));
    expect(options.shell).toBe(false);
    expect(options.windowsHide).toBe(true);
  });

  it("preserves the fixed flags, port, and strictPort", () => {
    const { command, args } = buildViteInvocation(8146, { cwd: process.cwd() });

    expect(command).toBe(process.execPath);
    expect(args).toStrictEqual([
      join(process.cwd(), "node_modules", "vite", "bin", "vite.js"),
      "--configLoader", "runner",
      "--host", "127.0.0.1",
      "--port", "8146",
      "--strictPort",
    ]);
  });
});
