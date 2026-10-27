import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { garbledLines, wikiMarkdownRels } from "../scripts/openwiki-index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("openwiki mojibake index", () => {
  it("keeps a sentence-final question mark and still flags a question mark glued inside a word", () => {
    expect(garbledLines([
      "첫 화면 「어떤 게임을 만들까요?」에서 장르 아래를 누르세요.",
      "조수가 닿나? (경로)",
      "Read this when a user asks “상태가 뭔가요?” / “정의와 적용의 차이?”.",
      "load가 URL에 `?project=`를 스스로 써 넣는다.",
      "「던전은 컨셉이 다양할 수 있으니까, 그만일거같은데? … 버리긴 아깝군.」",
    ])).toEqual([]);

    expect(garbledLines([
      "Main command list expands `loop` body with `: 반복 ?댁슜` markers.",
      "몬\uFFFD스??tab) own battle-facing battler data",
    ])).toEqual([1, 2]);
  });

  it("lists the same broken lines the committed index lists", () => {
    const expected = new Map<string, { count: number; sample: number[] }>();
    for (const rel of wikiMarkdownRels()) {
      const lines = readFileSync(join(ROOT, rel), "utf8").split("\n");
      const garbled = garbledLines(lines);
      if (garbled.length > 0) expected.set(rel, { count: garbled.length, sample: garbled.slice(0, 8) });
    }

    const index = readFileSync(join(ROOT, "openwiki/INDEX.md"), "utf8");
    const section = index.split("## 한국어 산문이 깨진 페이지")[1]?.split("\n## ")[0] ?? "";
    const listed = new Map<string, { count: number; sample: number[] }>();
    for (const line of section.split("\n")) {
      const match = /^\| `(openwiki\/[^`]+)` \| (\d+) \| ([^|]+) \|$/.exec(line.trim());
      if (!match) continue;
      listed.set(match[1], {
        count: Number(match[2]),
        sample: match[3].split(",").map((part) => Number(part.trim())),
      });
    }

    expect([...listed.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [path, row] of expected) {
      expect(listed.get(path)).toEqual(row);
    }
    expect(section).toContain("문장 끝 물음표");
    expect(listed.has("openwiki/getting-started.ko.md")).toBe(false);
    expect(listed.has("openwiki/editor-event-command-fixes.md")).toBe(true);
  });
});
