import { spawn } from "node:child_process";
import { loadEnv } from "vite";

// QA-only process configuration: no credential is written to a file or command line.
const configured = loadEnv("development", process.cwd(), "");
const key = configured.SUPABASE_ANON_KEY || configured.VITE_SUPABASE_ANON_KEY;
if (!key) throw new Error("Supabase server credential is unavailable");
const child = spawn("npm", ["run", "dev:worktree", "--", "--port", "9867"], {
  stdio: "inherit",
  env: {
    ...process.env, DEV_SERVER_PORT: "9867", DEV_SERVER_NO_TLS: "1",
    VITE_SUPABASE_USE_PROXY: "1", SUPABASE_ANON_KEY: key,
  },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.once("exit", code => { process.exitCode = code ?? 1; });
