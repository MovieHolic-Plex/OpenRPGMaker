// 번들 타일셋 정의 JSON(약 43MB)을 진입 청크에서 빼고 처음 쓸 때 fetch 한다(src/project/defaults/bundledJson.ts).
// 브라우저 쪽 변환(편집기·시작 화면·내보낸 플레이어 빌드, dev 서버)에서만 `#bundled-json-sources` 를 지연 출처로 바꿔 끼운다.
// resolve.alias 로 걸면 vite-node(`npm run harness`·`store`·`qa:export` 등)와 ssrLoadModule 까지 같은 설정을 읽어
// node 에서 동기 XHR 길을 타고 `XMLHttpRequest is not defined` 로 죽는다(#3103 회귀, 2026-10-20).
// SSR 변환(= node 실행)은 이 플러그인이 건드리지 않는다 — 아래 `#bundled-json-sources` 조건 풀이를 그대로 따른다(vitest·vite-node 는 node 출처, tsx·Electron 메인은 정적 출처).
//
// 플레이어(2026-10-30): 예전에는 정적 출처라 모든 내보낸 게임이 첫 화면 전에 약 40MB 청크(sessionActorCommands-*.js)를
// 받고 파싱했다 — 첫 프레임이 몇 초~수십 초 검은 화면에 점 세 개였다(이세계 고딩 첫인상 리뷰). 이제 플레이어도 지연 출처를 쓰고,
// exportEntry 가 project.json 이 참조하는 번들 타일셋 정의만 미리 읽는다(preloadBundledTilesetDefinitions).
import { fileURLToPath, URL } from "node:url";

// 읽는 입구는 package.json 의 `#bundled-json-sources` 다: `development` 조건(vitest·vite-node·dev 서버 SSR)에서는 fs 로 키마다 지연해서 읽는
// bundledJsonSources.node.ts 로, 그 밖(esbuild·tsx·vite build)에서는 정적 출처 bundledJsonSources.ts 로 풀린다. node 출처는 소스 트리의 파일을
// 읽으므로 브라우저로 가는 변환은 아래 플러그인이 조건과 상관없이 출처를 직접 고른다.
const BUNDLED_JSON_SOURCES = "#bundled-json-sources";

/** @returns {import("vite").Plugin} */
export function bundledJsonLazyPlugin() {
  const lazy = fileURLToPath(new URL("../../src/project/defaults/bundledJsonSources.lazy.ts", import.meta.url));
  return {
    name: "oprn-bundled-json-lazy",
    enforce: "pre",
    resolveId(source, _importer, options) {
      if (source !== BUNDLED_JSON_SOURCES || options?.ssr) return null;
      return lazy;
    },
  };
}

/**
 * 정적 출처를 고정한다 — 실행형 HTML(vite.standalone.config.ts)은 file:// 에서 JSON 을 번들에 품어야 하므로, 빌드를 돌린 셸의 NODE_ENV 가
 * development 여도 node 출처(fs)가 끼어들지 못하게 한다.
 * @returns {import("vite").Plugin}
 */
export function bundledJsonStaticPlugin() {
  const staticSource = fileURLToPath(new URL("../../src/project/defaults/bundledJsonSources.ts", import.meta.url));
  return {
    name: "oprn-bundled-json-static",
    enforce: "pre",
    resolveId(source) {
      return source === BUNDLED_JSON_SOURCES ? staticSource : null;
    },
  };
}
