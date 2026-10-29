// 런타임 QA — `?demo=` 대표 데모를 구운 파일로 부팅할지 정한다.
//
// dev 서버의 플레이어는 `?demo=` 를 받으면 데모를 **페이지 안에서** 짓는다(exportEntry.ts loadFlagshipDemo).
// chrono-bell(폴른 스타 1·2막 41맵)은 그 빌드가 부하 중 2~6분이라 체크포인트 하나가 12~20분 걸렸다(2026-10-29).
// 구운 파일(dist/demos/<id>.play.json — 출하 플레이어가 읽는 것과 같은 투영)이 있고 소스보다 새것이면 그것을 넘긴다.
//
//   --project dist/demos/<id>.(play|project).json  → 그 굽기(옆의 .play.json 을 우선). 낡았으면 경고만 한다(명시한 선택).
//   지정 없음                                       → dist/demos/<id>.play.json 이 src/ 의 어느 파일보다 새것일 때만 쓴다.
//   QA_DEMO_SOURCE=build                            → 늘 페이지에서 짓는다(예전 동작).
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** 플레이어(exportEntry.ts)와 같은 별칭. */
const DEMO_ALIASES = { "fallen-star": "chrono-bell", "astra-horizon": "emerald-crown" };
const DEMO_IDS = new Set(["chrono-bell", "emerald-crown", "shitamachi-fourth-season", "first-love"]);

export function demoIdOfQuery(query) {
  const raw = query?.demo;
  if (typeof raw !== "string") return null;
  const id = DEMO_ALIASES[raw] ?? raw;
  return DEMO_IDS.has(id) ? id : null;
}

let newestSourceMs = null;
/** src/ 아래 가장 늦게 바뀐 파일의 시각(한 번만 잰다). 구운 파일이 이보다 오래되면 낡은 굽기다. */
function newestSourceMtime() {
  if (newestSourceMs !== null) return newestSourceMs;
  let newest = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) newest = Math.max(newest, statSync(path).mtimeMs);
    }
  };
  walk(join(REPO_ROOT, "src"));
  newestSourceMs = newest;
  return newest;
}

function bakedFromFixture(fixture, id) {
  if (!fixture) return null;
  const abs = resolve(REPO_ROOT, fixture);
  const m = /[\\/]dist[\\/]demos[\\/]([a-z0-9-]+)\.(play|project)\.json$/u.exec(abs);
  if (!m || m[1] !== id) return null;
  const play = abs.replace(/\.project\.json$/u, ".play.json");
  return existsSync(play) ? play : abs;
}

/**
 * 이 시나리오가 쓸 구운 데모 파일. 없으면 null(페이지에서 짓는다). 결정 이유를 한 번 찍는다.
 * @returns {{ path: string, id: string, stale: boolean } | null}
 */
const logged = new Set();
export function resolveBakedDemo(scenario, log = (line) => { if (!logged.has(line)) { logged.add(line); console.log(line); } }) {
  const id = demoIdOfQuery(scenario.query);
  if (!id) return null;
  if (process.env.QA_DEMO_SOURCE === "build") return null;
  const explicit = bakedFromFixture(scenario.projectFixture, id);
  const path = explicit ?? join(REPO_ROOT, "dist/demos", `${id}.play.json`);
  if (!existsSync(path)) {
    log(JSON.stringify({ qaDemo: id, source: "build-in-page", reason: `구운 파일 없음 — npm run bake:demos -- --only ${id} 로 구우면 부팅이 수 분 → 수십 초` }));
    return null;
  }
  const stale = statSync(path).mtimeMs < newestSourceMtime();
  if (stale && !explicit) {
    log(JSON.stringify({ qaDemo: id, source: "build-in-page", reason: `${relative(REPO_ROOT, path)} 가 src/ 보다 오래됐다 — 다시 굽거나 --project 로 명시` }));
    return null;
  }
  log(JSON.stringify({ qaDemo: id, source: "baked", path: relative(REPO_ROOT, path), ...(stale ? { warning: "src/ 보다 오래된 굽기(명시해서 쓴다)" } : {}) }));
  return { path, id, stale };
}

const bodies = new Map();
/** 같은 실행의 체크포인트들이 같은 파일을 다시 읽지 않게 한다(17MB). */
export async function bakedDemoBody(path) {
  const key = `${path}:${statSync(path).mtimeMs}`;
  if (!bodies.has(key)) bodies.set(key, readFile(path));
  return bodies.get(key);
}
