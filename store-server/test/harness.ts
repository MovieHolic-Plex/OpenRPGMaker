/**
 * 테스트·스테이징 공용 도우미: 일회용 Postgres 클러스터(소켓 전용)와 쿠키를 들고 다니는 HTTP 손님.
 * 운영 DB·공유 DB 에는 절대 붙지 않는다 — 클러스터는 임시 폴더에 만들고 끝나면 지운다.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PG_BIN = process.env.STORE_TEST_PG_BIN ?? "/usr/lib/postgresql/16/bin";

export interface TempPostgres { url: string; dir: string; stop(): void }

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

export async function startPostgres(): Promise<TempPostgres> {
  const dir = mkdtempSync(join(tmpdir(), "oprn-store-pg-"));
  const data = join(dir, "data");
  const port = await freePort();
  execFileSync(join(PG_BIN, "initdb"), ["-D", data, "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"], { stdio: "ignore" });
  execFileSync(join(PG_BIN, "pg_ctl"), ["-D", data, "-l", join(dir, "pg.log"), "-w", "-o", `-k ${dir} -c listen_addresses='' -p ${port} -F`, "start"], { stdio: "ignore" });
  execFileSync(join(PG_BIN, "psql"), ["-h", dir, "-p", String(port), "-U", "postgres", "-d", "postgres", "-qc", "create database store"], { stdio: "ignore" });
  return {
    url: `postgresql://postgres@localhost/store?host=${encodeURIComponent(dir)}&port=${port}`,
    dir,
    stop() {
      spawnSync(join(PG_BIN, "pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** 쿠키 상자를 가진 손님. 브라우저처럼 세션 쿠키와 페이지의 CSRF 값을 들고 다닌다. */
export class Client {
  cookies = new Map<string, string>();
  csrf = "";
  token = "";
  constructor(readonly base: string) {}

  async fetch(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    if (this.token) headers.set("authorization", `Bearer ${this.token}`);
    let body = init.body;
    if (init.json !== undefined) { headers.set("content-type", "application/json"); body = JSON.stringify(init.json); }
    const response = await fetch(this.base + path, { ...init, headers, body, redirect: "manual" });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const index = pair!.indexOf("=");
      const key = pair!.slice(0, index);
      const value = pair!.slice(index + 1);
      if (value === "" || /Max-Age=0/.test(line)) this.cookies.delete(key); else this.cookies.set(key, value);
    }
    return response;
  }

  async page(path: string): Promise<{ status: number; html: string }> {
    const response = await this.fetch(path);
    const html = await response.text();
    const csrf = /<meta name="csrf" content="([^"]+)"/.exec(html)?.[1];
    if (csrf) this.csrf = csrf;
    return { status: response.status, html };
  }

  form(path: string, fields: Record<string, string>): Promise<Response> {
    return this.fetch(path, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields).toString() });
  }

  api(path: string, json?: unknown, method = json === undefined ? "GET" : "POST"): Promise<Response> {
    return this.fetch(path, { method, json, headers: this.csrf ? { "x-csrf-token": this.csrf } : {} });
  }

  async devLogin(email: string, name: string): Promise<void> {
    const response = await this.form("/auth/dev", { email, name, next: "/" });
    if (response.status !== 303) throw new Error(`dev login failed ${response.status}`);
    await this.page("/");
  }
}
