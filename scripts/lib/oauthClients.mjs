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
  // 2026-10-16 드리프트: pi-ai 2026-10-12 판은 Antigravity 자격을 TS 상수가 아니라 호환 규칙
  // (pi-catalog/src/compat/rules/auth/google-antigravity.kdl)의 base64 client-id/client-secret 로 옮겼다.
  // 위의 decode("...") 정규식이 빈손으로 돌아와 승인 런타임이 OPRN_ANTIGRAVITY_CLIENT_ID 미설정으로 죽었다.
  // 두 저장 위치를 모두 읽어 어느 판이 깔려 있어도 같은 값을 얻는다(값은 여전히 이 저장소에 적지 않는다).
  const kdl = read("src/compat/rules/auth/google-antigravity.kdl") || read("../pi-catalog/src/compat/rules/auth/google-antigravity.kdl");
  const kdlValue = (name) => kdl.match(new RegExp(`\\b${name}\\s+"([A-Za-z0-9+/=]+)"\\s+encoding="base64"`))?.[1];
  const kdlId = kdlValue("client-id"), kdlSecret = kdlValue("client-secret");
  return {
    ...(id ? { antigravityClientId: decodeBase64(id) } : kdlId ? { antigravityClientId: decodeBase64(kdlId) } : {}),
    ...(secret ? { antigravityClientSecret: decodeBase64(secret) } : kdlSecret ? { antigravityClientSecret: decodeBase64(kdlSecret) } : {}),
    ...(codexId ? { codexClientId: codexId } : {}),
  };
}
