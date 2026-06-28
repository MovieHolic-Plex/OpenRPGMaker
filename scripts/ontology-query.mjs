import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { withOntologyModule } from "./ontology-ts-loader.mjs";

function usage() {
  return [
    "Usage:",
    "  node scripts/ontology-query.mjs capability <id> [--json]",
    "  node scripts/ontology-query.mjs entity <id> [--json]",
    "  node scripts/ontology-query.mjs file <path> [--json]",
    "  node scripts/ontology-query.mjs task <text> [--json]",
    "  node scripts/ontology-query.mjs classify <text> [--json]",
    "  node scripts/ontology-query.mjs evaluate [--json]",
    "  node scripts/ontology-query.mjs docs [--write <path>]",
  ].join("\n");
}

function parseArgs(argv) {
  const command = argv[0];
  if (!command || command === "--help" || command === "-h") return { kind: "help" };
  const json = argv.includes("--json");
  const writeIndex = argv.indexOf("--write");
  const writePath = writeIndex >= 0 ? argv[writeIndex + 1] : undefined;
  const values = argv.slice(1).filter((value) => value !== "--json" && value !== "--write" && value !== writePath);
  if (command === "docs") return { kind: "docs", writePath };
  if (command === "evaluate") return { kind: "evaluate", json };
  if (["capability", "entity", "file", "task", "classify"].includes(command) && values.length > 0) {
    return { kind: command, value: values.join(" "), json };
  }
  throw new Error(usage());
}

function renderResult(result, json) {
  if (json) return `${JSON.stringify(result, null, 2)}\n`;
  if (Array.isArray(result)) return `${result.map((item) => item.id).join("\n")}\n`;
  if (!result) return "No match\n";
  return `${result.id}: ${result.purpose ?? result.description ?? result.label}\n`;
}

function renderClassification(result, json) {
  if (json) return `${JSON.stringify(result, null, 2)}\n`;
  const lines = [`Top: ${result.topCapabilityId ?? "No match"}`];
  for (const prediction of result.predictions.slice(0, 3)) {
    lines.push(`${prediction.capabilityId}: similarity=${prediction.similarity}, confidence=${prediction.confidence}`);
    for (const match of prediction.wordMatches) {
      lines.push(`  - ${match.inputWord} -> ${match.matchedTerm} (${match.source}, ${match.contribution})`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function renderEvaluation(result, json) {
  if (json) return `${JSON.stringify(result, null, 2)}\n`;
  const lines = [
    `Accuracy: ${result.accuracy}`,
    `Macro sensitivity: ${result.macroSensitivity}`,
    `Macro precision: ${result.macroPrecision}`,
  ];
  for (const [capabilityId, metrics] of Object.entries(result.categories)) {
    lines.push(`${capabilityId}: sensitivity=${metrics.sensitivity}, precision=${metrics.precision}`);
  }
  return `${lines.join("\n")}\n`;
}

async function writeDocs(markdown, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.kind === "help") {
    console.log(usage());
    return;
  }

  await withOntologyModule(async (module) => {
    const ontology = module.DEVELOPMENT_ONTOLOGY;
    if (args.kind === "docs") {
      const markdown = module.generatedDevelopmentOntologyMarkdown(ontology);
      if (args.writePath) {
        await writeDocs(markdown, args.writePath);
        console.log(`Wrote ${args.writePath}`);
      } else {
        process.stdout.write(markdown);
      }
      return;
    }
    if (args.kind === "classify") {
      process.stdout.write(renderClassification(module.classifyOntologyTask(ontology, args.value), args.json));
      return;
    }
    if (args.kind === "evaluate") {
      process.stdout.write(renderEvaluation(module.evaluateOntologyClassification(ontology, module.ONTOLOGY_CLASSIFICATION_EXAMPLES), args.json));
      return;
    }

    const queries = {
      capability: module.queryOntologyByCapability,
      entity: module.queryOntologyByEntity,
      file: module.queryOntologyByFile,
      task: module.queryOntologyByTask,
    };
    process.stdout.write(renderResult(queries[args.kind](ontology, args.value), args.json));
  });
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Unknown ontology query failure");
  }
  process.exitCode = 1;
});
