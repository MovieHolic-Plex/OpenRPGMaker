import { describe, expect, it } from "vitest";
import { parseImports, stripCssComments } from "../scripts/lib/css-import-re.mjs";

describe("parseImports", () => {
  it("따옴표·url()·무따옴표·대문자를 모두 같게 읽는다", () => {
    // 전부 유효한 CSS 이고 postcss-import·브라우저가 동일하게 로드한다.
    // 한 형태만 읽는 파서는 나머지를 게이트에서 숨기는 세탁 경로가 된다.
    const forms = [
      `@import "./a.css" layer(database);`,
      `@import './a.css' layer(database);`,
      `@import url(./a.css) layer(database);`,
      `@import url("./a.css") layer(database);`,
      `@import url('./a.css') layer(database);`,
      `@IMPORT URL(./a.css) LAYER(database);`,
    ];
    for (const css of forms) {
      const got = parseImports(css);
      expect(got, css).toHaveLength(1);
      expect(got[0], css).toMatchObject({ spec: "./a.css", layer: "database" });
    }
  });

  it("layer() 없는 import 의 layer 는 null 이다", () => {
    expect(parseImports(`@import "./a.css";`)[0]).toMatchObject({ spec: "./a.css", layer: null });
  });

  it("한 파일 안의 여러 import 를 순서대로 읽는다", () => {
    const got = parseImports(`@import "./a.css" layer(x);\n@import url(./b.css);\n@import './c.css' layer(y);`);
    expect(got.map((i) => i.spec)).toEqual(["./a.css", "./b.css", "./c.css"]);
    expect(got.map((i) => i.layer)).toEqual(["x", null, "y"]);
  });

  it("주석 안의 @import 를 세지 않는다", () => {
    expect(parseImports(`/* @import "./ghost.css"; */\n@import "./real.css";`).map((i) => i.spec))
      .toEqual(["./real.css"]);
  });

  it("문자열 안의 /* 에 속지 않는다 — 정규식 주석 제거의 알려진 구멍", () => {
    const css = [
      `.a::before { content: "/*"; }`,
      `@import "./real.css" layer(map);`,
      `.b::after { content: "*/"; }`,
    ].join("\n");
    // 정규식으로 주석을 지우면 두 content 사이가 통째로 사라져 등록을 놓친다.
    expect(parseImports(css).map((i) => i.spec)).toEqual(["./real.css"]);
  });
});

describe("stripCssComments", () => {
  it("문자열 내용을 보존한다 — 경로가 문자열 안에 있기 때문", () => {
    expect(stripCssComments(`@import "./keep/me.css";`)).toContain("./keep/me.css");
  });

  it("주석을 지우면서 줄 번호를 보존한다", () => {
    const css = `a{}\n/* 두 줄\n짜리 주석 */\nb{}`;
    expect(stripCssComments(css).split("\n")).toHaveLength(css.split("\n").length);
  });
});
