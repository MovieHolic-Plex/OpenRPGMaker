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
  // pi-ai 의 exports 는 import 조건만 열어 require.resolve 가 ERR_PACKAGE_PATH_NOT_EXPORTED 로 실패한다 —
  // node_modules 탐색 경로를 받아 패키지 폴더를 직접 찾는다.
  let root;
  try {
    const candidates = createRequire(import.meta.url).resolve.paths("@oh-my-pi/pi-ai") ?? [];
    root = candidates.map((dir) => path.join(dir, "@oh-my-pi", "pi-ai")).find((dir) => existsSync(path.join(dir, "package.json")));
  } catch {
    return {};
  }
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
  const id = encoded("CLIENT_ID");
  const secret = encoded("CLIENT_SECRET");
  const codexId = codex.match(/const CLIENT_ID = "([^"]+)"/)?.[1];
  return {
    ...(id ? { antigravityClientId: decodeBase64(id) } : {}),
    ...(secret ? { antigravityClientSecret: decodeBase64(secret) } : {}),
    ...(codexId ? { codexClientId: codexId } : {}),
  };
}
