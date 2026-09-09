// 동반 서버 어댑터. 인증(상태·로그인·갱신·해제)은 순수 Node 에서 돌고,
// Bun 워커는 모델 호출(completion) 하나만 맡는다 — 그래서 Bun 이 없는 머신도
// 로그인까지는 끝마칠 수 있고, 워커는 실제로 모델을 부를 때에서야 처음 뜨운다.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  listOhMyPiProviders,
  logoutProvider,
  publicProviderStatus,
  refreshProvider,
  resolveRequestApiKey,
  seedOAuthForTests,
  startProviderLogin,
} from "./aiAuthRuntime.ts";

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

export async function createOhMyPiAdapters() {
  return {
    listProviders: async () => listOhMyPiProviders(),
    async status(provider) {
      return publicProviderStatus(provider);
    },
    async login(provider, body) {
      return startProviderLogin(provider, body ?? {});
    },
    async saveKey(provider) {
      // 지원 제공자 둘 다 구독 로그인이다. API 키를 받는 생기면 사용자가
      // 키를 붙여넣고 연결된 상태를 기다리다 401 로 새는 경로가 다시 생긴다.
      const error = new Error(`${provider} 는 구독 로그인 전용이라 API 키를 쓰지 않습니다.`);
      error.status = 400;
      throw error;
    },
    async refresh(provider) {
      return refreshProvider(provider);
    },
    async logout(provider) {
      return logoutProvider(provider);
    },
    async seedOAuth(provider, creds) {
      seedOAuthForTests(provider, creds);
      return publicProviderStatus(provider);
    },
    async complete(provider, body) {
      const apiKey = await resolveRequestApiKey(provider);
      return workerJson("/complete", { provider, body, apiKey });
    },
    /** Pi 에이전트 실행. 워커의 NDJSON 본문(web ReadableStream)을 그대로 넘긴다. */
    async runAgent(provider, body, options = {}) {
      const apiKey = await resolveRequestApiKey(provider);
      const port = await startWorker();
      // 브라우저가 끊으면(중단 버튼) 그 신호를 워커까지 넘긴다 — 안 그러면 에이전트는 끝까지 돈다.
      const response = await fetch(`http://127.0.0.1:${port}/agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, request: { ...body, provider } }),
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(payload?.error || `oh-my-pi worker ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return { stream: true, ndjson: response.body };
    },
    async generateImage(provider, body) {
      const apiKey = await resolveRequestApiKey(provider);
      return workerJson("/image", { provider, body, apiKey });
    },
  };
}
