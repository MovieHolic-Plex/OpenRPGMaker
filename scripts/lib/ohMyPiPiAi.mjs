// Node adapter: Codex stays in-process; every other provider is a Bun worker
// because @oh-my-pi/pi-ai is Bun TypeScript (bun:sqlite, type:text imports).

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

let workerPortPromise;
let workerChild;

function startWorker() {
  if (workerPortPromise) return workerPortPromise;
  workerPortPromise = new Promise((resolve, reject) => {
    const script = fileURLToPath(new URL("../oh-my-pi-worker.ts", import.meta.url));
    const child = spawn("bun", [script], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    workerChild = child;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      workerPortPromise = null;
      reject(error);
    };
    const onChunk = (chunk) => {
      const text = String(chunk);
      const match = text.match(/READY (\d+)/);
      if (match && !settled) {
        settled = true;
        resolve(Number(match[1]));
      }
    };
    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", (chunk) => {
      const text = String(chunk).trim();
      if (text) console.error(`[oh-my-pi-worker] ${text}`);
    });
    child.on("error", (error) => {
      fail(new Error(
        error.code === "ENOENT"
          ? "bun 이 필요합니다. oh-my-pi 제공자 로그인/전송은 Bun 에서만 로드됩니다."
          : error.message,
      ));
    });
    child.on("exit", (code) => {
      workerChild = null;
      workerPortPromise = null;
      fail(new Error(`oh-my-pi worker exited (${code ?? "?"})`));
    });
    setTimeout(() => fail(new Error("oh-my-pi worker start timed out")), 30_000);
  });
  return workerPortPromise;
}

async function workerJson(pathname, body) {
  const port = await startWorker();
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error || `oh-my-pi worker ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function stopOhMyPiWorker() {
  workerChild?.kill();
  workerChild = null;
  workerPortPromise = null;
}

export async function createOhMyPiAdapters({ getCodexSession }) {
  const { accountStatus, startDeviceLogin, proxyCompletion } = await import("./codexOAuthSession.mjs");
  const isCodex = (provider) => provider === "openai-codex";

  return {
    listProviders: async () => {
      const port = await startWorker();
      const response = await fetch(`http://127.0.0.1:${port}/providers`);
      const payload = await response.json();
      return payload.providers ?? [];
    },
    async status(provider) {
      if (isCodex(provider)) return accountStatus(await getCodexSession(), false);
      return workerJson("/status", { provider });
    },
    async login(provider, body) {
      if (isCodex(provider)) return startDeviceLogin(await getCodexSession());
      return workerJson("/login", { provider, ...(body ?? {}) });
    },
    async saveKey(provider, apiKey) {
      return workerJson("/key", { provider, apiKey });
    },
    async refresh(provider) {
      if (isCodex(provider)) return accountStatus(await getCodexSession(), false);
      return workerJson("/refresh", { provider });
    },
    async seedOAuth(provider, creds) {
      return workerJson("/seed-oauth", { provider, ...creds });
    },
    async complete(provider, body) {
      if (isCodex(provider)) return proxyCompletion(await getCodexSession(), body);
      return workerJson("/complete", { provider, body });
    },
  };
}
