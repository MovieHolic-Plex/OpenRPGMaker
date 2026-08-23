import { resolve } from "node:path";
import { checkContract, checkMatrix, parseMatrix } from "./oprn-parity/checks.mjs";
import { parseArgs, redactSecrets, usage } from "./oprn-parity/cli.mjs";
import { buildErrorEvidence, buildEvidence, writeEvidence } from "./oprn-parity/evidence.mjs";
import { fileMetadata, readTextFile } from "./oprn-parity/io.mjs";

const EXIT_PARITY_FAILED = 1;
const EXIT_INPUT_ERROR = 2;

async function main() {
  let args;

  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    console.error(message);
    console.error(usage());
    process.exit(EXIT_INPUT_ERROR);
  }

  const contractPath = resolve(args.contract);
  const matrixPath = resolve(args.matrix);
  const evidencePath = resolve(args.evidence);

  try {
    const [contractText, matrixText, contractMeta, matrixMeta] = await Promise.all([
      readTextFile(contractPath, "contract"),
      readTextFile(matrixPath, "matrix"),
      fileMetadata(contractPath),
      fileMetadata(matrixPath),
    ]);
    const matrix = parseMatrix(matrixText);
    const evidence = buildEvidence({
      contractPath,
      matrixPath,
      evidencePath,
      contractMeta,
      matrixMeta,
      contractResult: checkContract(contractText),
      matrixResult: checkMatrix(matrix),
    });

    await writeEvidence(evidencePath, evidence);

    if (!evidence.ok) {
      console.error(`RM2K3 parity failed: ${evidence.failures.join("; ")}`);
      process.exit(EXIT_PARITY_FAILED);
    }

    console.log(`RM2K3 parity passed: ${evidence.matrix.rowCount} row(s) checked`);
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    const evidence = buildErrorEvidence({ contractPath, matrixPath, evidencePath, message });

    await writeEvidence(evidencePath, evidence);
    console.error(`RM2K3 parity error: ${message}`);
    process.exit(EXIT_INPUT_ERROR);
  }
}

await main();
