// 큰 정적 JSON 모듈을 `JSON.parse("…")` 문자열로 바꾼다(빌드 전용).
//
// 왜(2026-10-15 실측, 웜 부팅): `bundled-data` 청크 44.6M 글자 중 34M 글자가 객체 리터럴이었다. V8 은 객체 리터럴을 스크립트로
// 파싱·컴파일한 뒤 실행하지만, 문자열 리터럴은 훑기만 하고 JSON.parse 는 훨씬 빠른 전용 파서가 만든다 — 같은 데이터를 한 번에
// 객체로 만드는 데 걸리는 시간이 달라진다. Vite 의 json.stringify 는 롤다운이 큰 JSON 에 적용하지 않아(위 청크에서 확인) 직접 한다.
// 동작은 같다: 기본 내보내기 하나(`import data from "x.json"`)이며, 이름 붙은 가져오기는 저장소에 없다(없으면 빌드가 실패한다).
import { readFileSync } from "node:fs";

const MIN_CHARS = 20_000;

export function jsonParseModulesPlugin() {
  return {
    name: "oprn-json-parse-modules",
    enforce: "pre",
    apply: "build",
    load: {
      filter: { id: /\.json$/ },
      handler(id) {
        if (id.includes("?")) return null;
        const code = readFileSync(id, "utf8");
        if (code.length < MIN_CHARS) return null;
        this.addWatchFile?.(id);
        return { code: `export default JSON.parse(${JSON.stringify(code)});\n`, map: null, moduleType: "js" };
      },
    },
  };
}
