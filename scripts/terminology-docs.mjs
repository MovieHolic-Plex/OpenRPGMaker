import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { withTerminologyModule } from "./terminology-check.mjs";

function usage() {
  return "Usage:\n  node scripts/terminology-docs.mjs [--write <path>]";
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { kind: "help" };
  const writeIndex = argv.indexOf("--write");
  if (writeIndex < 0) return { kind: "docs" };
  const writePath = argv[writeIndex + 1];
  if (!writePath) throw new Error(usage());
  return { kind: "docs", writePath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.kind === "help") {
    console.log(usage());
    return;
  }

  await withTerminologyModule(async (module) => {
    const markdown = module.generatedProductTerminologyMarkdown(module.PRODUCT_TERMINOLOGY);
    if (!args.writePath) {
      process.stdout.write(markdown);
      return;
    }
    await mkdir(dirname(args.writePath), { recursive: true });
    await writeFile(args.writePath, markdown, "utf8");
    console.log(`Wrote ${args.writePath}`);
  });
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Unknown terminology docs failure");
  }
  process.exitCode = 1;
});
