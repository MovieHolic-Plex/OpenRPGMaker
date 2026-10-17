// 다른 회사 앱의 공개 OAuth 클라이언트 값을 설치된 참조 구현 @oh-my-pi/pi-ai 에서 읽는다.
// 이 저장소에는 그 값을 적지 않는다(src/ai/oauth/clientConfig.ts). pi-ai 는 소스(.ts)째 배포되므로
// 그 파일에서 상수 줄만 찾아 읽는다. 찾지 못하면 빈 객체를 돌려주고, 쓰는 쪽이 어느 값이 없는지 말하며 던진다.
//
// import.meta.url 은 함수 안에서만 읽는다 — Electron 메인 CJS 번들에서는 비어 있다(build-electron.mjs 검사).
// 그 번들은 빌드 때 이 함수로 읽은 값을 __OPRN_OAUTH_CLIENTS__ 로 주입받는다.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const decodeBase64 = (value) => Buffer.from(value, "base64").toString("utf8");

/** @returns {Partial<import("../../src/ai/oauth/clientConfig.ts").OAuthClients>} */
export function readOAuthClientsFromPiAi() {
  const packageSearchPaths = (packageName) => {
    const paths = new Set();
    const addResolved = (resolver) => {
      try {
        for (const candidate of resolver.resolve.paths(packageName) ?? []) paths.add(candidate);
      } catch {
        // Bundled host modules run from a temporary directory, where the
        // import.meta.url resolver has no path back to the checkout.
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
  // pi-ai 의 exports 는 import 조건만 열어 require.resolve 가 ERR_PACKAGE_PATH_NOT_EXPORTED 로 실패한다 —
  // node_modules 탐색 경로를 받아 패키지 폴더를 직접 찾는다.
  const root = packageRoot("@oh-my-pi/pi-ai");
  if (!root) return {};
  const read = (relative) => {
    try {
      return readFileSync(path.join(root, relative), "utf8");
    } catch {
      return "";
    }
  };
  const antigravity = read("src/registry/oauth/google-antigravity.ts");
  const codex = read("src/registry/oauth/openai-codex.ts");
  const encoded = (name) => antigravity.match(new RegExp(`const ${name} = decode\\(\\s*"([A-Za-z0-9+/=]+)"`))?.[1];
  // pi-ai 18.x moved OAuth metadata into the shared pi-catalog KDL rules and
  // no longer keeps CLIENT_ID constants in the provider source. Keep the
  // source parser for older installs, then fall back to the installed catalog
  // instead of forcing every local harness to export credentials manually.
  const catalogRoot = packageRoot("@oh-my-pi/pi-catalog");
  const readCatalog = (relative) => {
    if (!catalogRoot) return "";
    try { return readFileSync(path.join(catalogRoot, relative), "utf8"); } catch { return ""; }
  };
  const antigravityRule = readCatalog("src/compat/rules/auth/google-antigravity.kdl");
  const catalogValue = (name) => {
    const match = antigravityRule.match(new RegExp(`${name}\\s+"([^"]+)"(?:\\s+encoding="([^"]+)")?`));
    if (!match?.[1]) return undefined;
    return match[2] === "base64" ? decodeBase64(match[1]) : match[1];
  };
  const id = encoded("CLIENT_ID") ? decodeBase64(encoded("CLIENT_ID")) : catalogValue("client-id");
  const secret = encoded("CLIENT_SECRET") ? decodeBase64(encoded("CLIENT_SECRET")) : catalogValue("client-secret");
  const codexId = codex.match(/const CLIENT_ID = "([^"]+)"/)?.[1]
    ?? readCatalog("src/compat/rules/auth/openai-codex.kdl").match(/client-id\s+"([^"]+)"/)?.[1];
  return {
    ...(id ? { antigravityClientId: id } : {}),
    ...(secret ? { antigravityClientSecret: secret } : {}),
    ...(codexId ? { codexClientId: codexId } : {}),
  };
}
