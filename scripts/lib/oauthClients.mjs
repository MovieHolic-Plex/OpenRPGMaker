// 다른 회사 앱의 공개 OAuth 클라이언트 값을 설치된 @earendil-works/pi-ai 에서 읽는다.
// 이 저장소에는 그 값을 적지 않는다(src/ai/oauth/clientConfig.ts).
// Google Antigravity OAuth 는 계정 정지 위험으로 비활성화되어 읽지 않는다(2026-11-28).
//
// import.meta.url 은 함수 안에서만 읽는다 — Electron 메인 CJS 번들에서는 비어 있다(build-electron.mjs 검사).
// 그 번들은 빌드 때 이 함수로 읽은 값을 __OPRN_OAUTH_CLIENTS__ 로 주입받는다.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** @returns {Partial<import("../../src/ai/oauth/clientConfig.ts").OAuthClients>} */
export function readOAuthClientsFromPiAi() {
  const packageSearchPaths = (packageName) => {
    const paths = new Set();
    const addResolved = (resolver) => {
      try {
        for (const candidate of resolver.resolve.paths(packageName) ?? []) paths.add(candidate);
      } catch {
        // Bundled host modules run from a temporary directory.
      }
    };
    try { addResolved(createRequire(import.meta.url)); } catch { /* CJS bundle has no import.meta.url. */ }
    const repoRoot = process.env.OPRN_REPO_ROOT?.trim();
    if (repoRoot) paths.add(path.join(repoRoot, "node_modules"));
    paths.add(path.resolve(process.cwd(), "node_modules"));
    return [...paths];
  };
  const packageRoot = (packageName) => packageSearchPaths(packageName)
    .map((dir) => path.join(dir, ...packageName.split("/")))
    .find((dir) => existsSync(path.join(dir, "package.json")));

  const root = packageRoot("@earendil-works/pi-ai");
  if (!root) return {};
  const read = (relative) => {
    try {
      return readFileSync(path.join(root, relative), "utf8");
    } catch {
      return "";
    }
  };
  const codex = read("dist/auth/oauth/openai-codex.js");
  const codexId = codex.match(/const CLIENT_ID = "([^"]+)"/)?.[1];
  return {
    ...(codexId ? { codexClientId: codexId } : {}),
  };
}
