/**
 * 하네스 실행기. 하네스 정의는 src/harnesses/<id>/harness.ts, 구조 규칙은 openwiki/harnesses/README.md.
 *
 *   npm run harness -- list            src/harnesses/INDEX.md 를 매니페스트에서 다시 쓴다
 *   npm run harness -- list --check    INDEX.md 가 매니페스트와 다르면 실패
 *   npm run harness -- <id> <단계> ...  그 하네스의 src/harnesses/<id>/node/cli.ts 에 넘긴다
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { HARNESSES, getHarness } from "../src/harnesses/_core/registry";
import { renderHarnessIndex } from "../src/harnesses/_core/indexMarkdown";

const INDEX_PATH = resolve(import.meta.dirname, "../src/harnesses/INDEX.md");
const argv = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--"));
const [command, ...rest] = argv;

async function main(): Promise<number> {
  if (!command || command === "list") {
    const markdown = renderHarnessIndex(HARNESSES);
    if (rest.includes("--check")) {
      const current = readFileSync(INDEX_PATH, "utf8");
      if (current !== markdown) {
        console.error("src/harnesses/INDEX.md 가 매니페스트와 다르다. npm run harness -- list 로 다시 쓴다.");
        return 1;
      }
      console.log("INDEX.md 최신");
      return 0;
    }
    writeFileSync(INDEX_PATH, markdown);
    for (const harness of HARNESSES) console.log(`${harness.id} — ${harness.title}${harness.scope.genre ? ` (장르 ${harness.scope.genre})` : ""}`);
    console.log(`→ src/harnesses/INDEX.md`);
    return 0;
  }
  const harness = getHarness(command);
  if (!harness) {
    console.error(`모르는 하네스: ${command}. 목록: ${HARNESSES.map((h) => h.id).join(", ")}`);
    return 2;
  }
  if (!harness.entrypoints.cli) {
    console.error(`${harness.id} 는 CLI 가 없다`);
    return 2;
  }
  const cli = (await import(`../src/harnesses/${harness.id}/node/cli.ts`)) as { run(argv: string[]): Promise<number> };
  return cli.run(rest);
}

main().then((code) => process.exit(code), (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
