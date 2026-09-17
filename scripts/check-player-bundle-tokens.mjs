#!/usr/bin/env node
// 커밋된 플레이어 번들의 토큰이 tokens.css 와 어긋났는지 본다.
//
// 왜 필요한가: `community-site/public/player-static/assets/player-*.css` 는 **커밋된 빌드
// 산출물**이라 소스와 따로 움직인다. 배포된 플레이어는 이 파일을 쓰므로, tokens.css 를
// 고쳐도 번들을 다시 만들지 않으면 플레이어만 옛 팔레트로 남는다. 아무 게이트도 이걸
// 보지 않았고, 실제로 이미 토큰 2개(--z-canvas-veil, --z-tooltip)가 빠져 있었다(2026-09-17).
//
// 값 비교는 **정규화 후** 한다. 미니파이어가 `0.92`→`.92`, `120ms`→`.12s` 로 바꾸므로
// 원문 비교를 하면 26건이 전부 거짓 양성이 된다(실측). 여기서 걸러야 게이트가 쓸모 있다.
//
// **이건 진단 도구지 집행 게이트가 아니다.** 집행은 이미 있다 —
// `community-site/scripts/sync-player.mjs --check`(= `npm run verify:player`, community-site 의
// prebuild)가 소스 다이제스트를 비교해 스테일이면 exit 1 로 빌드를 막는다(2026-09-17 실측).
// 다만 그쪽은 "바이트가 다르다"까지만 말한다. 이 스크립트는 **어느 토큰이** 어긋났는지를
// 플레이어 빌드 없이 즉시 알려 준다. 그래서 gates:css 에 넣지 않았다 — 같은 사실로
// 빨간불을 둘 만들면 둘 다 안 보게 된다.
//
// 사용:
//   npm run check:player-tokens                          # 진단 (exit 1 = 어긋남)
//   node scripts/check-player-bundle-tokens.mjs --json
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLE_DIR = "community-site/public/player-static/assets";
const TOKENS = "src/styles/tokens.css";

export function parseTokens(css) {
  const out = {};
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) out[m[1]] = m[2].trim();
  return out;
}

// 미니파이어가 바꾸는 표기를 접는다. 값이 **의미상** 같으면 같다고 본다.
export function normalizeValue(v) {
  let s = String(v).toLowerCase().replace(/\s+/g, " ").trim();
  s = s.replace(/(^|[\s,(:])\.(\d)/g, "$10.$2"); // .92 → 0.92
  s = s.replace(/(\d+)ms\b/g, (_, n) => `${Number(n) / 1000}s`); // 120ms → 0.12s
  s = s.replace(/\b0+(\d)/g, "$1"); // 07 → 7
  s = s.replace(/(\.\d*?)0+\b/g, "$1").replace(/\.(?=\D|$)/g, ""); // 0.40 → 0.4, 1. → 1
  return s.replace(/\s*([,()])\s*/g, "$1");
}

export function findBundle(root) {
  const dir = join(root, BUNDLE_DIR);
  if (!existsSync(dir)) return null;
  const hit = readdirSync(dir).filter((f) => /^player-.*\.css$/.test(f)).sort();
  return hit.length ? join(dir, hit[hit.length - 1]) : null;
}

/**
 * @returns {{ bundle: string|null, missing: string[], mismatched: {token: string, bundle: string, source: string}[] }}
 *   missing  — tokens.css 에 있는데 번들에 아예 없는 토큰(확실한 드리프트)
 *   mismatched — 양쪽에 있는데 정규화 후에도 값이 다른 토큰
 */
export function compareBundleTokens({ bundleCss, tokensCss }) {
  const bundle = parseTokens(bundleCss);
  const source = parseTokens(tokensCss);
  const missing = Object.keys(source).filter((t) => !(t in bundle));
  const mismatched = [];
  for (const t of Object.keys(source)) {
    if (!(t in bundle)) continue;
    if (normalizeValue(bundle[t]) !== normalizeValue(source[t])) {
      mismatched.push({ token: t, bundle: bundle[t], source: source[t] });
    }
  }
  return { missing, mismatched };
}

function main() {
  const root = process.cwd();
  const bundlePath = findBundle(root);
  if (!bundlePath) {
    console.log("player-bundle-tokens: 커밋된 번들이 없다 — 검사 생략.");
    return 0;
  }
  const { missing, mismatched } = compareBundleTokens({
    bundleCss: readFileSync(bundlePath, "utf8"),
    tokensCss: readFileSync(resolve(root, TOKENS), "utf8"),
  });
  // 번들은 tokens.css 뒤에 표면 시트를 이어 붙이므로, 같은 토큰을 뒤에서 재정의하는
  // 표면(예: runtime/battle)이 있으면 마지막 값이 잡힌다. 그건 드리프트가 아니다.
  const overridden = new Set(
    Object.keys(parseTokens(readFileSync(resolve(root, TOKENS), "utf8"))).filter((t) =>
      readdirSync(join(root, "src/styles"), { recursive: true })
        .filter((f) => typeof f === "string" && f.endsWith(".css") && f !== "tokens.css")
        .some((f) => {
          const p = join(root, "src/styles", f);
          try { return new RegExp(`${t}\\s*:`).test(readFileSync(p, "utf8")); } catch { return false; }
        }),
    ),
  );
  const realMismatch = mismatched.filter((m) => !overridden.has(m.token));

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ bundle: bundlePath, missing, mismatched: realMismatch }, null, 1));
    return missing.length || realMismatch.length ? 1 : 0;
  }
  if (missing.length === 0 && realMismatch.length === 0) {
    console.log(`player-bundle-tokens: 번들 토큰이 소스와 일치한다 (${bundlePath.split("/").pop()}).`);
    return 0;
  }
  console.error(`player-bundle-tokens: 커밋된 번들이 tokens.css 와 어긋났다 (${bundlePath.split("/").pop()})`);
  for (const t of missing) console.error(`  빠짐  ${t}  (소스에 있는데 번들에 없다)`);
  for (const m of realMismatch) console.error(`  다름  ${m.token}\n      번들: ${m.bundle}\n      소스: ${m.source}`);
  console.error("번들을 다시 만들어 커밋하라 — 안 하면 배포된 플레이어만 옛 값으로 남는다.");
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
