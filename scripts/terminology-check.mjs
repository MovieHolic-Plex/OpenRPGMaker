import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withTsModule } from "./ontology-ts-loader.mjs";

const TERMINOLOGY_ENTRY = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src/project/terminology/index.ts");

export async function withTerminologyModule(callback) {
  return withTsModule(TERMINOLOGY_ENTRY, "terminology.mjs", callback);
}

async function main() {
  await withTerminologyModule(async (module) => {
    const issues = module.checkProductTerminology(module.PRODUCT_TERMINOLOGY);
    if (issues.length === 0) {
      console.log(`Terminology check passed (${module.PRODUCT_TERMINOLOGY.entries.length} terms)`);
      return;
    }
    console.error(JSON.stringify(issues, null, 2));
    process.exitCode = 1;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("Unknown terminology check failure");
    }
    process.exitCode = 1;
  });
}
