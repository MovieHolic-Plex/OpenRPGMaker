/**
 * 하네스 실행기. 하네스 정의는 src/harnesses/<id>/harness.ts, 구조 규칙은 openwiki/harnesses/README.md.
 *
 *   npm run harness -- list            INDEX.md / catalog.json 을 같은 매니페스트에서 다시 쓴다
 *   npm run harness -- list --check    두 생성물이 매니페스트와 다르면 실패
 *   npm run harness -- catalog         같은 등록 목록을 JSON으로 출력 (작업 실행 없음)
 *   npm run harness -- <id> <단계> ...  그 하네스의 src/harnesses/<id>/node/cli.ts 에 넘긴다
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { HARNESSES, getHarness } from "../src/harnesses/_core/registry";
import { renderHarnessIndex } from "../src/harnesses/_core/indexMarkdown";
import { renderHarnessCatalog } from "../src/harnesses/_core/catalog";

const CATALOG_PATH = resolve(import.meta.dirname, "../src/harnesses/catalog.json");
const INDEX_PATH = resolve(import.meta.dirname, "../src/harnesses/INDEX.md");
const argv = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--"));
const [command, ...rest] = argv;

async function main(): Promise<number> {
  if (command === "catalog") {
    process.stdout.write(renderHarnessCatalog(HARNESSES));
    return 0;
  }
  if (!command || command === "list") {
    const catalog = renderHarnessCatalog(HARNESSES);
    const markdown = renderHarnessIndex(HARNESSES);
    if (rest.includes("--check")) {
      const current = readFileSync(INDEX_PATH, "utf8");
      if (current !== markdown) {
        console.error("src/harnesses/INDEX.md 가 매니페스트와 다르다. npm run harness -- list 로 다시 쓴다.");
        return 1;
      }
      let currentCatalog = "";
      try { currentCatalog = readFileSync(CATALOG_PATH, "utf8"); } catch { /* Missing export is stale. */ }
      if (currentCatalog !== catalog) {
        console.error("src/harnesses/catalog.json 이 매니페스트와 다르다. npm run harness -- list 로 다시 쓴다.");
        return 1;
      }
      console.log("INDEX.md / catalog.json 최신");
      return 0;
    }
    writeFileSync(INDEX_PATH, markdown);
    writeFileSync(CATALOG_PATH, catalog);
    for (const harness of HARNESSES) console.log(`${harness.id} — ${harness.title}${harness.scope.genre ? ` (장르 ${harness.scope.genre})` : ""}`);
    console.log(`→ src/harnesses/INDEX.md / catalog.json`);
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
