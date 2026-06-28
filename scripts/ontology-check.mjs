import { withOntologyModule } from "./ontology-ts-loader.mjs";

async function main() {
  await withOntologyModule(async (module) => {
    const issues = module.checkDevelopmentOntology(module.DEVELOPMENT_ONTOLOGY);
    if (issues.length === 0) {
      console.log("Ontology check passed");
      return;
    }
    console.error(JSON.stringify(issues, null, 2));
    process.exitCode = 1;
  });
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Unknown ontology check failure");
  }
  process.exitCode = 1;
});
