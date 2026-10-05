/**
 * 로컬·스테이징 실행기: 소켓 전용 Postgres 클러스터 + 스토어 서버 + (선택) 첫 진열 팩.
 *   node dist/local.mjs [--data DIR] [--port N] [--public-url URL] [--seed] [--admin EMAIL] [--public-dir 편집기/public]
 * --data 를 주지 않으면 임시 폴더를 쓰고 끝날 때 지운다(e2e). 준비되면 `READY <url>` 한 줄을 찍는다.
 * 개발 로그인이 켜진다 — 공개 인터넷에 내놓는 운영 배포에는 쓰지 않는다(운영은 dist/server.mjs + 진짜 Postgres + Google 로그인).
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedBundles } from "./seedBundles";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string): string | undefined => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : undefined; };
const PG_BIN = process.env.STORE_PG_BIN ?? "/usr/lib/postgresql/16/bin";
const ephemeral = !arg("--data");
const dataDir = resolve(arg("--data") ?? mkdtempSync(join(tmpdir(), "oprn-store-local-")));
const port = Number(arg("--port") ?? 18320);
const host = arg("--host") ?? "0.0.0.0";
const publicUrl = (arg("--public-url") ?? `http://127.0.0.1:${port}`).replace(/\/+$/, "");
const admin = arg("--admin") ?? "admin@openrpgmaker.com";
const editorPublic = resolve(arg("--public-dir") ?? join(here, "..", "..", "public"));
const pgPort = Number(arg("--pg-port") ?? port + 10000);
const pgData = join(dataDir, "pg");
const sock = join(dataDir, "sock");

mkdirSync(sock, { recursive: true });
if (!existsSync(join(pgData, "PG_VERSION"))) {
  execFileSync(join(PG_BIN, "initdb"), ["-D", pgData, "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"], { stdio: "ignore" });
}
execFileSync(join(PG_BIN, "pg_ctl"), ["-D", pgData, "-l", join(dataDir, "pg.log"), "-w", "-o", `-k ${sock} -c listen_addresses='' -p ${pgPort}`, "start"], { stdio: "ignore" });
const hasDb = spawnSync(join(PG_BIN, "psql"), ["-h", sock, "-p", String(pgPort), "-U", "postgres", "-d", "postgres", "-tAc", "select 1 from pg_database where datname='store'"], { encoding: "utf8" }).stdout.trim() === "1";
if (!hasDb) execFileSync(join(PG_BIN, "psql"), ["-h", sock, "-p", String(pgPort), "-U", "postgres", "-d", "postgres", "-qc", "create database store"], { stdio: "ignore" });

const server = spawn(process.execPath, [join(here, "server.mjs")], {
  stdio: ["ignore", "pipe", "inherit"],
  env: {
    ...process.env,
    STORE_PORT: String(port), STORE_HOST: host, STORE_PUBLIC_URL: publicUrl,
    STORE_DATABASE_URL: `postgresql://postgres@localhost/store?host=${encodeURIComponent(sock)}&port=${pgPort}`,
    STORE_BLOB_DIR: join(dataDir, "blobs"), STORE_ADMIN_EMAILS: admin, STORE_DEV_LOGIN: "1",
    STORE_MIGRATIONS_DIR: join(here, "..", "migrations"), STORE_PUBLIC_DIR: join(here, "..", "public"),
    STORE_SECRET: process.env.STORE_SECRET ?? `local-${dataDir}`,
  },
});

let stopping = false;
const stop = (code = 0): void => {
  if (stopping) return;
  stopping = true;
  server.kill("SIGTERM");
  spawnSync(join(PG_BIN, "pg_ctl"), ["-D", pgData, "-m", "fast", "-w", "stop"], { stdio: "ignore" });
  if (ephemeral) rmSync(dataDir, { recursive: true, force: true });
  process.exit(code);
};
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
server.on("exit", (code) => { if (!stopping) { console.error(`[local] server exited ${code}`); stop(1); } });

server.stdout!.on("data", async (chunk: Buffer) => {
  process.stdout.write(chunk);
  if (!chunk.toString().includes("[store] listening")) return;
  try {
    if (process.argv.includes("--seed")) await seedBundles(`http://127.0.0.1:${port}`, admin, editorPublic, (line) => console.log(line));
    console.log(`READY ${publicUrl}`);
  } catch (error) {
    console.error("[local] seed failed", error);
    stop(1);
  }
});
