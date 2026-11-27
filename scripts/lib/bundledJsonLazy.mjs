// 번들 타일셋 정의 JSON(약 43MB)을 진입 청크에서 빼고 처음 쓸 때 fetch 한다(src/project/defaults/bundledJson.ts).
// 브라우저 쪽 변환(편집기·시작 화면·내보낸 플레이어 빌드, dev 서버)에서만 `./bundledJsonSources` 를 지연 출처로 바꿔 끼운다.
// resolve.alias 로 걸면 vite-node(`npm run harness`·`store`·`qa:export` 등)와 ssrLoadModule 까지 같은 설정을 읽어
// node 에서 동기 XHR 길을 타고 `XMLHttpRequest is not defined` 로 죽는다(#3103 회귀, 2026-10-20).
// SSR 변환(= node 실행)은 정적 출처 그대로 둔다 — 테스트·tsx·Electron 메인은 정적 출처다.
//
// 플레이어(2026-10-30): 예전에는 정적 출처라 모든 내보낸 게임이 첫 화면 전에 약 40MB 청크(sessionActorCommands-*.js)를
// 받고 파싱했다 — 첫 프레임이 몇 초~수십 초 검은 화면에 점 세 개였다(이세계 고딩 첫인상 리뷰). 이제 플레이어도 지연 출처를 쓰고,
// exportEntry 가 project.json 이 참조하는 번들 타일셋 정의만 미리 읽는다(preloadBundledTilesetDefinitions).
import { fileURLToPath, URL } from "node:url";

/** @returns {import("vite").Plugin} */
export function bundledJsonLazyPlugin() {
  const lazyBrowser = fileURLToPath(new URL("../../src/project/defaults/bundledJsonSources.lazy.ts", import.meta.url));
  const lazyNode = fileURLToPath(new URL("../../src/project/defaults/bundledJsonSources.node.ts", import.meta.url));
  return {
    name: "oprn-bundled-json-lazy",
    enforce: "pre",
    resolveId(source, _importer, options) {
      if (source !== "./bundledJsonSources") return null;
      return options?.ssr ? lazyNode : lazyBrowser;
    },
  };
}

/**
 * Vitest 전용: environment 가 node 든 happy-dom 이든 항상 Node 지연 출처(fs.readFileSync)로 연결한다.
 * 테스트 파일 import 시점에 18개 대형 타일셋 JSON(60MB+)을 ESM 으로 변환·파싱하지 않는다.
 * @returns {import("vite").Plugin}
 */
export function bundledJsonNodePlugin() {
  const lazyNode = fileURLToPath(new URL("../../src/project/defaults/bundledJsonSources.node.ts", import.meta.url));
  return {
    name: "oprn-bundled-json-node",
    enforce: "pre",
    resolveId(source) {
      if (source !== "./bundledJsonSources") return null;
      return lazyNode;
    },
  };
}
